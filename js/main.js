/**
 * Roteador e Controlador Principal do Palas Atlas
 * Responsável por gerenciar a navegação, transições de tela e vinculação de estado.
 */
import { db } from "./firebase-config.js";
import { setFrenteAtiva, subscribe, getState } from "./state.js";
import { initGlobalSearch } from "./search-engine.js";

// Lazy loading sob demanda do dashboard-engine para otimizar o bundle do aluno
let _dashboardEnginePromise = null;
function carregarDashboardEngine() {
  if (!_dashboardEnginePromise) {
    _dashboardEnginePromise = import("./dashboard-engine.js?v=20261105_v2");
  }
  return _dashboardEnginePromise;
}

function toggleDashboard() {
  const currentState = getState();
  if (currentState && currentState.frenteAtiva === "dashboard") {
    goHome();
  } else {
    selecionarFrente("dashboard");
  }
}

// Cache dos nós do DOM
const elements = {
  pgHome: null,
  pgAnatomia: null,
  pgHistologia: null,
  pgDashboard: null,

  btnBackHome: null,
  headerGlobal: null,
  footerGlobal: null,
  headerTitle: null,
  headerSubtitle: null,
  sideDrawer: null,
  drawerBackdrop: null,
  btnAbrirMenu: null
};

/**
 * Inicializa referências do DOM, vincula listeners estáticos e inscreve a reatividade.
 */
function init() {
  elements.pgHome = document.getElementById("pgHome");
  elements.pgAnatomia = document.getElementById("pgAnatomia");
  elements.pgHistologia = document.getElementById("pgHistologia");
  elements.pgDashboard = document.getElementById("pgDashboard");

  elements.btnBackHome = document.getElementById("btnBackHome");
  elements.headerGlobal = document.getElementById("headerGlobal");
  elements.footerGlobal = document.getElementById("footerGlobal");
  elements.headerTitle = document.getElementById("headerTitle");
  elements.headerSubtitle = document.getElementById("headerSubtitle");
  elements.sideDrawer = document.getElementById("sideDrawer");
  elements.drawerBackdrop = document.getElementById("drawerBackdrop");
  elements.btnAbrirMenu = document.getElementById("btnAbrirMenu");

  // Iniciar motor de busca
  initGlobalSearch();

  // Navegação
  if (elements.btnBackHome) {
    elements.btnBackHome.addEventListener("click", goHome);
  }

  if (elements.btnAbrirMenu) {
    elements.btnAbrirMenu.addEventListener("click", abrirMenuLateral);
  }

  if (elements.drawerBackdrop && elements.sideDrawer) {
    // Retira o menu lateral de dentro do pgHome (que pode estar oculto) e o insere no escopo global
    document.body.appendChild(elements.drawerBackdrop);
    document.body.appendChild(elements.sideDrawer);
    elements.drawerBackdrop.addEventListener("click", fecharMenuLateral);
  }

  // Listener global para fechamento do menu lateral e modal do guia de uso via tecla ESC
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      fecharModalAjuda();
      fecharMenuLateral();
    }
  });

  // Listener de Scroll para Header Dinâmico
  const headerMin = document.getElementById("palasMinimalHeader");
  
  if (headerMin) {
    const handleDynamicNavbarScroll = () => {
      if (getState().frenteAtiva === "dashboard") return;
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollY > 16) {
        headerMin.classList.add("shadow-[0_8px_30px_-8px_rgba(15,23,42,0.10)]");
      } else {
        headerMin.classList.remove("shadow-[0_8px_30px_-8px_rgba(15,23,42,0.10)]");
      }
    };

    window.addEventListener("scroll", handleDynamicNavbarScroll, { passive: true });
    handleDynamicNavbarScroll();
  }

  // Inscreve a função de renderização no gerenciador reativo
  subscribe(renderView);

  // Verifica parâmetros de rota (Deep Linking)
  const urlParams = new URLSearchParams(window.location.search);
  let frenteParam = urlParams.get("frente");
  let topicoParam = urlParams.get("topico");
  if (frenteParam === "admin" || frenteParam === "cms") {
    frenteParam = "dashboard";
  }
  if (frenteParam && topicoParam && window.App && typeof window.App.abrirTopico === "function") {
    window.App.abrirTopico(topicoParam, frenteParam);
  } else if (frenteParam && ["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(frenteParam)) {
    renderView(getState());
    setTimeout(() => {
      if (window.App && typeof window.App.abrirDisciplinaHome === "function") {
        window.App.abrirDisciplinaHome(frenteParam);
      }
    }, 150);
  } else if (frenteParam === "dashboard") {
    setFrenteAtiva("dashboard");
  } else {
    // Executa a renderização inicial baseada no estado nulo (Home)
    renderView(getState());
  }

  // Remove o splash screen — app pronto
  if (typeof window.__appReady === 'function') window.__appReady();
}

/**
 * Alterna a visibilidade dos containeres de acordo com o estado da aplicação.
 * @param {Object} state - Estado imutável atual da aplicação.
 */
function renderView(state) {
  // Controle de scroll global: força rolagem para o topo absoluto (0, 0) a cada transição de rota/frente
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const allPages = [
    elements.pgHome,
    elements.pgAnatomia,
    elements.pgHistologia,
    elements.pgDashboard
  ];

  // Oculta sistematicamente todos os contentores
  allPages.forEach((page) => {
    if (page && !page.classList.contains("hidden")) {
      page.classList.add("hidden");
    }
  });

  // Aplica o comportamento do Header Global de acordo com a página
  const headerMin = document.getElementById("palasMinimalHeader");
  const brandLogo = document.querySelector("#palasMinimalHeader brand-logo");
  const btnOpenDrawer = document.getElementById("btnOpenDrawer");
  const btnVoltarGlobal = document.getElementById("btnVoltarGlobal");
  
  const isHomePage = !state.frenteAtiva;
  const isDashboard = state.frenteAtiva === 'dashboard';

  const footerDark = document.getElementById("footer-dark");
  const footerLight = document.getElementById("footer-light");

  if (isDashboard) {
    if (footerDark) footerDark.classList.add("hidden");
    if (footerLight) footerLight.classList.add("hidden");
  } else {
    if (footerDark) footerDark.classList.add("hidden");
    if (footerLight) footerLight.classList.remove("hidden");
  }

  const logoLink = document.getElementById("headerBrandLink");
  const desktopNav = document.getElementById("headerDesktopNav");

  const mainContainer = document.getElementById("mainRouterContainer");
  if (mainContainer) {
    if (isDashboard || isHomePage) {
      mainContainer.className = "flex-1 w-full flex flex-col transition-all duration-300 pt-0";
    } else {
      mainContainer.className = "flex-1 w-full flex flex-col transition-all duration-300 pt-16 sm:pt-[70px]";
    }
  }

  if (isHomePage) {
    // HOME: Barra Superior Arquitetônica com Logo Grande (size="lg") à Esquerda e Glassmorphism
    if (headerMin) {
      headerMin.className = "sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] transition-all duration-300 pointer-events-auto";
    }
    if (brandLogo) {
      brandLogo.setAttribute("is-home", "true");
      brandLogo.setAttribute("theme", "light-bg");
      brandLogo.setAttribute("size", "lg");
    }
    if (logoLink) {
      logoLink.className = "group inline-flex items-center gap-3 py-1.5 px-1 transition-all duration-200 cursor-pointer select-none no-underline";
    }
    if (btnOpenDrawer) btnOpenDrawer.className = "lg:hidden h-9 px-2.5 sm:px-3.5 rounded-xl bg-slate-100/90 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200/90 hover:border-slate-900 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none shadow-2xs shrink-0";
    if (btnVoltarGlobal) {
      btnVoltarGlobal.classList.add("hidden");
      btnVoltarGlobal.classList.remove("flex");
    }
  } else {
    // SUBPÁGINAS (ACERVO & DASHBOARD CMS): Barra Superior com PALAS ATLAS centralizado e Botão Voltar à esquerda
    if (headerMin) headerMin.className = "fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200/90 transition-all duration-300 pointer-events-auto shadow-xs";
    if (brandLogo) {
      brandLogo.setAttribute("is-home", "false");
      brandLogo.setAttribute("theme", "light-bg");
      brandLogo.setAttribute("size", "sm");
    }
    if (logoLink) {
      logoLink.className = "group absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-2.5 py-1.5 px-1 transition-all duration-200 cursor-pointer select-none no-underline z-10";
    }
    if (btnOpenDrawer) btnOpenDrawer.className = "h-10 px-3.5 rounded-xl bg-slate-100/90 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200/90 hover:border-slate-900 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none shadow-2xs";
    if (btnVoltarGlobal) {
      btnVoltarGlobal.className = "min-h-[38px] text-slate-700 hover:text-slate-950 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/90 rounded-xl transition-all text-xs font-sans font-semibold flex items-center justify-center gap-2 px-3.5 py-1.5 cursor-pointer active:scale-95";
      btnVoltarGlobal.classList.remove("hidden");
      btnVoltarGlobal.classList.add("flex");
    }
  }

  // Garante que o menu lateral seja fechado em transições de tela
  fecharMenuLateral();

  const minimalHeader = document.getElementById("palasMinimalHeader");
  
  // Encerra listeners e instâncias do CMS se não estiver no dashboard
  if (state.frenteAtiva !== "dashboard" && window.App && typeof window.App.encerrarPainelCms === "function") {
    window.App.encerrarPainelCms();
  }

  // Renderização do Hub de Acesso (Home)
  if (!state.frenteAtiva) {
    if (elements.pgHome) elements.pgHome.classList.remove("hidden");
    if (minimalHeader) minimalHeader.classList.remove("hidden"); // Header global sempre visível
    return;
  }

  // Renderização das disciplinas e módulos ativos
  if (minimalHeader) minimalHeader.classList.remove("hidden");
  if (["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
    if (elements.pgHistologia) elements.pgHistologia.classList.remove("hidden");
    const subCatalog = document.getElementById("histoSubCatalog");
    const isTopicOpen = subCatalog && !subCatalog.classList.contains("hidden");
    const urlParams = new URLSearchParams(window.location.search);
    const topicoParam = urlParams.get("topico");

    if (!isTopicOpen && !topicoParam) {
      if (window.App && typeof window.App.voltarParaDisciplinaHome === "function") {
        window.App.voltarParaDisciplinaHome(state.frenteAtiva);
      }
    }
  } else if (state.frenteAtiva === "dashboard") {
    if (elements.pgDashboard) elements.pgDashboard.classList.remove("hidden");
    carregarDashboardEngine().then(() => {
      if (window.App && typeof window.App.inicializarPainelCms === "function") {
        window.App.inicializarPainelCms();
      }
    }).catch(err => {
      console.error("[Palas Atlas] Falha ao carregar dashboard-engine.js sob demanda:", err);
    });
  }
}


/**
 * Aciona o seletor de frentes no store reativo com suporte a History API.
 * Para frentes do ciclo básico, agora expande o accordion diretamente na Home sem página intermediária.
 * @param {string} frente - Identificador ('anatomia', 'histologia', etc.).
 * @param {boolean} skipHistory - Impede o pushState se a chamada vier de um evento popstate.
 */
function selecionarFrente(frente, skipHistory = false) {
  if (["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(frente)) {
    if (window.App && typeof window.App.abrirDisciplinaHome === "function") {
      window.App.abrirDisciplinaHome(frente);
      return;
    }
  }

  if (!skipHistory) {
    history.pushState({ frente: frente }, "", `?frente=${frente}`);
  }
  
  setFrenteAtiva(frente);
}

/**
 * Reseta a disciplina ativa, retornando ao Hub Inicial.
 */
function goHome(skipHistory = false) {
  if (!skipHistory) {
    history.pushState({ frente: null }, "", window.location.pathname);
  }
  setFrenteAtiva(null);
}

// A escuta de popstate completa está localizada na seção de utilitários globais do histórico.

/**
 * Abre o menu lateral (Drawer) e exibe o fundo escurecido com transição suave.
 */
function abrirMenuLateral() {
  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if (drawer) {
    // Remove o hidden para inserir no DOM
    drawer.classList.remove("hidden");
    // Força um reflow para o navegador registrar a renderização antes da transição
    void drawer.offsetWidth;
    
    // Dispara a transição Tailwind real
    drawer.classList.remove("translate-x-full");
    drawer.classList.add("translate-x-0");
    
    // Limpa os inlines injetados anteriormente
    drawer.style.position = "";
    drawer.style.top = "";
    drawer.style.right = "";
    drawer.style.height = "";
    drawer.style.margin = "";
    drawer.style.transform = "";
  }
  if (backdrop) {
    backdrop.classList.remove("hidden");
    backdrop.style.display = "";
    backdrop.style.opacity = "";
  }
}

/**
 * Fecha o menu lateral (Drawer) e oculta o fundo escurecido.
 */
function fecharMenuLateral() {
  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if (drawer) {
    drawer.classList.remove("translate-x-0");
    drawer.classList.add("translate-x-full");
    // Aguarda o fim da animação de 300ms antes de esconder do DOM
    setTimeout(() => {
      if (drawer.classList.contains("translate-x-full")) {
        drawer.classList.add("hidden");
      }
    }, 300);
  }
  if (backdrop) {
    backdrop.classList.add("hidden");
  }
}

/**
 * Abre o modal interativo "Como Usar o Site" (Guia de Uso).
 */
function abrirModalAjuda() {
  const modal = document.getElementById("helpModal");
  if (modal && modal.classList.contains("hidden")) {
    modal.classList.remove("hidden");
  }
}

/**
 * Fecha o modal interativo "Como Usar o Site" (Guia de Uso).
 */
function fecharModalAjuda() {
  const modal = document.getElementById("helpModal");
  if (modal && !modal.classList.contains("hidden")) {
    modal.classList.add("hidden");
  }
}

/**
 * Utilitário global para transição rápida de rotas a partir do botão 'Voltar ao Início' e links.
 * @param {string} destino - Identificador de tela, como 'pgHome'.
 */
function navegarPara(destino) {
  if (destino === "pgHome" || !destino) {
    selecionarFrente(null);
  } else if (typeof destino === "string" && destino.startsWith("pg")) {
    const frente = destino.replace("pg", "").toLowerCase();
    selecionarFrente(frente);
  }
}

/**
 * Utilitário global para retorno de rotas utilizando o histórico do navegador.
 */
function voltarGlobal() {
  const subCatalog = document.getElementById("histoSubCatalog");
  const isTopicOpen = subCatalog && !subCatalog.classList.contains("hidden");
  if (isTopicOpen && window.App && typeof window.App.voltarParaDisciplinaHome === "function") {
    const estado = typeof getState === "function" ? getState() : null;
    window.App.voltarParaDisciplinaHome(estado && estado.frenteAtiva ? estado.frenteAtiva : "histologia");
    return;
  }
  if (window.history.length > 1) {
    history.back();
  } else {
    goHome();
  }
}

// Escuta ativa do botão Voltar/Avançar Nativo do Navegador
window.addEventListener("popstate", (event) => {
  if (event.state) {
    if (event.state.nivel === 3 && window.App.abrirLamina) {
      window.App.abrirLamina(event.state.lamina, true);
    } else if (event.state.nivel === 2 && window.App.abrirTopico) {
      window.App.abrirTopico(event.state.topico, event.state.frente, true);
    } else if (event.state.frente) {
      goHome(true);
      if (window.App && typeof window.App.abrirDisciplinaHome === "function") {
        window.App.abrirDisciplinaHome(event.state.frente);
      }
    } else {
      goHome(true);
    }
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    const frente = urlParams.get("frente");
    const topico = urlParams.get("topico");
    if (frente && topico && window.App && typeof window.App.abrirTopico === "function") {
      window.App.abrirTopico(topico, frente, true);
    } else if (frente) {
      goHome(true);
      if (window.App && typeof window.App.abrirDisciplinaHome === "function") {
        window.App.abrirDisciplinaHome(frente);
      }
    } else {
      goHome(true);
    }
  }
});

// Exposição controlada para o objeto global da janela (acessível pelo HTML e outros módulos)
window.App = window.App || {};
Object.assign(window.App, {
  selecionarFrente,
  goHome,
  toggleDashboard,
  abrirMenuLateral,
  fecharMenuLateral,
  abrirModalAjuda,
  fecharModalAjuda,
  navegarPara,
  voltarGlobal
});
window.toggleDashboard = toggleDashboard;

window.navegarPara = navegarPara;

/**
 * Inicializa e gerencia a transição morfológica do cabeçalho Palas Atlas com base no scroll na Home Page.
 */
function inicializarHeaderDinamico() {
  const palasHeaderWrapper = document.getElementById("palasHeaderWrapper");
  const palasHeader = document.getElementById("palasHeader");
  const homeContainer = document.getElementById("pgHome");

  if (!palasHeader || !palasHeaderWrapper) return;

  function handleScroll() {
    const scrollY = window.scrollY || (homeContainer ? homeContainer.scrollTop : 0);
    if (scrollY > 30) {
      palasHeaderWrapper.classList.remove("p-0");
      palasHeaderWrapper.classList.add("pt-4", "px-4");
      palasHeader.className = "w-fit bg-black/80 backdrop-blur-2xl border border-white/10 px-8 py-2.5 shadow-2xl flex items-center justify-center transition-all duration-500 pointer-events-auto rounded-full";
    } else {
      palasHeaderWrapper.classList.remove("pt-4", "px-4");
      palasHeaderWrapper.classList.add("p-0");
      palasHeader.className = "w-full bg-black/60 backdrop-blur-xl border-b border-white/10 px-6 py-4 shadow-xl flex items-center justify-center transition-all duration-500 pointer-events-auto rounded-none";
    }
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  if (homeContainer) {
    homeContainer.addEventListener("scroll", handleScroll, { passive: true });
  }
  handleScroll();
}

// FIX MELHORIA 5: Unificado em um único ponto de entrada (bootstrap)
// para evitar condição de corrida entre init() e inicializarHeaderDinamico().
function bootstrap() {
  init();
  inicializarHeaderDinamico();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
