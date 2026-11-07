'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Microscope,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  Sparkles,
} from 'lucide-react';

export interface SummaryPoint {
  label: string;
  text: string;
}

export interface ModuloData {
  id: string;
  title: string;
  category: string;
  summaryPoints: SummaryPoint[];
  bibliographicReference: string;
  associatedSlides: string[];
  updatedAt?: any;
}

export interface SlideCardData {
  id: string;
  nome: string;
  coloracao?: string;
  thumbnailUrl?: string;
  topico?: string;
  disciplina?: string;
  maxMagnification?: string;
  dziUrl?: string;
  imagemUrl?: string;
}

// Lista Curricular de Tópicos para a Sidebar Lateral
const TOPICOS_SIDEBAR = [
  { id: 'epitelial', nome: 'Tecido Epitelial de Revestimento e Glandular' },
  { id: 'conjuntivo', nome: 'Tecido Conjuntivo Propriamente Dito' },
  { id: 'adiposo', nome: 'Tecido Adiposo Unilocular e Multilocular' },
  { id: 'cartilaginoso', nome: 'Tecido Cartilaginoso Hialino, Elástico e Fibroso' },
  { id: 'osseo', nome: 'Tecido Ósseo Compacto e Esponjoso' },
  { id: 'muscular', nome: 'Tecido Muscular Estriado Esquelético, Cardíaco e Liso' },
  { id: 'nervoso', nome: 'Tecido Nervoso e Células da Neuroglia' },
  { id: 'circulatorio', nome: 'Sistema Circulatório e Microvascularização' },
];

// Dicionário Morfológico Curado Padrão (Fallback Acadêmico Junqueira & Carneiro)
const SINTESE_CURADA: Record<string, { title: string; points: SummaryPoint[] }> = {
  osseo: {
    title: 'Tecido Ósseo Compacto e Esponjoso',
    points: [
      {
        label: 'Definição',
        text: 'Tecido conjuntivo especializado e mineralizado, principal constituinte do esqueleto adulto. Fornece suporte mecânico aos tecidos moles, alavanca para locomoção, proteção a órgãos vitais e atua como a principal reserva corporal de íons cálcio e fosfato.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Matriz óssea calcificada composta por porção orgânica (cerca de 95% de colágeno tipo I associado a proteoglicanos e glicoproteínas como osteonectina e osteocalcina) e porção inorgânica (cristais de hidroxiapatita de fosfato de cálcio depositados ordenadamente sobre as fibrilas colágenas).',
      },
      {
        label: 'Células Principais',
        text: 'Osteoblastos (células jovens da superfície responsáveis pela síntese e mineralização do osteoide), osteócitos (células maduras residentes em lacunas, conectadas por canalículos para trocas metabólicas) e osteoclastos (células gigantes multinucleadas especializadas na reabsorção óssea enzimática).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Ósseo Compacto (cortical densa sem cavidades visíveis, organizada em Sistemas de Havers ou ósteons concêntricos e canais vasculares de Volkmann) e Ósseo Esponjoso (rede tridimensional de trabéculas ósseas que delimitam cavidades intercomunicantes preenchidas por medula óssea hematopoiética ou adiposa).',
      },
    ],
  },
  conjuntivo: {
    title: 'Tecido Conjuntivo Propriamente Dito',
    points: [
      {
        label: 'Definição',
        text: 'Tecido de origem mesodérmica amplamente distribuído pelo organismo, responsável pela sustentação estrutural, conexão entre diferentes tecidos, preenchimento de espaços, isolamento de órgãos, via de trânsito vascular e defesa imunológica contra patógenos.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Abundante matriz extracelular (MEC) constituída por Substância Fundamental Amorfa (gel aquoso viscoso rico em ácido hialurônico, glicosaminoglicanos sulfatados e proteoglicanos) e Fibras Estruturais (fibras colágenas tipo I e III de alta resistência à tração, fibras elásticas flexíveis e fibras reticulares de sustentação estromal).',
      },
      {
        label: 'Células Principais',
        text: 'Células residentes (fibroblastos ativamente secretores de matriz, fibrócitos fusiformes quiescentes, macrófagos fagocitários residentes e mastócitos granulosos ricos em histamina e heparina) e células transitórias de defesa (plasmócitos produtores de anticorpos, linfócitos, neutrófilos e eosinófilos).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Conjuntivo Frouxo (distribuição equilibrada e delicada entre células, fibras finas e substância amorfa; altamente flexível e vascularizado, suporta epitélios e envolve vasos) e Conjuntivo Denso (predomínio expressivo de feixes espessos de colágeno tipo I; divide-se em Denso Não Modelado, com feixes entrelaçados na derme profunda e cápsulas de órgãos, e Denso Modelado, com feixes rigorosamente paralelos em tendões e ligamentos).',
      },
    ],
  },
  epitelial: {
    title: 'Tecido Epitelial de Revestimento e Glandular',
    points: [
      {
        label: 'Definição',
        text: 'Tecido avascular composto por células contíguas intimamente unidas por complexos juncionais, com escassa substância intercelular. Recobre superfícies externas (pele), reveste cavidades corpóreas internas (mucosas e serosas) e forma o parênquima das glândulas secretoras.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Praticamente ausente no espaço intercelular. O epitélio repousa invariavelmente sobre uma lâmina basal acelular (rede de colágeno tipo IV, laminina, entactina e perlecan) que o ancora ao conjuntivo subjacente e através da qual difusamente chegam gases e nutrientes.',
      },
      {
        label: 'Células Principais',
        text: 'Células poliédricas com evidente polaridade morfológica e funcional: polo apical (voltado para a luz ou superfície, frequentemente dotado de microvilosidades ou cílios), polos laterais (unidos por zônulas de oclusão, zônulas de adesão e desmossomos) e polo basal (ancorado por hemidesmossomos).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Epitélios de Revestimento (simples pavimentoso, simples cúbico, simples prismático, estratificado pavimentoso queratinizado ou não queratinizado, pseudoestratificado colunar ciliado e de transição/urotélio) e Epitélios Glandulares (exócrinos acinares, tubulares ou alveolares dotados de ductos; e endócrinos cordonais ou vesiculares desprovidos de ductos com secreção hematogênica).',
      },
    ],
  },
  adiposo: {
    title: 'Tecido Adiposo Unilocular e Multilocular',
    points: [
      {
        label: 'Definição',
        text: 'Variedade especializada de tecido conjuntivo no qual predominam células adiposas (adipócitos). Constitui o principal reservatório energético do corpo na forma de triglicerídeos neutros, além de atuar no isolamento térmico, proteção mecânica e como órgão endócrino ativo (produtor de leptina e adipocinas).',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Matriz escassa envolvida por uma delicada trama de fibras reticulares (colágeno tipo III) que contorna individualmente cada célula, acompanhada por uma densa malha de capilares contínuos que supre as elevadas demandas metabólicas de lipólise e lipogênese.',
      },
      {
        label: 'Células Principais',
        text: 'Adipócitos uniloculares (células esféricas grandes com gota lipídica única que ocupa quase todo o citoplasma e desloca o núcleo para a periferia) e adipócitos multiloculares (células menores, poligonais, com núcleo central esférico e numerosas gotículas lipídicas associadas a mitocôndrias ricas em citocromos).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Tecido Adiposo Unilocular / Branco (mais abundante, responsável pela estocagem de lipídios em adultos, modelagem corporal e secreção de adiponectina) e Tecido Adiposo Multilocular / Marrom (presente sobretudo no feto e recém-nascido, especializado na termogênese sem tremor via proteína desacopladora UCP-1 / termogenina).',
      },
    ],
  },
  cartilaginoso: {
    title: 'Tecido Cartilaginoso Hialino, Elástico e Fibroso',
    points: [
      {
        label: 'Definição',
        text: 'Forma especializada de tecido conjuntivo de suporte com consistência rígida e firme, dotada de notável elasticidade mecânica. É avascular, desprovido de vasos linfáticos e nervos, dependendo integralmente da difusão de nutrientes a partir do tecido conjuntivo vascularizado adjacente (pericôndrio).',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Matriz extracelular altamente hidratada (cerca de 75% de água ligada a proteoglicanos com cadeias de condroitim-sulfato e queratam-sulfato associadas a ácido hialurônico / agrecano) entremeada por fibras de colágeno tipo II ou fibras elásticas que suportam forças intensas de compressão.',
      },
      {
        label: 'Células Principais',
        text: 'Condroblastos (células basofílicas jovens da camada condrogênica do pericôndrio, com intensa atividade de secreção de matriz) e condrócitos (células arredondadas maduras alojadas em cavidades da matriz denominadas lacunas, isoladas ou dispostas em grupos isógenos coronários ou axiais).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Cartilagem Hialina (mais comum, matriz vítrea com colágeno tipo II; fossas nasais, laringe, anéis traqueais e superfícies articulares), Cartilagem Elástica (semelhante à hialina, porém acrescida de densa rede de fibras elásticas; epiglote e pavilhão auditivo) e Fibrocartilagem (sem pericôndrio, com feixes densos de colágeno tipo I; discos intervertebrais, meniscos e sínfise púbica).',
      },
    ],
  },
  muscular: {
    title: 'Tecido Muscular Estriado Esquelético, Cardíaco e Liso',
    points: [
      {
        label: 'Definição',
        text: 'Tecido composto por células alongadas de origem mesodérmica (fibras musculares ou miócitos) especializadas na contratilidade ativa e na geração de força de tração através da transformação de energia química (ATP) em movimento mecânico corporal ou visceral.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Bainhas conjuntas organizadas em camadas concêntricas que transmitem a contração aos tendões e osso: Endomísio (fina lâmina de fibras reticulares contornando cada miócito individual), Perimísio (feixes colágenos que agrupam fascículos musculares) e Epimísio (cápsula externa de conjuntivo denso que recobre o músculo inteiro).',
      },
      {
        label: 'Células Principais',
        text: 'Miócitos cujo citoplasma (sarcoplasma) é preenchido longitudinalmente por miofilamentos finos de actina associada a troponina e tropomiosina, e filamentos grossos de miosina, regulados por ciclos intracelulares de liberação e recaptação de cálcio pelo retículo sarcoplasmático.',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Estriado Esquelético (fibras cilíndricas muito longas, multinucleadas com núcleos estritamente periféricos; controle voluntário e contração rápida), Estriado Cardíaco (células ramificadas mononucleadas com núcleos centrais, unidas transversalmente por discos intercalares com desmossomos e junções comunicantes; contração involuntária e vigorosa) e Muscular Liso (células fusiformes uninucleadas centrais sem sarcômeros transversais; contração lenta, sustentada e involuntária em vísceras e vasos sanguíneos).',
      },
    ],
  },
  nervoso: {
    title: 'Tecido Nervoso e Células da Neuroglia',
    points: [
      {
        label: 'Definição',
        text: 'Tecido com altíssima especialização funcional voltado para a percepção de estímulos do meio externo e interno, integração e processamento de informações neurais e deflagração de impulsos elétricos para efetores musculares ou glandulares.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Praticamente destituído de matriz extracelular conjuntiva clássica (salvo em meninges e bainhas periféricas); a sustentação física, isolamento elétrico e regulação iônica e nutricional são executados pelo neurópilo (trama interdigitada contínua de axônios, dendritos e processos citoplasmáticos da neuroglia).',
      },
      {
        label: 'Células Principais',
        text: 'Neurônios (unidades funcionais excitáveis formadas por corpo celular/soma rico em corpúsculos de Nissl, dendritos ramificados receptores de estímulos e um único axônio condutor de potenciais de ação) e Células da Glia (astrócitos de suporte e barreira hematoencefálica, oligodendrócitos mielinizantes centrais, micróglia de fagocitose imunológica e células ependimárias de revestimento ventricular).',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Sistema Nervoso Central / SNC (estruturado em Substância Cinzenta, onde residem os corpos neuronais, sinapses e neurópilo, e Substância Branca, formada por tratos de fibras axonais mielinizadas) e Sistema Nervoso Periférico / SNP (nervos periféricos revestidos por endoneuro, perineuro e epineuro, gânglios sensitivos e motores com células satélites, e células de Schwann mielinizantes).',
      },
    ],
  },
  circulatorio: {
    title: 'Sistema Circulatório e Microvascularização',
    points: [
      {
        label: 'Definição',
        text: 'Circuito tubular fechado e contínuo responsável por impulsionar e conduzir sangue e linfa por todos os tecidos do corpo humano, viabilizando o transporte de gases respiratórios (oxigênio e gás carbônico), nutrientes, hormônios, mediadores químicos e elementos celulares de defesa.',
      },
      {
        label: 'Componentes da Matriz',
        text: 'Lâmina basal subendotelial contínua ou descontínua associada a lâminas elásticas concêntricas (interna e externa) e estroma conjuntivo perivascular (túnica adventícia rica em colágeno tipo I, fibras elásticas, fibroblastos e vasa vasorum).',
      },
      {
        label: 'Células Principais',
        text: 'Células endoteliais poligonais pavimentosas (monocamada com permeabilidade seletiva que sintetiza óxido nítrico, endotelina, prostaciclina e expressa moléculas de adesão leucocitária), pericitos (células contráteis pericapilares com potencial regenerativo) e células musculares lisas da túnica média reguladoras do diâmetro luminal e resistência vascular periférica.',
      },
      {
        label: 'Subtipos e Classificação',
        text: 'Artérias (elásticas de condução com paredes amortecedoras de pulso e musculares de distribuição), Microcirculação (arteríolas reguladoras de resistência pré-capilar; capilares contínuos sem fenestras, fenestrados com poros filtrantes e sinusoides de trajeto tortuoso com amplas fendas; e vênulas pós-capilares) e Veias (vasos de capacitância dotados de túnica adventícia espessa e válvulas intraluminais que impedem o refluxo centrífugo).',
      },
    ],
  },
};

// Lâminas padrão associadas para contingência
const LAMINAS_PADRAO: Record<string, SlideCardData[]> = {
  osseo: [
    {
      id: 'cw3XGCgUwN71XdlwkUe5',
      nome: 'Osso Maduro 40x',
      coloracao: 'Desgaste Natural • Mapeamento 6x8',
      thumbnailUrl: '/assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
      maxMagnification: '40x',
      topico: 'osseo',
      disciplina: 'Histologia',
    },
  ],
  conjuntivo: [
    {
      id: 'conjuntivo_frouxo_01',
      nome: 'Tecido Conjuntivo Frouxo e Denso',
      coloracao: 'H&E (Hematoxilina & Eosina) • 40x',
      thumbnailUrl: '/assets/histologia/lamina-real1-preview.jpg',
      maxMagnification: '40x',
      topico: 'conjuntivo',
      disciplina: 'Histologia',
    },
  ],
  epitelial: [
    {
      id: 'epitelio_simples_01',
      nome: 'Epitélio Simples Escamoso e Cúbico',
      coloracao: 'H&E • 40x',
      thumbnailUrl: '/assets/histologia/epitelio-simples-escamoso-preview.jpg',
      maxMagnification: '40x',
      topico: 'epitelial',
      disciplina: 'Histologia',
    },
  ],
};

export default function DisciplinaDetalhePage() {
  const params = useParams();
  const rawId = (params?.id as string) || 'osseo';
  const topicId = rawId.toLowerCase();

  // Obter fallback curado
  const fallback = useMemo(() => {
    return (
      SINTESE_CURADA[topicId] || {
        title: topicId.charAt(0).toUpperCase() + topicId.slice(1),
        points: [
          {
            label: 'Definição',
            text: 'Corte histológico preparado para análise microscópica em alta resolução.',
          },
          {
            label: 'Critérios Morfológicos',
            text: 'Consulte as lâminas de microscopia abaixo para identificação detalhada das estruturas diagnósticas deste corte.',
          },
        ],
      }
    );
  }, [topicId]);

  const [modulo, setModulo] = useState<ModuloData>({
    id: topicId,
    title: fallback.title,
    category: 'Histologia',
    summaryPoints: fallback.points,
    bibliographicReference: 'Junqueira & Carneiro — Histologia Básica',
    associatedSlides: [],
  });

  const [slides, setSlides] = useState<SlideCardData[]>(LAMINAS_PADRAO[topicId] || []);
  const [isLiveSync, setIsLiveSync] = useState(false);

  // Sincronização em tempo real via Firestore (onSnapshot)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Reset para os dados do fallback ao mudar de tópico
    setModulo({
      id: topicId,
      title: fallback.title,
      category: 'Histologia',
      summaryPoints: fallback.points,
      bibliographicReference: 'Junqueira & Carneiro — Histologia Básica',
      associatedSlides: [],
    });
    setSlides(LAMINAS_PADRAO[topicId] || []);

    const fb = (window as any).firebase;
    if (fb && fb.firestore) {
      const db = fb.firestore();
      setIsLiveSync(true);

      // Ouvinte em tempo real no documento do módulo na coleção 'modulos'
      const unsubModulo = db
        .collection('modulos')
        .doc(topicId)
        .onSnapshot(
          (docSnap: any) => {
            if (docSnap.exists) {
              const data = docSnap.data();
              setModulo({
                id: topicId,
                title: data.title || fallback.title,
                category: data.category || 'Histologia',
                summaryPoints:
                  Array.isArray(data.summaryPoints) && data.summaryPoints.length > 0
                    ? data.summaryPoints
                    : fallback.points,
                bibliographicReference:
                  data.bibliographicReference || 'Junqueira & Carneiro — Histologia Básica',
                associatedSlides: data.associatedSlides || [],
                updatedAt: data.updatedAt,
              });
            }
          },
          (err: any) => {
            console.warn('[Next.js Firestore] Erro no listener do módulo:', err);
          }
        );

      // Ouvinte em tempo real na coleção 'laminas' com status == 'ativa'
      const unsubLaminas = db
        .collection('laminas')
        .where('status', '==', 'ativa')
        .onSnapshot(
          (querySnap: any) => {
            const list: SlideCardData[] = [];
            querySnap.forEach((doc: any) => {
              const d = doc.data();
              const topicoL = (d.topico || '').toLowerCase().trim();
              if (topicoL === topicId || topicoL.includes(topicId)) {
                list.push({ id: doc.id, ...d });
              }
            });

            if (list.length > 0) {
              setSlides(list);
            }
          },
          (err: any) => {
            console.warn('[Next.js Firestore] Erro no listener de lâminas:', err);
          }
        );

      return () => {
        try {
          unsubModulo();
        } catch (e) {}
        try {
          unsubLaminas();
        } catch (e) {}
      };
    }
  }, [topicId, fallback]);

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#060608] text-slate-800 dark:text-zinc-200 antialiased font-sans">
      {/* Header Institucional Superior */}
      <header className="w-full bg-white dark:bg-[#0c0c0f] border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-30 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Lado Esquerdo: Voltar + Divisor Vertical + Logotipo Oficial Agrupados */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl transition-all no-underline shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Atlas</span>
            </Link>
            <span className="h-5 w-px bg-slate-200 dark:bg-white/10 shrink-0"></span>
            <Link href="/" className="flex items-center gap-2 group no-underline shrink-0">
              <span className="text-lg font-serif font-bold text-slate-950 dark:text-[#f4f2ed] tracking-[0.16em]">
                PALAS
              </span>
              <span className="text-lg font-serif font-bold text-teal-800 dark:text-[#d4af37] tracking-[0.16em]">
                ATLAS
              </span>
            </Link>
          </div>

          {/* Lado Direito: Links Desktop Alinhados à Direita sem Colisão */}
          <div className="flex items-center gap-6 shrink-0">
            {isLiveSync && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Firestore Live Sync
              </span>
            )}
            <nav className="hidden lg:flex items-center gap-6 shrink-0">
              <Link href="/#secaoDisciplinas" className="text-sm font-medium text-slate-600 hover:text-sky-800 dark:text-zinc-400 dark:hover:text-teal-400 transition-colors no-underline">
                Disciplinas
              </Link>
              <Link href="/#secaoLaminasPopulares" className="text-sm font-medium text-slate-600 hover:text-sky-800 dark:text-zinc-400 dark:hover:text-teal-400 transition-colors no-underline">
                Lâminas
              </Link>
              <Link href="/#secaoComoUsar" className="text-sm font-medium text-slate-600 hover:text-sky-800 dark:text-zinc-400 dark:hover:text-teal-400 transition-colors no-underline">
                Como Usar
              </Link>
              <Link href="/#secaoFAQ" className="text-sm font-medium text-slate-600 hover:text-sky-800 dark:text-zinc-400 dark:hover:text-teal-400 transition-colors no-underline">
                Dúvidas
              </Link>
              <Link href="/sobre" className="text-sm font-medium text-slate-600 hover:text-sky-800 dark:text-zinc-400 dark:hover:text-teal-400 transition-colors no-underline">
                Sobre Nós
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal (2 Colunas: Sidebar + Área Central) */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 md:gap-10 items-start">
          {/* SIDEBAR ESQUERDA - ÍNDICE CURRICULAR */}
          <aside className="w-full space-y-4">
            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-white/5">
                <BookOpen className="w-4 h-4 text-teal-800 dark:text-teal-400 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-mono">
                  Módulos de Histologia
                </h3>
              </div>
              <nav aria-label="Módulos Curriculares" className="space-y-1">
                {TOPICOS_SIDEBAR.map((t) => {
                  const isActive = t.id === topicId;
                  return (
                    <Link
                      key={t.id}
                      href={`/disciplinas/${t.id}`}
                      className={`block text-xs py-2 px-3 rounded-xl transition-all leading-snug no-underline ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-semibold border-l-2 border-teal-700 dark:border-teal-400 pl-3.5'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {t.nome}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* COLUNA DA DIREITA - DETALHAMENTO & RESUMO MORFOLÓGICO */}
          <section className="w-full min-w-0">
            {/* MIGALHAS DE PÃO (BREADCRUMBS) */}
            <nav
              aria-label="Navegação estrutural"
              className="flex items-center gap-2 text-xs font-sans text-slate-500 dark:text-zinc-400 mb-5 flex-wrap"
            >
              <Link
                href="/"
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-teal-400 transition-colors no-underline"
              >
                Início
              </Link>
              <span className="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
              <span className="text-slate-500 dark:text-zinc-400">
                {modulo.category}
              </span>
              <span className="text-slate-300 dark:text-zinc-700 select-none">&rsaquo;</span>
              <span className="text-slate-900 dark:text-white font-medium pointer-events-none">
                {modulo.title}
              </span>
            </nav>

            {/* TÍTULO DO MÓDULO */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight mb-4">
              {modulo.title}
            </h1>

            {/* CARD DE RESUMO MORFOLÓGICO ACADÊMICO */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-[0_4px_20px_rgb(15,23,42,0.03)] mb-8">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-teal-700"></span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Resumo Morfológico
                  </h2>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200/60 dark:border-teal-700/40">
                  Curadoria Ativa
                </span>
              </div>

              {/* Tópicos Estruturados */}
              <ul className="space-y-4">
                {modulo.summaryPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 shrink-0"></span>
                    <div className="text-xs sm:text-sm">
                      <strong className="font-semibold text-slate-950 dark:text-white">
                        {point.label}:
                      </strong>
                      <span className="text-slate-600 dark:text-zinc-300 ml-1.5">
                        {point.text}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Rodapé com Citação Bibliográfica */}
              <div className="mt-6 pt-3.5 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 dark:text-zinc-500">
                <span className="italic font-sans text-[11px] text-slate-500 dark:text-zinc-400">
                  Baseado em {modulo.bibliographicReference}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-600">
                  Referência Acadêmica
                </span>
              </div>
            </div>

            {/* SEÇÃO DE LÂMINAS DE MICROSCOPIA ASSOCIADAS */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Lâminas de Microscopia Associadas
                </h2>
                <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                  {slides.length} {slides.length === 1 ? 'espécime' : 'espécimes'}
                </span>
              </div>

              {slides.length === 0 ? (
                <div className="bg-white dark:bg-[#0c0c0f] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 sm:p-10 text-center text-slate-500">
                  <span className="text-xs font-mono text-slate-400 dark:text-zinc-500 font-semibold block uppercase tracking-wider mb-1.5">
                    Acervo em Digitalização
                  </span>
                  <h4 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white font-serif">
                    Espécimes para {modulo.title} em fase de captura e catalogação.
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-sans mt-2 max-w-md mx-auto leading-relaxed">
                    Novas lâminas de alta resolução para este módulo estão sendo preparadas pelo laboratório de microscopia digital.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {slides.map((lamina) => {
                    const stain = lamina.coloracao || 'Coloração de Rotina';
                    const mag = lamina.maxMagnification || '40x';
                    const thumb =
                      lamina.thumbnailUrl ||
                      '/assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg';

                    return (
                      <div
                        key={lamina.id}
                        className="group bg-white dark:bg-[#0c0c0f] border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgb(13,148,136,0.08)] hover:-translate-y-1 hover:border-teal-700/40 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative w-full aspect-[4/3] bg-slate-950 overflow-hidden">
                            <img
                              src={thumb}
                              alt={lamina.nome}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none"></div>

                            {/* Badge de aumento */}
                            <div className="absolute top-3 left-3 flex gap-1.5">
                              <span className="bg-black/75 backdrop-blur-sm text-white border border-white/10 text-[10px] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                                {mag}
                              </span>
                            </div>

                            {/* Rodapé com disciplina e tópico */}
                            <div className="absolute bottom-3 left-3 right-3 text-white">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-semibold">
                                {modulo.category.toUpperCase()} • {modulo.title.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="p-5">
                            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-teal-900 dark:group-hover:text-teal-300 transition-colors leading-snug mb-1">
                              {lamina.nome}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-sans">
                              {stain}
                            </p>
                          </div>
                        </div>

                        {/* Botão de Acesso ao Microscópio */}
                        <div className="p-5 pt-0 mt-auto">
                          <a
                            href={`/microscopio.html?id=${lamina.id}`}
                            className="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-white/5 hover:bg-teal-900 hover:text-white dark:hover:bg-teal-700 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2 group/btn no-underline"
                          >
                            <span>Examinar Lâmina</span>
                            <span className="text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-transform">
                              &rarr;
                            </span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
