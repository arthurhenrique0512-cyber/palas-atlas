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
import { getState, subscribe, setFrenteAtiva } from "./state.js";

let disciplinaAtual = "histologia";

function gerarIndiceLateral(modulo, topicoAtivoId, exibirSubtopicos = false) {
  let htmlItens = "";
  if (exibirSubtopicos && modulo && modulo.topicos) {
    modulo.topicos.forEach((topico) => {
      const isAtivo = topico.id === topicoAtivoId;
      if (isAtivo) {
        htmlItens += `
          <button
            type="button"
            class="bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white font-semibold px-3 py-2 rounded-none w-full text-left leading-snug break-words text-xs border-l-2 border-slate-900 dark:border-[#d4af37] transition-colors"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      } else {
        htmlItens += `
          <button
            type="button"
            onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')"
            class="text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04] px-3 py-2 rounded-none transition-colors w-full text-left leading-snug break-words text-xs cursor-pointer border-l-2 border-transparent"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      }
    });
  }

  const navItem = (id, label, dotClass) => {
    const isAtivo = disciplinaAtual === id;
    const btnClass = isAtivo
      ? "bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white font-semibold px-3 py-2 rounded-none w-full text-left flex items-center gap-2.5 border-l-2 border-slate-900 dark:border-[#d4af37] transition-colors"
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04] px-3 py-2 rounded-none transition-colors w-full text-left flex items-center gap-2.5 border-l-2 border-transparent cursor-pointer";
    return `
      <button type="button" onclick="window.App.selecionarFrente('${id}')" class="${btnClass}">
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
    <aside class="space-y-6 text-xs font-sans text-slate-600 dark:text-zinc-400 border-r border-slate-200/80 dark:border-white/10 pr-6 hidden md:block">
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-semibold mb-2.5 block">Disciplinas</span>
        <div class="space-y-1">
          ${navItem('histologia', 'Histologia', 'bg-sky-600')}
          ${navItem('patologia', 'Patologia', 'bg-rose-600')}
          ${navItem('parasitologia', 'Parasitologia', 'bg-emerald-600')}
          ${navItem('microbiologia', 'Microbiologia', 'bg-violet-600')}
        </div>
      </div>
      
      ${htmlItens ? `
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-semibold mb-2.5 block">${tituloTopicos}</span>
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
    { id: "histologia", label: "Histologia", dot: "bg-sky-600", activeBorder: "border-slate-900 dark:border-[#d4af37] text-slate-950 dark:text-white bg-slate-100 dark:bg-white/10" },
    { id: "patologia", label: "Patologia", dot: "bg-rose-600", activeBorder: "border-rose-600 text-rose-800 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/30" },
    { id: "parasitologia", label: "Parasitologia", dot: "bg-emerald-600", activeBorder: "border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30" },
    { id: "microbiologia", label: "Microbiologia", dot: "bg-violet-600", activeBorder: "border-violet-600 text-violet-800 dark:text-violet-300 bg-violet-50/70 dark:bg-violet-950/30" }
  ];

  const chipsHtml = lista.map((item) => {
    const isAtivo = disciplinaAtual === item.id;
    const classes = isAtivo
      ? `${item.activeBorder} font-semibold shadow-2xs`
      : "bg-white dark:bg-[#101013] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200/90 dark:border-white/10";
    return `
      <button
        type="button"
        onclick="window.App.selecionarFrente('${item.id}')"
        class="shrink-0 flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-none text-xs font-sans transition-all border cursor-pointer whitespace-nowrap ${classes}">
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
          <span class="w-9 h-9 rounded-none bg-slate-50 border border-slate-200/80 group-hover:border-sky-600 group-hover:bg-sky-600 flex items-center justify-center text-slate-400 group-hover:text-white shrink-0 transition-all group-hover:translate-x-0.5">
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
      <div class="bg-white rounded-none border border-slate-200/90 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.06)] divide-y divide-slate-200/80 overflow-hidden">
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
  const disc = disciplina || disciplinaAtual || "histologia";
  disciplinaAtual = disc;
  const modulo = catalogData[disc] || catalogData.histologia;
  const topico = modulo.topicos.find((t) => t.id === idTopico);
  if (!topico) return;
  
  if (!skipHistory) {
    history.pushState({ frente: disc, nivel: 2, topico: idTopico }, "", `?frente=${disc}&topico=${idTopico}`);
  }

  // Notifica o gerenciador de estado para sincronizar o cabeçalho e roteador
  setFrenteAtiva(disc);

  // Rola suavemente para o topo absoluto da página
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const pgHome = document.getElementById("pgHome");
  const pgHistologia = document.getElementById("pgHistologia");
  if (pgHome) pgHome.classList.add("hidden");
  if (pgHistologia) {
    pgHistologia.classList.remove("hidden");
    pgHistologia.classList.add("pt-14");
  }

  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (c1) c1.classList.add("hidden");
  if (c2) c2.classList.remove("hidden");
  if (c3) c3.classList.add("hidden");

  // Garante que o header global e o espaçamento adequado sob ele permaneçam ativos
  const minimalHeader = document.getElementById("palasMinimalHeader");
  if (minimalHeader) minimalHeader.classList.remove("hidden");

  // Limpeza de resquícios de armazenamento local para garantir pureza de dados via Cloud Firestore
  try {
    localStorage.removeItem("palas_atlas_custom_slides");
  } catch (errLimpeza) {
    console.warn("Aviso ao limpar cache local de lâminas:", errLimpeza);
  }

  // Parser Simples para Parágrafos
  const formatarResumoAcademico = (texto) => {
    if (!texto) return "<p>Sem conteúdo disponível.</p>";
    if (texto.includes("<p>") || texto.includes("<strong>") || texto.includes("<div")) return texto;
    const sentencas = texto.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0);
    if (sentencas.length === 0) return `<p>${texto}</p>`;
    
    let html = "";
    for (let i = 0; i < sentencas.length; i++) {
      const s = sentencas[i].trim();
      if (s) {
        html += `<p>${s}${s.endsWith('.') ? '' : '.'}</p>`;
      }
    }
    return html;
  };

  // Renderização 2 Colunas Limpas (Índice + Texto) alinhada ao max-w-7xl
  c2.innerHTML = `
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 pb-16 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 md:gap-10">
      ${gerarIndiceLateral(modulo, topico.id, true)}

      <div class="w-full min-w-0">
        <!-- SELETOR HORIZONTAL DE DISCIPLINAS (MOBILE & TABLET: md:hidden) -->
        <div class="md:hidden">
          ${gerarBarraDisciplinasTopo()}
        </div>
      
        <!-- BREADCRUMBS -->
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-400 dark:text-zinc-500 mb-2.5 flex-wrap">
          <a href="#" onclick="window.App.goHome(); return false;" class="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-[#d4af37] transition-colors no-underline">Início</a>
          <span class="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
          <a href="#" onclick="window.App.voltarParaDisciplinaHome('${disc}'); return false;" class="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-[#d4af37] transition-colors no-underline">${modulo.tituloDisciplina}</a>
          <span class="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
          <span class="text-slate-900 dark:text-white font-semibold pointer-events-none">${topico.titulo}</span>
        </nav>

        <!-- TÍTULO DO TECIDO -->
        <h1 class="font-serif text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
          ${topico.titulo}
        </h1>

        <!-- CAIXA DE TEXTO PRINCIPAL (LIMPA, SEM DETALHES OU ENFEITES) -->
        <div class="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 mb-8 text-slate-600 dark:text-zinc-300 text-sm md:text-base leading-relaxed space-y-3 break-words [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_b]:font-semibold [&_b]:text-slate-900 dark:[&_b]:text-white">
          ${formatarResumoAcademico(topico.resumo)}
        </div>

        <!-- SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS -->
        <div class="mt-8 mb-4">
          <h2 class="text-xl font-serif font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-200/80 dark:border-white/10 pb-3">
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
        const mapaLaminas = new Map();

        // Incorpora lâminas estáticas base deste tópico primeiro
        if (topico && Array.isArray(topico.laminas)) {
          topico.laminas.forEach((lam) => {
            mapaLaminas.set(lam.id, { ...lam });
          });
        }

        snapshot.forEach((doc) => {
          const data = doc.data();
          const topicoL = (data.topico || "").toLowerCase().trim();
          const targetId = idTopico.toLowerCase().trim();
          const targetTitulo = topico.titulo.toLowerCase().trim();

          if (topicoL === targetId || topicoL === targetTitulo || topicoL.includes(targetId) || (!data.topico && targetId === modulo.topicos[0].id)) {
            mapaLaminas.set(doc.id, { id: doc.id, ...data });
          }
        });

        laminasDoTopico = Array.from(mapaLaminas.values());

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
          const imagemUrl = lamina.imagemUrl || lamina.imageUrl || lamina.caminhoImagemBase || lamina.dziUrl || "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi";

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
              thumbSrcFallback = "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
            }
          }

          cardsLaminasHtml += `
            <a href="microscopio.html?id=${lamina.id}" class="relative h-72 sm:h-80 rounded-none overflow-hidden border border-slate-200/90 dark:border-white/10 shadow-[0_14px_34px_-8px_rgba(0,0,0,0.12)] hover:shadow-[0_24px_50px_-8px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 group cursor-pointer flex flex-col justify-between p-5 sm:p-6 bg-[#060608] no-underline">
              <!-- Placeholder exibido quando a imagem falha -->
              <div class="thumb-placeholder absolute inset-0 flex-col items-center justify-center gap-1 hidden bg-[#060608]">
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
              <!-- Gradiente Escuro Neutro na Base (Zero Tonalidade Azulada) -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none"></div>

              <!-- Topo: Badge de Coloração -->
              <div class="relative z-10 flex items-center justify-between">
                <span class="bg-black/70 border border-white/15 text-white text-[11px] px-3.5 py-1 rounded-full backdrop-blur-md font-sans font-semibold tracking-wider shadow-sm">
                  ${coloracaoNome} &bull; 40x
                </span>
              </div>

              <!-- Base: Título e Seta Sobrepostos -->
              <div class="relative z-10 flex items-end justify-between gap-3">
                <h3 class="text-lg sm:text-xl font-serif font-bold text-white group-hover:text-[#d4af37] transition-colors leading-tight drop-shadow-sm">${nomeLamina}</h3>
                <span class="shrink-0 w-9 h-9 rounded-none bg-white/15 backdrop-blur-md border border-white/25 group-hover:bg-[#d4af37] group-hover:text-black group-hover:border-[#d4af37] flex items-center justify-center text-white transition-all duration-300">
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
 * @param {number} nivelDestino - 1 para Início com Accordion da Disciplina, 2 para Gaveta Teórica, 3 para Microscópio.
 */
function voltarNivel(nivelDestino) {
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (!c2 || !c3) return;

  const minimalHeader = document.getElementById("palasMinimalHeader");
  const pgHistologia = document.getElementById("pgHistologia");

  if (nivelDestino === 1) {
    voltarParaDisciplinaHome(disciplinaAtual);
  } else if (nivelDestino === 2) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (minimalHeader) minimalHeader.classList.remove("hidden");
    if (pgHistologia) pgHistologia.classList.add("pt-14");
    if (c1) c1.classList.add("hidden");
    c2.classList.remove("hidden");
    c3.classList.add("hidden");
  } else if (nivelDestino === 3) {
    if (pgHistologia) pgHistologia.classList.remove("pt-14");
    if (c1) c1.classList.add("hidden");
    c2.classList.add("hidden");
    c3.classList.remove("hidden");
  }
}

/**
 * Alterna a exibição do accordion na Home para uma disciplina.
 * Elimina completamente a página intermediária.
 */
function toggleAccordionDisciplinas(disciplina = 'histologia') {
  const containerHisto = document.getElementById('accordionContainerHistologia');
  const btnTxtHisto = document.getElementById('btnTxtHistologia');
  const arrowIconHisto = document.getElementById('arrowIconHistologia');

  const containerOutras = document.getElementById('accordionContainerOutras');
  const tituloOutras = document.getElementById('tituloAccordionOutras');
  const refOutras = document.getElementById('refAccordionOutras');
  const listaOutras = document.getElementById('listaAccordionOutras');

  if (disciplina === 'histologia') {
    if (!containerHisto) return;
    const isHidden = containerHisto.classList.contains('hidden');
    if (containerOutras) containerOutras.classList.add('hidden');

    if (isHidden) {
      containerHisto.classList.remove('hidden');
      if (btnTxtHisto) btnTxtHisto.textContent = 'Recolher';
      if (arrowIconHisto) arrowIconHisto.classList.add('rotate-180');
      setTimeout(() => {
        containerHisto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } else {
      containerHisto.classList.add('hidden');
      if (btnTxtHisto) btnTxtHisto.textContent = 'Explorar';
      if (arrowIconHisto) arrowIconHisto.classList.remove('rotate-180');
    }
  } else {
    // Patologia, Parasitologia, Microbiologia
    if (!containerOutras) return;
    if (containerHisto) {
      containerHisto.classList.add('hidden');
      if (btnTxtHisto) btnTxtHisto.textContent = 'Explorar';
      if (arrowIconHisto) arrowIconHisto.classList.remove('rotate-180');
    }

    const estaAbertoMesma = !containerOutras.classList.contains('hidden') && containerOutras.dataset.disciplinaAtiva === disciplina;

    if (estaAbertoMesma) {
      containerOutras.classList.add('hidden');
      containerOutras.dataset.disciplinaAtiva = '';
    } else {
      containerOutras.dataset.disciplinaAtiva = disciplina;
      containerOutras.classList.remove('hidden');

      if (disciplina === 'patologia') {
        if (tituloOutras) tituloOutras.textContent = 'Patologia Geral (4 Processos Fundamentais)';
        if (refOutras) refOutras.innerHTML = '<span class="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Referência:</span> Robbins &amp; Cotran';
        if (listaOutras) {
          listaOutras.innerHTML = `
            <div onclick="window.App.abrirTopico('lesao_celular', 'patologia')" class="accordion-item-row px-5 sm:px-8 py-4 sm:py-4.5 cursor-pointer flex items-center justify-between gap-4 group">
              <div class="flex items-center gap-4 sm:gap-6 min-w-0">
                <span class="accordion-num text-xs sm:text-sm select-none !text-rose-600 dark:!text-rose-400">01</span>
                <span class="accordion-sep shrink-0"></span>
                <h3 class="accordion-title font-serif text-base sm:text-lg font-bold tracking-[-0.015em] leading-snug">Lesão, Adaptação e Morte Celular (Necroses e Apoptose)</h3>
              </div>
              <span class="accordion-action-btn rounded-none shadow-2xs group-hover:!bg-rose-600 group-hover:!border-rose-600 group-hover:!text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </span>
            </div>
            <div onclick="window.App.abrirTopico('inflamacao_reparo', 'patologia')" class="accordion-item-row px-5 sm:px-8 py-4 sm:py-4.5 cursor-pointer flex items-center justify-between gap-4 group">
              <div class="flex items-center gap-4 sm:gap-6 min-w-0">
                <span class="accordion-num text-xs sm:text-sm select-none !text-rose-600 dark:!text-rose-400">02</span>
                <span class="accordion-sep shrink-0"></span>
                <h3 class="accordion-title font-serif text-base sm:text-lg font-bold tracking-[-0.015em] leading-snug">Inflamação Aguda, Crônica e Reparo Tecidual</h3>
              </div>
              <span class="accordion-action-btn rounded-none shadow-2xs group-hover:!bg-rose-600 group-hover:!border-rose-600 group-hover:!text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </span>
            </div>
            <div onclick="window.App.abrirTopico('disturbios_hemodinamicos', 'patologia')" class="accordion-item-row px-5 sm:px-8 py-4 sm:py-4.5 cursor-pointer flex items-center justify-between gap-4 group">
              <div class="flex items-center gap-4 sm:gap-6 min-w-0">
                <span class="accordion-num text-xs sm:text-sm select-none !text-rose-600 dark:!text-rose-400">03</span>
                <span class="accordion-sep shrink-0"></span>
                <h3 class="accordion-title font-serif text-base sm:text-lg font-bold tracking-[-0.015em] leading-snug">Distúrbios Hemodinâmicos (Trombose, Embolia, Infarto e Edema)</h3>
              </div>
              <span class="accordion-action-btn rounded-none shadow-2xs group-hover:!bg-rose-600 group-hover:!border-rose-600 group-hover:!text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </span>
            </div>
            <div onclick="window.App.abrirTopico('neoplasias', 'patologia')" class="accordion-item-row px-5 sm:px-8 py-4 sm:py-4.5 cursor-pointer flex items-center justify-between gap-4 group">
              <div class="flex items-center gap-4 sm:gap-6 min-w-0">
                <span class="accordion-num text-xs sm:text-sm select-none !text-rose-600 dark:!text-rose-400">04</span>
                <span class="accordion-sep shrink-0"></span>
                <h3 class="accordion-title font-serif text-base sm:text-lg font-bold tracking-[-0.015em] leading-snug">Neoplasias Benignas e Malignas</h3>
              </div>
              <span class="accordion-action-btn rounded-none shadow-2xs group-hover:!bg-rose-600 group-hover:!border-rose-600 group-hover:!text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </span>
            </div>
          `;
        }
      } else if (disciplina === 'parasitologia') {
        if (tituloOutras) tituloOutras.textContent = 'Parasitologia Humana';
        if (refOutras) refOutras.innerHTML = '<span class="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Referência:</span> David Pereira Neves';
        if (listaOutras) {
          listaOutras.innerHTML = `
            <div class="py-12 px-6 text-center">
              <span class="w-10 h-10 rounded-none bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
              <h4 class="font-serif text-lg font-bold text-slate-900 mb-1">Acervo em Digitalização</h4>
              <p class="text-xs sm:text-sm text-slate-500 font-sans max-w-md mx-auto">Lâminas de protozoários e helmintos de interesse médico em preparação no laboratório.</p>
            </div>
          `;
        }
      } else if (disciplina === 'microbiologia') {
        if (tituloOutras) tituloOutras.textContent = 'Microbiologia Médica';
        if (refOutras) refOutras.innerHTML = '<span class="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Referência:</span> Patrick R. Murray';
        if (listaOutras) {
          listaOutras.innerHTML = `
            <div class="py-12 px-6 text-center">
              <span class="w-10 h-10 rounded-none bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
              <h4 class="font-serif text-lg font-bold text-slate-900 mb-1">Acervo em Digitalização</h4>
              <p class="text-xs sm:text-sm text-slate-500 font-sans max-w-md mx-auto">Culturas bacterianas, coloração de Gram e estruturas fúngicas em preparação no laboratório.</p>
            </div>
          `;
        }
      }

      setTimeout(() => {
        containerOutras.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }
}

function fecharAccordionOutras() {
  const containerOutras = document.getElementById('accordionContainerOutras');
  if (containerOutras) {
    containerOutras.classList.add('hidden');
    containerOutras.dataset.disciplinaAtiva = '';
  }
}

function abrirAccordionHero(disciplina = 'histologia') {
  const secao = document.getElementById('secaoDisciplinas');
  if (disciplina === 'histologia') {
    const containerHisto = document.getElementById('accordionContainerHistologia');
    const btnTxtHisto = document.getElementById('btnTxtHistologia');
    const arrowIconHisto = document.getElementById('arrowIconHistologia');
    if (containerHisto) {
      containerHisto.classList.remove('hidden');
      if (btnTxtHisto) btnTxtHisto.textContent = 'Recolher';
      if (arrowIconHisto) arrowIconHisto.classList.add('rotate-180');
    }
  } else {
    toggleAccordionDisciplinas(disciplina);
  }

  if (secao) {
    secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function abrirDisciplinaHome(disciplina = 'histologia') {
  if (window.App && typeof window.App.goHome === 'function') {
    window.App.goHome();
  }
  setTimeout(() => {
    abrirAccordionHero(disciplina);
  }, 100);
}

function voltarParaDisciplinaHome(disciplina = 'histologia') {
  abrirDisciplinaHome(disciplina);
}

// Inicialização imediata caso o state já tenha sido definido por rotas ou main.js
const estadoInicial = typeof getState === 'function' ? getState() : null;
if (estadoInicial && ['anatomia', 'histologia', 'patologia', 'parasitologia', 'microbiologia'].includes(estadoInicial.frenteAtiva)) {
  const urlParams = new URLSearchParams(window.location.search);
  const topicoParam = urlParams.get('topico');
  if (topicoParam) {
    abrirTopico(topicoParam, estadoInicial.frenteAtiva);
  }
}

// Reativo: se frente mudar no state
subscribe((state) => {
  if (["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
    const c2 = document.getElementById("histoSubCatalog");
    const isTopicOpen = c2 && !c2.classList.contains("hidden");
    if (!isTopicOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const topicoParam = urlParams.get('topico');
      if (topicoParam) {
        abrirTopico(topicoParam, state.frenteAtiva);
      }
    }
  }
});

// Expõe métodos ao namespace global window.App
window.App = {
  ...window.App,
  renderizarCatalogoHistologia,
  renderizarCatalogoDisciplina: renderizarCatalogoHistologia,
  abrirTopico,
  abrirLamina,
  voltarNivel,
  toggleAccordionDisciplinas,
  abrirAccordionHero,
  abrirDisciplinaHome,
  voltarParaDisciplinaHome,
  fecharAccordionOutras
};
