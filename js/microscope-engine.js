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
  removerConteudoPerigoso,
  sanitizarHTMLDescricao,
  formatarDescricaoMorfolgica,
  escaparHTML
} from "./sanitizer.js";
import { emitirCertidaoOptica, formatarComprimento } from "./optics-calibration.js?v=20261118v3";

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
let _catalogoLaminasSwitcher = [];

// Controle de concorrência e temporizadores do visualizador
let _loadEpoch              = 0;
let _viewerInstanceSeq      = 0;
let _activeOpenTimer        = null;

// Certidão Óptica: ampliação real comprovada da lâmina (ver js/optics-calibration.js)
let certidaoOpticaAtual     = null;
let manifestoOpticoAtual    = null;
let perfilOpticoAtual       = null;

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

function atualizarScalebarOpenSeadragon(targetViewer, mppVal) {
  if (!targetViewer || typeof targetViewer.scalebar !== "function" || !window.OpenSeadragon?.ScalebarType) return;
  const ppm = mppVal && Number(mppVal) > 0 ? Math.round(1e6 / Number(mppVal)) : 0;
  try {
    targetViewer.scalebar({
      type:            window.OpenSeadragon.ScalebarType.MICROSCOPE,
      location:        window.OpenSeadragon.ScalebarLocation.TOP_RIGHT,
      pixelsPerMeter:  ppm,
      color:           "#0f172a",
      backgroundColor: "rgba(255, 255, 255, 0.92)",
      fontFamily:      "'JetBrains Mono', monospace",
      barThickness:    2,
      xOffset:         16,
      yOffset:         16
    });
  } catch (e) {}
  const sb = document.querySelector(".openseadragon-scalebar");
  if (sb) {
    sb.style.display = ppm > 0 ? "" : "none";
  }
}

// ---------------------------------------------------------------------------
// Barra lateral retrátil (painel de informações e pontos de interesse)
// ---------------------------------------------------------------------------
const SIDEBAR_STORAGE_KEY = "palasAtlas.sidebarCollapsed";

function sincronizarTamanhoDoViewer() {
  if (!viewer || !viewer.viewport) return;
  try {
    if (typeof viewer.forceResize === "function") viewer.forceResize();
    else viewer.viewport.resize(viewer.viewport.getContainerSize(), false);
    viewer.forceRedraw();
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

  sidebar.classList.toggle("w-[85vw]", !recolhida);
  sidebar.classList.toggle("sm:w-[360px]", !recolhida);
  sidebar.classList.toggle("lg:w-[320px]", !recolhida);
  sidebar.classList.toggle("xl:w-[380px]", !recolhida);
  sidebar.classList.toggle("max-w-[380px]", !recolhida);
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
    new ResizeObserver(() => sincronizarTamanhoDoViewer()).observe(palco);
  }
}

// ---------------------------------------------------------------------------
// Acervo Base Local (Fallback de Resiliência Clínica)
// ---------------------------------------------------------------------------
const fallbackLaminas = {
  'a3oRvXvJpMKAtU2RE85q': {
    id: 'a3oRvXvJpMKAtU2RE85q',
    aliases: ['lamina-real1', 'lamina-real-1', 'pele_espessa', 'pele-espessa', 'pele', 'matriz', 'teste'],
    nome: 'Pele Espessa',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E) • 40x',
    maxMagnification: 40,
    objetivaCaptura: 40,
    zoom4xRatio: 0.65,
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
    aliases: ['96ZYqoM2SV8p4fB2QgeM', 'osso-maduro', 'osso_maduro', 'osso-maduro-desgaste', 'osso-desgaste', 'osso_compacto_dzi', 'osso-compacto'],
    nome: 'Osso Maduro',
    disciplina: 'histologia',
    coloracao: 'Desgaste • 40x',
    maxMagnification: 40,
    objetivaCaptura: 40,
    zoom4xRatio: 0.28,
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
    aliases: ['osso_maduro_desgaste_ct_2', 'osso_2.0', 'osso-2.0', 'osso_desgaste_2', 'osso-maduro-2'],
    nome: 'Osso Maduro 10x',
    disciplina: 'histologia',
    coloracao: 'Corte por Desgaste • 10x (Mapeamento 2x5)',
    maxMagnification: 10,
    objetivaCaptura: 10,
    zoom4xRatio: 0.35,
    mpp: 0.625,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.5, y: 0.5 },
    imagemUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
    previewImage: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
    dziUrl: 'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste (v2.0)</h3>
        <p>Esta preparação histológica foi <strong>mapeada em 10x</strong> com escaneamento em grade snake (2×5 tiles, 15% de sobreposição) e costura em alta resolução via Fiji Stitching, preservando todo o campo morfológico contínuo do osso compacto.</p>
        <p>A preparação por desgaste exibe com nitidez a matriz mineralizada rica em hidroxiapatita sem descalcificação: destacam-se os <strong>Sistemas de Havers (ósteons)</strong> centrados pelos <strong>Canais de Havers</strong>, circundados por <strong>lamelas concêntricas</strong>, <strong>lacunas osteocitárias</strong> e a densa arborização dos <strong>canalículos</strong> que intercomunicavam os osteócitos.</p>
        <p>Entre os ósteons, evidenciam-se as <strong>lamelas intersticiais</strong> remanescentes de ciclos de remodelação óssea prévios e os <strong>Canais de Volkmann</strong> que cruzam a matriz comunicando os canais vasculares.</p>
      </div>
    `,
    pinos: []
  },
  'osso_maduro_desgaste_ct_3.0': {
    id: 'osso_maduro_desgaste_ct_3.0',
    aliases: ['osso_maduro_desgaste_ct_3', 'osso_3.0', 'osso-3.0', 'osso_desgaste_3', 'osso-maduro-3'],
    nome: 'Osso Maduro 40x',
    disciplina: 'histologia',
    coloracao: 'Corte por Desgaste • 40x (Mapeamento 6x8 • 48 Fotos)',
    maxMagnification: 40,
    objetivaCaptura: 40,
    zoom4xRatio: 0.28,
    mpp: 0.156,
    metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
    defaultCenter: { x: 0.5, y: 0.5 },
    imagemUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
    previewImage: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
    dziUrl: 'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
    descricaoHTML: `
      <div class="prose-atlas">
        <h3>Tecido Ósseo Maduro — Alta Resolução 40x (v3.0 Panorama 6×8)</h3>
        <p>Varredura panorâmica ultradetalhada de <strong>48 fotos em objetiva de 40x</strong> montada em grade snake contínua (6 colunas × 8 linhas, 15% de sobreposição) via Fiji Stitching com recorte retangular limpo (sem rebarbas), totalizando <strong>6430 × 5630 pixels (~36.2 MP)</strong>.</p>
        <p>A ampliação de 40x permite observar com riqueza ultraestrutural:</p>
        <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
          <li><strong>Canais de Havers:</strong> lúmen vascular central nítido circundado por lamelas cilíndricas concêntricas.</li>
          <li><strong>Lacunas de Osteócitos:</strong> cavidades elípticas escuras na matriz óssea mineralizada.</li>
          <li><strong>Rede de Canalículos:</strong> filamentos microvasculares e comunicantes que irradiam das lacunas através da matriz sólida.</li>
          <li><strong>Linhas Cimentantes:</strong> limites externos de refringência que demarcam cada ósteon individual das lamelas intersticiais vizinhas.</li>
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
  inicializarSeletorRapidoLaminas();
  registrarDelegacaoGlobalDePinos();
  registrarControleAjudaMicroscopio();
  registrarAtalhosTecladoMicroscopio();
  registrarControleFullscreenMicroscopio();
  registrarPopstateMicroscopio();

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
      defaultDesc = `
        <div class="prose-atlas">
          <h3>Pele Espessa — Epiderme e Derme (H&E • 40x)</h3>
          <p>Esta preparação histológica exibe a morfologia clássica da <strong>pele espessa</strong> (região palmar ou plantar). Destaca-se a exuberante epiderme formada por um <strong>epitélio estratificado pavimentoso queratinizado</strong>, adaptado a forças de atrito mecânico constante.</p>
          <p><strong>Estratificação Epidérmica (da profundidade para a superfície):</strong></p>
          <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
            <li><strong>Camada Basal (Germinativa):</strong> Fileira única de células cúbicas a prismáticas com alta atividade mitótica sobre a lâmina basal.</li>
            <li><strong>Camada Espinhosa:</strong> Múltiplas camadas de queratinócitos poliédricos unidos por densos desmossomos ("espinhos").</li>
            <li><strong>Camada Granulosa:</strong> Células achatadas com volumosos grânulos basofílicos de querato-hialina no citoplasma.</li>
            <li><strong>Camada Lúcida:</strong> Fita homogênea, clara e eosinofílica refringente, característica exclusiva da pele espessa.</li>
            <li><strong>Camada Córnea:</strong> Camada superficial densa de escamas anucleadas de queratina pura (barreira impermeável).</li>
          </ul>
          <p>Na interface dermo-epidérmica observam-se as <strong>papilas dérmicas</strong> que se interdigitam com as cristas epidérmicas, garantindo forte adesão mecânica e nutrição vascular ao epitélio.</p>
        </div>
      `;
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
  if (typeof forcar === "boolean") {
    if (forcar) {
      popover.classList.remove("hidden");
    } else {
      popover.classList.add("hidden");
    }
  } else {
    popover.classList.toggle("hidden");
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
      const candidatos = [idBuscado, fallback.id, ...(Array.isArray(fallback.aliases) ? fallback.aliases : [])]
        .filter((v, i, arr) => v && arr.indexOf(v) === i);

      (async () => {
        try {
          const docSnapshots = await Promise.all(
            candidatos.map((cid) =>
              db.collection("laminas").doc(cid).get().catch((err) => {
                console.warn("[Palas Atlas] Falha ao sincronizar lâmina do Firestore:", cid, err);
                return null;
              })
            )
          );
          if (myEpoch !== _loadEpoch) return;
          const docRef = docSnapshots.find((d) => d && d.exists);
          if (!docRef) return;

          const dados = docRef.data() || {};
          const textoValido = (v) => typeof v === "string" && v.replace(/<[^>]*>/g, "").trim().length > 0;

          if (textoValido(dados.nome)) laminaAtualData.nome = dados.nome;
          if (textoValido(dados.coloracao)) laminaAtualData.coloracao = dados.coloracao;
          if (textoValido(dados.disciplina)) laminaAtualData.disciplina = dados.disciplina;
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
            const isPele = (dados.nome && dados.nome.toLowerCase().includes("pele")) || idBuscado === "a3oRvXvJpMKAtU2RE85q" || idBuscado === "pele_espessa";
            laminaAtualData.maxMagnification = isPele ? 40 : (Number(dados.maxMagnification) || 40);
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
  if (coloracaoEl)  coloracaoEl.textContent = laminaAtualData.coloracao || "Hematoxilina e Eosina (H&E)";
  if (breadcrumb)   { breadcrumb.textContent = tituloLimpo; breadcrumb.classList.remove("hidden"); }
  if (docTitle)     docTitle.textContent    = `${tituloLimpo} - Palas Atlas`;

  const seloTextoEl = document.getElementById("slideSeloOpticoTexto");
  const maxMag = Number(laminaAtualData.maxMagnification || laminaAtualData.maxMag || 40);
  const mpp = Number(laminaAtualData.mpp) || (40 / maxMag) * 0.156;
  if (seloTextoEl) {
    seloTextoEl.textContent = `${maxMag}x Nativa (${mpp.toFixed(2)} µm/px)`;
    const seloEl = document.getElementById("slideSeloOptico");
    if (seloEl) {
      seloEl.title = `Calibração Óptica: ${maxMag}x Nativa • ${mpp.toFixed(3)} µm/px • Referência Biológica (Hemácia 7.5 µm) • Trava física 1:1 ativa (sem ampliação vazia)`;
      seloEl.classList.remove("hidden");
    }
  }
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

  const tituloPeca = document.getElementById("slideTitle")?.textContent || "Lamina Histologica";
  const rawHtml = laminaAtualData.descricaoHTML || laminaAtualData.descricao || "";
  const html = formatarDescricaoMorfolgica(rawHtml);
  const textoHtml = html || `<p class="text-slate-500 italic text-sm font-sans">Nenhum texto descritivo cadastrado para esta lâmina.</p>`;

  // Pontos de Interesse como lista clicavel abaixo do texto
  let secaoPinos = "";
  if (listaPinosAtual.length > 0) {
    secaoPinos = `
      <div class="mt-8 border-t border-slate-200 pt-6">
        <h4 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 font-mono">
          Pontos de Interesse
        </h4>
        <div class="flex flex-col gap-2">
          ${listaPinosAtual.map((pin, idx) => {
            const pinIdSafe = escaparHTML(String(pin.id ?? idx + 1));
            return `
            <button
              type="button"
              id="btn-pino-${pinIdSafe}"
              data-btn-pin-id="${pinIdSafe}"
              class="pin-item-btn w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/90 hover:border-teal-600/40 text-left transition-all group cursor-pointer"
            >
              <div class="flex items-center gap-2.5 truncate pr-2">
                <span class="pin-indicator w-2 h-2 rounded-full bg-teal-600 shrink-0 transition-transform"></span>
                <span class="pin-label text-sm font-medium text-slate-800 group-hover:text-teal-950 transition-colors truncate">${escaparHTML(pin.rotulo || "Estrutura")}</span>
              </div>
              <span class="pin-action text-xs text-slate-500 group-hover:text-teal-700 shrink-0 transition-colors">Focar &rarr;</span>
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
    <a
      href="mailto:contato@palasatlas.com?subject=Correção sugerida na peça: ${encodeURIComponent(tituloPeca)}"
      class="text-xs text-slate-500 hover:text-teal-700 transition-colors flex items-center gap-1 cursor-pointer mt-6 border-t border-slate-200 pt-4 w-fit"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
      </svg>
      Reportar Erro nesta Lâmina
    </a>
  `;

  if (!container.__pinClickDelegated) {
    container.__pinClickDelegated = true;
    container.addEventListener("click", (evento) => {
      const btn = evento.target.closest("button[data-btn-pin-id]");
      if (!btn) return;
      const pinId = btn.getAttribute("data-btn-pin-id");
      if (pinId) focarPinoNoViewer(pinId);
    });
  }

  // Estiliza pin-links inline com tipografia acadêmica sóbria e alto contraste
  container.querySelectorAll('.pin-link, [data-pin-id]').forEach(el => {
    el.className = "pin-link font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-4 decoration-teal-600/40 hover:decoration-teal-700 cursor-pointer transition-all bg-transparent border-0 p-0 inline";
  });

  if (pinAtivo) {
    destacarPinoNaSidebar(pinAtivo);
  }
}

// ---------------------------------------------------------------------------
// 4.5 Abas do Painel Lateral e Questões Práticas de Bancada
// ---------------------------------------------------------------------------

/**
 * Alterna a visualização entre a aba de Descrição Morfológica e a aba de Questões de Bancada.
 * Atualiza classes dos botões (ativo vs inativo) e a visibilidade dos containers.
 *
 * @param {'descricao' | 'questoes'} aba
 */
export function alternarAbaPainel(aba) {
  const containerDesc  = document.getElementById("slideDescriptionContainer");
  const containerQuest = document.getElementById("slideQuestionsContainer");
  const btnDesc        = document.getElementById("btnTabDescricao");
  const btnQuest       = document.getElementById("btnTabQuestoes");

  const abaAlvo = (aba === "questoes") ? "questoes" : "descricao";
  abaAtivaPainel = abaAlvo;

  const estiloAtivo   = "tab-btn-ativo min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer bg-teal-700 text-white border border-teal-700 shadow-sm touch-manipulation flex items-center justify-center";
  const estiloInativo = "tab-btn-inativo min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent touch-manipulation flex items-center justify-center";

  if (abaAlvo === "descricao") {
    if (containerDesc) containerDesc.classList.remove("hidden");
    if (containerQuest) containerQuest.classList.add("hidden");

    if (btnDesc)  btnDesc.className = estiloAtivo;
    if (btnQuest) btnQuest.className = `${estiloInativo} flex items-center gap-1.5`;
  } else {
    if (containerDesc) containerDesc.classList.add("hidden");
    if (containerQuest) containerQuest.classList.remove("hidden");

    if (btnDesc)  btnDesc.className = estiloInativo;
    if (btnQuest) btnQuest.className = `${estiloAtivo} flex items-center gap-1.5`;
  }
}

/**
 * Atualiza o badge contador da aba de questões.
 * Destaque sutil com cor petróleo se houver questões, ou neutro se 0.
 */
function atualizarBadgeContadorQuestoes() {
  const badge = document.getElementById("badgeContadorQuestoes");
  if (!badge) return;

  const total = Array.isArray(listaQuestoesAtual) ? listaQuestoesAtual.length : 0;
  badge.textContent = String(total);

  if (total > 0) {
    badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-mono font-medium";
  } else {
    badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono border border-transparent";
  }
}

/**
 * Persiste a anotação/resposta diagnóstica do estudante com debounce no localStorage.
 * Chave de armazenamento: palasAtlas.respostas.${laminaId}.${questaoId}
 */
function salvarRespostaEstudante(laminaId, questaoId, texto) {
  const idSeguro = String(questaoId);
  const statusEl = document.getElementById(`statusSalvo-${idSeguro}`);
  if (statusEl) {
    statusEl.textContent = "Salvando...";
    statusEl.classList.remove("text-slate-500");
    statusEl.classList.add("text-teal-700");
  }

  clearTimeout(debounceTimersRespostas[idSeguro]);
  debounceTimersRespostas[idSeguro] = setTimeout(() => {
    try {
      const chave = `palasAtlas.respostas.${laminaId}.${idSeguro}`;
      localStorage.setItem(chave, texto);
      if (statusEl) {
        statusEl.textContent = "Salvo localmente";
        statusEl.classList.remove("text-teal-700");
        statusEl.classList.add("text-slate-500");
      }
    } catch (e) {
      console.warn("[Palas Atlas] Erro ao persistir resposta no localStorage:", e);
    }
  }, 400);
}

/**
 * Persistência imediata da anotação ao perder foco (evento blur).
 */
function salvarRespostaImediato(laminaId, questaoId, texto) {
  const idSeguro = String(questaoId);
  clearTimeout(debounceTimersRespostas[idSeguro]);
  try {
    const chave = `palasAtlas.respostas.${laminaId}.${idSeguro}`;
    localStorage.setItem(chave, texto);
    const statusEl = document.getElementById(`statusSalvo-${idSeguro}`);
    if (statusEl) {
      statusEl.textContent = "Salvo localmente";
      statusEl.classList.remove("text-teal-700");
      statusEl.classList.add("text-slate-500");
    }
  } catch (e) {
    console.warn("[Palas Atlas] Erro ao persistir resposta imediata no localStorage:", e);
  }
}

/**
 * Renderiza a lista de questões na aba do painel lateral.
 * Atende estritamente à diretriz de ausência de gabarito/correção automática:
 * o estudante possui um campo de anotação limpo e persistente. O professor discute
 * os diagnósticos e estruturas em sala de aula.
 *
 * @param {Array} questoes - Array de objetos de questão
 */
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
          Nenhuma questão de bancada cadastrada para esta lâmina pelo professor.
        </p>
        <span class="inline-block text-[10px] font-mono text-slate-400 tracking-wider uppercase">
          Atividades Práticas de Laboratório
        </span>
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
        class="card-questao rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:border-slate-300 space-y-3"
      >
        <!-- Cabeçalho Clicável da Questão -->
        <button
          type="button"
          data-questao-focus-id="${qIdSafe}"
          class="w-full text-left flex items-start justify-between gap-3 group cursor-pointer focus:outline-none"
          title="Focar localização da questão no microscópio"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0 mt-0.5">
              Q${numeroQSafe}
            </span>
            <div class="min-w-0">
              <h4 class="text-xs font-semibold text-slate-800 tracking-wide font-sans group-hover:text-teal-700 transition-colors leading-snug">
                ${escaparHTML(tituloQ)}
              </h4>
            </div>
          </div>
          ${temCoordenadas ? `
            <div class="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 group-hover:text-teal-700 shrink-0 transition-colors pt-0.5">
              <span>Focar</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </div>
          ` : ''}
        </button>

        <!-- Enunciado e Orientação Diagnóstica -->
        ${enunciadoQ ? `
          <div class="text-xs text-slate-700 font-sans leading-relaxed border-l-2 border-slate-300 ml-1 pl-2.5">
            ${escaparHTML(enunciadoQ)}
          </div>
        ` : ''}

        <!-- Área de Anotação / Resposta do Estudante (sem gabarito) -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
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
            class="w-full bg-white border border-slate-300 focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 font-sans leading-relaxed outline-none transition-all"
          >${escaparHTML(respostaSalva)}</textarea>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="space-y-3 pt-1">
      <div class="flex items-center justify-between px-0.5 pb-1">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Caderno de Bancada
        </span>
        <span class="text-[10px] font-mono text-slate-500">
          ${questoes.length} ${questoes.length === 1 ? 'questão' : 'questões'}
        </span>
      </div>
      ${cardsHtml}
    </div>
  `;

  // Anexa listeners de clique, input e blur usando delegação de eventos estável
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

/**
 * Aplica destaque visual ao card da questão ativa na barra lateral.
 *
 * @param {string} qId - ID da questão
 */
function destacarCardQuestaoNaSidebar(qId) {
  const idBuscado = String(qId);
  document.querySelectorAll(".card-questao").forEach((card) => {
    const cardQId = card.getAttribute("data-questao-id");
    const isAtivo = String(cardQId) === idBuscado;
    if (isAtivo) {
      card.classList.add("border-teal-600", "bg-teal-50/70", "ring-1", "ring-teal-600/30", "shadow-sm");
      card.classList.remove("border-slate-200", "bg-slate-50");
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      card.classList.remove("border-teal-600", "bg-teal-50/70", "ring-1", "ring-teal-600/30", "shadow-sm");
      card.classList.add("border-slate-200", "bg-slate-50");
    }
  });
}

/**
 * Aplica destaque visual ao botão do pino correspondente na lista lateral.
 *
 * @param {string} pinId - ID do pino ativo
 */
function destacarPinoNaSidebar(pinId) {
  const idBuscado = String(pinId || "").trim().toLowerCase();
  const norm = (val) => String(val || "").replace(/^(pin[-_]|p)/i, "").trim().toLowerCase();
  const buscadoNorm = norm(idBuscado);

  document.querySelectorAll("[data-btn-pin-id]").forEach((btn) => {
    const btnPinId = String(btn.getAttribute("data-btn-pin-id") || "").trim().toLowerCase();
    const isAtivo = Boolean(idBuscado) && (
      btnPinId === idBuscado ||
      (buscadoNorm && norm(btnPinId) === buscadoNorm)
    );
    const label = btn.querySelector(".pin-label");
    const indicator = btn.querySelector(".pin-indicator");
    const action = btn.querySelector(".pin-action");

    if (isAtivo) {
      btn.classList.add("pin-active", "border-teal-600", "bg-teal-50", "ring-1", "ring-teal-600/30", "shadow-sm");
      btn.classList.remove("border-slate-200/90", "bg-slate-50");
      if (label) {
        label.classList.add("text-teal-950", "font-semibold");
        label.classList.remove("text-slate-800");
      }
      if (indicator) {
        indicator.classList.add("ring-2", "ring-teal-500/40", "scale-125");
      }
      if (action) {
        action.classList.add("text-teal-700", "font-semibold");
        action.classList.remove("text-slate-500");
        action.innerHTML = "Focar &rarr;";
      }
      btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      btn.classList.remove("pin-active", "border-teal-600", "bg-teal-50", "ring-1", "ring-teal-600/30", "shadow-sm");
      btn.classList.add("border-slate-200/90", "bg-slate-50");
      if (label) {
        label.classList.remove("text-teal-950", "font-semibold");
        label.classList.add("text-slate-800");
      }
      if (indicator) {
        indicator.classList.remove("ring-2", "ring-teal-500/40", "scale-125");
      }
      if (action) {
        action.classList.remove("text-teal-700", "font-semibold");
        action.classList.add("text-slate-500");
        action.innerHTML = "Focar &rarr;";
      }
    }
  });

  // Destaca também os links inline correspondentes no texto descritivo
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

  if (_activeOpenTimer) {
    clearTimeout(_activeOpenTimer);
    _activeOpenTimer = null;
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

  if (_pinAutoHideTimer) {
    clearTimeout(_pinAutoHideTimer);
    _pinAutoHideTimer = null;
  }
  limparMarcacoesPinosViewer();
  if (overlayQuestaoAtiva) {
    removerOverlayComSeguranca(overlayQuestaoAtiva);
    overlayQuestaoAtiva = null;
  }
  marcacoesVisiveis = false;
  pinAtivo = null;
  questaoAtivaId = null;
  homeZoomRef = null;
  certidaoOpticaAtual = null;
  laminaAtualData._usingPreviewFallback = false;

  if (viewer && typeof viewer.destroy === "function") {
    try {
      viewer.destroy();
    } catch (e) {}
    viewer = null;
    window.viewer = null;
  }

  const mySeq = ++_viewerInstanceSeq;
  const isDzi = imagemUrl.endsWith(".dzi") || imagemUrl.includes(".dzi?");
  const tileSourcesConfig = isDzi ? imagemUrl : { type: "image", url: imagemUrl };

  // Garante o ticket HMAC assinado ANTES da abertura do DZI para nenhum azulejo sair sem autorização
  if (isDzi && window.slideSecurity && typeof window.slideSecurity.renovarTicketSessao === "function") {
    await window.slideSecurity.renovarTicketSessao(laminaAtualData.id || "lamina-ativa");
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

  // Registra o tempo de início do carregamento da imagem
  window.__microscopeStartTime = Date.now();

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
      navigatorAutoFade:        true,
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

      // Pan livre e navegacao sem travas, permitindo visao distante com espacos em preto
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
        slideId: laminaAtualData.id || "lamina-ativa",
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
    if (_activeOpenTimer) {
      clearTimeout(_activeOpenTimer);
      _activeOpenTimer = null;
    }
    if (viewer && typeof viewer.destroy === "function") {
      try { viewer.destroy(); } catch (e) {}
    }
    viewer = null;
    window.viewer = null;
    exibirErroMicroscopio(`Não foi possível carregar o arquivo da lâmina digital. Verifique sua conexão ou tente novamente.`);
  };

  viewer.addHandler("open-failed", onOpenFailed);

  // Função unificada de Indicador Dinâmico de Zoom com cálculo de magnificação ótica real
  const updateZoomDisplay = () => {
    if (!viewer || !viewer.viewport || !homeZoomRef) return;
    const mag = calcularMagnificacaoOtica();
    const display = document.getElementById("zoomIndicatorDisplay");
    if (display) {
      display.textContent = formatarMagnificacaoOtica(mag);
    }
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
        window.slideSecurity.setSlide(laminaAtualData?.id || 'lamina-ativa');
      }
      if (item && item.source && typeof item.source.getTileUrl === "function") {
        const origGetTileUrl = item.source.getTileUrl.bind(item.source);
        item.source.getTileUrl = function(level, x, y) {
          const rawUrl = origGetTileUrl(level, x, y);
          return window.slideSecurity ? window.slideSecurity.obterUrlAzulejoProtegida(rawUrl) : rawUrl;
        };
      }
    } catch (secErr) {
      console.warn("[Palas Security] Hook de proteção em getTileUrl:", secErr);
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

    setTimeout(() => {
      const navParent = document.querySelector(".openseadragon-navigator");
      if (navParent) {
        Object.assign(navParent.style, {
          overflow:     "hidden",
          borderRadius: "10px",
          border:       "1px solid #cbd5e1",
          boxShadow:    "0 8px 24px rgba(15,23,42,0.12)"
        });
      }

      const scalebarEl = document.querySelector(".openseadragon-scalebar");
      if (scalebarEl) {
        Object.assign(scalebarEl.style, {
          borderRadius: "8px",
          padding:      "4px 12px",
          backdropFilter: "blur(8px)",
          border:       "1px solid #cbd5e1",
          boxShadow:    "0 4px 12px rgba(15,23,42,0.08)",
          fontSize:     "10px",
          fontWeight:   "600"
        });
        scalebarEl.style.display = laminaAtualData?._usingPreviewFallback ? "none" : "";
      }
    }, 400);
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
        if (viewer && typeof viewer.destroy === "function") {
          try { viewer.destroy(); } catch (e) {}
        }
        viewer = null;
        window.viewer = null;
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

  viewer.addHandler("open", updateZoomDisplay);
  viewer.addHandler("animation", updateZoomDisplay);
  viewer.addHandler("animation-finish", updateZoomDisplay);
  viewer.addHandler("zoom", updateZoomDisplay);

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
    manifesto: manifestoOpticoAtual,
    perfil: perfilOpticoAtual || PERFIL_OPTICO_PADRAO,
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
      `• Visão Panorâmica 4x: zoom ${z4x.toFixed(3)} (Margens pretas calibradas)\n` +
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

  // Snap suave para valores nominais se muito próximo (dentro de margem imperceptível)
  if (Math.abs(magRaw - 4) < 0.35) return 4;
  if (Math.abs(magRaw - 10) < 0.8) return 10;
  if (Math.abs(magRaw - 40) < 2.5) return 40;
  if (Math.abs(magRaw - 60) < 3.0) return 60;
  if (Math.abs(magRaw - 100) < 4.5) return 100;

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
function atualizarLenteBotaoAtivo() {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;
  const mag = calcularMagnificacaoOtica();
  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;

  // Mapeamento proporcional para os botões de objetiva: 4x, 10x, 40x, 60x, 100x
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
    // Pula botões bloqueados (disabled) para não sobrescrever classes
    if (btn.disabled) return;

    const magAttr = btn.getAttribute("data-mag");
    const isAtivo = magAttr ? `${magAttr}x` === objetivo : btn.textContent.trim() === objetivo;
    btn.className = isAtivo
      ? "lens-btn bg-[#0369a1] text-white font-bold shadow-sm shadow-sky-900/20 px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-xl text-xs font-mono transition-all active-lens cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0"
      : "lens-btn text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-xl text-xs font-mono transition-all duration-200 cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
  });

  // Em telas compactas, centraliza suavemente o botão da objetiva ativa no revólver sem rolar a janela
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
// 6.5 Bloqueia botões de lente acima da capacidade física da lâmina (Req 2)
// ---------------------------------------------------------------------------
function aplicarBloqueioObjetivas(maxMag) {
  const limiteMag = Number(maxMag) || 40;
  document.querySelectorAll(".lens-btn").forEach(btn => {
    const magBotao = Number(btn.getAttribute("data-mag")) || 4;
    if (magBotao > limiteMag) {
      btn.disabled = true;
      btn.className = "lens-btn text-slate-300 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-xl text-xs font-mono cursor-not-allowed opacity-50 min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
      btn.title = `Objetiva não disponível (Máx: ${limiteMag}x)`;
    } else {
      btn.disabled = false;
      btn.title = `Lente ${magBotao}x`;
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

    // Feedback visual imediato e tátil no link clicado
    alvo.classList.add("ring-2", "ring-teal-500/50", "ring-offset-2", "ring-offset-white", "rounded-sm");
    setTimeout(() => {
      alvo.classList.remove("ring-2", "ring-teal-500/50", "ring-offset-2", "ring-offset-white", "rounded-sm");
    }, 1400);

    focarPinoNoViewer(pinIdRaw);
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
 * Destrói o MouseTracker associado (se houver) e remove o overlay do OpenSeadragon.
 */
function removerOverlayComSeguranca(elem) {
  if (!elem) return;
  if (elem._osdTracker) {
    try { elem._osdTracker.destroy(); } catch (e) {}
    elem._osdTracker = null;
  }
  if (viewer) {
    try { viewer.removeOverlay(elem); } catch (e) {}
  }
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
function vincularCliqueMarcacaoViewer(targetElem, pinId, overlayContainer) {
  if (!targetElem || !window.OpenSeadragon) return;
  const tracker = new window.OpenSeadragon.MouseTracker({
    element: targetElem,
    clickHandler: (e) => {
      if (e && e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
      }
      if (abaAtivaPainel !== "descricao") {
        alternarAbaPainel("descricao");
      }
      focarPinoNoViewer(pinId);
    }
  });
  overlayContainer._osdTracker = tracker;
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
      <div class="animate-pulse" style="position:absolute; inset:0; border-radius:50%; border:2.5px solid #0d9488; box-shadow:0 0 25px rgba(13,148,136,0.6), inset 0 0 20px rgba(13,148,136,0.2); background:rgba(13,148,136,0.1); pointer-events:none;"></div>
      ${rotuloSeguro ? `
        <div data-pin-hit="1" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(255,255,255,0.96); color:#0f766e; border:1px solid #0d9488; font-family:'Inter', system-ui, sans-serif; font-size:11px; font-weight:600; padding:3px 9px; border-radius:12px; box-shadow:0 4px 14px rgba(15,23,42,0.25); white-space:nowrap; pointer-events:auto; cursor:pointer;">
          ${rotuloSeguro}
        </div>
      ` : ''}
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: vpRect
    });

    const hitEl = overlayElem.querySelector('[data-pin-hit="1"]');
    if (hitEl) vincularCliqueMarcacaoViewer(hitEl, pinId, overlayElem);

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
    const markerId = `viewer-marker-arrow-${pinId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    overlayElem = document.createElement("div");
    overlayElem.id = `viewer-pin-${pinId}`;
    overlayElem.className = rootClass;
    overlayElem.style.cssText = `pointer-events:none; position:relative; width:100%; height:100%; z-index:${zIndexVal};`;
    overlayElem.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible" style="filter:drop-shadow(0 2px 8px rgba(15,23,42,0.45)); pointer-events:none;">
        <defs>
          <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0d9488" />
          </marker>
        </defs>
        <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="#0d9488" stroke-width="4" stroke-linecap="round" marker-end="url(#${markerId})" />
        <circle cx="${svgX1}" cy="${svgY1}" r="6" fill="#0d9488" stroke="#ffffff" stroke-width="2" />
        <circle cx="${svgX2}" cy="${svgY2}" r="5" fill="#ffffff" class="animate-ping" />
      </svg>
      ${rotuloSeguro ? `
        <div data-pin-hit="arrow-label" style="position:absolute; left:${(svgX1 / w) * 100}%; top:${(svgY1 / h) * 100}%; transform:translate(-50%, -130%); background:rgba(255,255,255,0.96); color:#0f766e; border:1px solid #0d9488; font-family:'Inter', system-ui, sans-serif; font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:8px; white-space:nowrap; box-shadow:0 4px 12px rgba(15,23,42,0.25); pointer-events:auto; cursor:pointer;">
          ${rotuloSeguro}
        </div>
      ` : ''}
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: vpRect
    });

    const labelHit = overlayElem.querySelector('[data-pin-hit="arrow-label"]');
    if (labelHit) vincularCliqueMarcacaoViewer(labelHit, pinId, overlayElem);

  // 3. ANOTAÇÃO TIPO PIN CLÁSSICO
  } else {
    const targetPoint = converterPontoParaViewport(pino.x, pino.y, contentSize);
    if (!targetPoint) return null;

    overlayElem = document.createElement("div");
    overlayElem.id = `viewer-pin-${pinId}`;
    overlayElem.className = `${rootClass} viewer-pin-interactive`;
    overlayElem.style.cssText = `pointer-events:auto; cursor:pointer; position:relative; width:36px; height:36px; z-index:${zIndexVal};`;
    overlayElem.title = pino.rotulo || "";
    overlayElem.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        <div class="animate-ping" style="position:absolute;width:100%;height:100%;background:rgba(13,148,136,0.45);border-radius:50%;"></div>
        <div style="position:relative;width:14px;height:14px;background:#0d9488;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 0 3px rgba(13,148,136,0.45),0 4px 14px rgba(15,23,42,0.35);"></div>
        ${rotuloSeguro ? `
          <div style="position:absolute; top:100%; left:50%; transform:translate(-50%, 6px); background:rgba(255,255,255,0.96); color:#0f766e; border:1px solid #0d9488; font-family:'Inter', system-ui, sans-serif; font-size:11px; font-weight:600; padding:2px 8px; border-radius:12px; box-shadow:0 4px 14px rgba(15,23,42,0.25); white-space:nowrap; pointer-events:none;">
            ${rotuloSeguro}
          </div>
        ` : ''}
      </div>
    `;

    viewer.addOverlay({
      element: overlayElem,
      location: targetPoint,
      placement: window.OpenSeadragon.Placement.CENTER
    });

    vincularCliqueMarcacaoViewer(overlayElem, pinId, overlayElem);
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

export function focarPinoNoViewer(pinIdRaw) {
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

  const item = viewer.world && viewer.world.getItemCount() > 0 ? viewer.world.getItemAt(0) : null;
  const contentSize = item ? item.getContentSize() : null;

  // Remove pin de questão ativa se houver
  if (overlayQuestaoAtiva) {
    removerOverlayComSeguranca(overlayQuestaoAtiva);
    overlayQuestaoAtiva = null;
    questaoAtivaId = null;
  }

  const pinId = String(pino.id || idBuscado);
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
    targetZoom = homeZoom * Math.min(5.5, Math.max(2.2, 1400 / (r * 2)));
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

  // Pino de questão com alto contraste (âmbar + slate escuro + anel duplo + radar)
  const pinElem = document.createElement("div");
  pinElem.id = `viewer-qpin-${q.id}`;
  pinElem.className = "viewer-marker-root is-active viewer-qpin cursor-pointer";
  pinElem.style.cssText = "position:relative; width:58px; height:58px; z-index:50; pointer-events:auto;";
  pinElem.title = `Questão Q${numeroQ}: ${q.titulo || "Ponto de Investigação"}`;

  pinElem.innerHTML = `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
      <div class="viewer-marker-radar" style="position:absolute; inset:0; border-radius:9999px; background:rgba(245,158,11,0.34); border:2px solid #fbbf24; pointer-events:none;"></div>
      <div style="position:relative; min-width:34px; height:34px; padding:0 8px; background:#0f172a; border-radius:9999px; border:2px solid #fbbf24; box-shadow:0 0 0 2px #ffffff, 0 0 18px rgba(245,158,11,0.85), 0 6px 16px rgba(15,23,42,0.45); display:flex; align-items:center; justify-content:center; gap:2px;">
        <span style="font-family:'JetBrains Mono', monospace; font-size:12px; font-weight:800; color:#fef3c7; letter-spacing:-0.02em;">Q${numeroQSafe}</span>
      </div>
      <div class="viewer-marker-pill-wrap" style="position:absolute; top:calc(100% + 5px); left:50%; transform:translateX(-50%);">
        <div class="viewer-marker-pill is-active">
          <span class="viewer-marker-pill-dot"></span>
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
    l.className = "lens-btn text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-xl text-xs font-mono transition-all duration-200 cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
  });

  if (targetBtn && !targetBtn.disabled) {
    targetBtn.className = "lens-btn bg-[#0369a1] text-white font-bold shadow-sm shadow-sky-900/20 px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-xl text-xs font-mono transition-all cursor-pointer active-lens touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
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
  const btn = document.getElementById("btnToggleRegua");
  if (!btn) return;
  const mpp = obterMppAtivo();
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
    if (lower === "f") {
      e.preventDefault();
      toggleTelaCheiaMicroscopio();
      return;
    }
    if (key === "ArrowRight" || key === "ArrowLeft") {
      if (Array.isArray(listaPinosAtual) && listaPinosAtual.length > 0) {
        e.preventDefault();
        const dir = key === "ArrowRight" ? 1 : -1;
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
      return;
    }
    if (key === "Escape" && modoReguaAtivo) {
      toggleReguaMorfometrica(false);
    }
  });
}

const CATALOGO_BASE_SWITCHER = [
  { id: "cw3XGCgUwN71XdlwkUe5", nome: "Osso Maduro 40x", meta: "Desgaste • 40x", aliases: ["osso_maduro_desgaste_ct_3.0", "osso_3.0", "osso-3.0"] },
  { id: "FFGk5d9kOAct5HIDdjQ7", nome: "Osso Maduro 10x", meta: "Desgaste • 10x", aliases: ["osso_maduro_desgaste_ct_2.0", "osso_2.0", "osso-2.0"] },
  { id: "96ZYqoM2SV8p4fB2QgeM", nome: "Osso Maduro", meta: "Desgaste • 40x", aliases: ["osso_maduro_desgaste_ct", "osso-maduro", "osso_maduro"] },
  { id: "a3oRvXvJpMKAtU2RE85q", nome: "Pele Espessa", meta: "H&E • 40x", aliases: ["lamina-real1", "lamina-real-1", "pele_espessa", "pele-espessa"] }
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

function renderizarOpcoesSwitcher(selectedId) {
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
          } else if (data.nome && data.nome.trim()) {
            extras.push({ id: doc.id, nome: data.nome.trim(), aliases: [] });
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
  toggleTelaCheiaMicroscopio
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

