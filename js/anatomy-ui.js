/**
 * Motor de Visualização para a Bancada Macroscópica (Anatomia)
 * Controla inspeção de peças anatômicas via Pan livre, Zoom contínuo (1x a 3x)
 * e interatividade com pinos demarcados no plano cartesiano percentual.
 */

import { db } from "./firebase-config.js";
import { subscribe } from "./state.js";

// Estado Interno da Bancada de Dissecação Macroscópica
const anatomyState = {
  scale: 1,         // Zoom restrito entre 1x (visão original da peça) e 3x (inspeção de vasos/nervos)
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentPeca: null,
  activePinIndex: null,
  pecasList: []
};

/**
 * Inicializa os ouvintes de eventos da bancada e a subscrição com o roteador central.
 */
function initAnatomyStudio() {
  const container = document.getElementById("bancadaDissecacaoContainer");
  
  if (container) {
    // Eventos do mouse para movimentação livre (Pan)
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Evento de Zoom contínuo no scroll do mouse (com preservação de coordenadas no ponteiro)
    container.addEventListener("wheel", handleWheel, { passive: false });
  }

  // Monitora mudanças na rota da SPA para carregar peças ao ingressar em anatomia
  subscribe((state) => {
    if (state.frenteAtiva === "anatomia") {
      carregarAcervoAnatomia();
    }
  });

  // Seletor de troca rápida de peça anatômica na Prancheta de Estudo
  const seletor = document.getElementById("seletorAnatomia");
  if (seletor) {
    seletor.addEventListener("change", (e) => carregarPecaAnatomica(e.target.value));
  }
}

/**
 * Consulta a coleção de peças no Firestore para recuperar espécimes anatômicos via caminhos locais.
 */
async function carregarAcervoAnatomia() {
  const seletor = document.getElementById("seletorAnatomia");
  const infoContainer = document.getElementById("infoPainelAnatomia");

  try {
    const snapshot = await db.collection("pecas")
      .where("disciplina", "==", "anatomia")
      .get();

    anatomyState.pecasList = [];

    if (snapshot.empty) {
      if (seletor) seletor.innerHTML = '<option value="">Nenhuma peça no acervo</option>';
      if (infoContainer) {
        infoContainer.innerHTML = `
          <div class="p-6 text-center text-zinc-400 bg-zinc-100/70 rounded-xl border border-zinc-200">
            <h4 class="font-semibold text-zinc-700">Acervo Vazio</h4>
            <p class="text-xs mt-1">Acesse o Painel do Desenvolvedor para cadastrar imagens em /assets/anatomia/.</p>
          </div>
        `;
      }
      return;
    }

    let optionsHtml = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === "inativa") return; // Lâminas com status inativa ficam restritas ao Painel Dev
      anatomyState.pecasList.push({ id: doc.id, ...data });
      optionsHtml += `<option value="${doc.id}">${data.nome || "Peça sem identificação"}</option>`;
    });

    if (seletor) {
      seletor.innerHTML = optionsHtml;
      // Carrega e processa a primeira peça da lista de forma automática
      if (anatomyState.pecasList.length > 0) {
        seletor.value = anatomyState.pecasList[0].id;
        carregarPecaAnatomica(anatomyState.pecasList[0].id);
      }
    }
  } catch (error) {
    console.error("Erro no processamento das peças anatômicas no Firestore:", error);
    if (infoContainer) {
      infoContainer.innerHTML = `<div class="p-4 text-xs text-red-600 font-medium">Falha na comunicação com o banco de dados Firestore. Consulte os logs no console.</div>`;
    }
  }
}

/**
 * Ativa a peça anatômica selecionada e renderiza seus marcadores.
 * @param {string} pecaId - ID do documento no Firestore.
 */
function carregarPecaAnatomica(pecaId) {
  const peca = anatomyState.pecasList.find((item) => item.id === pecaId);
  if (!peca) return;

  anatomyState.currentPeca = peca;
  anatomyState.activePinIndex = null;

  // Resetar parâmetros de Zoom e Pan para o estado inicial
  anatomyState.scale = 1;
  anatomyState.panX = 0;
  anatomyState.panY = 0;

  // Atualiza as legendas textuais no painel direito (Prancheta de Estudo)
  const tituloElem = document.getElementById("pecaAnatoTitulo");
  const infoContainer = document.getElementById("infoPainelAnatomia");

  if (tituloElem) tituloElem.textContent = peca.nome || "Peça Anatômica";

  if (infoContainer) {
    const totalPinos = Array.isArray(peca.questoes) ? peca.questoes.length : 0;
    infoContainer.innerHTML = `
      <div class="p-6 bg-white rounded-xl border border-zinc-200 shadow-sm text-center">
        <span class="text-[11px] uppercase font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-full">Bancada de Estudo Ativa</span>
        <h4 class="text-base font-bold text-zinc-900 mt-3">Peça Demarcada com ${totalPinos} ${totalPinos === 1 ? 'Pino Anatômico' : 'Pinos Anatômicos'}</h4>
        <p class="text-xs text-zinc-600 mt-1">Utilize o scroll do mouse ou trackpad para aproximar detalhes estruturais (Zoom 1x-3x) e arraste a imagem livremente. Clique sobre um pino na peça para abrir a questão aplicada.</p>
      </div>
    `;
  }

  // Carrega o arquivo de imagem bruto referenciado na pasta /assets/anatomia/ (sem Base64)
  const imgElem = document.getElementById("anatomyImageMatrix");
  if (imgElem) {
    imgElem.src = peca.arquivo || "";
  }

  renderizarPinosAnato();
  atualizarBancadaVisual(true);
}

/**
 * Plota os pontos (Pinos) sobre a superfície interativa anatômica através das coordenadas percentuais.
 */
function renderizarPinosAnato() {
  const containerPinos = document.getElementById("anatomyPinsOverlay");
  if (!containerPinos) return;

  containerPinos.innerHTML = "";
  if (!anatomyState.currentPeca || !Array.isArray(anatomyState.currentPeca.questoes)) return;

  anatomyState.currentPeca.questoes.forEach((pin, index) => {
    const div = document.createElement("div");
    div.className = "anatomy-pin-marker pin-marker absolute w-5 h-5 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] cursor-pointer z-20 group flex items-center justify-center select-none";
    div.style.left = `${pin.x}%`;
    div.style.top = `${pin.y}%`;
    div.innerHTML = `<div class="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div><span class="relative z-10 text-[10px] font-extrabold text-neutral-950 font-mono">${index + 1}</span>`;
    div.title = `Pino Anatômico #${index + 1}: Clique para investigar`;

    // Aplicação da escala inversa inicial
    div.style.transform = `translate(-50%, -50%) scale(${1 / anatomyState.scale})`;

    div.addEventListener("click", (e) => {
      e.stopPropagation();
      selecionarPinoAnatomico(index, div);
    });

    containerPinos.appendChild(div);
  });
}

/**
 * Seleciona o pino na bancada de dissecação, aplica o destaque visual de cor e projeta a Pergunta e Gabarito na Prancheta.
 * @param {number} index - Índice do pino no array de questões.
 * @param {HTMLElement} pinElement - Nó DOM da marcação acionada.
 */
function selecionarPinoAnatomico(index, pinElement) {
  anatomyState.activePinIndex = index;
  const pinData = anatomyState.currentPeca.questoes[index];

  // Restaura estilo dos pinos não selecionados
  const allPins = document.querySelectorAll("#anatomyPinsOverlay .anatomy-pin-marker");
  allPins.forEach((el) => {
    el.classList.remove("bg-red-500", "ring-4", "ring-white", "active");
    el.classList.add("bg-cyan-400");
  });

  // Destaque enérgico em vermelho (active) para a estrutura em inspeção
  if (pinElement) {
    pinElement.classList.remove("bg-cyan-400");
    pinElement.classList.add("bg-red-500", "ring-4", "ring-white", "active");
  }

  // Injeção limpa de Pergunta e Gabarito em #infoPainelAnatomia no modo Dark Studio
  const infoPainel = document.getElementById("infoPainelAnatomia");
  if (infoPainel && pinData) {
    infoPainel.innerHTML = `
      <div class="bg-neutral-950 rounded-2xl border border-neutral-800 p-6 shadow-xl space-y-6 text-neutral-100 animate-fadeIn">
        <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50 uppercase tracking-wider font-mono">Pino Anatômico Q${index + 1}</span>
          <span class="text-xs text-neutral-400 font-mono">X: ${pinData.x}% | Y: ${pinData.y}%</span>
        </div>

        <div>
          <h5 class="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 font-mono">Pergunta de Identificação</h5>
          <p class="text-sm font-normal text-white leading-relaxed bg-neutral-900/80 p-4 rounded-xl border border-neutral-800">${pinData.pergunta || "Questão não especificada."}</p>
        </div>

        <div>
          <h5 class="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">Gabarito Macroscópico</h5>
          <div class="text-sm text-neutral-300 leading-relaxed bg-neutral-900/50 p-4 rounded-xl border border-cyan-900/50 font-normal">
            ${pinData.gabarito || "Gabarito não fornecido."}
          </div>
        </div>

        <div class="pt-4 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span>Arquivo do Acervo Local</span>
          <button onclick="window.App.limparSelecaoPinoAnatomico()" class="text-cyan-400 hover:text-cyan-300 font-medium tracking-wide">Voltar para visão geral</button>
        </div>
      </div>
    `;
  }
}

/**
 * Reseta o estado do painel lateral para a descrição geral da peça.
 */
function limparSelecaoPinoAnatomico() {
  anatomyState.activePinIndex = null;
  const allPins = document.querySelectorAll("#anatomyPinsOverlay .anatomy-pin-marker");
  allPins.forEach((el) => {
    el.classList.remove("bg-red-500", "ring-4", "ring-white", "active");
    el.classList.add("bg-cyan-400");
  });

  if (anatomyState.currentPeca) {
    carregarPecaAnatomica(anatomyState.currentPeca.id);
  }
}

/**
 * Restaura o Zoom para 1x e recentra a peça no meio da tela na Bancada Macroscópica.
 */
function resetAnatomyZoom() {
  anatomyState.scale = 1;
  anatomyState.panX = 0;
  anatomyState.panY = 0;
  atualizarBancadaVisual(true);
}

/**
 * Atualiza o DOM com os vetores de transform (scale/pan) e compensa o tamanho das marcações.
 * @param {boolean} withTransition - Define transição CSS suave ou instantânea (para arrastos).
 */
function atualizarBancadaVisual(withTransition = false) {
  const layer = document.getElementById("anatomyTransformLayer");
  if (!layer) return;

  if (withTransition) {
    layer.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
  } else {
    layer.style.transition = "none";
  }

  layer.style.transform = `translate(${anatomyState.panX}px, ${anatomyState.panY}px) scale(${anatomyState.scale})`;

  // Compensação visual inversa para os pinos
  const pins = document.querySelectorAll("#anatomyPinsOverlay .anatomy-pin-marker");
  const inversoScale = 1 / anatomyState.scale;
  pins.forEach((pin) => {
    pin.style.transform = `translate(-50%, -50%) scale(${inversoScale})`;
  });

  // Atualização do medidor de zoom visual na barra superior do container
  const displayZoom = document.getElementById("displayAnatoZoom");
  if (displayZoom) {
    displayZoom.textContent = `Zoom: ${Math.round(anatomyState.scale * 100)}%`;
  }
}

// ==============================================
// CONTROLADORES DE EVENTOS DO MOUSE (PAN LIVRE)
// ==============================================

function handleMouseDown(e) {
  if (e.button !== 0) return;

  anatomyState.isDragging = true;
  anatomyState.startX = e.clientX - anatomyState.panX;
  anatomyState.startY = e.clientY - anatomyState.panY;

  const container = document.getElementById("bancadaDissecacaoContainer");
  if (container) {
    container.classList.add("cursor-grabbing");
  }
}

function handleMouseMove(e) {
  if (!anatomyState.isDragging) return;

  e.preventDefault();
  anatomyState.panX = e.clientX - anatomyState.startX;
  anatomyState.panY = e.clientY - anatomyState.startY;

  atualizarBancadaVisual(false);
}

function handleMouseUp() {
  if (!anatomyState.isDragging) return;
  anatomyState.isDragging = false;

  const container = document.getElementById("bancadaDissecacaoContainer");
  if (container) {
    container.classList.remove("cursor-grabbing");
  }
}

function handleMouseLeave() {
  if (anatomyState.isDragging) {
    anatomyState.isDragging = false;
    const container = document.getElementById("bancadaDissecacaoContainer");
    if (container) {
      container.classList.remove("cursor-grabbing");
    }
  }
}

// ==============================================
// CONTROLADOR DE ZOOM SIMPLES (1X ATÉ 3X - WHEEL)
// ==============================================

function handleWheel(e) {
  e.preventDefault();

  const viewport = document.getElementById("bancadaDissecacaoContainer");
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const deltaMouseX = e.clientX - centerX;
  const deltaMouseY = e.clientY - centerY;

  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  const oldScale = anatomyState.scale;

  // Limita o zoom macroscópico de 1x ao máximo de 3x conforme especificação técnica
  const newScale = Math.min(Math.max(oldScale * zoomFactor, 1), 3);

  if (oldScale === newScale) return;

  const scaleRatio = newScale / oldScale;
  anatomyState.panX = deltaMouseX - (deltaMouseX - anatomyState.panX) * scaleRatio;
  anatomyState.panY = deltaMouseY - (deltaMouseY - anatomyState.panY) * scaleRatio;
  anatomyState.scale = newScale;

  // Ao retornar para o nível base 1x, alinha a peça no centro da tela
  if (anatomyState.scale === 1) {
    anatomyState.panX = 0;
    anatomyState.panY = 0;
  }

  atualizarBancadaVisual(false);
}

// Expõe métodos essenciais à janela da aplicação
window.App = {
  ...window.App,
  carregarAcervoAnatomia,
  carregarPecaAnatomica,
  selecionarPinoAnatomico,
  limparSelecaoPinoAnatomico,
  resetAnatomyZoom
};

document.addEventListener("DOMContentLoaded", initAnatomyStudio);
