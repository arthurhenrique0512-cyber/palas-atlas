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
            class="bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 font-semibold border-l-2 border-teal-700 pl-3 py-1.5 w-full text-left leading-snug break-words text-xs block transition-colors"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      } else {
        htmlItens += `
          <button
            type="button"
            onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')"
            class="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04] py-1.5 px-3 block transition-colors w-full text-left leading-snug break-words cursor-pointer border-l-2 border-transparent"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      }
    });
  }

  const navItem = (id, label, dotClass) => {
    const isAtivo = disciplinaAtual === id;
    const btnClass = isAtivo
      ? "bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 font-semibold border-l-2 border-teal-700 pl-3 py-1.5 w-full text-left flex items-center gap-2.5 transition-colors"
      : "text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.04] py-1.5 px-3 block transition-colors w-full text-left flex items-center gap-2.5 border-l-2 border-transparent cursor-pointer";
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

  /**
   * Constrói o Card de Resumo Morfológico Acadêmico
   * Estrutura clássica de ensino histológico: Definição, Componentes da Matriz, Células Principais e Subtipos/Classificação Funcional.
   */
  const gerarCardResumoMorfológico = (topicoItem, moduloItem) => {
    const sinteseCurada = {
      osseo: [
        {
          label: "Definição",
          desc: "Tecido conjuntivo especializado e mineralizado, principal constituinte do esqueleto adulto. Fornece suporte mecânico aos tecidos moles, alavanca para locomoção, proteção a órgãos vitais e atua como a principal reserva corporal de íons cálcio e fosfato."
        },
        {
          label: "Componentes da Matriz",
          desc: "Matriz óssea calcificada composta por porção orgânica (cerca de 95% de colágeno tipo I associado a proteoglicanos e glicoproteínas como osteonectina e osteocalcina) e porção inorgânica (cristais de hidroxiapatita de fosfato de cálcio depositados ordenadamente sobre as fibrilas colágenas)."
        },
        {
          label: "Células Principais",
          desc: "Osteoblastos (células jovens da superfície responsáveis pela síntese e mineralização do osteoide), osteócitos (células maduras residentes em lacunas, conectadas por canalículos para trocas metabólicas) e osteoclastos (células gigantes multinucleadas especializadas na reabsorção óssea enzimática)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Ósseo Compacto (cortical densa sem cavidades visíveis, organizada em Sistemas de Havers ou ósteons concêntricos e canais vasculares de Volkmann) e Ósseo Esponjoso (rede tridimensional de trabéculas ósseas que delimitam cavidades intercomunicantes preenchidas por medula óssea hematopoiética ou adiposa)."
        }
      ],
      conjuntivo: [
        {
          label: "Definição",
          desc: "Tecido de origem mesodérmica amplamente distribuído pelo organismo, responsável pela sustentação estrutural, conexão entre diferentes tecidos, preenchimento de espaços, isolamento de órgãos, via de trânsito vascular e defesa imunológica contra patógenos."
        },
        {
          label: "Componentes da Matriz",
          desc: "Abundante matriz extracelular (MEC) constituída por Substância Fundamental Amorfa (gel aquoso viscoso rico em ácido hialurônico, glicosaminoglicanos sulfatados e proteoglicanos) e Fibras Estruturais (fibras colágenas tipo I e III de alta resistência à tração, fibras elásticas flexíveis e fibras reticulares de sustentação estromal)."
        },
        {
          label: "Células Principais",
          desc: "Células residentes (fibroblastos ativamente secretores de matriz, fibrócitos fusiformes quiescentes, macrófagos fagocitários residentes e mastócitos granulosos ricos em histamina e heparina) e células transitórias de defesa (plasmócitos produtores de anticorpos, linfócitos, neutrófilos e eosinófilos)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Conjuntivo Frouxo (distribuição equilibrada e delicada entre células, fibras finas e substância amorfa; altamente flexível e vascularizado, suporta epitélios e envolve vasos) e Conjuntivo Denso (predomínio expressivo de feixes espessos de colágeno tipo I; divide-se em Denso Não Modelado, com feixes entrelaçados na derme profunda e cápsulas de órgãos, e Denso Modelado, com feixes rigorosamente paralelos em tendões e ligamentos)."
        }
      ],
      epitelial: [
        {
          label: "Definição",
          desc: "Tecido avascular composto por células contíguas intimamente unidas por complexos juncionais, com escassa substância intercelular. Recobre superfícies externas (pele), reveste cavidades corpóreas internas (mucosas e serosas) e forma o parênquima das glândulas secretoras."
        },
        {
          label: "Componentes da Matriz",
          desc: "Praticamente ausente no espaço intercelular. O epitélio repousa invariavelmente sobre uma lâmina basal acelular (rede de colágeno tipo IV, laminina, entactina e perlecan) que o ancora ao conjuntivo subjacente e através da qual difusamente chegam gases e nutrientes."
        },
        {
          label: "Células Principais",
          desc: "Células poliédricas com evidente polaridade morfológica e funcional: polo apical (voltado para a luz ou superfície, frequentemente dotado de microvilosidades ou cílios), polos laterais (unidos por zônulas de oclusão, zônulas de adesão e desmossomos) e polo basal (ancorado por hemidesmossomos)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Epitélios de Revestimento (simples pavimentoso, simples cúbico, simples prismático, estratificado pavimentoso queratinizado ou não queratinizado, pseudoestratificado colunar ciliado e de transição/urotélio) e Epitélios Glandulares (exócrinos acinares, tubulares ou alveolares dotados de ductos; e endócrinos cordonais ou vesiculares desprovidos de ductos com secreção hematogênica)."
        }
      ],
      adiposo: [
        {
          label: "Definição",
          desc: "Variedade especializada de tecido conjuntivo no qual predominam células adiposas (adipócitos). Constitui o principal reservatório energético do corpo na forma de triglicerídeos neutros, além de atuar no isolamento térmico, proteção mecânica e como órgão endócrino ativo (produtor de leptina e adipocinas)."
        },
        {
          label: "Componentes da Matriz",
          desc: "Matriz escassa envolvida por uma delicada trama de fibras reticulares (colágeno tipo III) que contorna individualmente cada célula, acompanhada por uma densa malha de capilares contínuos que supre as elevadas demandas metabólicas de lipólise e lipogênese."
        },
        {
          label: "Células Principais",
          desc: "Adipócitos uniloculares (células esféricas grandes com gota lipídica única que ocupa quase todo o citoplasma e desloca o núcleo para a periferia) e adipócitos multiloculares (células menores, poligonais, com núcleo central esférico e numerosas gotículas lipídicas associadas a mitocôndrias ricas em citocromos)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Tecido Adiposo Unilocular / Branco (mais abundante, responsável pela estocagem de lipídios em adultos, modelagem corporal e secreção de adiponectina) e Tecido Adiposo Multilocular / Marrom (presente sobretudo no feto e recém-nascido, especializado na termogênese sem tremor via proteína desacopladora UCP-1 / termogenina)."
        }
      ],
      cartilaginoso: [
        {
          label: "Definição",
          desc: "Forma especializada de tecido conjuntivo de suporte com consistência rígida e firme, dotada de notável elasticidade mecânica. É avascular, desprovido de vasos linfáticos e nervos, dependendo integralmente da difusão de nutrientes a partir do tecido conjuntivo vascularizado adjacente (pericôndrio)."
        },
        {
          label: "Componentes da Matriz",
          desc: "Matriz extracelular altamente hidratada (cerca de 75% de água ligada a proteoglicanos com cadeias de condroitim-sulfato e queratam-sulfato associadas a ácido hialurônico / agrecano) entremeada por fibras de colágeno tipo II ou fibras elásticas que suportam forças intensas de compressão."
        },
        {
          label: "Células Principais",
          desc: "Condroblastos (células basofílicas jovens da camada condrogênica do pericôndrio, com intensa atividade de secreção de matriz) e condrócitos (células arredondadas maduras alojadas em cavidades da matriz denominadas lacunas, isoladas ou dispostas em grupos isógenos coronários ou axiais)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Cartilagem Hialina (mais comum, matriz vítrea com colágeno tipo II; fossas nasais, laringe, anéis traqueais e superfícies articulares), Cartilagem Elástica (semelhante à hialina, porém acrescida de densa rede de fibras elásticas; epiglote e pavilhão auditivo) e Fibrocartilagem (sem pericôndrio, com feixes densos de colágeno tipo I; discos intervertebrais, meniscos e sínfise púbica)."
        }
      ],
      muscular: [
        {
          label: "Definição",
          desc: "Tecido composto por células alongadas de origem mesodérmica (fibras musculares ou miócitos) especializadas na contratilidade ativa e na geração de força de tração através da transformação de energia química (ATP) em movimento mecânico corporal ou visceral."
        },
        {
          label: "Componentes da Matriz",
          desc: "Bainhas conjuntas organizadas em camadas concêntricas que transmitem a contração aos tendões e osso: Endomísio (fina lâmina de fibras reticulares contornando cada miócito individual), Perimísio (feixes colágenos que agrupam fascículos musculares) e Epimísio (cápsula externa de conjuntivo denso que recobre o músculo inteiro)."
        },
        {
          label: "Células Principais",
          desc: "Miócitos cujo citoplasma (sarcoplasma) é preenchido longitudinalmente por miofilamentos finos de actina associada a troponina e tropomiosina, e filamentos grossos de miosina, regulados por ciclos intracelulares de liberação e recaptação de cálcio pelo retículo sarcoplasmático."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Estriado Esquelético (fibras cilíndricas muito longas, multinucleadas com núcleos estritamente periféricos; controle voluntário e contração rápida), Estriado Cardíaco (células ramificadas mononucleadas com núcleos centrais, unidas transversalmente por discos intercalares com desmossomos e junções comunicantes; contração involuntária e vigorosa) e Muscular Liso (células fusiformes uninucleadas centrais sem sarcômeros transversais; contração lenta, sustentada e involuntária em vísceras e vasos sanguíneos)."
        }
      ],
      nervoso: [
        {
          label: "Definição",
          desc: "Tecido com altíssima especialização funcional voltado para a percepção de estímulos do meio externo e interno, integração e processamento de informações neurais e deflagração de impulsos elétricos para efetores musculares ou glandulares."
        },
        {
          label: "Componentes da Matriz",
          desc: "Praticamente destituído de matriz extracelular conjuntiva clássica (salvo em meninges e bainhas periféricas); a sustentação física, isolamento elétrico e regulação iônica e nutricional são executados pelo neurópilo (trama interdigitada contínua de axônios, dendritos e processos citoplasmáticos da neuroglia)."
        },
        {
          label: "Células Principais",
          desc: "Neurônios (unidades funcionais excitáveis formadas por corpo celular/soma rico em corpúsculos de Nissl, dendritos ramificados receptores de estímulos e um único axônio condutor de potenciais de ação) e Células da Glia (astrócitos de suporte e barreira hematoencefálica, oligodendrócitos mielinizantes centrais, micróglia de fagocitose imunológica e células ependimárias de revestimento ventricular)."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Sistema Nervoso Central / SNC (estruturado em Substância Cinzenta, onde residem os corpos neuronais, sinapses e neurópilo, e Substância Branca, formada por tratos de fibras axonais mielinizadas) e Sistema Nervoso Periférico / SNP (nervos periféricos revestidos por endoneuro, perineuro e epineuro, gânglios sensitivos e motores com células satélites, e células de Schwann mielinizantes)."
        }
      ],
      circulatorio: [
        {
          label: "Definição",
          desc: "Circuito tubular fechado e contínuo responsável por impulsionar e conduzir sangue e linfa por todos os tecidos do corpo humano, viabilizando o transporte de gases respiratórios (oxigênio e gás carbônico), nutrientes, hormônios, mediadores químicos e elementos celulares de defesa."
        },
        {
          label: "Componentes da Matriz",
          desc: "Lâmina basal subendotelial contínua ou descontínua associada a lâminas elásticas concêntricas (interna e externa) e estroma conjuntivo perivascular (túnica adventícia rica em colágeno tipo I, fibras elásticas, fibroblastos e vasa vasorum)."
        },
        {
          label: "Células Principais",
          desc: "Células endoteliais poligonais pavimentosas (monocamada com permeabilidade seletiva que sintetiza óxido nítrico, endotelina, prostaciclina e expressa moléculas de adesão leucocitária), pericitos (células contráteis pericapilares com potencial regenerativo) e células musculares lisas da túnica média reguladoras do diâmetro luminal e resistência vascular periférica."
        },
        {
          label: "Subtipos e Classificação",
          desc: "Artérias (elásticas de condução com paredes amortecedoras de pulso e musculares de distribuição), Microcirculação (arteríolas reguladoras de resistência pré-capilar; capilares contínuos sem fenestras, fenestrados com poros filtrantes e sinusoides de trajeto tortuoso com amplas fendas; e vênulas pós-capilares) e Veias (vasos de capacitância dotados de túnica adventícia espessa e válvulas intraluminais que impedem o refluxo centrífugo)."
        }
      ]
    };

    let pontos = [];
    if (topicoItem.pontosChave && Array.isArray(topicoItem.pontosChave)) {
      pontos = topicoItem.pontosChave;
    } else if (sinteseCurada[topicoItem.id]) {
      pontos = sinteseCurada[topicoItem.id];
    } else {
      // Parser automático de contingência estruturado em 4 pontos para tópicos dinâmicos
      const texto = (topicoItem.resumo || "").replace(/<[^>]*>/g, " ").trim();
      if (texto) {
        const frases = texto.split(/(?<=\.)\s+/).filter(f => f.trim().length > 15);
        if (frases.length >= 4) {
          pontos = [
            { label: "Definição", desc: frases[0] },
            { label: "Componentes da Matriz", desc: frases[1] },
            { label: "Células Principais", desc: frases[2] },
            { label: "Subtipos e Classificação", desc: frases.slice(3).join(" ") }
          ];
        } else if (frases.length >= 3) {
          pontos = [
            { label: "Definição", desc: frases[0] },
            { label: "Componentes da Matriz", desc: frases[1] },
            { label: "Células e Classificação", desc: frases.slice(2).join(" ") }
          ];
        } else if (frases.length > 0) {
          pontos = frases.map((f, i) => ({
            label: i === 0 ? "Definição" : (i === 1 ? "Componentes Principais" : "Classificação Funcional"),
            desc: f
          }));
        }
      }
    }

    if (pontos.length === 0) {
      pontos = [
        { label: "Definição", desc: "Corte histológico preparado para análise microscópica em alta resolução." },
        { label: "Critérios Morfológicos", desc: "Consulte as lâminas de microscopia abaixo para identificação detalhada das estruturas diagnósticas deste corte." }
      ];
    }

    const itensHtml = pontos.map(p => `
      <li class="flex items-start gap-3 leading-relaxed">
        <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 shrink-0"></span>
        <div class="text-xs sm:text-sm">
          <strong class="font-semibold text-slate-950 dark:text-white">${p.label}:</strong>
          <span class="text-slate-600 dark:text-zinc-300 ml-1">${p.desc}</span>
        </div>
      </li>
    `).join("");

    return `
      <div class="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-[0_4px_20px_rgb(15,23,42,0.03)] mb-8">
        <div class="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-white/5">
          <span class="w-1.5 h-4 rounded-full bg-teal-700"></span>
          <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Resumo Morfológico</h2>
        </div>
        <ul class="space-y-3.5">
          ${itensHtml}
        </ul>
        <div class="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500">
          <span class="italic font-sans text-[11px] text-slate-500 dark:text-zinc-400">Baseado em ${moduloItem.bibliografia || "Junqueira & Carneiro — Histologia Básica"}</span>
          <span class="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-600">Referência Acadêmica</span>
        </div>
      </div>
    `;
  };

  /**
   * Constrói o Card de Lâmina no formato de galeria acadêmica de espécimes
   */
  const gerarCardLaminaAcademico = (lamina) => {
    const disciplinaNome = lamina.disciplina || disciplinaAtual || "Histologia";
    const coloracaoNome = lamina.coloracao || "Coloração de Rotina";
    const nomeLamina = lamina.nome || lamina.title || "Peça Morfológica";
    const topicoNome = lamina.topico || "Corte Histológico";

    // Extração concisa do aumento para a tag no canto superior esquerdo
    let badgeAumento = "40x";
    if (lamina.maxMagnification) {
      badgeAumento = `${lamina.maxMagnification}x`;
    } else if (coloracaoNome.toLowerCase().includes("100x")) {
      badgeAumento = "100x";
    } else if (coloracaoNome.toLowerCase().includes("40x")) {
      badgeAumento = "40x";
    } else if (coloracaoNome.toLowerCase().includes("20x")) {
      badgeAumento = "20x";
    } else if (coloracaoNome.toLowerCase().includes("10x")) {
      badgeAumento = "10x";
    }

    const imagemUrl = lamina.imagemUrl || lamina.imageUrl || lamina.caminhoImagemBase || lamina.dziUrl || "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi";

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

    return `
      <div class="group bg-white dark:bg-[#0c0c0f] border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgb(13,148,136,0.08)] hover:-translate-y-1 hover:border-teal-700/40 transition-all duration-300 flex flex-col justify-between">
        <div>
          <div class="relative w-full aspect-[4/3] bg-slate-950 overflow-hidden">
            <!-- Placeholder exibido quando a imagem falha -->
            <div class="thumb-placeholder absolute inset-0 flex-col items-center justify-center gap-1 hidden bg-[#060608]">
              <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M12 3v1.5M6.75 4.5l.75 1.3M17.25 4.5l-.75 1.3"/>
              </svg>
              <span class="text-xs text-slate-300 font-serif">Sem pré-visualização</span>
            </div>

            <img
              src="${thumbSrc}"
              alt="${nomeLamina}"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onerror="var fb='${thumbSrcFallback}'; if(fb && this.src!==fb){this.src=fb;}else{this.style.display='none';var ph=this.parentElement.querySelector('.thumb-placeholder');if(ph){ph.classList.remove('hidden');ph.classList.add('flex');}}"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none"></div>

            <!-- Badge de aumento no canto superior esquerdo -->
            <div class="absolute top-3 left-3 flex gap-1.5">
              <span class="bg-black/75 backdrop-blur-sm text-white border border-white/10 text-[10px] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                ${badgeAumento}
              </span>
            </div>

            <!-- Rodapé do preview com disciplina e tópico -->
            <div class="absolute bottom-3 left-3 right-3 text-white">
              <span class="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-semibold">${disciplinaNome.toUpperCase()} • ${topicoNome.toUpperCase()}</span>
            </div>
          </div>

          <!-- Título anatômico em destaque e coloração -->
          <div class="p-5">
            <h3 class="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-teal-900 dark:group-hover:text-teal-300 transition-colors leading-snug mb-1">
              ${nomeLamina}
            </h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-sans">
              ${coloracaoNome}
            </p>
          </div>
        </div>

        <!-- Botão de acesso direto -->
        <div class="p-5 pt-0 mt-auto">
          <a
            href="microscopio.html?id=${lamina.id}"
            class="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-white/5 hover:bg-teal-900 hover:text-white dark:hover:bg-teal-700 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2 group/btn no-underline">
            <span>Examinar Lâmina</span>
            <span class="text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-transform">&rarr;</span>
          </a>
        </div>
      </div>
    `;
  };

  // Renderização 2 Colunas Limpas (Índice + Conteúdo) alinhada ao max-w-7xl
  c2.innerHTML = `
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 pb-16 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 md:gap-10">
      ${gerarIndiceLateral(modulo, topico.id, true)}

      <div class="w-full min-w-0">
        <!-- SELETOR HORIZONTAL DE DISCIPLINAS (MOBILE & TABLET: md:hidden) -->
        <div class="md:hidden">
          ${gerarBarraDisciplinasTopo()}
        </div>
      
        <!-- MIGALHAS DE PÃO (BREADCRUMBS) -->
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-500 dark:text-zinc-400 mb-6 flex-wrap">
          <a href="#" onclick="window.App.goHome(); return false;" class="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-teal-400 transition-colors no-underline">Início</a>
          <span class="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
          <a href="#" onclick="window.App.voltarParaDisciplinaHome('${disc}'); return false;" class="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-teal-400 transition-colors no-underline">${modulo.tituloDisciplina}</a>
          <span class="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
          <span class="text-slate-900 dark:text-white font-medium pointer-events-none">${topico.titulo}</span>
        </nav>

        <!-- TÍTULO DO TÓPICO -->
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-950 dark:text-white tracking-tight mb-4">
          ${topico.titulo}
        </h1>

        <!-- CARD DE RESUMO MORFOLÓGICO -->
        ${gerarCardResumoMorfológico(topico, modulo)}

        <!-- SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS -->
        <div class="mt-8 mb-4">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-6">
            Lâminas de Microscopia Associadas
          </h2>
          <div id="gridCatalogoLaminas" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
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
        const docsFirestore = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const topicoL = (data.topico || "").toLowerCase().trim();
          const targetId = idTopico.toLowerCase().trim();
          const targetTitulo = (topico.titulo || "").toLowerCase().trim();

          if (topicoL === targetId || topicoL === targetTitulo || topicoL.includes(targetId) || (!data.topico && targetId === (modulo.topicos && modulo.topicos[0] ? modulo.topicos[0].id : ""))) {
            docsFirestore.push({ id: doc.id, ...data });
          }
        });

        if (docsFirestore.length > 0) {
          laminasDoTopico = docsFirestore;
        } else {
          const estaticas = topico.laminasEstaticas || topico.laminas || [];
          laminasDoTopico = Array.isArray(estaticas) ? [...estaticas] : [];
        }

        const containerGrid = document.getElementById("gridCatalogoLaminas");
        const contadorTxt = document.getElementById("contadorLaminasBadge");

        if (contadorTxt) {
          contadorTxt.textContent = `${laminasDoTopico.length} ${laminasDoTopico.length === 1 ? 'Lâmina' : 'Lâminas'}`;
        }

        if (!containerGrid) return;

        if (laminasDoTopico.length === 0) {
          containerGrid.innerHTML = `
            <div class="col-span-full bg-white dark:bg-[#0c0c0f] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 sm:p-10 text-center text-slate-500">
              <span class="text-xs font-mono text-slate-400 dark:text-zinc-500 font-semibold block uppercase tracking-wider mb-1.5">Acervo em Digitalização</span>
              <h4 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-serif">Espécimes para ${topico.titulo} em fase de captura e catalogação.</h4>
              <p class="text-xs text-slate-500 dark:text-zinc-400 font-sans mt-2 max-w-md mx-auto leading-relaxed">Novas lâminas de alta resolução para este módulo estão sendo preparadas pelo laboratório de microscopia digital.</p>
            </div>
          `;
          return;
        }

        containerGrid.innerHTML = laminasDoTopico.map(gerarCardLaminaAcademico).join("");
      }, (erroDeConsulta) => {
        console.error("Erro no listener onSnapshot ao buscar lâminas no Firestore:", erroDeConsulta);
        const containerGrid = document.getElementById("gridCatalogoLaminas");
        if (containerGrid) {
          const estaticas = topico.laminasEstaticas || topico.laminas || [];
          if (estaticas.length > 0) {
            containerGrid.innerHTML = estaticas.map(gerarCardLaminaAcademico).join("");
          }
        }
      });
  } else {
    const containerGrid = document.getElementById("gridCatalogoLaminas");
    if (containerGrid) {
      const estaticas = topico.laminasEstaticas || topico.laminas || [];
      if (estaticas.length > 0) {
        containerGrid.innerHTML = estaticas.map(gerarCardLaminaAcademico).join("");
      } else {
        containerGrid.innerHTML = `
          <div class="col-span-full bg-white dark:bg-[#0c0c0f] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 sm:p-10 text-center text-slate-500">
            <span class="text-xs font-mono text-slate-400 dark:text-zinc-500 font-semibold block uppercase tracking-wider mb-1.5">Acervo em Digitalização</span>
            <h4 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-serif">Espécimes para ${topico.titulo} em fase de captura e catalogação.</h4>
            <p class="text-xs text-slate-500 dark:text-zinc-400 font-sans mt-2 max-w-md mx-auto leading-relaxed">Novas lâminas de alta resolução para este módulo estão sendo preparadas pelo laboratório de microscopia digital.</p>
          </div>
        `;
      }
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
