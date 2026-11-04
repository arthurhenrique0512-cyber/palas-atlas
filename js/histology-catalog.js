/**
 * ============================================================================
 * MOTOR DO CATÁLOGO DE MICROSCOPIA DO CICLO BÁSICO E NAVEGAÇÃO HIERÁRQUICA
 * ============================================================================
 * Suporte nativo ao Ciclo Básico: Histologia, Patologia, Parasitologia e Microbiologia.
 * Nível 1 (#histoCatalog): Sumário Limpo com cards visuais contendo apenas os títulos.
 * Nível 2 (#histoSubCatalog): Gaveta Teórico-Prática com resumo acadêmico detalhado e grid de lâminas.
 * Nível 3 (#histoMicroscope): Estúdio Óptico de Microscopia de Matriz Única.
 * 
 * Zero Emojis | Zero Truncamento | Clinical Precision UI
 */
import { db } from "./firebase-config.js";
import { catalogData } from "./catalog-data.js?v=20261103_v7";
import { getState, subscribe } from "./state.js";

let disciplinaAtual = "histologia";

function gerarIndiceLateral(modulo, topicoAtivoId, exibirSubtopicos = false) {
  let htmlItens = "";
  if (exibirSubtopicos && modulo && modulo.topicos) {
    modulo.topicos.forEach(topico => {
      const isAtivo = topico.id === topicoAtivoId;
      if (isAtivo) {
        htmlItens += `<button class="bg-sky-50 text-sky-800 font-semibold px-3 py-2 rounded-lg w-full text-left leading-snug break-words text-[11.5px] border-l-2 border-sky-600" title="${topico.titulo}">${topico.titulo}</button>`;
      } else {
        htmlItens += `<button onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')" class="text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 px-3 py-2 rounded-lg transition-colors w-full text-left leading-snug break-words text-[11.5px]" title="${topico.titulo}">${topico.titulo}</button>`;
      }
    });
  }

  const navItem = (id, label, dotClass) => {
    const isAtivo = disciplinaAtual === id;
    const btnClass = isAtivo 
      ? "bg-sky-50 text-sky-800 font-semibold px-3 py-2 rounded-lg w-full text-left flex items-center gap-2.5 border-l-2 border-sky-600"
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 px-3 py-2 rounded-lg transition-colors w-full text-left flex items-center gap-2.5";
    return `
      <button onclick="window.App.selecionarFrente('${id}')" class="${btnClass}">
        <span class="w-2 h-2 rounded-full ${dotClass} shrink-0"></span>
        <span class="truncate">${label}</span>
      </button>
    `;
  };

  const mapNomenclatura = {
    histologia: "Tecidos Histológicos",
    patologia: "Processos Patológicos",
    parasitologia: "Helmintos e Protozoários",
    microbiologia: "Bactérias e Fungos"
  };
  const tituloTopicos = mapNomenclatura[disciplinaAtual] || "Tópicos";

  return `
    <aside class="space-y-6 text-xs font-sans text-slate-600 border-r border-slate-200/80 pr-6 hidden md:block">
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-3 block">Disciplinas</span>
        <div class="space-y-1">
          ${navItem('histologia', 'Histologia', 'bg-sky-600')}
          ${navItem('patologia', 'Patologia', 'bg-rose-600')}
          ${navItem('parasitologia', 'Parasitologia', 'bg-emerald-600')}
          ${navItem('microbiologia', 'Microbiologia', 'bg-violet-600')}
        </div>
      </div>
      
      ${htmlItens ? `
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-3 block">${tituloTopicos}</span>
        <div class="space-y-1">
          ${htmlItens}
        </div>
      </div>
      ` : ''}
    </aside>
  `;
}


/**
 * Seletor Horizontal Deslizante de Disciplinas para Mobile e Tablet (md:hidden)
 * Permite ao usuário alternar com 1 toque entre Histologia, Anatomia, Patologia, etc.
 */
function gerarBarraDisciplinasTopo() {
  const lista = [
    { id: "histologia", label: "Histologia", dot: "bg-sky-600", activeBorder: "border-sky-600 text-sky-800 bg-sky-50/70" },
    { id: "patologia", label: "Patologia", dot: "bg-rose-600", activeBorder: "border-rose-600 text-rose-800 bg-rose-50/70" },
    { id: "parasitologia", label: "Parasitologia", dot: "bg-emerald-600", activeBorder: "border-emerald-600 text-emerald-800 bg-emerald-50/70" },
    { id: "microbiologia", label: "Microbiologia", dot: "bg-violet-600", activeBorder: "border-violet-600 text-violet-800 bg-violet-50/70" }
  ];

  const chipsHtml = lista.map((item) => {
    const isAtivo = disciplinaAtual === item.id;
    const classes = isAtivo
      ? `${item.activeBorder} font-semibold shadow-2xs`
      : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90";
    return `
      <button
        type="button"
        onclick="window.App.selecionarFrente('${item.id}')"
        class="shrink-0 flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-xl text-xs font-sans transition-all border cursor-pointer whitespace-nowrap ${classes}">
        <span class="w-2 h-2 rounded-full ${item.dot} shrink-0"></span>
        <span>${item.label}</span>
      </button>
    `;
  }).join("");

  return `
    <div class="w-full mb-7 pb-1 overflow-x-auto no-scrollbar flex items-center gap-2.5 select-none scroll-smooth">
      ${chipsHtml}
    </div>
  `;
}

/**
 * Renderiza o Nível 1 (#histoCatalog): Lista Vertical Numerada (Estilo Sumário de Livro)
 * @param {string} disciplina - Identificador da disciplina.
 */
function renderizarCatalogoHistologia(disciplina) {
  if (disciplina && catalogData[disciplina]) {
    disciplinaAtual = disciplina;
  } else if (typeof getState === "function" && getState() && catalogData[getState().frenteAtiva]) {
    disciplinaAtual = getState().frenteAtiva;
  }

  const modulo = catalogData[disciplinaAtual] || catalogData.histologia;
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (!c1) return;

  if (c1) c1.classList.remove("hidden");
  if (c2) c2.classList.add("hidden");
  if (c3) c3.classList.add("hidden");

  let htmlRows = "";
  let htmlSubmenu = "";
  
  if (modulo.topicos && modulo.topicos.length > 0) {
    modulo.topicos.forEach((topico, idx) => {
      const numFormatado = String(idx + 1).padStart(2, "0");
      htmlRows += `
        <div 
          onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')"
          class="px-5 sm:px-8 py-5 hover:bg-sky-50/50 transition-all duration-150 cursor-pointer flex items-center justify-between gap-4 group">
          <div class="flex items-center gap-4 sm:gap-6 min-w-0">
            <span class="font-mono text-xs sm:text-sm font-bold text-slate-400 group-hover:text-sky-700 transition-colors w-6 shrink-0 select-none">${numFormatado}</span>
            <span class="h-5 w-px bg-slate-200 group-hover:bg-sky-300 transition-colors shrink-0"></span>
            <h3 class="font-serif text-base sm:text-lg text-slate-900 font-bold tracking-[-0.015em] leading-snug group-hover:text-sky-800 transition-colors">${topico.titulo}</h3>
          </div>
          <span class="w-9 h-9 rounded-full bg-slate-50 border border-slate-200/80 group-hover:border-sky-600 group-hover:bg-sky-600 flex items-center justify-center text-slate-400 group-hover:text-white shrink-0 transition-all group-hover:translate-x-0.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>
      `;
      
      htmlSubmenu += `
        <button onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')" class="text-left text-slate-600 hover:text-sky-700 hover:bg-slate-100 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors leading-snug break-words w-full">
          ${topico.titulo}
        </button>
      `;
    });
  } else {
    htmlRows = `
      <div class="py-16 px-6 flex flex-col items-center justify-center text-center">
        <h3 class="font-serif text-xl text-slate-900 font-semibold mb-2">${modulo.tituloDisciplina}</h3>
        <p class="text-slate-500 font-sans text-sm leading-relaxed max-w-md mb-6">
          Acervo em preparação.
        </p>
        <button type="button" onclick="window.App.navegarPara('pgHome')" class="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-sans text-xs font-semibold transition-colors cursor-pointer">
          Voltar ao Início
        </button>
      </div>
    `;
  }
  
  const submenuContainer = document.getElementById('sidebarSubmenu-histologia');
  if (submenuContainer) {
    submenuContainer.innerHTML = htmlSubmenu;
    if (disciplinaAtual === 'histologia') {
      submenuContainer.classList.remove('hidden');
      submenuContainer.classList.add('flex');
    }
  }

  c1.innerHTML = `
    <div class="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 pb-20">
      <!-- BARRA HORIZONTAL DE DISCIPLINAS -->
      ${gerarBarraDisciplinasTopo()}

      <!-- CABEÇALHO DA DISCIPLINA -->
      <div class="mb-6 pb-5 border-b border-slate-200/90">
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-400 mb-2 flex-wrap">
          <a href="#" onclick="window.App.navegarPara('pgHome'); return false;" class="text-slate-500 hover:text-sky-700 transition-colors no-underline">Início</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <span class="text-slate-900 font-semibold pointer-events-none">${modulo.tituloDisciplina}</span>
        </nav>
        <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <h2 class="text-3xl sm:text-4xl font-serif font-extrabold text-slate-900 tracking-[-0.02em]">${modulo.tituloDisciplina}</h2>
          <p class="text-xs text-slate-500 font-sans">
            <span class="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Referência:</span> ${modulo.bibliografia}
          </p>
        </div>
      </div>

      <!-- LISTA VERTICAL NUMERADA (ESTILO SUMÁRIO DE LIVRO) -->
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.06)] divide-y divide-slate-200/80 overflow-hidden">
        ${htmlRows}
      </div>
    </div>
  `;
}

/**
 * Renderiza o Nível 2 (#histoSubCatalog): A Gaveta Teórico-Prática
 * @param {string} idTopico - Identificador do tópico selecionado.
 * @param {string} disciplina - Disciplina em escopo.
 * @param {boolean} skipHistory - Impede o pushState se a chamada vier de um evento popstate.
 */
async function abrirTopico(idTopico, disciplina, skipHistory = false) {
  const disc = disciplina || disciplinaAtual;
  const modulo = catalogData[disc] || catalogData.histologia;
  const topico = modulo.topicos.find((t) => t.id === idTopico);
  if (!topico) return;
  
  if (!skipHistory) {
    history.pushState({ frente: disc, nivel: 2, topico: idTopico }, "", `?frente=${disc}&topico=${idTopico}`);
  }

  // Rola suavemente para o topo absoluto da página
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (c1) c1.classList.add("hidden");
  if (c2) c2.classList.remove("hidden");
  if (c3) c3.classList.add("hidden");

  // Garante que o header global e o espaçamento adequado sob ele permaneçam ativos
  const minimalHeader = document.getElementById("palasMinimalHeader");
  if (minimalHeader) minimalHeader.classList.remove("hidden");

  const pgHistologia = document.getElementById("pgHistologia");
  if (pgHistologia) pgHistologia.classList.add("pt-14");

  // Limpeza de resquícios de armazenamento local para garantir pureza de dados via Cloud Firestore
  try {
    localStorage.removeItem("palas_atlas_custom_slides");
  } catch (errLimpeza) {
    console.warn("Aviso ao limpar cache local de lâminas:", errLimpeza);
  }

  // Parser Simples para texto corrido
  const formatarResumoAcademico = (texto) => {
    if (!texto) return "<p>Sem conteúdo disponível.</p>";
    if (texto.includes("<p>") || texto.includes("<strong>") || texto.includes("<div")) return texto;
    const sentencas = texto.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0);
    if (sentencas.length === 0) return `<p>${texto}</p>`;
    
    let html = "";
    for (let i = 0; i < sentencas.length; i++) {
      html += `<p>${sentencas[i]}</p>`;
    }
    return html;
  };

  // Renderização 2 Colunas Limpas (Índice + Texto) alinhada ao max-w-7xl
  c2.innerHTML = `
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 pb-16 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 md:gap-10">
      ${gerarIndiceLateral(modulo, topico.id, true)}

      <div class="w-full min-w-0">
        <!-- SELETOR HORIZONTAL DE DISCIPLINAS (MOBILE & TABLET: md:hidden) -->
        <div class="md:hidden">
          ${gerarBarraDisciplinasTopo()}
        </div>
      
        <!-- BREADCRUMBS -->
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-400 mb-2.5 flex-wrap">
          <a href="#" onclick="window.App.navegarPara('pgHome'); return false;" class="text-slate-500 hover:text-sky-700 transition-colors no-underline">Início</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <a href="#" onclick="window.App.voltarNivel(1); return false;" class="text-slate-500 hover:text-sky-700 transition-colors no-underline">${modulo.tituloDisciplina}</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <span class="text-slate-900 font-semibold pointer-events-none">${topico.titulo}</span>
        </nav>

        <!-- TÍTULO DO TECIDO -->
        <h1 class="font-serif text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-3">
          ${topico.titulo}
        </h1>

        <!-- TEXTO EXPLICATIVO (EDITORIAL CLARO) -->
        <div class="text-slate-600 text-sm md:text-base leading-relaxed space-y-3 mb-8 prose-editor break-words [&_strong]:font-semibold [&_strong]:text-slate-900 [&_b]:font-semibold [&_b]:text-slate-900">
          ${formatarResumoAcademico(topico.resumo)}
        </div>

        <!-- SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS -->
        <div class="mt-8 mb-4">
          <h2 class="text-xl font-serif font-bold text-slate-900 mb-6 border-b border-slate-200/80 pb-3">
            Lâminas de Microscopia Associadas
          </h2>
          <div id="gridCatalogoLaminas" class="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <p class="text-sm text-slate-500 font-mono col-span-full">Aguardando lâminas...</p>
          </div>
        </div>

      </div>
    </div>
  `;

  // Listener em Tempo Real (onSnapshot) na coleção 'laminas' apenas com status == 'ativa'
  if (typeof db !== "undefined" && db) {
    if (window._currentTopicUnsubscribe && typeof window._currentTopicUnsubscribe === "function") {
      window._currentTopicUnsubscribe();
    }

    window._currentTopicUnsubscribe = db.collection("laminas")
      .where("status", "==", "ativa")
      .onSnapshot((snapshot) => {
        let laminasDoTopico = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const topicoL = (data.topico || "").toLowerCase().trim();
          const targetId = idTopico.toLowerCase().trim();
          const targetTitulo = topico.titulo.toLowerCase().trim();

          if (topicoL === targetId || topicoL === targetTitulo || topicoL.includes(targetId) || (!data.topico && targetId === modulo.topicos[0].id)) {
            laminasDoTopico.push({ id: doc.id, ...data });
          }
        });

        const containerGrid = document.getElementById("gridCatalogoLaminas");
        const contadorTxt = document.getElementById("contadorLaminasBadge");

        if (contadorTxt) {
          contadorTxt.textContent = `${laminasDoTopico.length} ${laminasDoTopico.length === 1 ? 'Lâmina' : 'Lâminas'}`;
        }

        if (!containerGrid) return;

        if (laminasDoTopico.length === 0) {
          containerGrid.innerHTML = `
            <div class="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 shadow-sm">
              <span class="text-xs font-mono text-sky-700 font-semibold block uppercase tracking-wider mb-2">Sem Lâminas Ativas no Tópico</span>
              <h4 class="text-lg font-semibold text-slate-900 font-serif">Nenhuma lâmina matriz publicada para ${topico.titulo} no momento.</h4>
              <p class="text-xs text-slate-500 font-sans mt-2 max-w-lg mx-auto">Lâminas com status inativo não são listadas aqui. Acesse o Painel do Desenvolvedor para publicar peças neste módulo.</p>
              <button 
                type="button"
                onclick="window.App.selecionarFrente('dashboard')"
                class="mt-6 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-sans font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                Abrir Painel do Desenvolvedor &rarr;
              </button>
            </div>
          `;
          return;
        }

        let cardsLaminasHtml = "";
        laminasDoTopico.forEach((lamina) => {
          const disciplinaNome = lamina.disciplina || "Histologia";
          const coloracaoNome = lamina.coloracao || "Rotina Padrão";
          const nomeLamina = lamina.nome || "Peça Morfológica";
          const topicoNome = lamina.topico || "Módulo Geral";

          // CRÍTICO: sem onclick interceptor — o href navega diretamente para microscopio.html
          const imagemUrl = lamina.imagemUrl || lamina.imageUrl || lamina.caminhoImagemBase || lamina.dziUrl || "assets/histologia/muscular-esqueletico-he.jpg";

          // thumbnailUrl tem prioridade máxima (campo dedicado à pré-visualização)
          // Se não existir, tenta derivar do DZI ou usar a imagemUrl diretamente
          let thumbSrc = lamina.thumbnailUrl || "";
          let thumbSrcFallback = "";

          if (!thumbSrc) {
            if (imagemUrl.toLowerCase().endsWith(".dzi")) {
              const basePath = imagemUrl.substring(0, imagemUrl.lastIndexOf(".dzi"));
              thumbSrc = `${basePath}_files/8/0_0.jpg`;
              thumbSrcFallback = `${basePath}_files/8/0_0.jpeg`;
            } else {
              thumbSrc = imagemUrl;
              thumbSrcFallback = "assets/histologia/muscular-esqueletico-he.jpg";
            }
          }

          cardsLaminasHtml += `
            <a href="microscopio.html?id=${lamina.id}" class="relative h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200/80 shadow-[0_14px_34px_-8px_rgba(15,23,42,0.14)] hover:shadow-[0_20px_44px_-8px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 group cursor-pointer flex flex-col justify-between p-5 sm:p-6 bg-slate-900 no-underline">
              <!-- Placeholder exibido quando a imagem falha -->
              <div class="thumb-placeholder absolute inset-0 flex-col items-center justify-center gap-1 hidden bg-slate-900">
                <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M12 3v1.5M6.75 4.5l.75 1.3M17.25 4.5l-.75 1.3"/>
                </svg>
                <span class="text-xs text-slate-300 font-serif">Sem pré-visualização</span>
                <span class="text-[10px] text-slate-400 font-mono">Abra a lâmina para ver</span>
              </div>
              <!-- Imagem Full-Bleed 100% -->
              <img
                src="${thumbSrc}"
                alt="${nomeLamina}"
                class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                onerror="var fb='${thumbSrcFallback}'; if(fb && this.src!==fb){this.src=fb;}else{this.style.display='none';var ph=this.parentElement.querySelector('.thumb-placeholder');if(ph){ph.classList.remove('hidden');ph.classList.add('flex');}}"
              >
              <!-- Gradiente Escuro Suave na Base -->
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/10 pointer-events-none"></div>

              <!-- Topo: Badge Técnico -->
              <div class="relative z-10 flex items-center justify-between">
                <span class="bg-slate-950/75 border border-white/15 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md font-sans font-semibold tracking-wider">
                  ${coloracaoNome} &bull; 40x
                </span>
              </div>

              <!-- Base: Título e Seta Sobrepostos -->
              <div class="relative z-10 flex items-end justify-between gap-3">
                <h3 class="text-lg sm:text-xl font-serif font-bold text-white group-hover:text-sky-300 transition-colors leading-tight drop-shadow-sm">${nomeLamina}</h3>
                <span class="shrink-0 w-9 h-9 rounded-full bg-white/15 backdrop-blur-md border border-white/25 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500 flex items-center justify-center text-white transition-all duration-300">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </span>
              </div>
            </a>
          `;
        });

        containerGrid.innerHTML = cardsLaminasHtml;
      }, (erroDeConsulta) => {
        console.error("Erro no listener onSnapshot ao buscar lâminas no Firestore:", erroDeConsulta);
      });
  } else {
    const containerGrid = document.getElementById("gridCatalogoLaminas");
    if (containerGrid) {
      containerGrid.innerHTML = `<div class="col-span-full py-8 text-center text-xs font-mono text-red-500 font-semibold bg-red-50 border border-dashed border-red-200 rounded-xl">Falha na conexão com o Cloud Firestore. Verifique o SDK na página.</div>`;
    }
  }
}

/**
 * Ativa o Nível 3 (#histoMicroscope) e abre a lâmina no estúdio óptico.
 * @param {string} idLamina - Identificador da lâmina.
 * @param {boolean} skipHistory - Impede o pushState se a chamada vier de um evento popstate.
 */
function abrirLamina(idLamina, skipHistory = false) {
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (!skipHistory) {
    history.pushState({ frente: disciplinaAtual, nivel: 3, lamina: idLamina }, "", `?frente=${disciplinaAtual}&lamina=${idLamina}`);
  }

  const minimalHeader = document.getElementById("palasMinimalHeader");
  if (minimalHeader) minimalHeader.classList.remove("hidden");

  if (c1) c1.classList.add("hidden");
  if (c2) c2.classList.add("hidden");
  if (c3) c3.classList.remove("hidden");

  // Aguarda 50ms para que o navegador processe a remoção do hidden e calcule a geometria real do contêiner
  setTimeout(() => {
    if (window.App && typeof window.App.selecionarLaminaPorId === "function") {
      window.App.selecionarLaminaPorId(idLamina);
    }

    const seletor = document.getElementById("seletorLaminas");
    if (seletor) {
      seletor.value = idLamina;
    }

    if (window.osdViewer && window.osdViewer.viewport) {
      window.osdViewer.viewport.resize();
    }
  }, 50);
}

/**
 * Retorna ao nível especificado gerenciando a classe hidden.
 * @param {number} nivelDestino - 1 para Sumário Limpo, 2 para Gaveta Teórica, 3 para Microscópio.
 */
function voltarNivel(nivelDestino) {
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (!c1 || !c2 || !c3) return;

  c1.classList.add("hidden");
  c2.classList.add("hidden");
  c3.classList.add("hidden");

  const minimalHeader = document.getElementById("palasMinimalHeader");
  const pgHistologia = document.getElementById("pgHistologia");

  if (nivelDestino === 1) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (minimalHeader) minimalHeader.classList.remove("hidden");
    if (pgHistologia) pgHistologia.classList.add("pt-14");
    c1.classList.remove("hidden");
    renderizarCatalogoHistologia(disciplinaAtual);
  } else if (nivelDestino === 2) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (minimalHeader) minimalHeader.classList.remove("hidden");
    if (pgHistologia) pgHistologia.classList.add("pt-14");
    c2.classList.remove("hidden");
  } else if (nivelDestino === 3) {
    if (pgHistologia) pgHistologia.classList.remove("pt-14");
    c3.classList.remove("hidden");
  }
}

// Inicialização imediata caso o state já tenha sido definido por rotas ou main.js
const estadoInicial = typeof getState === 'function' ? getState() : null;
if (estadoInicial && ['anatomia', 'histologia', 'patologia', 'parasitologia', 'microbiologia'].includes(estadoInicial.frenteAtiva)) {
  renderizarCatalogoHistologia(estadoInicial.frenteAtiva);
}

// Reativo: ao mudar a frente no state, se for do ciclo básico telescópico, atualiza o catálogo
subscribe((state) => {
  if (["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
    renderizarCatalogoHistologia(state.frenteAtiva);
  }
});

// Expõe métodos ao namespace global window.App
window.App = {
  ...window.App,
  renderizarCatalogoHistologia,
  renderizarCatalogoDisciplina: renderizarCatalogoHistologia,
  abrirTopico,
  abrirLamina,
  voltarNivel
};
