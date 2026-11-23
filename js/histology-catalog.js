/**
 * ============================================================================
 * MOTOR DO CATÁLOGO DE MICROSCOPIA DO CICLO BÁSICO E NAVEGAÇÃO HIERÁRQUICA
 * ============================================================================
 * Suporte nativo ao Ciclo Básico: Histologia, Patologia, Parasitologia e Microbiologia.
 * Nível 1 (#histoCatalog): Sumário Limpo com cards visuais contendo apenas os títulos.
 * Nível 2 (#histoSubCatalog): Gaveta Teórico-Prática com resumo acadêmico detalhado e grid de lâminas.
 * 
 * Zero Emojis | Zero Truncamento | Clinical Precision UI
 */
import { db } from "./firebase-config.js";
import { catalogData } from "./catalog-data.js?v=20261123v1";
import { getState, subscribe, setFrenteAtiva } from "./state.js";
import { escaparHTML } from "./sanitizer.js";

let disciplinaAtual = "histologia";

/**
 * Encerra listeners ativos do Firestore do catálogo (módulo + lâminas)
 * evitando vazamento de inscrições ao trocar de tópico ou retornar à Home.
 */
export function encerrarListenersCatalogo() {
  if (window._currentModuleDocUnsubscribe && typeof window._currentModuleDocUnsubscribe === "function") {
    try { window._currentModuleDocUnsubscribe(); } catch (e) {}
    window._currentModuleDocUnsubscribe = null;
  }
  if (window._currentTopicUnsubscribe && typeof window._currentTopicUnsubscribe === "function") {
    try { window._currentTopicUnsubscribe(); } catch (e) {}
    window._currentTopicUnsubscribe = null;
  }
}

function gerarIndiceLateral(modulo, topicoAtivoId, exibirSubtopicos = false) {
  let htmlItens = "";
  if (exibirSubtopicos && modulo && modulo.topicos) {
    modulo.topicos.forEach((topico) => {
      const isAtivo = topico.id === topicoAtivoId;
      if (isAtivo) {
        htmlItens += `
          <button
            type="button"
            class="bg-teal-50 text-teal-950 font-semibold border-l-2 border-teal-700 pl-3 py-1.5 w-full text-left leading-snug break-words text-xs block transition-colors"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      } else {
        htmlItens += `
          <button
            type="button"
            onclick="window.App.abrirTopico('${topico.id}', 'histologia')"
            class="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 py-1.5 px-3 block transition-colors w-full text-left leading-snug break-words cursor-pointer border-l-2 border-transparent"
            title="${topico.titulo}">
            ${topico.titulo}
          </button>`;
      }
    });
  }

  const navEmBreve = (id, label, dotClass) => `
    <button
      type="button"
      onclick="window.App.selecionarFrente('${id}')"
      class="text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50/80 py-1.5 px-3 w-full text-left flex items-center justify-between gap-2 border-l-2 border-transparent transition-colors cursor-pointer">
      <span class="flex items-center gap-2.5 min-w-0">
        <span class="w-2 h-2 rounded-full ${dotClass} shrink-0"></span>
        <span class="truncate">${label}</span>
      </span>
      <span class="text-[9px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Em breve</span>
    </button>
  `;

  return `
    <aside class="space-y-6 text-xs font-sans text-slate-600 border-r border-slate-200/80 pr-6 hidden lg:block">
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-2.5 block">Disciplinas</span>
        <div class="space-y-1">
          <button type="button" onclick="window.App.navegarPara('pgHome')" class="text-xs text-slate-600 hover:text-teal-800 hover:bg-slate-50/80 py-1.5 px-3 block transition-colors w-full text-left flex items-center gap-2 border-l-2 border-transparent cursor-pointer">
            <span>&larr;</span>
            <span>Voltar ao início</span>
          </button>
          <button type="button" onclick="window.App.selecionarFrente('histologia')" class="bg-teal-50 text-teal-950 font-semibold border-l-2 border-teal-700 pl-3 py-1.5 w-full text-left flex items-center gap-2.5 transition-colors cursor-pointer">
            <span class="w-2 h-2 rounded-full bg-teal-600 shrink-0"></span>
            <span class="truncate">Histologia</span>
          </button>
          ${navEmBreve('patologia', 'Patologia', 'bg-rose-600')}
          ${navEmBreve('parasitologia', 'Parasitologia', 'bg-emerald-600')}
          ${navEmBreve('microbiologia', 'Microbiologia', 'bg-violet-600')}
        </div>
      </div>
      
      ${htmlItens ? `
      <div>
        <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-2.5 block">Tecidos Histológicos</span>
        <div class="space-y-1">
          ${htmlItens}
        </div>
      </div>
      ` : ''}
    </aside>
  `;
}

/**
 * O site opera com foco exclusivo em Histologia; barra multi-disciplinas desativada.
 */
function gerarBarraDisciplinasTopo() {
  return "";
}

/**
 * Faixa compacta de tópicos da disciplina ativa para Mobile e Tablet (lg:hidden)
 */
function gerarBarraTopicosMobile(modulo, topicoAtivoId, disc) {
  if (!modulo || !Array.isArray(modulo.topicos) || modulo.topicos.length === 0) return "";
  const pillsHtml = modulo.topicos.map((topico, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const isAtivo = topico.id === topicoAtivoId;
    const cls = isAtivo
      ? "bg-teal-900 text-white border-teal-900 font-semibold shadow-xs"
      : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90";
    return `
      <button
        type="button"
        onclick="window.App.abrirTopico('${topico.id}', '${disc}')"
        class="shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border text-xs font-sans transition-colors cursor-pointer whitespace-nowrap ${cls}">
        <span class="font-mono text-[10px] opacity-75">${num}</span>
        <span>${topico.titulo}</span>
      </button>
    `;
  }).join("");

  return `
    <div class="lg:hidden mb-5">
      <div class="w-full pb-1 overflow-x-auto no-scrollbar flex items-center gap-2 select-none scroll-smooth">
        ${pillsHtml}
      </div>
    </div>
  `;
}

/**
 * Renderiza o Nível 1 (#histoCatalog): Lista Vertical Numerada (Estilo Sumário de Livro)
 * @param {string} disciplina - Identificador da disciplina.
 */
function renderizarCatalogoHistologia(disciplina) {
  disciplinaAtual = "histologia";

  const modulo = catalogData.histologia;
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");

  if (!c1) return;

  if (c1) c1.classList.remove("hidden");
  if (c2) c2.classList.add("hidden");

  let htmlRows = "";
  let htmlSubmenu = "";
  
  if (modulo.topicos && modulo.topicos.length > 0) {
    modulo.topicos.forEach((topico, idx) => {
      const numFormatado = String(idx + 1).padStart(2, "0");
      htmlRows += `
        <div 
          onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')"
          class="px-4 sm:px-8 py-4 sm:py-5 hover:bg-teal-50/50 transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 sm:gap-4 group">
          <div class="flex items-center gap-3 sm:gap-6 min-w-0">
            <span class="font-mono text-xs sm:text-sm font-bold text-slate-400 group-hover:text-teal-800 transition-colors w-6 shrink-0 select-none">${numFormatado}</span>
            <span class="h-5 w-px bg-slate-200 group-hover:bg-teal-300 transition-colors shrink-0"></span>
            <h3 class="font-serif text-sm sm:text-lg text-slate-900 font-bold tracking-[-0.015em] leading-snug group-hover:text-teal-950 transition-colors">${topico.titulo}</h3>
          </div>
          <span class="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/80 group-hover:border-teal-700 group-hover:bg-teal-700 flex items-center justify-center text-slate-400 group-hover:text-white shrink-0 transition-all group-hover:translate-x-0.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>
      `;
      
      htmlSubmenu += `
        <button onclick="window.App.abrirTopico('${topico.id}', '${disciplinaAtual}')" class="text-left text-slate-600 hover:text-teal-800 hover:bg-slate-100 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors leading-snug break-words w-full">
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
    <div class="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 lg:pt-8 pb-16 sm:pb-20">
      <!-- BARRA HORIZONTAL DE DISCIPLINAS -->
      ${gerarBarraDisciplinasTopo()}

      <!-- CABEÇALHO DA DISCIPLINA -->
      <div class="mb-6 pb-5 border-b border-slate-200/90">
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-400 mb-2 flex-wrap">
          <a href="#" onclick="window.App.navegarPara('pgHome'); return false;" class="text-slate-500 hover:text-teal-800 transition-colors no-underline">Início</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <span class="text-slate-900 font-semibold pointer-events-none">${modulo.tituloDisciplina}</span>
        </nav>
        <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <h2 class="text-2xl sm:text-4xl font-serif font-extrabold text-slate-900 tracking-[-0.02em]">${modulo.tituloDisciplina}</h2>
          <p class="text-xs text-slate-500 font-sans">
            <span class="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Referência:</span> ${modulo.bibliografia}
          </p>
        </div>
      </div>

      <!-- LISTA VERTICAL NUMERADA (ESTILO SUMÁRIO DE LIVRO) -->
      <div class="palas-console-panel bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.06)] divide-y divide-slate-200/80 overflow-hidden">
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
export async function abrirTopico(idTopico, disciplina, skipHistory = false) {
  const disc = "histologia";
  disciplinaAtual = disc;
  const modulo = catalogData.histologia;
  const topico = modulo.topicos.find((t) => t.id === idTopico);
  if (!topico) return;

  // Encerra listeners anteriores antes de montar a nova gaveta
  encerrarListenersCatalogo();

  if (!skipHistory) {
    history.pushState({ frente: disc, nivel: 2, topico: idTopico }, "", `?frente=${disc}&topico=${idTopico}`);
  }

  // Rola suavemente para o topo absoluto da página e revela o container ANTES de notificar o state
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const pgHome = document.getElementById("pgHome");
  const pgHistologia = document.getElementById("pgHistologia");
  if (pgHome) pgHome.classList.add("hidden");
  if (pgHistologia) {
    pgHistologia.classList.remove("hidden");
    pgHistologia.classList.remove("pt-14");
  }

  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");

  if (c1) c1.classList.add("hidden");
  if (c2) c2.classList.remove("hidden");

  // Garante que o header global e o espaçamento adequado sob ele permaneçam ativos
  const minimalHeader = document.getElementById("palasMinimalHeader");
  if (minimalHeader) minimalHeader.classList.remove("hidden");

  // Notifica o gerenciador de estado para sincronizar o cabeçalho e roteador
  setFrenteAtiva(disc);

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
    if (topicoItem.summaryPoints && Array.isArray(topicoItem.summaryPoints) && topicoItem.summaryPoints.length > 0) {
      pontos = topicoItem.summaryPoints.map(p => ({
        label: p.label || "Critério",
        desc: p.text || p.desc || ""
      }));
    } else if (topicoItem.pontosChave && Array.isArray(topicoItem.pontosChave) && topicoItem.pontosChave.length > 0) {
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
        <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0"></span>
        <div class="text-xs sm:text-sm">
          <strong class="font-semibold text-slate-950">${escaparHTML(p.label)}:</strong>
          <span class="text-slate-600 ml-1">${escaparHTML(p.desc)}</span>
        </div>
      </li>
    `).join("");

    const refBib = moduloItem.bibliografia || moduloItem.bibliographicReference || "Junqueira & Carneiro — Histologia Básica";

    return `
      <div class="palas-console-panel bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-[0_4px_20px_rgb(15,23,42,0.03)] mb-6 sm:mb-8">
        <div class="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <span class="w-1.5 h-4 rounded-full bg-teal-700"></span>
          <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Resumo Morfológico</h2>
        </div>
        <ul class="space-y-3 sm:space-y-3.5">
          ${itensHtml}
        </ul>
        <div class="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span class="italic font-sans text-[11px] text-slate-500">Baseado em ${escaparHTML(refBib)}</span>
          <span class="font-mono text-[10px] uppercase tracking-wider text-slate-400">Referência Acadêmica</span>
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
    const sanitizeThumbUrl = (u) => {
      const s = String(u || "").trim();
      if (!s) return "";
      const lower = s.toLowerCase();
      if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:") || lower.startsWith("//")) return "";
      return s;
    };

    let thumbSrc = sanitizeThumbUrl(lamina.thumbnailUrl || "");
    let thumbSrcFallback = "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";

    if (!thumbSrc) {
      if (imagemUrl.toLowerCase().endsWith(".dzi")) {
        const basePath = imagemUrl.substring(0, imagemUrl.lastIndexOf(".dzi"));
        thumbSrc = sanitizeThumbUrl(`${basePath}-preview.jpg`) || thumbSrcFallback;
      } else {
        thumbSrc = sanitizeThumbUrl(imagemUrl) || thumbSrcFallback;
      }
    }

    const slideIdStr = String(lamina.id || "");
    const slideUrl = `microscopio.html?id=${encodeURIComponent(slideIdStr)}`;

    return `
      <div data-open-slide-url="${escaparHTML(slideUrl)}" class="palas-card-tactile palas-card-interactive group bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer">
        <div>
          <div class="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200/70">
            <!-- Placeholder exibido quando a imagem falha -->
            <div class="thumb-placeholder absolute inset-0 flex-col items-center justify-center gap-1 hidden bg-slate-100">
              <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M12 3v1.5M6.75 4.5l.75 1.3M17.25 4.5l-.75 1.3"/>
              </svg>
              <span class="text-xs text-slate-500 font-serif">Sem pré-visualização</span>
            </div>

            <img
              src="${escaparHTML(thumbSrc)}"
              data-fallback="${escaparHTML(thumbSrcFallback)}"
              alt="${escaparHTML(nomeLamina)}"
              class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              loading="lazy"
              onerror="if(!this.dataset.fbApplied && this.dataset.fallback){this.dataset.fbApplied='1';this.src=this.dataset.fallback;}else{this.style.display='none';var ph=this.parentElement.querySelector('.thumb-placeholder');if(ph){ph.classList.remove('hidden');ph.classList.add('flex');}}"
            />
            <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-900/5"></div>

            <!-- Selo limpo de aumento -->
            <div class="absolute top-3 left-3">
              <span class="bg-white/95 backdrop-blur-md text-slate-800 border border-slate-200/90 text-[10.5px] font-mono font-semibold px-2.5 py-1 rounded-lg shadow-sm">
                ${escaparHTML(badgeAumento)}
              </span>
            </div>
          </div>

          <!-- Título anatômico em destaque e coloração -->
          <div class="p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2 text-[10px] font-mono tracking-wider mb-1.5">
              <span class="uppercase text-teal-700 font-semibold">${escaparHTML(String(disciplinaNome))} &middot; ${escaparHTML(String(topicoNome))}</span>
            </div>
            <h3 class="font-serif font-bold text-base sm:text-lg text-slate-900 group-hover:text-teal-900 transition-colors leading-snug mb-1.5">
              ${escaparHTML(nomeLamina)}
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed font-sans">
              ${escaparHTML(coloracaoNome)}
            </p>
          </div>
        </div>

        <!-- Rodapé alinhado ao estilo da Home -->
        <div class="px-4 sm:px-5 pb-4 sm:pb-5 mt-auto">
          <a
            href="${escaparHTML(slideUrl)}"
            class="pt-3 border-t border-slate-100 w-full text-xs font-semibold text-teal-800 group-hover:text-teal-950 transition-colors flex items-center justify-between no-underline">
            <span>Abrir no microscópio</span>
            <span class="text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all">&rarr;</span>
          </a>
        </div>
      </div>
    `;
  };

  // Delegação de clique nos cards de lâmina (sem inline onclick com ID dinâmico)
  if (!c2.__cardClickDelegated) {
    c2.__cardClickDelegated = true;
    c2.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const card = e.target.closest("[data-open-slide-url]");
      if (!card) return;
      const url = card.getAttribute("data-open-slide-url");
      if (url) window.location.href = url;
    });
  }

  const discKey = catalogData[disc] ? disc : "histologia";

  // Renderização 2 Colunas Limpas (Índice + Conteúdo) alinhada ao max-w-7xl
  c2.innerHTML = `
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 lg:pt-8 pb-16 grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 lg:gap-10">
      ${gerarIndiceLateral(modulo, topico.id, true)}

      <div class="w-full min-w-0">
        <!-- SELETOR HORIZONTAL DE DISCIPLINAS & TÓPICOS (MOBILE & TABLET: lg:hidden) -->
        <div class="lg:hidden">
          ${gerarBarraDisciplinasTopo()}
          ${gerarBarraTopicosMobile(modulo, topico.id, discKey)}
        </div>
      
        <!-- MIGALHAS DE PÃO (BREADCRUMBS) -->
        <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs font-sans text-slate-500 mb-6 flex-wrap">
          <a href="#" onclick="window.App.goHome(); return false;" class="text-slate-500 hover:text-slate-900 transition-colors no-underline">Início</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <a href="#" onclick="window.App.voltarParaDisciplinaHome('${discKey}'); return false;" id="breadcrumbDisciplina" class="text-slate-500 hover:text-slate-900 transition-colors no-underline">${escaparHTML(modulo.tituloDisciplina)}</a>
          <span class="text-slate-300 select-none">&rsaquo;</span>
          <span id="breadcrumbTopico" class="text-slate-900 font-medium pointer-events-none">${escaparHTML(topico.titulo)}</span>
        </nav>

        <!-- TÍTULO DO TÓPICO -->
        <h1 id="tituloTopicoH1" class="text-2xl lg:text-3xl font-bold text-slate-950 tracking-tight mb-4">
          ${escaparHTML(topico.titulo)}
        </h1>

        <!-- CARD DE RESUMO MORFOLÓGICO DINÂMICO -->
        <div id="cardResumoMorfologicoContainer">
          ${gerarCardResumoMorfológico(topico, modulo)}
        </div>

        <!-- SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS -->
        <div class="mt-8 mb-4">
          <h2 class="text-xl font-bold text-slate-900 mb-6">
            Lâminas de Microscopia Associadas
          </h2>
          <div id="gridCatalogoLaminas" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            <p class="text-sm text-slate-500 font-mono col-span-full">Aguardando lâminas...</p>
          </div>
        </div>

      </div>
    </div>
  `;

  // Listener em Tempo Real (onSnapshot) na coleção 'modulos' para sincronizar títulos e resumos morfológicos
  if (typeof db !== "undefined" && db) {
    if (window._currentModuleDocUnsubscribe && typeof window._currentModuleDocUnsubscribe === "function") {
      try { window._currentModuleDocUnsubscribe(); } catch (e) {}
      window._currentModuleDocUnsubscribe = null;
    }

    try {
      window._currentModuleDocUnsubscribe = db.collection("modulos").doc(idTopico)
        .onSnapshot((docSnapshot) => {
          if (!docSnapshot.exists) return;
          const moduloDoc = docSnapshot.data();
          if (!moduloDoc) return;

          // Atualizar Título em Tempo Real
          if (moduloDoc.title) {
            const h1 = document.getElementById("tituloTopicoH1");
            if (h1) h1.textContent = moduloDoc.title;
            const bcTopico = document.getElementById("breadcrumbTopico");
            if (bcTopico) bcTopico.textContent = moduloDoc.title;
          }

          // Atualizar Categoria em Tempo Real
          if (moduloDoc.category) {
            const bcDisc = document.getElementById("breadcrumbDisciplina");
            if (bcDisc) bcDisc.textContent = moduloDoc.category;
          }

          // Atualizar Card de Resumo Morfológico em Tempo Real
          const cardContainer = document.getElementById("cardResumoMorfologicoContainer");
          if (cardContainer) {
            const topicoAtualizado = {
              ...topico,
              id: idTopico,
              titulo: moduloDoc.title || topico.titulo,
              summaryPoints: moduloDoc.summaryPoints,
              pontosChave: Array.isArray(moduloDoc.summaryPoints) ? moduloDoc.summaryPoints.map(p => ({
                label: p.label || "Critério",
                desc: p.text || p.desc || ""
              })) : null
            };
            const moduloAtualizado = {
              ...modulo,
              bibliografia: moduloDoc.bibliographicReference || modulo.bibliografia,
              tituloDisciplina: moduloDoc.category || modulo.tituloDisciplina
            };
            cardContainer.innerHTML = gerarCardResumoMorfológico(topicoAtualizado, moduloAtualizado);
          }
        }, (errMod) => {
          console.warn("[Palas Atlas] Aviso no listener de módulo do Firestore:", errMod);
        });
    } catch (eMod) {
      console.warn("[Palas Atlas] Falha ao conectar listener do módulo:", eMod);
    }
  }

  // Listener em Tempo Real (onSnapshot) na coleção 'laminas' apenas com status == 'ativa'
  const renderEmptyState = (container) => {
    container.innerHTML = `
      <div class="col-span-full bg-white border border-dashed border-slate-200 rounded-2xl p-8 sm:p-10 text-center text-slate-500">
        <span class="text-xs font-mono text-slate-400 font-semibold block uppercase tracking-wider mb-1.5">Acervo em Digitalização</span>
        <h4 class="text-base sm:text-lg font-semibold text-slate-900 font-serif">Espécimes para ${escaparHTML(topico.titulo)} em fase de captura e catalogação.</h4>
        <p class="text-xs text-slate-500 font-sans mt-2 max-w-md mx-auto leading-relaxed">Novas lâminas de alta resolução para este módulo estão sendo preparadas pelo laboratório de microscopia digital.</p>
      </div>
    `;
  };

  const mesclarLaminasComEstaticas = (docsFirestore) => {
    const estaticas = Array.isArray(topico.laminasEstaticas || topico.laminas) ? (topico.laminasEstaticas || topico.laminas) : [];
    const idsFirestore = new Set(docsFirestore.map((d) => String(d.id || "").toLowerCase()));
    const urlsFirestore = new Set(
      docsFirestore
        .map((d) => String(d.dziUrl || d.imagemUrl || d.imageUrl || "").toLowerCase().trim())
        .filter(Boolean)
    );
    const estaticasExtras = estaticas.filter((est) => {
      const estId = String(est.id || "").toLowerCase();
      const estUrl = String(est.dziUrl || est.imagemUrl || est.imageUrl || "").toLowerCase().trim();
      return !idsFirestore.has(estId) && (!estUrl || !urlsFirestore.has(estUrl));
    });
    return [...docsFirestore, ...estaticasExtras];
  };

  // Exibe imediatamente lâminas estáticas do catálogo enquanto o snapshot ao vivo do Firestore carrega
  const iniciaisEstaticas = mesclarLaminasComEstaticas([]);
  if (iniciaisEstaticas.length > 0) {
    const gridInicial = document.getElementById("gridCatalogoLaminas");
    if (gridInicial) {
      gridInicial.innerHTML = iniciaisEstaticas.map(gerarCardLaminaAcademico).join("");
    }
  }

  if (typeof db !== "undefined" && db) {
    window._currentTopicUnsubscribe = db.collection("laminas")
      .where("status", "==", "ativa")
      .onSnapshot((snapshot) => {
        const docsFirestore = [];
        const targetId = idTopico.toLowerCase().trim();
        const targetTitulo = (topico.titulo || "").toLowerCase().trim();
        const targetDisc = discKey.toLowerCase();

        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          const topicoL = (data.topico || "").toLowerCase().trim();
          const discL = (data.disciplina || "").toLowerCase().trim();
          const discMatch = !discL || discL === targetDisc;

          if (discMatch && topicoL && (topicoL === targetId || topicoL === targetTitulo)) {
            docsFirestore.push({ id: doc.id, ...data });
          }
        });

        const laminasDoTopico = mesclarLaminasComEstaticas(docsFirestore);

        const containerGrid = document.getElementById("gridCatalogoLaminas");
        if (!containerGrid) return;

        if (laminasDoTopico.length === 0) {
          renderEmptyState(containerGrid);
          return;
        }

        containerGrid.innerHTML = laminasDoTopico.map(gerarCardLaminaAcademico).join("");
      }, (erroDeConsulta) => {
        console.error("Erro no listener onSnapshot ao buscar lâminas no Firestore:", erroDeConsulta);
        const containerGrid = document.getElementById("gridCatalogoLaminas");
        if (containerGrid) {
          const estaticas = mesclarLaminasComEstaticas([]);
          if (estaticas.length > 0) {
            containerGrid.innerHTML = estaticas.map(gerarCardLaminaAcademico).join("");
          } else {
            renderEmptyState(containerGrid);
          }
        }
      });
  } else {
    const containerGrid = document.getElementById("gridCatalogoLaminas");
    if (containerGrid) {
      const estaticas = mesclarLaminasComEstaticas([]);
      if (estaticas.length > 0) {
        containerGrid.innerHTML = estaticas.map(gerarCardLaminaAcademico).join("");
      } else {
        renderEmptyState(containerGrid);
      }
    }
  }
}

/**
 * Redireciona para o estúdio óptico completo em microscopio.html para a lâmina informada.
 * @param {string} idLamina - Identificador da lâmina.
 */
function abrirLamina(idLamina) {
  if (!idLamina) return;
  encerrarListenersCatalogo();
  window.location.href = `microscopio.html?id=${encodeURIComponent(String(idLamina))}`;
}

/**
 * Retorna ao nível especificado gerenciando a classe hidden.
 * @param {number} nivelDestino - 1 para Início com Accordion da Disciplina, 2 para Gaveta Teórica, 3 para Microscópio.
 */
function voltarNivel(nivelDestino) {
  const c1 = document.getElementById("histoCatalog");
  const c2 = document.getElementById("histoSubCatalog");

  if (!c2) return;

  const minimalHeader = document.getElementById("palasMinimalHeader");
  const pgHistologia = document.getElementById("pgHistologia");

  if (nivelDestino === 1) {
    voltarParaDisciplinaHome(disciplinaAtual);
  } else if (nivelDestino === 2) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (minimalHeader) minimalHeader.classList.remove("hidden");
    if (pgHistologia) pgHistologia.classList.remove("pt-14");
    if (c1) c1.classList.add("hidden");
    c2.classList.remove("hidden");
  }
}

function destacarCardEmBreve(disciplina) {
  const cardsWrap = document.getElementById('cardsOutrasDisciplinas');
  if (cardsWrap) {
    cardsWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    document.getElementById('secaoDisciplinas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const card = document.querySelector(`[data-disciplina-card="${disciplina}"]`);
  if (card) {
    card.classList.add('ring-2', 'ring-teal-700/40', 'shadow-md');
    setTimeout(() => {
      card.classList.remove('ring-2', 'ring-teal-700/40', 'shadow-md');
    }, 1500);
  }
}

/**
 * Alterna a exibição do accordion de Histologia na Home.
 * Para Patologia, Parasitologia e Microbiologia (sem tópicos), recolhe Histologia e destaca o card informativo.
 */
function toggleAccordionDisciplinas(disciplina = 'histologia') {
  const containerHisto = document.getElementById('accordionContainerHistologia');
  const btnTxtHisto = document.getElementById('btnTxtHistologia');
  const arrowIconHisto = document.getElementById('arrowIconHistologia');

  if (['patologia', 'parasitologia', 'microbiologia'].includes(disciplina)) {
    if (containerHisto) containerHisto.classList.add('hidden');
    if (btnTxtHisto) btnTxtHisto.textContent = 'Ver módulos';
    if (arrowIconHisto) arrowIconHisto.classList.remove('rotate-180');
    destacarCardEmBreve(disciplina);
    return;
  }

  if (!containerHisto) return;

  const isHidden = containerHisto.classList.contains('hidden');

  if (isHidden) {
    containerHisto.classList.remove('hidden');
    if (btnTxtHisto) btnTxtHisto.textContent = 'Recolher';
    if (arrowIconHisto) arrowIconHisto.classList.add('rotate-180');
    setTimeout(() => {
      containerHisto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  } else {
    containerHisto.classList.add('hidden');
    if (btnTxtHisto) btnTxtHisto.textContent = 'Ver módulos';
    if (arrowIconHisto) arrowIconHisto.classList.remove('rotate-180');
  }
}

function fecharAccordionOutras() {
  // Mantido como no-op por compatibilidade com chamadas externas legadas.
}

function abrirAccordionHero(disciplina = 'histologia') {
  const secao = document.getElementById('secaoDisciplinas');
  const containerHisto = document.getElementById('accordionContainerHistologia');
  const btnTxtHisto = document.getElementById('btnTxtHistologia');
  const arrowIconHisto = document.getElementById('arrowIconHistologia');

  if (['patologia', 'parasitologia', 'microbiologia'].includes(disciplina)) {
    if (containerHisto) containerHisto.classList.add('hidden');
    if (btnTxtHisto) btnTxtHisto.textContent = 'Ver módulos';
    if (arrowIconHisto) arrowIconHisto.classList.remove('rotate-180');
    destacarCardEmBreve(disciplina);
    return;
  }

  if (containerHisto) {
    containerHisto.classList.remove('hidden');
    if (btnTxtHisto) btnTxtHisto.textContent = 'Recolher';
    if (arrowIconHisto) arrowIconHisto.classList.add('rotate-180');
  }

  if (secao) {
    secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function abrirDisciplinaHome(disciplina = 'histologia', skipHistory = false) {
  const targetDisc = ['histologia', 'patologia', 'parasitologia', 'microbiologia'].includes(disciplina)
    ? disciplina
    : 'histologia';
  if (window.App && typeof window.App.goHome === 'function') {
    window.App.goHome(skipHistory);
  }
  setTimeout(() => {
    abrirAccordionHero(targetDisc);
  }, 100);
}

export function voltarParaDisciplinaHome(disciplina = 'histologia') {
  encerrarListenersCatalogo();
  abrirDisciplinaHome(disciplina || 'histologia');
}

// Reativo: se frente mudar no state
subscribe((state) => {
  if (["histologia", "patologia", "parasitologia", "microbiologia"].includes(state.frenteAtiva)) {
    const c2 = document.getElementById("histoSubCatalog");
    const isTopicOpen = c2 && !c2.classList.contains("hidden");
    if (!isTopicOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const topicoParam = urlParams.get('topico');
      if (topicoParam) {
        abrirTopico(topicoParam, 'histologia', true);
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
  fecharAccordionOutras,
  encerrarListenersCatalogo
};
