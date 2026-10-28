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

function aplicarEstadoSidebar(recolhida, persistir) {
  const sidebar = document.getElementById("viewerSidebar");
  const botao   = document.getElementById("btnToggleSidebar");
  if (!sidebar) return;

  sidebar.classList.toggle("w-[85vw]", !recolhida);
  sidebar.classList.toggle("sm:w-[380px]", !recolhida);
  sidebar.classList.toggle("opacity-100", !recolhida);
  sidebar.classList.toggle("pointer-events-auto", !recolhida);
  sidebar.classList.toggle("w-0", recolhida);
  sidebar.classList.toggle("opacity-0", recolhida);
  sidebar.classList.toggle("pointer-events-none", recolhida);
  sidebar.setAttribute("aria-hidden", String(recolhida));
  if (recolhida) sidebar.setAttribute("inert", ""); else sidebar.removeAttribute("inert");

  if (botao) {
    botao.setAttribute("aria-expanded", String(!recolhida));
    const rotulo = recolhida ? "Expandir painel" : "Recolher painel";
    botao.setAttribute("title", rotulo);
    botao.setAttribute("aria-label", recolhida ? "Expandir painel de informações" : "Recolher painel de informações");
  }
  if (persistir) {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, recolhida ? "1" : "0"); } catch (e) {}
  }
}

function iniciarSidebarRetratil() {
  const sidebar = document.getElementById("viewerSidebar");
  const botao   = document.getElementById("btnToggleSidebar");
  if (!sidebar || !botao) return;

  let recolhidaInicial = false;
  try {
    const salvo = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (salvo !== null) {
      recolhidaInicial = salvo === "1";
    } else {
      recolhidaInicial = window.innerWidth < 768;
    }
  } catch (e) {
    recolhidaInicial = window.innerWidth < 768;
  }
  aplicarEstadoSidebar(recolhidaInicial, false);

  botao.addEventListener("click", () => {
    aplicarEstadoSidebar(!sidebar.classList.contains("w-0"), true);
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
    pinos: []
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
      pinos: []
    };
    listaPinosAtual = [];
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
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
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
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
        renderizarMetadadosDaLamina();
        renderizarDescricaoETextos();
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
    renderizarMetadadosDaLamina();
    renderizarDescricaoETextos();
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

  // Garantir dimensões explícitas no container
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "400px";

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

      // Pan livre com limites suaves
      panHorizontal:            true,
      panVertical:              true,
      constrainDuringPan:       true,
      visibilityRatio:          0.75,
      minZoomImageRatio:        0.8,

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
        pinchRotate:    false
      }
    });
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

      // Ancoragem na resolução nativa da câmera (1:1), com headroom suave de até 15%
      const minOSDZoom = homeZoomRef;
      const maxOSDZoom = Math.max(homeZoomRef * 1.5, nativeZoomRef * 1.15);

      viewer.viewport.minZoomLevel = minOSDZoom;
      viewer.viewport.maxZoomLevel = maxOSDZoom;
      viewer.viewport.goHome(true);
    }

    aplicarBloqueioObjetivas(maxMag);

    const urlParams = new URLSearchParams(window.location.search);
    const initialMagParam = urlParams.get("mag");
    // Padrão de abertura do laboratório: abre diretamente na resolução de captura (40x), permitindo override via ?mag=
    const targetInitialMag = initialMagParam !== null ? Number(initialMagParam) : (maxMag >= 40 ? 40 : maxMag);

    if (targetInitialMag && targetInitialMag > 4) {
      setTimeout(() => {
        trocarLente(targetInitialMag);
      }, 50);
    } else {
      atualizarLenteBotaoAtivo();
    }

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

  viewer.addHandler("zoom", () => {
    if (!homeZoomRef || !viewer || !viewer.viewport) return;
    const nativeZoom = nativeZoomRef || viewer.viewport.imageToViewportZoom(1);
    const minOSDZoom = homeZoomRef;
    const maxOSDZoom = Math.max(homeZoomRef * 1.5, nativeZoom * 1.15);

    // Clamping estrito impedindo ultrapassar o teto físico ou desaproximar além do enquadramento inicial
    const current = viewer.viewport.getZoom();
    if (current < minOSDZoom) {
      viewer.viewport.zoomTo(minOSDZoom, null, true);
    } else if (current > maxOSDZoom) {
      viewer.viewport.zoomTo(maxOSDZoom, null, true);
    }

    atualizarLenteBotaoAtivo();
    updateZoomDisplay();
  });
}

// ---------------------------------------------------------------------------
// 5.5 Cálculo Dinâmico de Magnificação Ótica Real & Formatação Legível
// ---------------------------------------------------------------------------
/**
 * Converte o zoom interno do OpenSeadragon (viewer.viewport.getZoom(true))
 * para o equivalente de ampliação ótica real baseado na resolução nativa da câmera.
 *
 * @param {number} [osdZoom] - Zoom interno OSD opcional
 * @returns {number} Magnificação ótica numérica (ex: 4.0, 10.0, 40.0)
 */
export function calcularMagnificacaoOtica(osdZoom) {
  if (!viewer || !viewer.viewport) return 4;
  const baseHome = homeZoomRef || viewer.viewport.getHomeZoom();
  const nativeZoom = nativeZoomRef || viewer.viewport.imageToViewportZoom(1);
  if (!baseHome || baseHome <= 0) return 4;

  const currentZoom = typeof osdZoom === "number" ? osdZoom : viewer.viewport.getZoom(true);
  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;

  // No enquadramento geral inicial (home), a visão panorâmica representa 4x
  if (currentZoom <= baseHome * 1.02) {
    return 4;
  }

  // Interpolação ótica proporcional entre a visão panorâmica (4x no homeZoom)
  // e a resolução nativa da objetiva de captura (maxMag no nativeZoom)
  const ratio = (currentZoom - baseHome) / Math.max(0.0001, (nativeZoom - baseHome));
  const magRaw = 4 + ratio * (maxMag - 4);

  // Clamping rigoroso entre 4x e o teto físico da lâmina (maxMag)
  return Math.max(4, Math.min(maxMag, magRaw));
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
// 6. Atualiza destaque do botao de lente conforme zoom atual (item 4)
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
  } else if (mag >= 6.5) {
    objetivo = "10x";
  }

  document.querySelectorAll(".lens-btn").forEach(btn => {
    // Pula botões bloqueados (disabled) para não sobrescrever classes
    if (btn.disabled) return;

    const magAttr = btn.getAttribute("data-mag");
    const isAtivo = magAttr ? `${magAttr}x` === objetivo : btn.textContent.trim() === objetivo;
    btn.className = isAtivo
      ? "lens-btn bg-[#c8ad5f] text-neutral-950 font-bold shadow-md shadow-[#c8ad5f]/25 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer active-lens"
      : "lens-btn text-neutral-400 hover:text-white hover:bg-white/[0.06] font-medium px-2.5 py-1 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer";
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
      btn.className = "lens-btn text-neutral-600 font-medium px-2.5 py-1 rounded-lg text-xs font-mono cursor-not-allowed opacity-25";
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

  // Auto-remove o marcador após 8s
  setTimeout(() => {
    if (pinElem && viewer) {
      try { viewer.removeOverlay(pinElem); } catch (e) {}
      if (pinAtivo === pinId) pinAtivo = null;
    }
  }, 8000);
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
    viewer.viewport.goHome();
    atualizarLenteBotaoAtivo();
  }
  else if (acaoNorm === "center")   viewer.viewport.panTo(viewer.viewport.getCenter());
  else if (acaoNorm === "fullpage") viewer.setFullPage(!viewer.isFullPage());
}

// ---------------------------------------------------------------------------
// 9.5 Trocar Lente Objetiva — zoom baseado no homeZoomRef como 4x
// ---------------------------------------------------------------------------
export function trocarLente(objetivaDesejada, btnElement) {
  if (!viewer || !viewer.viewport || !homeZoomRef) return;

  const maxMag = Number(laminaAtualData?.maxMagnification || laminaAtualData?.maxZoomLevel || laminaAtualData?.maxMag) || 40;
  const magDesejada = Number(objetivaDesejada) || 4;
  const magClamped = Math.max(4, Math.min(maxMag, magDesejada));
  const nativeZoom = nativeZoomRef || viewer.viewport.imageToViewportZoom(1);

  let targetZoom = homeZoomRef;
  if (magClamped <= 4) {
    targetZoom = homeZoomRef;
  } else if (magClamped >= maxMag) {
    targetZoom = nativeZoom;
  } else {
    const ratio = (magClamped - 4) / (maxMag - 4);
    targetZoom = homeZoomRef + ratio * (nativeZoom - homeZoomRef);
  }

  viewer.viewport.zoomTo(targetZoom, null, false);

  const targetBtn = btnElement || document.querySelector(`.lens-btn[data-mag="${magClamped}"]`) || Array.from(document.querySelectorAll(".lens-btn")).find(b => b.textContent.trim() === `${magClamped}x`);

  document.querySelectorAll(".lens-btn").forEach(l => {
    if (l.disabled) return;
    l.className = "lens-btn text-neutral-400 hover:text-white hover:bg-white/[0.06] font-medium px-2.5 py-1 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer";
  });

  if (targetBtn && !targetBtn.disabled) {
    targetBtn.className = "lens-btn bg-[#c8ad5f] text-neutral-950 font-bold shadow-md shadow-[#c8ad5f]/25 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer active-lens";
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
  trocarLente,
  alterarZoom,
  calcularMagnificacaoOtica,
  formatarMagnificacaoOtica,
  sanitizarHTMLDescricao
});
window.osdViewerAction          = osdViewerAction;
window.focarPinoNoViewer        = focarPinoNoViewer;
window.trocarLente              = trocarLente;
window.alterarZoom              = alterarZoom;
window.calcularMagnificacaoOtica = calcularMagnificacaoOtica;
window.formatarMagnificacaoOtica = formatarMagnificacaoOtica;
window.sanitizarHTMLDescricao   = sanitizarHTMLDescricao;
