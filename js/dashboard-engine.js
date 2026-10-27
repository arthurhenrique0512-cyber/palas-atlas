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

let editorPins = [];
let viewerInstance = null;
let laminaEmEdicaoId = null;
let acervoFirestoreCache = [];
let filtroStatusAtual = "todos";

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

  if (topico === "acervo" && viewerInstance && typeof viewerInstance.destroy === "function") {
    try { viewerInstance.destroy(); } catch(e) {}
    viewerInstance = null;
  }
  
  const btnEditor = document.getElementById("btnTopicoEditor");
  const btnAcervo = document.getElementById("btnTopicoAcervo");
  
  const clsAtivo = "px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase flex items-center gap-2 rounded-lg transition-all duration-200 cursor-pointer bg-white/[0.06] text-white border border-white/[0.08] shadow-sm";
  const clsInativo = "px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase flex items-center gap-2 rounded-lg transition-all duration-200 cursor-pointer text-neutral-400 hover:text-white hover:bg-white/[0.03]";
  
  if (contEditor) contEditor.classList.add("hidden");
  if (contAcervo) contAcervo.classList.add("hidden");

  if (topico === "acervo" || topico === "laminas") {
    if (contAcervo) contAcervo.classList.remove("hidden");
    if (btnAcervo) {
      btnAcervo.className = clsAtivo;
      const dot = btnAcervo.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-[#d4af37]";
    }
    if (btnEditor) {
      btnEditor.className = clsInativo;
      const dot = btnEditor.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-neutral-600";
    }
    renderizarTabelaAcervo();
  } else {
    if (contEditor) contEditor.classList.remove("hidden");
    if (btnEditor) {
      btnEditor.className = clsAtivo;
      const dot = btnEditor.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-[#d4af37]";
    }
    if (btnAcervo) {
      btnAcervo.className = clsInativo;
      const dot = btnAcervo.querySelector("span");
      if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-neutral-600";
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
  renderizarTabelaAcervo();
}

export function inicializarPainelCms() {
  atualizarTopicosCms("histologia");
  const seletorTopico = document.getElementById("dashSelectTopico");
  if (seletorTopico) seletorTopico.value = "muscular";
  inicializarEventosPreviewInterativo();
  setTimeout(() => {
    if (!viewerInstance && document.getElementById("osd-editor-viewer") && !laminaEmEdicaoId) {
      carregarImagemNoEditor("/assets/histologia/muscular-esqueletico-he.jpg", false, true);
    }
  }, 200);
  if (typeof db !== "undefined" && db) {
    db.collection("laminas").onSnapshot(
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
  if (coloracaoSelect && lamina.coloracao) coloracaoSelect.value = lamina.coloracao;
  if (statusSelect) statusSelect.value = lamina.status || "inativa";
  // Req 1: Carrega maxMagnification ao editar
  const maxMagSelect = document.getElementById("dashMaxMagnification");
  if (maxMagSelect) maxMagSelect.value = String(lamina.maxMagnification || 40);
  const urlImagem = lamina.imagemUrl || lamina.dziUrl || lamina.imageUrl || lamina.caminhoImagemBase || "";
  if (imgUrlInput) imgUrlInput.value = urlImagem;
  if (editorTexto) editorTexto.innerHTML = lamina.descricaoHTML || lamina.descricao || "";
  const isDzi = urlImagem.endsWith(".dzi") || urlImagem.includes(".dzi?");
  carregarImagemNoEditor(urlImagem, isDzi, false);
  setTimeout(() => {
    editorPins = [];
    if (viewerInstance && typeof viewerInstance.clearOverlays === "function") viewerInstance.clearOverlays();
    const pinosOrigem = (lamina.pinos || []);
    if (pinosOrigem.length > 0) {
      pinosOrigem.forEach((pin, i) => {
        const pinoData = { id: pin.id || `pin_${Date.now()}_${i}`, rotulo: pin.rotulo || pin.nome || `${i + 1}`, x: pin.x || 0, y: pin.y || 0 };
        editorPins.push(pinoData);
        renderizarPinoNoCanvas(pinoData);
      });
    }
    atualizarInterfaceListaPinos();
    atualizarDropdownPinosVinculacao();
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
  atualizarInterfaceListaPinos();
  atualizarDropdownPinosVinculacao();
  if (viewerInstance && typeof viewerInstance.clearOverlays === "function") viewerInstance.clearOverlays();
  carregarImagemNoEditor("/assets/histologia/muscular-esqueletico-he.jpg", false, true);
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
  if (!laminaEmEdicaoId && !isAutoLoad) { editorPins = []; atualizarInterfaceListaPinos(); atualizarDropdownPinosVinculacao(); }
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
    if (isAutoLoad && url.includes("muscular-esqueletico-he") && editorPins.length === 0 && !laminaEmEdicaoId) {
      adicionarPinoEditor(550, 280, "Estriacoes HE", "pin_demo");
    }
  });
  viewerInstance.addHandler("canvas-click", (event) => {
    if (!event.quick) return;
    const viewportPoint = viewerInstance.viewport.pointFromPixel(event.position);
    const imagePoint = viewerInstance.viewport.viewportToImageCoordinates(viewportPoint);
    adicionarPinoEditor(imagePoint.x, imagePoint.y);
  });
}

export function adicionarPinoEditor(x, y, customLabel, customId) {
  if (!viewerInstance || !viewerInstance.viewport) return;
  const pinId = customId || `pin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const numeroSequencial = editorPins.length + 1;
  const rotulo = customLabel || `P${numeroSequencial}`;
  const pinoData = { id: pinId, rotulo: rotulo, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  editorPins.push(pinoData);
  renderizarPinoNoCanvas(pinoData);
  atualizarInterfaceListaPinos();
  atualizarDropdownPinosVinculacao();
}

function renderizarPinoNoCanvas(pinoData) {
  if (!viewerInstance || !viewerInstance.viewport || !window.OpenSeadragon) return;
  const pinElem = document.createElement("div");
  pinElem.id = `editor-pin-${pinoData.id}`;
  
  // Container principal do pino com classe "group" para exibir o tooltip no hover
  pinElem.className = "editor-pin group relative flex items-center justify-center cursor-pointer z-30 transition-transform duration-200 hover:scale-125";
  pinElem.title = `Pino ${pinoData.rotulo} (X: ${pinoData.x}, Y: ${pinoData.y})`;
  
  // HTML do Pino (Ponto luminoso + Tooltip flutuante)
  pinElem.innerHTML = `
    <div class="w-4 h-4 bg-[#d4af37] border-2 border-white rounded-full shadow-[0_0_15px_rgba(212,175,55,0.6)] animate-pulse"></div>
    <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-neutral-950/90 text-white text-[11px] px-3 py-1 rounded-xl border border-white/[0.08] shadow-2xl font-mono backdrop-blur-xl">
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
  const point = pinElem.querySelector("div");
  if (!point) return;
  
  point.classList.add("!bg-amber-400", "ring-4", "ring-amber-500/50", "scale-150");
  setTimeout(() => {
    if (point) point.classList.remove("!bg-amber-400", "ring-4", "ring-amber-500/50", "scale-150");
  }, 1600);
}

function atualizarInterfaceListaPinos() {
  const containerLista = document.getElementById("dashListaPinos");
  const contadorBadge = document.getElementById("dashTotalPinosBadge");
  if (contadorBadge) contadorBadge.textContent = `${editorPins.length} ${editorPins.length === 1 ? "Pino" : "Pinos"}`;
  if (!containerLista) return;
  if (editorPins.length === 0) {
    containerLista.innerHTML = `<p class="text-neutral-500 text-xs py-6 text-center border border-dashed border-white/[0.08] rounded-xl font-mono">Nenhum pino marcado na imagem. Carregue uma lâmina e clique no canvas à direita para adicionar marcações de diagnóstico.</p>`;
    return;
  }
  let html = `<div class="space-y-2">`;
  editorPins.forEach((p) => {
    html += `
      <div class="p-3 flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#d4af37] font-mono text-[10px] font-bold flex items-center justify-center shadow-sm shrink-0">${p.rotulo}</div>
          <div class="flex flex-col">
            <span class="text-[10px] text-neutral-300 font-mono">Pino Ativo</span>
            <span class="text-[10px] text-neutral-500 font-mono">X: ${Math.round(p.x)} &bull; Y: ${Math.round(p.y)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
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

export function inicializarEventosPreviewInterativo() {
  const editor = document.getElementById("dashEditorTexto");
  if (!editor || editor._eventosInteracaoInjetados) return;
  editor.addEventListener("mouseover", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id]");
    if (!alvo) return;
    const pinId = alvo.getAttribute("data-pin-id");
    if (!pinId) return;
    const pinoData = editorPins.find((item) => item.id === pinId);
    if (!pinoData || !viewerInstance || !viewerInstance.viewport) return;
    const pontoViewport = viewerInstance.viewport.imageToViewportCoordinates(new window.OpenSeadragon.Point(pinoData.x, pinoData.y));
    viewerInstance.viewport.panTo(pontoViewport);
    const pinElem = document.getElementById(`editor-pin-${pinId}`);
    if (pinElem) pinElem.classList.add("ring-4", "ring-amber-400", "ring-offset-2", "ring-offset-black", "!bg-amber-400", "!text-black", "scale-150", "z-50");
  });
  editor.addEventListener("mouseout", (evento) => {
    const alvo = evento.target.closest(".pin-link, [data-pin-id]");
    if (!alvo) return;
    const pinId = alvo.getAttribute("data-pin-id");
    const pinElem = document.getElementById(`editor-pin-${pinId}`);
    if (pinElem) pinElem.classList.remove("ring-4", "ring-amber-400", "ring-offset-2", "ring-offset-black", "!bg-amber-400", "!text-black", "scale-150", "z-50");
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
  const descricaoHTML = descEl ? descEl.innerHTML : "";
  if (!nome || !imagemUrl) { alert("Os campos 'Nome da Peca / Lamina' e 'Caminho do arquivo / pasta' sao obrigatorios para gravacao."); return; }
  const pinos = editorPins.map((p) => ({ id: p.id, rotulo: p.rotulo, x: p.x, y: p.y }));
  // Req 1: Coleta maxMagnification do novo campo e converte para número
  const maxMagEl = document.getElementById("dashMaxMagnification");
  const maxMagnification = maxMagEl ? Number(maxMagEl.value) || 40 : 40;
  const laminaData = { nome, disciplina, topico, coloracao, imagemUrl, descricaoHTML, status, pinos, maxMagnification, dataModificacao: new Date().toISOString() };
  const statusBox = document.getElementById("dashCmsStatus");
  try {
    if (typeof db !== "undefined" && db) {
      if (laminaEmEdicaoId) {
        await db.collection("laminas").doc(laminaEmEdicaoId).update(laminaData);
        exibirToastDiscreto("Lamina atualizada com sucesso no Cloud Firestore!", "emerald");
        resetarFormularioDashboard();
        return;
      } else {
        const docRef = await db.collection("laminas").add(laminaData);
        const novoId = docRef.id;
        await db.collection("laminas").doc(novoId).update({ id: novoId });
        exibirToastDiscreto("Nova lamina cadastrada no Cloud Firestore!", "emerald");
        if (statusBox) {
          const corBadge = status === "ativa" ? "emerald" : "rose";
          statusBox.innerHTML = `
            <div class="font-bold uppercase tracking-wider text-${corBadge}-300">Lâmina Sincronizada (${status.toUpperCase()})</div>
            <div class="mt-1 text-neutral-300 text-xs font-mono">ID: ${novoId} (${pinos.length} pinos vinculados)</div>
            <a href="microscopio.html?id=${novoId}" target="_blank" rel="noopener noreferrer" class="mt-3 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-[#d4af37]/10 text-neutral-200 hover:text-[#d4af37] border border-white/[0.08] hover:border-[#d4af37]/40 text-xs font-mono uppercase tracking-wider shadow-lg inline-flex items-center gap-2 cursor-pointer transition-all duration-300">
              <span>Testar no Microscópio</span>
              <span>&rarr;</span>
            </a>
          `;
          statusBox.classList.remove("hidden");
        }
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

/* =========================================================
   ========================================================= */

window.osdEditorAction = osdEditorAction;
window.publicarLaminaCms = publicarLaminaCms;

// inicializarPainelCms() e chamada pelo main.js via window.App.inicializarPainelCms()
// quando frenteAtiva === "dashboard" no renderView. Nao executar aqui automaticamente.

window.App = window.App || {};
Object.assign(window.App, {
  inicializarPainelCms, toggleDashboard, alternarTopicoCms, filtroAcervoCms,
  alternarStatusCms, renderizarTabelaAcervo, renderizarAcervoCms,
  editarLaminaCms, excluirLaminaCms, resetarFormularioDashboard,
  atualizarTopicosCms, carregarImagemNoEditor, adicionarPinoEditor,
  editarRotuloPinoCms, excluirPinoCms, vincularTextoAoPino,
  inicializarEventosPreviewInterativo, osdEditorAction, publicarLaminaCms
});
window.inicializarPainelCms = inicializarPainelCms;
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
