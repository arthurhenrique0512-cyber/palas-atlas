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
let listaQuestoesAtual = [];
let questaoAtivaId = null;
let overlayQuestaoAtiva = null;
let laminaAtualData = null;
let pinAtivo     = null;
let homeZoomRef   = null; // Zoom de referencia para enquadramento geral (4x)
let nativeZoomRef = null; // Zoom de referencia para resolucao nativa 1:1 da camera (maxMag)

// Motor do Microscópio: Interatividade completa e ampliação profunda ativa
const LAMINA_ESTATICA = false;

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
  sidebar.classList.toggle("sm:w-[380px]", !recolhida);
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
  '5kqs5Qv9fvWlpNSJoyPG': {
    id: '5kqs5Qv9fvWlpNSJoyPG',
    aliases: ['medula-espinal-he', 'medula-espinal', 'medula'],
    nome: 'Medula Espinal (Corte Transversal)',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/medula-espinal-he.png',
    previewImage: 'assets/histologia/medula-espinal-he.png',
    thumbnailUrl: 'assets/histologia/medula-espinal-he.png',
    descricaoHTML: '<p>Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.</p>',
    pinos: []
  },
  'a3oRvXvJpMKAtU2RE85q': {
    id: 'a3oRvXvJpMKAtU2RE85q',
    aliases: ['lamina-real1', 'lamina-real-1', 'matriz', 'teste'],
    nome: 'Preparação Histológica Digital Matriz',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/lamina-real1.dzi',
    previewImage: 'assets/histologia/lamina-real1-preview.jpg',
    thumbnailUrl: 'assets/histologia/lamina-real1-preview.jpg',
    dziUrl: 'assets/histologia/lamina-real1.dzi',
    descricaoHTML: '<p>Lâmina completa digitalizada em altíssima resolução com pirâmide de Deep Zoom (DZI) para exploração microscópica multiescala.</p>',
    pinos: []
  },
  'medula-espinal-he': {
    id: 'medula-espinal-he',
    aliases: ['5kqs5Qv9fvWlpNSJoyPG', 'medula-espinal', 'medula'],
    nome: 'Medula Espinal (Corte Transversal)',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/medula-espinal-he.png',
    previewImage: 'assets/histologia/medula-espinal-he.png',
    thumbnailUrl: 'assets/histologia/medula-espinal-he.png',
    descricaoHTML: '<p>Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.</p>',
    pinos: []
  },
  'muscular-esqueletico-he': {
    id: 'muscular-esqueletico-he',
    aliases: ['musculo-esqueletico', 'tecido-muscular'],
    nome: 'Tecido Muscular Estriado Esquelético',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/muscular-esqueletico-he.jpg',
    previewImage: 'assets/histologia/muscular-esqueletico-he.jpg',
    thumbnailUrl: 'assets/histologia/muscular-esqueletico-he.jpg',
    descricaoHTML: '<p>Corte longitudinal de músculo estriado esquelético. Fibras musculares multinucleadas com núcleos periféricos achatados e estriações transversais de actina e miosina.</p>',
    pinos: []
  },
  'osso_maduro_desgaste_ct': {
    id: 'osso_maduro_desgaste_ct',
    aliases: ['96ZYqoM2SV8p4fB2QgeM', 'osso-maduro', 'osso_maduro', 'osso-maduro-desgaste', 'osso-desgaste', 'osso_compacto_dzi', 'osso-compacto'],
    nome: 'Osso Maduro (Lamelar) por Desgaste',
    disciplina: 'histologia',
    coloracao: 'Desgaste • 40x',
    maxMagnification: 40,
    mpp: 0.25,
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
  'osso_compacto_dzi': {
    id: 'osso_compacto_dzi',
    aliases: ['osso-compacto', 'osso-compacto-he', 'osso_compacto'],
    nome: 'Osso Compacto Desgastado',
    disciplina: 'histologia',
    coloracao: 'Desgaste • 40x',
    imagemUrl: 'assets/histologia/osso_compacto_dzi.dzi',
    previewImage: 'assets/histologia/osso-compacto-preview.jpg',
    thumbnailUrl: 'assets/histologia/osso-compacto-preview.jpg',
    dziUrl: 'assets/histologia/osso_compacto_dzi.dzi',
    descricaoHTML: '<p>Tecido ósseo compacto evidenciando sistemas de Havers (ósteons), canais centrais vasculares, lamelas concêntricas e lacunas comunicantes com canalículos de osteócitos.</p>',
    pinos: []
  },
  'epitelio-simples-escamoso': {
    id: 'epitelio-simples-escamoso',
    aliases: ['epitelio-pavimentoso', 'epitelio-simples'],
    nome: 'Epitélio Pavimentoso Simples',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/epitelio-simples-escamoso.dzi',
    previewImage: 'assets/histologia/epitelio-simples-escamoso-preview.jpg',
    thumbnailUrl: 'assets/histologia/epitelio-simples-escamoso-preview.jpg',
    dziUrl: 'assets/histologia/epitelio-simples-escamoso.dzi',
    descricaoHTML: '<p>Camada única de células epiteliais pavimentosas (achatadas) com núcleos elípticos proeminentes, adaptadas para transporte passivo e difusão de solutos.</p>',
    pinos: []
  },
  'lamina-real1': {
    id: 'lamina-real1',
    aliases: ['a3oRvXvJpMKAtU2RE85q', 'lamina-real-1', 'matriz'],
    nome: 'Preparação Histológica Digital Matriz',
    disciplina: 'histologia',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    imagemUrl: 'assets/histologia/lamina-real1.dzi',
    previewImage: 'assets/histologia/lamina-real1-preview.jpg',
    thumbnailUrl: 'assets/histologia/lamina-real1-preview.jpg',
    dziUrl: 'assets/histologia/lamina-real1.dzi',
    descricaoHTML: '<p>Lâmina completa digitalizada em altíssima resolução com pirâmide de Deep Zoom (DZI) para exploração microscópica multiescala.</p>',
    pinos: []
  }
};

// ---------------------------------------------------------------------------
// 1. Disparo automatico ao carregar a pagina
// ---------------------------------------------------------------------------
function iniciarMicroscopio() {
  iniciarSidebarRetratil();
  const urlParams = new URLSearchParams(window.location.search);
  const dziParam  = urlParams.get("dzi") || urlParams.get("file");
  const laminaId  = urlParams.get("id") || urlParams.get("laminaId");

  if (dziParam) {
    const isOsso = String(dziParam).toLowerCase().includes("osso");
    laminaAtualData = {
      id: "local-dzi",
      nome: urlParams.get("nome") || "Osso Maduro (Desgaste - Corte Transversal)",
      disciplina: urlParams.get("disciplina") || "histologia",
      coloracao: urlParams.get("coloracao") || "Corte por Desgaste (Sem Coloracao)",
      imagemUrl: dziParam,
      descricaoHTML: `
        <div class="prose-atlas">
          <h3>Tecido Osseo Maduro — Corte por Desgaste</h3>
          <p>Preparacao histologica de osso compacto maduro obtida pela tecnica de desgaste fisico. Por nao utilizar descalcificacao nem corantes histologicos, a matriz ossea mineralizada (hidroxiapatita) e preservada intacta, permitindo a observacao direta dos canais vasculares e do sistema canalicular preenchido por ar ou residuos refrateis.</p>
          <p><strong>Estruturas Morfologicas Visiveis:</strong></p>
          <ul class="list-disc pl-5 space-y-1.5 text-xs text-neutral-300">
            <li><strong>Sistemas de Havers (Osteons):</strong> Unidades cilindricas formadas por lamelas concentricas de matriz mineralizada dispostas em torno de um canal central.</li>
            <li><strong>Canais de Havers:</strong> Tuneis longitudinais centrais que alojavam vasos sanguineos e nervos in vivo.</li>
            <li><strong>Lacunas de Osteocitos:</strong> Pequenas cavidades lenticulares onde residiam os corpos celulares dos osteocitos.</li>
            <li><strong>Canaliculos Osseos:</strong> Delicadas ramificacoes radiadas que interconectam as lacunas entre si e com os canais vasculares para nutricao celular.</li>
            <li><strong>Lamelas Intersticiais:</strong> Remanescentes angulares de osteons antigos degradados pelo remodelamento osseo continuo.</li>
            <li><strong>Canais de Volkmann:</strong> Canais perfurantes transversais/obliquos que conectam canais de Havers adjacentes e o periosteo.</li>
          </ul>
        </div>
      `,
      pinos: [],
      questoes: isOsso ? (fallbackLaminas['osso_maduro_desgaste_ct']?.questoes || []) : []
    };
    listaPinosAtual = [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
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
  registrarDelegacaoGlobalDePinos();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarMicroscopio);
} else {
  iniciarMicroscopio();
}

// ---------------------------------------------------------------------------
// 2. Carrega a lamina pelo ID (Instantâneo no Acervo Base + Firestore)
// ---------------------------------------------------------------------------
async function carregarLaminaNoMicroscopio(laminaId) {
  if (!laminaId) {
    exibirErroMicroscopio("Nenhuma lâmina selecionada.");
    return;
  }

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
    listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
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
          const docRef = docSnapshots.find((d) => d && d.exists);
          if (!docRef) return;

          const dados = docRef.data() || {};
          const textoValido = (v) => typeof v === "string" && v.replace(/<[^>]*>/g, "").trim().length > 0;

          if (textoValido(dados.nome)) laminaAtualData.nome = dados.nome;
          if (textoValido(dados.coloracao)) laminaAtualData.coloracao = dados.coloracao;
          if (textoValido(dados.disciplina)) laminaAtualData.disciplina = dados.disciplina;
          if (textoValido(dados.descricaoHTML)) laminaAtualData.descricaoHTML = dados.descricaoHTML;
          else if (textoValido(dados.descricao)) laminaAtualData.descricaoHTML = dados.descricao;
          if (Array.isArray(dados.pinos)) {
            laminaAtualData.pinos = dados.pinos;
            listaPinosAtual = dados.pinos;
          }
          if (Array.isArray(dados.questoes)) {
            laminaAtualData.questoes = dados.questoes;
            listaQuestoesAtual = dados.questoes;
            renderizarQuestoesNaSidebar(listaQuestoesAtual);
            atualizarBadgeContadorQuestoes();
          }
          if (dados.maxMagnification) {
            laminaAtualData.maxMagnification = Number(dados.maxMagnification) || 40;
            aplicarBloqueioObjetivas(laminaAtualData.maxMagnification);
          }

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
      if (docRef && docRef.exists) {
        const dados = docRef.data() || {};
        laminaAtualData = { id: docRef.id, ...dados };
        let dziCandidate = laminaAtualData.dziUrl || (laminaAtualData.imagemUrl && laminaAtualData.imagemUrl.toLowerCase().endsWith('.dzi') ? laminaAtualData.imagemUrl : '');
        let img = dziCandidate || laminaAtualData.imagemUrl || laminaAtualData.imageUrl || laminaAtualData.caminhoImagemBase || '';
        if (img) {
          laminaAtualData.imagemUrl = img.replace(/^\/+/, '');
        }
        listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
        listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
        renderizarMetadadosDaLamina();
        renderizarDescricaoETextos();
        renderizarQuestoesNaSidebar(listaQuestoesAtual);
        atualizarBadgeContadorQuestoes();
        inicializarOpenSeadragon();
        return;
      }
    } catch (err) {
      console.warn("[Palas Atlas] Aviso ao consultar Firestore para ID:", idBuscado, err);
    }
  }

  // 3. Fallback secundário por correspondência parcial de nome/slug
  const fallbackSecundario = Object.values(fallbackLaminas).find(l => 
    idBuscado.toLowerCase().includes(l.id.toLowerCase()) || 
    l.id.toLowerCase().includes(idBuscado.toLowerCase())
  );
  if (fallbackSecundario) {
    laminaAtualData = { ...fallbackSecundario };
    listaPinosAtual = Array.isArray(laminaAtualData.pinos) ? laminaAtualData.pinos : [];
    listaQuestoesAtual = Array.isArray(laminaAtualData.questoes) ? laminaAtualData.questoes : [];
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
  if (coloracaoEl)  coloracaoEl.innerHTML   = `${laminaAtualData.coloracao || "Hematoxilina e Eosina (H&amp;E)"}`;
  if (breadcrumb)   { breadcrumb.textContent = tituloLimpo; breadcrumb.classList.remove("hidden"); }
  if (docTitle)     docTitle.textContent    = `${tituloLimpo} - Palas Atlas`;
}

// ---------------------------------------------------------------------------
// 4. Injeta descricaoHTML na barra lateral com hiperlinks inline de pinos
// ---------------------------------------------------------------------------
/**
 * Sanitiza o HTML da descrição, removendo artefatos poluentes copiados de chats de IA
 * (como spans parasitas com inline styles de tailwind, animações, blockquotes e &nbsp;)
 * garantindo quebra natural de linha (word-wrap) sem cortar texto à direita.
 * Preserva estritamente os links de pinos (.pin-link ou data-pin-id) e formatações legítimas.
 */
export function sanitizarHTMLDescricao(html) {
  if (!html || typeof html !== "string") return "";

  // 1. Substitui espaços não-quebráveis (&nbsp; e \u00a0) por espaço comum para permitir quebra de linha
  let limpo = html.replace(/&nbsp;/g, " ").replace(/\u00a0/g, " ");

  // 2. Remove tags blockquote mantendo o conteúdo interno
  limpo = limpo.replace(/<\/?blockquote[^>]*>/gi, "");

  // 3. Remove spans aninhados parasitas com inline styles (de streaming de IA como ChatGPT)
  // Preserva estritamente spans que sejam pin-link ou tenham data-pin-id
  for (let i = 0; i < 6; i++) {
    limpo = limpo.replace(/<span\s+(?![^>]*class=["'][^"']*pin-link[^"']*["'])(?![^>]*data-pin-id)[^>]*>([\s\S]*?)<\/span>/gi, "$1");
  }

  // 4. Remove atributos poluentes de bibliotecas externas (ex: node="[object Object]")
  limpo = limpo.replace(/<(p|div|h1|h2|h3|h4|h5|h6)\s+[^>]*node=[^>]*>/gi, "<$1>");
  limpo = limpo.replace(/style=["'][^"']*--tw-[^"']*["']/gi, "");
  limpo = limpo.replace(/style=["'][^"']*animation:[^"']*["']/gi, "");

  // 5. Ajusta pontuações acidentalmente presas dentro ou com espaços antes de vírgula/ponto/parêntese
  limpo = limpo.replace(/([a-zA-ZÀ-ÿ0-9]+)\)([ \t]*<\/span>)/gi, "$1$2)");
  limpo = limpo.replace(/([a-zA-ZÀ-ÿ0-9]+),([ \t]*<\/span>)/gi, "$1$2,");
  limpo = limpo.replace(/\s+([,.;:)])/g, "$1");
  limpo = limpo.replace(/([(])\s+/g, "$1");

  // 6. Normaliza múltiplos espaços e quebras consecutivas
  limpo = limpo.replace(/[ \t]{2,}/g, " ");

  return limpo.trim();
}

function renderizarDescricaoETextos() {
  if (!laminaAtualData) return;
  const container = document.getElementById("slideDescriptionContainer");
  if (!container) {
    console.warn("[Palas Atlas] Container #slideDescriptionContainer nao encontrado no HTML.");
    return;
  }

  const tituloPeca = document.getElementById("slideTitle")?.textContent || "Lamina Histologica";
  const rawHtml = laminaAtualData.descricaoHTML || laminaAtualData.descricao || "";
  const html = sanitizarHTMLDescricao(rawHtml);

  if (!html) {
    container.innerHTML = `<p class="text-neutral-500 italic text-sm font-sans">Nenhum texto descritivo cadastrado para esta lamina.</p>`;
    return;
  }

  // Pontos de Interesse como lista clicavel abaixo do texto
  let secaoPinos = "";
  if (listaPinosAtual.length > 0) {
    secaoPinos = `
      <div class="mt-8 border-t border-white/[0.06] pt-6">
        <h4 class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 font-mono">
          Pontos de Interesse
        </h4>
        <div class="flex flex-col gap-2">
          ${listaPinosAtual.map(pin => `
            <button
              type="button"
              onclick="window.focarPinoNoViewer('${pin.id}')"
              class="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 hover:bg-neutral-900/70 border border-white/[0.04] hover:border-[#c8ad5f]/40 text-left transition-all group cursor-pointer"
            >
              <div class="flex items-center gap-2.5 truncate pr-2">
                <span class="w-2 h-2 rounded-full bg-[#c8ad5f] shrink-0 animate-pulse"></span>
                <span class="text-sm font-medium text-neutral-200 truncate">${pin.rotulo || "Estrutura"}</span>
              </div>
              <span class="text-xs text-neutral-500 group-hover:text-[#c8ad5f] shrink-0 transition-colors">Focar &rarr;</span>
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
      class="text-xs text-neutral-500 hover:text-[#c8ad5f] transition-colors flex items-center gap-1 cursor-pointer mt-6 border-t border-white/[0.06] pt-4 w-fit"
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
    el.className = "pin-link text-[#c8ad5f] hover:text-[#e0c97f] underline underline-offset-2 font-medium cursor-pointer transition-colors px-0.5";
  });
}

// ---------------------------------------------------------------------------
// 4.5 Abas do Painel Lateral e Questões Práticas de Bancada
// ---------------------------------------------------------------------------
let abaAtivaPainel = "descricao";
const debounceTimersRespostas = {};

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

  const estiloAtivo   = "min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer bg-white/[0.08] text-white border border-white/[0.1] shadow-sm touch-manipulation flex items-center justify-center";
  const estiloInativo = "min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent touch-manipulation flex items-center justify-center";

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
 * Destaque sutil com cor ouro-champanhe se houver questões, ou neutro/apagado se 0.
 */
function atualizarBadgeContadorQuestoes() {
  const badge = document.getElementById("badgeContadorQuestoes");
  if (!badge) return;

  const total = Array.isArray(listaQuestoesAtual) ? listaQuestoesAtual.length : 0;
  badge.textContent = String(total);

  if (total > 0) {
    badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-[#c8ad5f]/20 text-[#c8ad5f] border border-[#c8ad5f]/30 font-mono font-medium";
  } else {
    badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-neutral-400 font-mono border border-transparent";
  }
}

/**
 * Escapa strings para inserção segura no DOM.
 */
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    statusEl.classList.remove("text-neutral-500");
    statusEl.classList.add("text-[#c8ad5f]");
  }

  clearTimeout(debounceTimersRespostas[idSeguro]);
  debounceTimersRespostas[idSeguro] = setTimeout(() => {
    try {
      const chave = `palasAtlas.respostas.${laminaId}.${idSeguro}`;
      localStorage.setItem(chave, texto);
      if (statusEl) {
        statusEl.textContent = "Salvo localmente";
        statusEl.classList.remove("text-[#c8ad5f]");
        statusEl.classList.add("text-neutral-500");
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
      statusEl.classList.remove("text-[#c8ad5f]");
      statusEl.classList.add("text-neutral-500");
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
        <div class="w-10 h-10 mx-auto rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L18 8.5V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <p class="text-xs text-neutral-400 font-sans leading-relaxed max-w-xs mx-auto">
          Nenhuma questão de bancada cadastrada para esta lâmina pelo professor.
        </p>
        <span class="inline-block text-[10px] font-mono text-neutral-500 tracking-wider uppercase">
          Atividades Práticas de Laboratório
        </span>
      </div>
    `;
    return;
  }

  const cardsHtml = questoes.map((q, index) => {
    const qId = q.id ? String(q.id) : `q_${index + 1}`;
    q.id = qId;
    const numeroQ = q.numero !== undefined && q.numero !== null ? q.numero : (index + 1);
    const tituloQ = q.titulo || q.pergunta || (q.enunciado ? (q.enunciado.length > 70 ? q.enunciado.slice(0, 67) + '...' : q.enunciado) : `Questão ${numeroQ}`);
    const enunciadoQ = q.enunciado && q.enunciado !== tituloQ ? q.enunciado : "";

    const chaveStorage = `palasAtlas.respostas.${laminaId}.${qId}`;
    let respostaSalva = "";
    try {
      respostaSalva = localStorage.getItem(chaveStorage) || "";
    } catch (e) {
      console.warn("[Palas Atlas] Falha ao recuperar resposta salva:", e);
    }

    const temCoordenadas = (Number(q.x) > 0 || Number(q.y) > 0);

    return `
      <div
        id="card-questao-${qId}"
        data-questao-id="${qId}"
        class="card-questao rounded-xl border border-white/[0.06] bg-neutral-900/40 p-4 transition-all duration-200 hover:border-white/[0.12] space-y-3"
      >
        <!-- Cabeçalho Clicável da Questão -->
        <button
          type="button"
          onclick="window.focarQuestaoNoViewer('${qId}')"
          class="w-full text-left flex items-start justify-between gap-3 group cursor-pointer focus:outline-none"
          title="Focar localização da questão no microscópio"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#c8ad5f]/15 text-[#c8ad5f] border border-[#c8ad5f]/30 shrink-0 mt-0.5">
              Q${numeroQ}
            </span>
            <div class="min-w-0">
              <h4 class="text-xs font-semibold text-neutral-200 tracking-wide font-sans group-hover:text-[#c8ad5f] transition-colors leading-snug">
                ${escaparHTML(tituloQ)}
              </h4>
            </div>
          </div>
          ${temCoordenadas ? `
            <div class="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400 group-hover:text-[#c8ad5f] shrink-0 transition-colors pt-0.5">
              <span>Focar</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </div>
          ` : ''}
        </button>

        <!-- Enunciado e Orientação Diagnóstica -->
        ${enunciadoQ ? `
          <div class="text-xs text-neutral-300 font-sans leading-relaxed border-l-2 border-white/[0.08] ml-1 pl-2.5">
            ${escaparHTML(enunciadoQ)}
          </div>
        ` : ''}

        <!-- Área de Anotação / Resposta do Estudante (sem gabarito) -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span class="text-neutral-400">Resposta / Diagnóstico</span>
            <span id="statusSalvo-${qId}" class="text-neutral-500 transition-colors">
              ${respostaSalva ? "Salvo localmente" : ""}
            </span>
          </div>
          <textarea
            id="resposta-${qId}"
            data-questao-id="${qId}"
            rows="3"
            placeholder="Sua anotação / resposta diagnóstica..."
            style="resize:vertical; min-height:72px;"
            class="w-full bg-neutral-950/80 border border-white/[0.08] focus:border-[#c8ad5f]/60 focus:ring-1 focus:ring-[#c8ad5f]/40 rounded-lg p-2.5 text-xs text-neutral-200 placeholder-neutral-500 font-sans leading-relaxed outline-none transition-all"
          >${escaparHTML(respostaSalva)}</textarea>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="space-y-3 pt-1">
      <div class="flex items-center justify-between px-0.5 pb-1">
        <span class="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
          Caderno de Bancada
        </span>
        <span class="text-[10px] font-mono text-neutral-500">
          ${questoes.length} ${questoes.length === 1 ? 'questão' : 'questões'}
        </span>
      </div>
      ${cardsHtml}
    </div>
  `;

  // Anexa listeners de input e blur usando delegação de eventos estável
  if (!container.__eventosRespostasVinculados) {
    container.__eventosRespostasVinculados = true;
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
      card.classList.add("border-[#c8ad5f]/70", "bg-neutral-900/90", "ring-1", "ring-[#c8ad5f]/40", "shadow-lg", "shadow-[#c8ad5f]/5");
      card.classList.remove("border-white/[0.06]", "bg-neutral-900/40");
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      card.classList.remove("border-[#c8ad5f]/70", "bg-neutral-900/90", "ring-1", "ring-[#c8ad5f]/40", "shadow-lg", "shadow-[#c8ad5f]/5");
      card.classList.add("border-white/[0.06]", "bg-neutral-900/40");
    }
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
    exibirErroMicroscopio("Biblioteca OpenSeadragon não carregada. Atualize a página.");
    return;
  }

  let imagemUrl = laminaAtualData.imagemUrl || laminaAtualData.imageUrl || laminaAtualData.dziUrl || "";
  if (typeof imagemUrl === "string") {
    imagemUrl = imagemUrl.trim();
  }
  if (!imagemUrl) {
    exibirErroMicroscopio("Esta lâmina não possui URL de imagem cadastrada.");
    return;
  }

  const previewFallback = laminaAtualData.previewImage || laminaAtualData.thumbnailUrl || "";

  if (viewer && typeof viewer.destroy === "function") {
    try {
      viewer.destroy();
    } catch (e) {}
    viewer = null;
  }

  const isDzi = imagemUrl.endsWith(".dzi") || imagemUrl.includes(".dzi?");
  const tileSourcesConfig = isDzi ? imagemUrl : { type: "image", url: imagemUrl };

  // MPP da lamina (microns por pixel) — usado pela scalebar
  const mpp = Number(laminaAtualData.mpp) || 0.25;
  const pixelsPerMeter = Math.round(1e6 / mpp);

  // Limite de zoom máximo baseado na objetiva real da lâmina
  const maxMag = Number(laminaAtualData.maxMagnification || laminaAtualData.maxZoomLevel || laminaAtualData.maxMag) || 40;
  const maxZoomPixelRatioMap = { 40: 1.15, 60: 1.25, 100: 1.35 };
  const maxZoomPixelRatio = maxZoomPixelRatioMap[maxMag] || 1.15;

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
      navigatorBackground:      "rgba(10,10,10,0.85)",
      navigatorBorderColor:     "rgba(200,173,95,0.35)",
      navigatorAutoFade:        true,
      showReferenceStrip:       false,
      animationTime:            0.45,
      blendTime:                0.1,
      maxZoomPixelRatio:        maxZoomPixelRatio,

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
  } catch (err) {
    console.error("[Palas Atlas] Erro fatal ao instanciar OpenSeadragon:", err);
    exibirErroMicroscopio("Falha na inicialização do visualizador óptico.");
    return;
  }

  // Configuração base da régua
  if (window.OpenSeadragon.ScalebarType && viewer) {
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

  // Tratamento de falha no carregamento do DZI/imagem (Tratamento Robusto)
  const onOpenFailed = (event) => {
    console.warn("[Palas Atlas] OpenSeadragon open-failed:", event);
    if (!fallbackAttempted && isDzi && previewFallback && previewFallback !== imagemUrl) {
      fallbackAttempted = true;
      console.info("[Palas Atlas] Tentando fallback para imagem estática:", previewFallback);
      try {
        viewer.open({ type: "image", url: previewFallback });
        return;
      } catch (err) {
        console.error("[Palas Atlas] Falha ao tentar abrir fallback:", err);
      }
    }
    hasFailed = true;
    exibirErroMicroscopio(`Não foi possível carregar o arquivo da lâmina digital. Verifique sua conexão ou tente novamente.`);
  };

  viewer.addHandler("open-failed", onOpenFailed);

  // Evento: imagem aberta com sucesso
  const onOpenSuccess = () => {
    if (hasFailed) return;
    const elapsed = Date.now() - (window.__microscopeStartTime || Date.now());
    const remainingTime = 0;

    setTimeout(() => {
      // Remove skeleton de carregamento de forma imediata e limpa
      const skeleton  = document.getElementById("osdSkeleton");
      const osdCanvas = document.getElementById("osd-viewer");
      if (skeleton) {
        skeleton.style.transition = 'opacity 200ms ease-out';
        skeleton.style.opacity = '0';
        skeleton.style.pointerEvents = 'none';
        setTimeout(() => {
          skeleton.style.display = 'none';
          skeleton.classList.add("hidden");
          skeleton.classList.remove("flex");
        }, 210);
      }
      if (osdCanvas) osdCanvas.classList.remove("opacity-0");
    }, remainingTime);

    if (viewer && viewer.viewport) {
      homeZoomRef = viewer.viewport.getHomeZoom();
      nativeZoomRef = viewer.viewport.imageToViewportZoom(1);
      
      // Limites de ampliação configurados por lâmina (teto estipulado 40x, 60x, 100x)
      const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;

      const zoom4x = getZoom4xRef();
      const minOSDZoom = zoom4x;
      const maxOSDZoom = calcularZoomParaMagnificacao(maxMag) * 1.05;

      viewer.viewport.minZoomLevel = minOSDZoom;
      viewer.viewport.maxZoomLevel = maxOSDZoom;

      const urlParams = new URLSearchParams(window.location.search);
      const initialMagParam = urlParams.get("mag");
      // Padrão de abertura morfológica: visão panorâmica (4x) para enquadramento inicial da lâmina inteira
      const targetInitialMag = initialMagParam !== null ? Number(initialMagParam) : 4;
      const targetInitialZoom = calcularZoomParaMagnificacao(targetInitialMag);

      const imgBounds = viewer.world.getItemAt(0)?.getBounds();
      const centerPoint = imgBounds ? imgBounds.getCenter() : viewer.viewport.getCenter();

      // Ponto focal inicial da lâmina (se especificado) ou ponto morfológico de interesse
      let initialPoint = centerPoint;
      if (targetInitialMag > 4 && laminaAtualData?.defaultCenter) {
        initialPoint = new window.OpenSeadragon.Point(
          laminaAtualData.defaultCenter.x,
          laminaAtualData.defaultCenter.y
        );
      }

      viewer.viewport.zoomTo(targetInitialZoom, initialPoint, true);
      viewer.viewport.panTo(initialPoint, true);
    }

    aplicarBloqueioObjetivas(maxMag);
    atualizarLenteBotaoAtivo();
    updateZoomDisplay();

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

      const scalebarEl = document.querySelector(".openseadragon-scalebar");
      if (scalebarEl) {
        Object.assign(scalebarEl.style, {
          borderRadius: "8px",
          padding:      "4px 12px",
          backdropFilter: "blur(8px)",
          border:       "1px solid rgba(63, 63, 70, 0.8)",
          fontSize:     "10px",
          fontWeight:   "600"
        });
      }
    }, 400);
  };

  viewer.addHandler("open", onOpenSuccess);
  if (typeof viewer.isOpen === "function" && viewer.isOpen()) {
    onOpenSuccess();
  }

  // Garantia absoluta contra travamentos no carregador (Timeout de segurança)
  setTimeout(() => {
    const skeleton = document.getElementById("osdSkeleton");
    if (skeleton && skeleton.style.display !== "none" && !skeleton.classList.contains("hidden")) {
      if (!viewer || !viewer.isOpen()) {
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

  viewer.addHandler("open", updateZoomDisplay);
  viewer.addHandler("animation", updateZoomDisplay);
  viewer.addHandler("animation-finish", updateZoomDisplay);

  viewer.addHandler("zoom", () => {
    if (!homeZoomRef || !viewer || !viewer.viewport) return;
    const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
    const zoom4x = getZoom4xRef();
    const minOSDZoom = zoom4x;
    const maxOSDZoom = calcularZoomParaMagnificacao(maxMag) * 1.05;

    // Clamping estrito impedindo ultrapassar o teto físico ou desaproximar além da visão mínima (4x)
    const current = viewer.viewport.getZoom();
    if (current < minOSDZoom) {
      viewer.viewport.zoomTo(minOSDZoom, null, true);
    } else if (current > maxOSDZoom) {
      viewer.viewport.zoomTo(maxOSDZoom, null, true);
    }

    updateZoomDisplay();
  });
}

// ---------------------------------------------------------------------------
// 5.5 Cálculo Dinâmico de Magnificação Ótica Real & Formatação Legível
// ---------------------------------------------------------------------------
/**
 * Retorna o zoom interno do OpenSeadragon correspondente à objetiva de 4x.
 * Na objetiva de 4x, o campo de visão ótico real é amplo (~5.5 mm), fazendo com que
 * a amostra histológica (com cerca de 1.5 mm) ocupe aproximadamente 28% da tela,
 * deixando margens pretas ao redor ("espaços em preto" característicos da visão macroscópica).
 */
export function getZoom4xRef() {
  if (!viewer || !viewer.viewport) return 1.0;
  const baseHome = homeZoomRef || viewer.viewport.getHomeZoom() || 1.0;
  return baseHome * 0.28;
}

/**
 * Converte um valor nominal de ampliação ótica (ex: 4, 10, 40, 60, 100)
 * para o nível de zoom correspondente no OpenSeadragon.
 */
export function calcularZoomParaMagnificacao(mag) {
  const z4 = getZoom4xRef();
  const m = Number(mag) || 4;
  return z4 * (m / 4);
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

  // Relação ótica linear direta: Magnificação = 4 * (zoomAtual / zoom4x)
  const magRaw = 4 * (currentZoom / z4);

  // Snap suave para valores nominais se muito próximo (dentro de margem imperceptível)
  if (Math.abs(magRaw - 4) < 0.2) return 4;
  if (Math.abs(magRaw - 10) < 0.3) return 10;
  if (Math.abs(magRaw - 40) < 0.8) return 40;
  if (Math.abs(magRaw - 60) < 1.0) return 60;
  if (Math.abs(magRaw - 100) < 1.5) return 100;

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
      ? "lens-btn bg-[#c8ad5f] text-neutral-950 font-bold shadow-md shadow-[#c8ad5f]/25 px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-lg text-xs font-mono transition-all active-lens cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0"
      : "lens-btn text-neutral-400 hover:text-white hover:bg-white/[0.06] active:bg-white/10 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
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
      btn.className = "lens-btn text-neutral-600 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-lg text-xs font-mono cursor-not-allowed opacity-25 min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
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
// 8. Foca o pino no viewer com zoom real e overlay neon
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

  // Remove pin de questão ativa se houver
  if (overlayQuestaoAtiva) {
    try { viewer.removeOverlay(overlayQuestaoAtiva); } catch (e) {}
    overlayQuestaoAtiva = null;
    questaoAtivaId = null;
  }

  // Cria elemento do pino neon pulsante em ouro-champanhe
  const pinId   = String(pino.id);
  const pinElem = document.createElement("div");
  pinElem.id    = `viewer-pin-${pinId}`;
  pinElem.style.cssText = "pointer-events:none; position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; z-index:40;";
  pinElem.innerHTML = `
    <div class="animate-ping" style="position:absolute;width:100%;height:100%;background:rgba(200,173,95,0.45);border-radius:50%;"></div>
    <div style="position:relative;width:14px;height:14px;background:#c8ad5f;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 0 3px rgba(200,173,95,0.45),0 4px 16px rgba(0,0,0,0.8);"></div>
  `;

  // Adiciona overlay ancorado no ponto exato da imagem
  viewer.addOverlay({
    element:   pinElem,
    location:  pontoViewport,
    placement: window.OpenSeadragon.Placement.CENTER
  });

  // Zoom no ponto de interesse: amplia para visualização celular detalhada (~3.5x do home zoom ou valor configurado no pino)
  const homeZoom = homeZoomRef || viewer.viewport.getHomeZoom();
  let targetZoom = homeZoom * 3.5;
  if (pino.zoom && Number(pino.zoom) > 0) {
    targetZoom = Number(pino.zoom);
  } else {
    targetZoom = Math.max(viewer.viewport.getZoom(), homeZoom * 3.2);
  }
  if (viewer.viewport.maxZoomLevel) {
    targetZoom = Math.min(targetZoom, viewer.viewport.maxZoomLevel * 0.95);
  }

  // Aproximação suave e centralização no pino
  viewer.viewport.zoomTo(targetZoom, pontoViewport, false);
  viewer.viewport.panTo(pontoViewport, false);

  pinAtivo = pinId;

  // No mobile/tablet, fecha o drawer lateral para exibir o ponto focado no microscópio
  if (isMobileOrLandscapeDrawer()) {
    aplicarEstadoSidebar(true, false);
  }

  // Auto-remove o marcador após 8s
  setTimeout(() => {
    if (pinElem && viewer) {
      try { viewer.removeOverlay(pinElem); } catch (e) {}
      if (pinAtivo === pinId) pinAtivo = null;
    }
  }, 8000);
}

/**
 * Localiza e foca uma questão prática de bancada no visualizador OpenSeadragon.
 * Realiza a conversão precisa de coordenadas, insere um overlay pulsante
 * em ouro-champanhe / ciano e navega com transição suave (pan & zoom).
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

  // No mobile/tablet, fecha o drawer lateral para exibir o ponto focado no microscópio
  if (isMobileOrLandscapeDrawer()) {
    aplicarEstadoSidebar(true, false);
  }

  if (!viewer || !viewer.viewport || !window.OpenSeadragon) {
    console.warn("[Palas Atlas] Viewer OpenSeadragon não inicializado ao tentar focar questão.");
    return;
  }

  const temX = q.x !== undefined && q.x !== null && !isNaN(Number(q.x));
  const temY = q.y !== undefined && q.y !== null && !isNaN(Number(q.y));
  if (!temX && !temY) {
    return;
  }

  let posX = Number(q.x) || 0;
  let posY = Number(q.y) || 0;

  // Se coordenadas estiverem normalizadas (0 a 1), converte para pixels originais da imagem
  if (posX > 0 && posX <= 1 && viewer.world && viewer.world.getItemAt(0)) {
    const item = viewer.world.getItemAt(0);
    const size = item.getContentSize();
    if (size && size.x > 1) {
      posX *= size.x;
      posY *= size.y;
    }
  }

  // Converte coordenadas usando OpenSeadragon
  const pontoViewport = viewer.viewport.imageToViewportCoordinates(
    new window.OpenSeadragon.Point(posX, posY)
  );

  // Remove overlay de questão ativa anterior
  if (overlayQuestaoAtiva) {
    try {
      viewer.removeOverlay(overlayQuestaoAtiva);
    } catch (e) {}
    overlayQuestaoAtiva = null;
  }
  if (questaoAtivaId) {
    const elemAnterior = document.getElementById(`viewer-qpin-${questaoAtivaId}`);
    if (elemAnterior) {
      try { viewer.removeOverlay(elemAnterior); } catch (e) {}
    }
  }

  // Remove pino comum de estrutura ativo se houver
  if (pinAtivo) {
    const anteriorPin = document.getElementById(`viewer-pin-${pinAtivo}`);
    if (anteriorPin) {
      try { viewer.removeOverlay(anteriorPin); } catch (e) {}
      pinAtivo = null;
    }
  }

  const numeroQ = q.numero !== undefined && q.numero !== null ? q.numero : (listaQuestoesAtual.indexOf(q) + 1);

  // Cria elemento do pino pulsante com outer glowing ring em ouro-champanhe/ciano e inner badge
  const pinElem = document.createElement("div");
  pinElem.id = `viewer-qpin-${q.id}`;
  pinElem.className = "viewer-qpin cursor-pointer";
  pinElem.style.cssText = "position:relative; display:flex; align-items:center; justify-content:center; width:46px; height:46px; z-index:45; pointer-events:auto;";
  pinElem.title = `Questão Q${numeroQ}: ${q.titulo || "Ponto de Investigação"}`;

  pinElem.innerHTML = `
    <div class="animate-ping" style="position:absolute; width:100%; height:100%; border-radius:9999px; background:radial-gradient(circle, rgba(200,173,95,0.4) 0%, rgba(6,182,212,0.25) 70%, transparent 100%); border:1.5px solid rgba(200,173,95,0.7);"></div>
    <div style="position:relative; min-width:32px; height:32px; padding:0 6px; background:#0a0a0a; border-radius:9999px; border:1.5px solid #c8ad5f; box-shadow:0 0 0 2px rgba(6,182,212,0.35), 0 0 16px rgba(200,173,95,0.5), 0 4px 14px rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; gap:2px;">
      <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">Q${numeroQ}</span>
    </div>
  `;

  pinElem.addEventListener("click", (e) => {
    e.stopPropagation();
    alternarAbaPainel("questoes");
    destacarCardQuestaoNaSidebar(idBuscado);
    if (isMobileOrLandscapeDrawer()) {
      aplicarEstadoSidebar(false, false);
    }
  });

  viewer.addOverlay({
    element: pinElem,
    location: pontoViewport,
    placement: window.OpenSeadragon.Placement.CENTER
  });

  overlayQuestaoAtiva = pinElem;
  questaoAtivaId = idBuscado;

  // Pan & Zoom suave para a localização
  let targetZoom = (q.zoom && Number(q.zoom) > 0)
    ? Number(q.zoom)
    : Math.max(viewer.viewport.getZoom(), (homeZoomRef || 1) * 3.5);

  if (viewer.viewport.maxZoomLevel) {
    targetZoom = Math.min(targetZoom, viewer.viewport.maxZoomLevel * 0.95);
  }

  viewer.viewport.zoomTo(targetZoom, pontoViewport, false);
  viewer.viewport.panTo(pontoViewport, false);
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
    l.className = "lens-btn text-neutral-400 hover:text-white hover:bg-white/[0.06] active:bg-white/10 font-medium px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
  });

  if (targetBtn && !targetBtn.disabled) {
    targetBtn.className = "lens-btn bg-[#c8ad5f] text-neutral-950 font-bold shadow-md shadow-[#c8ad5f]/25 px-2.5 sm:px-3 lg:px-2.5 py-1.5 lg:py-1 rounded-lg text-xs font-mono transition-all cursor-pointer active-lens touch-manipulation min-w-[42px] min-h-[38px] lg:min-w-0 lg:min-h-0 flex items-center justify-center shrink-0";
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
  if (descEl) descEl.innerHTML = `<p class="text-neutral-500 italic text-sm font-sans">Não foi possível recuperar os dados morfológicos desta peça.</p>`;
  listaQuestoesAtual = [];
  atualizarBadgeContadorQuestoes();
  renderizarQuestoesNaSidebar([]);

  const container = document.getElementById("osd-viewer");
  if (!container) return;
  container.classList.remove("opacity-0");
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full text-center gap-4 p-8">
      <div class="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-center justify-center shadow-lg shadow-rose-950/20">
        <svg class="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-white tracking-wide">Falha no Carregamento</h3>
        <p class="text-rose-400 text-xs font-mono max-w-sm leading-relaxed">${msg}</p>
      </div>
      <div class="flex items-center gap-3 mt-3">
        <button type="button" onclick="window.location.reload()" class="px-4 py-2 text-xs font-mono font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer">
          Recarregar
        </button>
        <a href="index.html" class="px-4 py-2 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl transition-all">
          Voltar ao Início
        </a>
      </div>
    </div>
  `;
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
  trocarLente,
  alterarZoom,
  calcularMagnificacaoOtica,
  formatarMagnificacaoOtica,
  getZoom4xRef,
  calcularZoomParaMagnificacao,
  sanitizarHTMLDescricao,
  aplicarEstadoSidebar,
  fecharSidebar: () => aplicarEstadoSidebar(true, true),
  abrirSidebar:  () => aplicarEstadoSidebar(false, true)
});
window.osdViewerAction              = osdViewerAction;
window.focarPinoNoViewer            = focarPinoNoViewer;
window.focarQuestaoNoViewer         = focarQuestaoNoViewer;
window.alternarAbaPainel            = alternarAbaPainel;
window.renderizarQuestoesNaSidebar  = renderizarQuestoesNaSidebar;
window.carregarLaminaPorId          = carregarLaminaNoMicroscopio;
window.trocarLente                  = trocarLente;
window.alterarZoom                  = alterarZoom;
window.calcularMagnificacaoOtica     = calcularMagnificacaoOtica;
window.formatarMagnificacaoOtica     = formatarMagnificacaoOtica;
window.getZoom4xRef                 = getZoom4xRef;
window.calcularZoomParaMagnificacao = calcularZoomParaMagnificacao;
window.sanitizarHTMLDescricao       = sanitizarHTMLDescricao;
window.aplicarEstadoSidebar         = aplicarEstadoSidebar;
window.fecharSidebar                = () => aplicarEstadoSidebar(true, true);
window.abrirSidebar                 = () => aplicarEstadoSidebar(false, true);

export {
  carregarLaminaNoMicroscopio as carregarLaminaPorId,
  aplicarEstadoSidebar
};
