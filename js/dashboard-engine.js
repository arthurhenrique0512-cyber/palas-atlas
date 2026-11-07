/**
 * ============================================================================
 * MOTOR DO PAINEL DO DESENVOLVEDOR E CMS DE MAPEAMENTO (PALAS ATLAS V3)
 * ============================================================================
 * CHAVES CANONICAS DO DOCUMENTO FIRESTORE:
 *   nome          -> Nome da lamina
 *   disciplina    -> Disciplina academica
 *   topico        -> Modulo curricular
 *   coloracao     -> Tecnica de coloracao
 *   imagemUrl     -> URL do arquivo .dzi ou imagem estatica (CHAVE CRITICA)
 *   descricaoHTML -> HTML do texto descritivo com pin-link (CHAVE CRITICA)
 *   status        -> 'ativa' ou 'inativa'
 *   pinos         -> Array de marcadores { id, rotulo, x, y }
 * Zero Truncamento | Zero Emojis | Clinical Precision UI
 */

import { db } from "./firebase-config.js";
import { getState, setFrenteAtiva } from "./state.js";
import { sanitizarHTMLDescricao } from "./sanitizer.js";

let editorPins = [];
let editorQuestoes = [];
let modoCriacaoQuestao = false;
let viewerInstance = null;
let laminaEmEdicaoId = null;
let acervoFirestoreCache = [];
let acervoAssetsCache = [];
let modoAnotacaoAtual = "pin"; // 'pin' | 'circle' | 'arrow'
let raioCirculoAtual = 250;
let setaPontoOrigem = null;
let filtroStatusAtual = "todos";
let _unsubDashboardAcervo = null;
let moduloEmEdicaoId = null;
let moduloEmEdicaoDisciplina = null;
let summaryPointsEmEdicao = [];
let laminasDoModuloCache = [];

const topicosCurriculares = {
  anatomia: [
    { id: "macro_sistemas", nome: "Macroscopia Geral e Esferas Organicas" },
    { id: "neuroanatomia", nome: "Neuroanatomia e Encefalo" },
    { id: "cardiovascular", nome: "Coracao e Grandes Vasos" },
    { id: "locomotor", nome: "Sistema Locomotor e Osseo" },
    { id: "esplanchnologia", nome: "Esplanchnologia e Visceras Toracoabdominais" }
  ],
  histologia: [
    { id: "epitelial", nome: "Tecido Epitelial de Revestimento e Glandular" },
    { id: "conjuntivo", nome: "Tecido Conjuntivo Propriamente Dito" },
    { id: "adiposo", nome: "Tecido Adiposo Unilocular e Multilocular" },
    { id: "cartilaginoso", nome: "Tecido Cartilaginoso Hialino, Elastico e Fibroso" },
    { id: "osseo", nome: "Tecido Osseo Compacto e Esponjoso" },
    { id: "nervoso", nome: "Tecido Nervoso e Celulas da Neuroglia" },
    { id: "muscular", nome: "Tecido Muscular Estriado Esqueletico, Cardiaco e Liso" },
    { id: "circulatorio", nome: "Sistema Circulatorio e Microvascularizacao" }
  ],
  patologia: [
    { id: "lesao_celular", nome: "Lesao, Adaptacao e Morte Celular (Necroses e Apoptose)" },
    { id: "inflamacao", nome: "Inflamacao Aguda e Cronica" },
    { id: "reparo_tecidual", nome: "Reparo Tecidual, Regeneracao e Cicatrizacao" },
    { id: "hemodinamicos", nome: "Disturbios Hemodinamicos e Trombose" },
    { id: "neoplasias", nome: "Neoplasias e Oncologia Patologica" }
  ],
  parasitologia: [
    { id: "protozoologia", nome: "Protozoologia (Trypanosoma, Leishmania e Plasmodium)" },
    { id: "helmintologia", nome: "Helmintologia (Nematodeos, Platyhelminthes e Trematodeos)" },
    { id: "ectoparasitos", nome: "Ectoparasitos e Artropodes Vetores" }
  ],
  microbiologia: [
    { id: "bacteriologia", nome: "Bacteriologia Medica (Cocos Gram+ / Cocos Gram- / Bacilos)" },
    { id: "micobaterias", nome: "Micobiologia e Bacilos Alcool-Acido Resistentes (BAAR)" },
    { id: "micologia", nome: "Micologia Medica e Fungos Oportunistas" },
    { id: "virologia", nome: "Virologia e Efeitos Citopatogenicos em Tecido" }
  ]
};

export function toggleDashboard() {
  const currentState = getState();
  if (currentState && currentState.frenteAtiva === "dashboard") {
    if (window.App && typeof window.App.goHome === "function") {
      window.App.goHome();
    } else {
      setFrenteAtiva(null);
    }
  } else {
    setFrenteAtiva("dashboard");
    inicializarPainelCms();
  }
}

export function alternarTopicoCms(topico) {
  const contEditor = document.getElementById("topicoCmsEditor");
  const contAcervo = document.getElementById("topicoCmsAcervo");
  const contModulos = document.getElementById("topicoCmsModulos");

  if (topico !== "editor" && viewerInstance && typeof viewerInstance.destroy === "function") {
    try { viewerInstance.destroy(); } catch(e) {}
    viewerInstance = null;
  }
  
  const btnEditor = document.getElementById("btnTopicoEditor");
  const btnAcervo = document.getElementById("btnTopicoAcervo");
  const btnModulos = document.getElementById("btnTopicoModulos");
  
  const clsAtivo = "px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase flex items-center gap-2 rounded-lg transition-all duration-200 cursor-pointer bg-white/[0.06] text-white border border-white/[0.08] shadow-sm";
  const clsInativo = "px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase flex items-center gap-2 rounded-lg transition-all duration-200 cursor-pointer text-neutral-400 hover:text-white hover:bg-white/[0.03]";
  
  if (contEditor) contEditor.classList.add("hidden");
  if (contAcervo) contAcervo.classList.add("hidden");
  if (contModulos) contModulos.classList.add("hidden");

  [btnEditor, btnAcervo, btnModulos].forEach(btn => {
    if (btn) {
      btn.className = clsInativo;
      const dot = btn.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-neutral-600";
    }
  });

  if (topico === "acervo" || topico === "laminas") {
    if (contAcervo) contAcervo.classList.remove("hidden");
    if (btnAcervo) {
      btnAcervo.className = clsAtivo;
      const dot = btnAcervo.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-[#d4af37]";
    }
    renderizarTabelaAcervo();
  } else if (topico === "modulos" || topico === "resumo") {
    if (contModulos) contModulos.classList.remove("hidden");
    if (btnModulos) {
      btnModulos.className = clsAtivo;
      const dot = btnModulos.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-[#d4af37]";
    }
    popularSelectModulosCms();
    const select = document.getElementById("cmsModuloSelect");
    if (select && select.value && !moduloEmEdicaoId) {
      onModuloSelecionado(select.value);
    } else if (select && !select.value) {
      select.value = "conjuntivo";
      onModuloSelecionado("conjuntivo");
    }
  } else {
    if (contEditor) contEditor.classList.remove("hidden");
    if (btnEditor) {
      btnEditor.className = clsAtivo;
      const dot = btnEditor.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-[#d4af37]";
    }
  }
}

export function filtroAcervoCms(filtro) {
  filtroStatusAtual = filtro || "todos";
  const btnTodos = document.getElementById("btnFiltroTodos");
  const btnAtivas = document.getElementById("btnFiltroAtivas");
  const btnInativas = document.getElementById("btnFiltroInativas");
  const clsAtivo = "px-3.5 py-1.5 rounded-lg transition-all duration-200 bg-white/[0.06] text-white border border-white/[0.08] cursor-pointer shadow-sm tracking-wider uppercase text-[10px]";
  const clsInativo = "px-3.5 py-1.5 rounded-lg transition-all duration-200 text-neutral-400 hover:text-white hover:bg-white/[0.03] cursor-pointer tracking-wider uppercase text-[10px]";
  if (btnTodos) btnTodos.className = filtroStatusAtual === "todos" ? clsAtivo : clsInativo;
  if (btnAtivas) btnAtivas.className = filtroStatusAtual === "ativa" ? clsAtivo : clsInativo;
  if (btnInativas) btnInativas.className = filtroStatusAtual === "inativa" ? clsAtivo : clsInativo;
}

/* ============================================================================
 * SELETOR DINÂMICO DE ASSETS (LÂMINAS DZI E IMAGENS)
 * ============================================================================ */

export async function carregarListaDeAssets(forcar = false) {
  const seletor = document.getElementById("dashAssetSelector");
  const badgeInfo = document.getElementById("dashAssetInfoBadge");
  if (!seletor) return;

  if (acervoAssetsCache.length > 0 && !forcar) {
    popularSeletorAssets(acervoAssetsCache);
    return;
  }

  seletor.innerHTML = `<option value="">Carregando acervo de lâminas...</option>`;
  try {
    const cacheBuster = `?t=${Date.now()}`;
    let res = await fetch(`assets/histologia/manifest.json${cacheBuster}`);
    if (!res.ok) {
      res = await fetch(`/api/assets${cacheBuster}`);
    }
    const data = await res.json();
    let assets = Array.isArray(data.assets) ? data.assets : [];

    // Lâminas essenciais garantidas sempre presentes no dropdown
    const essenciais = [
      { id: "cw3XGCgUwN71XdlwkUe5", nome: "Osso Maduro v3.0 (40x HD Panorama)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi", largura: 6430, altura: 5630 },
      { id: "FFGk5d9kOAct5HIDdjQ7", nome: "Osso Maduro v2.0 (10x Mapeamento)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct_2.0.dzi", largura: 2300, altura: 3670 },
      { id: "96ZYqoM2SV8p4fB2QgeM", nome: "Osso Maduro Original (40x Desgaste)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct.dzi", largura: 6120, altura: 4944 },
      { id: "a3oRvXvJpMKAtU2RE85q", nome: "Pele Espessa (40x H&E)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/lamina-real1.dzi", largura: 2536, altura: 9370 }
    ];

    essenciais.forEach(e => {
      const idx = assets.findIndex(a => a.id === e.id || a.caminho === e.caminho);
      if (idx === -1) {
        assets.unshift(e);
      }
    });

    acervoAssetsCache = assets;
    popularSeletorAssets(assets);
    if (badgeInfo) {
      badgeInfo.textContent = `${assets.length} lâminas disponíveis no acervo local`;
    }
  } catch (err) {
    console.warn("[Palas Atlas CMS] Falha ao carregar lista dinâmica de assets:", err);
    const fallbackAssets = [
      { id: "cw3XGCgUwN71XdlwkUe5", nome: "Osso Maduro v3.0 (40x HD Panorama)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi", largura: 6430, altura: 5630 },
      { id: "FFGk5d9kOAct5HIDdjQ7", nome: "Osso Maduro v2.0 (10x Mapeamento)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct_2.0.dzi", largura: 2300, altura: 3670 },
      { id: "96ZYqoM2SV8p4fB2QgeM", nome: "Osso Maduro Original (40x Desgaste)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/osso_maduro_desgaste_ct.dzi", largura: 6120, altura: 4944 },
      { id: "a3oRvXvJpMKAtU2RE85q", nome: "Pele Espessa (40x H&E)", tipo: "dzi", formato: "Deep Zoom Image (.dzi)", caminho: "assets/histologia/lamina-real1.dzi", largura: 2536, altura: 9370 }
    ];
    acervoAssetsCache = fallbackAssets;
    popularSeletorAssets(fallbackAssets);
    if (badgeInfo) {
      badgeInfo.textContent = `${fallbackAssets.length} lâminas disponíveis no acervo local`;
    }
  }
}

function popularSeletorAssets(assets) {
  const seletor = document.getElementById("dashAssetSelector");
  if (!seletor) return;

  const inputUrl = document.getElementById("dashImgUrl");
  const urlAtual = inputUrl ? inputUrl.value.trim() : "";

  let html = `<option value="">-- Selecione uma lâmina do acervo --</option>`;

  const dzis = assets.filter(a => a.tipo === "dzi");
  const statics = assets.filter(a => a.tipo !== "dzi");

  if (dzis.length > 0) {
    html += `<optgroup label="Lâminas Piramidais (Deep Zoom DZI)">`;
    dzis.forEach(a => {
      const selected = (urlAtual && (urlAtual === a.caminho || urlAtual.includes(a.id))) ? "selected" : "";
      const dims = a.largura > 0 ? ` [${a.largura}×${a.altura}]` : "";
      html += `<option value="${a.caminho}" data-tipo="dzi" data-nome="${a.nome}" ${selected}>${a.nome}${dims}</option>`;
    });
    html += `</optgroup>`;
  }

  if (statics.length > 0) {
    html += `<optgroup label="Imagens Estáticas (Alta Definição)">`;
    statics.forEach(a => {
      const selected = (urlAtual && (urlAtual === a.caminho || urlAtual.includes(a.id))) ? "selected" : "";
      html += `<option value="${a.caminho}" data-tipo="static" data-nome="${a.nome}" ${selected}>${a.nome}</option>`;
    });
    html += `</optgroup>`;
  }

  seletor.innerHTML = html;
}

export function onAssetSelecionado(caminho) {
  if (!caminho) return;
  const inputUrl = document.getElementById("dashImgUrl");
  const badgeInfo = document.getElementById("dashAssetInfoBadge");
  const nomeInput = document.getElementById("dashNomeLamina");
  
  if (inputUrl) inputUrl.value = caminho;

  const asset = acervoAssetsCache.find(a => a.caminho === caminho || a.url === caminho);
  const isDzi = caminho.endsWith(".dzi") || (asset && asset.tipo === "dzi");

  // Ajusta automaticamente o radio de tipo
  const radioDzi = document.querySelector('input[name="dashImgType"][value="dzi"]');
  const radioStatic = document.querySelector('input[name="dashImgType"][value="static"]');
  if (isDzi && radioDzi) radioDzi.checked = true;
  else if (!isDzi && radioStatic) radioStatic.checked = true;

  if (asset) {
    if (badgeInfo) {
      const dims = asset.largura > 0 ? ` (${asset.largura}×${asset.altura} px)` : "";
      badgeInfo.textContent = `${asset.formato}${dims}`;
    }
    // Sugere o nome formatado caso seja nova lâmina ou nome padrão
    if (nomeInput && (!laminaEmEdicaoId || !nomeInput.value || nomeInput.value.includes("Músculo Estriado Esquelético"))) {
      nomeInput.value = asset.nome;
    }
  }

  carregarImagemNoEditor(caminho, isDzi, false);
  exibirToastDiscreto(`Lâmina "${asset ? asset.nome : caminho}" carregada no canvas`, "emerald");
}

export function alternarModoCaminhoManual() {
  const containerManual = document.getElementById("containerManualPath");
  const containerSelect = document.getElementById("containerAssetSelector");
  const btnToggle = document.getElementById("btnToggleModoCaminho");
  if (!containerManual || !containerSelect) return;

  const estaManual = !containerManual.classList.contains("hidden");
  if (estaManual) {
    containerManual.classList.add("hidden");
    containerSelect.classList.remove("hidden");
    if (btnToggle) btnToggle.textContent = "Digitar URL manual";
  } else {
    containerManual.classList.remove("hidden");
    containerSelect.classList.add("hidden");
    if (btnToggle) btnToggle.textContent = "Selecionar da lista";
    const inputUrl = document.getElementById("dashImgUrl");
    if (inputUrl) inputUrl.focus();
  }
}

/* ============================================================================
 * MODOS DE ANOTAÇÃO E MARCAÇÃO (PONTO, CÍRCULO, SETA)
 * ============================================================================ */

export function definirModoAnotacao(modo) {
  if (!["pin", "circle", "arrow"].includes(modo)) return;
  modoAnotacaoAtual = modo;
  setaPontoOrigem = null;

  // Atualiza botões da barra lateral
  const btnPin = document.getElementById("dashBtnModoPin");
  const btnCircle = document.getElementById("dashBtnModoCircle");
  const btnArrow = document.getElementById("dashBtnModoArrow");

  const btnAtivoCls = "py-2 px-2.5 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-all bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 shadow-sm cursor-pointer";
  const btnInativoCls = "py-2 px-2.5 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-all text-neutral-400 hover:text-white border border-transparent hover:bg-white/[0.04] cursor-pointer";

  if (btnPin) btnPin.className = modo === "pin" ? btnAtivoCls : btnInativoCls;
  if (btnCircle) btnCircle.className = modo === "circle" ? btnAtivoCls : btnInativoCls;
  if (btnArrow) btnArrow.className = modo === "arrow" ? btnAtivoCls : btnInativoCls;

  // Atualiza botões rápidos sobre o canvas
  const quickPin = document.getElementById("dashQuickBtnPin");
  const quickCircle = document.getElementById("dashQuickBtnCircle");
  const quickArrow = document.getElementById("dashQuickBtnArrow");

  const quickAtivoCls = "px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 shadow-sm cursor-pointer";
  const quickInativoCls = "px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-all text-neutral-400 hover:text-white border border-transparent hover:bg-white/[0.04] cursor-pointer";

  if (quickPin) quickPin.className = modo === "pin" ? quickAtivoCls : quickInativoCls;
  if (quickCircle) quickCircle.className = modo === "circle" ? quickAtivoCls : quickInativoCls;
  if (quickArrow) quickArrow.className = modo === "arrow" ? quickAtivoCls : quickInativoCls;

  // Painéis contextuais
  const configCirculo = document.getElementById("dashConfigCirculo");
  const configSeta = document.getElementById("dashConfigSeta");
  const arrowStatusText = document.getElementById("dashArrowStatusText");

  if (configCirculo) {
    if (modo === "circle") configCirculo.classList.remove("hidden");
    else configCirculo.classList.add("hidden");
  }

  if (configSeta) {
    if (modo === "arrow") {
      configSeta.classList.remove("hidden");
      if (arrowStatusText) {
        arrowStatusText.textContent = "Clique 1: Ponto de início da haste. Clique 2: Ponta da seta sobre a estrutura celular.";
      }
    } else {
      configSeta.classList.add("hidden");
    }
  }

  const rotulos = {
    pin: "Ponto Clássico",
    circle: `Círculo Delimitador (${raioCirculoAtual}px)`,
    arrow: "Seta Direcional (2 cliques)"
  };
  exibirToastDiscreto(`Ferramenta: ${rotulos[modo]}`, "amber");
}

export function onAtualizarRaioCirculo(val) {
  raioCirculoAtual = Number(val) || 250;
  const label = document.getElementById("dashCircleRadiusLabel");
  if (label) label.textContent = `${raioCirculoAtual} px`;
}

export function inicializarPainelCms() {
  atualizarTopicosCms("histologia");
  popularSelectModulosCms();
  const seletorTopico = document.getElementById("dashSelectTopico");
  if (seletorTopico) seletorTopico.value = "osseo";
  atualizarInterfaceListaQuestoes();
  atualizarEstadoBotaoModoQuestao();
  inicializarEventosPreviewInterativo();
  carregarListaDeAssets();
  setTimeout(() => {
    if (!viewerInstance && document.getElementById("osd-editor-viewer") && !laminaEmEdicaoId) {
      carregarImagemNoEditor("assets/histologia/osso_maduro_desgaste_ct_3.0.dzi", true, true);
    }
  }, 200);
  if (typeof db !== "undefined" && db) {
    if (typeof _unsubDashboardAcervo === "function") {
      try { _unsubDashboardAcervo(); } catch (e) {}
      _unsubDashboardAcervo = null;
    }
    _unsubDashboardAcervo = db.collection("laminas").onSnapshot(
      (snapshot) => {
        acervoFirestoreCache = [];
        snapshot.forEach((doc) => {
          acervoFirestoreCache.push({ id: doc.id, ...doc.data() });
        });
        renderizarTabelaAcervo();
      },
      (err) => {
        console.error("[Cloud Firestore] Erro ao sincronizar laminas em tempo real:", err);
        const tbody = document.getElementById("tabelaAcervoCms");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs font-mono text-rose-400">Falha ao ler laminas do Cloud Firestore. Verifique conexao ou permissoes no console.</td></tr>`;
        }
      }
    );
  }
}

export function renderizarTabelaAcervo() {
  const tbody = document.getElementById("tabelaAcervoCms");
  const statTotal = document.getElementById("statTotalLaminas");
  const statAtivas = document.getElementById("statAtivas");
  const statInativas = document.getElementById("statInativas");
  let contAtivas = 0;
  let contInativas = 0;
  acervoFirestoreCache.forEach((item) => {
    if (item.status === "ativa") contAtivas++;
    else contInativas++;
  });
  if (statTotal) statTotal.textContent = String(acervoFirestoreCache.length);
  if (statAtivas) statAtivas.textContent = String(contAtivas);
  if (statInativas) statInativas.textContent = String(contInativas);
  if (!tbody) return;
  if (acervoFirestoreCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-xs font-mono text-neutral-500 italic">Nenhum registro encontrado no Cloud Firestore. Cadastre sua primeira lamina no Topico 1 (Editor &amp; Cadastro).</td></tr>`;
    return;
  }
  const listaFiltrada = acervoFirestoreCache.filter((lamina) => {
    if (filtroStatusAtual === "ativa") return lamina.status === "ativa";
    if (filtroStatusAtual === "inativa") return lamina.status !== "ativa";
    return true;
  });
  if (listaFiltrada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-xs font-mono text-neutral-500 italic">Nenhuma lamina corresponde ao filtro selecionado.</td></tr>`;
    return;
  }
  let rowsHtml = "";
  listaFiltrada.forEach((lamina) => {
    const totalPinos = (lamina.pinos || []).length;
    const nomeSeguro = (lamina.nome || "Peca sem titulo").replace(/'/g, "\\'");
    const isAtiva = lamina.status === "ativa";
    const badgeStatus = isAtiva
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-wider"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Ativa</span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono uppercase tracking-wider"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Inativa</span>`;
    const botaoAlternar = isAtiva
      ? `<button type="button" class="text-neutral-400 hover:text-neutral-200 px-2.5 py-1 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-mono tracking-wider uppercase cursor-pointer" onclick="window.App.alternarStatusCms('${lamina.id}')">Ocultar</button>`
      : `<button type="button" class="text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-500/10 transition-all text-xs font-mono tracking-wider uppercase cursor-pointer" onclick="window.App.alternarStatusCms('${lamina.id}')">Publicar</button>`;
    rowsHtml += `
      <tr class="hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] group">
        <td class="py-3.5 px-4"><div class="flex flex-col"><span class="text-xs text-neutral-200 font-sans">${lamina.nome || "Peça Morfológica"}</span><span class="text-[10px] text-neutral-500 font-mono mt-0.5">${lamina.id}</span></div></td>
        <td class="py-3.5 px-4 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">${lamina.disciplina || "histologia"}</td>
        <td class="py-3.5 px-4 text-xs text-neutral-400 font-sans">${lamina.topico || "geral"}</td>
        <td class="py-3.5 px-4 text-[10px] text-neutral-400 font-mono">${lamina.coloracao || "Padrão"}</td>
        <td class="py-3.5 px-4 text-center whitespace-nowrap">${badgeStatus}</td>
        <td class="py-3.5 px-4 text-center flex justify-center"><span class="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-[10px] font-mono font-medium">${totalPinos}</span></td>
        <td class="py-3.5 px-4 text-right whitespace-nowrap space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" class="text-neutral-400 hover:text-[#d4af37] px-2.5 py-1 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-mono tracking-wider uppercase cursor-pointer" data-id="${lamina.id}" onclick="window.App.editarLaminaCms('${lamina.id}')">Editar</button>
          ${botaoAlternar}
          <button type="button" class="text-rose-400/80 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-all text-xs font-mono tracking-wider uppercase cursor-pointer ml-1" data-id="${lamina.id}" onclick="window.App.excluirLaminaCms('${lamina.id}', '${nomeSeguro}')">Excluir</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = rowsHtml;
}

export const renderizarAcervoCms = renderizarTabelaAcervo;

export async function alternarStatusCms(id) {
  const lamina = acervoFirestoreCache.find((item) => item.id === id);
  if (!lamina) return;
  const novoStatus = lamina.status === "ativa" ? "inativa" : "ativa";
  try {
    if (typeof db !== "undefined" && db) {
      await db.collection("laminas").doc(id).update({ status: novoStatus });
      exibirToastDiscreto(
        `Lamina "${lamina.nome}" alterada para: ${novoStatus === "ativa" ? "Ativa e Publicada" : "Inativa (Rascunho)"}`,
        novoStatus === "ativa" ? "emerald" : "blue"
      );
    } else {
      alert("Comunicacao com o Cloud Firestore indisponivel no momento.");
    }
  } catch (error) {
    console.error("[Cloud Firestore] Erro ao alternar status da lamina:", error);
    alert("Falha ao atualizar o status da peca no banco de dados.");
  }
}

export async function editarLaminaCms(id) {
  let lamina = acervoFirestoreCache.find((item) => item.id === id);
  if (!lamina && typeof db !== "undefined" && db) {
    try {
      const docSnap = await db.collection("laminas").doc(id).get();
      if (docSnap.exists) lamina = { id: docSnap.id, ...docSnap.data() };
    } catch (err) {
      console.error("[Cloud Firestore] Erro ao buscar documento para edicao:", err);
    }
  }
  if (!lamina) { alert("Nao foi possivel localizar os dados da lamina para edicao."); return; }
  alternarTopicoCms("editor");
  laminaEmEdicaoId = id;
  const nomeInput = document.getElementById("dashNomeLamina");
  const disciplinaSelect = document.getElementById("dashSelectDisciplina");
  const topicoSelect = document.getElementById("dashSelectTopico");
  const coloracaoSelect = document.getElementById("dashSelectColoracao");
  const statusSelect = document.getElementById("statusLamina");
  const imgUrlInput = document.getElementById("dashImgUrl");
  const editorTexto = document.getElementById("dashEditorTexto");
  if (nomeInput) nomeInput.value = lamina.nome || "";
  if (disciplinaSelect) { disciplinaSelect.value = lamina.disciplina || "histologia"; atualizarTopicosCms(lamina.disciplina || "histologia"); }
  if (topicoSelect && lamina.topico) topicoSelect.value = lamina.topico;
  if (coloracaoSelect && lamina.coloracao) {
    coloracaoSelect.value = lamina.coloracao;
    if (!coloracaoSelect.value && lamina.coloracao.toLowerCase().includes("desgaste")) {
      coloracaoSelect.value = "Desgaste";
    }
  }
  if (statusSelect) statusSelect.value = lamina.status || "inativa";
  // Req 1: Carrega maxMagnification e zoom4xRatio ao editar
  const maxMagSelect = document.getElementById("dashMaxMagnification");
  if (maxMagSelect) maxMagSelect.value = String(lamina.maxMagnification || 40);
  const ratioInput = document.getElementById("dashZoom4xRatio");
  if (ratioInput) ratioInput.value = Number(lamina.zoom4xRatio || 0.28).toFixed(2);
  const urlImagem = lamina.imagemUrl || lamina.dziUrl || lamina.imageUrl || lamina.caminhoImagemBase || "";
  if (imgUrlInput) imgUrlInput.value = urlImagem;
  const assetSelect = document.getElementById("dashAssetSelector");
  if (assetSelect) {
    assetSelect.value = urlImagem;
  }
  if (editorTexto) editorTexto.innerHTML = lamina.descricaoHTML || lamina.descricao || "";
  const isDzi = urlImagem.endsWith(".dzi") || urlImagem.includes(".dzi?");
  carregarImagemNoEditor(urlImagem, isDzi, false);
  setTimeout(() => {
    editorPins = [];
    if (viewerInstance && typeof viewerInstance.clearOverlays === "function") viewerInstance.clearOverlays();
    const pinosOrigem = (lamina.pinos || []);
    if (pinosOrigem.length > 0) {
      pinosOrigem.forEach((pin, i) => {
        const pinoData = {
          id: pin.id || `pin_${Date.now()}_${i}`,
          rotulo: pin.rotulo || pin.nome || `${i + 1}`,
          type: pin.type || "pin",
          x: Number(pin.x) || 0,
          y: Number(pin.y) || 0,
          radius: pin.radius ? Number(pin.radius) : (pin.type === "circle" ? 250 : null),
          endX: (pin.endX != null ? pin.endX : pin.end_x) ? Number(pin.endX ?? pin.end_x) : null,
          endY: (pin.endY != null ? pin.endY : pin.end_y) ? Number(pin.endY ?? pin.end_y) : null,
          angle: pin.angle ? Number(pin.angle) : null,
          stroke_color: pin.stroke_color || "#d4af37",
          fill_color: pin.fill_color || null
        };
        editorPins.push(pinoData);
        renderizarPinoNoCanvas(pinoData);
      });
    }
    atualizarInterfaceListaPinos();
    atualizarDropdownPinosVinculacao();
    editorQuestoes = [];
    modoCriacaoQuestao = false;
    atualizarEstadoBotaoModoQuestao();
    const questoesOrigem = (lamina.questoes || []);
    if (questoesOrigem.length > 0) {
      questoesOrigem.forEach((q, i) => {
        const questaoData = {
          id: q.id || `q_${Date.now()}_${i}`,
          numero: q.numero || (i + 1),
          titulo: q.titulo || q.enunciado || "",
          x: q.x || 0,
          y: q.y || 0
        };
        editorQuestoes.push(questaoData);
        renderizarQuestaoNoCanvas(questaoData);
      });
    }
    atualizarInterfaceListaQuestoes();
    inicializarEventosPreviewInterativo();
  }, 350);
  const txtBtnPublicar = document.getElementById("txtBtnPublicar");
  const btnCancelar = document.getElementById("btnCancelarEdicao");
  const statusBox = document.getElementById("dashCmsStatus");
  if (txtBtnPublicar) txtBtnPublicar.textContent = "Salvar Alteracoes";
  if (btnCancelar) btnCancelar.classList.remove("hidden");
  if (statusBox) statusBox.classList.add("hidden");
  const campoFoco = document.getElementById("dashNomeLamina");
  if (campoFoco) { campoFoco.scrollIntoView({ behavior: "smooth", block: "center" }); campoFoco.focus(); }
  exibirToastDiscreto(`Modo de Edicao ativo para: ${lamina.nome}`, "blue");
}

export async function excluirLaminaCms(idLamina, nomeLamina) {
  if (!idLamina) return;
  const alvoNome = nomeLamina || idLamina;
  if (!confirm(`Tem certeza que deseja excluir a lamina "${alvoNome}"? Esta acao nao podera ser desfeita.`)) return;
  try {
    if (typeof db !== "undefined" && db) {
      await db.collection("laminas").doc(idLamina).delete();
      if (laminaEmEdicaoId === idLamina) resetarFormularioDashboard();
      exibirToastDiscreto("Lamina removida do acervo (metadados deletados). Arquivo fisico preservado.", "red");
    } else {
      alert("Conexao com Cloud Firestore indisponivel para exclusao.");
    }
  } catch (error) {
    console.error("[Cloud Firestore] Falha ao excluir documento:", error);
    alert("Falha ao tentar excluir a peca no banco de dados. Consulte o console.");
  }
}

export function resetarFormularioDashboard() {
  laminaEmEdicaoId = null;
  const nomeInput = document.getElementById("dashNomeLamina");
  const disciplinaSelect = document.getElementById("dashSelectDisciplina");
  const coloracaoSelect = document.getElementById("dashSelectColoracao");
  const statusSelect = document.getElementById("statusLamina");
  const imgUrlInput = document.getElementById("dashImgUrl");
  const editorTexto = document.getElementById("dashEditorTexto");
  const statusBox = document.getElementById("dashCmsStatus");
  if (nomeInput) nomeInput.value = "";
  if (disciplinaSelect) { disciplinaSelect.value = "histologia"; atualizarTopicosCms("histologia"); }
  if (coloracaoSelect) coloracaoSelect.value = "H&E";
  if (statusSelect) statusSelect.value = "inativa";
  // Req 1: Reseta maxMagnification para o padrão 40
  const maxMagSelect = document.getElementById("dashMaxMagnification");
  if (maxMagSelect) maxMagSelect.value = "40";
  if (imgUrlInput) imgUrlInput.value = "";
  if (editorTexto) editorTexto.innerHTML = "";
  if (statusBox) { statusBox.innerHTML = ""; statusBox.classList.add("hidden"); }
  const txtBtnPublicar = document.getElementById("txtBtnPublicar");
  const btnCancelar = document.getElementById("btnCancelarEdicao");
  if (txtBtnPublicar) txtBtnPublicar.textContent = "Cadastrar Lamina";
  if (btnCancelar) btnCancelar.classList.add("hidden");
  editorPins = [];
  editorQuestoes = [];
  modoCriacaoQuestao = false;
  atualizarEstadoBotaoModoQuestao();
  atualizarInterfaceListaPinos();
  atualizarDropdownPinosVinculacao();
  atualizarInterfaceListaQuestoes();
  definirModoAnotacao("pin");
  const assetSelect = document.getElementById("dashAssetSelector");
  if (assetSelect) assetSelect.value = "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi";
  if (viewerInstance && typeof viewerInstance.clearOverlays === "function") viewerInstance.clearOverlays();
  carregarImagemNoEditor("assets/histologia/osso_maduro_desgaste_ct_3.0.dzi", true, true);
  exibirToastDiscreto("Formulario redefinido para o modo de novo cadastro.", "emerald");
}

function exibirToastDiscreto(mensagem, tipo) {
  tipo = tipo || "emerald";
  const toastId = "palas-cms-toast";
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = toastId;
    toast.className = "fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl bg-neutral-950/80 backdrop-blur-2xl border border-white/[0.08] text-neutral-200 text-xs font-mono font-medium shadow-2xl transition-all duration-300 translate-y-20 opacity-0 pointer-events-none flex items-center gap-3";
    document.body.appendChild(toast);
  }
  let corPonto = "bg-emerald-500";
  if (tipo === "red") corPonto = "bg-rose-500";
  else if (tipo === "blue") corPonto = "bg-blue-500";
  toast.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${corPonto} shrink-0"></span><span>${mensagem}</span>`;
  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    toast.classList.remove("translate-y-0", "opacity-100");
  }, 4000);
}

export function atualizarTopicosCms(disciplina) {
  const seletorTopico = document.getElementById("dashSelectTopico");
  if (!seletorTopico) return;
  const lista = topicosCurriculares[disciplina] || topicosCurriculares.histologia;
  let optionsHtml = "";
  lista.forEach((item) => { optionsHtml += `<option value="${item.id}">${item.nome}</option>`; });
  seletorTopico.innerHTML = optionsHtml;
}

export function carregarImagemNoEditor(urlParam, isDziParam, isAutoLoad) {
  const inputUrl = document.getElementById("dashImgUrl");
  let url = urlParam !== undefined ? urlParam : (inputUrl ? inputUrl.value.trim() : "");
  if (url) {
    url = url.replace(/muscular-esquelito/gi, "muscular-esqueletico");
    if (!url.includes("/") && !url.startsWith("http") && !url.startsWith("data:")) url = `/assets/histologia/${url}`;
  }
  if (inputUrl) inputUrl.value = url;
  let isDzi = isDziParam;
  if (isDzi === undefined) {
    const radioSelected = document.querySelector('input[name="dashImgType"]:checked');
    isDzi = radioSelected ? radioSelected.value === "dzi" : false;
    if (url && (url.endsWith(".dzi") || url.includes(".dzi?"))) isDzi = true;
  }
  if (!url) { alert("Por favor, informe o caminho valido da imagem antes de carregar no canvas."); if (inputUrl) inputUrl.focus(); return; }
  const containerId = "osd-editor-viewer";
  const container = document.getElementById(containerId);
  if (!container) { console.warn(`[Palas Atlas CMS] Container #${containerId} nao encontrado.`); return; }
  if (viewerInstance && typeof viewerInstance.destroy === "function") { viewerInstance.destroy(); viewerInstance = null; }
  if (!laminaEmEdicaoId && !isAutoLoad) {
    editorPins = [];
    editorQuestoes = [];
    modoCriacaoQuestao = false;
    atualizarEstadoBotaoModoQuestao();
    atualizarInterfaceListaPinos();
    atualizarDropdownPinosVinculacao();
    atualizarInterfaceListaQuestoes();
  }
  const tileSourcesConfig = isDzi ? url : { type: "image", url: url };
  if (typeof window.OpenSeadragon !== "function") { console.error("[Palas Atlas CMS] Biblioteca OpenSeadragon nao carregada."); return; }
  viewerInstance = window.OpenSeadragon({
    id: containerId,
    prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
    tileSources: tileSourcesConfig,
    showNavigationControl: false,
    showNavigator: true,
    navigatorPosition: "BOTTOM_RIGHT",
    navigatorWidth: "160px",
    navigatorHeight: "120px",
    navigatorBackground: "rgba(10, 10, 10, 0.85)",
    navigatorBorderColor: "#3b82f6",
    navigatorAutoFade: false,
    animationTime: 0.4,
    blendTime: 0.1,
    constrainDuringPan: true,
    maxZoomPixelRatio: 3,
    visibilityRatio: 1
  });

  viewerInstance.scalebar({
    type: window.OpenSeadragon.ScalebarType.MICROSCOPE,
    location: window.OpenSeadragon.ScalebarLocation.BOTTOM_LEFT,
    pixelsPerMeter: 1000000,
    color: "#f8fafc",
    backgroundColor: "rgba(23, 23, 23, 0.85)",
    fontFamily: "sans-serif",
    barThickness: 2,
    xOffset: 24,
    yOffset: 24
  });
  viewerInstance.addHandler("open-failed", (event) => {
    console.error("[Palas Atlas CMS] Erro ao carregar imagem no OpenSeadragon:", event);
    alert(`O sistema nao localizou o arquivo "${url}". Verifique se o arquivo existe no servidor.`);
  });
  viewerInstance.addHandler("open", () => {
    // Calibração e Análise Óptica Automática do DZI no CMS
    const item = viewerInstance.world && viewerInstance.world.getItemCount() > 0 ? viewerInstance.world.getItemAt(0) : null;
    const maxMagEl = document.getElementById("dashMaxMagnification");
    const maxMag = maxMagEl ? Number(maxMagEl.value) || 40 : 40;
    atualizarCardAnaliseOpticaCms(item, maxMag);

    if (maxMagEl && !maxMagEl.__boundDziChange) {
      maxMagEl.__boundDziChange = true;
      maxMagEl.addEventListener("change", () => {
        if (viewerInstance && viewerInstance.world && viewerInstance.world.getItemCount() > 0) {
          atualizarCardAnaliseOpticaCms(viewerInstance.world.getItemAt(0), maxMagEl.value);
        }
      });
    }

    if (editorQuestoes.length > 0) {
      editorQuestoes.forEach((q) => renderizarQuestaoNoCanvas(q));
    }
  });
  viewerInstance.addHandler("canvas-click", (event) => {
    if (!event.quick) return;
    const viewportPoint = viewerInstance.viewport.pointFromPixel(event.position);
    const imagePoint = viewerInstance.viewport.viewportToImageCoordinates(viewportPoint);
    if (modoCriacaoQuestao) {
      const novaQuestao = {
        id: 'q_' + Date.now(),
        numero: editorQuestoes.length + 1,
        titulo: '',
        x: Math.round(imagePoint.x * 100) / 100,
        y: Math.round(imagePoint.y * 100) / 100
      };
      editorQuestoes.push(novaQuestao);
      modoCriacaoQuestao = false;
      atualizarEstadoBotaoModoQuestao();
      renderizarQuestaoNoCanvas(novaQuestao);
      atualizarInterfaceListaQuestoes();
      setTimeout(() => {
        const inputElem = document.getElementById(`dashQuestaoTitulo_${novaQuestao.id}`);
        if (inputElem) {
          inputElem.focus();
          inputElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      exibirToastDiscreto(`Questão Q${novaQuestao.numero} adicionada. Digite o enunciado.`, "emerald");
      return;
    }

    if (modoAnotacaoAtual === "circle") {
      adicionarPinoEditor(imagePoint.x, imagePoint.y, null, null, "circle", { radius: raioCirculoAtual });
      exibirToastDiscreto(`Círculo adicionado com raio de ${raioCirculoAtual}px`, "emerald");
    } else if (modoAnotacaoAtual === "arrow") {
      if (!setaPontoOrigem) {
        setaPontoOrigem = { x: Math.round(imagePoint.x * 100) / 100, y: Math.round(imagePoint.y * 100) / 100 };
        const arrowStatus = document.getElementById("dashArrowStatusText");
        if (arrowStatus) {
          arrowStatus.innerHTML = `<span class="text-amber-300 font-bold">Origem marcada (X:${Math.round(setaPontoOrigem.x)}, Y:${Math.round(setaPontoOrigem.y)}).</span> Agora clique na ponta do alvo / célula.`;
        }
        exibirToastDiscreto("Início da haste fixado. Clique no alvo celular.", "amber");
      } else {
        const x1 = setaPontoOrigem.x;
        const y1 = setaPontoOrigem.y;
        const x2 = Math.round(imagePoint.x * 100) / 100;
        const y2 = Math.round(imagePoint.y * 100) / 100;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angulo = Math.round(Math.atan2(dy, dx) * (180 / Math.PI) * 10) / 10;

        adicionarPinoEditor(x1, y1, null, null, "arrow", {
          endX: x2,
          endY: y2,
          angle: angulo,
          stroke_color: "#d4af37"
        });

        setaPontoOrigem = null;
        const arrowStatus = document.getElementById("dashArrowStatusText");
        if (arrowStatus) {
          arrowStatus.textContent = "Clique 1: Ponto de início da haste. Clique 2: Ponta da seta sobre a estrutura celular.";
        }
        exibirToastDiscreto("Seta direcional cadastrada com sucesso!", "emerald");
      }
    } else {
      adicionarPinoEditor(imagePoint.x, imagePoint.y, null, null, "pin");
    }
  });
}

/**
 * Atualiza o card de calibração óptica automática do DZI no CMS.
 * Extrai largura, altura e megapixels nativos do DZI e calcula
 * as proporções exatas de cada lente objetiva em relação à resolução de captura.
 */
export function atualizarCardAnaliseOpticaCms(item, maxMagNominal) {
  const card = document.getElementById("dashDziOpticalCard");
  if (!card) return;

  const maxMag = Number(maxMagNominal) || 40;
  let w = 0, h = 0, tileSize = 256;

  if (item && item.source && item.source.dimensions) {
    w = item.source.dimensions.x;
    h = item.source.dimensions.y;
    tileSize = item.source.tileSize || 256;
  }

  if (w <= 0 || h <= 0) {
    card.classList.add("hidden");
    return;
  }

  const mp = ((w * h) / 1e6).toFixed(1);
  const ratio = (w / h).toFixed(2);
  const isVertical = h > w * 1.8;

  const dimEl = document.getElementById("dashDziDimensions");
  const mpEl = document.getElementById("dashDziMegapixels");
  const geomEl = document.getElementById("dashDziGeometria");
  const tetoEl = document.getElementById("dashDziTeto");
  const badgeEl = document.getElementById("dashDziBadgeMag");
  const ratioInput = document.getElementById("dashZoom4xRatio");

  const mppCalculado = ((40 / maxMag) * 0.156).toFixed(3);
  if (dimEl) dimEl.textContent = `${w} × ${h}`;
  if (mpEl) mpEl.textContent = `${mp} Megapixels`;
  if (geomEl) geomEl.textContent = `${ratio}:1 (${isVertical ? "Faixa Vertical" : "Mosaico Amplo"})`;
  if (tetoEl) tetoEl.textContent = `${maxMag}x (${mppCalculado} µm/px)`;
  if (badgeEl) badgeEl.textContent = `Nativa: ${maxMag}x • Hemácia (7.5µm)`;

  // Se for nova lâmina ou campo vazio, sugere automaticamente o ratio baseado na geometria física
  if (ratioInput && (!laminaEmEdicaoId || !ratioInput.value)) {
    const recommended = isVertical ? 0.65 : 0.28;
    ratioInput.value = recommended.toFixed(2);
  }

  card.classList.remove("hidden");
}

export function adicionarPinoEditor(x, y, customLabel, customId, tipo = "pin", geomData = null) {
  if (!viewerInstance || !viewerInstance.viewport) return;
  const pinId = customId || `pin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const numeroSequencial = editorPins.length + 1;
  const rotulo = customLabel || `P${numeroSequencial}`;
  const pinoData = {
    id: pinId,
    rotulo: rotulo,
    type: tipo || "pin",
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    radius: tipo === "circle" ? (Number(geomData?.radius) || raioCirculoAtual || 250) : null,
    endX: tipo === "arrow" ? (geomData?.endX != null ? Math.round(geomData.endX * 100) / 100 : null) : null,
    endY: tipo === "arrow" ? (geomData?.endY != null ? Math.round(geomData.endY * 100) / 100 : null) : null,
    angle: tipo === "arrow" ? (geomData?.angle ?? null) : null,
    stroke_color: geomData?.stroke_color || "#d4af37",
    fill_color: geomData?.fill_color || null
  };
  editorPins.push(pinoData);
  renderizarPinoNoCanvas(pinoData);
  atualizarInterfaceListaPinos();
  atualizarDropdownPinosVinculacao();
}

function renderizarPinoNoCanvas(pinoData) {
  if (!viewerInstance || !viewerInstance.viewport || !window.OpenSeadragon) return;

  // 1. ANOTAÇÃO TIPO CÍRCULO (Delimitação Geométrica Escalável com Zoom)
  if (pinoData.type === "circle") {
    const r = Number(pinoData.radius) || 250;
    const imgRect = new window.OpenSeadragon.Rect(pinoData.x - r, pinoData.y - r, 2 * r, 2 * r);
    const vpRect = viewerInstance.viewport.imageToViewportRectangle(imgRect);

    const circleElem = document.createElement("div");
    circleElem.id = `editor-pin-${pinoData.id}`;
    circleElem.className = "editor-pin-circle group relative flex items-center justify-center cursor-pointer select-none";
    circleElem.style.cssText = "width:100%; height:100%; pointer-events:auto; z-index:30;";
    circleElem.innerHTML = `
      <div class="circle-ring w-full h-full rounded-full border-2 border-[#d4af37] bg-[#d4af37]/10 hover:bg-[#d4af37]/25 hover:border-amber-300 transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center justify-center relative">
        <span class="pin-badge text-[10px] font-mono font-bold text-[#d4af37] bg-black/80 px-2 py-0.5 rounded-full border border-[#d4af37]/50 shadow-md pointer-events-none">${pinoData.rotulo}</span>
      </div>
      <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-neutral-950/95 text-white text-[11px] px-3 py-1 rounded-xl border border-white/[0.08] shadow-2xl font-mono backdrop-blur-xl z-50">
        ${pinoData.rotulo} &bull; Círculo (R: ${Math.round(r)}px)
      </div>
    `;

    new window.OpenSeadragon.MouseTracker({
      element: circleElem,
      clickHandler: (e) => {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
        const point = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(pinoData.x, pinoData.y));
        viewerInstance.viewport.panTo(point);
        destacarPinoTemporariamente(pinoData.id);
      }
    });

    viewerInstance.addOverlay({ element: circleElem, location: vpRect });
    return;
  }

  // 2. ANOTAÇÃO TIPO SETA (Vetor Direcional com Ponta e Haste Escaláveis)
  if (pinoData.type === "arrow") {
    const x1 = pinoData.x;
    const y1 = pinoData.y;
    const x2 = pinoData.endX != null ? pinoData.endX : x1 + 100;
    const y2 = pinoData.endY != null ? pinoData.endY : y1 + 100;

    const pad = Math.max(30, Math.hypot(x2 - x1, y2 - y1) * 0.08);
    const minX = Math.min(x1, x2) - pad;
    const minY = Math.min(y1, y2) - pad;
    const maxX = Math.max(x1, x2) + pad;
    const maxY = Math.max(y1, y2) + pad;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    const imgRect = new window.OpenSeadragon.Rect(minX, minY, w, h);
    const vpRect = viewerInstance.viewport.imageToViewportRectangle(imgRect);

    const svgX1 = x1 - minX;
    const svgY1 = y1 - minY;
    const svgX2 = x2 - minX;
    const svgY2 = y2 - minY;
    const markerId = `editor-marker-arrow-${pinoData.id}`;

    const arrowElem = document.createElement("div");
    arrowElem.id = `editor-pin-${pinoData.id}`;
    arrowElem.className = "editor-pin-arrow group relative cursor-pointer select-none";
    arrowElem.style.cssText = "width:100%; height:100%; pointer-events:auto; z-index:30;";
    arrowElem.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible" style="filter: drop-shadow(0 0 6px rgba(212,175,55,0.6));">
        <defs>
          <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#d4af37" />
          </marker>
        </defs>
        <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}" stroke="#d4af37" stroke-width="4" stroke-linecap="round" marker-end="url(#${markerId})" />
        <circle cx="${svgX1}" cy="${svgY1}" r="5" fill="#d4af37" stroke="#ffffff" stroke-width="1.5" />
      </svg>
      <div class="pin-badge absolute bg-neutral-950/90 text-[#d4af37] border border-[#d4af37]/40 text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none" style="left:${(svgX1 / w) * 100}%; top:${(svgY1 / h) * 100}%; transform: translate(-50%, -120%);">
        ${pinoData.rotulo}
      </div>
      <div class="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-neutral-950/95 text-white text-[11px] px-3 py-1 rounded-xl border border-white/[0.08] shadow-2xl font-mono backdrop-blur-xl z-50" style="left:${(svgX2 / w) * 100}%; top:${(svgY2 / h) * 100}%; transform: translate(-50%, -130%);">
        ${pinoData.rotulo} &bull; Seta (Alvo: ${Math.round(x2)}, ${Math.round(y2)})
      </div>
    `;

    new window.OpenSeadragon.MouseTracker({
      element: arrowElem,
      clickHandler: (e) => {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
        const targetPoint = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(x2, y2));
        viewerInstance.viewport.panTo(targetPoint);
        destacarPinoTemporariamente(pinoData.id);
      }
    });

    viewerInstance.addOverlay({ element: arrowElem, location: vpRect });
    return;
  }

  // 3. ANOTAÇÃO TIPO PIN CLÁSSICO (Ponto Ancorado Fixo com Glow)
  const pinElem = document.createElement("div");
  pinElem.id = `editor-pin-${pinoData.id}`;
  pinElem.className = "editor-pin group relative flex items-center justify-center cursor-pointer z-30 transition-transform duration-200 hover:scale-125";
  pinElem.title = `Pino ${pinoData.rotulo} (X: ${pinoData.x}, Y: ${pinoData.y})`;
  pinElem.innerHTML = `
    <div class="w-4 h-4 bg-[#d4af37] border-2 border-white rounded-full shadow-[0_0_15px_rgba(212,175,55,0.6)] animate-pulse"></div>
    <div class="pin-badge absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-neutral-950/90 text-white text-[11px] px-3 py-1 rounded-xl border border-white/[0.08] shadow-2xl font-mono backdrop-blur-xl">
      ${pinoData.rotulo}
    </div>
  `;

  new window.OpenSeadragon.MouseTracker({
    element: pinElem,
    clickHandler: (e) => {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
      const point = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(pinoData.x, pinoData.y));
      viewerInstance.viewport.panTo(point);
      destacarPinoTemporariamente(pinoData.id);
    }
  });

  const location = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(pinoData.x, pinoData.y));
  viewerInstance.addOverlay({ element: pinElem, location: location, placement: window.OpenSeadragon.Placement.CENTER });
}

function destacarPinoTemporariamente(pinId) {
  const pinElem = document.getElementById(`editor-pin-${pinId}`);
  if (!pinElem) return;

  const ring = pinElem.querySelector(".circle-ring");
  const svg = pinElem.querySelector("svg");
  const point = pinElem.querySelector("div > div, .animate-pulse");

  if (ring) {
    ring.classList.add("!border-amber-300", "ring-4", "ring-amber-500/50", "scale-105");
    setTimeout(() => { if (ring) ring.classList.remove("!border-amber-300", "ring-4", "ring-amber-500/50", "scale-105"); }, 1600);
  } else if (svg) {
    svg.style.filter = "drop-shadow(0 0 16px rgba(245,158,11,1))";
    setTimeout(() => { if (svg) svg.style.filter = "drop-shadow(0 0 6px rgba(212,175,55,0.6))"; }, 1600);
  } else if (point) {
    point.classList.add("!bg-amber-400", "ring-4", "ring-amber-500/50", "scale-150");
    setTimeout(() => { if (point) point.classList.remove("!bg-amber-400", "ring-4", "ring-amber-500/50", "scale-150"); }, 1600);
  }
}

function atualizarInterfaceListaPinos() {
  const containerLista = document.getElementById("dashListaPinos");
  const contadorBadge = document.getElementById("dashTotalPinosBadge");
  if (contadorBadge) contadorBadge.textContent = `${editorPins.length} ${editorPins.length === 1 ? "Marcação" : "Marcações"}`;
  if (!containerLista) return;
  if (editorPins.length === 0) {
    containerLista.innerHTML = `<p class="text-neutral-500 text-xs py-6 text-center border border-dashed border-white/[0.08] rounded-xl font-mono">Nenhuma marcação na imagem. Selecione Ponto, Círculo ou Seta e clique no canvas para adicionar.</p>`;
    return;
  }
  let html = `<div class="space-y-2">`;
  editorPins.forEach((p) => {
    let icone = "📍";
    let tipoTexto = "Ponto";
    let detalhesGeom = `X: ${Math.round(p.x)} &bull; Y: ${Math.round(p.y)}`;
    
    if (p.type === "circle") {
      icone = "⭕";
      tipoTexto = `Círculo (R: ${Math.round(p.radius || 250)}px)`;
      detalhesGeom = `Centro: (${Math.round(p.x)}, ${Math.round(p.y)})`;
    } else if (p.type === "arrow") {
      icone = "↗️";
      tipoTexto = "Seta Direcional";
      detalhesGeom = `De (${Math.round(p.x)}, ${Math.round(p.y)}) &rarr; (${Math.round(p.endX || p.x)}, ${Math.round(p.endY || p.y)})`;
    }

    html += `
      <div class="p-3 flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#d4af37] font-mono text-[10px] font-bold flex items-center justify-center shadow-sm shrink-0">
            ${icone}
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-neutral-200 font-mono font-medium">${p.rotulo}</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.04] text-[#d4af37] font-mono">${tipoTexto}</span>
            </div>
            <span class="text-[10px] text-neutral-500 font-mono mt-0.5">${detalhesGeom}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" onclick="window.App.focarPinoEditor('${p.id}')" class="text-[#d4af37] hover:text-[#e0c97f] text-[10px] font-mono cursor-pointer transition-colors uppercase tracking-wider">Focar</button>
          <span class="text-white/10 text-[10px]">|</span>
          <button type="button" onclick="window.App.editarRotuloPinoCms('${p.id}')" class="text-neutral-400 hover:text-[#d4af37] text-[10px] font-mono cursor-pointer transition-colors uppercase tracking-wider">Editar</button>
          <span class="text-white/10 text-[10px]">|</span>
          <button type="button" onclick="window.App.excluirPinoCms('${p.id}')" class="text-rose-400/80 hover:text-rose-400 text-[10px] font-mono cursor-pointer transition-colors uppercase tracking-wider">Excluir</button>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  containerLista.innerHTML = html;
}

function atualizarDropdownPinosVinculacao() {
  const seletor = document.getElementById("dashSelectPinoVinculo");
  if (!seletor) return;
  if (editorPins.length === 0) { seletor.innerHTML = `<option value="">Nenhum pino cadastrado na lamina...</option>`; return; }
  let opt = `<option value="">Selecione um pino para vincular...</option>`;
  editorPins.forEach((p) => { opt += `<option value="${p.id}">${p.rotulo} &bull; X:${Math.round(p.x)} Y:${Math.round(p.y)}</option>`; });
  seletor.innerHTML = opt;
}

export function editarRotuloPinoCms(pinId) {
  const pino = editorPins.find((item) => item.id === pinId);
  if (!pino) return;
  const novoRotulo = prompt("Informe o novo rotulo curto para exibicao neste marcador:", pino.rotulo);
  if (novoRotulo !== null && novoRotulo.trim() !== "") {
    pino.rotulo = novoRotulo.trim();
    const elem = document.getElementById(`editor-pin-${pino.id}`);
    if (elem) { const spanTexto = elem.querySelector("span"); if (spanTexto) spanTexto.textContent = pino.rotulo; elem.title = `Pino ${pino.rotulo} (X: ${pino.x}, Y: ${pino.y})`; }
    atualizarInterfaceListaPinos();
    atualizarDropdownPinosVinculacao();
  }
}

export function excluirPinoCms(pinId) {
  const index = editorPins.findIndex((item) => item.id === pinId);
  if (index === -1) return;
  const elem = document.getElementById(`editor-pin-${pinId}`);
  if (elem && viewerInstance) viewerInstance.removeOverlay(elem);
  editorPins.splice(index, 1);
  atualizarInterfaceListaPinos();
  atualizarDropdownPinosVinculacao();
}

export function vincularTextoAoPino() {
  const selectPino = document.getElementById("dashSelectPinoVinculo");
  if (!selectPino || !selectPino.value) { alert("Por favor, selecione primeiro qual pino deseja associar no dropdown."); if (selectPino) selectPino.focus(); return; }
  const pinId = selectPino.value;
  const pinoVerificado = editorPins.find((item) => item.id === pinId);
  if (!pinoVerificado) { alert("O pino selecionado nao esta ativo na sessao atual."); return; }
  const selecao = window.getSelection();
  if (!selecao || selecao.rangeCount === 0 || selecao.toString().trim() === "") { alert("Selecione primeiramente o trecho anatomico no texto antes de clicar em vincular."); return; }
  const range = selecao.getRangeAt(0);
  const textoSelecionado = range.toString();
  const spanLink = document.createElement("span");
  spanLink.className = "pin-link inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-neutral-200 hover:text-white transition-colors cursor-pointer text-xs font-medium";
  spanLink.setAttribute("data-pin-id", pinId);
  spanLink.contentEditable = "false";
  spanLink.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#d4af37] shrink-0"></span><span>${textoSelecionado}</span>`;
  spanLink.title = `Vinculo ativo com ${pinoVerificado.rotulo}`;
  range.deleteContents();
  range.insertNode(spanLink);
  selecao.removeAllRanges();
  inicializarEventosPreviewInterativo();
}

export function focarPinoEditor(pinId) {
  if (!viewerInstance || !viewerInstance.viewport || !window.OpenSeadragon) return;
  const pinoData = editorPins.find((item) => String(item.id) === String(pinId));
  if (!pinoData) return;

  const targetX = (pinoData.type === "arrow" && pinoData.endX != null) ? pinoData.endX : pinoData.x;
  const targetY = (pinoData.type === "arrow" && pinoData.endY != null) ? pinoData.endY : pinoData.y;
  const pontoViewport = viewerInstance.viewport.imageToViewportCoordinates(
    new window.OpenSeadragon.Point(Number(targetX) || 0, Number(targetY) || 0)
  );

  const homeZoom = viewerInstance.viewport.getHomeZoom() || 1;
  const currentZoom = viewerInstance.viewport.getZoom();
  let targetZoom = Math.max(currentZoom, homeZoom * 2.8);
  if (viewerInstance.viewport.maxZoomLevel) {
    targetZoom = Math.min(targetZoom, viewerInstance.viewport.maxZoomLevel * 0.95);
  }

  viewerInstance.viewport.panTo(pontoViewport, false);
  viewerInstance.viewport.zoomTo(targetZoom, null, false);
  viewerInstance.viewport.applyConstraints();
  destacarPinoTemporariamente(pinId);
}

export function inicializarEventosPreviewInterativo() {
  const editor = document.getElementById("dashEditorTexto");
  if (!editor || editor._eventosInteracaoInjetados) return;

  // Intercepta colagem no editor para colar apenas texto puro e remover formatações externas
  editor.addEventListener("paste", (evento) => {
    evento.preventDefault();
    const textoPuro = (evento.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, textoPuro);
  });

  // Clique direto no hiperlink do editor
  editor.addEventListener("click", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id]");
    if (!alvo) return;
    const pinId = alvo.getAttribute("data-pin-id");
    if (!pinId) return;
    focarPinoEditor(pinId);
  });

  editor.addEventListener("mouseover", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id]");
    if (!alvo) return;
    const pinId = alvo.getAttribute("data-pin-id");
    if (!pinId) return;
    focarPinoEditor(pinId);
  });
  editor._eventosInteracaoInjetados = true;
}

export function osdEditorAction(acao) {
  if (!viewerInstance || !viewerInstance.viewport) return;
  if (acao === "zoomIn") viewerInstance.viewport.zoomTo(viewerInstance.viewport.getZoom() * 1.5);
  else if (acao === "zoomOut") viewerInstance.viewport.zoomTo(viewerInstance.viewport.getZoom() * 0.67);
  else if (acao === "reset") viewerInstance.viewport.goHome();
  else if (acao === "center") viewerInstance.viewport.panTo(viewerInstance.viewport.getHomeBounds().getCenter());
}

/**
 * Submissao do formulario.
 * CHAVES CANONICAS GRAVADAS:
 *   nome, disciplina, topico, coloracao,
 *   imagemUrl     (CRITICO - URL do .dzi ou imagem estatica),
 *   descricaoHTML (CRITICO - HTML do texto descritivo com pin-link),
 *   status, pinos
 */
export async function publicarLaminaCms() {
  const nome = (document.getElementById("dashNomeLamina") || { value: "" }).value.trim();
  const disciplina = (document.getElementById("dashSelectDisciplina") || { value: "histologia" }).value.trim();
  const topico = (document.getElementById("dashSelectTopico") || { value: "epitelial" }).value.trim();
  const coloracao = (document.getElementById("dashSelectColoracao") || { value: "H&E" }).value.trim();
  const statusEl = document.getElementById("statusLamina");
  const status = statusEl ? statusEl.value : "inativa";
  const imgUrlEl = document.getElementById("dashImgUrl");
  const imagemUrl = imgUrlEl ? imgUrlEl.value.trim() : "";
  const descEl = document.getElementById("dashEditorTexto");
  const rawDescHTML = descEl ? descEl.innerHTML : "";
  const descricaoHTML = sanitizarHTMLDescricao(rawDescHTML);
  if (!nome || !imagemUrl) { alert("Os campos 'Nome da Peca / Lamina' e 'Caminho do arquivo / pasta' sao obrigatorios para gravacao."); return; }
  const pinos = editorPins.map((p) => ({
    id: p.id,
    rotulo: p.rotulo,
    type: p.type || "pin",
    x: p.x,
    y: p.y,
    radius: p.type === "circle" ? p.radius : null,
    endX: p.type === "arrow" ? (p.endX != null ? p.endX : p.end_x) : null,
    endY: p.type === "arrow" ? (p.endY != null ? p.endY : p.end_y) : null,
    end_x: p.type === "arrow" ? (p.endX != null ? p.endX : p.end_x) : null,
    end_y: p.type === "arrow" ? (p.endY != null ? p.endY : p.end_y) : null,
    angle: p.type === "arrow" ? p.angle : null,
    stroke_color: p.stroke_color || "#d4af37",
    fill_color: p.fill_color || null
  }));
  const questoes = editorQuestoes.map((q) => ({
    id: q.id,
    numero: q.numero,
    titulo: (q.titulo || "").trim(),
    x: q.x,
    y: q.y
  }));
  // Coleta maxMagnification e zoom4xRatio individual da lâmina
  const maxMagEl = document.getElementById("dashMaxMagnification");
  const maxMagnification = maxMagEl ? Number(maxMagEl.value) || 40 : 40;
  const ratioEl = document.getElementById("dashZoom4xRatio");
  const zoom4xRatio = ratioEl ? parseFloat(ratioEl.value) || 0.28 : 0.28;
  const mpp = (40 / maxMagnification) * 0.156;
  const laminaData = {
    nome,
    disciplina,
    topico,
    coloracao,
    imagemUrl,
    descricaoHTML,
    status,
    pinos,
    questoes,
    maxMagnification,
    objetivaCaptura: maxMagnification,
    mpp: Number(mpp.toFixed(4)),
    metodoCalibracao: "referencia_biologica_hemacia_7.5um",
    zoom4xRatio,
    dataModificacao: new Date().toISOString()
  };
  const statusBox = document.getElementById("dashCmsStatus");
  try {
    let idGravado = laminaEmEdicaoId;
    if (typeof db !== "undefined" && db) {
      if (laminaEmEdicaoId) {
        await db.collection("laminas").doc(laminaEmEdicaoId).update(laminaData);
        exibirToastDiscreto("Lamina atualizada com sucesso no Cloud Firestore e Supabase!", "emerald");
      } else {
        const docRef = await db.collection("laminas").add(laminaData);
        idGravado = docRef.id;
        await db.collection("laminas").doc(idGravado).update({ id: idGravado });
        exibirToastDiscreto("Nova lamina cadastrada no Cloud Firestore e Supabase!", "emerald");
        if (statusBox) {
          const corBadge = status === "ativa" ? "emerald" : "rose";
          statusBox.innerHTML = `
            <div class="font-bold uppercase tracking-wider text-${corBadge}-300">Lâmina Sincronizada (${status.toUpperCase()})</div>
            <div class="mt-1 text-neutral-300 text-xs font-mono">ID: ${idGravado} (${pinos.length} marcações, ${questoes.length} questões vinculadas)</div>
            <a href="microscopio.html?id=${idGravado}" target="_blank" rel="noopener noreferrer" class="mt-3 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-[#d4af37]/10 text-neutral-200 hover:text-[#d4af37] border border-white/[0.08] hover:border-[#d4af37]/40 text-xs font-mono uppercase tracking-wider shadow-lg inline-flex items-center gap-2 cursor-pointer transition-all duration-300">
              <span>Testar no Microscópio</span>
              <span>&rarr;</span>
            </a>
          `;
          statusBox.classList.remove("hidden");
        }
      }

      // Sincronização em segundo plano com o Supabase PostgreSQL
      try {
        fetch("/api/sync-supabase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laminaId: idGravado,
            laminaData,
            pinos
          })
        }).then(r => r.json()).then(res => {
          if (res && res.success) {
            console.log("[Supabase Sync] Sincronização concluída com PostgreSQL no Supabase.");
          }
        }).catch(e => {
          console.warn("[Supabase Sync] Aviso: sincronização secundária assíncrona:", e.message);
        });
      } catch (errSync) {}

      if (laminaEmEdicaoId) {
        resetarFormularioDashboard();
        return;
      }
    } else {
      console.warn("[Cloud Firestore] SDK indisponivel.");
      alert("SDK do Cloud Firestore nao inicializado. Verifique o firebase-config.js.");
    }
  } catch (err) {
    console.error("[Cloud Firestore] Erro de escrita:", err);
    alert("Falha ao gravar no Cloud Firestore. Verifique conexao e permissoes de seguranca.");
  }
}

/* ============================================================================
 * SISTEMA DE QUESTÕES PRÁTICAS / SIMULADO DE BANCADA (PALAS ATLAS)
 * ============================================================================ */

export function ativarModoNovaQuestao() {
  if (!viewerInstance || !viewerInstance.viewport) {
    alert("Carregue uma lâmina no canvas antes de posicionar uma questão.");
    modoCriacaoQuestao = false;
    atualizarEstadoBotaoModoQuestao();
    return;
  }
  modoCriacaoQuestao = !modoCriacaoQuestao;
  atualizarEstadoBotaoModoQuestao();
  if (modoCriacaoQuestao) {
    exibirToastDiscreto("Modo de questão ativo: clique na lâmina para posicionar a questão.", "amber");
  }
}

function atualizarEstadoBotaoModoQuestao() {
  const btn = document.getElementById("btnAtivarModoQuestao");
  if (!btn) return;
  if (modoCriacaoQuestao) {
    btn.className = "w-full bg-amber-500/20 text-amber-300 border border-amber-400/60 ring-2 ring-amber-400/30 rounded-xl py-2.5 px-4 text-xs font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse";
    btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0"></span><span id="txtBtnAtivarModoQuestao">Clique na lâmina para posicionar a questão</span>`;
  } else {
    btn.className = "w-full bg-white/[0.04] hover:bg-amber-400/10 text-neutral-300 hover:text-amber-300 border border-white/[0.08] hover:border-amber-400/40 rounded-xl py-2.5 px-4 text-xs font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm group";
    btn.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400/80 group-hover:scale-125 transition-transform shrink-0"></span><span id="txtBtnAtivarModoQuestao">+ Nova Questão na Lâmina</span>`;
  }
}

function renderizarQuestaoNoCanvas(q) {
  if (!viewerInstance || !viewerInstance.viewport || !window.OpenSeadragon) return;

  const elemExistente = document.getElementById(`editor-qpin-${q.id}`);
  if (elemExistente) {
    try { viewerInstance.removeOverlay(elemExistente); } catch (e) {}
    if (elemExistente.parentNode) elemExistente.parentNode.removeChild(elemExistente);
  }

  const qElem = document.createElement("div");
  qElem.id = `editor-qpin-${q.id}`;
  qElem.className = "editor-qpin group relative flex items-center justify-center cursor-pointer z-40 transition-transform duration-200 hover:scale-125 select-none";
  qElem.title = `Questão Q${q.numero}: ${q.titulo || 'Clique para focar'} (X: ${q.x}, Y: ${q.y})`;

  qElem.innerHTML = `
    <div class="qpin-badge px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-mono font-bold text-[10px] tracking-wider border-2 border-white shadow-[0_0_16px_rgba(245,158,11,0.7)] flex items-center gap-1 animate-pulse transition-all">
      <span>Q${q.numero}</span>
    </div>
    <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-neutral-950/95 text-neutral-200 text-[11px] px-3 py-1.5 rounded-xl border border-amber-400/30 shadow-2xl font-mono backdrop-blur-xl max-w-xs truncate">
      <span class="text-amber-400 font-bold mr-1">Q${q.numero}:</span>
      <span class="qpin-title">${escaparHtml(q.titulo || 'Questão sem enunciado')}</span>
    </div>
  `;

  new window.OpenSeadragon.MouseTracker({
    element: qElem,
    clickHandler: (e) => {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
      focarQuestaoNoEditor(q.id);
    }
  });

  const location = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(q.x, q.y));
  viewerInstance.addOverlay({
    element: qElem,
    location: location,
    placement: window.OpenSeadragon.Placement.CENTER
  });
}

function destacarQuestaoTemporariamente(id) {
  const qElem = document.getElementById(`editor-qpin-${id}`);
  if (!qElem) return;
  const badge = qElem.querySelector(".qpin-badge");
  if (!badge) return;
  badge.classList.add("ring-4", "ring-amber-300", "ring-offset-2", "ring-offset-black", "!scale-125");
  setTimeout(() => {
    if (badge) badge.classList.remove("ring-4", "ring-amber-300", "ring-offset-2", "ring-offset-black", "!scale-125");
  }, 1600);
}

export function focarQuestaoNoEditor(id) {
  const q = editorQuestoes.find((item) => item.id === id);
  if (!q) return;

  if (viewerInstance && viewerInstance.viewport) {
    const point = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(q.x, q.y));
    viewerInstance.viewport.panTo(point);
    destacarQuestaoTemporariamente(q.id);
  }

  const card = document.getElementById(`card-questao-${q.id}`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card.classList.add("ring-2", "ring-amber-400/70", "!bg-white/[0.08]");
    setTimeout(() => {
      card.classList.remove("ring-2", "ring-amber-400/70", "!bg-white/[0.08]");
    }, 1500);
  }

  const inputEl = document.getElementById(`dashQuestaoTitulo_${q.id}`);
  if (inputEl) {
    inputEl.focus();
  }
}

export function atualizarTituloQuestaoCms(id, value) {
  const q = editorQuestoes.find((item) => item.id === id);
  if (!q) return;
  q.titulo = value || "";

  const qElem = document.getElementById(`editor-qpin-${q.id}`);
  if (qElem) {
    qElem.title = `Questão Q${q.numero}: ${q.titulo || 'Clique para focar'} (X: ${q.x}, Y: ${q.y})`;
    const titleSpan = qElem.querySelector(".qpin-title");
    if (titleSpan) {
      titleSpan.textContent = q.titulo || "Questão sem enunciado";
    }
  }
}

export function excluirQuestaoCms(id) {
  const index = editorQuestoes.findIndex((item) => item.id === id);
  if (index === -1) return;

  const qElem = document.getElementById(`editor-qpin-${id}`);
  if (qElem && viewerInstance) {
    try { viewerInstance.removeOverlay(qElem); } catch (e) {}
    if (qElem.parentNode) qElem.parentNode.removeChild(qElem);
  }

  editorQuestoes.splice(index, 1);

  editorQuestoes.forEach((item, idx) => {
    item.numero = idx + 1;
  });

  if (viewerInstance && viewerInstance.viewport) {
    editorQuestoes.forEach((item) => {
      renderizarQuestaoNoCanvas(item);
    });
  }

  atualizarInterfaceListaQuestoes();
  exibirToastDiscreto("Questão excluída do simulado.", "blue");
}

function atualizarInterfaceListaQuestoes() {
  const badgeTotal = document.getElementById("dashTotalQuestoesBadge");
  const containerLista = document.getElementById("dashListaQuestoes");

  if (badgeTotal) {
    badgeTotal.textContent = `${editorQuestoes.length} ${editorQuestoes.length === 1 ? "Questão" : "Questões"}`;
  }

  if (!containerLista) return;

  if (editorQuestoes.length === 0) {
    containerLista.innerHTML = `
      <p class="text-neutral-500 text-xs py-6 px-4 text-center border border-dashed border-white/[0.08] rounded-xl font-mono leading-relaxed">
        Nenhuma questão cadastrada para esta lâmina. Clique em '+ Nova Questão na Lâmina' e marque o ponto no canvas à direita.
      </p>
    `;
    return;
  }

  let html = `<div class="space-y-3">`;
  editorQuestoes.forEach((q) => {
    html += `
      <div id="card-questao-${q.id}" class="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-all space-y-2.5 group">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
              Q${q.numero}
            </span>
            <span class="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Simulado de Bancada</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              type="button" 
              onclick="window.App.focarQuestaoNoEditor('${q.id}')" 
              class="px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-amber-300 border border-white/[0.08] hover:border-amber-400/30 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
              title="Focar este ponto no canvas">
              Focar
            </button>
            <button 
              type="button" 
              onclick="window.App.excluirQuestaoCms('${q.id}')" 
              class="px-2 py-1 rounded bg-rose-500/5 hover:bg-rose-500/15 text-rose-400/80 hover:text-rose-400 border border-rose-500/20 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
              title="Excluir questão">
              Excluir
            </button>
          </div>
        </div>

        <div>
          <textarea 
            id="dashQuestaoTitulo_${q.id}" 
            rows="2"
            placeholder="Título / Pergunta da questão..." 
            oninput="window.App.atualizarTituloQuestaoCms('${q.id}', this.value)"
            class="w-full bg-neutral-950/60 border border-white/[0.08] focus:border-amber-400/40 text-xs text-white rounded-lg p-2.5 outline-none transition-colors font-sans placeholder-neutral-500 resize-y leading-relaxed">${escaparHtml(q.titulo || '')}</textarea>
        </div>

        <div class="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-0.5 border-t border-white/[0.04]">
          <span>Coordenadas:</span>
          <span class="text-neutral-400 font-mono">X: ${Math.round(q.x)} &bull; Y: ${Math.round(q.y)}</span>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  containerLista.innerHTML = html;
}

function escaparHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================================
 * GESTÃO DINÂMICA DE MÓDULOS & RESUMOS MORFOLÓGICOS (CMS CURRICULAR)
 * ============================================================================ */

const sinteseCuradaPadrao = {
  osseo: [
    {
      label: "Definição",
      text: "Tecido conjuntivo especializado e mineralizado, principal constituinte do esqueleto adulto. Fornece suporte mecânico aos tecidos moles, alavanca para locomoção, proteção a órgãos vitais e atua como a principal reserva corporal de íons cálcio e fosfato."
    },
    {
      label: "Componentes da Matriz",
      text: "Matriz óssea calcificada composta por porção orgânica (cerca de 95% de colágeno tipo I associado a proteoglicanos e glicoproteínas como osteonectina e osteocalcina) e porção inorgânica (cristais de hidroxiapatita de fosfato de cálcio depositados ordenadamente sobre as fibrilas colágenas)."
    },
    {
      label: "Células Principais",
      text: "Osteoblastos (células jovens da superfície responsáveis pela síntese e mineralização do osteoide), osteócitos (células maduras residentes em lacunas, conectadas por canalículos para trocas metabólicas) e osteoclastos (células gigantes multinucleadas especializadas na reabsorção óssea enzimática)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Ósseo Compacto (cortical densa sem cavidades visíveis, organizada em Sistemas de Havers ou ósteons concêntricos e canais vasculares de Volkmann) e Ósseo Esponjoso (rede tridimensional de trabéculas ósseas que delimitam cavidades intercomunicantes preenchidas por medula óssea hematopoiética ou adiposa)."
    }
  ],
  conjuntivo: [
    {
      label: "Definição",
      text: "Tecido de origem mesodérmica amplamente distribuído pelo organismo, responsável pela sustentação estrutural, conexão entre diferentes tecidos, preenchimento de espaços, isolamento de órgãos, via de trânsito vascular e defesa imunológica contra patógenos."
    },
    {
      label: "Componentes da Matriz",
      text: "Abundante matriz extracelular (MEC) constituída por Substância Fundamental Amorfa (gel aquoso viscoso rico em ácido hialurônico, glicosaminoglicanos sulfatados e proteoglicanos) e Fibras Estruturais (fibras colágenas tipo I e III de alta resistência à tração, fibras elásticas flexíveis e fibras reticulares de sustentação estromal)."
    },
    {
      label: "Células Principais",
      text: "Células residentes (fibroblastos ativamente secretores de matriz, fibrócitos fusiformes quiescentes, macrófagos fagocitários residentes e mastócitos granulosos ricos em histamina e heparina) e células transitórias de defesa (plasmócitos produtores de anticorpos, linfócitos, neutrófilos e eosinófilos)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Conjuntivo Frouxo (distribuição equilibrada e delicada entre células, fibras finas e substância amorfa; altamente flexível e vascularizado, suporta epitélios e envolve vasos) e Conjuntivo Denso (predomínio expressivo de feixes espessos de colágeno tipo I; divide-se em Denso Não Modelado, com feixes entrelaçados na derme profunda e cápsulas de órgãos, e Denso Modelado, com feixes rigorosamente paralelos em tendões e ligamentos)."
    }
  ],
  epitelial: [
    {
      label: "Definição",
      text: "Tecido avascular composto por células contíguas intimamente unidas por complexos juncionais, com escassa substância intercelular. Recobre superfícies externas (pele), reveste cavidades corpóreas internas (mucosas e serosas) e forma o parênquima das glândulas secretoras."
    },
    {
      label: "Componentes da Matriz",
      text: "Praticamente ausente no espaço intercelular. O epitélio repousa invariavelmente sobre uma lâmina basal acelular (rede de colágeno tipo IV, laminina, entactina e perlecan) que o ancora ao conjuntivo subjacente e através da qual difusamente chegam gases e nutrientes."
    },
    {
      label: "Células Principais",
      text: "Células poliédricas com evidente polaridade morfológica e funcional: polo apical (voltado para a luz ou superfície, frequentemente dotado de microvilosidades ou cílios), polos laterais (unidos por zônulas de oclusão, zônulas de adesão e desmossomos) e polo basal (ancorado por hemidesmossomos)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Epitélios de Revestimento (simples pavimentoso, simples cúbico, simples prismático, estratificado pavimentoso queratinizado ou não queratinizado, pseudoestratificado colunar ciliado e de transição/urotélio) e Epitélios Glandulares (exócrinos acinares, tubulares ou alveolares dotados de ductos; e endócrinos cordonais ou vesiculares desprovidos de ductos com secreção hematogênica)."
    }
  ],
  adiposo: [
    {
      label: "Definição",
      text: "Variedade especializada de tecido conjuntivo no qual predominam células adiposas (adipócitos). Constitui o principal reservatório energético do corpo na forma de triglicerídeos neutros, além de atuar no isolamento térmico, proteção mecânica e como órgão endócrino ativo (produtor de leptina e adipocinas)."
    },
    {
      label: "Componentes da Matriz",
      text: "Matriz escassa envolvida por uma delicada trama de fibras reticulares (colágeno tipo III) que contorna individualmente cada célula, acompanhada por uma densa malha de capilares contínuos que supre as elevadas demandas metabólicas de lipólise e lipogênese."
    },
    {
      label: "Células Principais",
      text: "Adipócitos uniloculares (células esféricas grandes com gota lipídica única que ocupa quase todo o citoplasma e desloca o núcleo para a periferia) e adipócitos multiloculares (células menores, poligonais, com núcleo central esférico e numerosas gotículas lipídicas associadas a mitocôndrias ricas em citocromos)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Tecido Adiposo Unilocular / Branco (mais abundante, responsável pela estocagem de lipídios em adultos, modelagem corporal e secreção de adiponectina) e Tecido Adiposo Multilocular / Marrom (presente sobretudo no feto e recém-nascido, especializado na termogênese sem tremor via proteína desacopladora UCP-1 / termogenina)."
    }
  ],
  cartilaginoso: [
    {
      label: "Definição",
      text: "Forma especializada de tecido conjuntivo de suporte com consistência rígida e firme, dotada de notável elasticidade mecânica. É avascular, desprovido de vasos linfáticos e nervos, dependendo integralmente da difusão de nutrientes a partir do tecido conjuntivo vascularizado adjacente (pericôndrio)."
    },
    {
      label: "Componentes da Matriz",
      text: "Matriz extracelular altamente hidratada (cerca de 75% de água ligada a proteoglicanos com cadeias de condroitim-sulfato e queratam-sulfato associadas a ácido hialurônico / agrecano) entremeada por fibras de colágeno tipo II ou fibras elásticas que suportam forças intensas de compressão."
    },
    {
      label: "Células Principais",
      text: "Condroblastos (células basofílicas jovens da camada condrogênica do pericôndrio, com intensa atividade de secreção de matriz) e condrócitos (células arredondadas maduras alojadas em cavidades da matriz denominadas lacunas, isoladas ou dispostas em grupos isógenos coronários ou axiais)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Cartilagem Hialina (mais comum, matriz vítrea com colágeno tipo II; fossas nasais, laringe, anéis traqueais e superfícies articulares), Cartilagem Elástica (semelhante à hialina, porém acrescida de densa rede de fibras elásticas; epiglote e pavilhão auditivo) e Fibrocartilagem (sem pericôndrio, com feixes densos de colágeno tipo I; discos intervertebrais, meniscos e sínfise púbica)."
    }
  ],
  muscular: [
    {
      label: "Definição",
      text: "Tecido composto por células alongadas de origem mesodérmica (fibras musculares ou miócitos) especializadas na contratilidade ativa e na geração de força de tração através da transformação de energia química (ATP) em movimento mecânico corporal ou visceral."
    },
    {
      label: "Componentes da Matriz",
      text: "Bainhas conjuntas organizadas em camadas concêntricas que transmitem a contração aos tendões e osso: Endomísio (fina lâmina de fibras reticulares contornando cada miócito individual), Perimísio (feixes colágenos que agrupam fascículos musculares) e Epimísio (cápsula externa de conjuntivo denso que recobre o músculo inteiro)."
    },
    {
      label: "Células Principais",
      text: "Miócitos cujo citoplasma (sarcoplasma) é preenchido longitudinalmente por miofilamentos finos de actina associada a troponina e tropomiosina, e filamentos grossos de miosina, regulados por ciclos intracelulares de liberação e recaptação de cálcio pelo retículo sarcoplasmático."
    },
    {
      label: "Subtipos e Classificação",
      text: "Estriado Esquelético (fibras cilíndricas muito longas, multinucleadas com núcleos estritamente periféricos; controle voluntário e contração rápida), Estriado Cardíaco (células ramificadas mononucleadas com núcleos centrais, unidas transversalmente por discos intercalares com desmossomos e junções comunicantes; contração involuntária e vigorosa) e Muscular Liso (células fusiformes uninucleadas centrais sem sarcômeros transversais; contração lenta, sustentada e involuntária em vísceras e vasos sanguíneos)."
    }
  ],
  nervoso: [
    {
      label: "Definição",
      text: "Tecido com altíssima especialização funcional voltado para a percepção de estímulos do meio externo e interno, integração e processamento de informações neurais e deflagração de impulsos elétricos para efetores musculares ou glandulares."
    },
    {
      label: "Componentes da Matriz",
      text: "Praticamente destituído de matriz extracelular conjuntiva clássica (salvo em meninges e bainhas periféricas); a sustentação física, isolamento elétrico e regulação iônica e nutricional são executados pelo neurópilo (trama interdigitada contínua de axônios, dendritos e processos citoplasmáticos da neuroglia)."
    },
    {
      label: "Células Principais",
      text: "Neurônios (unidades funcionais excitáveis formadas por corpo celular/soma rico em corpúsculos de Nissl, dendritos ramificados receptores de estímulos e um único axônio condutor de potenciais de ação) e Células da Glia (astrócitos de suporte e barreira hematoencefálica, oligodendrócitos mielinizantes centrais, micróglia de fagocitose imunológica e células ependimárias de revestimento ventricular)."
    },
    {
      label: "Subtipos e Classificação",
      text: "Sistema Nervoso Central / SNC (estruturado em Substância Cinzenta, onde residem os corpos neuronais, sinapses e neurópilo, e Substância Branca, formada por tratos de fibras axonais mielinizadas) e Sistema Nervoso Periférico / SNP (nervos periféricos revestidos por endoneuro, perineuro e epineuro, gânglios sensitivos e motores com células satélites, e células de Schwann mielinizantes)."
    }
  ],
  circulatorio: [
    {
      label: "Definição",
      text: "Circuito tubular fechado e contínuo responsável por impulsionar e conduzir sangue e linfa por todos os tecidos do corpo humano, viabilizando o transporte de gases respiratórios (oxigênio e gás carbônico), nutrientes, hormônios, mediadores químicos e elementos celulares de defesa."
    },
    {
      label: "Componentes da Matriz",
      text: "Lâmina basal subendotelial contínua ou descontínua associada a lâminas elásticas concêntricas (interna e externa) e estroma conjuntivo perivascular (túnica adventícia rica em colágeno tipo I, fibras elásticas, fibroblastos e vasa vasorum)."
    },
    {
      label: "Células Principais",
      text: "Células endoteliais poligonais pavimentosas (monocamada com permeabilidade seletiva que sintetiza óxido nítrico, endotelina, prostaciclina e expressa moléculas de adesão leucocitária), pericitos (células contráteis pericapilares com potencial regenerativo) e células musculares lisas da túnica média reguladoras do diâmetro luminal e resistência vascular periférica."
    },
    {
      label: "Subtipos e Classificação",
      text: "Artérias (elásticas de condução com paredes amortecedoras de pulso e musculares de distribuição), Microcirculação (arteríolas reguladoras de resistência pré-capilar; capilares contínuos sem fenestras, fenestrados com poros filtrantes e sinusoides de trajeto tortuoso com amplas fendas; e vênulas pós-capilares) e Veias (vasos de capacitância dotados de túnica adventícia espessa e válvulas intraluminais que impedem o refluxo centrífugo)."
    }
  ]
};

export function popularSelectModulosCms() {
  const select = document.getElementById("cmsModuloSelect");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = "";

  const labelsDisciplina = {
    histologia: "Histologia Básica & Especial",
    patologia: "Patologia Geral & Especial",
    parasitologia: "Parasitologia Médica",
    microbiologia: "Microbiologia Clínica",
    anatomia: "Anatomia Humana"
  };

  Object.keys(topicosCurriculares).forEach((discKey) => {
    const topicos = topicosCurriculares[discKey];
    if (!topicos || topicos.length === 0) return;

    const group = document.createElement("optgroup");
    group.label = labelsDisciplina[discKey] || discKey.toUpperCase();

    topicos.forEach((topico) => {
      const opt = document.createElement("option");
      opt.value = topico.id;
      opt.textContent = `${topico.nome}`;
      opt.dataset.disciplina = discKey;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  if (valorAtual) {
    select.value = valorAtual;
  }
}

export function onModuloSelecionado(topicoId) {
  if (!topicoId) return;
  const select = document.getElementById("cmsModuloSelect");
  const selectedOpt = select ? select.selectedOptions[0] : null;
  const disciplina = selectedOpt ? selectedOpt.dataset.disciplina : "histologia";
  carregarModuloParaEdicao(topicoId, disciplina);
}

export async function carregarModuloParaEdicao(topicoId, disc = "histologia") {
  if (!topicoId) return;
  moduloEmEdicaoId = topicoId;
  moduloEmEdicaoDisciplina = disc;

  const docIdInput = document.getElementById("cmsModuloDocId");
  const tituloInput = document.getElementById("cmsModuloTitulo");
  const catInput = document.getElementById("cmsModuloCategoria");
  const refInput = document.getElementById("cmsModuloReferencia");
  const select = document.getElementById("cmsModuloSelect");

  if (select && select.value !== topicoId) {
    select.value = topicoId;
  }
  if (docIdInput) docIdInput.value = topicoId;

  let nomeCurricular = topicoId;
  Object.keys(topicosCurriculares).forEach(d => {
    const achado = (topicosCurriculares[d] || []).find(t => t.id === topicoId);
    if (achado) {
      nomeCurricular = achado.nome;
      if (!disc) moduloEmEdicaoDisciplina = d;
    }
  });

  const catPadrao = (moduloEmEdicaoDisciplina || "histologia").charAt(0).toUpperCase() + (moduloEmEdicaoDisciplina || "histologia").slice(1);
  const refPadrao = "Junqueira & Carneiro — Histologia Básica";

  let pontosPadrao = sinteseCuradaPadrao[topicoId] ? [...sinteseCuradaPadrao[topicoId]] : [
    { label: "Definição", text: `Aspectos gerais e delimitação morfológica de ${nomeCurricular}.` },
    { label: "Componentes Estruturais", text: "Organização celular, elementos estromais e matriz de sustentação." },
    { label: "Critérios Diagnósticos", text: "Critérios ópticos de identificação ao microscópio de luz e colorações específicas." },
    { label: "Classificação Funcional", text: "Subdivisão tecidual e correlação com a fisiologia e patologia médica." }
  ];

  let docData = null;
  if (typeof db !== "undefined" && db) {
    try {
      const snap = await db.collection("modulos").doc(topicoId).get();
      if (snap.exists) {
        docData = snap.data();
      }
    } catch (e) {
      console.warn("[CMS] Aviso ao buscar dados do módulo no Firestore:", e);
    }
  }

  if (docData) {
    if (tituloInput) tituloInput.value = docData.title || nomeCurricular;
    if (catInput) catInput.value = docData.category || catPadrao;
    if (refInput) refInput.value = docData.bibliographicReference || refPadrao;

    if (Array.isArray(docData.summaryPoints) && docData.summaryPoints.length > 0) {
      summaryPointsEmEdicao = docData.summaryPoints.map(p => ({
        label: p.label || "Tópico",
        text: p.text || p.desc || ""
      }));
    } else {
      summaryPointsEmEdicao = pontosPadrao.map(p => ({ label: p.label, text: p.text || p.desc }));
    }
  } else {
    if (tituloInput) tituloInput.value = nomeCurricular;
    if (catInput) catInput.value = catPadrao;
    if (refInput) refInput.value = refPadrao;
    summaryPointsEmEdicao = pontosPadrao.map(p => ({ label: p.label, text: p.text || p.desc }));
  }

  renderizarRepeaterSummaryPoints();
  carregarLaminasAssociadasModulo(topicoId);
}

export async function carregarLaminasAssociadasModulo(topicoId) {
  const container = document.getElementById("cmsListaLaminasAssociadas");
  const badge = document.getElementById("cmsTotalLaminasVinculadasBadge");
  laminasDoModuloCache = [];

  if (!container) return;

  let laminas = acervoFirestoreCache.filter(l => {
    const t = (l.topico || "").toLowerCase().trim();
    return t === topicoId.toLowerCase().trim() || t.includes(topicoId.toLowerCase().trim());
  });

  if (laminas.length === 0 && typeof db !== "undefined" && db) {
    try {
      const snap = await db.collection("laminas").where("topico", "==", topicoId).get();
      snap.forEach(d => laminas.push({ id: d.id, ...d.data() }));
    } catch (e) {}
  }

  laminasDoModuloCache = laminas;

  if (badge) {
    badge.textContent = `${laminas.length} ${laminas.length === 1 ? 'vinculada' : 'vinculadas'}`;
  }

  if (laminas.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-4 px-4 text-center text-xs font-mono text-neutral-500 border border-dashed border-white/[0.08] rounded-xl">
        Nenhuma lâmina vinculada a este tópico no acervo. Você pode cadastrar uma lâmina para este módulo na aba 'Editor &amp; Cadastro'.
      </div>
    `;
    return;
  }

  container.innerHTML = laminas.map(lam => `
    <div class="bg-[#18181d] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-2.5">
      <div class="min-w-0">
        <span class="text-xs font-serif font-bold text-white truncate block">${escaparHtml(lam.nome || "Lâmina")}</span>
        <span class="text-[10px] font-mono text-neutral-400 block">${escaparHtml(lam.coloracao || "Coloração")}</span>
      </div>
      <span class="px-2 py-0.5 rounded-full text-[9px] font-mono shrink-0 ${lam.status === 'ativa' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
        ${lam.status || 'ativa'}
      </span>
    </div>
  `).join("");
}

export function renderizarRepeaterSummaryPoints() {
  const container = document.getElementById("cmsSummaryPointsList");
  if (!container) return;

  if (!summaryPointsEmEdicao || summaryPointsEmEdicao.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs font-mono text-neutral-500 border border-dashed border-white/[0.08] rounded-xl">
        Nenhum tópico adicionado. Clique no botão '+ Adicionar Tópico' acima para incluir marcadores no Resumo Morfológico.
      </div>
    `;
    return;
  }

  container.innerHTML = summaryPointsEmEdicao.map((ponto, idx) => `
    <div class="bg-[#16161b] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3 group hover:border-[#d4af37]/40 transition-all duration-200">
      <div class="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2.5">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[#d4af37] text-[11px] font-mono font-bold flex items-center justify-center">
            ${idx + 1}
          </span>
          <span class="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold">Tópico ${idx + 1}</span>
        </div>
        <button 
          type="button" 
          onclick="window.App.removerPontoResumoCms(${idx})" 
          class="text-neutral-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer text-xs font-mono flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Remover</span>
        </button>
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Rótulo / Título do Tópico (Label)</label>
        <input 
          type="text" 
          value="${escaparHtml(ponto.label || '')}" 
          placeholder="Ex: Matriz Extracelular, Células Principais, Definição..." 
          oninput="window.App.atualizarPontoResumoLabel(${idx}, this.value)"
          class="w-full bg-[#1c1c22] border border-white/[0.08] focus:border-[#d4af37]/60 text-white rounded-lg px-3.5 py-2 text-xs font-sans focus:outline-none" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Texto Descritivo e Detalhamento Morfológico</label>
        <textarea 
          rows="3" 
          placeholder="Descreva minuciosamente os critérios histológicos, composição química, populações celulares ou relevância diagnóstica..." 
          oninput="window.App.atualizarPontoResumoText(${idx}, this.value)"
          class="w-full bg-[#1c1c22] border border-white/[0.08] focus:border-[#d4af37]/60 text-neutral-200 rounded-lg px-3.5 py-2.5 text-xs font-sans focus:outline-none custom-scrollbar leading-relaxed">${escaparHtml(ponto.text || '')}</textarea>
      </div>
    </div>
  `).join("");
}

export function atualizarPontoResumoLabel(idx, val) {
  if (summaryPointsEmEdicao[idx]) {
    summaryPointsEmEdicao[idx].label = val;
  }
}

export function atualizarPontoResumoText(idx, val) {
  if (summaryPointsEmEdicao[idx]) {
    summaryPointsEmEdicao[idx].text = val;
  }
}

export function adicionarPontoResumoCms() {
  summaryPointsEmEdicao.push({
    label: "Novo Critério Morfológico",
    text: ""
  });
  renderizarRepeaterSummaryPoints();
  const inputs = document.querySelectorAll("#cmsSummaryPointsList input");
  if (inputs.length > 0) {
    const ultimo = inputs[inputs.length - 1];
    ultimo.focus();
    ultimo.select();
  }
}

export function removerPontoResumoCms(idx) {
  if (idx >= 0 && idx < summaryPointsEmEdicao.length) {
    summaryPointsEmEdicao.splice(idx, 1);
    renderizarRepeaterSummaryPoints();
  }
}

export async function salvarModuloFirestore() {
  if (!moduloEmEdicaoId) {
    mostrarToastCms("Selecione um módulo antes de salvar.", "erro");
    return;
  }

  const btn = document.getElementById("btnSalvarModuloCms");
  const txtBtn = document.getElementById("txtBtnSalvarModulo");
  const titulo = (document.getElementById("cmsModuloTitulo")?.value || "").trim();
  const categoria = (document.getElementById("cmsModuloCategoria")?.value || "").trim();
  const referencia = (document.getElementById("cmsModuloReferencia")?.value || "").trim();

  if (!titulo) {
    mostrarToastCms("O título do módulo é obrigatório.", "erro");
    return;
  }

  const pontosValidos = summaryPointsEmEdicao
    .map(p => ({
      label: (p.label || "").trim(),
      text: (p.text || "").trim()
    }))
    .filter(p => p.label.length > 0 || p.text.length > 0);

  if (pontosValidos.length === 0) {
    mostrarToastCms("Adicione pelo menos um tópico ao Resumo Morfológico.", "erro");
    return;
  }

  if (btn) btn.disabled = true;
  if (txtBtn) txtBtn.textContent = "Salvando no Firestore...";

  try {
    const payload = {
      id: moduloEmEdicaoId,
      title: titulo,
      category: categoria || "Histologia",
      bibliographicReference: referencia || "Junqueira & Carneiro — Histologia Básica",
      summaryPoints: pontosValidos,
      associatedSlides: laminasDoModuloCache.map(l => l.id),
      updatedAtISO: new Date().toISOString()
    };

    if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    if (typeof db !== "undefined" && db) {
      await db.collection("modulos").doc(moduloEmEdicaoId).set(payload, { merge: true });
      mostrarToastCms(`Módulo "${titulo}" salvo e sincronizado em tempo real!`, "sucesso");
    } else {
      throw new Error("Conexão com Firestore indisponível.");
    }
  } catch (erro) {
    console.error("[CMS] Erro ao salvar módulo no Firestore:", erro);
    mostrarToastCms(`Erro ao salvar: ${erro.message || erro}`, "erro");
  } finally {
    if (btn) btn.disabled = false;
    if (txtBtn) txtBtn.textContent = "Salvar Alterações no Firestore";
  }
}

export function mostrarToastCms(mensagem, tipo = "sucesso") {
  const container = document.getElementById("cmsToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const isSucesso = tipo === "sucesso";

  toast.className = `pointer-events-auto transform transition-all duration-300 ease-out translate-y-4 opacity-0 flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
    isSucesso 
      ? 'bg-[#0f1715]/95 border-emerald-500/40 text-emerald-100 shadow-[0_12px_40px_rgba(16,185,129,0.2)]'
      : 'bg-[#1c0f13]/95 border-rose-500/40 text-rose-100 shadow-[0_12px_40px_rgba(244,63,94,0.2)]'
  }`;

  const iconeHtml = isSucesso
    ? `<div class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
         <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
       </div>`
    : `<div class="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
         <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
       </div>`;

  toast.innerHTML = `
    ${iconeHtml}
    <div class="flex-1 min-w-0 pt-0.5">
      <h5 class="text-xs font-mono font-bold uppercase tracking-wider ${isSucesso ? 'text-emerald-300' : 'text-rose-300'}">
        ${isSucesso ? 'Sincronização Cloud Firestore' : 'Atenção no Salvamento'}
      </h5>
      <p class="text-xs font-sans text-neutral-200 mt-0.5 leading-snug">${escaparHtml(mensagem)}</p>
    </div>
    <button type="button" class="text-neutral-400 hover:text-white shrink-0 p-1 cursor-pointer" onclick="this.parentElement.remove()">
      &times;
    </button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  });

  setTimeout(() => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/* =========================================================
   ========================================================= */

export function encerrarPainelCms() {
  modoCriacaoQuestao = false;
  if (typeof _unsubDashboardAcervo === "function") {
    try { _unsubDashboardAcervo(); } catch (e) {}
    _unsubDashboardAcervo = null;
  }
  if (viewerInstance && typeof viewerInstance.destroy === "function") {
    try { viewerInstance.destroy(); } catch (e) {}
    viewerInstance = null;
  }
}

window.osdEditorAction = osdEditorAction;
window.publicarLaminaCms = publicarLaminaCms;

// inicializarPainelCms() e chamada pelo main.js via window.App.inicializarPainelCms()
// quando frenteAtiva === "dashboard" no renderView. Nao executar aqui automaticamente.

window.App = window.App || {};
Object.assign(window.App, {
  inicializarPainelCms, encerrarPainelCms, toggleDashboard, alternarTopicoCms, filtroAcervoCms,
  alternarStatusCms, renderizarTabelaAcervo, renderizarAcervoCms,
  editarLaminaCms, excluirLaminaCms, resetarFormularioDashboard,
  atualizarTopicosCms, carregarImagemNoEditor, adicionarPinoEditor,
  editarRotuloPinoCms, excluirPinoCms, vincularTextoAoPino,
  inicializarEventosPreviewInterativo, osdEditorAction, publicarLaminaCms,
  ativarModoNovaQuestao, atualizarTituloQuestaoCms, excluirQuestaoCms, focarQuestaoNoEditor,
  focarPinoEditor,
  atualizarCardAnaliseOpticaCms,
  carregarListaDeAssets, onAssetSelecionado, alternarModoCaminhoManual,
  definirModoAnotacao, onAtualizarRaioCirculo,
  popularSelectModulosCms, onModuloSelecionado, carregarModuloParaEdicao,
  renderizarRepeaterSummaryPoints, atualizarPontoResumoLabel, atualizarPontoResumoText,
  adicionarPontoResumoCms, removerPontoResumoCms, salvarModuloFirestore, mostrarToastCms
});
window.inicializarPainelCms = inicializarPainelCms;
window.encerrarPainelCms = encerrarPainelCms;
window.toggleDashboard = toggleDashboard;
window.alternarTopicoCms = alternarTopicoCms;
window.filtroAcervoCms = filtroAcervoCms;
window.alternarStatusCms = alternarStatusCms;
window.renderizarTabelaAcervo = renderizarTabelaAcervo;
window.renderizarAcervoCms = renderizarAcervoCms;
window.editarLaminaCms = editarLaminaCms;
window.excluirLaminaCms = excluirLaminaCms;
window.resetarFormularioDashboard = resetarFormularioDashboard;
window.atualizarTopicosCms = atualizarTopicosCms;
window.carregarImagemNoEditor = carregarImagemNoEditor;
window.adicionarPinoEditor = adicionarPinoEditor;
window.editarRotuloPinoCms = editarRotuloPinoCms;
window.excluirPinoCms = excluirPinoCms;
window.vincularTextoAoPino = vincularTextoAoPino;
window.osdEditorAction = osdEditorAction;
window.publicarLaminaCms = publicarLaminaCms;
window.ativarModoNovaQuestao = ativarModoNovaQuestao;
window.atualizarTituloQuestaoCms = atualizarTituloQuestaoCms;
window.excluirQuestaoCms = excluirQuestaoCms;
window.focarQuestaoNoEditor = focarQuestaoNoEditor;
window.focarPinoEditor = focarPinoEditor;
window.atualizarCardAnaliseOpticaCms = atualizarCardAnaliseOpticaCms;
window.carregarListaDeAssets = carregarListaDeAssets;
window.onAssetSelecionado = onAssetSelecionado;
window.alternarModoCaminhoManual = alternarModoCaminhoManual;
window.definirModoAnotacao = definirModoAnotacao;
window.onAtualizarRaioCirculo = onAtualizarRaioCirculo;
window.popularSelectModulosCms = popularSelectModulosCms;
window.onModuloSelecionado = onModuloSelecionado;
window.carregarModuloParaEdicao = carregarModuloParaEdicao;
window.renderizarRepeaterSummaryPoints = renderizarRepeaterSummaryPoints;
window.atualizarPontoResumoLabel = atualizarPontoResumoLabel;
window.atualizarPontoResumoText = atualizarPontoResumoText;
window.adicionarPontoResumoCms = adicionarPontoResumoCms;
window.removerPontoResumoCms = removerPontoResumoCms;
window.salvarModuloFirestore = salvarModuloFirestore;
window.mostrarToastCms = mostrarToastCms;
