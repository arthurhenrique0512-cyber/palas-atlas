/**
 * Motor do Simulado Prático (Avaliação Global Unificada)
 * Gerencia montagem dinâmica do pool de questões de Anatomia e Histologia,
 * embaralhamento algorítmico, renderização seletiva de pino único e score computado.
 */

import { db } from "./firebase-config.js";
import { subscribe } from "./state.js";

// Estado Interno do Motor do Simulado
const simulatorState = {
  poolQuestoes: [],
  indiceAtual: 0,
  questoesCorretas: 0,
  pecasCache: [],
  laminasCache: [],
  todasQuestoes: [],
  scale: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0
};

/**
 * Inicializa os ouvintes do motor e subscreve à navegação do roteador.
 */
function initSimulator() {
  const palco = document.getElementById("simuladoPalcoContainer");
  if (palco) {
    palco.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    palco.addEventListener("mouseleave", handleMouseLeave);
    palco.addEventListener("wheel", handleWheel, { passive: false });
  }

  // Ao ingressar na frente do Simulado, carregar os tópicos das peças disponíveis no banco de dados
  subscribe((state) => {
    if (state.frenteAtiva === "simulado") {
      carregarSetupSimulado();
    }
  });
}

/**
 * Carrega e apresenta os tópicos disponíveis no Firestore, segregando Anatomia e Histologia.
 */
async function carregarSetupSimulado() {
  const setupContainer = document.getElementById("simuladoSetup");
  const execContainer = document.getElementById("simuladoExecution");
  const resultContainer = document.getElementById("simuladoResults");

  if (setupContainer) setupContainer.classList.remove("hidden");
  if (execContainer) execContainer.classList.add("hidden");
  if (resultContainer) resultContainer.classList.add("hidden");

  const disciplinas = ["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"];
  const listas = {};
  
  disciplinas.forEach(disc => {
    const id = `listaTopicos${disc.charAt(0).toUpperCase() + disc.slice(1)}`;
    listas[disc] = document.getElementById(id);
    if (listas[disc]) {
      listas[disc].innerHTML = `<p class="text-xs text-neutral-500 font-mono p-2">Consultando acervo de ${disc}...</p>`;
    }
  });

  try {
    // 1. Carrega caches de apoio para resolução de imagens e coordenadas
    const pecasSnap = await db.collection("pecas").get();
    simulatorState.pecasCache = pecasSnap.docs.map(d => ({id: d.id, ...d.data()}));
    
    const laminasSnap = await db.collection("laminas").get();
    simulatorState.laminasCache = laminasSnap.docs.map(d => ({id: d.id, ...d.data()}));

    // 2. Busca Questoes e agrupa
    const questoesSnap = await db.collection("questoes").where("ativo", "==", true).get();
    
    if (questoesSnap.empty) {
      disciplinas.forEach(disc => {
        if (listas[disc]) listas[disc].innerHTML = '<p class="text-xs text-neutral-500 italic p-2">Nenhum tópico cadastrado neste módulo.</p>';
      });
      return;
    }

    const mapa = {};
    simulatorState.todasQuestoes = [];

    questoesSnap.forEach(doc => {
      const data = doc.data();
      if (!data.disciplina || !data.topico) return;
      
      const disc = data.disciplina.toLowerCase().trim();
      const topico = data.topico.trim();
      
      if (!mapa[disc]) mapa[disc] = {};
      mapa[disc][topico] = (mapa[disc][topico] || 0) + 1;
      
      simulatorState.todasQuestoes.push({ id: doc.id, ...data });
    });

    disciplinas.forEach(disc => {
      const container = listas[disc];
      if (!container) return;
      
      const topicosObj = mapa[disc];
      if (!topicosObj || Object.keys(topicosObj).length === 0) {
        container.innerHTML = '<p class="text-xs text-neutral-500 italic py-4">Nenhum tópico cadastrado neste módulo.</p>';
        return;
      }
      
      let html = "";
      Object.entries(topicosObj).forEach(([nomeTopico, total]) => {
        html += `
          <label class="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800/80 transition duration-150 text-xs text-neutral-200 select-none cursor-pointer mb-2">
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                name="topicos_simulado" 
                value="${nomeTopico}" 
                data-disciplina="${disc}"
                checked
                class="w-4 h-4 text-cyan-500 bg-neutral-950 border-neutral-700 rounded focus:ring-cyan-500">
              <span class="font-semibold text-white tracking-wide">${nomeTopico}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60">${total} q</span>
          </label>
        `;
      });
      container.innerHTML = html;
    });

  } catch (error) {
    console.error("Erro na busca de tópicos para o simulado no Firestore:", error);
    disciplinas.forEach(disc => {
      if (listas[disc]) listas[disc].innerHTML = '<p class="text-xs text-neutral-500 italic p-2">Nenhum tópico cadastrado neste módulo.</p>';
    });
  }
}

/**
 * Alterna a seleção de todos os checkboxes habilitados de um grupo de disciplina.
 * @param {string} disciplina 
 * @param {boolean} selecionar 
 */
function alternarGrupoTopicos(disciplina, selecionar) {
  const containerId = `listaTopicos${disciplina.charAt(0).toUpperCase() + disciplina.slice(1)}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  const inputs = container.querySelectorAll("input[type='checkbox']:not([disabled])");
  inputs.forEach((input) => {
    input.checked = selecionar;
  });
}

/**
 * CONSTRUÇÃO DO POOL DE QUESTÕES (Achatamento e Embaralhamento)
 * Converte pinos isolados de peças aprovadas no filtro em uma lista plana aleatória.
 */
function prepararSimulado() {
  const selecionados = Array.from(document.querySelectorAll("input[name='topicos_simulado']:checked")).map((el) => el.value);

  if (selecionados.length === 0) {
    alert("Selecione ao menos um tópico com questões ativas para iniciar a avaliação.");
    return;
  }

  // Filtra as questoes que pertencem aos topicos selecionados
  const questoesFiltradas = simulatorState.todasQuestoes.filter((q) => {
    return selecionados.includes(q.topico);
  });

  if (questoesFiltradas.length === 0) {
    alert("Os tópicos selecionados não possuem questões cadastradas.");
    return;
  }

  // Resolver referências cruzadas de Imagem e Pino via Caches
  const pool = [];
  questoesFiltradas.forEach((q) => {
    const acervoPeca = simulatorState.pecasCache.find(p => p.id === q.laminaId);
    const acervoLamina = simulatorState.laminasCache.find(l => l.id === q.laminaId);
    const acervo = acervoPeca || acervoLamina;
    
    let imagemRef = "";
    let nomeAcervo = "Acervo Não Identificado";
    let px = 50, py = 50; // default pin center se não houver pinoId
    
    if (acervo) {
      imagemRef = acervo.caminhoImagemBase || acervo.arquivo || (acervo.arquivos && (acervo.arquivos.lente40x || acervo.arquivos.lente4x)) || "";
      nomeAcervo = acervo.nome || q.topico;
      
      // Se houver um pinoId vinculado, tenta pegar as coordenadas da peca (Anatomia) ou lamina (DZI/OSD - se existir)
      if (q.pinoId && acervo.questoes && Array.isArray(acervo.questoes)) {
        const pinoDoc = acervo.questoes.find(pin => pin.idPin === q.pinoId || pin.id === q.pinoId);
        if (pinoDoc) {
          px = pinoDoc.x !== undefined ? pinoDoc.x : 50;
          py = pinoDoc.y !== undefined ? pinoDoc.y : 50;
        }
      }
    }
    
    pool.push({
      idQuestao: q.id,
      idPeca: q.laminaId,
      nomePeca: nomeAcervo,
      disciplina: q.disciplina || "anatomia",
      imagemBase: imagemRef,
      pergunta: q.pergunta || "Identifique a estrutura sinalizada.",
      gabarito: q.gabarito || "Sem gabarito registrado.",
      pinX: px,
      pinY: py
    });
  });

  if (pool.length === 0) {
    alert("Falha ao estruturar questões no pool. Verifique a integridade do banco de dados.");
    return;
  }

  // Algoritmo de Embaralhamento de Fisher-Yates (Shuffle O(n)) para total imprevisibilidade da prova
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  simulatorState.poolQuestoes = pool;
  simulatorState.indiceAtual = 0;
  simulatorState.questoesCorretas = 0;

  // Transição de UI para o modo de Execução
  const setupContainer = document.getElementById("simuladoSetup");
  const execContainer = document.getElementById("simuladoExecution");
  const resultContainer = document.getElementById("simuladoResults");

  if (setupContainer) setupContainer.classList.add("hidden");
  if (resultContainer) resultContainer.classList.add("hidden");
  if (execContainer) execContainer.classList.remove("hidden");

  renderizarQuestaoAtual();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * RENDERIZAÇÃO DA QUESTÃO ATUAL
 * Apresenta a imagem base e plota exclusivamente o pino alvo no palco óptico.
 */
function renderizarQuestaoAtual() {
  const { poolQuestoes, indiceAtual } = simulatorState;

  if (indiceAtual >= poolQuestoes.length) {
    finalizarSimulado();
    return;
  }

  const questao = poolQuestoes[indiceAtual];

  // Reseta transformações espaciais do palco de visualização para 1x centralizado
  resetSimuladoZoom();

  // Atualização do cabeçalho do painel de questão (30% à direita)
  const indProgresso = document.getElementById("simuladoProgressoTexto");
  const badgeDisc = document.getElementById("simuladoDisciplinaBadge");
  const tituloSpec = document.getElementById("simuladoSpecimeTitulo");
  const textoPergunta = document.getElementById("simuladoPerguntaTexto");

  if (indProgresso) indProgresso.textContent = `Questão ${indiceAtual + 1} de ${poolQuestoes.length}`;
  if (tituloSpec) tituloSpec.textContent = questao.nomePeca;
  if (textoPergunta) textoPergunta.textContent = questao.pergunta;

  if (badgeDisc) {
    const configDisc = {
      anatomia: { nome: "Anatomia Macroscópica", class: "bg-cyan-950 text-cyan-300 border border-cyan-800/60" },
      histologia: { nome: "Histologia Microscópica", class: "bg-blue-950 text-blue-300 border border-blue-800/60" },
      patologia: { nome: "Patologia Geral", class: "bg-rose-950 text-rose-300 border border-rose-800/60" },
      parasitologia: { nome: "Parasitologia Médica", class: "bg-emerald-950 text-emerald-300 border border-emerald-800/60" },
      microbiologia: { nome: "Microbiologia & Micologia", class: "bg-amber-950 text-amber-300 border border-amber-800/60" }
    };
    const atual = configDisc[questao.disciplina] || configDisc.anatomia;
    badgeDisc.textContent = atual.nome;
    badgeDisc.className = `px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${atual.class}`;
  }

  // Reset do estado dos botões de gabarito e autoavaliação
  const btnRevelar = document.getElementById("btnRevelarGabarito");
  const gabaritoBox = document.getElementById("simuladoGabaritoBox");
  const gabaritoTexto = document.getElementById("simuladoGabaritoTexto");
  const botoesAv = document.getElementById("simuladoBotoesAvaliacao");

  if (btnRevelar) btnRevelar.classList.remove("hidden");
  if (gabaritoBox) gabaritoBox.classList.add("hidden");
  if (gabaritoTexto) gabaritoTexto.textContent = questao.gabarito;
  if (botoesAv) botoesAv.classList.add("hidden");

  // Injeção da imagem no palco e renderização seletiva e exclusiva do PIN da questão
  const imgMatrix = document.getElementById("simuladoImageMatrix");
  const pinsContainer = document.getElementById("simuladoPinStageOverlay");

  if (imgMatrix) {
    imgMatrix.src = questao.imagemBase || "";
  }

  if (pinsContainer) {
    pinsContainer.innerHTML = `
      <div 
        style="left: ${questao.pinX}%; top: ${questao.pinY}%; transform: translate(-50%, -50%);"
        class="pin-marker absolute w-5 h-5 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.9)] cursor-pointer z-20 group select-none pointer-events-none flex items-center justify-center"
        title="Alvo da Questão ${indiceAtual + 1}">
        <div class="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
        <span class="relative z-10 text-[10px] font-extrabold text-neutral-950 font-mono">?</span>
      </div>
    `;
    atualizarPalcoVisual(false);
  }
}

/**
 * Revela a resposta esperada no painel lateral e substitui o botão por controles de autoavaliação.
 */
function revelarGabarito() {
  const btnRevelar = document.getElementById("btnRevelarGabarito");
  const gabaritoBox = document.getElementById("simuladoGabaritoBox");
  const botoesAv = document.getElementById("simuladoBotoesAvaliacao");

  if (btnRevelar) btnRevelar.classList.add("hidden");
  if (gabaritoBox) gabaritoBox.classList.remove("hidden");
  if (botoesAv) botoesAv.classList.remove("hidden");

  // Rola o painel lateral para garantir visibilidade do gabarito em resoluções compactas
  const painelDireito = document.getElementById("simuladoPainelDireito");
  if (painelDireito) {
    painelDireito.scrollTo({ top: painelDireito.scrollHeight, behavior: "smooth" });
  }
}

/**
 * Computa o resultado da autoavaliação do estudante e avança o ciclo do simulado.
 * @param {boolean} acertou 
 */
function avaliarResposta(acertou) {
  if (acertou) {
    simulatorState.questoesCorretas++;
  }
  proximaQuestao();
}

/**
 * Avança o índice da prova e invoca o renderizador ou finalização.
 */
function proximaQuestao() {
  simulatorState.indiceAtual++;
  renderizarQuestaoAtual();
}

/**
 * Encerra a execução do simulado e projeta o relatório computado de aproveitamento.
 */
function finalizarSimulado() {
  const execContainer = document.getElementById("simuladoExecution");
  const resultContainer = document.getElementById("simuladoResults");

  if (execContainer) execContainer.classList.add("hidden");
  if (resultContainer) resultContainer.classList.remove("hidden");

  const total = simulatorState.poolQuestoes.length;
  const corretas = simulatorState.questoesCorretas;
  const erradas = total - corretas;
  const porcentagem = total > 0 ? Math.round((corretas / total) * 100) : 0;

  const scoreTexto = document.getElementById("simuladoScorePorcentagem");
  const numCorretas = document.getElementById("simuladoResumoCorretas");
  const numErradas = document.getElementById("simuladoResumoErradas");
  const avaliacaoText = document.getElementById("simuladoFeedbackPedagogico");
  const barraProgresso = document.getElementById("simuladoBarraProgresso");

  if (scoreTexto) scoreTexto.textContent = `${porcentagem}%`;
  if (numCorretas) numCorretas.textContent = `${corretas} ${corretas === 1 ? 'questão' : 'questões'}`;
  if (numErradas) numErradas.textContent = `${erradas} ${erradas === 1 ? 'questão' : 'questões'}`;
  
  if (barraProgresso) {
    barraProgresso.style.width = `${porcentagem}%`;
    if (porcentagem >= 80) {
      barraProgresso.className = "h-3 rounded-full bg-blue-600 transition-all duration-500";
    } else if (porcentagem >= 60) {
      barraProgresso.className = "h-3 rounded-full bg-emerald-600 transition-all duration-500";
    } else {
      barraProgresso.className = "h-3 rounded-full bg-amber-600 transition-all duration-500";
    }
  }

  if (avaliacaoText) {
    if (porcentagem >= 85) {
      avaliacaoText.innerHTML = "<strong>Desempenho de Excelência:</strong> Domínio técnico sólido sobre os marcadores morfológicos e precisão diagnóstica no acervo selecionado.";
    } else if (porcentagem >= 70) {
      avaliacaoText.innerHTML = "<strong>Desempenho Satisfatório:</strong> Boa compreensão geral das estruturas anatômicas e teciduais. Recomenda-se revisão direcionada às questões pontuadas como incorretas.";
    } else {
      avaliacaoText.innerHTML = "<strong>Atenção Pedagógica Requerida:</strong> Aproveitamento abaixo do limiar de excelência médica. Indispensável retomar os módulos de observação na Bancada Macroscópica e Microscópia antes da reavaliação.";
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Reinicia o ciclo do simulado para nova escolha de tópicos no Setup.
 */
function reiniciarSimulado() {
  simulatorState.poolQuestoes = [];
  simulatorState.indiceAtual = 0;
  simulatorState.questoesCorretas = 0;
  carregarSetupSimulado();
}

/**
 * Restaura o Zoom do palco do simulado para o nível nativo 1x.
 */
function resetSimuladoZoom() {
  simulatorState.scale = 1;
  simulatorState.panX = 0;
  simulatorState.panY = 0;
  atualizarPalcoVisual(true);
}

/**
 * Aplica transformações vetoriais CSS sobre o palco e estabiliza escala do PIN de questão.
 * @param {boolean} smooth - Transição suave CSS.
 */
function atualizarPalcoVisual(smooth = false) {
  const layer = document.getElementById("simuladoTransformLayer");
  if (!layer) return;

  if (smooth) {
    layer.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
  } else {
    layer.style.transition = "none";
  }

  layer.style.transform = `translate(${simulatorState.panX}px, ${simulatorState.panY}px) scale(${simulatorState.scale})`;

  const pins = document.querySelectorAll("#simuladoPinStageOverlay .pin-marker");
  const inverso = 1 / simulatorState.scale;
  pins.forEach((pin) => {
    pin.style.transform = `translate(-50%, -50%) scale(${inverso})`;
  });
}

// ==========================================
// CONTROLES DE ZOOM E PAN NO PALCO DA PROVA
// ==========================================

function handleMouseDown(e) {
  if (e.button !== 0) return;
  simulatorState.isDragging = true;
  simulatorState.startX = e.clientX - simulatorState.panX;
  simulatorState.startY = e.clientY - simulatorState.panY;
  const palco = document.getElementById("simuladoPalcoContainer");
  if (palco) palco.classList.add("cursor-grabbing");
}

function handleMouseMove(e) {
  if (!simulatorState.isDragging) return;
  e.preventDefault();
  simulatorState.panX = e.clientX - simulatorState.startX;
  simulatorState.panY = e.clientY - simulatorState.startY;
  atualizarPalcoVisual(false);
}

function handleMouseUp() {
  if (!simulatorState.isDragging) return;
  simulatorState.isDragging = false;
  const palco = document.getElementById("simuladoPalcoContainer");
  if (palco) palco.classList.remove("cursor-grabbing");
}

function handleMouseLeave() {
  if (simulatorState.isDragging) {
    simulatorState.isDragging = false;
    const palco = document.getElementById("simuladoPalcoContainer");
    if (palco) palco.classList.remove("cursor-grabbing");
  }
}

function handleWheel(e) {
  e.preventDefault();
  const palco = document.getElementById("simuladoPalcoContainer");
  if (!palco) return;

  const rect = palco.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const deltaX = e.clientX - centerX;
  const deltaY = e.clientY - centerY;

  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  const oldScale = simulatorState.scale;
  const newScale = Math.min(Math.max(oldScale * zoomFactor, 1), 5);

  if (oldScale === newScale) return;

  const ratio = newScale / oldScale;
  simulatorState.panX = deltaX - (deltaX - simulatorState.panX) * ratio;
  simulatorState.panY = deltaY - (deltaY - simulatorState.panY) * ratio;
  simulatorState.scale = newScale;

  if (simulatorState.scale === 1) {
    simulatorState.panX = 0;
    simulatorState.panY = 0;
  }

  atualizarPalcoVisual(false);
}

// Expõe métodos de controle da avaliação ao namespace da aplicação na janela
window.App = {
  ...window.App,
  carregarSetupSimulado,
  alternarGrupoTopicos,
  prepararSimulado,
  revelarGabarito,
  avaliarResposta,
  proximaQuestao,
  finalizarSimulado,
  reiniciarSimulado,
  resetSimuladoZoom
};

document.addEventListener("DOMContentLoaded", initSimulator);
