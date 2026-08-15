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
import { catalogData } from "./catalog-data.js?v=2026.0813";
import { getState, subscribe } from "./state.js";

let disciplinaAtual = "histologia";

function gerarIndiceLateral(modulo, topicoAtivoId) {
  let htmlItens = "";
  if (modulo && modulo.topicos) {
    modulo.topicos.forEach(topico => {
      const isAtivo = topico.id === topicoAtivoId;
      if (isAtivo) {
        htmlItens += `<button class="text-sky-700 font-semibold border-l-2 border-sky-600 pl-3 -ml-[25px] py-1 block w-full text-left">${topico.titulo}</button>`;
      } else {
        htmlItens += `<button onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')" class="text-slate-600 hover:text-slate-900 py-1 block transition-colors w-full text-left">${topico.titulo}</button>`;
      }
    });
  }

  const navItem = (id, label, icon) => {
    const isAtivo = disciplinaAtual === id;
    const btnClass = isAtivo 
      ? "text-sky-700 font-semibold py-1 block w-full text-left flex items-center gap-2"
      : "text-slate-600 hover:text-slate-900 py-1 block transition-colors w-full text-left flex items-center gap-2";
    return `
      <button onclick="window.App.selecionarFrente('${id}')" class="${btnClass}">
        ${icon}
        ${label}
      </button>
    `;
  };

  const mapNomenclatura = {
    histologia: "Tecidos Histológicos",
    anatomia: "Sistemas e Regiões",
    patologia: "Processos Patológicos",
    parasitologia: "Helmintos e Protozoários",
    microbiologia: "Bactérias e Fungos"
  };
  const tituloTopicos = mapNomenclatura[disciplinaAtual] || "Tópicos";

  return `
    <aside class="space-y-6 text-xs font-sans text-slate-600 border-r border-slate-200/80 pr-6 hidden md:block">
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-3 block">Módulos</span>
        ${navItem('histologia', 'Histologia Microscópica', '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>')}
        ${navItem('anatomia', 'Anatomia Macroscópica', '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>')}
        ${navItem('patologia', 'Patologia Geral', '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>')}
        ${navItem('parasitologia', 'Parasitologia Médica', '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>')}
        ${navItem('microbiologia', 'Microbiologia e Micologia', '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>')}
      </div>
      
      ${htmlItens ? `
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-3 block">${tituloTopicos}</span>
        ${htmlItens}
      </div>
      ` : ''}
    </aside>
  `;
}

/**
 * Renderiza o Nível 1 (#histoCatalog): Sumário Limpo de Cards Visuais
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

  let htmlCards = "";
  let htmlSubmenu = "";
  
  if (modulo.topicos && modulo.topicos.length > 0) {
    modulo.topicos.forEach((topico, index) => {
      htmlCards += `
        <div 
          onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')"
          class="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm hover:border-blue-500/40 hover:shadow-md transition-all cursor-pointer">
          <h3 class="font-serif text-lg text-slate-900 font-semibold">${topico.titulo}</h3>
        </div>
      `;
      
      htmlSubmenu += `
        <button onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')" class="text-left text-slate-500 hover:text-sky-600 hover:bg-sky-50 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors truncate w-full">
          ${topico.titulo}
        </button>
      `;
    });
  } else {
    htmlCards = `
      <div class="col-span-full py-16 flex flex-col items-center justify-center text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
        <svg class="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        <p class="text-slate-500 font-sans text-sm font-medium">Nenhuma lâmina ou peça cadastrada neste acervo ainda.</p>
        <p class="text-slate-400 text-xs mt-2">Utilize o Painel do Desenvolvedor para inserir os primeiros tópicos.</p>
      </div>
    `;
  }
  
  const submenuContainer = document.getElementById('sidebarSubmenu-histologia');
  if (submenuContainer) {
    submenuContainer.innerHTML = htmlSubmenu;
    // Expande o submenu na categoria ativa
    if (disciplinaAtual === 'histologia') {
      submenuContainer.classList.remove('hidden');
      submenuContainer.classList.add('flex');
    }
  }

  c1.innerHTML = `
    <div class="w-full px-6 sm:px-10 pt-4 md:pt-6 pb-16 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10">
      ${gerarIndiceLateral(modulo, null)}
      
      <div class="w-full">
        <div class="mb-6 md:mb-8">
          <!-- BREADCRUMBS -->
          <div class="flex items-center gap-2 text-xs md:text-sm font-sans text-slate-500 mb-2 flex-wrap">
            <a href="#" onclick="window.App.navegarPara('pgHome'); return false;" class="text-slate-600 hover:text-sky-700 hover:underline transition-colors">Início</a>
            <span class="text-slate-400 select-none">&rsaquo;</span>
            <span class="text-slate-900 font-semibold pointer-events-none">${modulo.tituloDisciplina}</span>
          </div>
          <h2 class="text-3xl font-serif font-semibold text-slate-900 mb-2">${modulo.tituloDisciplina}</h2>
          <p class="text-xs text-slate-500 font-sans tracking-wide">Bibliografia oficial: ${modulo.bibliografia}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${htmlCards}
        </div>
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

  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");
  const c3 = document.getElementById("histoMicroscope");

  if (c1) c1.classList.add("hidden");
  if (c2) c2.classList.remove("hidden");
  if (c3) c3.classList.add("hidden");

  // (O header global será mantido no topo da página)
  const minimalHeader = document.getElementById("palasMinimalHeader");

  // Remove o espaçamento de topo do conteiner principal para que o novo header encoste perfeitamente na janela
  const pgHistologia = document.getElementById("pgHistologia");
  if (pgHistologia) pgHistologia.classList.remove("pt-14");

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

  // Renderização 2 Colunas Limpas (Índice + Texto)
  c2.innerHTML = `
    <div class="w-full px-6 sm:px-10 pt-4 md:pt-6 pb-16 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10">
      ${gerarIndiceLateral(modulo, topico.id)}

      <div class="w-full">
      
        <!-- BREADCRUMBS -->
        <div class="flex items-center gap-2 text-xs md:text-sm font-sans text-slate-500 mb-2 flex-wrap">
          <a href="#" onclick="window.App.navegarPara('pgHome'); return false;" class="text-slate-600 hover:text-sky-700 hover:underline transition-colors">Início</a>
          <span class="text-slate-400 select-none">&rsaquo;</span>
          <a href="#" onclick="window.App.voltarNivel(1); return false;" class="text-slate-600 hover:text-sky-700 hover:underline transition-colors">${modulo.tituloDisciplina}</a>
          <span class="text-slate-400 select-none">&rsaquo;</span>
          <span class="text-slate-900 font-semibold pointer-events-none">${topico.titulo}</span>
        </div>

        <!-- TÍTULO DO TECIDO -->
        <h1 class="font-serif text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">
          ${topico.titulo}
        </h1>

        <!-- TEXTO EXPLICATIVO (UNBOXED EDITORIAL) -->
        <div class="text-slate-700 text-sm md:text-base leading-relaxed space-y-3 mb-6 prose-editor [&_strong]:font-semibold [&_strong]:text-slate-900 [&_b]:font-semibold [&_b]:text-slate-900">
          ${formatarResumoAcademico(topico.resumo)}
        </div>

        <!-- SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS -->
        <div class="mt-8 mb-4">
          <h2 class="text-xl font-serif font-bold text-slate-900 mb-6 border-b border-slate-200 pb-2">
            Lâminas de Microscopia Associadas
          </h2>
          <div id="gridCatalogoLaminas" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <p class="text-sm text-slate-500 col-span-full">Aguardando lâminas...</p>
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
            <div class="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-600 shadow-sm">
              <span class="text-xs font-mono text-slate-400 font-bold block uppercase tracking-wider mb-2">Sem Lâminas Ativas no Tópico</span>
              <h4 class="text-lg font-semibold text-slate-900 font-sans">Nenhuma lâmina matriz publicada para ${topico.titulo} no momento.</h4>
              <p class="text-xs text-slate-500 font-mono mt-2 max-w-lg mx-auto">Lâminas com status inativo não são listadas aqui. Acesse o Painel do Desenvolvedor para publicar peças neste módulo.</p>
              <button 
                type="button"
                onclick="window.App.selecionarFrente('dashboard')"
                class="mt-6 inline-block px-6 py-2.5 rounded-xl bg-slate-900 text-white font-mono font-semibold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer shadow">
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
          
          let thumbSrc = imagemUrl;
          let thumbSrcFallback = imagemUrl;
          if (imagemUrl.toLowerCase().endsWith(".dzi")) {
            const basePath = imagemUrl.substring(0, imagemUrl.lastIndexOf('.dzi'));
            thumbSrc = `${basePath}_files/8/0_0.jpg`;
            thumbSrcFallback = `${basePath}_files/8/0_0.jpeg`;
          }
          
          cardsLaminasHtml += `
            <a href="microscopio.html?id=${lamina.id}" class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:border-sky-500/40 hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col justify-between">
              <!-- Thumbnail da Imagem -->
              <div class="w-full h-48 bg-slate-100 relative overflow-hidden rounded-xl">
                <img src="${thumbSrc}" alt="${nomeLamina}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="if(this.src!=='${thumbSrcFallback}') { this.src='${thumbSrcFallback}'; } else { this.style.display='none'; }">
                <div class="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-sans">
                  ${coloracaoNome} - 40x
                </div>
              </div>
              <!-- Rodapé do Card -->
              <div class="mt-4">
                <h3 class="text-base font-serif font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight">${nomeLamina}</h3>
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
    if (minimalHeader) minimalHeader.classList.remove("hidden");
    if (pgHistologia) pgHistologia.classList.add("pt-14");
    c1.classList.remove("hidden");
    renderizarCatalogoHistologia(disciplinaAtual);
  } else if (nivelDestino === 2) {
    c2.classList.remove("hidden");
  } else if (nivelDestino === 3) {
    c3.classList.remove("hidden");
  }
}

// Reativo: ao mudar a frente no state, se for do ciclo básico telescópico, atualiza o catálogo
subscribe((state) => {
  if (["anatomia", "histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
    renderizarCatalogoHistologia(state.frenteAtiva);
  }
});

// Expõe métodos ao namespace global window.App e inicializa na carga
window.App = {
  ...window.App,
  renderizarCatalogoHistologia,
  renderizarCatalogoDisciplina: renderizarCatalogoHistologia,
  abrirTopico,
  abrirLamina,
  voltarNivel
};

document.addEventListener("DOMContentLoaded", () => {
  renderizarCatalogoHistologia("histologia");
});
