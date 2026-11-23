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
import {
  sanitizarHTMLDescricao,
  formatarDescricaoMorfolgica,
  escaparHTML
} from "./sanitizer.js";
import {
  emitirCertidaoOptica,
  calcularCampoDeVisaoUm,
  formatarComprimento,
  objetivaDisponivel,
  ROTULOS_SELO
} from "./optics-calibration.js?v=20261118v3";

// ---------------------------------------------------------------------------
// Estado do modulo
// ---------------------------------------------------------------------------
let viewer                  = null;
let listaPinosAtual         = [];
let listaQuestoesAtual      = [];
let questaoAtivaId          = null;
let overlayQuestaoAtiva     = null;
let overlayPinAtivo         = null;
let overlaysPinosPersistentes = [];
let marcacoesVisiveis       = false;
let _pinAutoHideTimer       = null;
let laminaAtualData         = null;
let pinAtivo                = null;
let homeZoomRef             = null; // Zoom de referencia para enquadramento geral (4x)
let _delegacaoPinosRegistrada = false;
let abaAtivaPainel          = "descricao";
const debounceTimersRespostas = {};
const _respostasPendentes   = new Map();

// Estado da Régua Morfométrica Interativa (µm / mm)
let modoReguaAtivo          = false;
let reguaPontoA             = null;
let reguaPontoB             = null;
let overlayRegua            = null;
let _reguaOverlayIsPreview  = false;
let _reguaPointerRaf        = null;
let _reguaPointerMoveHandler = null;
let _reguaPointerHost       = null;

// Toast, Deep Link e Troca Rápida de Lâmina
let _viewerToastTimer       = null;
let _pendingUrlPinId        = null;
let _atalhosRegistrados     = false;
let _fullscreenRegistrado   = false;
let _popstateRegistrado     = false;
let _pagehideRegistrado     = false;
let _catalogoLaminasSwitcher = [];

// Controle de concorrência e temporizadores do visualizador
let _loadEpoch              = 0;
let _viewerInstanceSeq      = 0;
let _activeOpenTimer        = null;
let _styleSyncTimer         = null;
let _stageResizeObserver    = null;

// Estado editorial e controles de bancada
let modoBancadaAtivo        = false;
let stageToneAtual          = "neutral";
let minimapRecolhido        = false;
let _popoversRegistrados    = false;

// Certidão Óptica: ampliação real comprovada da lâmina (ver js/optics-calibration.js)
let certidaoOpticaAtual     = null;

const STAGE_TONE_STORAGE_KEY = "palasAtlas.stageTone";
const MINIMAP_STORAGE_KEY    = "palasAtlas.minimapCollapsed";

function isSafeSlideUrl(rawUrl) {
  const val = String(rawUrl || "").trim();
  if (!val) return false;
  const lower = val.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:") || lower.startsWith("//")) {
    return false;
  }
  if (lower.startsWith("https://")) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(val)) return false;
  if (val.includes("..")) return false;
  return true;
}

function isColoracaoGenerica(val) {
  const s = String(val || "").trim().toLowerCase();
  return !s || s === "outra" || s === "outro" || s === "outros" || s === "n/a" || s === "-";
}

function atualizarScalebarOpenSeadragon(targetViewer, mppVal) {
  const legacySb = document.querySelector(".openseadragon-scalebar");
  if (legacySb) legacySb.style.display = "none";
  atualizarScalebarEditorial();
}

const SCALEBAR_STEPS_UM = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

function formatarRotuloScalebar(um) {
  if (!Number.isFinite(um) || um <= 0) return "—";
  if (um >= 1000) {
    const mm = um / 1000;
    return `${Number.isInteger(mm) ? mm : mm.toFixed(1).replace(".", ",")} mm`;
  }
  return `${um} µm`;
}

export function atualizarScalebarEditorial() {
  const box   = document.getElementById("palasScalebar");
  const label = document.getElementById("palasScalebarLabel");
  const bar   = document.getElementById("palasScalebarBar");
  if (!box || !label || !bar) return;

  const mpp = obterMppAtivo();
  if (!mpp || !viewer || !viewer.viewport || !viewer.world || viewer.world.getItemCount() === 0) {
    box.classList.add("hidden");
    box.classList.remove("flex");
    return;
  }

  const currentZoom = viewer.viewport.getZoom(true);
  const nativeZoom  = getNativeZoomRef();
  if (!currentZoom || !nativeZoom || currentZoom <= 0 || nativeZoom <= 0) {
    box.classList.add("hidden");
    box.classList.remove("flex");
    return;
  }

  const umPerScreenPx = (nativeZoom / currentZoom) * mpp;
  if (!Number.isFinite(umPerScreenPx) || umPerScreenPx <= 0) {
    box.classList.add("hidden");
    box.classList.remove("flex");
    return;
  }

  const targetPx = window.innerWidth < 640 ? 74 : 96;
  let bestStep = SCALEBAR_STEPS_UM[0];
  let bestWidth = bestStep / umPerScreenPx;
  let bestDist = Infinity;

  for (const step of SCALEBAR_STEPS_UM) {
    const wPx = step / umPerScreenPx;
    if (wPx >= 46 && wPx <= 152) {
      const dist = Math.abs(wPx - targetPx);
      if (dist < bestDist) {
        bestDist = dist;
        bestStep = step;
        bestWidth = wPx;
      }
    }
  }

  if (bestDist === Infinity) {
    for (const step of SCALEBAR_STEPS_UM) {
      const wPx = step / umPerScreenPx;
      const dist = Math.abs(wPx - targetPx);
      if (dist < bestDist) {
        bestDist = dist;
        bestStep = step;
        bestWidth = wPx;
      }
    }
  }

  const clampedWidth = Math.max(36, Math.min(168, Math.round(bestWidth)));
  label.textContent = formatarRotuloScalebar(bestStep);
  bar.style.width = `${clampedWidth}px`;
  box.classList.remove("hidden");
  box.classList.add("flex");
}

// ---------------------------------------------------------------------------
// Barra lateral retrátil (painel de informações e pontos de interesse)
// ---------------------------------------------------------------------------
const SIDEBAR_STORAGE_KEY = "palasAtlas.sidebarCollapsed";

function sincronizarTamanhoDoViewer() {
  if (window.slideSecurity && typeof window.slideSecurity._redimensionarMarcaDagua === "function") {
    try { window.slideSecurity._redimensionarMarcaDagua(); } catch (e) {}
  }
  if (!viewer || !viewer.viewport) return;
  try {
    if (typeof viewer.forceResize === "function") viewer.forceResize();
    else viewer.viewport.resize(viewer.viewport.getContainerSize(), false);
    viewer.forceRedraw();
    atualizarScalebarEditorial();
  } catch (e) { /* viewer em transição: ignora */ }
}

function isMobileOrLandscapeDrawer() {
  return window.innerWidth < 1024 || window.innerHeight <= 500;
}

function aplicarEstadoSidebar(recolhida, persistir) {
  const sidebar  = document.getElementById("viewerSidebar");
  const botao    = document.getElementById("btnToggleSidebar");
  const backdrop = document.getElementById("viewerBackdrop");
  if (!sidebar) return;

  const isDrawerMode = isMobileOrLandscapeDrawer();

  sidebar.classList.toggle("w-[88vw]", !recolhida);
  sidebar.classList.toggle("sm:w-[370px]", !recolhida);
  sidebar.classList.toggle("lg:w-[340px]", !recolhida);
  sidebar.classList.toggle("xl:w-[396px]", !recolhida);
  sidebar.classList.toggle("max-w-[396px]", !recolhida);
  sidebar.classList.toggle("opacity-100", !recolhida);
  sidebar.classList.toggle("pointer-events-auto", !recolhida);
  sidebar.classList.toggle("w-0", recolhida);
  sidebar.classList.toggle("opacity-0", recolhida);
  sidebar.classList.toggle("pointer-events-none", recolhida);
  sidebar.setAttribute("aria-hidden", String(recolhida));
  if (recolhida) sidebar.setAttribute("inert", ""); else sidebar.removeAttribute("inert");

  // Backdrop escurecido no mobile/tablet
  if (backdrop) {
    if (!recolhida && isDrawerMode) {
      backdrop.classList.remove("hidden");
      requestAnimationFrame(() => {
        backdrop.classList.remove("opacity-0", "pointer-events-none");
        backdrop.classList.add("opacity-100", "pointer-events-auto");
      });
    } else {
      backdrop.classList.remove("opacity-100", "pointer-events-auto");
      backdrop.classList.add("opacity-0", "pointer-events-none");
      setTimeout(() => {
        if (sidebar.classList.contains("w-0") || !isDrawerMode) {
          backdrop.classList.add("hidden");
        }
      }, 300);
    }
  }

  if (botao) {
    botao.setAttribute("aria-expanded", String(!recolhida));
    const rotulo = recolhida ? "Expandir painel" : "Recolher painel";
    botao.setAttribute("title", rotulo);
    botao.setAttribute("aria-label", recolhida ? "Expandir painel de informações" : "Recolher painel de informações");
  }
  if (persistir) {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, recolhida ? "1" : "0"); } catch (e) {}
  }

  sincronizarTamanhoDoViewer();
}

function iniciarSidebarRetratil() {
  const sidebar  = document.getElementById("viewerSidebar");
  const botao    = document.getElementById("btnToggleSidebar");
  const backdrop = document.getElementById("viewerBackdrop");
  const btnClose = document.getElementById("btnCloseSidebarMobile");
  if (!sidebar) return;
  if (sidebar.dataset.bound === "1") return;
  sidebar.dataset.bound = "1";

  const isDrawerMode = isMobileOrLandscapeDrawer();

  // No modo drawer (celular e tablet), sempre inicia recolhido para exibir o microscópio limpo
  let recolhidaInicial = isDrawerMode;
  if (!isDrawerMode) {
    try {
      const salvo = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (salvo !== null) {
        recolhidaInicial = salvo === "1";
      }
    } catch (e) {}
  }
  aplicarEstadoSidebar(recolhidaInicial, false);

  if (botao) {
    botao.addEventListener("click", () => {
      aplicarEstadoSidebar(!sidebar.classList.contains("w-0"), true);
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      aplicarEstadoSidebar(true, true);
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      aplicarEstadoSidebar(true, true);
    });
  }

  // Suporte ergonômico a swipe touch para fechar o drawer (deslizar para a direita)
  let touchStartX = 0;
  let touchStartY = 0;
  sidebar.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  sidebar.addEventListener("touchend", (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (deltaX > 50 && Math.abs(deltaY) < 60) {
        if (isMobileOrLandscapeDrawer()) {
          aplicarEstadoSidebar(true, true);
        }
      }
    }
  }, { passive: true });

  // Listener de redimensionamento para sincronizar backdrop e OpenSeadragon
  window.addEventListener("resize", () => {
    const isDrawer = isMobileOrLandscapeDrawer();
    const bdrop = document.getElementById("viewerBackdrop");
    if (!isDrawer && bdrop) {
      bdrop.classList.add("hidden", "opacity-0", "pointer-events-none");
      bdrop.classList.remove("opacity-100", "pointer-events-auto");
    } else if (isDrawer && bdrop && !sidebar.classList.contains("w-0")) {
      bdrop.classList.remove("hidden");
      bdrop.classList.add("opacity-100", "pointer-events-auto");
      bdrop.classList.remove("opacity-0", "pointer-events-none");
    }
    sincronizarTamanhoDoViewer();
  });

  // O palco redimensiona durante a transição CSS: mantém o OpenSeadragon ajustado quadro a quadro.
  const palco = document.getElementById("viewerStage");
  if (palco && typeof ResizeObserver === "function") {
    if (_stageResizeObserver) {
      try { _stageResizeObserver.disconnect(); } catch (e) {}
    }
    _stageResizeObserver = new ResizeObserver(() => sincronizarTamanhoDoViewer());
    _stageResizeObserver.observe(palco);
  }
}

// ---------------------------------------------------------------------------
// Acervo Base Local (Fallback de Resiliência Clínica)
// ---------------------------------------------------------------------------
const fallbackLaminas = {
  'a3oRvXvJpMKAtU2RE85q': {
    id: 'a3oRvXvJpMKAtU2RE85q',
    firestoreId: 'a3oRvXvJpMKAtU2RE85q',
    aliases: ['lamina-real1', 'lamina-real-1', 'pele_espessa', 'pele-espessa', 'pele', 'matriz', 'teste'],
    nome: 'Pele Espessa',
    subtitulo: 'Epiderme queratinizada e Derme papilar',
    disciplina: 'histologia',
    topicoTitulo: 'Tecido Epitelial de Revestimento e Glandular',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    maxMagnification: 40,
    objetivaCaptura: 40,
    mpp: 0.156,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.5, y: 0.70 },
    imagemUrl: 'assets/histologia/lamina-real1.dzi',
    previewImage: 'assets/histologia/lamina-real1-preview.jpg',
    thumbnailUrl: 'assets/histologia/lamina-real1-preview.jpg',
    dziUrl: 'assets/histologia/lamina-real1.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Pele Espessa — Epiderme e Derme (H&E • 40x)</h3>
        <p>Esta preparação histológica exibe a morfologia clássica da <strong>pele espessa</strong> (região palmar ou plantar). Destaca-se a exuberante epiderme formada por um <strong>epitélio estratificado pavimentoso queratinizado</strong>, adaptado a forças de atrito mecânico constante.</p>
        <p><strong>Estratificação Epidérmica (da profundidade para a superfície):</strong></p>
        <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
          <li><strong>Camada Basal (Germinativa):</strong> Fileira única de células cúbicas a prismáticas com alta atividade mitótica sobre a lâmina basal.</li>
          <li><strong>Camada Espinhosa:</strong> Múltiplas camadas de queratinócitos poliédricos unidos por densos desmossomos.</li>
          <li><strong>Camada Granulosa:</strong> Células achatadas com volumosos grânulos basofílicos de querato-hialina no citoplasma.</li>
          <li><strong>Camada Lúcida:</strong> Fita homogênea, clara e eosinofílica refringente, característica exclusiva da pele espessa.</li>
          <li><strong>Camada Córnea:</strong> Camada superficial densa de escamas anucleadas de queratina pura (barreira impermeável).</li>
        </ul>
        <p>Na derme subjacente evidenciam-se a <strong>derme papilar</strong> (tecido conjuntivo frouxo rico em capilares) e a <strong>derme reticular</strong> (tecido conjuntivo denso não modelado).</p>
      </div>
    `,
    pinos: [
      {
        id: "pin_1793069948222_573",
        rotulo: "Hemácia / Vaso Sanguíneo",
        x: 1702.79,
        y: 6851.49,
        zoom: 3.5
      },
      {
        id: "pin_1787596855230_238",
        rotulo: "Queratina / Estrato Córneo",
        x: 1091.31,
        y: 5586.05,
        zoom: 2.8
      },
      {
        id: "pin_1793136232358_898",
        rotulo: "Interface Dermo-Epidérmica",
        x: 1631.39,
        y: 6802.9,
        zoom: 3.2
      },
      {
        id: "pin_1793136245811_274",
        rotulo: "Papila Dérmica Vascularizada",
        x: 1682.44,
        y: 6869.79,
        zoom: 3.5
      }
    ],
    questoes: [
      {
        id: "q-pele-1",
        numero: 1,
        titulo: "Identificação da Camada Granulosa",
        enunciado: "Examine a epiderme e identifique a camada imediatamente abaixo do estrato córneo que contém volumosos grânulos basofílicos de querato-hialina.",
        x: 1631.39,
        y: 6802.9,
        zoom: 3.0
      },
      {
        id: "q-pele-2",
        numero: 2,
        titulo: "Papilas Dérmicas e Nutrição Epidérmica",
        enunciado: "Localize a transição entre o epitélio avascular e o tecido conjuntivo da derme. Como as papilas dérmicas aumentam a adesão e a nutrição do epitélio?",
        x: 1702.79,
        y: 6851.49,
        zoom: 3.2
      }
    ]
  },
  'osso_maduro_desgaste_ct': {
    id: 'osso_maduro_desgaste_ct',
    firestoreId: '96ZYqoM2SV8p4fB2QgeM',
    aliases: ['96ZYqoM2SV8p4fB2QgeM', 'osso-maduro', 'osso_maduro', 'osso-maduro-desgaste', 'osso-desgaste', 'osso_compacto_dzi', 'osso-compacto'],
    nome: 'Osso Maduro',
    subtitulo: 'Sistemas de Havers e canalículos',
    disciplina: 'histologia',
    topicoTitulo: 'Tecido Ósseo Compacto e Esponjoso',
    coloracao: 'Corte por Desgaste',
    maxMagnification: 40,
    objetivaCaptura: 40,
    mpp: 0.156,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.65, y: 0.525 },
    imagemUrl: 'assets/histologia/osso_maduro_desgaste_ct.dzi',
    previewImage: 'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
    dziUrl: 'assets/histologia/osso_maduro_desgaste_ct.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste</h3>
        <p>Esta preparação histológica por desgaste exibe a arquitetura do <strong>tecido ósseo compacto maduro (lamelar)</strong>, preservando a matriz mineralizada rica em hidroxiapatita sem coloração química. A unidade estrutural predominante é o <strong>Sistema de Havers (ósteon)</strong>, caracterizado por cilindros concêntricos paralelos ao eixo longitudinal da diáfise. No centro de cada sistema localiza-se o <strong>canal de Havers</strong>, por onde trafegavam vasos sanguíneos e nervos in vivo.</p>
        <p>Circundando os canais dispõem-se as <strong>lamelas concêntricas</strong>, formadas por fibras colágenas mineralizadas. Entre e no interior das lamelas evidenciam-se as <strong>lacunas dos osteócitos</strong>, que alojavam as células maduras. Emergindo radialmente das lacunas, uma intrincada rede de <strong>canalículos</strong> anastomosa-se em toda a matriz, permitindo a difusão de nutrientes e comunicação celular via junções comunicantes.</p>
        <p>Nos espaços entre ósteons adjacentes encontram-se as <strong>lamelas intersticiais</strong>, remanescentes de sistemas de Havers reabsorvidos durante a remodelação óssea. Canais transversais ou oblíquos (<strong>canais de Volkmann</strong>) comunicam os canais de Havers entre si, com a cavidade medular e com a superfície perióstica externa, delineada pelas lamelas circunferenciais.</p>
      </div>
    `,
    pinos: [],
    questoes: [
      {
        id: "q-havers-1",
        numero: 1,
        titulo: "Identificação do Sistema de Havers (Ósteon)",
        enunciado: "Examine o campo microscópico focalizado e identifique o canal vascular central (Canal de Havers) e as lamelas ósseas concêntricas dispostas ao redor.",
        x: 0.65,
        y: 0.525,
        zoom: 2.2
      },
      {
        id: "q-osteocitos-2",
        numero: 2,
        titulo: "Lacunas de Osteócitos e Rede Canalicular",
        enunciado: "Observe as cavidades fusiformes escuras (lacunas) entre as lamelas e descreva como os canalículos radiados viabilizam a comunicação e nutrição osteocitária na matriz mineralizada.",
        x: 0.685,
        y: 0.515,
        zoom: 3.5
      }
    ]
  },
  'osso_maduro_desgaste_ct_2.0': {
    id: 'osso_maduro_desgaste_ct_2.0',
    firestoreId: 'FFGk5d9kOAct5HIDdjQ7',
    aliases: ['FFGk5d9kOAct5HIDdjQ7', 'osso_maduro_desgaste_ct_2', 'osso_2.0', 'osso-2.0', 'osso_desgaste_2', 'osso-maduro-2'],
    nome: 'Osso Maduro 10x',
    subtitulo: 'Visão panorâmica e topografia cortical',
    disciplina: 'histologia',
    topicoTitulo: 'Tecido Ósseo Compacto e Esponjoso',
    coloracao: 'Corte por Desgaste',
    maxMagnification: 10,
    objetivaCaptura: 10,
    mpp: 0.625,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.5, y: 0.5 },
    imagemUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
    previewImage: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
    dziUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste (10x)</h3>
        <p>Visão panorâmica em objetiva de 10x do tecido ósseo compacto preparado por desgaste, preservando a arquitetura mineralizada sem descalcificação.</p>
        <p>Destacam-se os <strong>Sistemas de Havers (ósteons)</strong> centrados pelos <strong>Canais de Havers</strong>, circundados por <strong>lamelas concêntricas</strong>, <strong>lacunas osteocitárias</strong> e pela rede de <strong>canalículos</strong> que interliga os osteócitos.</p>
        <p>Entre os ósteons observam-se as <strong>lamelas intersticiais</strong>, remanescentes da remodelação óssea, e os <strong>Canais de Volkmann</strong> que comunicam os canais vasculares entre si.</p>
      </div>
    `,
    pinos: []
  },
  'osso_maduro_desgaste_ct_3.0': {
    id: 'osso_maduro_desgaste_ct_3.0',
    firestoreId: 'cw3XGCgUwN71XdlwkUe5',
    aliases: ['cw3XGCgUwN71XdlwkUe5', 'osso_maduro_desgaste_ct_3', 'osso_3.0', 'osso-3.0', 'osso_desgaste_3', 'osso-maduro-3'],
    nome: 'Osso Maduro 40x',
    subtitulo: 'Ósteons, canalículos e linhas cimentantes',
    disciplina: 'histologia',
    topicoTitulo: 'Tecido Ósseo Compacto e Esponjoso',
    coloracao: 'Corte por Desgaste',
    maxMagnification: 40,
    objetivaCaptura: 40,
    mpp: 0.156,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.5, y: 0.5 },
    imagemUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
    previewImage: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
    dziUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste (40x)</h3>
        <p>Preparação de osso compacto obtida por desgaste e digitalizada em objetiva de 40x, evidenciando a organização lamelar da matriz mineralizada.</p>
        <p>Estruturas observáveis neste corte:</p>
        <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
          <li><strong>Canais de Havers:</strong> lúmen vascular central circundado por lamelas cilíndricas concêntricas.</li>
          <li><strong>Lacunas de Osteócitos:</strong> cavidades elípticas distribuídas entre e no interior das lamelas.</li>
          <li><strong>Rede de Canalículos:</strong> finos canais radiados que conectam as lacunas entre si e ao canal central.</li>
          <li><strong>Linhas Cimentantes:</strong> limites refringentes que separam cada ósteon das lamelas intersticiais vizinhas.</li>
        </ul>
      </div>
    `,
    pinos: []
  }
};

// Aliases para identificadores alternativos / legados
fallbackLaminas['pele_espessa']         = fallbackLaminas['a3oRvXvJpMKAtU2RE85q'];
fallbackLaminas['lamina-real1']         = fallbackLaminas['a3oRvXvJpMKAtU2RE85q'];
fallbackLaminas['96ZYqoM2SV8p4fB2QgeM']   = fallbackLaminas['osso_maduro_desgaste_ct'];
fallbackLaminas['FFGk5d9kOAct5HIDdjQ7'] = fallbackLaminas['osso_maduro_desgaste_ct_2.0'];
fallbackLaminas['cw3XGCgUwN71XdlwkUe5'] = fallbackLaminas['osso_maduro_desgaste_ct_3.0'];

// ---------------------------------------------------------------------------
// 1. Disparo automatico ao carregar a pagina
// ---------------------------------------------------------------------------
function iniciarMicroscopio() {
  if (!document.getElementById("osd-viewer")) return;
  iniciarSidebarRetratil();
  inicializarTomPlatina();
  inicializarMinimapControle();
  inicializarModoBancada();
  inicializarSeletorRapidoLaminas();
  registrarDelegacaoGlobalDePinos();
  registrarControleAjudaMicroscopio();
  registrarControlesPopoversHeader();
  registrarAtalhosTecladoMicroscopio();
  registrarControleFullscreenMicroscopio();
  registrarPopstateMicroscopio();
  if (!_pagehideRegistrado) {
    _pagehideRegistrado = true;
    window.addEventListener("pagehide", destruirMicroscopio);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const dziParam  = urlParams.get("dzi") || urlParams.get("file");
  const laminaId  = urlParams.get("id") || urlParams.get("laminaId");
  _pendingUrlPinId = urlParams.get("pin") || null;

  if (dziParam) {
    if (!isSafeSlideUrl(dziParam)) {
      exibirErroMicroscopio("URL de lâmina inválida ou não autorizada.");
      return;
    }
    const isOsso = String(dziParam).toLowerCase().includes("osso");
    const isPele = String(dziParam).toLowerCase().includes("pele");
    const maxMagParam = Number(urlParams.get("maxMag") || urlParams.get("maxMagnification")) || 40;

    let defaultNome = "Preparação Histológica Digital";
    let defaultColor = `Coloração de Rotina • ${maxMagParam}x`;
    let defaultDesc = `<p>Preparação histológica digitalizada sob objetiva de ${maxMagParam}x para exploração microscópica multiescala com calibragem óptica dinâmica.</p>`;
    let questoes = [];

    // Derivação automática de nome a partir do caminho do arquivo DZI
    try {
      const cleanFile = dziParam.split("/").pop().replace(/\.dzi.*$/i, "").replace(/[_-]+/g, " ").trim();
      if (cleanFile) {
        defaultNome = cleanFile.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    } catch (e) {}

    if (isPele) {
      defaultNome = "Pele Espessa (Epiderme e Derme)";
      defaultColor = "Hematoxilina e Eosina (H&E) • 40x";
      defaultDesc = fallbackLaminas['a3oRvXvJpMKAtU2RE85q']?.descricaoHTML || defaultDesc;
      questoes = [
        {
          id: "q-pele-1",
          numero: 1,
          titulo: "Estratificação da Epiderme",
          enunciado: "Observe a espessura da camada córnea e identifique os grânulos basofílicos citoplasmáticos característicos da camada subjacente imediata.",
          x: 0.5,
          y: 0.3,
          alternativas: [
            "Camada Granulosa (grânulos de querato-hialina)",
            "Camada Basal (melanossomos)",
            "Camada Espinhosa (grânulos de glicogênio)",
            "Derme Reticular (fibras elásticas)"
          ],
          alternativaCorreta: 0,
          explicacao: "A camada granulosa situa-se logo abaixo do estrato lúcido/córneo e caracteriza-se por queratinócitos preenchidos por grânulos basofílicos de querato-hialina, precursores da filagrina e da queratinização madura."
        }
      ];
    } else if (isOsso) {
      defaultNome = "Osso Maduro (Lamelar) por Desgaste";
      defaultColor = "Corte por Desgaste (Sem Coloração) • 40x";
      defaultDesc = fallbackLaminas['osso_maduro_desgaste_ct']?.descricaoHTML || defaultDesc;
      questoes = fallbackLaminas['osso_maduro_desgaste_ct']?.questoes || [];
    }

    const rawNomeParam = urlParams.get("nome");
    const rawDiscParam = urlParams.get("disciplina");
    const rawColorParam = urlParams.get("coloracao");

    laminaAtualData = {
      id: "local-dzi",
      nome: (rawNomeParam && rawNomeParam.trim()) ? rawNomeParam.trim().slice(0, 140) : defaultNome,
      disciplina: (rawDiscParam && rawDiscParam.trim()) ? rawDiscParam.trim().slice(0, 60) : "histologia",
      coloracao: (rawColorParam && rawColorParam.trim()) ? rawColorParam.trim().slice(0, 140) : defaultColor,
      maxMagnification: maxMagParam,
      imagemUrl: dziParam.trim(),
      descricaoHTML: defaultDesc,
      pinos: [],
      questoes: questoes
    };
    window.laminaAtualData = laminaAtualData;
    listaPinosAtual = [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
    atualizarBotaoMarcacoes();
    atualizarBotaoRegua();
    sincronizarSeletorRapidoLaminas("local-dzi");
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
    renderizarQuestoesNaSidebar(listaQuestoesAtual);
    atualizarBadgeContadorQuestoes();
    inicializarOpenSeadragon();
  } else if (laminaId) {
    carregarLaminaNoMicroscopio(laminaId);
  } else {
    console.warn("[Palas Atlas] Nenhum ID de lamina passado na URL (?id=...).");
    exibirErroMicroscopio("Nenhuma lâmina selecionada. Acesse pelo Catálogo de Tópicos.");
  }
}

/**
 * Alterna a exibição do popover discreto de atalhos e ajuda do microscópio.
 * @param {boolean} [forcar]
 */
function toggleAjudaMicroscopio(forcar) {
  const popover = document.getElementById("popoverAjudaMicroscopio");
  if (!popover) return;
  const abrir = typeof forcar === "boolean" ? forcar : popover.classList.contains("hidden");
  if (abrir) {
    if (typeof toggleLaminarioRapido === "function") toggleLaminarioRapido(false);
    if (typeof toggleMobileMoreMenu === "function") toggleMobileMoreMenu(false);
    popover.classList.remove("hidden");
  } else {
    popover.classList.add("hidden");
  }
}

/**
 * Registra listeners para fechar o popover de ajuda ao clicar fora ou ao pressionar Esc.
 */
let _controleAjudaRegistrado = false;
function registrarControleAjudaMicroscopio() {
  if (_controleAjudaRegistrado) return;
  _controleAjudaRegistrado = true;

  document.addEventListener("click", (e) => {
    const container = document.getElementById("containerAjudaMicroscopio");
    const popover = document.getElementById("popoverAjudaMicroscopio");
    if (!container || !popover || popover.classList.contains("hidden")) return;
    if (!container.contains(e.target)) {
      popover.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const popover = document.getElementById("popoverAjudaMicroscopio");
      if (popover && !popover.classList.contains("hidden")) {
        popover.classList.add("hidden");
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 2. Carrega a lamina pelo ID (Instantâneo no Acervo Base + Firestore)
// ---------------------------------------------------------------------------
async function carregarLaminaNoMicroscopio(laminaId) {
  if (!laminaId) {
    exibirErroMicroscopio("Nenhuma lâmina selecionada.");
    return;
  }

  const myEpoch = ++_loadEpoch;
  const idBuscado = String(laminaId).trim();

  // 1. Se for uma das lâminas base conhecidas do acervo, carrega imediatamente
  const fallback = fallbackLaminas[idBuscado] || 
                   fallbackLaminas[idBuscado.toLowerCase()] || 
                   Object.values(fallbackLaminas).find(l => 
                     l.id.toLowerCase() === idBuscado.toLowerCase() ||
                     (Array.isArray(l.aliases) && l.aliases.some(a => a.toLowerCase() === idBuscado.toLowerCase()))
                   );

  if (fallback) {
    laminaAtualData = { ...fallback };
    window.laminaAtualData = laminaAtualData;
    listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
    atualizarBotaoMarcacoes();
    atualizarBotaoRegua();
    sincronizarSeletorRapidoLaminas(laminaAtualData.id);
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
    renderizarQuestoesNaSidebar(listaQuestoesAtual);
    atualizarBadgeContadorQuestoes();
    inicializarOpenSeadragon();

    // Sincroniza em background: textos e pinos editados no CMS (Firestore)
    // têm prioridade sobre os valores padrão do acervo local.
    if (typeof db !== "undefined" && db) {
      const primaryId = fallback.firestoreId || fallback.id;

      (async () => {
        try {
          let docRef = await db.collection("laminas").doc(primaryId).get().catch((err) => {
            console.warn("[Palas Atlas] Falha ao sincronizar lâmina do Firestore:", primaryId, err);
            return null;
          });
          if (myEpoch !== _loadEpoch) return;
          if ((!docRef || !docRef.exists) && idBuscado && idBuscado !== primaryId) {
            docRef = await db.collection("laminas").doc(idBuscado).get().catch((err) => {
              console.warn("[Palas Atlas] Falha ao sincronizar lâmina do Firestore:", idBuscado, err);
              return null;
            });
            if (myEpoch !== _loadEpoch) return;
          }
          if (!docRef || !docRef.exists) return;

          const dados = docRef.data() || {};
          const textoValido = (v) => typeof v === "string" && v.replace(/<[^>]*>/g, "").trim().length > 0;

          if (textoValido(dados.nome)) laminaAtualData.nome = dados.nome;
          if (textoValido(dados.coloracao) && !isColoracaoGenerica(dados.coloracao)) {
            laminaAtualData.coloracao = dados.coloracao;
          }
          if (textoValido(dados.disciplina)) laminaAtualData.disciplina = dados.disciplina;
          if (textoValido(dados.topicoTitulo)) laminaAtualData.topicoTitulo = dados.topicoTitulo;
          if (textoValido(dados.subtitulo)) laminaAtualData.subtitulo = dados.subtitulo;
          if (textoValido(dados.descricaoHTML)) laminaAtualData.descricaoHTML = dados.descricaoHTML;
          else if (textoValido(dados.descricao)) laminaAtualData.descricaoHTML = dados.descricao;
          if (Array.isArray(dados.pinos) && dados.pinos.length > 0) {
            laminaAtualData.pinos = dados.pinos;
            listaPinosAtual = dados.pinos;
            atualizarBotaoMarcacoes();
            if (viewer && viewer.world && viewer.world.getItemCount() > 0) {
              renderizarTodasMarcacoesNoViewer();
              if (_pendingUrlPinId) {
                const alvoPin = _pendingUrlPinId;
                _pendingUrlPinId = null;
                focarPinoNoViewer(alvoPin);
              }
            }
          }
          if (Array.isArray(dados.questoes) && dados.questoes.length > 0) {
            laminaAtualData.questoes = dados.questoes;
            listaQuestoesAtual = dados.questoes;
            renderizarQuestoesNaSidebar(listaQuestoesAtual);
            atualizarBadgeContadorQuestoes();
          }
          if (dados.maxMagnification) {
            laminaAtualData.maxMagnification = Number(dados.maxMagnification) || 40;
          }
          // Metadados ópticos cadastrados no CMS (objetiva, MPP, perfil, método)
          ["objetivaCaptura", "mpp", "perfilOptico", "metodoCalibracao", "opticsUrl"].forEach((campo) => {
            if (dados[campo] !== undefined && dados[campo] !== null && dados[campo] !== "") {
              laminaAtualData[campo] = dados[campo];
            }
          });
          recalcularCertidaoOptica();
          aplicarLimitesOpticos();

          renderizarMetadadosDaLamina();
          renderizarDescricaoETextos();
        } catch (err) {
          console.warn("[Palas Atlas] Erro geral na sincronização paralela do Firestore:", err);
        }
      })();
    }
    return;
  }

  // 2. Se for uma lâmina dinâmica cadastrada pelo CMS no Firestore
  if (typeof db !== "undefined" && db) {
    try {
      const fetchPromise = db.collection("laminas").doc(idBuscado).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout Firestore")), 5000)
      );

      const docRef = await Promise.race([fetchPromise, timeoutPromise]);
      if (myEpoch !== _loadEpoch) return;
      if (docRef && docRef.exists) {
        const dados = docRef.data() || {};
        laminaAtualData = { id: docRef.id, ...dados };
        window.laminaAtualData = laminaAtualData;
        let dziCandidate = laminaAtualData.dziUrl || (laminaAtualData.imagemUrl && laminaAtualData.imagemUrl.toLowerCase().endsWith('.dzi') ? laminaAtualData.imagemUrl : '');
        let img = dziCandidate || laminaAtualData.imagemUrl || laminaAtualData.imageUrl || laminaAtualData.caminhoImagemBase || '';
        if (img) {
          img = img.trim();
          if (img.startsWith("/") && !img.startsWith("//")) {
            img = img.replace(/^\/+/, "");
          }
          if (!isSafeSlideUrl(img)) {
            exibirErroMicroscopio("Caminho de imagem da lâmina inválido.");
            return;
          }
          laminaAtualData.imagemUrl = img;
        }
        listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
        listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
        atualizarBotaoMarcacoes();
        atualizarBotaoRegua();
        sincronizarSeletorRapidoLaminas(laminaAtualData.id);
        renderizarMetadadosDaLamina();
        renderizarDescricaoETextos();
        renderizarQuestoesNaSidebar(listaQuestoesAtual);
        atualizarBadgeContadorQuestoes();
        inicializarOpenSeadragon();
        return;
      }
    } catch (err) {
      if (myEpoch !== _loadEpoch) return;
      console.warn("[Palas Atlas] Aviso ao consultar Firestore para ID:", idBuscado, err);
    }
  }

  if (myEpoch !== _loadEpoch) return;

  // 3. Fallback secundário por correspondência parcial de nome/slug
  const fallbackSecundario = Object.values(fallbackLaminas).find(l => 
    idBuscado.toLowerCase().includes(l.id.toLowerCase()) || 
    l.id.toLowerCase().includes(idBuscado.toLowerCase())
  );
  if (fallbackSecundario) {
    laminaAtualData = { ...fallbackSecundario };
    window.laminaAtualData = laminaAtualData;
    listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
    atualizarBotaoMarcacoes();
    atualizarBotaoRegua();
    sincronizarSeletorRapidoLaminas(laminaAtualData.id);
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
    renderizarQuestoesNaSidebar(listaQuestoesAtual);
    atualizarBadgeContadorQuestoes();
    inicializarOpenSeadragon();
    return;
  }

  // 4. Se realmente não for encontrada
  console.error("[Palas Atlas] Lâmina não encontrada para ID:", idBuscado);
  exibirErroMicroscopio(`Lâmina não encontrada no acervo (${idBuscado}). Retorne ao Catálogo.`);
}

// ---------------------------------------------------------------------------
// 3. Injeta metadados no cabecalho da pagina
// ---------------------------------------------------------------------------
function formatarNomeDisciplina(slug) {
  const mapa = {
    histologia: "Histologia",
    patologia: "Patologia",
    parasitologia: "Parasitologia",
    microbiologia: "Microbiologia"
  };
  const key = String(slug || "histologia").trim().toLowerCase();
  return mapa[key] || (key.charAt(0).toUpperCase() + key.slice(1));
}

function obterCatalogoEntryAtual() {
  if (!laminaAtualData) return null;
  const idAtual = resolverIdCanonicoSwitcher(laminaAtualData.id);
  return _catalogoLaminasSwitcher.find(item => item.id === idAtual) || null;
}

function renderizarMetadadosDaLamina() {
  if (!laminaAtualData) return;
  const tituloEl      = document.getElementById("slideTitle");
  const disciplinaEl  = document.getElementById("slideDisciplina");
  const topicoEl      = document.getElementById("slideTopicoMeta");
  const coloracaoEl   = document.getElementById("slideColoracao");
  const stainDotEl    = document.getElementById("slideStainDot");
  const breadcrumb    = document.getElementById("viewerBreadcrumb");
  const breadcrumbDisc = document.getElementById("viewerBreadcrumbDisc");
  const breadcrumbTopic = document.getElementById("viewerBreadcrumbTopic");
  const docTitle      = document.querySelector("title");

  const entryCatalogo = obterCatalogoEntryAtual();

  let tituloLimpo = laminaAtualData.nome || "Peça Morfológica";
  tituloLimpo = tituloLimpo.replace(/\sHE$|\sH&E$/i, '');

  const discSlug = String(laminaAtualData.disciplina || "histologia").trim().toLowerCase();
  const discNome = formatarNomeDisciplina(discSlug);
  const topicoTexto = laminaAtualData.topicoTitulo || entryCatalogo?.topicoTitulo || "Análise Morfológica";

  const rawColor = laminaAtualData.coloracao;
  const coloracaoLimpa = !isColoracaoGenerica(rawColor)
    ? rawColor
    : (entryCatalogo?.meta || "Preparação Histológica");

  if (tituloEl)     tituloEl.textContent     = tituloLimpo;
  if (disciplinaEl) disciplinaEl.textContent = discNome.toUpperCase();
  if (topicoEl)     topicoEl.textContent     = topicoTexto;
  if (coloracaoEl)  coloracaoEl.textContent  = coloracaoLimpa;

  if (stainDotEl) {
    const isDesgaste = /desgaste/i.test(coloracaoLimpa);
    stainDotEl.className = isDesgaste
      ? "w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0"
      : "w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0";
  }

  if (breadcrumb) {
    breadcrumb.textContent = tituloLimpo;
    breadcrumb.classList.remove("hidden");
  }
  if (breadcrumbDisc) {
    breadcrumbDisc.textContent = discNome;
    breadcrumbDisc.href = `index.html?frente=${encodeURIComponent(discSlug)}`;
  }
  if (breadcrumbTopic) {
    breadcrumbTopic.textContent = topicoTexto;
  }
  if (docTitle) docTitle.textContent = `${tituloLimpo} — Palas Atlas`;

  const thumbUrl = laminaAtualData.previewImage || laminaAtualData.thumbnailUrl || entryCatalogo?.previewImage || "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
  ["laminarioThumbAtual", "laminarioThumbMobile"].forEach((id) => {
    const imgEl = document.getElementById(id);
    if (imgEl && isSafeSlideUrl(thumbUrl)) imgEl.src = thumbUrl;
  });
  ["laminarioNomeAtual", "laminarioNomeMobile"].forEach((id) => {
    const spanEl = document.getElementById(id);
    if (spanEl) spanEl.textContent = tituloLimpo;
  });

  const reportLink = document.getElementById("linkReportarErroLamina");
  if (reportLink) {
    reportLink.href = `mailto:contato@palasatlas.com?subject=${encodeURIComponent("Correção sugerida na peça: " + tituloLimpo)}`;
  }

  const seloTextoEl = document.getElementById("slideSeloOpticoTexto");
  const maxMag = Number(laminaAtualData.maxMagnification || laminaAtualData.maxMag || 40);
  const mpp = Number(laminaAtualData.mpp) || (40 / maxMag) * 0.156;
  if (seloTextoEl) {
    seloTextoEl.textContent = `${maxMag}x · ${mpp.toFixed(2).replace(".", ",")} µm/px`;
    const seloEl = document.getElementById("slideSeloOptico");
    if (seloEl) {
      seloEl.title = `Objetiva ${maxMag}x · ${mpp.toFixed(3).replace(".", ",")} µm/px`;
      seloEl.classList.remove("hidden");
    }
  }

  atualizarCertidaoOpticaUI();
  atualizarNavegacaoRodapeSidebar();
  renderizarListaLaminarioRapido();
  renderizarAcervoRelacionado();
}

// Re-exporta sanitizadores para retrocompatibilidade
export { sanitizarHTMLDescricao, formatarDescricaoMorfolgica };

function renderizarDescricaoETextos() {
  if (!laminaAtualData) return;
  const container = document.getElementById("slideDescriptionContainer");
  if (!container) {
    console.warn("[Palas Atlas] Container #slideDescriptionContainer nao encontrado no HTML.");
    return;
  }

  const rawHtml = laminaAtualData.descricaoHTML || laminaAtualData.descricao || "";
  const html = formatarDescricaoMorfolgica(rawHtml);
  const textoHtml = html || `<p class="text-slate-500 italic text-sm font-sans">Nenhum texto descritivo cadastrado para esta lâmina.</p>`;

  // Pontos de Interesse com Tour Guiado e numeração editorial
  let secaoPinos = "";
  if (listaPinosAtual.length > 0) {
    const totalPinos = listaPinosAtual.length;
    secaoPinos = `
      <div class="mt-7 border-t border-slate-200/90 pt-5">
        <div class="flex items-center justify-between gap-2 mb-3.5">
          <h4 class="palas-mono-tech text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
            Pontos de Interesse
          </h4>
          <div class="inline-flex items-center gap-1 rounded-lg bg-slate-100/90 border border-slate-200/80 p-0.5 select-none">
            <button
              type="button"
              onclick="window.navegarPinoAdjacente && window.navegarPinoAdjacente(-1)"
              class="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer text-xs"
              title="Estrutura anterior (Seta esquerda)"
              aria-label="Ponto de interesse anterior"
            >&larr;</button>
            <span id="pinTourCounter" class="palas-mono-tech px-1.5 text-[10.5px] font-semibold text-slate-600">0 / ${totalPinos}</span>
            <button
              type="button"
              onclick="window.navegarPinoAdjacente && window.navegarPinoAdjacente(1)"
              class="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer text-xs"
              title="Próxima estrutura (Seta direita)"
              aria-label="Próximo ponto de interesse"
            >&rarr;</button>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          ${listaPinosAtual.map((pin, idx) => {
            const pinIdSafe = escaparHTML(String(pin.id ?? idx + 1));
            const numIdx = String(idx + 1).padStart(2, "0");
            return `
            <button
              type="button"
              id="btn-pino-${pinIdSafe}"
              data-btn-pin-id="${pinIdSafe}"
              class="pin-item-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div class="flex items-center gap-2.5 min-w-0 pr-2">
                <span class="pin-index palas-mono-tech text-[11px] font-bold text-slate-400 group-hover:text-teal-700 shrink-0">${numIdx}</span>
                <span class="h-3.5 w-px bg-slate-200 shrink-0"></span>
                <span class="pin-indicator w-2 h-2 rounded-full bg-teal-600 shrink-0 transition-transform"></span>
                <span class="pin-label text-[13px] font-medium text-slate-800 group-hover:text-teal-950 transition-colors truncate">${escaparHTML(pin.rotulo || "Estrutura")}</span>
              </div>
              <span class="pin-action text-[11px] font-medium text-slate-500 group-hover:text-teal-700 shrink-0 transition-colors">Focar &rarr;</span>
            </button>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="prose-atlas text-slate-700 text-sm font-sans leading-relaxed">
      ${textoHtml}
    </div>
    ${secaoPinos}
  `;

  if (!container.__pinClickDelegated) {
    container.__pinClickDelegated = true;
    container.addEventListener("click", (evento) => {
      const btn = evento.target.closest("button[data-btn-pin-id]");
      if (!btn) return;
      const pinId = btn.getAttribute("data-btn-pin-id");
      if (pinId) focarPinoNoViewer(pinId, { permitirToggle: true });
    });
  }

  // Estiliza pin-links inline via .pin-link (definida em microscopio.html)
  container.querySelectorAll('.pin-link, [data-pin-id]').forEach(el => {
    el.className = "pin-link cursor-pointer transition-all";
  });

  atualizarCertidaoOpticaUI();

  if (pinAtivo) {
    destacarPinoNaSidebar(pinAtivo);
  }
}

// ---------------------------------------------------------------------------
// 4.5 Abas do Painel Lateral e Questões Práticas de Bancada
// ---------------------------------------------------------------------------

export function alternarAbaPainel(aba) {
  const containerDesc  = document.getElementById("slideDescriptionContainer");
  const containerQuest = document.getElementById("slideQuestionsContainer");
  const btnDesc        = document.getElementById("btnTabDescricao");
  const btnQuest       = document.getElementById("btnTabQuestoes");

  const abaAlvo = (aba === "questoes") ? "questoes" : "descricao";
  abaAtivaPainel = abaAlvo;

  const estiloAtivo   = "tab-btn-ativo relative py-3 text-xs font-semibold tracking-wide transition-colors duration-150 cursor-pointer border-b-2 border-[#0f766e] text-slate-950 touch-manipulation flex items-center justify-center";
  const estiloInativo = "tab-btn-inativo relative py-3 text-xs font-medium tracking-wide transition-colors duration-150 cursor-pointer border-b-2 border-transparent text-slate-500 hover:text-slate-900 touch-manipulation flex items-center justify-center";

  if (abaAlvo === "descricao") {
    if (containerDesc) containerDesc.classList.remove("hidden");
    if (containerQuest) containerQuest.classList.add("hidden");

    if (btnDesc)  btnDesc.className = estiloAtivo;
    if (btnQuest) btnQuest.className = `${estiloInativo} gap-1.5`;
  } else {
    if (containerDesc) containerDesc.classList.add("hidden");
    if (containerQuest) containerQuest.classList.remove("hidden");

    if (btnDesc)  btnDesc.className = estiloInativo;
    if (btnQuest) btnQuest.className = `${estiloAtivo} gap-1.5`;
  }
}

function atualizarBadgeContadorQuestoes() {
  const badge = document.getElementById("badgeContadorQuestoes");
  if (!badge) return;

  const total = Array.isArray(listaQuestoesAtual) ? listaQuestoesAtual.length : 0;
  badge.textContent = String(total);

  if (total > 0) {
    badge.className = "palas-mono-tech px-1.5 py-0.5 rounded-full text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-semibold";
  } else {
    badge.className = "palas-mono-tech px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200/80 font-medium";
  }
}

function atualizarProgressoQuestoes() {
  const txtEl = document.getElementById("questoesProgressoTexto");
  const barEl = document.getElementById("questoesProgressoBarra");
  if (!txtEl && !barEl) return;

  const total = Array.isArray(listaQuestoesAtual) ? listaQuestoesAtual.length : 0;
  if (total === 0) return;

  const laminaId = laminaAtualData?.id || "default";
  let respondidas = 0;
  listaQuestoesAtual.forEach((q, idx) => {
    const qIdRaw = q.id ? String(q.id) : `q_${idx + 1}`;
    const ta = document.getElementById(`resposta-${qIdRaw}`);
    let val = ta ? ta.value : "";
    if (!ta) {
      try { val = localStorage.getItem(`palasAtlas.respostas.${laminaId}.${qIdRaw}`) || ""; } catch (e) {}
    }
    if (String(val).trim().length > 0) respondidas++;
  });

  if (txtEl) txtEl.textContent = `${respondidas} de ${total} respondidas`;
  if (barEl) barEl.style.width = `${Math.round((respondidas / total) * 100)}%`;
}

function salvarRespostaEstudante(laminaId, questaoId, texto) {
  const idSeguro = String(questaoId);
  const statusEl = document.getElementById(`statusSalvo-${idSeguro}`);
  if (statusEl) {
    statusEl.textContent = "Salvando...";
    statusEl.classList.remove("text-slate-500");
    statusEl.classList.add("text-teal-700");
  }
  atualizarProgressoQuestoes();

  _respostasPendentes.set(idSeguro, { laminaId, questaoId: idSeguro, texto });
  clearTimeout(debounceTimersRespostas[idSeguro]);
  debounceTimersRespostas[idSeguro] = setTimeout(() => {
    try {
      const chave = `palasAtlas.respostas.${laminaId}.${idSeguro}`;
      localStorage.setItem(chave, texto);
      _respostasPendentes.delete(idSeguro);
      if (statusEl) {
        statusEl.textContent = texto.trim() ? "Salvo localmente" : "";
        statusEl.classList.remove("text-teal-700");
        statusEl.classList.add("text-slate-500");
      }
      atualizarProgressoQuestoes();
    } catch (e) {
      console.warn("[Palas Atlas] Erro ao persistir resposta no localStorage:", e);
    }
  }, 400);
}

function salvarRespostaImediato(laminaId, questaoId, texto) {
  const idSeguro = String(questaoId);
  clearTimeout(debounceTimersRespostas[idSeguro]);
  _respostasPendentes.delete(idSeguro);
  try {
    const chave = `palasAtlas.respostas.${laminaId}.${idSeguro}`;
    localStorage.setItem(chave, texto);
    const statusEl = document.getElementById(`statusSalvo-${idSeguro}`);
    if (statusEl) {
      statusEl.textContent = texto.trim() ? "Salvo localmente" : "";
      statusEl.classList.remove("text-teal-700");
      statusEl.classList.add("text-slate-500");
    }
    atualizarProgressoQuestoes();
  } catch (e) {
    console.warn("[Palas Atlas] Erro ao persistir resposta imediata no localStorage:", e);
  }
}

function flushRespostasPendentes() {
  if (_respostasPendentes.size === 0) return;
  for (const [idSeguro, entry] of _respostasPendentes.entries()) {
    clearTimeout(debounceTimersRespostas[idSeguro]);
    try {
      localStorage.setItem(`palasAtlas.respostas.${entry.laminaId}.${idSeguro}`, entry.texto);
    } catch (e) {}
  }
  _respostasPendentes.clear();
}

export async function copiarAnotacoesQuestoes() {
  if (!Array.isArray(listaQuestoesAtual) || listaQuestoesAtual.length === 0) {
    exibirToastViewer("Nenhuma questão cadastrada nesta lâmina.");
    return;
  }
  const laminaId = laminaAtualData?.id || "default";
  const nomeLamina = laminaAtualData?.nome || "Lâmina";
  const linhas = [`PALAS ATLAS — Caderno de Bancada`, `Lâmina: ${nomeLamina}`, ""];

  listaQuestoesAtual.forEach((q, idx) => {
    const qIdRaw = q.id ? String(q.id) : `q_${idx + 1}`;
    const num = q.numero !== undefined && q.numero !== null ? q.numero : idx + 1;
    const titulo = q.titulo || q.pergunta || `Questão ${num}`;
    let resp = "";
    const ta = document.getElementById(`resposta-${qIdRaw}`);
    if (ta) resp = ta.value;
    else {
      try { resp = localStorage.getItem(`palasAtlas.respostas.${laminaId}.${qIdRaw}`) || ""; } catch (e) {}
    }
    linhas.push(`Q${num} — ${titulo}`);
    if (q.enunciado && q.enunciado !== titulo) linhas.push(`Enunciado: ${q.enunciado}`);
    linhas.push(`Resposta: ${resp.trim() || "(sem anotação)"}`);
    linhas.push("");
  });

  const payload = linhas.join("\n");
  let copied = false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(payload);
      copied = true;
    }
  } catch (e) {}
  if (!copied) {
    try {
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
  exibirToastViewer(copied ? "Anotações copiadas para a área de transferência" : "Não foi possível copiar as anotações");
}

export function renderizarQuestoesNaSidebar(questoes) {
  const container = document.getElementById("slideQuestionsContainer");
  if (!container) {
    console.warn("[Palas Atlas] Container #slideQuestionsContainer não encontrado no DOM.");
    return;
  }

  const laminaId = laminaAtualData?.id || "default";

  if (!Array.isArray(questoes) || questoes.length === 0) {
    container.innerHTML = `
      <div class="py-12 px-2 text-center space-y-3">
        <div class="w-10 h-10 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L18 8.5V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <p class="text-xs text-slate-500 font-sans leading-relaxed max-w-xs mx-auto">
          Nenhuma questão cadastrada para esta lâmina.
        </p>
      </div>
    `;
    return;
  }

  const cardsHtml = questoes.map((q, index) => {
    const qIdRaw = q.id ? String(q.id) : `q_${index + 1}`;
    q.id = qIdRaw;
    const qIdSafe = escaparHTML(qIdRaw);
    const numeroQ = q.numero !== undefined && q.numero !== null ? q.numero : (index + 1);
    const numeroQSafe = escaparHTML(String(numeroQ));
    const tituloQ = q.titulo || q.pergunta || (q.enunciado ? (q.enunciado.length > 70 ? q.enunciado.slice(0, 67) + '...' : q.enunciado) : `Questão ${numeroQ}`);
    const enunciadoQ = q.enunciado && q.enunciado !== tituloQ ? q.enunciado : "";

    const chaveStorage = `palasAtlas.respostas.${laminaId}.${qIdRaw}`;
    let respostaSalva = "";
    try {
      respostaSalva = localStorage.getItem(chaveStorage) || "";
    } catch (e) {
      console.warn("[Palas Atlas] Falha ao recuperar resposta salva:", e);
    }

    const temCoordenadas = (
      q.x !== undefined && q.x !== null && q.x !== "" && !isNaN(Number(q.x)) &&
      q.y !== undefined && q.y !== null && q.y !== "" && !isNaN(Number(q.y))
    );

    return `
      <div
        id="card-questao-${qIdSafe}"
        data-questao-id="${qIdSafe}"
        class="card-questao palas-card-tactile rounded-xl border border-slate-200/90 bg-white p-4 transition-all duration-200 hover:border-slate-300 space-y-3"
      >
        <!-- Cabeçalho Clicável da Questão -->
        <button
          type="button"
          data-questao-focus-id="${qIdSafe}"
          class="w-full text-left flex items-start justify-between gap-3 group cursor-pointer focus:outline-none"
          title="Focar localização da questão no microscópio"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="palas-mono-tech px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0 mt-0.5">
              Q${numeroQSafe}
            </span>
            <div class="min-w-0">
              <h4 class="text-xs font-semibold text-slate-900 tracking-wide font-sans group-hover:text-teal-800 transition-colors leading-snug">
                ${escaparHTML(tituloQ)}
              </h4>
            </div>
          </div>
          ${temCoordenadas ? `
            <div class="flex items-center gap-1 text-[10px] palas-mono-tech uppercase tracking-wider text-slate-500 group-hover:text-teal-800 shrink-0 transition-colors pt-0.5">
              <span>Focar</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </div>
          ` : ''}
        </button>

        ${enunciadoQ ? `
          <div class="text-xs text-slate-700 font-sans leading-relaxed border-l-2 border-slate-200 ml-1 pl-2.5">
            ${escaparHTML(enunciadoQ)}
          </div>
        ` : ''}

        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between text-[10px] palas-mono-tech uppercase tracking-wider">
            <span class="text-slate-500">Resposta / Diagnóstico</span>
            <span id="statusSalvo-${qIdSafe}" class="text-slate-500 transition-colors">
              ${respostaSalva ? "Salvo localmente" : ""}
            </span>
          </div>
          <textarea
            id="resposta-${qIdSafe}"
            data-questao-id="${qIdSafe}"
            rows="3"
            placeholder="Sua anotação / resposta diagnóstica..."
            style="resize:vertical; min-height:72px;"
            class="palas-input-recessed w-full bg-white border border-slate-300 focus:border-teal-700 focus:ring-1 focus:ring-teal-700/25 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 font-sans leading-relaxed outline-none transition-all"
          >${escaparHTML(respostaSalva)}</textarea>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="space-y-3 pt-1">
      <div class="space-y-2 pb-1">
        <div class="flex items-center justify-between gap-2 px-0.5">
          <div>
            <span class="text-[10px] palas-mono-tech uppercase tracking-wider text-slate-500 block">
              Caderno de Bancada
            </span>
            <span id="questoesProgressoTexto" class="palas-mono-tech text-[11px] font-semibold text-slate-800">
              0 de ${questoes.length} respondidas
            </span>
          </div>
          <button
            id="btnCopiarAnotacoes"
            type="button"
            onclick="window.copiarAnotacoesQuestoes && window.copiarAnotacoesQuestoes()"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 hover:text-slate-950 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Copiar todas as anotações para a área de transferência"
          >
            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.85">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copiar</span>
          </button>
        </div>
        <div class="w-full h-1 rounded-full bg-slate-200/80 overflow-hidden">
          <div id="questoesProgressoBarra" class="h-full bg-teal-600 transition-all duration-300" style="width: 0%;"></div>
        </div>
      </div>
      ${cardsHtml}
    </div>
  `;

  atualizarProgressoQuestoes();

  if (!container.__eventosRespostasVinculados) {
    container.__eventosRespostasVinculados = true;
    container.addEventListener("click", (evento) => {
      const btnFocus = evento.target.closest("[data-questao-focus-id]");
      if (!btnFocus) return;
      const qid = btnFocus.getAttribute("data-questao-focus-id");
      if (qid) focarQuestaoNoViewer(qid);
    });
    container.addEventListener("input", (evento) => {
      const textarea = evento.target.closest("textarea[data-questao-id]");
      if (!textarea) return;
      const qId = textarea.getAttribute("data-questao-id");
      const lId = laminaAtualData?.id || "default";
      salvarRespostaEstudante(lId, qId, textarea.value);
    });
    container.addEventListener("blur", (evento) => {
      const textarea = evento.target.closest("textarea[data-questao-id]");
      if (!textarea) return;
      const qId = textarea.getAttribute("data-questao-id");
      const lId = laminaAtualData?.id || "default";
      salvarRespostaImediato(lId, qId, textarea.value);
    }, true);
  }
}

function destacarCardQuestaoNaSidebar(qId) {
  const idBuscado = String(qId);
  document.querySelectorAll(".card-questao").forEach((card) => {
    const cardQId = card.getAttribute("data-questao-id");
    const isAtivo = String(cardQId) === idBuscado;
    if (isAtivo) {
      card.classList.add("border-teal-700", "bg-teal-50/50", "ring-1", "ring-teal-700/25", "shadow-sm");
      card.classList.remove("border-slate-200/90", "bg-white");
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      card.classList.remove("border-teal-700", "bg-teal-50/50", "ring-1", "ring-teal-700/25", "shadow-sm");
      card.classList.add("border-slate-200/90", "bg-white");
    }
  });
}

function destacarPinoNaSidebar(pinId) {
  const idBuscado = String(pinId || "").trim().toLowerCase();
  const norm = (val) => String(val || "").replace(/^(pin[-_]|p)/i, "").trim().toLowerCase();
  const buscadoNorm = norm(idBuscado);

  let activeIdx = -1;
  if (idBuscado && Array.isArray(listaPinosAtual)) {
    activeIdx = listaPinosAtual.findIndex((p, idx) => {
      const pId = String(p.id || idx + 1).trim().toLowerCase();
      return pId === idBuscado || (buscadoNorm && norm(pId) === buscadoNorm);
    });
  }

  const counterEl = document.getElementById("pinTourCounter");
  if (counterEl && Array.isArray(listaPinosAtual)) {
    counterEl.textContent = `${activeIdx >= 0 ? activeIdx + 1 : 0} / ${listaPinosAtual.length}`;
  }

  document.querySelectorAll("[data-btn-pin-id]").forEach((btn) => {
    const btnPinId = String(btn.getAttribute("data-btn-pin-id") || "").trim().toLowerCase();
    const isAtivo = Boolean(idBuscado) && (
      btnPinId === idBuscado ||
      (buscadoNorm && norm(btnPinId) === buscadoNorm)
    );
    const action = btn.querySelector(".pin-action");

    btn.classList.toggle("pin-active", isAtivo);
    if (action) {
      action.innerHTML = isAtivo ? "Em foco &times;" : "Focar &rarr;";
    }
  });

  const descContainer = document.getElementById("slideDescriptionContainer");
  if (descContainer) {
    descContainer.querySelectorAll(".pin-link, [data-pin-id], [data-pin]").forEach((el) => {
      const rawAttr = el.getAttribute("data-pin-id") || el.getAttribute("data-pin") || el.getAttribute("data-id") || "";
      const rawNorm = norm(rawAttr);
      const isLinkAtivo = Boolean(idBuscado) && (
        rawAttr.trim().toLowerCase() === idBuscado ||
        (buscadoNorm && rawNorm === buscadoNorm)
      );
      el.classList.toggle("pin-link-active", isLinkAtivo);
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Inicializa o OpenSeadragon com constraints de trava e escalas corretas
// ---------------------------------------------------------------------------
function protegerFonteAzulejos(item) {
  try {
    if (item && item.source && typeof item.source.getTileUrl === "function" && !item.source._palasProtected) {
      const origGetTileUrl = item.source.getTileUrl.bind(item.source);
      item.source.getTileUrl = function(level, x, y) {
        const rawUrl = origGetTileUrl(level, x, y);
        return window.slideSecurity ? window.slideSecurity.obterUrlAzulejoProtegida(rawUrl) : rawUrl;
      };
      item.source._palasProtected = true;
    }
  } catch (secErr) {
    console.warn("[Palas Security] Hook de proteção em getTileUrl:", secErr);
  }
}

function destruirInstanciaViewer() {
  if (_activeOpenTimer) {
    clearTimeout(_activeOpenTimer);
    _activeOpenTimer = null;
  }
  if (_styleSyncTimer) {
    clearTimeout(_styleSyncTimer);
    _styleSyncTimer = null;
  }
  if (_pinAutoHideTimer) {
    clearTimeout(_pinAutoHideTimer);
    _pinAutoHideTimer = null;
  }
  if (_viewerToastTimer) {
    clearTimeout(_viewerToastTimer);
    _viewerToastTimer = null;
  }

  limparMedicaoRegua();
  if (modoReguaAtivo) {
    toggleReguaMorfometrica(false);
  }
  if (_reguaPointerHost && _reguaPointerMoveHandler) {
    try { _reguaPointerHost.removeEventListener("pointermove", _reguaPointerMoveHandler); } catch (e) {}
    _reguaPointerHost = null;
    _reguaPointerMoveHandler = null;
  }

  limparMarcacoesPinosViewer();
  if (overlayQuestaoAtiva) {
    removerOverlayComSeguranca(overlayQuestaoAtiva);
    overlayQuestaoAtiva = null;
  }

  if (viewer && typeof viewer.destroy === "function") {
    try {
      viewer.destroy();
    } catch (e) {}
  }
  viewer = null;
  window.viewer = null;
}

export function destruirMicroscopio() {
  flushRespostasPendentes();
  destruirInstanciaViewer();
  if (_stageResizeObserver) {
    try { _stageResizeObserver.disconnect(); } catch (e) {}
    _stageResizeObserver = null;
  }
}

async function inicializarOpenSeadragon() {
  if (!laminaAtualData) return;
  const containerId = "osd-viewer";
  const container   = document.getElementById(containerId);
  if (!container) {
    console.error("[Palas Atlas] Container #osd-viewer nao encontrado no HTML.");
    return;
  }
  if (typeof window.OpenSeadragon !== "function") {
    console.error("[Palas Atlas] Biblioteca OpenSeadragon nao carregada.");
    exibirErroMicroscopio("Biblioteca OpenSeadragon não carregada. Atualize a página.");
    return;
  }

  let imagemUrl = laminaAtualData.imagemUrl || laminaAtualData.imageUrl || laminaAtualData.dziUrl || "";
  if (typeof imagemUrl === "string") {
    imagemUrl = imagemUrl.trim();
  }
  if (!imagemUrl || !isSafeSlideUrl(imagemUrl)) {
    exibirErroMicroscopio(!imagemUrl ? "Esta lâmina não possui URL de imagem cadastrada." : "URL de imagem da lâmina inválida.");
    return;
  }

  const rawFallback = laminaAtualData.previewImage || laminaAtualData.thumbnailUrl || "";
  const previewFallback = isSafeSlideUrl(rawFallback) ? String(rawFallback).trim() : "";

  destruirInstanciaViewer();
  marcacoesVisiveis = false;
  pinAtivo = null;
  questaoAtivaId = null;
  homeZoomRef = null;
  certidaoOpticaAtual = null;
  laminaAtualData._usingPreviewFallback = false;

  const mySeq = ++_viewerInstanceSeq;
  const isDzi = imagemUrl.endsWith(".dzi") || imagemUrl.includes(".dzi?");
  const tileSourcesConfig = isDzi ? imagemUrl : { type: "image", url: imagemUrl };

  const dziSlug =
    (window.slideSecurity && typeof window.slideSecurity.extrairSlugDzi === "function"
      ? window.slideSecurity.extrairSlugDzi(imagemUrl)
      : null) ||
    laminaAtualData.id ||
    "lamina-ativa";

  // Garante o ticket HMAC assinado ANTES da abertura do DZI para nenhum azulejo sair sem autorização
  if (isDzi && window.slideSecurity && typeof window.slideSecurity.renovarTicketSessao === "function") {
    await window.slideSecurity.renovarTicketSessao(dziSlug);
  }
  if (mySeq !== _viewerInstanceSeq) return;

  // MPP da lamina (microns por pixel) — calibrado com referência biológica na Pele Espessa (48px = 7.5 µm -> 0.156 µm/px a 40x)
  const maxMagInicial = Number(laminaAtualData.maxMagnification || laminaAtualData.maxZoomLevel || laminaAtualData.maxMag) || 40;
  const mppInicial = Number(laminaAtualData.mpp) || (40 / maxMagInicial) * 0.156;

  // TRAVA FÍSICA RIGOROSA: maxZoomPixelRatio: 1.0 (garante resolução nativa 1:1, ZERO ampliação vazia / pixel esticado)
  const maxZoomPixelRatio = 1.0;

  // Garantir dimensões explícitas no container e prevenção de interferência de gestos do navegador
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "400px";
  container.style.touchAction = "none";
  container.style.userSelect = "none";
  container.style.webkitUserSelect = "none";

  let hasFailed = false;
  let fallbackAttempted = false;

  try {
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
      navigatorBackground:      "rgba(255,255,255,0.92)",
      navigatorBorderColor:     "rgba(3,105,161,0.5)",
      navigatorAutoFade:        false,
      showReferenceStrip:       false,
      animationTime:            0.45,
      blendTime:                0.1,
      maxZoomPixelRatio:        maxZoomPixelRatio,
      // Evita over-fetching de 4x em 4x/10x/20x mantendo nitidez 1:1 em 40x e respeitando o rate-limit de /api/tile
      minPixelRatio:            0.75,
      immediateRender:          true,
      imageLoaderLimit:         6,

      // Motor de Ampliação e Navegação Totalmente Ativo
      mouseNavEnabled:          true,

      // Pan livre e navegacao sem travas, permitindo visao distante no campo panorâmico
      panHorizontal:            true,
      panVertical:              true,
      constrainDuringPan:       true,
      visibilityRatio:          0.2,
      minZoomImageRatio:        0.1,

      // Gestos de Mouse (Desktop)
      gestureSettingsMouse: {
        scrollToZoom:   true,
        clickToZoom:    false,
        dblClickToZoom: true,
        dragToPan:      true
      },

      // Gestos de Toque (Mobile/Tablet)
      gestureSettingsTouch: {
        pinchToZoom:    true,
        flickEnabled:   true,
        dragToPan:      true,
        dblClickToZoom: true,
        clickToZoom:    false,
        pinchRotate:    false
      }
    });
    window.viewer = viewer;

    if (viewer.world && typeof viewer.world.addHandler === "function") {
      viewer.world.addHandler("add-item", (ev) => protegerFonteAzulejos(ev?.item));
    }

    // Garante touch-action: none e user-select: none nos elementos canvas e container do OSD
    if (viewer.canvas) {
      viewer.canvas.style.touchAction = "none";
      viewer.canvas.style.userSelect = "none";
      viewer.canvas.style.webkitUserSelect = "none";
    }
    if (viewer.container) {
      viewer.container.style.touchAction = "none";
      viewer.container.style.userSelect = "none";
      viewer.container.style.webkitUserSelect = "none";
    }

    // Ativa a camada de segurança Palas Atlas (marca d'água dinâmica e anti-scraping)
    if (window.slideSecurity) {
      window.slideSecurity.init({
        viewerElement: container,
        slideId: dziSlug,
        userEmail: window.__palasCurrentUser?.email || null
      });
    }
  } catch (err) {
    console.error("[Palas Atlas] Erro fatal ao instanciar OpenSeadragon:", err);
    viewer = null;
    window.viewer = null;
    exibirErroMicroscopio("Falha na inicialização do visualizador óptico.");
    return;
  }

  // Configuração base da régua
  atualizarScalebarOpenSeadragon(viewer, mppInicial);

  // Tratamento de falha no carregamento do DZI/imagem (Tratamento Robusto)
  const onOpenFailed = (event) => {
    if (mySeq !== _viewerInstanceSeq) return;
    console.warn("[Palas Atlas] OpenSeadragon open-failed:", event);
    if (!fallbackAttempted && isDzi && previewFallback && previewFallback !== imagemUrl) {
      fallbackAttempted = true;
      laminaAtualData._usingPreviewFallback = true;
      atualizarScalebarOpenSeadragon(viewer, 0);
      if (modoReguaAtivo) toggleReguaMorfometrica(false);
      atualizarBotaoRegua();
      console.info("[Palas Atlas] Tentando fallback para imagem estática:", previewFallback);
      try {
        viewer.open({ type: "image", url: previewFallback });
        return;
      } catch (err) {
        console.error("[Palas Atlas] Falha ao tentar abrir fallback:", err);
      }
    }
    hasFailed = true;
    destruirInstanciaViewer();
    exibirErroMicroscopio(`Não foi possível carregar o arquivo da lâmina digital. Verifique sua conexão ou tente novamente.`);
  };

  viewer.addHandler("open-failed", onOpenFailed);

  // Função unificada de Indicador Dinâmico de Zoom + Telemetria de Campo + Scalebar Editorial
  const updateZoomDisplay = () => {
    if (!viewer || !viewer.viewport || !homeZoomRef) return;
    const mag = calcularMagnificacaoOtica();
    const display = document.getElementById("zoomIndicatorDisplay");
    if (display) {
      display.textContent = formatarMagnificacaoOtica(mag);
    }

    const fovDisplay = document.getElementById("fovIndicatorDisplay");
    if (fovDisplay) {
      const mpp = obterMppAtivo();
      const cs = viewer.viewport.getContainerSize();
      const fovUm = mpp
        ? calcularCampoDeVisaoUm(cs?.x, viewer.viewport.getZoom(true), getNativeZoomRef(), mpp)
        : null;
      fovDisplay.textContent = fovUm ? formatarComprimento(fovUm) : "—";
    }

    atualizarScalebarEditorial();
    atualizarLenteBotaoAtivo();
  };

  // Evento: imagem aberta com sucesso
  const onOpenSuccess = () => {
    if (mySeq !== _viewerInstanceSeq || hasFailed || !viewer || !viewer.viewport) return;
    if (_activeOpenTimer) {
      clearTimeout(_activeOpenTimer);
      _activeOpenTimer = null;
    }

    setTimeout(() => {
      if (mySeq !== _viewerInstanceSeq) return;
      // Remove skeleton de carregamento de forma imediata e limpa
      const skeleton  = document.getElementById("osdSkeleton");
      const osdCanvas = document.getElementById("osd-viewer");
      if (skeleton) {
        skeleton.style.transition = 'opacity 200ms ease-out';
        skeleton.style.opacity = '0';
        skeleton.style.pointerEvents = 'none';
        setTimeout(() => {
          if (mySeq !== _viewerInstanceSeq) return;
          skeleton.style.display = 'none';
          skeleton.classList.add("hidden");
          skeleton.classList.remove("flex");
        }, 210);
      }
      if (osdCanvas) osdCanvas.classList.remove("opacity-0");
    }, 0);

    homeZoomRef = viewer.viewport.getHomeZoom();

    const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;

    // Vincula o gancho de proteção de URLs de azulejos DZI e atualiza lâmina ativa
    try {
      if (window.slideSecurity) {
        window.slideSecurity.setSlide(dziSlug);
      }
      protegerFonteAzulejos(item);
    } catch (secErr) {
      console.warn("[Palas Security] Hook de proteção em setSlide:", secErr);
    }

    if (item) {
      // Análise Óptica Automática e Rigorosa da Pirâmide DZI
      analisarProporcoesOpticasDzi(item, maxMagInicial);
      aplicarLimitesOpticos();
      renderizarMetadadosDaLamina();

      const urlParams = new URLSearchParams(window.location.search);
      const maxMagAtual = getMaxMagLamina();
      const initialMagParam = urlParams.get("mag");
      const parsedMag = (initialMagParam !== null && initialMagParam !== "") ? Number(initialMagParam) : NaN;
      // Padrão de abertura do laboratório: começa na objetiva de 4x, permitindo override via ?mag=
      const targetInitialMag = Number.isFinite(parsedMag)
        ? Math.max(4, Math.min(maxMagAtual, parsedMag))
        : 4;
      const targetInitialZoom = calcularZoomParaMagnificacao(targetInitialMag);

      const imgBounds = viewer.world.getItemAt(0)?.getBounds();
      const centerPoint = imgBounds ? imgBounds.getCenter() : viewer.viewport.getCenter();
      const contentSize = typeof item.getContentSize === "function" ? item.getContentSize() : null;

      const xParam = urlParams.get("x");
      const yParam = urlParams.get("y");
      const xNum = (xParam !== null && xParam !== "") ? Number(xParam) : NaN;
      const yNum = (yParam !== null && yParam !== "") ? Number(yParam) : NaN;
      const hasUrlCoords = Number.isFinite(xNum) && Number.isFinite(yNum) && xNum >= 0 && xNum <= 1 && yNum >= 0 && yNum <= 1;

      // Ponto focal inicial da lâmina (prioriza deep-link ?x=&y= da URL; senão defaultCenter acima de 4x)
      let initialPoint = centerPoint;
      if (hasUrlCoords) {
        const convertedUrl = converterPontoParaViewport(xNum, yNum, contentSize);
        if (convertedUrl) initialPoint = convertedUrl;
      } else if (targetInitialMag > 4 && laminaAtualData?.defaultCenter) {
        const dcx = Number(laminaAtualData.defaultCenter.x);
        const dcy = Number(laminaAtualData.defaultCenter.y);
        const converted = (!isNaN(dcx) && !isNaN(dcy)) ? converterPontoParaViewport(dcx, dcy, contentSize) : null;
        if (converted) initialPoint = converted;
      }
      viewer.viewport.zoomTo(targetInitialZoom, initialPoint, true);
      viewer.viewport.panTo(initialPoint, true);
      viewer.viewport.applyConstraints(true);
    }

    aplicarBloqueioObjetivas(getMaxMagLamina());
    atualizarLenteBotaoAtivo();
    updateZoomDisplay();
    atualizarBotaoMarcacoes();
    atualizarBotaoRegua();
    aplicarEstadoMinimap(minimapRecolhido, false);
    renderizarTodasMarcacoesNoViewer();

    const pinUrlParam = new URLSearchParams(window.location.search).get("pin");
    if (pinUrlParam && !_pendingUrlPinId) {
      _pendingUrlPinId = pinUrlParam;
    }
    if (_pendingUrlPinId && Array.isArray(listaPinosAtual) && listaPinosAtual.length > 0) {
      const pinIdNorm = String(_pendingUrlPinId).trim().toLowerCase();
      const existePin = listaPinosAtual.some(p =>
        String(p.id || "").trim().toLowerCase() === pinIdNorm ||
        String(p.rotulo || "").trim().toLowerCase() === pinIdNorm
      );
      if (existePin) {
        const alvoPin = _pendingUrlPinId;
        _pendingUrlPinId = null;
        focarPinoNoViewer(alvoPin);
      }
    }

    if (_styleSyncTimer) clearTimeout(_styleSyncTimer);
    _styleSyncTimer = setTimeout(() => {
      _styleSyncTimer = null;
      if (mySeq !== _viewerInstanceSeq || !viewer) return;
      const legacySb = document.querySelector(".openseadragon-scalebar");
      if (legacySb) legacySb.style.display = "none";
      atualizarScalebarEditorial();
    }, 350);
  };

  viewer.addHandler("open", onOpenSuccess);
  if (typeof viewer.isOpen === "function" && viewer.isOpen()) {
    onOpenSuccess();
  }

  // Garantia absoluta contra travamentos no carregador (Timeout rastreado por sequência)
  _activeOpenTimer = setTimeout(() => {
    _activeOpenTimer = null;
    if (mySeq !== _viewerInstanceSeq) return;
    const skeleton = document.getElementById("osdSkeleton");
    if (skeleton && skeleton.style.display !== "none" && !skeleton.classList.contains("hidden")) {
      if (!viewer || !viewer.isOpen()) {
        hasFailed = true;
        destruirInstanciaViewer();
        exibirErroMicroscopio("Tempo limite excedido ao carregar a lâmina. Tente recarregar a página.");
      } else {
        skeleton.style.opacity = '0';
        skeleton.style.pointerEvents = 'none';
        skeleton.style.display = 'none';
        skeleton.classList.add("hidden");
        const osdCanvas = document.getElementById("osd-viewer");
        if (osdCanvas) osdCanvas.classList.remove("opacity-0");
      }
    }
  }, 4500);

  viewer.addHandler("animation", updateZoomDisplay);
  viewer.addHandler("animation-finish", updateZoomDisplay);
  viewer.addHandler("zoom", updateZoomDisplay);
  viewer.addHandler("animation", atualizarPosicaoLabelsCirculos);
  viewer.addHandler("animation-finish", atualizarPosicaoLabelsCirculos);
  viewer.addHandler("zoom", atualizarPosicaoLabelsCirculos);

  // Eventos da Régua Morfométrica Interativa (sem interferir em pan/pinch)
  viewer.addHandler("canvas-click", handleCanvasClickRegua);
  if (viewer.canvas) {
    _reguaPointerHost = viewer.canvas;
    _reguaPointerMoveHandler = handlePointerMoveRegua;
    _reguaPointerHost.addEventListener("pointermove", _reguaPointerMoveHandler, { passive: true });
  }
}

// ---------------------------------------------------------------------------
// 5.4 Calibração Óptica e Certidão por Lâmina
// ---------------------------------------------------------------------------

// Perfil de calibração padrão derivado da referência biológica (Hemácia da Pele Espessa: 48px = 7.5 µm -> 0.156 µm/px a 40x)
export const PERFIL_OPTICO_PADRAO = {
  id: "bancada-palas-atlas",
  nome: "Bancada Palas Atlas (Calibração Biológica - Hemácia Humana 7.5 µm)",
  camera: "Câmera Digital Microscópica",
  adaptador: 0.5,
  calibracoes: {
    "4":   1.562,
    "10":  0.625,
    "20":  0.312,
    "40":  0.156,
    "60":  0.104,
    "100": 0.0625
  },
  metodo: "referencia_biologica_hemacia_7.5um",
  calibradoEm: "2026-11-05"
};

export function getDziDimensions() {
  if (!viewer) return null;
  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  if (item && item.source && item.source.dimensions) {
    return { largura: item.source.dimensions.x, altura: item.source.dimensions.y };
  }
  if (item && typeof item.getContentSize === "function") {
    const cs = item.getContentSize();
    return { largura: cs.x, altura: cs.y };
  }
  return null;
}

export function recalcularCertidaoOptica() {
  if (!laminaAtualData) return null;
  const dimensoesDzi = getDziDimensions();

  certidaoOpticaAtual = emitirCertidaoOptica({
    lamina: laminaAtualData,
    manifesto: null,
    perfil: PERFIL_OPTICO_PADRAO,
    dimensoesDzi
  });

  if (certidaoOpticaAtual) {
    laminaAtualData.maxMagnification = certidaoOpticaAtual.ampliacaoMaxima;
    laminaAtualData.mpp = certidaoOpticaAtual.mppEfetivo;
    laminaAtualData.certidaoOptica = certidaoOpticaAtual;
  }
  return certidaoOpticaAtual;
}

export function aplicarLimitesOpticos() {
  if (!viewer || !viewer.viewport) return;
  recalcularCertidaoOptica();

  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
  const zoom4x = getZoom4xRef();
  const minOSDZoom = zoom4x * 0.90;
  const maxOSDZoom = calcularZoomParaMagnificacao(maxMag);

  // Trava física absoluta no teto de ampliação real da lâmina
  viewer.viewport.minZoomLevel = minOSDZoom;
  viewer.viewport.maxZoomLevel = maxOSDZoom;

  atualizarScalebarOpenSeadragon(
    viewer,
    laminaAtualData?._usingPreviewFallback ? 0 : (Number(laminaAtualData?.mpp) || (40 / maxMag) * 0.156)
  );

  aplicarBloqueioObjetivas(maxMag);
  atualizarLenteBotaoAtivo();
  atualizarBotaoRegua();
}

// ---------------------------------------------------------------------------
// 5.5 Análise Óptica Automática de DZI e Magnificação Linear Universal
// ---------------------------------------------------------------------------
/**
 * Analisador Automático de DZI e Calibração Óptica.
 * Inspeciona as dimensões nativas do XML DZI (Width, Height, TileSize)
 * e calcula as proporções matemáticas exatas para 4x, 10x, 40x e 100x.
 *
 * @param {OpenSeadragon.TiledImage} [tiledImage] - Imagem no OpenSeadragon
 * @param {number} [maxMagNominal=40] - Magnificação da objetiva de captura
 * @returns {Object} Diagnóstico e calibração das objetivas
 */
export function analisarProporcoesOpticasDzi(tiledImage, maxMagNominal) {
  const maxMag = Number(maxMagNominal) || 40;
  if (!viewer || !viewer.viewport) return null;

  const item = tiledImage || (viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null);
  const containerSize = viewer.viewport.getContainerSize();
  const homeZoom = viewer.viewport.getHomeZoom();

  let imgWidth = 0;
  let imgHeight = 0;
  let tileSize = 256;
  if (item && item.source && item.source.dimensions) {
    imgWidth = item.source.dimensions.x;
    imgHeight = item.source.dimensions.y;
    tileSize = item.source.tileSize || 256;
  } else if (item && typeof item.getContentSize === "function") {
    const cs = item.getContentSize();
    imgWidth = cs.x;
    imgHeight = cs.y;
  }

  const nativeZoom = getNativeZoomRef();
  const z4x   = calcularZoomParaMagnificacao(4);
  const z10x  = calcularZoomParaMagnificacao(10);
  const z40x  = calcularZoomParaMagnificacao(40);
  const z60x  = calcularZoomParaMagnificacao(60);
  const z100x = calcularZoomParaMagnificacao(100);

  const proporcoes = {
    imgWidth,
    imgHeight,
    aspectRatio: imgHeight > 0 ? (imgWidth / imgHeight).toFixed(3) : 1,
    megapixels: imgWidth > 0 ? ((imgWidth * imgHeight) / 1e6).toFixed(1) : 0,
    tileSize,
    containerWidth: containerSize.x,
    containerHeight: containerSize.y,
    maxMagnification: maxMag,
    nativeZoom,
    homeZoom,
    zoomLevels: {
      "4x": z4x,
      "10x": z10x,
      "40x": z40x,
      "60x": z60x,
      "100x": z100x
    },
    minOSDZoom: z4x * 0.90,
    maxOSDZoom: calcularZoomParaMagnificacao(maxMag)
  };

  if (imgWidth > 0) {
    console.info(
      `%c[Palas Atlas • Calibração Óptica DZI]%c ${laminaAtualData?.nome || 'Lâmina'}\n` +
      `• Resolução DZI: ${imgWidth} × ${imgHeight} px (${proporcoes.megapixels} MP, Proporção: ${proporcoes.aspectRatio})\n` +
      `• Objetiva Máxima: ${maxMag}x (100% resolução nativa 1:1 = zoom ${nativeZoom.toFixed(3)})\n` +
      `• Visão Panorâmica 4x: zoom ${z4x.toFixed(3)} (Campo panorâmico calibrado)\n` +
      `• Objetiva 10x: zoom ${z10x.toFixed(3)}\n` +
      `• Objetiva 40x: zoom ${z40x.toFixed(3)}`,
      "color: #c8ad5f; font-weight: bold;",
      "color: #94a3b8;"
    );
  }

  return proporcoes;
}

/**
 * Retorna o zoom nativo 1:1 da câmera (nativeZoom).
 * Em microscopia digital, a resolução nativa da captura (1 imagem pixel = 1 CSS pixel)
 * corresponde à objetiva física com a qual a lâmina foi digitalizada (maxMag, ex: 40x).
 *
 * É calculado dinamicamente em relação à geometria atual do viewport para manter
 * precisão absoluta em qualquer tamanho de tela ou redimensionamento da janela.
 */
export function getNativeZoomRef() {
  if (!viewer || !viewer.viewport) return 1.0;
  try {
    const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
    if (item && typeof item.imageToViewportZoom === "function") {
      const z = item.imageToViewportZoom(1);
      if (z && z > 0) return z;
    }
    const z = viewer.viewport.imageToViewportZoom(1);
    if (z && z > 0) return z;
  } catch (e) {}
  const baseHome = homeZoomRef || (viewer && viewer.viewport ? viewer.viewport.getHomeZoom() : 1.0) || 1.0;
  return baseHome * 5.0;
}

/**
 * Objetiva de captura da lâmina (ex: 40). É a âncora física da escala.
 */
function getMaxMagLamina() {
  return Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
}

/**
 * Converte um valor nominal de ampliação ótica (ex: 4, 10, 40)
 * para o nível de zoom correspondente no OpenSeadragon — FÍSICA REAL, calculada pelo DZI.
 *
 * Âncora: a objetiva em que a lâmina foi capturada (maxMag) = resolução nativa 1:1 do DZI
 * (1 pixel da imagem = 1 pixel da tela). As demais objetivas são proporcionais:
 *   zoom(M) = nativeZoom × M / maxMag
 *   Ex. captura em 40x → 40x = 100% | 10x = 25% | 4x = 10% da resolução capturada.
 * Lâminas pequenas aparecem com margem preta em 4x (comportamento físico correto).
 * Vale para QUALQUER lâmina nova, sem parâmetro manual.
 */
export function calcularZoomParaMagnificacao(mag) {
  const native = getNativeZoomRef();
  const m = Number(mag) || 4;
  return native * (m / getMaxMagLamina());
}

/**
 * Retorna o zoom interno do OpenSeadragon correspondente à objetiva de 4x.
 */
export function getZoom4xRef() {
  return calcularZoomParaMagnificacao(4);
}

/**
 * Converte o zoom interno do OpenSeadragon (viewer.viewport.getZoom(true))
 * para o equivalente de ampliação ótica real baseado na escala física das objetivas.
 *
 * @param {number} [osdZoom] - Zoom interno OSD opcional
 * @returns {number} Magnificação ótica numérica (ex: 4.0, 10.0, 40.0)
 */
export function calcularMagnificacaoOtica(osdZoom) {
  if (!viewer || !viewer.viewport) return 4;
  const z4 = getZoom4xRef();
  if (!z4 || z4 <= 0) return 4;

  const currentZoom = typeof osdZoom === "number" ? osdZoom : viewer.viewport.getZoom(true);
  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
  const maxOSDZoom = calcularZoomParaMagnificacao(maxMag);

  // Travamento rígido: se o zoom estiver no teto físico da lâmina, exibe rigorosamente maxMag (ex: 40x)
  if (currentZoom >= maxOSDZoom * 0.985) {
    return maxMag;
  }

  // Relação ótica linear direta: Magnificação = 4 * (zoomAtual / zoom4x)
  const magRaw = 4 * (currentZoom / z4);

  // Snap suave para valores nominais se muito próximo (respeitando teto real maxMag)
  if (Math.abs(magRaw - 4) < 0.35) return 4;
  if (maxMag >= 10 && Math.abs(magRaw - 10) < 0.8) return 10;
  if (maxMag >= 40 && Math.abs(magRaw - 40) < 2.5) return 40;
  if (maxMag >= 60 && Math.abs(magRaw - 60) < 3.0) return 60;
  if (maxMag >= 100 && Math.abs(magRaw - 100) < 4.5) return 100;

  // O valor exibido NUNCA ultrapassa maxMag (impede exibição de 50x quando maxMag for 40x)
  return Math.max(4, Math.min(maxMag, Math.round(magRaw * 10) / 10));
}

/**
 * Formata o valor de magnificação ótica para exibição limpa no badge da UI (ex: 4x, 10x, 40x).
 * Garante apresentação estável e sem oscilações bruscas.
 *
 * @param {number} mag - Valor de magnificação ótica
 * @returns {string} String formatada legível (ex: "4x", "10x", "40x" ou "12.5x")
 */
export function formatarMagnificacaoOtica(mag) {
  if (typeof mag !== "number" || isNaN(mag) || mag <= 0) return "4x";
  const umaCasa = Math.round(mag * 10) / 10;
  if (Math.abs(umaCasa - Math.round(umaCasa)) < 0.05) {
    return `${Math.round(umaCasa)}x`;
  }
  return `${umaCasa.toFixed(1)}x`;
}

// ---------------------------------------------------------------------------
// 6. Atualiza destaque do botão de lente conforme zoom atual
// ---------------------------------------------------------------------------
const LENS_BTN_ACTIVE_CLS = "lens-btn palas-mono-tech bg-[#0f766e] text-white font-bold shadow-sm shadow-teal-900/20 px-2.5 sm:px-3 py-1.5 lg:py-1 rounded-xl text-xs transition-all active-lens cursor-pointer touch-manipulation min-w-[40px] min-h-[36px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
const LENS_BTN_IDLE_CLS   = "lens-btn palas-mono-tech text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 font-medium px-2.5 sm:px-3 py-1.5 lg:py-1 rounded-xl text-xs transition-all duration-200 cursor-pointer touch-manipulation min-w-[40px] min-h-[36px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";

function atualizarLenteBotaoAtivo() {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;
  const mag = calcularMagnificacaoOtica();
  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;

  let objetivo = "4x";
  if (maxMag >= 100 && mag >= 80) {
    objetivo = "100x";
  } else if (maxMag >= 60 && mag >= 50) {
    objetivo = "60x";
  } else if (mag >= (maxMag <= 40 ? 25 : 30)) {
    objetivo = "40x";
  } else if (mag >= 7) {
    objetivo = "10x";
  }

  document.querySelectorAll(".lens-btn").forEach(btn => {
    if (btn.disabled) return;

    const magAttr = btn.getAttribute("data-mag");
    const isAtivo = magAttr ? `${magAttr}x` === objetivo : btn.textContent.trim() === objetivo;
    btn.className = isAtivo ? LENS_BTN_ACTIVE_CLS : LENS_BTN_IDLE_CLS;
  });

  const activeBtn = document.querySelector(".lens-btn.active-lens");
  if (activeBtn) {
    const panel = document.getElementById("viewerLensPanel");
    if (panel && panel.scrollWidth > panel.clientWidth) {
      const scrollPos = activeBtn.offsetLeft - panel.offsetLeft - (panel.clientWidth / 2) + (activeBtn.clientWidth / 2);
      panel.scrollTo({ left: Math.max(0, scrollPos), behavior: "smooth" });
    }
  }
}

// ---------------------------------------------------------------------------
// 6.5 Oculta/desabilita objetivas acima da capacidade física da lâmina
// ---------------------------------------------------------------------------
function aplicarBloqueioObjetivas(maxMag) {
  const limiteMag = Number(maxMag) || 40;
  document.querySelectorAll(".lens-btn").forEach(btn => {
    const magBotao = Number(btn.getAttribute("data-mag")) || 4;
    if (!objetivaDisponivel(magBotao, limiteMag)) {
      btn.disabled = true;
      btn.className = "lens-btn hidden";
      btn.setAttribute("aria-hidden", "true");
      btn.title = `Objetiva não disponível (Máx: ${limiteMag}x)`;
    } else {
      btn.disabled = false;
      btn.removeAttribute("aria-hidden");
      btn.className = LENS_BTN_IDLE_CLS;
      btn.title = `Objetiva ${magBotao}x`;
    }
  });
  atualizarLenteBotaoAtivo();
}

// ---------------------------------------------------------------------------
// 7. Delegacao global de eventos para pin-link no texto descritivo
// ---------------------------------------------------------------------------
function registrarDelegacaoGlobalDePinos() {
  if (_delegacaoPinosRegistrada) return;
  _delegacaoPinosRegistrada = true;

  document.addEventListener("click", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id], [data-pin]");
    if (!alvo) return;
    const pinIdRaw = alvo.getAttribute("data-pin-id") ||
                     alvo.getAttribute("data-pin") ||
                     alvo.getAttribute("data-id") ||
                     alvo.getAttribute("href")?.replace(/^#/, "") ||
                     alvo.textContent?.trim();
    if (!pinIdRaw) return;
    evento.preventDefault();
    focarPinoNoViewer(pinIdRaw, { permitirToggle: true });
  });
}

// ---------------------------------------------------------------------------
// 8. Motor de Marcações de Alto Contraste & Foco Óptico no Viewer
// ---------------------------------------------------------------------------

/**
 * Converte coordenadas da imagem (pixels ou normalizadas 0..1) para o sistema
 * de coordenadas do viewport do OpenSeadragon.
 */
function converterPontoParaViewport(xVal, yVal, contentSize) {
  if (!viewer || !viewer.viewport || !window.OpenSeadragon) return null;
  const px = Number(xVal);
  const py = Number(yVal);
  if (isNaN(px) || isNaN(py)) return null;

  if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && contentSize && contentSize.x > 1) {
    return viewer.viewport.imageToViewportCoordinates(
      new window.OpenSeadragon.Point(px * contentSize.x, py * contentSize.y)
    );
  }
  return viewer.viewport.imageToViewportCoordinates(
    new window.OpenSeadragon.Point(px, py)
  );
}

/**
 * Destrói o MouseTracker no próximo tick (após o handler pointerup atual do OpenSeadragon)
 * para evitar crash interno em `activePointersLists`, removendo o overlay de imediato.
 */
function agendarDestruicaoTracker(tracker) {
  if (!tracker) return;
  setTimeout(() => {
    try {
      if (typeof tracker.destroy === "function") tracker.destroy();
    } catch (e) {}
  }, 0);
}

function removerOverlayComSeguranca(elem) {
  if (!elem) return;
  if (elem._osdTracker) {
    agendarDestruicaoTracker(elem._osdTracker);
    elem._osdTracker = null;
  }
  if (Array.isArray(elem._osdTrackers)) {
    elem._osdTrackers.forEach(agendarDestruicaoTracker);
    elem._osdTrackers = null;
  }
  if (viewer) {
    try { viewer.removeOverlay(elem); } catch (e) {}
  }
}

/**
 * Remove o foco ativo da marcação na lâmina e na barra lateral.
 */
function limparFocoPinoAtivo() {
  if (_pinAutoHideTimer) {
    clearTimeout(_pinAutoHideTimer);
    _pinAutoHideTimer = null;
  }
  pinAtivo = null;
  destacarPinoNaSidebar(null);
  renderizarTodasMarcacoesNoViewer();
}

/**
 * Remove todas as marcações de pinos atualmente sobrepostas no OpenSeadragon.
 */
function limparMarcacoesPinosViewer() {
  if (Array.isArray(overlaysPinosPersistentes)) {
    overlaysPinosPersistentes.forEach((item) => removerOverlayComSeguranca(item?.element));
  }
  overlaysPinosPersistentes = [];

  if (overlayPinAtivo) {
    removerOverlayComSeguranca(overlayPinAtivo);
    overlayPinAtivo = null;
  }

  document.querySelectorAll('[id^="viewer-pin-"]').forEach((el) => {
    removerOverlayComSeguranca(el);
  });
}

/**
 * Sincroniza o botão "Marcações" na barra superior com o estado e quantidade atual.
 */
function atualizarBotaoMarcacoes() {
  const btn = document.getElementById("btnToggleMarcacoes");
  const badge = document.getElementById("badgeContadorMarcacoes");
  const total = Array.isArray(listaPinosAtual) ? listaPinosAtual.length : 0;

  if (badge) {
    badge.textContent = String(total);
    badge.className = marcacoesVisiveis
      ? `max-sm:absolute max-sm:-top-1 max-sm:-right-1 px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-mono font-bold bg-teal-600 text-white leading-none ${total === 0 ? "hidden" : ""}`
      : `max-sm:absolute max-sm:-top-1 max-sm:-right-1 px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-mono font-bold bg-slate-300 text-slate-700 leading-none ${total === 0 ? "hidden" : ""}`;
  }

  if (btn) {
    btn.classList.toggle("is-on", marcacoesVisiveis);
    btn.classList.toggle("is-off", !marcacoesVisiveis);
    btn.setAttribute("aria-pressed", String(marcacoesVisiveis));
    btn.title = marcacoesVisiveis
      ? "Ocultar marcações na lâmina (M)"
      : "Mostrar todas as marcações na lâmina (M)";
  }
}

/**
 * Vincula clique/toque via MouseTracker do OpenSeadragon para focar o pino ao
 * clicar diretamente sobre a marcação na lâmina.
 */
function vincularCliqueMarcacaoViewer(targetElems, pinId, overlayContainer) {
  if (!targetElems || !window.OpenSeadragon) return;
  const elems = (Array.isArray(targetElems) ? targetElems : [targetElems]).filter(Boolean);
  if (elems.length === 0) return;

  overlayContainer._osdTrackers = overlayContainer._osdTrackers || [];
  elems.forEach((el) => {
    const tracker = new window.OpenSeadragon.MouseTracker({
      element: el,
      clickHandler: (e) => {
        if (!e || !e.quick) return;
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
        const isMesmoAtivo = Boolean(pinAtivo) && String(pinAtivo).trim().toLowerCase() === String(pinId).trim().toLowerCase();
        if (!marcacoesVisiveis || isMesmoAtivo) {
          limparFocoPinoAtivo();
          return;
        }
        if (abaAtivaPainel !== "descricao") {
          alternarAbaPainel("descricao");
        }
        focarPinoNoViewer(pinId, { permitirToggle: false });
      }
    });
    overlayContainer._osdTrackers.push(tracker);
  });
}

/**
 * Constrói e insere no OpenSeadragon o overlay de alto contraste para um pino
 * (suporta 'pin', 'circle' e 'arrow'), diferenciando estado normal e em foco.
 */
function criarOverlayPino(pino, idx, isAtivo, contentSize) {
  const pinId = String(pino.id || idx + 1);
  const rotuloSeguro = escaparHTML(pino.rotulo || "");
  const zIndexVal = isAtivo ? 48 : 40;
  const rootClass = `viewer-marker-root${isAtivo ? " is-active" : ""}`;
  const strokeCore = isAtivo ? "#0284c7" : "#0d9488";
  const fillSoft = isAtivo ? "rgba(2, 132, 199, 0.12)" : "rgba(13, 148, 136, 0.06)";
  const tagClass = isAtivo ? "viewer-marker-tag is-active" : "viewer-marker-tag";
  const closeHint = isAtivo ? '<span class="viewer-marker-tag-close" aria-hidden="true">&times;</span>' : "";
  const titleText = isAtivo ? `${pino.rotulo || "Marcação"} — clique para ocultar` : (pino.rotulo || "Clique para focar");
  const titleSafe = escaparHTML(titleText);

  let overlayElem = null;

  // 1. ANOTAÇÃO TIPO CÍRCULO (Delimitação Estrutural)
  if (pino.type === "circle") {
    let r = Number(pino.radius) || 250;
    let px = Number(pino.x) || 0;
    let py = Number(pino.y) || 0;
    if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && contentSize && contentSize.x > 1) {
      px *= contentSize.x;
      py *= contentSize.y;
      if (r > 0 && r <= 1) r *= contentSize.x;
    }

    const imgRect = new window.OpenSeadragon.Rect(px - r, py - r, 2 * r, 2 * r);
    const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);

    overlayElem = document.createElement("div");
    overlayElem.id = `viewer-pin-${pinId}`;
    overlayElem.className = rootClass;
    overlayElem.style.cssText = `pointer-events:none; position:relative; width:100%; height:100%; z-index:${zIndexVal};`;
    overlayElem.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full overflow-visible ${isAtivo ? "viewer-circle-focus-svg" : ""}" style="pointer-events:none; filter:drop-shadow(0 1px 3px rgba(15,23,42,0.35));">
        <circle data-pin-hit="circle-ring" cx="50" cy="50" r="48.5" fill="none" stroke="transparent" stroke-width="18" vector-effect="non-scaling-stroke" style="pointer-events:stroke; cursor:pointer;" />
        <circle cx="50" cy="50" r="48.5" fill="${fillSoft}" stroke="#ffffff" stroke-width="${isAtivo ? 6.5 : 4.5}" opacity="0.92" vector-effect="non-scaling-stroke" style="pointer-events:none;" />
        <circle cx="50" cy="50" r="48.5" fill="none" stroke="${strokeCore}" stroke-width="${isAtivo ? 3.2 : 2.2}" vector-effect="non-scaling-stroke" style="pointer-events:none;" />
      </svg>
      ${rotuloSeguro ? `
        <div data-pin-hit="circle-label" title="${titleSafe}" style="position:absolute; top:0; left:50%; transform:translate(-50%, calc(-100% - 8px)); pointer-events:auto; cursor:pointer; z-index:2;">
          <div class="${tagClass}">
            <span class="viewer-marker-tag-dot"></span>
            <span>${rotuloSeguro}</span>
            ${closeHint}
          </div>
        </div>
      ` : ""}
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: vpRect
    });

    const ringHit = overlayElem.querySelector('[data-pin-hit="circle-ring"]');
    const labelHit = overlayElem.querySelector('[data-pin-hit="circle-label"]');
    vincularCliqueMarcacaoViewer([ringHit, labelHit], pinId, overlayElem);

  // 2. ANOTAÇÃO TIPO SETA DIRECIONAL (Vetor Haste -> Alvo Celular)
  } else if (pino.type === "arrow") {
    let x1 = Number(pino.x) || 0;
    let y1 = Number(pino.y) || 0;
    const rawEndX = pino.endX != null ? pino.endX : pino.end_x;
    const rawEndY = pino.endY != null ? pino.endY : pino.end_y;
    const originNormalized = (x1 >= 0 && x1 <= 1 && y1 >= 0 && y1 <= 1 && contentSize && contentSize.x > 1);
    if (originNormalized) {
      x1 *= contentSize.x;
      y1 *= contentSize.y;
    }
    let x2 = rawEndX != null ? Number(rawEndX) : x1 + 100;
    let y2 = rawEndY != null ? Number(rawEndY) : y1 + 100;
    if (rawEndX != null && rawEndY != null && x2 >= 0 && x2 <= 1 && y2 >= 0 && y2 <= 1 && contentSize && contentSize.x > 1) {
      x2 *= contentSize.x;
      y2 *= contentSize.y;
    }

    const pad = Math.max(48, Math.hypot(x2 - x1, y2 - y1) * 0.14);
    const minX = Math.min(x1, x2) - pad;
    const minY = Math.min(y1, y2) - pad;
    const maxX = Math.max(x1, x2) + pad;
    const maxY = Math.max(y1, y2) + pad;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const imgRect = new window.OpenSeadragon.Rect(minX, minY, w, h);
    const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);

    const svgX1 = x1 - minX;
    const svgY1 = y1 - minY;
    const svgX2 = x2 - minX;
    const svgY2 = y2 - minY;
    const pctX1 = (svgX1 / w) * 100;
    const pctY1 = (svgY1 / h) * 100;
    const pctX2 = (svgX2 / w) * 100;
    const pctY2 = (svgY2 / h) * 100;
    const angleRad = Math.atan2(y2 - y1, x2 - x1);
    const angleDeg = angleRad * (180 / Math.PI);
    const headSize = isAtivo ? 22 : 18;

    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    let labelTransform = "translate(-50%, calc(-100% - 14px))";
    if (Math.abs(dirY) >= Math.abs(dirX)) {
      labelTransform = dirY > 0
        ? "translate(-50%, calc(-100% - 14px))"
        : "translate(-50%, 14px)";
    } else {
      labelTransform = dirX > 0
        ? "translate(calc(-100% - 14px), -50%)"
        : "translate(14px, -50%)";
    }

    overlayElem = document.createElement("div");
    overlayElem.id = `viewer-pin-${pinId}`;
    overlayElem.className = rootClass;
    overlayElem.style.cssText = `pointer-events:none; position:relative; width:100%; height:100%; z-index:${zIndexVal};`;
    overlayElem.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="w-full h-full overflow-visible" style="filter:drop-shadow(0 1px 4px rgba(15,23,42,0.45)); pointer-events:none;">
        <line data-pin-hit="arrow-line" x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="transparent" stroke-width="18" vector-effect="non-scaling-stroke" style="pointer-events:stroke; cursor:pointer;" />
        <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="#ffffff" stroke-width="${isAtivo ? 6.5 : 4.8}" stroke-linecap="round" vector-effect="non-scaling-stroke" style="pointer-events:none;" />
        <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="${strokeCore}" stroke-width="${isAtivo ? 3.4 : 2.4}" stroke-linecap="round" vector-effect="non-scaling-stroke" style="pointer-events:none;" />
      </svg>

      <div data-pin-hit="arrow-tip" title="${titleSafe}" style="position:absolute; left:${pctX2}%; top:${pctY2}%; width:28px; height:28px; transform:translate(-50%, -50%); pointer-events:auto; cursor:pointer; z-index:2; display:flex; align-items:center; justify-content:center;">
        ${isAtivo ? `
          <div class="viewer-marker-radar" style="position:absolute; inset:-4px; border-radius:9999px; background:rgba(2,132,199,0.26); border:1.5px solid #0284c7; pointer-events:none;"></div>
        ` : ""}
        <svg width="${headSize}" height="${headSize}" viewBox="0 0 24 24" style="position:relative; transform:rotate(${angleDeg}deg); overflow:visible; filter:drop-shadow(0 1px 4px rgba(15,23,42,0.5)); pointer-events:none;">
          <path d="M 3 4 L 22 12 L 3 20 L 7.5 12 Z" fill="${strokeCore}" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round" />
        </svg>
      </div>

      <div style="position:absolute; left:${pctX1}%; top:${pctY1}%; width:0; height:0; pointer-events:none; z-index:3;">
        <div style="position:absolute; left:0; top:0; transform:translate(-50%, -50%); width:8px; height:8px; border-radius:9999px; background:${strokeCore}; border:1.5px solid #ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.4); pointer-events:none;"></div>
        ${rotuloSeguro ? `
          <div data-pin-hit="arrow-label" title="${titleSafe}" style="position:absolute; left:0; top:0; transform:${labelTransform}; pointer-events:auto; cursor:pointer;">
            <div class="${tagClass}">
              <span class="viewer-marker-tag-dot"></span>
              <span>${rotuloSeguro}</span>
              ${closeHint}
            </div>
          </div>
        ` : ""}
      </div>
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: vpRect
    });

    const lineHit = overlayElem.querySelector('[data-pin-hit="arrow-line"]');
    const tipHit = overlayElem.querySelector('[data-pin-hit="arrow-tip"]');
    const labelHit = overlayElem.querySelector('[data-pin-hit="arrow-label"]');
    vincularCliqueMarcacaoViewer([lineHit, tipHit, labelHit], pinId, overlayElem);

  // 3. ANOTAÇÃO TIPO PIN CLÁSSICO
  } else {
    const targetPoint = converterPontoParaViewport(pino.x, pino.y, contentSize);
    if (!targetPoint) return null;

    const dotSize = isAtivo ? 16 : 14;
    const dotShadow = isAtivo
      ? "0 0 0 3px rgba(2,132,199,0.32), 0 4px 14px rgba(3,105,161,0.45)"
      : "0 0 0 2.5px rgba(13,148,136,0.28), 0 3px 10px rgba(15,23,42,0.35)";

    overlayElem = document.createElement("div");
    overlayElem.id = `viewer-pin-${pinId}`;
    overlayElem.className = `${rootClass} viewer-pin-interactive`;
    overlayElem.style.cssText = `pointer-events:none; position:relative; width:36px; height:36px; z-index:${zIndexVal};`;
    overlayElem.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; pointer-events:none;">
        <div data-pin-hit="pin-dot" title="${titleSafe}" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
          ${isAtivo ? `
            <div class="viewer-marker-radar" style="position:absolute; width:36px; height:36px; border-radius:9999px; background:rgba(2,132,199,0.26); border:1.5px solid #0284c7; pointer-events:none;"></div>
          ` : ""}
          <div style="position:relative; width:${dotSize}px; height:${dotSize}px; background:${strokeCore}; border-radius:9999px; border:2.5px solid #ffffff; box-shadow:${dotShadow}; pointer-events:none;"></div>
        </div>
        ${rotuloSeguro ? `
          <div data-pin-hit="pin-label" title="${titleSafe}" style="position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%); pointer-events:auto; cursor:pointer;">
            <div class="${tagClass}">
              <span class="viewer-marker-tag-dot"></span>
              <span>${rotuloSeguro}</span>
              ${closeHint}
            </div>
          </div>
        ` : ""}
      </div>
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: targetPoint,
      placement: window.OpenSeadragon.Placement.CENTER
    });

    const dotHit = overlayElem.querySelector('[data-pin-hit="pin-dot"]');
    const labelHit = overlayElem.querySelector('[data-pin-hit="pin-label"]');
    vincularCliqueMarcacaoViewer([dotHit, labelHit], pinId, overlayElem);
  }

  if (isAtivo) {
    overlayPinAtivo = overlayElem;
  }
  return overlayElem;
}

/**
 * Renderiza sobre o OpenSeadragon todas as marcações da lâmina atual (quando
 * marcacoesVisiveis está ligado), ou apenas a marcação em foco (se ocultas).
 */
export function renderizarTodasMarcacoesNoViewer() {
  if (!viewer || !viewer.viewport || !window.OpenSeadragon) return;
  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  if (!item) return;
  const contentSize = item.getContentSize();

  limparMarcacoesPinosViewer();

  const pool = (Array.isArray(listaPinosAtual) && listaPinosAtual.length > 0)
    ? listaPinosAtual
    : (Array.isArray(laminaAtualData?.pinos) ? laminaAtualData.pinos : []);

  if (pool.length === 0) return;

  const idAtivoNorm = pinAtivo ? String(pinAtivo).trim().toLowerCase() : "";

  pool.forEach((pino, idx) => {
    const pId = String(pino.id || idx + 1);
    const isAtivo = Boolean(idAtivoNorm) && pId.trim().toLowerCase() === idAtivoNorm;
    if (!marcacoesVisiveis && !isAtivo) return;

    const elem = criarOverlayPino(pino, idx, isAtivo, contentSize);
    if (elem) {
      overlaysPinosPersistentes.push({ pinId: pId, element: elem });
    }
  });

  requestAnimationFrame(atualizarPosicaoLabelsCirculos);
}

/**
 * Reposiciona etiquetas de círculos caso a borda superior do círculo esteja
 * próxima ao cabeçalho ou fora do palco visível, evitando corte do rótulo.
 */
function atualizarPosicaoLabelsCirculos() {
  const labels = document.querySelectorAll('[data-pin-hit="circle-label"]');
  if (labels.length === 0) return;
  const stage = document.getElementById("viewerStage");
  if (!stage) return;
  const stageRect = stage.getBoundingClientRect();
  labels.forEach((labelEl) => {
    const root = labelEl.closest(".viewer-marker-root");
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (rect.top < stageRect.top + 42) {
      if (rect.bottom + 48 < stageRect.bottom) {
        labelEl.style.top = "calc(100% + 8px)";
        labelEl.style.transform = "translateX(-50%)";
      } else {
        const insideTop = Math.max(10, Math.round(stageRect.top - rect.top + 12));
        labelEl.style.top = `${insideTop}px`;
        labelEl.style.transform = "translateX(-50%)";
      }
    } else {
      labelEl.style.top = "0";
      labelEl.style.transform = "translate(-50%, calc(-100% - 8px))";
    }
  });
}

/**
 * Alterna a exibição contínua das marcações na lâmina histológica.
 *
 * @param {boolean} [forcarEstado]
 */
export function toggleMarcacoesNoViewer(forcarEstado) {
  marcacoesVisiveis = typeof forcarEstado === "boolean" ? forcarEstado : !marcacoesVisiveis;
  if (!marcacoesVisiveis) {
    if (_pinAutoHideTimer) {
      clearTimeout(_pinAutoHideTimer);
      _pinAutoHideTimer = null;
    }
    pinAtivo = null;
    destacarPinoNaSidebar(null);
  }
  atualizarBotaoMarcacoes();
  renderizarTodasMarcacoesNoViewer();
}

export function focarPinoNoViewer(pinIdRaw, { permitirToggle = false } = {}) {
  if (!viewer || !viewer.viewport || !window.OpenSeadragon) {
    console.warn("[Palas Atlas] Viewer OpenSeadragon não inicializado ao tentar focar pino.");
    return;
  }

  const idBuscado = String(pinIdRaw || "").trim().toLowerCase();
  if (!idBuscado) return;

  const pool = (Array.isArray(listaPinosAtual) && listaPinosAtual.length > 0)
    ? listaPinosAtual
    : (Array.isArray(laminaAtualData?.pinos) ? laminaAtualData.pinos : []);

  // 1. Busca pino por correspondência flexível (ID exato, sem prefixo "pin_", por rótulo ou índice)
  let pino = pool.find(p => String(p.id || "").trim().toLowerCase() === idBuscado);
  if (!pino) {
    pino = pool.find(p => {
      const pIdClean = String(p.id || "").replace(/^(pin[-_]|p)/i, "").trim().toLowerCase();
      const rawClean = idBuscado.replace(/^(pin[-_]|p)/i, "").trim();
      return pIdClean && pIdClean === rawClean;
    });
  }
  if (!pino) {
    pino = pool.find(p => String(p.rotulo || "").trim().toLowerCase() === idBuscado);
  }
  if (!pino && !isNaN(Number(idBuscado)) && pool[Number(idBuscado) - 1]) {
    pino = pool[Number(idBuscado) - 1];
  }

  if (!pino) {
    console.warn("[Palas Atlas] Pino não encontrado para ID/Rótulo:", pinIdRaw, "no acervo de pinos:", pool);
    return;
  }

  const pinId = String(pino.id || idBuscado);
  if (permitirToggle && pinAtivo && String(pinAtivo).trim().toLowerCase() === pinId.trim().toLowerCase()) {
    limparFocoPinoAtivo();
    return;
  }

  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  const contentSize = item ? item.getContentSize() : null;

  // Remove pin de questão ativa se houver
  if (overlayQuestaoAtiva) {
    removerOverlayComSeguranca(overlayQuestaoAtiva);
    overlayQuestaoAtiva = null;
    questaoAtivaId = null;
  }

  pinAtivo = pinId;

  // Renderiza todas as marcações mantendo o pino focado em destaque máximo
  renderizarTodasMarcacoesNoViewer();

  // Cálculo do Ponto Alvo e do Zoom Óptico Ideal
  const homeZoom = homeZoomRef || viewer.viewport.getHomeZoom() || 1;
  let targetPoint = null;
  let targetZoom;

  if (pino.zoom && Number(pino.zoom) > 0) {
    targetZoom = Number(pino.zoom);
  } else {
    targetZoom = Math.max(viewer.viewport.getZoom(), homeZoom * 3.5);
  }

  if (pino.type === "circle") {
    let r = Number(pino.radius) || 250;
    const px = Number(pino.x) || 0;
    const py = Number(pino.y) || 0;
    if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && contentSize && contentSize.x > 1 && r > 0 && r <= 1) {
      r *= contentSize.x;
    }
    targetPoint = converterPontoParaViewport(pino.x, pino.y, contentSize);
    targetZoom = homeZoom * Math.min(5.5, Math.max(2.2, 1400 / (Math.max(1, r) * 2)));
  } else if (pino.type === "arrow") {
    const rawEndX = pino.endX != null ? pino.endX : pino.end_x;
    const rawEndY = pino.endY != null ? pino.endY : pino.end_y;
    if (rawEndX != null && rawEndY != null) {
      targetPoint = converterPontoParaViewport(rawEndX, rawEndY, contentSize);
    } else {
      let px = Number(pino.x) || 0;
      let py = Number(pino.y) || 0;
      if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && contentSize && contentSize.x > 1) {
        px *= contentSize.x;
        py *= contentSize.y;
      }
      targetPoint = viewer.viewport.imageToViewportCoordinates(
        new window.OpenSeadragon.Point(px + 100, py + 100)
      );
    }
  } else {
    targetPoint = converterPontoParaViewport(pino.x, pino.y, contentSize);
  }

  // Limite de segurança de zoom
  if (viewer.viewport.maxZoomLevel) {
    targetZoom = Math.min(targetZoom, viewer.viewport.maxZoomLevel * 0.95);
  }
  if (viewer.viewport.minZoomLevel) {
    targetZoom = Math.max(targetZoom, viewer.viewport.minZoomLevel);
  }

  // TRANSIÇÃO PRECISA DE CENTRALIZAÇÃO E AMPLIAÇÃO ANCORADA NO ALVO
  if (targetPoint) {
    viewer.viewport.zoomTo(targetZoom, targetPoint, false);
    viewer.viewport.panTo(targetPoint, false);
    viewer.viewport.applyConstraints();
  }

  // Destaca o card do pino na lista lateral e links inline no texto
  destacarPinoNaSidebar(pinId);

  // Auto-remove o destaque ativo após 9s (mantendo marcações exibidas se o botão estiver ligado)
  if (_pinAutoHideTimer) {
    clearTimeout(_pinAutoHideTimer);
    _pinAutoHideTimer = null;
  }
  _pinAutoHideTimer = setTimeout(() => {
    _pinAutoHideTimer = null;
    if (pinAtivo === pinId) {
      pinAtivo = null;
      destacarPinoNaSidebar(null);
      renderizarTodasMarcacoesNoViewer();
    }
  }, 9000);
}

/**
 * Localiza e foca uma questão prática de bancada no visualizador OpenSeadragon.
 * Realiza a conversão precisa de coordenadas, insere um overlay pulsante
 * em alto contraste e navega com centralização perfeita (pan & zoom).
 *
 * @param {string|number} questaoId
 */
export function focarQuestaoNoViewer(questaoId) {
  const idBuscado = String(questaoId);
  const q = listaQuestoesAtual.find(item => String(item.id) === idBuscado);
  if (!q) {
    console.warn("[Palas Atlas] Questão não encontrada para ID:", questaoId);
    return;
  }

  // Certifica visibilidade da aba de questões e destaca card correspondente
  alternarAbaPainel("questoes");
  destacarCardQuestaoNaSidebar(idBuscado);

  if (!viewer || !viewer.viewport || !window.OpenSeadragon) {
    console.warn("[Palas Atlas] Viewer OpenSeadragon não inicializado ao tentar focar questão.");
    return;
  }

  const temX = q.x !== undefined && q.x !== null && !isNaN(Number(q.x));
  const temY = q.y !== undefined && q.y !== null && !isNaN(Number(q.y));
  if (!temX && !temY) {
    return;
  }

  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  const contentSize = item ? item.getContentSize() : null;
  const pontoViewport = converterPontoParaViewport(q.x || 0, q.y || 0, contentSize);
  if (!pontoViewport) return;

  // Remove overlay de questão ativa anterior
  if (overlayQuestaoAtiva) {
    removerOverlayComSeguranca(overlayQuestaoAtiva);
    overlayQuestaoAtiva = null;
  }
  if (questaoAtivaId) {
    const elemAnterior = document.getElementById(`viewer-qpin-${questaoAtivaId}`);
    if (elemAnterior) removerOverlayComSeguranca(elemAnterior);
  }

  // Limpa o foco de estrutura anterior mantendo marcações persistentes no estado padrão
  if (pinAtivo) {
    pinAtivo = null;
    destacarPinoNaSidebar(null);
    renderizarTodasMarcacoesNoViewer();
  }

  const numeroQ = q.numero !== undefined && q.numero !== null ? q.numero : (listaQuestoesAtual.indexOf(q) + 1);
  const numeroQSafe = escaparHTML(String(numeroQ));

  // Pino de questão com alto contraste clínico (azul-petróleo + anel duplo branco)
  const pinElem = document.createElement("div");
  pinElem.id = `viewer-qpin-${q.id}`;
  pinElem.className = "viewer-marker-root is-active viewer-qpin cursor-pointer";
  pinElem.style.cssText = "position:relative; width:56px; height:56px; z-index:50; pointer-events:auto;";
  pinElem.title = `Questão Q${numeroQ}: ${q.titulo || "Ponto de Investigação"}`;

  pinElem.innerHTML = `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
      <div class="viewer-marker-radar" style="position:absolute; inset:4px; border-radius:9999px; background:rgba(2,132,199,0.28); border:1.5px solid #0284c7; pointer-events:none;"></div>
      <div style="position:relative; min-width:34px; height:34px; padding:0 8px; background:#0369a1; border-radius:9999px; border:2px solid #ffffff; box-shadow:0 0 0 2px #0369a1, 0 6px 16px rgba(3,105,161,0.45); display:flex; align-items:center; justify-content:center; gap:2px;">
        <span style="font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">Q${numeroQSafe}</span>
      </div>
      <div style="position:absolute; top:calc(100% + 5px); left:50%; transform:translateX(-50%); pointer-events:none;">
        <div class="viewer-marker-tag is-active">
          <span class="viewer-marker-tag-dot"></span>
          <span>Questão Q${numeroQSafe}</span>
        </div>
      </div>
    </div>
  `;

  pinElem._osdTracker = new window.OpenSeadragon.MouseTracker({
    element: pinElem,
    clickHandler: (e) => {
      if (e?.originalEvent) { e.originalEvent.stopPropagation(); e.originalEvent.preventDefault(); }
      alternarAbaPainel("questoes");
      destacarCardQuestaoNaSidebar(idBuscado);
      if (isMobileOrLandscapeDrawer()) {
        aplicarEstadoSidebar(false, false);
      }
    }
  });

  viewer.addOverlay({
    element: pinElem,
    location: pontoViewport,
    placement: window.OpenSeadragon.Placement.CENTER
  });

  overlayQuestaoAtiva = pinElem;
  questaoAtivaId = idBuscado;

  // Pan & Zoom com centralização precisa ancorada na questão
  let targetZoom = (q.zoom && Number(q.zoom) > 0)
    ? Number(q.zoom)
    : Math.max(viewer.viewport.getZoom(), (homeZoomRef || 1) * 3.5);

  if (viewer.viewport.maxZoomLevel) {
    targetZoom = Math.min(targetZoom, viewer.viewport.maxZoomLevel * 0.95);
  }
  if (viewer.viewport.minZoomLevel) {
    targetZoom = Math.max(targetZoom, viewer.viewport.minZoomLevel);
  }

  viewer.viewport.zoomTo(targetZoom, pontoViewport, false);
  viewer.viewport.panTo(pontoViewport, false);
  viewer.viewport.applyConstraints();
}

// ---------------------------------------------------------------------------
// 9. Controles de navegação e ampliação (zoom, reset, center)
// ---------------------------------------------------------------------------
export function alterarZoom(fator) {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;
  const currentZoom = viewer.viewport.getZoom();
  let targetZoom  = currentZoom * (Number(fator) || 1.25);
  if (viewer.viewport.minZoomLevel) targetZoom = Math.max(viewer.viewport.minZoomLevel, targetZoom);
  if (viewer.viewport.maxZoomLevel) targetZoom = Math.min(viewer.viewport.maxZoomLevel, targetZoom);
  viewer.viewport.zoomTo(targetZoom, null, false);
}

export function osdViewerAction(acao) {
  if (!viewer || !viewer.viewport) return;
  const acaoNorm = String(acao).toLowerCase();
  if      (acaoNorm === "zoomin")  alterarZoom(1.35);
  else if (acaoNorm === "zoomout") alterarZoom(0.75);
  else if (acaoNorm === "reset" || acaoNorm === "home") {
    trocarLente(4);
  }
  else if (acaoNorm === "center")   viewer.viewport.panTo(viewer.viewport.getCenter());
  else if (acaoNorm === "fullpage") viewer.setFullPage(!viewer.isFullPage());
}

// ---------------------------------------------------------------------------
// 9.5 Trocar Lente Objetiva — zoom baseado no modelo ótico proporcional
// ---------------------------------------------------------------------------
export function trocarLente(objetivaDesejada, btnElement) {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;

  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
  const magDesejada = Number(objetivaDesejada) || 4;
  const magClamped = Math.max(4, Math.min(maxMag, magDesejada));

  const targetZoom = calcularZoomParaMagnificacao(magClamped);

  if (magClamped <= 4) {
    // Ao voltar para 4x (visao panoramica com margens pretas), centraliza a lamina
    const imgBounds = viewer.world.getItemAt(0)?.getBounds();
    const centerPoint = imgBounds ? imgBounds.getCenter() : viewer.viewport.getCenter();
    viewer.viewport.zoomTo(targetZoom, null, false);
    viewer.viewport.panTo(centerPoint, false);
  } else {
    viewer.viewport.zoomTo(targetZoom, null, false);
  }

  const targetBtn = btnElement || document.querySelector(`.lens-btn[data-mag="${magClamped}"]`) || Array.from(document.querySelectorAll(".lens-btn")).find(b => b.textContent.trim() === `${magClamped}x`);

  document.querySelectorAll(".lens-btn").forEach(l => {
    if (l.disabled) return;
    l.className = LENS_BTN_IDLE_CLS;
  });

  if (targetBtn && !targetBtn.disabled) {
    targetBtn.className = LENS_BTN_ACTIVE_CLS;
  }

  // Em telas compactas, centraliza suavemente o botão da objetiva ativada no revólver sem rolar a janela
  if (targetBtn) {
    const panel = document.getElementById("viewerLensPanel");
    if (panel && panel.scrollWidth > panel.clientWidth) {
      const scrollPos = targetBtn.offsetLeft - panel.offsetLeft - (panel.clientWidth / 2) + (targetBtn.clientWidth / 2);
      panel.scrollTo({ left: Math.max(0, scrollPos), behavior: "smooth" });
    }
  }
}

// ---------------------------------------------------------------------------
// 10. Exibir mensagem de erro no container do viewer
// ---------------------------------------------------------------------------
function exibirErroMicroscopio(msg) {
  const skeleton = document.getElementById("osdSkeleton");
  if (skeleton) {
    skeleton.style.opacity = '0';
    skeleton.style.pointerEvents = 'none';
    skeleton.style.display = 'none';
    skeleton.classList.add("hidden");
    skeleton.classList.remove("flex");
  }
  const tituloEl = document.getElementById("slideTitle");
  if (tituloEl) tituloEl.textContent = "Lâmina Indisponível";
  const descEl = document.getElementById("slideDescriptionContainer");
  if (descEl) descEl.innerHTML = `<p class="text-slate-500 italic text-sm font-sans">Não foi possível recuperar os dados morfológicos desta peça.</p>`;
  listaQuestoesAtual = [];
  atualizarBadgeContadorQuestoes();
  renderizarQuestoesNaSidebar([]);

  const container = document.getElementById("osd-viewer");
  if (!container) return;
  container.classList.remove("opacity-0");
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full text-center gap-4 p-8">
      <div class="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shadow-sm">
        <svg class="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-slate-900 tracking-wide">Falha no Carregamento</h3>
        <p class="text-rose-600 text-xs font-mono max-w-sm leading-relaxed">${escaparHTML(String(msg || ""))}</p>
      </div>
      <div class="flex items-center gap-3 mt-3">
        <button type="button" onclick="window.location.reload()" class="px-4 py-2 text-xs font-mono font-medium text-white bg-teal-700 hover:bg-teal-800 border border-teal-700 rounded-xl transition-all cursor-pointer shadow-sm">
          Recarregar
        </button>
        <a href="index.html" class="px-4 py-2 text-xs font-mono font-medium text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-sm">
          Voltar ao Início
        </a>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 11. Régua Morfométrica, Deep Link, Tela Cheia, Atalhos e Troca Rápida
// ---------------------------------------------------------------------------

function exibirToastViewer(mensagem, duracaoMs = 2400) {
  const toast = document.getElementById("viewerToast");
  if (!toast) return;
  toast.textContent = String(mensagem || "");
  toast.classList.remove("hidden", "opacity-0");
  toast.classList.add("opacity-100");
  if (_viewerToastTimer) clearTimeout(_viewerToastTimer);
  _viewerToastTimer = setTimeout(() => {
    toast.classList.remove("opacity-100");
    toast.classList.add("opacity-0");
    setTimeout(() => {
      if (toast.classList.contains("opacity-0")) {
        toast.classList.add("hidden");
      }
    }, 200);
  }, duracaoMs);
}

function obterMppAtivo() {
  if (!laminaAtualData || laminaAtualData._usingPreviewFallback) return null;
  const mpp = Number(laminaAtualData.mpp);
  return Number.isFinite(mpp) && mpp > 0 ? mpp : null;
}

function atualizarBotaoRegua() {
  const btns = [
    document.getElementById("btnToggleRegua"),
    document.getElementById("btnReguaMobileContext")
  ].filter(Boolean);
  if (btns.length === 0) return;

  const mpp = obterMppAtivo();
  btns.forEach((btn) => {
    if (!mpp) {
      btn.disabled = true;
      btn.classList.remove("is-on");
      btn.classList.add("is-off");
      btn.setAttribute("aria-pressed", "false");
      btn.title = "Régua indisponível sem calibração óptica";
      return;
    }
    btn.disabled = false;
    btn.classList.toggle("is-on", modoReguaAtivo);
    btn.classList.toggle("is-off", !modoReguaAtivo);
    btn.setAttribute("aria-pressed", String(modoReguaAtivo));
    btn.title = modoReguaAtivo
      ? "Desativar régua morfométrica (D)"
      : "Régua morfométrica em micrômetros (D)";
  });
}

function atualizarBannerRegua(texto, mostrarLimpar = false) {
  const banner = document.getElementById("reguaBanner");
  const txtEl = document.getElementById("reguaBannerTexto");
  const btnLimpar = document.getElementById("btnLimparRegua");
  if (txtEl && texto !== undefined) txtEl.textContent = texto;
  if (btnLimpar) btnLimpar.classList.toggle("hidden", !mostrarLimpar);
  if (banner && modoReguaAtivo) {
    banner.classList.remove("hidden");
  }
}

export function limparMedicaoRegua() {
  if (_reguaPointerRaf) {
    cancelAnimationFrame(_reguaPointerRaf);
    _reguaPointerRaf = null;
  }
  if (overlayRegua) {
    removerOverlayComSeguranca(overlayRegua);
    overlayRegua = null;
  }
  reguaPontoA = null;
  reguaPontoB = null;
  _reguaOverlayIsPreview = false;
  if (modoReguaAtivo) {
    atualizarBannerRegua("Clique no ponto inicial na lâmina (Esc para sair)", false);
  }
}

export function toggleReguaMorfometrica(forcarEstado) {
  const mpp = obterMppAtivo();
  const proximoEstado = typeof forcarEstado === "boolean" ? forcarEstado : !modoReguaAtivo;

  if (proximoEstado && !mpp) {
    exibirToastViewer("Régua indisponível nesta imagem sem calibração óptica.");
    atualizarBotaoRegua();
    return;
  }

  modoReguaAtivo = proximoEstado;

  const osdEl = document.getElementById("osd-viewer");
  if (osdEl) {
    osdEl.classList.toggle("cursor-crosshair", modoReguaAtivo);
  }
  if (viewer) {
    if (viewer.gestureSettingsMouse) viewer.gestureSettingsMouse.dblClickToZoom = !modoReguaAtivo;
    if (viewer.gestureSettingsTouch) viewer.gestureSettingsTouch.dblClickToZoom = !modoReguaAtivo;
  }

  const banner = document.getElementById("reguaBanner");
  if (modoReguaAtivo) {
    if (banner) banner.classList.remove("hidden");
    if (reguaPontoA && reguaPontoB) {
      const distUm = Math.hypot(reguaPontoB.x - reguaPontoA.x, reguaPontoB.y - reguaPontoA.y) * mpp;
      atualizarBannerRegua(`Medida: ${formatarComprimento(distUm)} — clique em outro ponto para nova medição`, true);
    } else if (reguaPontoA) {
      atualizarBannerRegua("Clique no ponto final para medir", false);
    } else {
      atualizarBannerRegua("Clique no ponto inicial na lâmina (Esc para sair)", false);
    }
  } else {
    limparMedicaoRegua();
    if (banner) banner.classList.add("hidden");
  }

  atualizarBotaoRegua();
}

function renderizarOverlayRegua(pA, pB, isPreview = false) {
  if (!viewer || !viewer.viewport || !window.OpenSeadragon) return null;
  const mpp = obterMppAtivo();
  if (!mpp) return null;

  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  const distPx = Math.hypot(dx, dy);
  const distUm = distPx * mpp;
  const label = distUm > 0 ? formatarComprimento(distUm) : "0,0 µm";

  const pad = Math.max(40, distPx * 0.25);
  const minX = Math.min(pA.x, pB.x) - pad;
  const minY = Math.min(pA.y, pB.y) - pad;
  const maxX = Math.max(pA.x, pB.x) + pad;
  const maxY = Math.max(pA.y, pB.y) + pad;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);

  const imgRect = new window.OpenSeadragon.Rect(minX, minY, w, h);
  const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);

  const svgX1 = pA.x - minX;
  const svgY1 = pA.y - minY;
  const svgX2 = pB.x - minX;
  const svgY2 = pB.y - minY;
  const pctX1 = (svgX1 / w) * 100;
  const pctY1 = (svgY1 / h) * 100;
  const pctX2 = (svgX2 / w) * 100;
  const pctY2 = (svgY2 / h) * 100;
  const midPctX = ((svgX1 + svgX2) / 2 / w) * 100;
  const midPctY = ((svgY1 + svgY2) / 2 / h) * 100;

  const html = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="w-full h-full overflow-visible" style="pointer-events:none; filter:drop-shadow(0 1px 3px rgba(15,23,42,0.5));">
      <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="#ffffff" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" ${isPreview ? 'stroke-dasharray="6 4"' : ''} />
      <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="#0369a1" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" ${isPreview ? 'stroke-dasharray="6 4"' : ''} />
    </svg>
    <div style="position:absolute; left:${pctX1}%; top:${pctY1}%; transform:translate(-50%, -50%); width:10px; height:10px; border-radius:9999px; background:#0369a1; border:2px solid #ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.5); pointer-events:none;"></div>
    <div style="position:absolute; left:${pctX2}%; top:${pctY2}%; transform:translate(-50%, -50%); width:10px; height:10px; border-radius:9999px; background:#0369a1; border:2px solid #ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.5); pointer-events:none;"></div>
    <div style="position:absolute; left:${midPctX}%; top:${midPctY}%; transform:translate(-50%, calc(-100% - 10px)); z-index:4; pointer-events:${isPreview ? 'none' : 'auto'};">
      <div class="viewer-ruler-pill">
        <span>${escaparHTML(label)}</span>
        ${!isPreview ? `<button type="button" data-ruler-clear="1" class="viewer-ruler-clear-btn" aria-label="Limpar medição" title="Limpar medição">&times;</button>` : ''}
      </div>
    </div>
  `;

  if (isPreview && overlayRegua && _reguaOverlayIsPreview) {
    overlayRegua.innerHTML = html;
    try {
      viewer.updateOverlay(overlayRegua, vpRect);
    } catch (e) {}
    return label;
  }

  if (overlayRegua) {
    removerOverlayComSeguranca(overlayRegua);
    overlayRegua = null;
  }

  const elem = document.createElement("div");
  elem.id = "viewer-ruler-overlay";
  elem.style.cssText = "pointer-events:none; position:relative; width:100%; height:100%; z-index:45;";
  elem.innerHTML = html;

  viewer.addOverlay({
    element: elem,
    location: vpRect
  });

  if (!isPreview) {
    const clearBtn = elem.querySelector('[data-ruler-clear="1"]');
    if (clearBtn) {
      elem._osdTracker = new window.OpenSeadragon.MouseTracker({
        element: clearBtn,
        clickHandler: (e) => {
          if (e?.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          limparMedicaoRegua();
        }
      });
    }
  }

  overlayRegua = elem;
  _reguaOverlayIsPreview = isPreview;
  return label;
}

function handleCanvasClickRegua(ev) {
  if (!modoReguaAtivo || !ev || !ev.quick || !viewer || !viewer.viewport || !ev.position) return;
  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  if (!item) return;

  const vpPt = viewer.viewport.pointFromPixel(ev.position);
  const imgPt = item.viewportToImageCoordinates(vpPt);
  if (!imgPt || !Number.isFinite(imgPt.x) || !Number.isFinite(imgPt.y)) return;

  if (!reguaPontoA || (reguaPontoA && reguaPontoB)) {
    if (overlayRegua) {
      removerOverlayComSeguranca(overlayRegua);
      overlayRegua = null;
      _reguaOverlayIsPreview = false;
    }
    reguaPontoA = { x: imgPt.x, y: imgPt.y };
    reguaPontoB = null;
    atualizarBannerRegua("Clique no ponto final para medir", false);
  } else {
    if (_reguaPointerRaf) {
      cancelAnimationFrame(_reguaPointerRaf);
      _reguaPointerRaf = null;
    }
    reguaPontoB = { x: imgPt.x, y: imgPt.y };
    const label = renderizarOverlayRegua(reguaPontoA, reguaPontoB, false);
    atualizarBannerRegua(`Medida: ${label || "—"} — clique novamente para nova medição`, true);
  }
}

function handlePointerMoveRegua(e) {
  if (!modoReguaAtivo || !reguaPontoA || reguaPontoB || !viewer || !viewer.canvas || !viewer.viewport) return;
  if (_reguaPointerRaf) return;
  const clientX = e.clientX;
  const clientY = e.clientY;

  _reguaPointerRaf = requestAnimationFrame(() => {
    _reguaPointerRaf = null;
    if (!modoReguaAtivo || !reguaPontoA || reguaPontoB || !viewer || !viewer.canvas) return;
    const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
    if (!item) return;

    const rect = viewer.canvas.getBoundingClientRect();
    const webPt = new window.OpenSeadragon.Point(clientX - rect.left, clientY - rect.top);
    const vpPt = viewer.viewport.pointFromPixel(webPt);
    const imgPt = item.viewportToImageCoordinates(vpPt);
    if (!imgPt || !Number.isFinite(imgPt.x) || !Number.isFinite(imgPt.y)) return;

    renderizarOverlayRegua(reguaPontoA, { x: imgPt.x, y: imgPt.y }, true);
  });
}

export async function copiarLinkCampoAtual() {
  if (!viewer || !viewer.viewport || !laminaAtualData) return null;
  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  if (!item || typeof item.getContentSize !== "function") return null;

  const cs = item.getContentSize();
  const centerVp = viewer.viewport.getCenter(true);
  const imgPt = item.viewportToImageCoordinates(centerVp);
  const nx = cs.x > 0 ? Math.max(0, Math.min(1, imgPt.x / cs.x)).toFixed(4) : "0.5000";
  const ny = cs.y > 0 ? Math.max(0, Math.min(1, imgPt.y / cs.y)).toFixed(4) : "0.5000";
  const magRaw = calcularMagnificacaoOtica();
  const mag = Number(magRaw.toFixed(1));

  const params = new URLSearchParams();
  if (laminaAtualData.id === "local-dzi" && laminaAtualData.imagemUrl) {
    params.set("dzi", laminaAtualData.imagemUrl);
  } else {
    params.set("id", laminaAtualData.id || "");
  }
  params.set("x", nx);
  params.set("y", ny);
  params.set("mag", String(mag));
  if (pinAtivo) {
    params.set("pin", pinAtivo);
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  window.__lastCopiedSlideUrl = shareUrl;

  let copied = false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    }
  } catch (e) {}

  if (!copied) {
    try {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }

  exibirToastViewer(copied ? "Link do campo copiado" : "Link preparado na barra de endereço");
  return shareUrl;
}

function atualizarBotaoFullscreen() {
  const btn = document.getElementById("btnFullscreen");
  if (!btn) return;
  const isFs = Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    (viewer && typeof viewer.isFullPage === "function" && viewer.isFullPage())
  );
  btn.setAttribute("aria-pressed", String(isFs));
  btn.title = isFs ? "Sair da tela cheia (F)" : "Tela cheia (F)";
  const expandIcon = btn.querySelector("[data-fs-expand]");
  const compressIcon = btn.querySelector("[data-fs-compress]");
  if (expandIcon) expandIcon.classList.toggle("hidden", isFs);
  if (compressIcon) compressIcon.classList.toggle("hidden", !isFs);
}

export async function toggleTelaCheiaMicroscopio() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  try {
    if (!isFs) {
      const docEl = document.documentElement;
      if (typeof docEl.requestFullscreen === "function") {
        await docEl.requestFullscreen();
      } else if (typeof docEl.webkitRequestFullscreen === "function") {
        docEl.webkitRequestFullscreen();
      } else {
        osdViewerAction("fullpage");
      }
    } else {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      } else if (typeof document.webkitExitFullscreen === "function") {
        document.webkitExitFullscreen();
      } else {
        osdViewerAction("fullpage");
      }
    }
  } catch (err) {
    osdViewerAction("fullpage");
  }
  atualizarBotaoFullscreen();
}

function registrarControleFullscreenMicroscopio() {
  if (_fullscreenRegistrado) return;
  _fullscreenRegistrado = true;
  const onFsChange = () => {
    atualizarBotaoFullscreen();
    setTimeout(sincronizarTamanhoDoViewer, 60);
  };
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
}

export function navegarPinoAdjacente(direcao = 1) {
  if (!Array.isArray(listaPinosAtual) || listaPinosAtual.length === 0) return;
  const dir = direcao >= 0 ? 1 : -1;
  const currentIdx = pinAtivo
    ? listaPinosAtual.findIndex(p => String(p.id || "").toLowerCase() === String(pinAtivo).toLowerCase())
    : -1;
  const nextIdx = currentIdx === -1
    ? (dir === 1 ? 0 : listaPinosAtual.length - 1)
    : (currentIdx + dir + listaPinosAtual.length) % listaPinosAtual.length;
  const targetPin = listaPinosAtual[nextIdx];
  if (targetPin) {
    if (abaAtivaPainel !== "descricao") alternarAbaPainel("descricao");
    focarPinoNoViewer(targetPin.id || nextIdx + 1);
  }
}

export function definirTomPlatina(tone, persistir = true) {
  const proximo = tone === "bright" ? "bright" : "neutral";
  stageToneAtual = proximo;
  const stage = document.getElementById("viewerStage");
  if (stage) stage.setAttribute("data-stage-tone", proximo);

  document.querySelectorAll("[data-stage-tone-btn]").forEach((btn) => {
    const val = btn.getAttribute("data-stage-tone-btn");
    const ativo = val === proximo;
    btn.classList.toggle("bg-white", ativo);
    btn.classList.toggle("text-slate-900", ativo);
    btn.classList.toggle("font-semibold", ativo);
    btn.classList.toggle("shadow-2xs", ativo);
    btn.classList.toggle("text-slate-600", !ativo);
    btn.classList.toggle("font-medium", !ativo);
    btn.setAttribute("aria-pressed", String(ativo));
  });

  if (persistir) {
    try { localStorage.setItem(STAGE_TONE_STORAGE_KEY, proximo); } catch (e) {}
  }
}

function inicializarTomPlatina() {
  let salvo = "neutral";
  try {
    const raw = localStorage.getItem(STAGE_TONE_STORAGE_KEY);
    if (raw === "bright" || raw === "neutral") salvo = raw;
  } catch (e) {}
  definirTomPlatina(salvo, false);
}

function aplicarEstadoMinimap(recolhido, persistir = true) {
  minimapRecolhido = Boolean(recolhido);
  const stage = document.getElementById("viewerStage");
  const btn = document.getElementById("btnToggleMinimap");
  const label = document.getElementById("minimapToggleLabel");
  if (stage) stage.setAttribute("data-minimap-collapsed", String(minimapRecolhido));
  if (btn) btn.setAttribute("aria-expanded", String(!minimapRecolhido));
  if (label) label.textContent = minimapRecolhido ? "Mostrar Mapa" : "Mapa";

  const navElem = viewer?.navigator?.element;
  if (navElem) {
    navElem.style.display = minimapRecolhido ? "none" : "inline-block";
    if (!minimapRecolhido && viewer?.navigator) {
      requestAnimationFrame(() => {
        try {
          if (typeof viewer.navigator.updateSize === "function") viewer.navigator.updateSize();
          if (typeof viewer.navigator.update === "function" && viewer.viewport) {
            viewer.navigator.update(viewer.viewport);
          }
          if (typeof viewer.forceRedraw === "function") viewer.forceRedraw();
        } catch (e) {}
      });
    }
  }

  if (persistir) {
    try { localStorage.setItem(MINIMAP_STORAGE_KEY, minimapRecolhido ? "1" : "0"); } catch (e) {}
  }
}

export function toggleMinimap(forcar) {
  const proximo = typeof forcar === "boolean" ? forcar : !minimapRecolhido;
  aplicarEstadoMinimap(proximo, true);
}

function inicializarMinimapControle() {
  let recolhido = window.innerWidth < 640;
  try {
    const salvo = localStorage.getItem(MINIMAP_STORAGE_KEY);
    if (salvo === "1" || salvo === "0") {
      recolhido = salvo === "1";
    }
  } catch (e) {}
  aplicarEstadoMinimap(recolhido, false);
}

export function toggleModoBancada(forcar) {
  const proximo = typeof forcar === "boolean" ? forcar : !modoBancadaAtivo;
  modoBancadaAtivo = proximo;

  document.documentElement.classList.toggle("bancada-mode", proximo);
  document.body.classList.toggle("bancada-mode", proximo);

  const btnDesk = document.getElementById("btnModoBancada");
  const lblDesk = document.getElementById("btnModoBancadaLabel");
  const btnMob  = document.getElementById("btnBancadaMobileContext");
  const lblMore = document.getElementById("mobileMenuBancadaLabel");

  if (btnDesk) {
    btnDesk.setAttribute("aria-pressed", String(proximo));
    btnDesk.classList.toggle("bg-slate-900", proximo);
    btnDesk.classList.toggle("text-white", proximo);
    btnDesk.classList.toggle("border-slate-900", proximo);
    btnDesk.classList.toggle("bg-slate-100/90", !proximo);
    btnDesk.classList.toggle("text-slate-700", !proximo);
    btnDesk.classList.toggle("border-slate-200/90", !proximo);
  }
  if (lblDesk) lblDesk.textContent = proximo ? "Sair da Bancada" : "Modo Bancada";
  if (btnMob) {
    btnMob.setAttribute("aria-pressed", String(proximo));
    btnMob.classList.toggle("bg-slate-900", proximo);
    btnMob.classList.toggle("text-white", proximo);
    btnMob.classList.toggle("border-slate-900", proximo);
    btnMob.classList.toggle("bg-slate-100", !proximo);
    btnMob.classList.toggle("text-slate-700", !proximo);
  }
  if (lblMore) lblMore.textContent = proximo ? "Sair do Modo Bancada" : "Modo Bancada";

  setTimeout(sincronizarTamanhoDoViewer, 40);
}

function inicializarModoBancada() {
  const params = new URLSearchParams(window.location.search);
  const bancadaParam = params.get("bancada") === "1";
  toggleModoBancada(bancadaParam);
}

export function toggleLaminarioRapido(forcar, anchorEl) {
  const popover = document.getElementById("popoverLaminarioRapido");
  const btnDesk = document.getElementById("btnLaminarioRapido");
  const chevron = document.getElementById("laminarioChevron");
  if (!popover) return;

  const isHidden = popover.classList.contains("hidden");
  const abrir = typeof forcar === "boolean" ? forcar : isHidden;

  if (!abrir) {
    popover.classList.add("hidden");
    if (btnDesk) btnDesk.setAttribute("aria-expanded", "false");
    if (chevron) chevron.classList.remove("rotate-180");
    return;
  }

  toggleMobileMoreMenu(false);
  toggleAjudaMicroscopio(false);
  renderizarListaLaminarioRapido();

  const refEl = anchorEl || (window.innerWidth >= 768 ? btnDesk : document.getElementById("btnLaminarioMobile"));
  if (refEl) {
    const rect = refEl.getBoundingClientRect();
    const popWidth = Math.min(356, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popWidth - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 160);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.width = `${Math.round(popWidth)}px`;
  }

  popover.classList.remove("hidden");
  if (btnDesk) btnDesk.setAttribute("aria-expanded", "true");
  if (chevron) chevron.classList.add("rotate-180");
}

export function toggleMobileMoreMenu(forcar) {
  const popover = document.getElementById("popoverMobileMore");
  const btn = document.getElementById("btnMobileMore");
  if (!popover) return;
  const abrir = typeof forcar === "boolean" ? forcar : popover.classList.contains("hidden");
  if (abrir) {
    toggleLaminarioRapido(false);
    toggleAjudaMicroscopio(false);
    popover.classList.remove("hidden");
    if (btn) btn.setAttribute("aria-expanded", "true");
  } else {
    popover.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
}

function registrarControlesPopoversHeader() {
  if (_popoversRegistrados) return;
  _popoversRegistrados = true;

  document.addEventListener("click", (e) => {
    const popLam = document.getElementById("popoverLaminarioRapido");
    if (popLam && !popLam.classList.contains("hidden")) {
      const btnDesk = document.getElementById("btnLaminarioRapido");
      const btnMob  = document.getElementById("btnLaminarioMobile");
      if (!popLam.contains(e.target) && !btnDesk?.contains(e.target) && !btnMob?.contains(e.target)) {
        toggleLaminarioRapido(false);
      }
    }

    const contMore = document.getElementById("containerMobileMore");
    const popMore  = document.getElementById("popoverMobileMore");
    if (contMore && popMore && !popMore.classList.contains("hidden") && !contMore.contains(e.target)) {
      toggleMobileMoreMenu(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleLaminarioRapido(false);
      toggleMobileMoreMenu(false);
    }
  });
}

function registrarAtalhosTecladoMicroscopio() {
  if (_atalhosRegistrados) return;
  _atalhosRegistrados = true;

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement;
    if (active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable
    )) {
      return;
    }

    const key = e.key;
    const lower = key ? key.toLowerCase() : "";

    const lensMap = { "1": 4, "2": 10, "3": 40, "4": 60, "5": 100 };
    if (key in lensMap) {
      const mag = lensMap[key];
      if (mag <= getMaxMagLamina()) {
        e.preventDefault();
        trocarLente(mag);
      }
      return;
    }

    if (key === "+" || key === "=") {
      e.preventDefault();
      alterarZoom(1.35);
      return;
    }
    if (key === "-" || key === "_") {
      e.preventDefault();
      alterarZoom(0.75);
      return;
    }
    if (lower === "r" || key === "0") {
      e.preventDefault();
      osdViewerAction("home");
      return;
    }
    if (lower === "m") {
      e.preventDefault();
      toggleMarcacoesNoViewer();
      return;
    }
    if (lower === "d") {
      e.preventDefault();
      toggleReguaMorfometrica();
      return;
    }
    if (lower === "p") {
      e.preventDefault();
      const sidebar = document.getElementById("viewerSidebar");
      if (sidebar) aplicarEstadoSidebar(!sidebar.classList.contains("w-0"), true);
      return;
    }
    if (lower === "b") {
      e.preventDefault();
      toggleModoBancada();
      return;
    }
    if (lower === "n") {
      e.preventDefault();
      toggleMinimap();
      return;
    }
    if (lower === "f") {
      e.preventDefault();
      toggleTelaCheiaMicroscopio();
      return;
    }
    if (key === "ArrowRight" || key === "ArrowLeft") {
      if (Array.isArray(listaPinosAtual) && listaPinosAtual.length > 0) {
        e.preventDefault();
        navegarPinoAdjacente(key === "ArrowRight" ? 1 : -1);
      }
      return;
    }
    if (key === "Escape") {
      if (modoReguaAtivo) {
        toggleReguaMorfometrica(false);
      } else if (pinAtivo) {
        limparFocoPinoAtivo();
      }
    }
  });
}

const CATALOGO_BASE_SWITCHER = [
  {
    id: "cw3XGCgUwN71XdlwkUe5",
    nome: "Osso Maduro 40x",
    subtitulo: "Ósteons, canalículos e linhas cimentantes",
    topicoTitulo: "Tecido Ósseo Compacto e Esponjoso",
    meta: "Desgaste • 40x",
    maxMag: 40,
    previewImage: "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg",
    aliases: ["osso_maduro_desgaste_ct_3.0", "osso_3.0", "osso-3.0"]
  },
  {
    id: "FFGk5d9kOAct5HIDdjQ7",
    nome: "Osso Maduro 10x",
    subtitulo: "Visão panorâmica e topografia cortical",
    topicoTitulo: "Tecido Ósseo Compacto e Esponjoso",
    meta: "Desgaste • 10x",
    maxMag: 10,
    previewImage: "assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg",
    aliases: ["osso_maduro_desgaste_ct_2.0", "osso_2.0", "osso-2.0"]
  },
  {
    id: "96ZYqoM2SV8p4fB2QgeM",
    nome: "Osso Maduro",
    subtitulo: "Sistemas de Havers e canalículos",
    topicoTitulo: "Tecido Ósseo Compacto e Esponjoso",
    meta: "Desgaste • 40x",
    maxMag: 40,
    previewImage: "assets/histologia/osso_maduro_desgaste_ct-preview.jpg",
    aliases: ["osso_maduro_desgaste_ct", "osso-maduro", "osso_maduro"]
  },
  {
    id: "a3oRvXvJpMKAtU2RE85q",
    nome: "Pele Espessa",
    subtitulo: "Epiderme queratinizada e Derme papilar",
    topicoTitulo: "Tecido Epitelial de Revestimento e Glandular",
    meta: "H&E • 40x",
    maxMag: 40,
    previewImage: "assets/histologia/lamina-real1-preview.jpg",
    aliases: ["lamina-real1", "lamina-real-1", "pele_espessa", "pele-espessa"]
  }
];

function resolverIdCanonicoSwitcher(slideId) {
  const alvo = String(slideId || "").trim().toLowerCase();
  if (!alvo) return "";
  const match = _catalogoLaminasSwitcher.find(item =>
    String(item.id).toLowerCase() === alvo ||
    (Array.isArray(item.aliases) && item.aliases.some(a => String(a).toLowerCase() === alvo))
  );
  return match ? match.id : String(slideId).trim();
}

function formatarBadgeTecnica(rawMeta, maxMag) {
  const base = String(rawMeta || "").trim() || "Histologia";
  const magNum = Number(maxMag) || 40;
  if (/\b\d+x\b/i.test(base)) return base;
  return `${base} • ${magNum}x`;
}

function renderizarListaLaminarioRapido() {
  const listEl = document.getElementById("laminarioListaOpcoes");
  const totalEl = document.getElementById("laminarioTotalBadge");
  if (!listEl) return;

  const activeId = resolverIdCanonicoSwitcher(laminaAtualData?.id || "");
  if (totalEl) {
    const n = _catalogoLaminasSwitcher.length;
    totalEl.textContent = `${n} ${n === 1 ? "lâmina" : "lâminas"}`;
  }

  listEl.innerHTML = _catalogoLaminasSwitcher.map((item) => {
    const isAtiva = item.id === activeId;
    const thumb = isSafeSlideUrl(item.previewImage) ? item.previewImage : "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
    const idSafe = escaparHTML(item.id);
    const nomeSafe = escaparHTML(item.nome);
    const metaSafe = escaparHTML(formatarBadgeTecnica(item.meta, item.maxMag));
    const subSafe = escaparHTML(item.subtitulo || item.topicoTitulo || "Histologia");

    return `
      <button
        type="button"
        data-laminario-id="${idSafe}"
        class="w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-all cursor-pointer ${
          isAtiva
            ? "bg-teal-50/90 border-teal-300 shadow-2xs"
            : "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300"
        }"
      >
        <img src="${escaparHTML(thumb)}" alt="${nomeSafe}" class="w-14 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold ${isAtiva ? "text-teal-950" : "text-slate-900"} truncate">${nomeSafe}</span>
            <span class="palas-mono-tech text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">${metaSafe}</span>
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">${subSafe}</p>
        </div>
        ${isAtiva ? `
          <span class="w-2 h-2 rounded-full bg-[#0f766e] shrink-0" title="Em visualização"></span>
        ` : ""}
      </button>
    `;
  }).join("");

  if (!listEl.__bound) {
    listEl.__bound = true;
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-laminario-id]");
      if (!btn) return;
      const targetId = btn.getAttribute("data-laminario-id");
      toggleLaminarioRapido(false);
      if (targetId) trocarLaminaNoViewer(targetId);
    });
  }
}

function atualizarNavegacaoRodapeSidebar() {
  const prevBtn  = document.getElementById("btnLaminaAnterior");
  const prevName = document.getElementById("btnLaminaAnteriorNome");
  const nextBtn  = document.getElementById("btnLaminaProxima");
  const nextName = document.getElementById("btnLaminaProximaNome");
  if (!prevBtn && !nextBtn) return;

  const pool = _catalogoLaminasSwitcher;
  if (!pool || pool.length < 2) return;

  const activeId = resolverIdCanonicoSwitcher(laminaAtualData?.id || "");
  const idx = pool.findIndex(item => item.id === activeId);
  const currentIdx = idx >= 0 ? idx : 0;
  const prevItem = pool[(currentIdx - 1 + pool.length) % pool.length];
  const nextItem = pool[(currentIdx + 1) % pool.length];

  if (prevName && prevItem) prevName.textContent = prevItem.nome;
  if (nextName && nextItem) nextName.textContent = nextItem.nome;
}

export function navegarLaminaAdjacente(direcao = 1) {
  const pool = _catalogoLaminasSwitcher;
  if (!pool || pool.length < 2) return;
  const activeId = resolverIdCanonicoSwitcher(laminaAtualData?.id || "");
  const idx = pool.findIndex(item => item.id === activeId);
  const currentIdx = idx >= 0 ? idx : 0;
  const step = direcao >= 0 ? 1 : -1;
  const target = pool[(currentIdx + step + pool.length) % pool.length];
  if (target && target.id) {
    trocarLaminaNoViewer(target.id);
  }
}

function atualizarCertidaoOpticaUI() {
  if (!laminaAtualData) return;
  const cert = certidaoOpticaAtual || laminaAtualData.certidaoOptica;
  const maxMag = Number(cert?.ampliacaoMaxima || laminaAtualData.maxMagnification || laminaAtualData.maxMag || 40);
  const mpp = Number(cert?.mppEfetivo || laminaAtualData.mpp || (40 / maxMag) * 0.156);
  const dims = getDziDimensions();

  let areaTexto = "—";
  let dimTexto = "Pirâmide DZI multiescala";
  if (dims && dims.largura > 0 && dims.altura > 0) {
    const largMm = ((dims.largura * mpp) / 1000).toFixed(2).replace(".", ",");
    const altMm  = ((dims.altura * mpp) / 1000).toFixed(2).replace(".", ",");
    const mp     = ((dims.largura * dims.altura) / 1e6).toFixed(1).replace(".", ",");
    areaTexto = `${largMm} × ${altMm} mm`;
    dimTexto  = `${dims.largura.toLocaleString("pt-BR")} × ${dims.altura.toLocaleString("pt-BR")} px (${mp} MP)`;
  }

  const entryCatalogo = obterCatalogoEntryAtual();
  const rawColor = laminaAtualData.coloracao;
  const tecnicaTexto = !isColoracaoGenerica(rawColor)
    ? rawColor
    : (entryCatalogo?.meta || "Preparação Histológica");

  const objTexto = `${maxMag}x`;
  const resTexto = `${mpp.toFixed(3).replace(".", ",")} µm/px`;
  const metodo = String(cert?.metodo || laminaAtualData?.metodoCalibracao || "").toLowerCase();
  let seloRotulo = "Calibração óptica";
  if (cert?.selo === "verificada" || cert?.selo === "estimada") {
    seloRotulo = ROTULOS_SELO[cert.selo] || "Calibração óptica";
  }

  // Cards da Seção Inferior
  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setTxt("certObjValor", objTexto);
  setTxt("certObjDetalhe", "Captura em resolução nativa");
  setTxt("certResValor", resTexto);
  setTxt("certResDetalhe", metodo.includes("hemacia") ? "Calibração por hemácia (7,5 µm)" : seloRotulo);
  setTxt("certAreaValor", areaTexto);
  setTxt("certAreaDetalhe", dimTexto);
  setTxt("certTecValor", tecnicaTexto);
}

function renderizarAcervoRelacionado() {
  const grid = document.getElementById("acervoRelacionadoGrid");
  if (!grid) return;

  const activeId = resolverIdCanonicoSwitcher(laminaAtualData?.id || "");
  grid.innerHTML = _catalogoLaminasSwitcher.map((item) => {
    const isAtiva = item.id === activeId;
    const thumb = isSafeSlideUrl(item.previewImage) ? item.previewImage : "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
    const idSafe = escaparHTML(item.id);
    const nomeSafe = escaparHTML(item.nome);
    const metaSafe = escaparHTML(formatarBadgeTecnica(item.meta, item.maxMag));
    const subSafe = escaparHTML(item.subtitulo || item.topicoTitulo || "");

    return `
      <button
        type="button"
        data-acervo-slide-id="${idSafe}"
        class="palas-card-tactile palas-card-interactive group bg-white rounded-2xl border overflow-hidden text-left flex flex-col cursor-pointer ${
          isAtiva ? "border-teal-700 ring-1 ring-teal-700/25" : "border-slate-200/90"
        }"
      >
        <div class="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200/70">
          <img
            src="${escaparHTML(thumb)}"
            alt="${nomeSafe}"
            loading="lazy"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-900/5"></div>
          <div class="absolute top-3 left-3 flex items-center gap-1.5">
            <span class="bg-white/95 backdrop-blur-md text-slate-800 border border-slate-200/90 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg shadow-sm">
              ${metaSafe}
            </span>
          </div>
        </div>

        <div class="p-4 flex-1 flex flex-col justify-between gap-2 w-full">
          <div>
            <h3 class="text-sm sm:text-base font-serif font-bold text-slate-900 group-hover:text-teal-900 transition-colors leading-snug">${nomeSafe}</h3>
            <p class="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">${subSafe}</p>
          </div>
          <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-teal-800 group-hover:text-teal-950 transition-colors">
            <span>${isAtiva ? "Lâmina atual" : "Abrir no microscópio"}</span>
            <span class="text-slate-400 group-hover:text-teal-800 transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
          </div>
        </div>
      </button>
    `;
  }).join("");

  if (!grid.__bound) {
    grid.__bound = true;
    grid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-acervo-slide-id]");
      if (!card) return;
      const targetId = card.getAttribute("data-acervo-slide-id");
      if (!targetId) return;
      const activeNow = resolverIdCanonicoSwitcher(laminaAtualData?.id || "");
      if (targetId !== activeNow) {
        trocarLaminaNoViewer(targetId);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function renderizarOpcoesSwitcher(selectedId) {
  renderizarListaLaminarioRapido();
  atualizarNavegacaoRodapeSidebar();
  renderizarAcervoRelacionado();

  const selects = [
    document.getElementById("viewerSlideSwitcher"),
    document.getElementById("viewerSlideSwitcherMobile")
  ].filter(Boolean);
  if (selects.length === 0) return;

  const isLocalDzi = selectedId === "local-dzi";
  const canonicoAtivo = isLocalDzi ? "local-dzi" : resolverIdCanonicoSwitcher(selectedId);

  selects.forEach((sel) => {
    sel.innerHTML = "";
    if (isLocalDzi) {
      const optLocal = document.createElement("option");
      optLocal.value = "local-dzi";
      optLocal.textContent = laminaAtualData?.nome || "Lâmina Local";
      sel.appendChild(optLocal);
    }
    _catalogoLaminasSwitcher.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.nome;
      sel.appendChild(opt);
    });
    if (canonicoAtivo && Array.from(sel.options).some(o => o.value === canonicoAtivo)) {
      sel.value = canonicoAtivo;
    }
  });
}

function sincronizarSeletorRapidoLaminas(slideId) {
  if (!_catalogoLaminasSwitcher.length) {
    _catalogoLaminasSwitcher = CATALOGO_BASE_SWITCHER.map(item => ({ ...item }));
  }
  renderizarOpcoesSwitcher(slideId);
}

function inicializarSeletorRapidoLaminas() {
  _catalogoLaminasSwitcher = CATALOGO_BASE_SWITCHER.map(item => ({ ...item }));
  renderizarOpcoesSwitcher(laminaAtualData?.id || "");

  const selects = [
    document.getElementById("viewerSlideSwitcher"),
    document.getElementById("viewerSlideSwitcherMobile")
  ].filter(Boolean);

  selects.forEach((sel) => {
    if (sel.dataset.bound === "1") return;
    sel.dataset.bound = "1";
    sel.addEventListener("change", (e) => {
      const novoId = e.target.value;
      sel.blur();
      if (novoId && novoId !== "local-dzi") {
        trocarLaminaNoViewer(novoId);
      }
    });
  });

  if (typeof db !== "undefined" && db) {
    db.collection("laminas")
      .where("status", "==", "ativa")
      .get()
      .then((snapshot) => {
        if (!snapshot || snapshot.empty) return;
        const extras = [];
        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          const docIdLower = String(doc.id).toLowerCase();
          const existe = _catalogoLaminasSwitcher.find(base =>
            String(base.id).toLowerCase() === docIdLower ||
            (Array.isArray(base.aliases) && base.aliases.some(a => String(a).toLowerCase() === docIdLower))
          );
          if (existe) {
            if (data.nome && data.nome.trim()) existe.nome = data.nome.trim();
            if (data.coloracao && !isColoracaoGenerica(data.coloracao)) existe.meta = data.coloracao.trim();
          } else if (data.nome && data.nome.trim()) {
            extras.push({
              id: doc.id,
              nome: data.nome.trim(),
              subtitulo: data.subtitulo || "Lâmina Histológica Digital",
              topicoTitulo: data.topicoTitulo || "Histologia",
              meta: !isColoracaoGenerica(data.coloracao) ? data.coloracao.trim() : `${Number(data.maxMagnification) || 40}x`,
              maxMag: Number(data.maxMagnification) || 40,
              previewImage: data.previewImage || data.thumbnailUrl || "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg",
              aliases: []
            });
          }
        });
        if (extras.length > 0) {
          extras.sort((a, b) => a.nome.localeCompare(b.nome));
          _catalogoLaminasSwitcher = [..._catalogoLaminasSwitcher, ...extras];
        }
        renderizarOpcoesSwitcher(laminaAtualData?.id || "");
      })
      .catch(() => {});
  }
}

export function trocarLaminaNoViewer(novoId, skipHistory = false) {
  if (!novoId) return;
  const atualCanonico = resolverIdCanonicoSwitcher(laminaAtualData?.id);
  const novoCanonico = resolverIdCanonicoSwitcher(novoId);
  if (atualCanonico && novoCanonico && atualCanonico === novoCanonico) return;

  if (modoReguaAtivo) toggleReguaMorfometrica(false);
  else limparMedicaoRegua();

  if (_pinAutoHideTimer) {
    clearTimeout(_pinAutoHideTimer);
    _pinAutoHideTimer = null;
  }
  marcacoesVisiveis = false;
  pinAtivo = null;
  questaoAtivaId = null;
  _pendingUrlPinId = null;

  if (!skipHistory) {
    history.pushState({ id: novoId }, "", `microscopio.html?id=${encodeURIComponent(novoId)}`);
  }

  const skeleton = document.getElementById("osdSkeleton");
  const osdCanvas = document.getElementById("osd-viewer");
  if (osdCanvas) osdCanvas.classList.add("opacity-0");
  if (skeleton) {
    skeleton.classList.remove("hidden");
    skeleton.classList.add("flex");
    skeleton.style.display = "flex";
    skeleton.style.opacity = "1";
    skeleton.style.pointerEvents = "auto";
  }

  carregarLaminaNoMicroscopio(novoId);
}

function registrarPopstateMicroscopio() {
  if (_popstateRegistrado) return;
  _popstateRegistrado = true;
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const nextId = params.get("id") || params.get("laminaId");
    _pendingUrlPinId = params.get("pin") || null;
    if (nextId) {
      trocarLaminaNoViewer(nextId, true);
    }
  });
}

// ---------------------------------------------------------------------------
// Exposicao global (compatibilidade com onclick no HTML)
// ---------------------------------------------------------------------------
window.App = window.App || {};
Object.assign(window.App, {
  osdViewerAction,
  focarPinoNoViewer,
  focarQuestaoNoViewer,
  alternarAbaPainel,
  renderizarQuestoesNaSidebar,
  carregarLaminaPorId: carregarLaminaNoMicroscopio,
  trocarLaminaNoViewer,
  trocarLente,
  alterarZoom,
  calcularMagnificacaoOtica,
  formatarMagnificacaoOtica,
  getZoom4xRef,
  calcularZoomParaMagnificacao,
  analisarProporcoesOpticasDzi,
  recalcularCertidaoOptica,
  aplicarLimitesOpticos,
  sanitizarHTMLDescricao,
  aplicarEstadoSidebar,
  fecharSidebar: () => aplicarEstadoSidebar(true, true),
  abrirSidebar:  () => aplicarEstadoSidebar(false, true),
  toggleAjudaMicroscopio,
  toggleMarcacoesNoViewer,
  renderizarTodasMarcacoesNoViewer,
  toggleReguaMorfometrica,
  limparMedicaoRegua,
  copiarLinkCampoAtual,
  toggleTelaCheiaMicroscopio,
  toggleModoBancada,
  definirTomPlatina,
  toggleMinimap,
  toggleLaminarioRapido,
  toggleMobileMoreMenu,
  navegarPinoAdjacente,
  navegarLaminaAdjacente,
  copiarAnotacoesQuestoes,
  atualizarScalebarEditorial
});
window.osdViewerAction              = osdViewerAction;
window.focarPinoNoViewer            = focarPinoNoViewer;
window.focarQuestaoNoViewer         = focarQuestaoNoViewer;
window.alternarAbaPainel            = alternarAbaPainel;
window.renderizarQuestoesNaSidebar  = renderizarQuestoesNaSidebar;
window.carregarLaminaPorId          = carregarLaminaNoMicroscopio;
window.trocarLaminaNoViewer         = trocarLaminaNoViewer;
window.trocarLente                  = trocarLente;
window.alterarZoom                  = alterarZoom;
window.calcularMagnificacaoOtica     = calcularMagnificacaoOtica;
window.formatarMagnificacaoOtica     = formatarMagnificacaoOtica;
window.getZoom4xRef                 = getZoom4xRef;
window.calcularZoomParaMagnificacao = calcularZoomParaMagnificacao;
window.analisarProporcoesOpticasDzi  = analisarProporcoesOpticasDzi;
window.recalcularCertidaoOptica     = recalcularCertidaoOptica;
window.aplicarLimitesOpticos        = aplicarLimitesOpticos;
window.sanitizarHTMLDescricao       = sanitizarHTMLDescricao;
window.aplicarEstadoSidebar         = aplicarEstadoSidebar;
window.fecharSidebar                = () => aplicarEstadoSidebar(true, true);
window.abrirSidebar                 = () => aplicarEstadoSidebar(false, true);
window.getViewer                    = () => viewer;
window.getLaminaAtualData           = () => laminaAtualData;
window.toggleAjudaMicroscopio       = toggleAjudaMicroscopio;
window.toggleMarcacoesNoViewer      = toggleMarcacoesNoViewer;
window.renderizarTodasMarcacoesNoViewer = renderizarTodasMarcacoesNoViewer;
window.toggleReguaMorfometrica      = toggleReguaMorfometrica;
window.limparMedicaoRegua           = limparMedicaoRegua;
window.copiarLinkCampoAtual         = copiarLinkCampoAtual;
window.toggleTelaCheiaMicroscopio   = toggleTelaCheiaMicroscopio;
window.toggleModoBancada            = toggleModoBancada;
window.definirTomPlatina            = definirTomPlatina;
window.toggleMinimap                = toggleMinimap;
window.toggleLaminarioRapido        = toggleLaminarioRapido;
window.toggleMobileMoreMenu         = toggleMobileMoreMenu;
window.navegarPinoAdjacente         = navegarPinoAdjacente;
window.navegarLaminaAdjacente       = navegarLaminaAdjacente;
window.copiarAnotacoesQuestoes      = copiarAnotacoesQuestoes;
window.atualizarScalebarEditorial   = atualizarScalebarEditorial;

export {
  carregarLaminaNoMicroscopio as carregarLaminaPorId,
  aplicarEstadoSidebar,
  toggleAjudaMicroscopio
};

// ---------------------------------------------------------------------------
// 12. Inicializacao do ciclo de vida
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarMicroscopio);
  } else {
    iniciarMicroscopio();
  }
}

