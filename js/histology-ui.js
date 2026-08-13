/**
 * Motor de Visualização Óptico e Deep Zoom para Histologia Microscópica
 * Controla navegação espacial (Pan), zoom em tempo real com preservação de foco no cursor,
 * revólver digital de lentes (4x, 10x, 40x) e renderização unificada de pinos com escala inversa.
 */

import { db } from "./firebase-config.js";
import { subscribe } from "./state.js";
import { catalogData } from "./catalog-data.js?v=2026.0809";

// Estado Óptico Interno do Microscópio Virtual
const opticalState = {
  scale: 1,       // 1 = 4x (Visão Geral), 2.5 = 10x, 10 = 40x (Resolução Nativa)
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentLamina: null,
  activePinIndex: null,
  slidesList: []
};

/**
 * Inicializa os ouvintes de eventos e a integração com o roteador.
 */
function initOptics() {
  const container = document.getElementById("estudioOpticoContainer");
  
  if (container) {
    // Eventos de Pan (Arrastar com Mouse)
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Evento de Deep Zoom via Trackpad/Scroll (com e sem Ctrl conforme padrão moderno)
    container.addEventListener("wheel", handleWheel, { passive: false });
  }

  // Inscreve nas mudanças do estado da aplicação para carregar lâminas ao entrar no módulo de microscopia
  subscribe((state) => {
    if (["histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
      carregarLaminasHistologia(state.frenteAtiva);
    }
  });

  // Listener para troca de lâmina no seletor do painel lateral
  const seletor = document.getElementById("seletorLaminas");
  if (seletor) {
    seletor.addEventListener("change", (e) => selecionarLaminaPorId(e.target.value));
  }
}

/**
 * Carrega a lista de lâminas da disciplina de microscopia do Firestore via caminhos locais (sem Base64).
 * @param {string} disciplina - Disciplina ativa (histologia, patologia, parasitologia ou microbiologia).
 */
async function carregarLaminasHistologia(disciplina = "histologia") {
  const seletor = document.getElementById("seletorLaminas");
  const infoContainer = document.getElementById("infoPainelLateral");

  opticalState.slidesList = [];

  try {
    if (typeof db !== "undefined" && typeof db.collection === "function") {
      const snapshot = await db.collection("pecas")
        .where("disciplina", "==", disciplina)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "inativa") return; // Lâminas com status inativa ficam restritas ao Painel Dev
        opticalState.slidesList.push({ id: doc.id, ...data });
      });
    }
  } catch (error) {
    console.error("Erro na leitura das lâminas histológicas no Firestore:", error);
  }

  // Re-sincroniza o acervo local customizado via CMS e injeta em memória
  if (window.App && typeof window.App.sincronizarAcervoPersonalizado === "function") {
    window.App.sincronizarAcervoPersonalizado();
  }
  try {
    const rawCustom = localStorage.getItem("palas_atlas_custom_slides");
    if (rawCustom) {
      const salvas = JSON.parse(rawCustom);
      salvas.forEach((lamSalva) => {
        if ((lamSalva.disciplina || "").toLowerCase().trim() === disciplina.toLowerCase().trim()) {
          const idx = opticalState.slidesList.findIndex((existing) => existing.id === lamSalva.id || (existing.nome && lamSalva.nome && existing.nome.toLowerCase().trim() === lamSalva.nome.toLowerCase().trim()));
          if (idx !== -1) {
            opticalState.slidesList[idx] = lamSalva;
          } else {
            opticalState.slidesList.push(lamSalva);
          }
        }
      });
    }
  } catch (e) {
    console.warn("Erro ao ler palas_atlas_custom_slides no localStorage:", e);
  }

  // Incorporação das lâminas estáticas locais definidas diretamente na bibliografia de catalogData
  const moduloData = catalogData[disciplina];
  if (moduloData && Array.isArray(moduloData.topicos)) {
    moduloData.topicos.forEach((t) => {
      if (Array.isArray(t.laminasEstaticas)) {
        t.laminasEstaticas.forEach((lamEstatica) => {
          const idxC = opticalState.slidesList.findIndex((existing) => existing.id === lamEstatica.id || (existing.nome && lamEstatica.nome && existing.nome.toLowerCase().trim() === lamEstatica.nome.toLowerCase().trim()));
          if (idxC === -1) {
            opticalState.slidesList.push(lamEstatica);
          } else if (!opticalState.slidesList[idxC].customCms) {
            opticalState.slidesList[idxC] = lamEstatica;
          }
        });
      }
    });
  }

  if (opticalState.slidesList.length === 0) {
    if (seletor) seletor.innerHTML = '<option value="">Nenhuma lâmina no banco</option>';
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div class="p-6 text-center text-slate-400 bg-slate-100/70 rounded-xl border border-slate-200">
          <h4 class="font-semibold text-slate-700">Acervo Vazio para ${disciplina.toUpperCase()}</h4>
          <p class="text-xs mt-1">Acesse o Painel do Desenvolvedor para cadastrar sua primeira imagem matriz em /assets/${disciplina}/.</p>
        </div>
      `;
    }
    return;
  }

  let optionsHtml = "";
  opticalState.slidesList.forEach((lam) => {
    optionsHtml += `<option value="${lam.id}">${lam.nome || "Lâmina sem nome"}</option>`;
  });

  if (seletor) {
    seletor.innerHTML = optionsHtml;
    if (opticalState.slidesList.length > 0 && !opticalState.currentLamina) {
      seletor.value = opticalState.slidesList[0].id;
      selecionarLaminaPorId(opticalState.slidesList[0].id);
    }
  }
}

/**
 * Ativa e renderiza a imagem matriz da lâmina selecionada.
 * @param {string} laminaId - Identificador único no Firestore.
 */
function selecionarLaminaPorId(laminaId) {
  let lamina = opticalState.slidesList.find((item) => item.id === laminaId);
  if (!lamina && window.App && Array.isArray(window.App._slidesListOverride)) {
    lamina = window.App._slidesListOverride.find((item) => item.id === laminaId);
    if (lamina && !opticalState.slidesList.some((item) => item.id === lamina.id)) {
      opticalState.slidesList.push(lamina);
    }
  }
  if (!lamina) {
    try {
      const rawCustom = localStorage.getItem("palas_atlas_custom_slides");
      if (rawCustom) {
        const salvas = JSON.parse(rawCustom);
        lamina = salvas.find((item) => item.id === laminaId);
        if (lamina && !opticalState.slidesList.some((item) => item.id === lamina.id)) {
          opticalState.slidesList.push(lamina);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar no localStorage em selecionarLaminaPorId:", err);
    }
  }
  if (!lamina && catalogData) {
    Object.keys(catalogData).forEach((discKey) => {
      const discObj = catalogData[discKey];
      if (discObj && Array.isArray(discObj.topicos)) {
        discObj.topicos.forEach((top) => {
          if (Array.isArray(top.laminasEstaticas)) {
            const achada = top.laminasEstaticas.find((l) => l.id === laminaId);
            if (achada) {
              lamina = achada;
              if (!opticalState.slidesList.some((item) => item.id === achada.id)) {
                opticalState.slidesList.push(achada);
              }
            }
          }
        });
      }
    });
  }
  if (!lamina) {
    console.warn(`[Palas Atlas] Lâmina com ID "${laminaId}" não foi localizada em cache ou no catálogo.`);
    return;
  }

  opticalState.currentLamina = lamina;
  opticalState.activePinIndex = null;
  
  // Reseta estado de zoom e pan
  opticalState.scale = 1;
  opticalState.panX = 0;
  opticalState.panY = 0;

  // Atualização dos metadados no painel lateral
  const tituloElem = document.getElementById("laminaTitulo");
  const coloracaoElem = document.getElementById("laminaColoracao");
  const infoPainel = document.getElementById("infoPainelLateral");

  if (tituloElem) tituloElem.textContent = lamina.nome || "Lâmina Histológica";
  if (coloracaoElem) coloracaoElem.textContent = `Coloração: ${lamina.coloracao || "Não especificada"}`;
  
  if (infoPainel) {
    infoPainel.innerHTML = "";
  }

  // Inicialização do Motor Óptico de Microscopia Virtual (OpenSeadragon / DZI ou Fallback Estático)
  if (window.App && typeof window.App.carregarLaminaNoMicroscopio === "function") {
    window.App.carregarLaminaNoMicroscopio(lamina);
  } else if (window.App && typeof window.App.inicializarMicroscopio === "function") {
    window.App.inicializarMicroscopio(lamina);
  } else if (typeof window.carregarLaminaNoMicroscopio === "function") {
    window.carregarLaminaNoMicroscopio(lamina);
  } else if (typeof window.inicializarMicroscopio === "function") {
    window.inicializarMicroscopio(lamina);
  } else {
    // Fallback de segurança para elemento img legada caso o motor piramidal não esteja disponível
    const imgElem = document.getElementById("slideImageMatrix");
    if (imgElem) {
      const caminho = lamina.imageUrl || lamina.caminhoImagemBase || lamina.arquivos?.lente40x || lamina.arquivos?.lente4x || "";
      imgElem.src = caminho;
    }
    renderizarPinosNaLamina();
    atualizarEstudioOptico(true);
  }

  atualizarIndicadorBotoesLente(1);
}

/**
 * Renderiza os marcadores espaciais com base em porcentagens (left/top) sobre a camada da imagem matriz.
 */
function renderizarPinosNaLamina() {
  const containerPinos = document.getElementById("slidePinsOverlay");
  if (!containerPinos) return;

  containerPinos.innerHTML = "";
  if (!opticalState.currentLamina || !Array.isArray(opticalState.currentLamina.questoes)) return;

  opticalState.currentLamina.questoes.forEach((pin, index) => {
    const div = document.createElement("div");
    div.className = "pin-marker absolute w-6 h-6 bg-neutral-800 rounded-full cursor-pointer z-20 group flex items-center justify-center select-none border border-neutral-600 shadow-sm transition-all hover:scale-110";
    div.style.left = `${pin.x}%`;
    div.style.top = `${pin.y}%`;
    div.innerHTML = `<span class="relative z-10 text-[11px] font-bold text-neutral-200 font-mono">${index + 1}</span>`;
    div.title = `Pino Q${index + 1}: Clique para examinar`;

    // Aplica o fator inverso de escala imediatamente para estabilizar dimensões
    div.style.transform = `translate(-50%, -50%) scale(${1 / opticalState.scale})`;

    div.addEventListener("click", (e) => {
      e.stopPropagation();
      selecionarPinoEExibirAnálise(index, div);
    });

    containerPinos.appendChild(div);
  });
}

/**
 * Processa a seleção do pino na lâmina e injeta os dados da questão no painel lateral.
 * @param {number} index - Índice da questão na array.
 * @param {HTMLElement} pinElement - Nó DOM do pino acionado.
 */
function selecionarPinoEExibirAnálise(index, pinElement) {
  opticalState.activePinIndex = index;
  const pinData = opticalState.currentLamina.questoes[index];

  // Destaque visual no pino ativo
  const allPins = document.querySelectorAll("#slidePinsOverlay .pin-marker");
  allPins.forEach((el) => {
    el.classList.remove("bg-blue-600", "ring-2", "ring-blue-400", "active");
    el.classList.add("bg-neutral-800");
  });

  if (pinElement) {
    pinElement.classList.remove("bg-neutral-800");
    pinElement.classList.add("bg-blue-600", "ring-2", "ring-blue-400", "active");
  }

  // Injeção de Pergunta e Gabarito no Painel de Análise
  const infoPainel = document.getElementById("infoPainelLateral");
  if (infoPainel && pinData) {
    infoPainel.innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-md space-y-6 text-slate-800">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 uppercase tracking-wider font-mono">Pino Q${index + 1} Ativo</span>
          <span class="text-xs text-slate-500 font-mono">X: ${Math.round(pinData.x)} | Y: ${Math.round(pinData.y)}</span>
        </div>

        <div>
          <h5 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">Pergunta de Avaliação</h5>
          <p class="text-sm font-semibold text-slate-900 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">${pinData.pergunta || "Sem pergunta definida."}</p>
        </div>

        <div>
          <h5 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">Gabarito Histológico Esperado</h5>
          <div class="text-sm text-slate-700 leading-relaxed bg-blue-50/50 p-4 rounded-lg border border-blue-200/60 font-normal">
            ${pinData.gabarito || "Sem gabarito registrado."}
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Resolução Nativa Matriz</span>
          <button type="button" onclick="window.App.limparSelecaoPino()" class="text-blue-600 hover:text-blue-500 font-medium underline">Voltar para visão geral</button>
        </div>
      </div>
    `;
  }
}

/**
 * Limpa a seleção ativa de pino no painel e retorna à descrição geral.
 */
function limparSelecaoPino() {
  opticalState.activePinIndex = null;
  const allPins = document.querySelectorAll("#slidePinsOverlay .pin-marker");
  allPins.forEach((el) => {
    el.classList.remove("bg-blue-600", "ring-2", "ring-blue-400", "active");
    el.classList.add("bg-neutral-800");
  });

  if (opticalState.currentLamina) {
    selecionarLaminaPorId(opticalState.currentLamina.id);
  }
}

/**
 * Atualiza as transformações CSS de escala e translação no estúdio óptico e preserva escala visual dos pinos.
 * @param {boolean} smoothTransition - Define se haverá animação suave CSS de transição de lentes.
 */
function atualizarEstudioOptico(smoothTransition = false) {
  const layer = document.getElementById("opticalTransformLayer");
  if (!layer) return;

  if (smoothTransition) {
    layer.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
  } else {
    layer.style.transition = "none";
  }

  layer.style.transform = `translate(${opticalState.panX}px, ${opticalState.panY}px) scale(${opticalState.scale})`;

  // Ajuste inverso de escala para preservar o diâmetro visual dos pinos independentemente de zoom
  const pins = document.querySelectorAll("#slidePinsOverlay .pin-marker");
  const inversoScale = 1 / opticalState.scale;
  pins.forEach((pin) => {
    pin.style.transform = `translate(-50%, -50%) scale(${inversoScale})`;
  });

  // Atualização do indicador digital de ampliação no estúdio
  const zoomIndicator = document.getElementById("displayZoomPercentage");
  if (zoomIndicator) {
    const amplificacao = Math.round(opticalState.scale * 4);
    zoomIndicator.textContent = `${amplificacao}x (${Math.round(opticalState.scale * 100)}%)`;
  }
}

/**
 * Altera a ampliação por meio das lentes rápidas (Presets da UI).
 * @param {number} targetScale - Presets: 1 (4x), 2.5 (10x), 10 (40x).
 */
function aplicarPresetLente(targetScale) {
  if (window.osdViewer && window.osdViewer.viewport) {
    const homeZoom = window.osdViewer.viewport.getHomeZoom() || 1;
    if (targetScale === 1) {
      window.osdViewer.viewport.goHome();
    } else {
      window.osdViewer.viewport.zoomTo(homeZoom * targetScale);
    }
    atualizarIndicadorBotoesLente(targetScale);
    return;
  }

  const oldScale = opticalState.scale;
  opticalState.scale = Math.min(Math.max(targetScale, 1), 10);

  if (opticalState.scale === 1) {
    // Ao redefinir para a visão geral 4x, recentra a lâmina no eixo 0,0
    opticalState.panX = 0;
    opticalState.panY = 0;
  } else if (oldScale !== opticalState.scale) {
    // Mantém proporcionalidade da área observada durante transição rápida de lente
    const proporcao = opticalState.scale / oldScale;
    opticalState.panX *= proporcao;
    opticalState.panY *= proporcao;
  }

  atualizarEstudioOptico(true);
  atualizarIndicadorBotoesLente(targetScale);
}

/**
 * Reflete visualmente qual botão do revólver digital corresponde ao zoom de exibição.
 * @param {number} scaleAtual 
 */
function atualizarIndicadorBotoesLente(scaleAtual) {
  const btn4x = document.getElementById("btnLens4x");
  const btn10x = document.getElementById("btnLens10x");
  const btn40x = document.getElementById("btnLens40x");

  const resetBtn = (btn) => {
    if (!btn) return;
    btn.className = "px-5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 text-slate-300 bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700 hover:border-slate-600 shadow-sm";
  };
  resetBtn(btn4x);
  resetBtn(btn10x);
  resetBtn(btn40x);

  const activeClass = "px-5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 shadow-md shadow-blue-600/30";

  if (scaleAtual === 1 && btn4x) {
    btn4x.className = activeClass;
  } else if (scaleAtual === 2.5 && btn10x) {
    btn10x.className = activeClass;
  } else if (scaleAtual === 10 && btn40x) {
    btn40x.className = activeClass;
  }
}

// ==========================================
// CONTROLADORES DE EVENTOS DO MOUSE (PAN)
// ==========================================

function handleMouseDown(e) {
  if (window.osdViewer) return; // Permite controle nativo total do OpenSeadragon no Nível 3
  // Impede arrasto com botão direito do mouse
  if (e.button !== 0) return;

  opticalState.isDragging = true;
  opticalState.startX = e.clientX - opticalState.panX;
  opticalState.startY = e.clientY - opticalState.panY;

  const container = document.getElementById("estudioOpticoContainer");
  if (container) {
    container.classList.add("cursor-grabbing");
  }
}

function handleMouseMove(e) {
  if (!opticalState.isDragging || window.osdViewer) return;

  e.preventDefault();
  opticalState.panX = e.clientX - opticalState.startX;
  opticalState.panY = e.clientY - opticalState.startY;

  atualizarEstudioOptico(false);
}

function handleMouseUp() {
  if (!opticalState.isDragging || window.osdViewer) return;
  opticalState.isDragging = false;

  const container = document.getElementById("estudioOpticoContainer");
  if (container) {
    container.classList.remove("cursor-grabbing");
  }
}

function handleMouseLeave() {
  if (opticalState.isDragging) {
    opticalState.isDragging = false;
    const container = document.getElementById("estudioOpticoContainer");
    if (container && !window.osdViewer) {
      container.classList.remove("cursor-grabbing");
    }
  }
}

// ========================================================
// CONTROLADOR DE DEEP ZOOM VIA TRACKPAD / SCROLL (WHEEL)
// ========================================================

function handleWheel(e) {
  if (window.osdViewer) return; // O OpenSeadragon trata nativamente o zoom via trackpad/scroll no Nível 3
  // Prevenir comportamento padrão de rolagem da página
  e.preventDefault();

  // Verificação de segurança: no padrão de Trackpads e "Ctrl + Scroll", e.ctrlKey é acionado automaticamente em pinças
  // Permitimos o zoom também em rolagem vertical direta dentro do estúdio para máxima agilidade
  const viewport = document.getElementById("estudioOpticoContainer");
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();

  // Coordenadas do centro exato da viewport óptica
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Deslocamento do ponteiro do mouse em relação ao centro do contêiner
  const deltaMouseX = e.clientX - centerX;
  const deltaMouseY = e.clientY - centerY;

  // Fator exponencial de zoom
  const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
  const oldScale = opticalState.scale;
  const newScale = Math.min(Math.max(oldScale * zoomFactor, 1), 10);

  if (oldScale === newScale) return;

  // Cálculo matemático para direcionar o ponto central do zoom de forma milimétrica para o ponteiro do cursor
  const scaleRatio = newScale / oldScale;
  opticalState.panX = deltaMouseX - (deltaMouseX - opticalState.panX) * scaleRatio;
  opticalState.panY = deltaMouseY - (deltaMouseY - opticalState.panY) * scaleRatio;
  opticalState.scale = newScale;

  // Se retornou ao zoom mínimo (4x), recentra harmonicamente
  if (opticalState.scale === 1) {
    opticalState.panX = 0;
    opticalState.panY = 0;
  }

  atualizarEstudioOptico(false);
  
  // Atualiza estado dos botões de lente de acordo com o nível aproximado de zoom
  if (opticalState.scale < 1.6) {
    atualizarIndicadorBotoesLente(1);
  } else if (opticalState.scale >= 1.6 && opticalState.scale < 6) {
    atualizarIndicadorBotoesLente(2.5);
  } else if (opticalState.scale >= 6) {
    atualizarIndicadorBotoesLente(10);
  }
}

// Expõe métodos essenciais ao namespace window.App
window.App = {
  ...window.App,
  aplicarPresetLente,
  selecionarPinoEExibirAnálise,
  limparSelecaoPino,
  carregarLaminasHistologia,
  selecionarLaminaPorId,
  getSlidesCache: () => opticalState.slidesList
};

document.addEventListener("DOMContentLoaded", initOptics);
