/**
 * ============================================================================
 * MOTOR DO MICROSCOPIO VIRTUAL (PALAS ATLAS V3)
 * ============================================================================
 * Le os dados da lamina do Firestore pelo ID da URL, inicializa o
 * OpenSeadragon com imagemUrl, injeta descricaoHTML na barra lateral
 * e implementa delegacao de eventos para os pin-links.
 *
 * Chaves canonicas lidas do Firestore:
 *   nome          -> Titulo da lamina
 *   imagemUrl     -> URL do .dzi ou imagem estatica (CHAVE CRITICA)
 *   descricaoHTML -> HTML do texto descritivo com pin-link (CHAVE CRITICA)
 *   pinos         -> Array de { id, rotulo, x, y }
 *   mpp           -> Microns por pixel (opcional, default 0.25)
 *
 * Zero Truncamento | Zero Emojis | Clinical Precision UI
 */

import { db } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// Estado do modulo
// ---------------------------------------------------------------------------
let viewer       = null;
let listaPinosAtual = [];
let laminaAtualData = null;
let pinAtivo     = null;
let homeZoomRef  = null; // Zoom de referencia para mapeamento 4x/10x/40x/100x

// ---------------------------------------------------------------------------
// 1. Disparo automatico ao carregar a pagina
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const laminaId  = urlParams.get("id") || urlParams.get("laminaId");
  if (laminaId) {
    carregarLaminaNoMicroscopio(laminaId);
  } else {
    console.warn("[Palas Atlas] Nenhum ID de lamina passado na URL (?id=...).");
    exibirErroMicroscopio("Nenhuma lamina selecionada. Acesse pelo Catalogo de Topicos.");
  }
  registrarDelegacaoGlobalDePinos();
});

// ---------------------------------------------------------------------------
// 2. Carrega a lamina pelo ID do Firestore
// ---------------------------------------------------------------------------
async function carregarLaminaNoMicroscopio(laminaId) {
  if (!laminaId) return;
  if (typeof db === "undefined" || !db) {
    exibirErroMicroscopio("Falha de conexao com o banco de dados (Firestore nao inicializado).");
    return;
  }
  try {
    const docRef = await db.collection("laminas").doc(laminaId).get();
    if (!docRef.exists) {
      console.error("[Palas Atlas] Lamina nao encontrada no Firestore para ID:", laminaId);
      exibirErroMicroscopio("Lamina nao encontrada no banco de dados.");
      return;
    }
    laminaAtualData    = { id: docRef.id, ...docRef.data() };
    listaPinosAtual    = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
    inicializarOpenSeadragon();
  } catch (err) {
    console.error("[Palas Atlas] Erro ao buscar lamina no Firestore:", err);
    exibirErroMicroscopio("Falha ao carregar os dados da lamina. Verifique sua conexao.");
  }
}

// ---------------------------------------------------------------------------
// 3. Injeta metadados no cabecalho da pagina
// ---------------------------------------------------------------------------
function renderizarMetadadosDaLamina() {
  if (!laminaAtualData) return;
  const tituloEl    = document.getElementById("slideTitle");
  const disciplinaEl = document.getElementById("slideDisciplina");
  const coloracaoEl = document.getElementById("slideColoracao");
  const breadcrumb  = document.getElementById("viewerBreadcrumb");
  const docTitle    = document.querySelector("title");

  let tituloLimpo = laminaAtualData.nome || "Peca Morfologica";
  tituloLimpo = tituloLimpo.replace(/\sHE$|\sH&E$/i, '');

  if (tituloEl)     tituloEl.textContent    = tituloLimpo;
  if (disciplinaEl) disciplinaEl.textContent = (laminaAtualData.disciplina || "histologia").toUpperCase();
  if (coloracaoEl)  coloracaoEl.innerHTML   = `${laminaAtualData.coloracao || "Hematoxilina e Eosina (H&amp;E)"}`;
  if (breadcrumb)   { breadcrumb.textContent = tituloLimpo; breadcrumb.classList.remove("hidden"); }
  if (docTitle)     docTitle.textContent    = `${tituloLimpo} - Palas Atlas`;
}

// ---------------------------------------------------------------------------
// 4. Injeta descricaoHTML na barra lateral com hiperlinks inline de pinos
// ---------------------------------------------------------------------------
function renderizarDescricaoETextos() {
  if (!laminaAtualData) return;
  const container = document.getElementById("slideDescriptionContainer");
  if (!container) {
    console.warn("[Palas Atlas] Container #slideDescriptionContainer nao encontrado no HTML.");
    return;
  }

  const tituloPeca = document.getElementById("slideTitle")?.textContent || "Lamina Histologica";
  let html = laminaAtualData.descricaoHTML || laminaAtualData.descricao || "";

  if (!html) {
    container.innerHTML = `<p class="text-neutral-500 italic text-sm font-sans">Nenhum texto descritivo cadastrado para esta lamina.</p>`;
    return;
  }

  // Pontos de Interesse como lista clicavel abaixo do texto
  let secaoPinos = "";
  if (listaPinosAtual.length > 0) {
    secaoPinos = `
      <div class="mt-8 border-t border-neutral-800 pt-6">
        <h4 class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 font-mono">
          Pontos de Interesse
        </h4>
        <div class="flex flex-col gap-2">
          ${listaPinosAtual.map(pin => `
            <button
              type="button"
              onclick="window.focarPinoNoViewer('${pin.id}')"
              class="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-amber-500/50 text-left transition-all group cursor-pointer"
            >
              <div class="flex items-center gap-2.5 truncate pr-2">
                <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"></span>
                <span class="text-sm font-medium text-slate-200 truncate">${pin.rotulo || "Estrutura"}</span>
              </div>
              <span class="text-xs text-neutral-500 group-hover:text-amber-400 shrink-0 transition-colors">Focar &rarr;</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="prose-atlas text-neutral-300 text-sm font-sans leading-loose space-y-4">
      ${html}
    </div>
    ${secaoPinos}
    <a
      href="mailto:contato@palasatlas.com?subject=Correção sugerida na peça: ${encodeURIComponent(tituloPeca)}"
      class="text-xs text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer mt-6 border-t border-neutral-800/50 pt-4 w-fit"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
      </svg>
      Reportar Erro nesta Lamina
    </a>
  `;

  // Estiliza pin-links inline injetados pelo CMS no descricaoHTML
  container.querySelectorAll('.pin-link, [data-pin-id]').forEach(el => {
    el.className = "pin-link text-amber-500 hover:text-amber-400 underline font-medium cursor-pointer transition-colors px-0.5";
  });
}

// ---------------------------------------------------------------------------
// 5. Inicializa o OpenSeadragon com constraints de trava e escalas corretas
// ---------------------------------------------------------------------------
function inicializarOpenSeadragon() {
  if (!laminaAtualData) return;
  const containerId = "osd-viewer";
  const container   = document.getElementById(containerId);
  if (!container) {
    console.error("[Palas Atlas] Container #osd-viewer nao encontrado no HTML.");
    return;
  }
  if (typeof window.OpenSeadragon !== "function") {
    console.error("[Palas Atlas] Biblioteca OpenSeadragon nao carregada.");
    return;
  }

  const imagemUrl = laminaAtualData.imagemUrl || laminaAtualData.imageUrl || laminaAtualData.dziUrl || "";
  if (!imagemUrl) {
    exibirErroMicroscopio("Esta lamina nao possui URL de imagem cadastrada. Edite-a no Painel Dev.");
    return;
  }

  if (viewer && typeof viewer.destroy === "function") { viewer.destroy(); viewer = null; }

  const isDzi = imagemUrl.endsWith(".dzi") || imagemUrl.includes(".dzi?");
  const tileSourcesConfig = isDzi ? imagemUrl : { type: "image", url: imagemUrl };

  // MPP da lamina (microns por pixel) — usado pela scalebar
  const mpp = Number(laminaAtualData.mpp) || 0.25;
  const pixelsPerMeter = Math.round(1e6 / mpp);

  // Req 2: Limite de zoom máximo baseado na objetiva real da lâmina
  // Mapeamento: 40x→1.2, 60x→1.8, 100x→2.5 (evita pixelização além da resolução física)
  const maxMag = Number(laminaAtualData.maxMagnification) || 40;
  const maxZoomPixelRatioMap = { 40: 1.2, 60: 1.8, 100: 2.5 };
  const maxZoomPixelRatio = maxZoomPixelRatioMap[maxMag] || 1.2;

  // FIX BUG 1: Garantir min-height no container para evitar colapso no Safari iOS
  if (container) {
    container.style.minHeight = container.style.minHeight || "300px";
  }

  // Registra o tempo de início do carregamento da imagem
  window.__microscopeStartTime = Date.now();

  viewer = window.OpenSeadragon({
    id:                       containerId,
    prefixUrl:                "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
    tileSources:              tileSourcesConfig,
    showNavigationControl:    false,
    showSequenceControl:      false,
    showHomeControl:          false,
    showFullPageControl:      false,
    showZoomControl:          false,
    showNavigator:            true,
    navigatorPosition:        "BOTTOM_RIGHT",
    navigatorWidth:           "120px",
    navigatorHeight:          "90px",
    navigatorBackground:      "rgba(10,10,10,0.9)",
    navigatorBorderColor:     "rgba(59,130,246,0.35)",
    navigatorAutoFade:        false,
    showReferenceStrip:       false,
    animationTime:            0.45,
    blendTime:                0.1,
    maxZoomPixelRatio:        maxZoomPixelRatio,

    // ── TRAVA DE PAN ──────────────────────────────────────────────────
    panHorizontal:            true,
    panVertical:              true,
    constrainDuringPan:       true,
    visibilityRatio:          0.8,
    minZoomImageRatio:        0.9,
    // ─────────────────────────────────────────────────────────────────

    // Gestos de Mouse (Desktop)
    gestureSettingsMouse: {
      scrollToZoom:   true,
      clickToZoom:    false,
      dblClickToZoom: false,
      dragToPan:      true
    },

    // FIX BUG 1: Gestos de Toque (Mobile) — ausentes anteriormente
    gestureSettingsTouch: {
      pinchToZoom:    true,
      flickEnabled:   false,
      dragToPan:      true,
      dblClickToZoom: false,
      pinchRotate:    false
    }
  });

  // Configuração base da régua
  if (window.OpenSeadragon.ScalebarType) {
    viewer.scalebar({
      type:            window.OpenSeadragon.ScalebarType.MICROSCOPE,
      location:        window.OpenSeadragon.ScalebarLocation.TOP_RIGHT,
      pixelsPerMeter:  pixelsPerMeter,
      color:           "#e4e4e7",
      backgroundColor: "rgba(24, 24, 27, 0.8)",
      fontFamily:      "'JetBrains Mono', monospace",
      barThickness:    2,
      xOffset:         16,
      yOffset:         16
    });
  }

  // ── Evento: imagem aberta com sucesso ────────────────────────────────
  viewer.addHandler("open", () => {
    const elapsed = Date.now() - window.__microscopeStartTime;
    const remainingTime = Math.max(0, 3000 - elapsed); // Garante no min 3 segundos

    setTimeout(() => {
      // Remove skeleton de carregamento com fade out suave
      const skeleton  = document.getElementById("osdSkeleton");
      const osdCanvas = document.getElementById("osd-viewer");
      if (skeleton) {
        skeleton.style.opacity = '0';
        skeleton.style.pointerEvents = 'none';
        setTimeout(() => {
          skeleton.classList.add("hidden");
          skeleton.style.opacity = '';
          skeleton.style.pointerEvents = '';
        }, 1000); // 1s da animacao css
      }
      if (osdCanvas) osdCanvas.classList.remove("opacity-0");
    }, remainingTime);

    // Salva zoom home como baseline 4x (item 4)
    homeZoomRef = viewer.viewport.getHomeZoom();
    viewer.viewport.minZoomLevel = homeZoomRef * 0.9;

    // Req 1: Trava rígida de zoom exata (sem ultrapassar a objetiva física)
    viewer.viewport.maxZoomLevel = homeZoomRef * (maxMag / 4);

    // Inicia na visao geral (4x baseline)
    viewer.viewport.zoomTo(homeZoomRef, null, true);

    // Req 2: Desabilita botoes de objetiva acima do maxMagnification
    aplicarBloqueioObjetivas(maxMag);

    // Estiliza navigator e scalebar via DOM (item 5 e HUD Unificado)
    setTimeout(() => {
      const navParent = document.querySelector(".openseadragon-navigator");
      if (navParent) {
        Object.assign(navParent.style, {
          overflow:     "hidden",
          borderRadius: "10px",
          border:       "1px solid rgba(59,130,246,0.3)",
          boxShadow:    "0 4px 24px rgba(0,0,0,0.6)"
        });
      }

      // Estiliza a régua no seu local nativo
      const scalebarEl = document.querySelector(".openseadragon-scalebar");
      if (scalebarEl) {
        Object.assign(scalebarEl.style, {
          borderRadius: "8px",
          padding:      "4px 12px",
          backdropFilter: "blur(8px)",
          border:       "1px solid rgba(63, 63, 70, 0.8)", // border-zinc-700/80
          fontSize:     "10px",
          fontWeight:   "600"
        });
      }
    }, 600);
  });

  // ── Req 2: Função unificada de Indicador Dinâmico de Zoom ────────────
  const updateZoomDisplay = () => {
    if (!viewer || !viewer.viewport) return;
    const currentOSDZoom = viewer.viewport.getZoom(true);
    const homeZoom = viewer.viewport.getHomeZoom();
    if (homeZoom > 0) {
      const magRaw = (currentOSDZoom / homeZoom) * 4;
      const mag = Math.min(magRaw, maxMag);
      const display = document.getElementById("zoomIndicatorDisplay");
      if (display) display.textContent = `${mag.toFixed(1)}x`;
    }
  };

  viewer.addHandler("open", updateZoomDisplay);
  viewer.addHandler("animation", updateZoomDisplay);

  // ── Trava: impede subir abaixo do zoom home (item 3) ─────────────────
  viewer.addHandler("zoom", (event) => {
    if (!homeZoomRef) return;
    if (viewer.viewport.getZoom() < homeZoomRef * 0.9) {
      viewer.viewport.zoomTo(homeZoomRef, null, true);
    }
    atualizarLenteBotaoAtivo();
    updateZoomDisplay();
  });

  viewer.addHandler("open-failed", (event) => {
    console.error("[Palas Atlas] OpenSeadragon falhou ao carregar imagem:", event);
    exibirErroMicroscopio(`Nao foi possivel carregar a imagem: ${imagemUrl}`);
  });
}

// ---------------------------------------------------------------------------
// 6. Atualiza destaque do botao de lente conforme zoom atual (item 4)
// ---------------------------------------------------------------------------
function atualizarLenteBotaoAtivo() {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;
  const currentZoom = viewer.viewport.getZoom(true);
  const ratio       = currentZoom / homeZoomRef;

  // Mapeamento: 4x=baseline, 10x=~2.5x, 40x=~10x, 100x=~25x
  let objetivo = "4x";
  if      (ratio >= 18)  objetivo = "100x";
  else if (ratio >= 7)   objetivo = "40x";
  else if (ratio >= 2.2) objetivo = "10x";

  document.querySelectorAll(".lens-btn").forEach(btn => {
    // Pula botões bloqueados (disabled) para não sobrescrever classes
    if (btn.disabled) return;

    const isAtivo = btn.textContent.trim() === objetivo;
    btn.className = isAtivo
      ? "lens-btn bg-amber-600 text-white shadow-md font-semibold px-3 py-1 rounded-lg transition-all active-lens"
      : "lens-btn bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 font-semibold px-3 py-1 rounded-lg transition-all";
  });
}

// ---------------------------------------------------------------------------
// 6.5 Bloqueia botões de lente acima da capacidade física da lâmina (Req 2)
// ---------------------------------------------------------------------------
function aplicarBloqueioObjetivas(maxMag) {
  const limiteMag = Number(maxMag) || 40;
  document.querySelectorAll(".lens-btn").forEach(btn => {
    const magBotao = Number(btn.getAttribute("data-mag")) || 4;
    if (magBotao > limiteMag) {
      btn.disabled = true;
      btn.className = "lens-btn bg-zinc-800/80 text-zinc-300 font-semibold px-3 py-1 rounded-lg cursor-not-allowed opacity-30";
      btn.title = `Objetiva não disponível (Máx: ${limiteMag}x)`;
    } else {
      btn.disabled = false;
      btn.title = "";
    }
  });
}

// ---------------------------------------------------------------------------
// 7. Delegacao global de eventos para pin-link no texto descritivo
// ---------------------------------------------------------------------------
function registrarDelegacaoGlobalDePinos() {
  document.addEventListener("click", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id]");
    if (!alvo) return;
    const pinIdRaw = alvo.getAttribute("data-pin-id");
    if (!pinIdRaw) return;
    evento.preventDefault();
    focarPinoNoViewer(pinIdRaw);
  });
}

// ---------------------------------------------------------------------------
// 8. Foca o pino no viewer com overlay neon (item 6)
//    Coordenadas calculadas APOS o evento open (nunca antes da imagem estar pronta)
// ---------------------------------------------------------------------------
function focarPinoNoViewer(pinIdRaw) {
  const pino = listaPinosAtual.find(p => String(p.id) === String(pinIdRaw));
  if (!pino) {
    console.warn("[Palas Atlas] Pino nao encontrado para ID:", pinIdRaw);
    return;
  }
  if (!viewer || !viewer.viewport || !window.OpenSeadragon) {
    console.warn("[Palas Atlas] Viewer nao inicializado ao tentar focar pino.");
    return;
  }

  // Converte coordenadas de pixel da imagem original → coordenadas normalizadas do viewport
  const pontoViewport = viewer.viewport.imageToViewportCoordinates(
    new window.OpenSeadragon.Point(Number(pino.x) || 0, Number(pino.y) || 0)
  );

  // Remove pin ativo anterior
  if (pinAtivo) {
    const anterior = document.getElementById(`viewer-pin-${pinAtivo}`);
    if (anterior) { try { viewer.removeOverlay(anterior); } catch (e) {} }
  }

  // Cria elemento do pino neon pulsante
  // FIX BUG 5: Removido <style> injetado via innerHTML a cada chamada.
  // A keyframe @keyframes ping já está disponível via Tailwind (animate-ping).
  const pinId   = String(pino.id);
  const pinElem = document.createElement("div");
  pinElem.id    = `viewer-pin-${pinId}`;
  pinElem.style.cssText = "pointer-events:none; position:relative; display:flex; align-items:center; justify-content:center; width:32px; height:32px;";
  pinElem.innerHTML = `
    <div class="animate-ping" style="position:absolute;width:100%;height:100%;background:rgba(56,189,248,0.4);border-radius:50%;"></div>
    <div style="position:relative;width:12px;height:12px;background:#0ea5e9;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 3px rgba(14,165,233,0.4),0 4px 12px rgba(0,0,0,0.5);"></div>
  `;

  // Adiciona overlay ancorado no ponto exato da imagem (item 6 — fix de posicionamento)
  viewer.addOverlay({
    element:   pinElem,
    location:  pontoViewport,
    placement: window.OpenSeadragon.Placement.CENTER
  });

  // Pan suave ate o pino (sem ultrapassar os limites)
  viewer.viewport.panTo(pontoViewport, false);

  pinAtivo = pinId;

  // Auto-remove apos 4s
  setTimeout(() => {
    if (pinElem && viewer) {
      try { viewer.removeOverlay(pinElem); } catch (e) {}
      if (pinAtivo === pinId) pinAtivo = null;
    }
  }, 4000);
}

// ---------------------------------------------------------------------------
// 9. Controles publicos de navegacao (zoom, reset, center)
// ---------------------------------------------------------------------------
export function osdViewerAction(acao) {
  if (!viewer || !viewer.viewport) return;
  if      (acao === "zoomIn")  viewer.viewport.zoomTo(viewer.viewport.getZoom() * 1.5);
  else if (acao === "zoomOut") viewer.viewport.zoomTo(viewer.viewport.getZoom() * 0.67);
  else if (acao === "reset") {
    viewer.viewport.goHome();
    atualizarLenteBotaoAtivo();
  }
  else if (acao === "center")  viewer.viewport.panTo(viewer.viewport.getCenter());
  else if (acao === "home")    viewer.viewport.goHome();
  else if (acao === "fullpage") viewer.setFullPage(!viewer.isFullPage());
}

// ---------------------------------------------------------------------------
// 9.5 Trocar Lente Objetiva — zoom baseado no homeZoomRef como 4x
// ---------------------------------------------------------------------------
export function trocarLente(objetivaDesejada, btnElement) {
  if (!viewer || !viewer.viewport) return;

  const base = homeZoomRef || viewer.viewport.getHomeZoom();
  const targetZoom = base * (objetivaDesejada / 4);
  viewer.viewport.zoomTo(targetZoom, null, false);

  if (btnElement) {
    document.querySelectorAll(".lens-btn").forEach(l => {
      l.className = "lens-btn text-slate-400 hover:text-white border border-transparent px-3 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer";
    });
    btnElement.className = "lens-btn bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer active-lens";
  }
}

// ---------------------------------------------------------------------------
// 10. Exibir mensagem de erro no container do viewer
// ---------------------------------------------------------------------------
function exibirErroMicroscopio(msg) {
  const container = document.getElementById("osd-viewer");
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full text-center gap-4 p-8">
      <div class="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-center justify-center">
        <svg class="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <p class="text-rose-400 text-sm font-mono font-semibold max-w-xs">${msg}</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Exposicao global (compatibilidade com onclick no HTML)
// ---------------------------------------------------------------------------
window.App = window.App || {};
Object.assign(window.App, { osdViewerAction, focarPinoNoViewer, trocarLente });
window.osdViewerAction    = osdViewerAction;
window.focarPinoNoViewer  = focarPinoNoViewer;
window.trocarLente        = trocarLente;
