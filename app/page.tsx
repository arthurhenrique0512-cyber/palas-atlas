'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Microscope,
  Layers,
  FlaskConical,
  Compass,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Menu,
  Info,
} from 'lucide-react';

// Tipagem TypeScript para as lâminas da vitrine e busca
export interface SlideItem {
  id: string;
  title: string;
  category: string;
  stain?: string;
  thumbnailUrl: string;
  link: string;
  disciplina: string;
  tags?: string[];
}

// Tipagem para os cards de disciplinas
export interface DisciplinaItem {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  icone: string;
  totalLaminas: number;
}

// Dados padrão do catálogo acadêmico
const SLIDES_ACERVO: SlideItem[] = [
  {
    id: 'cw3XGCgUwN71XdlwkUe5',
    title: 'Osso Maduro 40x',
    category: 'Histologia • Tecido Ósseo',
    stain: 'Desgaste • 40x',
    thumbnailUrl: '/assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
    link: '/microscopio?id=cw3XGCgUwN71XdlwkUe5',
    disciplina: 'histologia',
    tags: ['canal de havers', 'ósteon', 'canalículos', 'osteócitos', 'osso compacto'],
  },
  {
    id: 'a3oRvXvJpMKAtU2RE85q',
    title: 'Pele Espessa',
    category: 'Histologia • Sistema Tegumentar',
    stain: 'H&E • 40x',
    thumbnailUrl: '/assets/histologia/lamina-real1-preview.jpg',
    link: '/microscopio?id=a3oRvXvJpMKAtU2RE85q',
    disciplina: 'histologia',
    tags: ['epiderme', 'derme', 'estrato córneo', 'queratinócitos', 'papilas dérmicas'],
  },
  {
    id: 'osso_maduro_desgaste_ct_2.0',
    title: 'Osso Maduro 10x (Visão Geral)',
    category: 'Histologia • Tecido Ósseo',
    stain: 'Desgaste • 10x',
    thumbnailUrl: '/assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
    link: '/microscopio?id=osso_maduro_desgaste_ct_2.0',
    disciplina: 'histologia',
    tags: ['ósteons', 'periósteo', 'endósteo', 'visão panorâmica'],
  },
  {
    id: 'osso_maduro_desgaste_ct',
    title: 'Osso Compacto Descalcificado',
    category: 'Histologia • Matriz Mineral',
    stain: 'H&E • 20x',
    thumbnailUrl: '/assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
    link: '/microscopio?id=osso_maduro_desgaste_ct',
    disciplina: 'histologia',
    tags: ['matriz óssea', 'osteoblastos', 'medula óssea'],
  },
];

const DISCIPLINAS: DisciplinaItem[] = [
  {
    id: 'histologia',
    nome: 'Histologia Geral e Tecidos',
    slug: 'histologia',
    descricao: 'Análise microscópica dos 4 tecidos fundamentais, órgãos e sistemas com técnicas citoquímicas.',
    icone: 'Layers',
    totalLaminas: 48,
  },
  {
    id: 'patologia',
    nome: 'Patologia Geral',
    slug: 'patologia',
    descricao: 'Lesões celulares elementares, processos inflamatórios, distúrbios hemodinâmicos e neoplasias.',
    icone: 'FlaskConical',
    totalLaminas: 32,
  },
  {
    id: 'parasitologia',
    nome: 'Parasitologia Médica',
    slug: 'parasitologia',
    descricao: 'Identificação morfológica de protozoários, helmintos, trofozoítos, cistos, ovos e larvas de interesse clínico.',
    icone: 'Compass',
    totalLaminas: 24,
  },
  {
    id: 'microbiologia',
    nome: 'Microbiologia e Micologia',
    slug: 'microbiologia',
    descricao: 'Bacterioscopia por Gram, colorações de Ziehl-Neelsen e estruturas fúngicas filamentosas e leveduriformes.',
    icone: 'GraduationCap',
    totalLaminas: 18,
  },
];

const FAQ_ITEMS = [
  {
    question: 'O acesso ao acervo é gratuito?',
    answer:
      'Sim. O Palas Atlas é um projeto universitário de acesso aberto, mantido para apoio ao ensino prático e monitorias de saúde. Todo o acervo e ferramentas estão disponíveis sem mensalidades ou cadastros obrigatórios.',
  },
  {
    question: 'O microscópio funciona em dispositivos móveis?',
    answer:
      'Sim. A interface do microscópio se adapta automaticamente a celulares, tablets e notebooks, com suporte nativo a gestos de toque (arraste pelo corte e gesto de pinça para aproximação).',
  },
  {
    question: 'As lâminas do acervo são de espécimes reais?',
    answer:
      'Sim. 100% das lâminas foram digitalizadas a partir de preparações reais sob colorações clássicas de rotina (como Hematoxilina & Eosina, impregnação argêntica e desgastes) utilizadas em laboratórios de patologia e histologia humana.',
  },
  {
    question: 'Posso utilizar as capturas em aulas, seminários ou relatórios?',
    answer:
      'Sim. O uso didático e científico é incentivado para estudantes e docentes. Ao incluir capturas de tela em apresentações ou trabalhos acadêmicos, solicitamos apenas a citação do Palas Atlas como fonte de consulta.',
  },
  {
    question: 'Como relatar uma correção ou sugerir novas lâminas?',
    answer:
      'Caso observe qualquer divergência anatômica ou queira propor novos cortes para digitalização, consulte as informações de contato na página Sobre Nós ou envie sua observação para a equipe de monitoria.',
  },
];

export default function HomePage() {
  // Estados interativos
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIdx((prev) => (prev === idx ? null : idx));
  };

  const totalSlides = SLIDES_ACERVO.length;
  const currentSlide = SLIDES_ACERVO[currentSlideIdx];

  // Rotação automática suave do carrossel de lâminas a cada 8 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      handleNextSlide();
    }, 8000);
    return () => clearInterval(timer);
  }, [currentSlideIdx]);

  const handlePrevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlideIdx((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 220);
  }, [isTransitioning, totalSlides]);

  const handleNextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlideIdx((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 220);
  }, [isTransitioning, totalSlides]);

  // Filtragem de lâminas para o dropdown de busca
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SLIDES_ACERVO.filter((slide) => {
      return (
        slide.title.toLowerCase().includes(q) ||
        slide.category.toLowerCase().includes(q) ||
        (slide.stain && slide.stain.toLowerCase().includes(q)) ||
        (slide.tags && slide.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [searchQuery]);

  // Limpa tag se for genérica
  const isGenericStain = useMemo(() => {
    if (!currentSlide.stain) return true;
    const s = currentSlide.stain.toLowerCase().trim();
    return ['outra', 'outro', 'outras', 'geral', 'campo microscópico', 'campo microscopico'].includes(s);
  }, [currentSlide.stain]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 antialiased selection:bg-teal-500/20 selection:text-slate-900 font-sans">
      
      {/* ============================================================
           1. NAVBAR SUPERIOR (MANTIDA RIGOROSAMENTE INTACTA)
      ============================================================ */}
      <header
        id="palasMinimalHeader"
        className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] transition-all duration-300 pointer-events-auto"
      >
        {/* Filete Superior de Identidade Azul-Petróleo/Teal */}
        <div className="h-[2px] w-full bg-gradient-to-r from-slate-900 via-teal-600 to-slate-900" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[68px] flex items-center justify-between gap-4">
          
          {/* Lado Esquerdo: Logotipo PALAS ATLAS */}
          <div className="flex items-center gap-3 pointer-events-auto shrink-0">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 py-1.5 px-1 transition-all duration-200 cursor-pointer select-none no-underline text-slate-900"
              aria-label="Palas Atlas - Início"
            >
              <span className="font-serif font-bold text-xl sm:text-2xl tracking-[0.2em] leading-none text-slate-900">
                PALAS
              </span>
              <div className="flex items-center justify-center text-teal-700 shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                </svg>
              </div>
              <span className="font-serif font-bold text-xl sm:text-2xl tracking-[0.2em] leading-none text-slate-900">
                ATLAS
              </span>
            </Link>
          </div>

          {/* Centro/Direita: Links Desktop Alinhados à Direita */}
          <nav id="desktopNavLinks" className="hidden lg:flex items-center justify-end gap-7 xl:gap-9 flex-1">
            <a
              href="#secaoDisciplinas"
              className="text-sm font-medium text-slate-600 hover:text-sky-800 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-700 hover:after:w-full after:transition-all after:duration-200 no-underline"
            >
              Disciplinas
            </a>
            <a
              href="#secaoLaminasPopulares"
              className="text-sm font-medium text-slate-600 hover:text-sky-800 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-700 hover:after:w-full after:transition-all after:duration-200 no-underline"
            >
              Lâminas
            </a>
            <a
              href="#secaoComoUsar"
              className="text-sm font-medium text-slate-600 hover:text-sky-800 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-700 hover:after:w-full after:transition-all after:duration-200 no-underline"
            >
              Como Usar
            </a>
            <a
              href="#secaoFAQ"
              className="text-sm font-medium text-slate-600 hover:text-sky-800 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-700 hover:after:w-full after:transition-all after:duration-200 no-underline"
            >
              Dúvidas
            </a>
            <Link
              href="/sobre"
              className="text-sm font-medium text-slate-600 hover:text-sky-800 transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-700 hover:after:w-full after:transition-all after:duration-200 no-underline"
            >
              Sobre Nós
            </Link>
          </nav>

          {/* Lado Direito: Menu Mobile (Oculto em Telas Grandes: lg:hidden) */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 shrink-0 lg:hidden">
            <button
              id="btnOpenDrawer"
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden h-9 px-2.5 sm:px-3.5 rounded-xl bg-slate-100/90 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200/90 hover:border-slate-900 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none shadow-2xs shrink-0"
              aria-label="Abrir Menu"
              title="Menu"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Menu</span>
            </button>
          </div>

        </div>
      </header>

      {/* Backdrop e Drawer Mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-[99990] transition-opacity duration-300"
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-[85vw] max-w-[340px] sm:w-96 bg-white/95 backdrop-blur-2xl text-slate-800 border-l border-slate-200/80 z-[99999] p-5 sm:p-8 flex flex-col justify-between shadow-[0_0_60px_rgba(15,23,42,0.18)] overflow-y-auto transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-7">
          <div className="flex items-center justify-between pb-6 border-b border-slate-200/80">
            <span className="font-serif font-bold text-lg tracking-[0.2em] text-slate-900">
              PALAS ATLAS
            </span>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all duration-200 cursor-pointer active:scale-95"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <span className="text-[10px] tracking-[0.25em] font-mono font-semibold text-slate-400 uppercase mb-3 px-3 block">
              Navegação Principal
            </span>
            <div className="space-y-1">
              <Link
                href="/histologia"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 text-slate-700 hover:text-teal-700 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                <span>Histologia</span>
              </Link>
              <Link
                href="/patologia"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 text-slate-700 hover:text-teal-700 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Patologia</span>
              </Link>
              <Link
                href="/parasitologia"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 text-slate-700 hover:text-teal-700 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Parasitologia</span>
              </Link>
              <Link
                href="/microbiologia"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 text-slate-700 hover:text-teal-700 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span>Microbiologia</span>
              </Link>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-200/80 space-y-1">
            <Link
              href="/sobre"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 text-slate-600 hover:text-teal-700 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
            >
              <Info className="w-4 h-4 text-slate-400" />
              <span>Sobre o Palas Atlas</span>
            </Link>
          </div>
        </div>

        <div className="pt-5 border-t border-slate-200/80 text-center text-[10px] text-slate-400 font-mono tracking-widest uppercase">
          Palas Atlas &bull; Acervo Morfológico Digital
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main id="mainRouterContainer" className="flex-1 w-full flex flex-col justify-center">

        {/* ============================================================
             1. PRIMEIRA FAIXA: APRESENTAÇÃO INSTITUCIONAL (SUPERFÍCIE ATMOSFÉRICA)
        ============================================================ */}
        <section
          id="secaoInstitucionalTopo"
          className="relative overflow-hidden bg-gradient-to-b from-[#edf4f3] via-[#f5f9f8] to-white pt-14 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-200/80"
        >
          {/* Iluminação suave puramente estética */}
          <div className="pointer-events-none absolute -top-24 right-1/4 w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-3xl" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center relative z-10">
            
            {/* Coluna Esquerda (lg:col-span-6): Peso Editorial */}
            <div className="lg:col-span-6 flex flex-col items-start text-left justify-center">
              
              {/* Pílula superior com fundo branco elevado */}
              <div className="inline-flex items-center gap-2 bg-white/90 border border-teal-900/10 shadow-sm text-teal-950 text-[11px] font-semibold tracking-widest uppercase px-3.5 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                <span>• ATLAS MORFOLÓGICO DIGITAL</span>
              </div>

              {/* Título Principal com alto impacto tipográfico e Ciências Morfológicas em fonte serifada */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-slate-950 leading-[1.08] text-left">
                Atlas Integrado de <br />
                <span className="font-serif text-teal-900 font-bold">Ciências Morfológicas</span>
              </h1>

              {/* Subtítulo Limpo */}
              <p className="text-slate-600 text-base sm:text-lg font-sans font-normal leading-relaxed max-w-xl text-left mt-5">
                Explore lâminas microscópicas reais em alta definição com navegação óptica interativa.
              </p>

              {/* Rodapé institucional discreto separado por linha fina */}
              <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
                <span>Ensino Morfológico Universitário</span>
                <span className="text-slate-300">•</span>
                <span>Acesso 100% Aberto</span>
                <span className="text-slate-300">•</span>
                <span>Navegação Óptica Interativa</span>
              </div>
            </div>

            {/* Coluna Direita (lg:col-span-6): Grid 2x2 Escalonado */}
            <div className="lg:col-span-6 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 items-start">
                
                {/* Card 1: Alta Definição */}
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)] hover:shadow-[0_12px_36px_rgb(13,148,136,0.08)] hover:-translate-y-0.5 hover:border-teal-700/30 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mb-3.5">
                    <Microscope className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    Alta Definição
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cortes histológicos digitalizados com nitidez óptica real.
                  </p>
                </div>

                {/* Card 2: Técnicas e Colorações (deslocamento vertical sm:even:mt-6) */}
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)] hover:shadow-[0_12px_36px_rgb(13,148,136,0.08)] hover:-translate-y-0.5 hover:border-teal-700/30 transition-all duration-300 sm:mt-6">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mb-3.5">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    Técnicas e Colorações
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Preparações em H&E, desgastes ósseos e colorações especiais.
                  </p>
                </div>

                {/* Card 3: Pinos Morfológicos */}
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)] hover:shadow-[0_12px_36px_rgb(13,148,136,0.08)] hover:-translate-y-0.5 hover:border-teal-700/30 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mb-3.5">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    Pinos Morfológicos
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Marcações interativas com critérios precisos de identificação.
                  </p>
                </div>

                {/* Card 4: Acervo Universitário (deslocamento vertical sm:even:mt-6) */}
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgb(15,23,42,0.04)] hover:shadow-[0_12px_36px_rgb(13,148,136,0.08)] hover:-translate-y-0.5 hover:border-teal-700/30 transition-all duration-300 sm:mt-6">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mb-3.5">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    Acervo Universitário
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Iniciativa acadêmica aberta e gratuita para estudo morfológico.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* Pílula Divisória Centralizada sobre a Linha Divisória (100% visível, fora de overflow-hidden) */}
        <div className="relative z-20 -my-3.5 flex justify-center pointer-events-none">
          <span className="pointer-events-auto bg-white border border-slate-200/90 shadow-sm text-[11px] font-medium text-slate-500 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 select-none">
            <span>↓</span> Role para pesquisar e explorar as lâminas
          </span>
        </div>

        {/* ============================================================
             2. SEGUNDA FAIXA: BUSCA E VITRINE (CONSOLE INTEGRADO)
        ============================================================ */}
        <section
          id="secaoBuscaVitrine"
          className="pt-8 pb-12 lg:pt-10 lg:pb-16 border-b border-slate-200/60 relative bg-[#f8fafc]"
        >
          {/* Malha Arquitetônica Limpa Contínua no Fundo da Segunda Faixa */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
            <div
              id="homeBgGrid"
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse 90% 75% at 50% 30%, #000 45%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 90% 75% at 50% 30%, #000 45%, transparent 100%)',
              }}
            />
            <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,_rgba(3,105,161,0.06)_0%,_transparent_70%)]" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

            {/* Console Integrado: Container estruturado que envolve Busca + Vitrine */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_12px_40px_rgb(15,23,42,0.04)] p-6 sm:p-8 lg:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                
                {/* Coluna Esquerda (lg:col-span-6 — Localizador): Título Sóbrio + Busca + CTAs + Atalhos */}
                <div className="lg:col-span-6 flex flex-col items-start text-left justify-center">

                  {/* a) Título sóbrio sem etiquetas em caixa alta acima */}
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">
                    Pesquise no Acervo Morfológico
                  </h2>

                  {/* b) Barra de Busca Integrada */}
                  <div className="w-full max-w-xl relative z-30 group" id="global-search-container">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-700 transition-colors z-20">
                      <Search className="w-5 h-5" />
                    </div>
                    
                    <input
                      type="text"
                      id="global-search-input"
                      name="palas_atlas_search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-white border border-slate-200/90 focus:border-sky-600 rounded-xl py-4 pl-12 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all relative z-10 shadow-sm focus:shadow-[0_14px_32px_-6px_rgba(3,105,161,0.15)]"
                      placeholder="Buscar tecidos, órgãos ou lâminas..."
                    />

                    {/* Botão de limpar */}
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-800 transition-colors cursor-pointer z-20"
                        aria-label="Limpar busca"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}

                    {/* Dropdown de Resultados da Busca */}
                    {isSearchFocused && searchQuery.trim() !== '' && (
                      <div
                        id="global-search-dropdown"
                        className="absolute top-full left-0 w-full z-50 mt-2 text-left"
                      >
                        <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_24px_60px_rgba(15,23,42,0.18)] overflow-hidden max-h-80 overflow-y-auto">
                          {searchResults.length > 0 ? (
                            <ul className="flex flex-col divide-y divide-slate-100">
                              {searchResults.map((res) => (
                                <li key={res.id}>
                                  <Link
                                    href={res.link}
                                    className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm group/item"
                                  >
                                    <div>
                                      <span className="font-semibold text-slate-900 group-hover/item:text-teal-700 block">
                                        {res.title}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {res.category} {res.stain && `• ${res.stain}`}
                                      </span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover/item:text-teal-700 group-hover/item:translate-x-1 transition-all" />
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              Nenhuma lâmina encontrada.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botões de Ação */}
                  <div className="relative z-10 flex flex-wrap gap-3.5 items-center justify-start w-full mt-5">
                    <Link
                      href="/histologia"
                      id="btnHeroPrimary"
                      className="bg-slate-900 hover:bg-black text-white rounded-xl px-6 py-3.5 transition-all duration-200 flex items-center justify-center gap-2.5 group cursor-pointer text-xs font-semibold tracking-wide shadow-sm hover:shadow active:scale-95 no-underline"
                    >
                      <span>Explorar Lâminas</span>
                      <ArrowRight className="w-4 h-4 text-[#d4af37] group-hover:translate-x-0.5 transition-transform duration-150" />
                    </Link>

                    <Link
                      href="/sobre"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-all duration-200 text-xs font-semibold shadow-xs no-underline active:scale-95"
                    >
                      Sobre o Projeto
                    </Link>
                  </div>

                  {/* Atalhos de Disciplina Rápidos */}
                  <div className="pt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      ATALHOS:
                    </span>
                    <Link
                      href="/histologia"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200/90 transition-colors text-xs font-medium shadow-2xs no-underline"
                    >
                      Histologia
                    </Link>
                    <Link
                      href="/patologia"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/90 transition-colors text-xs font-medium shadow-2xs no-underline"
                    >
                      Patologia
                    </Link>
                    <Link
                      href="/parasitologia"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200/90 transition-colors text-xs font-medium shadow-2xs no-underline"
                    >
                      Parasitologia
                    </Link>
                    <Link
                      href="/microbiologia"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-600 hover:text-violet-700 border border-slate-200/90 transition-colors text-xs font-medium shadow-2xs no-underline"
                    >
                      Microbiologia
                    </Link>
                  </div>

                </div>

                {/* Coluna Direita (lg:col-span-6 — Card da Lâmina): Vitrine de Lâminas */}
                <div className="lg:col-span-6 w-full">
                  <div
                    id="heroSlideShowcase"
                    className="group/showcase relative z-20 w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-[#060608] border border-slate-200/90 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)] flex flex-col justify-between p-5 sm:p-7 select-none"
                  >
                    {/* Imagem de Microscopia com Zoom Suave */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <img
                        id="vitrineImage"
                        src={currentSlide.thumbnailUrl}
                        alt={currentSlide.title}
                        className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                          isTransitioning ? 'opacity-0 scale-100' : 'opacity-100 scale-105'
                        }`}
                      />
                    </div>

                    {/* Degradê Escuro Suave na Base */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                    {/* Topo da Vitrine: Tag Superior Discreta (Oculta se genérica) */}
                    <div
                      id="vitrineBadgeWrapper"
                      className={`relative z-10 flex items-center justify-start gap-2 transition-opacity duration-300 ${
                        isGenericStain ? 'hidden' : 'flex'
                      }`}
                    >
                      <span
                        id="vitrineStainBadge"
                        className="bg-black/60 border border-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-[11px] font-semibold tracking-wider text-white shadow-sm"
                      >
                        {currentSlide.stain}
                      </span>
                    </div>

                    {/* Base da Vitrine: Classificação Limpa, Título e Controles */}
                    <div className="relative z-10 flex flex-col gap-2.5 mt-auto">
                      <div
                        id="vitrineTextContent"
                        className={`space-y-1 text-left transition-opacity duration-300 ${
                          isTransitioning ? 'opacity-0' : 'opacity-100'
                        }`}
                      >
                        <span
                          id="vitrineCategory"
                          className="text-[11px] tracking-[0.16em] uppercase text-white/90 font-semibold"
                        >
                          {currentSlide.category}
                        </span>
                        
                        <h3
                          id="vitrineTitle"
                          className="font-serif font-bold text-xl sm:text-2xl text-white leading-snug tracking-tight drop-shadow-sm"
                        >
                          {currentSlide.title}
                        </h3>
                      </div>

                      {/* Rodapé da Vitrine: Link Direto e Paginação Discreta */}
                      <div className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-4">
                        <Link
                          id="vitrineActionBtn"
                          href={currentSlide.link}
                          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white hover:text-sky-300 transition-colors duration-150 group/link no-underline"
                        >
                          <span>Abrir no Microscópio</span>
                          <ArrowRight className="w-4 h-4 text-sky-400 group-hover/link:translate-x-1 transition-transform duration-200" />
                        </Link>

                        <div className="flex items-center gap-1 text-xs text-white select-none bg-black/60 border border-white/15 backdrop-blur-md rounded-full px-2 py-0.5">
                          <button
                            type="button"
                            id="vitrinePrevBtn"
                            onClick={handlePrevSlide}
                            className="text-white/80 hover:text-white transition-all duration-200 p-1 rounded-full hover:bg-white/15 cursor-pointer focus:outline-none flex items-center justify-center active:scale-90"
                            aria-label="Lâmina anterior"
                            title="Lâmina anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <span
                            id="vitrineCounter"
                            className="text-[11px] tracking-wider text-white font-semibold px-2"
                          >
                            {String(currentSlideIdx + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                          </span>

                          <button
                            type="button"
                            id="vitrineNextBtn"
                            onClick={handleNextSlide}
                            className="text-white/80 hover:text-white transition-all duration-200 p-1 rounded-full hover:bg-white/15 cursor-pointer focus:outline-none flex items-center justify-center active:scale-90"
                            aria-label="Próxima lâmina"
                            title="Próxima lâmina"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ============================================================
             4. SEÇÃO DE DISCIPLINAS E RESTANTE DA PÁGINA
        ============================================================ */}
        <section
          id="secaoDisciplinas"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative z-10 transition-all duration-500 ease-out"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8 pb-4 border-b border-slate-200/80">
            <div>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-teal-700 font-semibold block mb-1">
                Grade Acadêmica
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-[-0.02em]">
                Disciplinas
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              Módulos didáticos estruturados do ciclo básico da Medicina
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {DISCIPLINAS.map((disc) => (
              <Link
                key={disc.id}
                href={`/${disc.slug}`}
                className="group p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-600/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between no-underline"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {disc.icone === 'Layers' && <Layers className="w-5 h-5" />}
                    {disc.icone === 'FlaskConical' && <FlaskConical className="w-5 h-5" />}
                    {disc.icone === 'Compass' && <Compass className="w-5 h-5" />}
                    {disc.icone === 'GraduationCap' && <GraduationCap className="w-5 h-5" />}
                  </div>

                  <h3 className="font-serif font-bold text-lg text-slate-900 group-hover:text-teal-800 transition-colors">
                    {disc.nome}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {disc.descricao}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-teal-700 transition-colors">
                  <span className="font-medium">{disc.totalLaminas} lâminas catalogadas</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ============================================================
             5. LÂMINAS POPULARES (GALERIA ACADÊMICA)
        ============================================================ */}
        <section
          id="secaoLaminasPopulares"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 relative z-10"
        >
          <div className="mb-8 pb-4 border-b border-slate-200/80 text-left">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-950 tracking-tight">
              Lâminas Populares
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Cortes histológicos de referência para estudo prático.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SLIDES_ACERVO.map((slide) => (
              <div
                key={slide.id}
                className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgb(13,148,136,0.08)] hover:-translate-y-1 hover:border-teal-700/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="relative w-full aspect-[4/3] bg-slate-950 overflow-hidden">
                    <img
                      src={slide.thumbnailUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
                    
                    {slide.stain && (
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <span className="bg-black/75 backdrop-blur-sm text-white border border-white/10 text-[10px] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                          {slide.stain}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-semibold">
                        {slide.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 group-hover:text-teal-900 transition-colors leading-snug mb-1">
                      {slide.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      {slide.stain?.includes('Desgaste')
                        ? 'Técnica de descalcificação e desgaste'
                        : slide.stain?.includes('H&E')
                        ? 'Coloração H&E de rotina'
                        : 'Espécime microscópico catalogado'}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 mt-auto">
                  <Link
                    href={slide.link}
                    className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-teal-900 hover:text-white border border-slate-200 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2 group/btn no-underline"
                  >
                    <span>Examinar Lâmina</span>
                    <span className="text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-transform">
                      &rarr;
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
             6. GUIA EDITORIAL DO MICROSCÓPIO (COMO USAR)
        ============================================================ */}
        <section
          id="secaoComoUsar"
          className="w-full bg-slate-50/60 border-t border-slate-200/80 py-16 lg:py-24 relative z-10 transition-colors duration-300"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              
              {/* Coluna Esquerda (lg:col-span-4 — Fixa/Editorial) */}
              <div className="lg:col-span-4 flex flex-col items-start text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  Navegação no Microscópio
                </h2>
                <p className="mt-3 text-slate-600 text-base leading-relaxed">
                  As lâminas são digitalizadas integralmente para permitir o estudo progressivo do corte — da arquitetura geral do órgão ao detalhe celular.
                </p>
                <div className="mt-6 pt-5 border-t border-slate-200/80 text-xs text-slate-500 leading-relaxed">
                  Dica de estudo: inicie sempre pelo menor aumento para reconhecer as camadas teciduais antes de aproximar o campo.
                </div>
              </div>

              {/* Coluna Direita (lg:col-span-8 — Grade Editorial Contínua) */}
              <div className="lg:col-span-8 w-full">
                <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-200/80 shadow-[0_4px_20px_rgb(15,23,42,0.03)]">
                  
                  {/* Faixa 1: Varredura da Lâmina */}
                  <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <h3 className="sm:w-1/3 font-semibold text-slate-900 text-base">
                      Varredura da Lâmina
                    </h3>
                    <p className="sm:w-2/3 text-sm text-slate-600 leading-relaxed">
                      Percorra toda a extensão da peça arrastando o campo com o mouse ou com o toque. A aproximação é contínua pelo scroll ou gesto de pinça, sem perda de definição entre os campos.
                    </p>
                  </div>

                  {/* Faixa 2: Escala de Aumentos */}
                  <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <h3 className="sm:w-1/3 font-semibold text-slate-900 text-base">
                      Escala de Aumentos
                    </h3>
                    <p className="sm:w-2/3 text-sm text-slate-600 leading-relaxed">
                      Alterne rapidamente entre as referências de 4× (visão panorâmica e topografia), 10×, 40× e 100× pelo seletor no canto inferior da tela, seguindo a mesma progressão do microscópio óptico.
                    </p>
                  </div>

                  {/* Faixa 3: Marcações e Critérios */}
                  <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <h3 className="sm:w-1/3 font-semibold text-slate-900 text-base">
                      Marcações e Critérios
                    </h3>
                    <p className="sm:w-2/3 text-sm text-slate-600 leading-relaxed">
                      Acione os pinos sobre o corte para abrir a descrição morfológica de cada estrutura, revisar as relações entre os tecidos ou ocultar as marcações durante a revisão prática.
                    </p>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ============================================================
             7. PERGUNTAS FREQUENTES (FAQ ACADÊMICO)
        ============================================================ */}
        <section
          id="secaoFAQ"
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative z-10"
        >
          <div className="text-center">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-950 tracking-tight text-center">
              Perguntas Frequentes
            </h2>
            <p className="text-sm text-slate-600 text-center mt-1 mb-10">
              Esclarecimentos sobre o acesso ao acervo, navegação e uso das lâminas.
            </p>
          </div>

          <div className="space-y-3" id="faqAccordionContainer">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/80 rounded-xl mb-3 px-6 py-4 transition-all hover:border-teal-700/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-slate-900 text-sm sm:text-base leading-snug">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-teal-800' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pt-3 text-xs sm:text-sm text-slate-600 font-sans leading-relaxed border-t border-slate-100 mt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BLOCO FINAL: ASSINATURA INSTITUCIONAL DE ENCERRAMENTO */}
          <div className="mt-16 pt-10 border-t border-slate-200/80 text-center max-w-xl mx-auto">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Feito por estudantes para estudantes.
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 font-sans">
              Integramos a teoria morfológica à rotina prática do laboratório acadêmico.
            </p>
            <Link
              href="/sobre"
              className="text-xs font-semibold text-teal-800 hover:text-teal-950 transition-colors inline-flex items-center gap-1.5 no-underline group"
            >
              <span>Conhecer o projeto e a equipe</span>
              <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </Link>
          </div>
        </section>

      </main>

      {/* Rodapé Institucional Minimalista */}
      <footer className="w-full py-10 px-6 border-t border-slate-200/80 text-center text-xs text-slate-500 font-sans mt-auto bg-white">
        <p>
          &copy; 2026 Palas Atlas &mdash; Projeto Acadêmico sem fins lucrativos. Desenvolvido para o ensino médico de excelência.
        </p>
      </footer>

    </div>
  );
}
