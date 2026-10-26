/**
 * Roteador e Controlador Principal do Simulador Médico V3
 * Responsável por gerenciar a navegação, transições de tela e vinculação de estado.
 */
import { db } from "./firebase-config.js";
import { setFrenteAtiva, subscribe, getState } from "./state.js";
import { toggleDashboard } from "./dashboard-engine.js";
import { initGlobalSearch } from "./search-engine.js";

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

  // Listener de Scroll para Header Dinâmico (Compactação da Navbar e Desaparecimento da Coruja)
  const headerMin = document.getElementById("palasMinimalHeader");
  
  if (headerMin) {
    const handleDynamicNavbarScroll = () => {
      // O header de páginas internas é estático, então não deve mudar no scroll
      if (getState().frenteAtiva) return; // Se houver frente ativa, não está na Home

      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const brandLogo = document.querySelector("#palasMinimalHeader brand-logo");
      const owlWrapper = document.getElementById("brandLogoOwlWrapper");
      const logoPill = document.querySelector("#palasMinimalHeader a");

      if (scrollY > 20) {
        if (owlWrapper) {
          owlWrapper.style.opacity = "0";
          owlWrapper.style.transform = "scale(0.75)";
          owlWrapper.style.maxWidth = "0px";
          owlWrapper.style.marginRight = "-10px";
          owlWrapper.style.pointerEvents = "none";
        }
        if (logoPill) {
          logoPill.className = "group inline-flex items-center gap-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] px-4 sm:px-5 py-2 transition-all duration-300 ease-in-out shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.12)] cursor-pointer select-none no-underline";
        }
        if (brandLogo && brandLogo.getAttribute("show-subtitle") !== "false") {
          brandLogo.setAttribute("show-subtitle", "false");
        }
      } else {
        if (owlWrapper) {
          owlWrapper.style.opacity = "1";
          owlWrapper.style.transform = "scale(1)";
          owlWrapper.style.maxWidth = "48px";
          owlWrapper.style.marginRight = "0px";
          owlWrapper.style.pointerEvents = "auto";
        }
        if (logoPill) {
          logoPill.className = "group inline-flex items-center gap-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] px-5 sm:px-6 py-3 transition-all duration-300 ease-in-out shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.12)] cursor-pointer select-none no-underline";
        }
        if (brandLogo && brandLogo.getAttribute("show-subtitle") !== "true") {
          brandLogo.setAttribute("show-subtitle", "true");
        }
      }
    };

    window.addEventListener("scroll", handleDynamicNavbarScroll, { passive: true });
    handleDynamicNavbarScroll();
  }

  // Inscreve a função de renderização no gerenciador reativo
  subscribe(renderView);

  // Verifica parâmetros de rota (Deep Linking)
  const urlParams = new URLSearchParams(window.location.search);
  const frenteParam = urlParams.get("frente");
  if (frenteParam && ["anatomia", "histologia", "patologia", "parasitologia", "microbiologia", "dashboard"].includes(frenteParam)) {
    setFrenteAtiva(frenteParam);
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
  const isLightMode = ["histologia", "patologia", "anatomia", "parasitologia", "microbiologia"].includes(state.frenteAtiva);

  if (isDashboard) {
    if (footerDark) footerDark.classList.add("hidden");
    if (footerLight) footerLight.classList.add("hidden");
  } else if (isLightMode) {
    if (footerDark) footerDark.classList.add("hidden");
    if (footerLight) footerLight.classList.remove("hidden");
  } else {
    if (footerDark) footerDark.classList.remove("hidden");
    if (footerLight) footerLight.classList.add("hidden");
  }

  if (isHomePage) {
    // HOME: emblema dourado + header transparente flutuante
    if (headerMin) headerMin.className = "sticky top-0 z-50 w-full transition-all duration-300 pointer-events-none";
    if (brandLogo) {
      brandLogo.setAttribute("is-home", "true");
      brandLogo.setAttribute("theme", "dark-bg");
    }
    if (btnOpenDrawer) btnOpenDrawer.className = "w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none";
    if (btnVoltarGlobal) {
      btnVoltarGlobal.classList.add("hidden");
      btnVoltarGlobal.classList.remove("flex");
    }
  } else if (isDashboard) {
    // DASHBOARD CMS: monocromático claro + header escuro fixo
    if (headerMin) headerMin.className = "sticky top-0 z-50 w-full transition-all duration-300 pointer-events-none";
    if (brandLogo) {
      brandLogo.setAttribute("is-home", "false");
      brandLogo.setAttribute("theme", "dark-bg");
    }
    if (btnOpenDrawer) btnOpenDrawer.className = "w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none";
    if (btnVoltarGlobal) {
      btnVoltarGlobal.classList.add("hidden");
      btnVoltarGlobal.classList.remove("flex");
    }
  } else {
    // PÁGINAS INTERNAS: monocromático escuro + header flutuante com botão voltar
    if (headerMin) headerMin.className = "sticky top-0 z-50 w-full transition-all duration-300 pointer-events-none";
    if (brandLogo) {
      brandLogo.setAttribute("is-home", "false");
      brandLogo.setAttribute("theme", "dark-bg");
    }
    if (btnOpenDrawer) btnOpenDrawer.className = "w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none";
    if (btnVoltarGlobal) {
      btnVoltarGlobal.classList.remove("hidden");
      btnVoltarGlobal.classList.add("flex");
    }
  }

  // Garante que o menu lateral seja fechado em transições de tela
  fecharMenuLateral();

  const minimalHeader = document.getElementById("palasMinimalHeader");
  
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
    if (window.App && typeof window.App.voltarNivel === "function") {
      window.App.voltarNivel(1);
    }
  } else if (state.frenteAtiva === "dashboard") {
    if (elements.pgDashboard) elements.pgDashboard.classList.remove("hidden");
    if (window.App && typeof window.App.inicializarPainelCms === "function") {
      window.App.inicializarPainelCms();
    }
  }
}


/**
 * Aciona o seletor de frentes no store reativo com suporte a History API.
 * @param {string} frente - Identificador ('anatomia', 'histologia', etc.).
 * @param {boolean} skipHistory - Impede o pushState se a chamada vier de um evento popstate.
 */
function selecionarFrente(frente, skipHistory = false) {
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
 * Utilitário global inteligente para retorno de rotas utilizando o histórico do navegador.
 */
function voltarGlobal() {
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
      if (window.App.voltarNivel) window.App.voltarNivel(1, true);
      selecionarFrente(event.state.frente, true);
    } else {
      goHome(true);
    }
  } else {
    goHome(true);
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
