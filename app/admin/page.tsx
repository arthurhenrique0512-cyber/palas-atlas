'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Lamina, Disciplina, Topico, Pino } from '@/lib/supabase/types';
import { fallbackLaminas, fallbackDisciplinas, fallbackTopicos } from '@/lib/data/fallback';
import { 
  Plus, Database, CheckCircle, AlertCircle, RefreshCw, 
  MapPin, Eye, Trash2, Edit3, Layers, BookOpen, ExternalLink, 
  Copy, Check, Search, Filter, Sparkles, Navigation, X,
  Bold, Italic, AlignLeft, Hash, Info
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'acervo' | 'novo' | 'pinos' | 'topicos' | 'guia'>('acervo');
  const [laminas, setLaminas] = useState<Lamina[]>(Object.values(fallbackLaminas));
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(fallbackDisciplinas);
  const [topicos, setTopicos] = useState<Topico[]>(fallbackTopicos);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Filtros de busca no acervo
  const [busca, setBusca] = useState('');
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');

  // Modo de Edição / Criação de Lâmina
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [slugManual, setSlugManual] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('histologia');
  const [topicoId, setTopicoId] = useState('osseo');
  const [coloracao, setColoracao] = useState('Hematoxilina e Eosina (H&E)');
  const [dziUrl, setDziUrl] = useState('');
  const [maxMag, setMaxMag] = useState<4 | 10 | 40 | 60 | 100>(40);
  const [descricao, setDescricao] = useState('');
  const [abaDescricao, setAbaDescricao] = useState<'editor' | 'preview'>('editor');

  // Editor Visual de Pinos
  const [laminaSelecionadaId, setLaminaSelecionadaId] = useState<string>('osso_maduro_desgaste_ct');
  const [novoRotuloPino, setNovoRotuloPino] = useState('');
  const [categoriaPino, setCategoriaPino] = useState('Estrutura Geral');
  const [modoAdicionarPino, setModoAdicionarPino] = useState(false);
  const [coordenadaPinoTemp, setCoordenadaPinoTemp] = useState<{ x: number; y: number } | null>(null);
  const [pinoFocadoId, setPinoFocadoId] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Novo Tópico
  const [novoTopicoTitulo, setNovoTopicoTitulo] = useState('');
  const [novoTopicoDisciplina, setNovoTopicoDisciplina] = useState('histologia');
  const [novoTopicoResumo, setNovoTopicoResumo] = useState('');

  // Guia Interativo de Comandos
  const [guiaSlug, setGuiaSlug] = useState('cortex_cerebral');

  const osdContainerRef = useRef<HTMLDivElement>(null);
  const osdViewerInstance = useRef<any>(null);

  const showMsg = (texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    setFeedback({ texto, tipo });
    setTimeout(() => setFeedback(null), 4500);
  };

  const fetchSupabaseData = async () => {
    setLoading(true);
    const supabase = createClient();
    if (supabase) {
      try {
        const { data: discs } = await supabase.from('disciplinas').select('*').order('ordem');
        if (discs && discs.length > 0) setDisciplinas(discs);

        const { data: tops } = await supabase.from('topicos').select('*').order('ordem');
        if (tops && tops.length > 0) setTopicos(tops);

        const { data: lams } = await supabase.from('laminas').select('*, pinos(*)').order('created_at', { ascending: false });
        if (lams && lams.length > 0) {
          setLaminas(lams);
          setDbConnected(true);
        }
      } catch (err: any) {
        console.warn('Erro ao carregar dados do Supabase:', err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSupabaseData();
  }, []);

  // Inicializa o viewer do OpenSeadragon no editor de pinos
  useEffect(() => {
    if (activeTab !== 'pinos') {
      if (osdViewerInstance.current) {
        try { osdViewerInstance.current.destroy(); } catch (e) {}
        osdViewerInstance.current = null;
      }
      return;
    }

    let isCancelled = false;
    const lamina = laminas.find(l => l.id === laminaSelecionadaId);
    if (!lamina || !osdContainerRef.current) return;

    const initOSD = async () => {
      const OpenSeadragonModule = (await import('openseadragon')).default;
      if (isCancelled || !osdContainerRef.current) return;

      if (osdViewerInstance.current) {
        try { osdViewerInstance.current.destroy(); } catch (e) {}
        osdViewerInstance.current = null;
      }

      const imageUrl = lamina.dzi_url || lamina.preview_image || '';
      const isDzi = imageUrl.endsWith('.dzi') || imageUrl.includes('.dzi?');
      const tileSources = isDzi ? imageUrl : { type: 'image', url: imageUrl };

      const viewer = OpenSeadragonModule({
        element: osdContainerRef.current,
        prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/',
        tileSources: tileSources,
        showNavigationControl: false,
        showSequenceControl: false,
        gestureSettingsMouse: { clickToZoom: false, scrollToZoom: true, dblClickToZoom: true, dragToPan: true }
      });

      osdViewerInstance.current = viewer;

      // Renderiza overlays dos pinos existentes
      viewer.addHandler('open', () => {
        viewer.clearOverlays();
        if (lamina.pinos && lamina.pinos.length > 0) {
          lamina.pinos.forEach((pino) => {
            const ponto = viewer.viewport.imageToViewportCoordinates(
              new OpenSeadragonModule.Point(Number(pino.x) || 0, Number(pino.y) || 0)
            );
            const el = document.createElement('div');
            el.id = `osd-pin-${pino.id}`;
            el.className = 'w-6 h-6 rounded-full bg-[#d4af37] border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-black cursor-pointer hover:scale-125 transition-transform';
            el.textContent = pino.rotulo.charAt(0);
            el.title = `${pino.rotulo} (X: ${pino.x}, Y: ${pino.y})`;
            el.onclick = (e) => {
              e.stopPropagation();
              focarPino(pino);
            };
            viewer.addOverlay({ element: el, location: ponto, placement: OpenSeadragonModule.Placement.CENTER });
          });
        }
      });

      // Clique para capturar coordenadas
      viewer.addHandler('canvas-click', (event: any) => {
        if (!event.quick) return;
        const webPoint = event.position;
        const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
        const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

        const x = Math.round(imagePoint.x);
        const y = Math.round(imagePoint.y);

        setCoordenadaPinoTemp({ x, y });
        setModoAdicionarPino(true);
      });
    };

    initOSD();

    return () => {
      isCancelled = true;
      if (osdViewerInstance.current) {
        try { osdViewerInstance.current.destroy(); } catch (e) {}
        osdViewerInstance.current = null;
      }
    };
  }, [activeTab, laminaSelecionadaId, laminas]);

  // Função para voar/focar no pino selecionado
  const focarPino = async (pino: Pino) => {
    setPinoFocadoId(pino.id);
    const viewer = osdViewerInstance.current;
    if (!viewer) return;

    const OpenSeadragonModule = (await import('openseadragon')).default;
    const ponto = viewer.viewport.imageToViewportCoordinates(
      new OpenSeadragonModule.Point(Number(pino.x) || 0, Number(pino.y) || 0)
    );

    viewer.viewport.panTo(ponto, false);
    const curZoom = viewer.viewport.getZoom();
    if (curZoom < 2.0) {
      viewer.viewport.zoomTo(2.5, false);
    }
  };

  // Salvar Novo Pino
  const handleSalvarPino = async () => {
    if (!novoRotuloPino || !coordenadaPinoTemp) {
      showMsg('Informe o rótulo do marcador.', 'erro');
      return;
    }

    const pinoId = `pin-${Date.now().toString(36)}`;
    const novoPino: Pino = {
      id: pinoId,
      lamina_id: laminaSelecionadaId,
      rotulo: novoRotuloPino,
      x: coordenadaPinoTemp.x,
      y: coordenadaPinoTemp.y,
      descricao: categoriaPino,
      ordem: 0
    };

    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('pinos').insert([novoPino]);
      if (error) {
        showMsg(`Erro ao salvar no Supabase: ${error.message}`, 'erro');
        return;
      }
    }

    // Atualiza localmente
    setLaminas(prev => prev.map(l => {
      if (l.id === laminaSelecionadaId) {
        return { ...l, pinos: [...(l.pinos || []), novoPino] };
      }
      return l;
    }));

    showMsg(`Marcador "${novoRotuloPino}" registrado com sucesso!`, 'ok');
    setNovoRotuloPino('');
    setCoordenadaPinoTemp(null);
    setModoAdicionarPino(false);
  };

  // Excluir Pino
  const handleExcluirPino = async (pinoId: string) => {
    const supabase = createClient();
    if (supabase) {
      await supabase.from('pinos').delete().eq('id', pinoId);
    }
    setLaminas(prev => prev.map(l => {
      if (l.id === laminaSelecionadaId) {
        return { ...l, pinos: (l.pinos || []).filter(p => p.id !== pinoId) };
      }
      return l;
    }));
    showMsg('Marcador removido.', 'ok');
  };

  // Iniciar Edição de Lâmina Existente
  const iniciarEdicaoLamina = (lamina: Lamina) => {
    setEditandoId(lamina.id);
    setNome(lamina.nome);
    setSlugManual(lamina.slug || lamina.id);
    setDisciplinaId(lamina.disciplina_id);
    setTopicoId(lamina.topico_id || 'osseo');
    setColoracao(lamina.coloracao || 'Hematoxilina e Eosina (H&E)');
    setDziUrl(lamina.dzi_url || '');
    setMaxMag(lamina.max_magnification || 40);
    setDescricao(lamina.descricao_html || '');
    setActiveTab('novo');
  };

  // Resetar Formulário de Lâmina
  const resetarFormulario = () => {
    setEditandoId(null);
    setNome('');
    setSlugManual('');
    setDisciplinaId('histologia');
    setTopicoId('osseo');
    setColoracao('Hematoxilina e Eosina (H&E)');
    setDziUrl('');
    setMaxMag(40);
    setDescricao('');
  };

  // Salvar / Atualizar Lâmina (CRUD Completo)
  const handleSalvarLamina = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !dziUrl) {
      showMsg('Preencha o nome e o caminho/URL do DZI.', 'erro');
      return;
    }

    const slug = slugManual.trim() || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const previewUrl = dziUrl.replace('.dzi', '-preview.jpg');

    const dadosLamina: Partial<Lamina> = {
      nome,
      slug,
      disciplina_id: disciplinaId,
      topico_id: topicoId,
      coloracao,
      max_magnification: maxMag,
      mpp: 0.25,
      status: 'ativa',
      dzi_url: dziUrl,
      thumbnail_url: previewUrl,
      preview_image: previewUrl,
      descricao_html: descricao || `<p>Preparação histológica de ${nome}.</p>`,
      updated_at: new Date().toISOString()
    };

    const supabase = createClient();

    if (editandoId) {
      // MODO EDIÇÃO (UPDATE)
      if (supabase) {
        const { error } = await supabase.from('laminas').update(dadosLamina).eq('id', editandoId);
        if (error) {
          showMsg(`Erro ao atualizar lâmina: ${error.message}`, 'erro');
          return;
        }
      }
      setLaminas(prev => prev.map(l => l.id === editandoId ? { ...l, ...dadosLamina } as Lamina : l));
      showMsg(`Lâmina "${nome}" atualizada com sucesso!`, 'ok');
    } else {
      // MODO CRIAÇÃO (INSERT)
      const novaLamina: Lamina = {
        id: slug,
        ...dadosLamina as any,
        created_at: new Date().toISOString(),
        pinos: []
      };

      if (supabase) {
        const { error } = await supabase.from('laminas').insert([novaLamina]);
        if (error) {
          showMsg(`Erro ao salvar no banco: ${error.message}`, 'erro');
          return;
        }
      }
      setLaminas([novaLamina, ...laminas]);
      showMsg(`Lâmina "${nome}" cadastrada com sucesso!`, 'ok');
    }

    resetarFormulario();
    setActiveTab('acervo');
  };

  // Excluir Lâmina
  const handleExcluirLamina = async (id: string) => {
    if (!confirm('Deseja realmente remover esta lâmina do catálogo?')) return;

    const supabase = createClient();
    if (supabase) {
      await supabase.from('laminas').delete().eq('id', id);
    }
    setLaminas(prev => prev.filter(l => l.id !== id));
    showMsg('Lâmina excluída com sucesso.', 'ok');
  };

  // Auxiliares de Preenchimento Rápido do DZI
  const preencherDziCloud = () => {
    const slug = slugManual || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    const cloudUrl = `https://omdgpncqtswnqpphfovo.supabase.co/storage/v1/object/public/laminas-dzi/${slug}.dzi`;
    setDziUrl(cloudUrl);
    if (!slugManual) setSlugManual(slug);
  };

  const preencherDziLocal = () => {
    const slug = slugManual || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    const localUrl = `assets/histologia/${slug}.dzi`;
    setDziUrl(localUrl);
    if (!slugManual) setSlugManual(slug);
  };

  // Inserção de tags HTML no editor de descrição
  const inserirTagHtml = (abertura: string, fechamento: string) => {
    const textarea = document.getElementById('descricao-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const textoSel = descricao.substring(inicio, fim) || 'texto';
    const novoTexto = descricao.substring(0, inicio) + abertura + textoSel + fechamento + descricao.substring(fim);
    setDescricao(novoTexto);
  };

  // Criar Novo Tópico
  const handleCriarTopico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTopicoTitulo) return;

    const slug = novoTopicoTitulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const novoTopico: Topico = {
      id: slug,
      disciplina_id: novoTopicoDisciplina,
      titulo: novoTopicoTitulo,
      slug,
      resumo: novoTopicoResumo,
      ordem: topicos.length + 1
    };

    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('topicos').insert([novoTopico]);
      if (error) {
        showMsg(`Erro ao criar módulo: ${error.message}`, 'erro');
        return;
      }
    }

    setTopicos([...topicos, novoTopico]);
    showMsg(`Módulo "${novoTopicoTitulo}" criado!`, 'ok');
    setNovoTopicoTitulo('');
    setNovoTopicoResumo('');
  };

  // Excluir Tópico
  const handleExcluirTopico = async (id: string) => {
    if (!confirm('Deseja realmente remover este módulo acadêmico?')) return;
    const supabase = createClient();
    if (supabase) {
      await supabase.from('topicos').delete().eq('id', id);
    }
    setTopicos(prev => prev.filter(t => t.id !== id));
    showMsg('Módulo excluído.', 'ok');
  };

  // Filtragem do Acervo
  const laminasFiltradas = laminas.filter(l => {
    const matchesBusca = busca === '' || 
      l.nome.toLowerCase().includes(busca.toLowerCase()) ||
      l.coloracao.toLowerCase().includes(busca.toLowerCase()) ||
      l.id.toLowerCase().includes(busca.toLowerCase());
    const matchesDisc = filtroDisciplina === 'todas' || l.disciplina_id === filtroDisciplina;
    return matchesBusca && matchesDisc;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-20 space-y-8">
        
        {/* Cabeçalho do Painel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                Painel Administrativo &bull; Palas Atlas 3.0
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Gestão de Acervo e Bancada Morfológica
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              dbConnected 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-[#d4af37]/10 border-[#d4af37]/20 text-[#d4af37]'
            }`}>
              <Database className="w-3.5 h-3.5" />
              <span>{dbConnected ? 'PostgreSQL Conectado' : 'Supabase Ativo'}</span>
            </span>
            <button
              onClick={fetchSupabaseData}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-all cursor-pointer"
              title="Atualizar dados do banco"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notificações / Feedback */}
        {feedback && (
          <div className={`p-4 rounded-xl text-xs font-mono border transition-all ${
            feedback.tipo === 'ok'
              ? 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedback.texto}
          </div>
        )}

        {/* Abas de Navegação do CMS */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-4 overflow-x-auto">
          {[
            { id: 'acervo', label: `1. Acervo de Lâminas (${laminas.length})`, icon: Layers },
            { id: 'novo', label: editandoId ? '2. Editar Lâmina' : '2. Cadastrar Lâmina', icon: Plus },
            { id: 'pinos', label: '3. Mapeador de Pinos (Point & Click)', icon: MapPin },
            { id: 'topicos', label: '4. Módulos & Tópicos', icon: BookOpen },
            { id: 'guia', label: '5. Guia de Bancada & Pipeline', icon: ExternalLink }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'novo' && !editandoId) resetarFormulario();
                  setActiveTab(tab.id as any);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] shadow-sm font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DAS ABAS */}

        {/* ABA 1: ACERVO */}
        {activeTab === 'acervo' && (
          <div className="space-y-6">
            {/* Barra de Filtros e Ações */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por espécime, coloração..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <select
                    value={filtroDisciplina}
                    onChange={(e) => setFiltroDisciplina(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-neutral-300 focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="todas">Todas as Disciplinas</option>
                    {disciplinas.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  resetarFormulario();
                  setActiveTab('novo');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e0c97f] text-neutral-950 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Lâmina</span>
              </button>
            </div>

            {/* Grid de Cards de Lâminas */}
            {laminasFiltradas.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-white/[0.01] border border-dashed border-white/[0.08] space-y-2">
                <p className="text-sm font-mono text-neutral-400">Nenhuma lâmina encontrada para o filtro selecionado.</p>
                <button
                  onClick={() => { setBusca(''); setFiltroDisciplina('todas'); }}
                  className="text-xs text-[#d4af37] hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {laminasFiltradas.map((lamina) => (
                  <div
                    key={lamina.id}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-all flex flex-col justify-between space-y-4 group hover:bg-white/[0.03]"
                  >
                    <div>
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-xl bg-neutral-950 overflow-hidden border border-white/[0.08] shrink-0 relative group-hover:border-[#d4af37]/40 transition-colors">
                          <img
                            src={lamina.thumbnail_url || lamina.preview_image || '/assets/histologia/medula-espinal-he.png'}
                            alt={lamina.nome}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 font-mono text-[9px] text-[#d4af37]">
                            {lamina.max_magnification || 40}x
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono tracking-widest text-[#d4af37] uppercase">
                            {lamina.disciplina_id} &bull; {lamina.coloracao}
                          </span>
                          <h3 className="text-base font-serif font-bold text-white truncate mt-0.5">
                            {lamina.nome}
                          </h3>
                          <p className="text-[11px] font-mono text-neutral-400 mt-1 truncate">
                            ID: {lamina.id}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {lamina.descricao_html?.replace(/<[^>]*>?/gm, '') || 'Sem descrição cadastrada.'}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>{lamina.pinos?.length || 0} pinos</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setLaminaSelecionadaId(lamina.id);
                            setActiveTab('pinos');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                          title="Mapear Marcadores"
                        >
                          <MapPin className="w-3 h-3 text-[#d4af37]" />
                          <span>Pinos</span>
                        </button>

                        <button
                          onClick={() => iniciarEdicaoLamina(lamina)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                          title="Editar Metadados e Descrição"
                        >
                          <Edit3 className="w-3 h-3 text-blue-400" />
                          <span>Editar</span>
                        </button>

                        <Link
                          href={`/${lamina.disciplina_id || 'histologia'}/${lamina.topico_id || 'geral'}/${lamina.slug || lamina.id}`}
                          target="_blank"
                          className="px-2.5 py-1.5 rounded-lg bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 text-xs font-mono transition-all flex items-center gap-1"
                          title="Abrir no Microscópio"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </Link>

                        <button
                          onClick={() => handleExcluirLamina(lamina.id)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          title="Excluir Lâmina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CADASTRAR OU EDITAR LÂMINA */}
        {activeTab === 'novo' && (
          <div className="max-w-3xl mx-auto p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-white">
                  {editandoId ? `Editar Lâmina: ${nome}` : 'Cadastrar Nova Lâmina'}
                </h2>
                <p className="text-xs text-neutral-400 font-sans mt-0.5">
                  {editandoId 
                    ? 'Altere os metadados, coloração ou o laudo morfológico da lâmina cadastrada.'
                    : 'Adicione uma nova lâmina digitalizada ao catálogo oficial do Palas Atlas.'}
                </p>
              </div>

              {editandoId && (
                <button
                  type="button"
                  onClick={resetarFormulario}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-neutral-400 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSalvarLamina} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Nome da Lâmina / Espécime *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      if (!editandoId && !slugManual) {
                        const sug = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
                        setSlugManual(sug);
                      }
                    }}
                    placeholder="Ex: Córtex Renal (Glomérulo e Túbulos)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Slug / Identificador Único
                  </label>
                  <input
                    type="text"
                    value={slugManual}
                    onChange={(e) => setSlugManual(e.target.value)}
                    placeholder="Ex: cortex_renal_he"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Disciplina *
                  </label>
                  <select
                    value={disciplinaId}
                    onChange={(e) => setDisciplinaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    {disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Módulo / Tópico *
                  </label>
                  <select
                    value={topicoId}
                    onChange={(e) => setTopicoId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    {topicos.filter(t => t.disciplina_id === disciplinaId).map((t) => (
                      <option key={t.id} value={t.id}>{t.titulo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Objetiva Máxima
                  </label>
                  <select
                    value={maxMag}
                    onChange={(e) => setMaxMag(Number(e.target.value) as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value={40}>40x (Resolução celular padrão)</option>
                    <option value={60}>60x (Alta ampliação)</option>
                    <option value={100}>100x (Imersão em óleo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Técnica de Coloração Histológica
                </label>
                <input
                  type="text"
                  value={coloracao}
                  onChange={(e) => setColoracao(e.target.value)}
                  placeholder="Ex: Hematoxilina e Eosina (H&E), Coloração de Mallory, Giemsa..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Caminho do DZI com Auxiliares Automáticos */}
              <div className="space-y-2 p-4 rounded-xl bg-neutral-950 border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#d4af37] font-bold">
                    Caminho do DZI ou URL no Supabase Storage *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={preencherDziCloud}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#d4af37]/25 transition-all cursor-pointer"
                    >
                      ☁️ Usar Supabase Cloud
                    </button>
                    <button
                      type="button"
                      onClick={preencherDziLocal}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-white/[0.05] text-neutral-300 border border-white/[0.1] hover:bg-white/[0.1] transition-all cursor-pointer"
                    >
                      💻 Usar Local (Mac)
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={dziUrl}
                  onChange={(e) => setDziUrl(e.target.value)}
                  placeholder="https://omdgpncqtswnqpphfovo.supabase.co/storage/v1/object/public/laminas-dzi/nome.dzi"
                  className="w-full px-3.5 py-2 rounded-lg bg-neutral-900 border border-white/[0.1] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                  required
                />
                <p className="text-[11px] text-neutral-400">
                  Dica: Se você gerou a lâmina no seu Mac com o script, pode salvar o caminho direto da nuvem ou usar o arquivo local em <code className="text-[#d4af37]">assets/histologia/[nome].dzi</code>.
                </p>
              </div>

              {/* Editor Rico de Descrição Diagnóstica */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                    Descrição Diagnóstica & Análise Morfológica
                  </label>
                  <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAbaDescricao('editor')}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono ${abaDescricao === 'editor' ? 'bg-[#d4af37] text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Editor HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaDescricao('preview')}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono ${abaDescricao === 'preview' ? 'bg-[#d4af37] text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Prévia Formatada
                    </button>
                  </div>
                </div>

                {abaDescricao === 'editor' ? (
                  <div className="space-y-2">
                    {/* Barra de Ferramentas de Formatação */}
                    <div className="flex items-center gap-1.5 p-1.5 bg-neutral-950 rounded-lg border border-white/[0.08] overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => inserirTagHtml('<strong>', '</strong>')}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-bold"
                        title="Negrito"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => inserirTagHtml('<em>', '</em>')}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs italic"
                        title="Itálico"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => inserirTagHtml('<p>', '</p>')}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs"
                        title="Parágrafo"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => inserirTagHtml('<h4>', '</h4>')}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-bold"
                        title="Subtítulo"
                      >
                        <Hash className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => inserirTagHtml('<ul><li>', '</li></ul>')}
                        className="px-2 py-1 rounded hover:bg-white/[0.08] text-neutral-300 hover:text-white text-[11px] font-mono"
                        title="Lista de tópicos"
                      >
                        • Lista
                      </button>
                    </div>

                    <textarea
                      id="descricao-textarea"
                      rows={6}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="<p>Texto morfológico com descrições das estruturas, coloração e características histológicas diagnósticas...</p>"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                ) : (
                  <div 
                    className="p-4 rounded-xl bg-neutral-950 border border-white/[0.08] min-h-[160px] max-h-[250px] overflow-y-auto text-xs text-neutral-300 font-serif leading-relaxed prose prose-invert prose-p:my-2 prose-headings:text-[#d4af37]"
                    dangerouslySetInnerHTML={{ __html: descricao || '<p class="text-neutral-500 italic">Nenhum texto informado ainda.</p>' }}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { resetarFormulario(); setActiveTab('acervo'); }}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.04] text-neutral-400 hover:text-white text-xs font-mono uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#d4af37] hover:bg-[#e0c97f] text-neutral-950 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editandoId ? 'Salvar Alterações na Lâmina' : 'Publicar Lâmina no Catálogo'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ABA 3: MAPEADOR VISUAL DE PINOS (POINT & CLICK) */}
        {activeTab === 'pinos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-neutral-400 uppercase">
                  Lâmina em Exame:
                </label>
                <select
                  value={laminaSelecionadaId}
                  onChange={(e) => setLaminaSelecionadaId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                >
                  {laminas.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
                <span>Clique com o mouse na imagem para capturar as coordenadas exatas do marcador</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Canvas do OpenSeadragon no CMS */}
              <div className="lg:col-span-8 h-[580px] rounded-2xl bg-neutral-950 border border-white/[0.08] relative overflow-hidden shadow-2xl">
                <div ref={osdContainerRef} className="w-full h-full" />

                {/* Modal Flutuante ao Clicar na Imagem */}
                {modoAdicionarPino && coordenadaPinoTemp && (
                  <div className="absolute top-4 left-4 z-50 p-4 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-[#d4af37]/40 shadow-2xl space-y-3 max-w-sm animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37] font-bold">
                        Ponto Capturado: ({coordenadaPinoTemp.x}, {coordenadaPinoTemp.y})
                      </span>
                      <button
                        onClick={() => { setModoAdicionarPino(false); setCoordenadaPinoTemp(null); }}
                        className="text-neutral-500 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                        Nome da Estrutura Anatômica *
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={novoRotuloPino}
                        onChange={(e) => setNovoRotuloPino(e.target.value)}
                        placeholder="Ex: Canal de Havers, Glomérulo, Osteócito..."
                        className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/[0.1] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                        Categoria Morfológica
                      </label>
                      <select
                        value={categoriaPino}
                        onChange={(e) => setCategoriaPino(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/[0.1] text-xs text-neutral-300"
                      >
                        <option value="Estrutura Geral">Estrutura Geral</option>
                        <option value="Célula">Célula / Núcleo</option>
                        <option value="Vaso / Luz">Vaso Sanguíneo / Luz</option>
                        <option value="Patologia">Alteração Patológica</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSalvarPino}
                      className="w-full py-2.5 rounded-lg bg-[#d4af37] text-neutral-950 font-bold text-xs font-mono uppercase tracking-wider cursor-pointer hover:bg-[#e0c97f] transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Marcador</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Lista dos Pinos da Lâmina */}
              <div className="lg:col-span-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4 max-h-[580px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <h3 className="text-sm font-serif font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#d4af37]" />
                    <span>Marcadores Salvos</span>
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37] font-bold">
                    {laminas.find(l => l.id === laminaSelecionadaId)?.pinos?.length || 0}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {laminas.find(l => l.id === laminaSelecionadaId)?.pinos?.map((pino) => {
                    const linkSnippet = `<span class="pin-link cursor-pointer underline text-[#d4af37]" data-pin-id="${pino.id}">${pino.rotulo}</span>`;
                    const isCopiado = copiadoId === pino.id;
                    const isFocado = pinoFocadoId === pino.id;

                    return (
                      <div
                        key={pino.id}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                          isFocado
                            ? 'bg-[#d4af37]/10 border-[#d4af37]/50 shadow-md'
                            : 'bg-neutral-900 border-white/[0.04] hover:border-white/[0.1]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => focarPino(pino)}
                            className="text-xs font-medium text-white flex items-center gap-2 hover:text-[#d4af37] transition-colors cursor-pointer text-left"
                            title="Clique para voar até este pino na tela"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] shrink-0" />
                            <span className="font-serif">{pino.rotulo}</span>
                          </button>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => focarPino(pino)}
                              className="p-1 rounded text-neutral-400 hover:text-white cursor-pointer"
                              title="Centralizar no microscópio"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExcluirPino(pino.id)}
                              className="p-1 rounded text-neutral-500 hover:text-rose-400 cursor-pointer"
                              title="Remover pino"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                          <span>{pino.descricao || 'Estrutura'}</span>
                          <span>X: {pino.x} | Y: {pino.y}</span>
                        </div>

                        {/* Botão de Copiar Hiperlink com Instrução */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(linkSnippet);
                            setCopiadoId(pino.id);
                            setTimeout(() => setCopiadoId(null), 2500);
                          }}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-white/[0.04]"
                          title="Copia o código HTML para inserir na descrição da lâmina"
                        >
                          {isCopiado ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopiado ? 'Link Copiado para Área de Transferência!' : 'Copiar Hiperlink para o Texto'}</span>
                        </button>
                      </div>
                    );
                  })}

                  {(!laminas.find(l => l.id === laminaSelecionadaId)?.pinos || laminas.find(l => l.id === laminaSelecionadaId)?.pinos?.length === 0) && (
                    <div className="p-6 text-center text-xs font-mono text-neutral-500 border border-dashed border-white/[0.08] rounded-xl space-y-1">
                      <p>Nenhum marcador registrado ainda.</p>
                      <p className="text-[11px] text-neutral-400">Clique em qualquer ponto da lâmina ao lado para criar o primeiro marcador.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: MÓDULOS & TÓPICOS */}
        {activeTab === 'topicos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <h3 className="text-base font-serif font-bold text-white">Criar Novo Módulo Acadêmico</h3>
              <form onSubmit={handleCriarTopico} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Disciplina
                  </label>
                  <select
                    value={novoTopicoDisciplina}
                    onChange={(e) => setNovoTopicoDisciplina(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white"
                  >
                    {disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Título do Módulo *
                  </label>
                  <input
                    type="text"
                    value={novoTopicoTitulo}
                    onChange={(e) => setNovoTopicoTitulo(e.target.value)}
                    placeholder="Ex: Sistema Respiratório e Alvéolos Pulmonares"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white placeholder-neutral-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Resumo Acadêmico Introdutório
                  </label>
                  <textarea
                    rows={3}
                    value={novoTopicoResumo}
                    onChange={(e) => setNovoTopicoResumo(e.target.value)}
                    placeholder="Breve introdução teórica sobre a biologia do tecido..."
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#d4af37] text-neutral-950 font-bold text-xs font-mono uppercase cursor-pointer hover:bg-[#e0c97f] transition-all"
                >
                  Salvar Módulo no Banco
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-base font-serif font-bold text-white">Módulos Cadastrados ({topicos.length})</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {topicos.map((topico) => (
                  <div key={topico.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[#d4af37] uppercase">
                        {topico.disciplina_id}
                      </span>
                      <h4 className="text-sm font-serif font-bold text-white">{topico.titulo}</h4>
                      {topico.resumo && (
                        <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{topico.resumo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-neutral-500">
                        ID: {topico.id}
                      </span>
                      <button
                        onClick={() => handleExcluirTopico(topico.id)}
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 cursor-pointer"
                        title="Remover módulo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: GUIA DO LABORATÓRIO E GERADOR DE COMANDOS */}
        {activeTab === 'guia' && (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-8 max-w-4xl mx-auto">
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                  Pipeline Morfológico Completo
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-white">
                Como Digitalizar e Publicar Lâminas (Do Microscópio ao Palas Atlas)
              </h2>
            </div>

            {/* Gerador Dinâmico de Linha de Comando */}
            <div className="p-5 rounded-2xl bg-[#d4af37]/5 border border-[#d4af37]/30 space-y-4">
              <h3 className="text-sm font-serif font-bold text-[#d4af37] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Assistente de Comandos Automáticos</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Digite o nome da sua lâmina abaixo para gerar os comandos exatos de terminal prontos para copiar e colar:
              </p>
              
              <div className="w-full sm:w-80">
                <input
                  type="text"
                  value={guiaSlug}
                  onChange={(e) => setGuiaSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="ex: pulmao_bronquiolo"
                  className="w-full px-3.5 py-2 rounded-lg bg-neutral-900 border border-white/[0.15] text-xs font-mono text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                    <span>1. Gerar Pirâmide DZI (no seu Mac):</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`npm run slide:generate -- ./foto_microscopio.tif ${guiaSlug}`)}
                      className="text-[#d4af37] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar comando
                    </button>
                  </div>
                  <pre className="bg-black p-3 rounded-lg text-emerald-400 overflow-x-auto select-all">
                    npm run slide:generate -- ./foto_microscopio.tif {guiaSlug}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                    <span>2. Subir para a Nuvem Supabase Storage (CDN Mundial):</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`npm run slide:upload -- ${guiaSlug}`)}
                      className="text-[#d4af37] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar comando
                    </button>
                  </div>
                  <pre className="bg-black p-3 rounded-lg text-emerald-400 overflow-x-auto select-all">
                    npm run slide:upload -- {guiaSlug}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                    <span>3. URL Pública gerada para colar no CMS:</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`https://omdgpncqtswnqpphfovo.supabase.co/storage/v1/object/public/laminas-dzi/${guiaSlug}.dzi`)}
                      className="text-[#d4af37] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar URL
                    </button>
                  </div>
                  <pre className="bg-black p-3 rounded-lg text-neutral-200 overflow-x-auto select-all">
                    https://omdgpncqtswnqpphfovo.supabase.co/storage/v1/object/public/laminas-dzi/{guiaSlug}.dzi
                  </pre>
                </div>
              </div>
            </div>

            {/* As 4 Etapas Didáticas */}
            <div className="space-y-4 text-xs font-sans text-neutral-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/[0.06] space-y-2">
                <span className="font-mono text-[#d4af37] font-bold text-sm">Etapa 1: Varredura no Charriot & Costura no Fiji (ImageJ)</span>
                <p>
                  No laboratório da faculdade ou hospital, acople a câmera ao microscópio óptico. Fotografe o tecido movimentando o charriot em padrão de serpente vertical (*snake pattern*), garantindo cerca de <strong>15% de sobreposição (*overlap*)</strong> entre cada foto.
                </p>
                <p className="text-neutral-400">
                  No Fiji, abra o menu <code className="text-[#d4af37]">Plugins &gt; Stitching &gt; Grid/Collection stitching</code> (ou use o script <code className="text-white">tools/fiji/stitch_lamina.ijm</code>) para fundir as fotos em um único mosaico panorâmico de altíssima fidelidade.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-white/[0.06] space-y-2">
                <span className="font-mono text-[#d4af37] font-bold text-sm">Etapa 2: Fatiamento Piramidal Deep Zoom (DZI)</span>
                <p>
                  Imagens histológicas gigapixel não podem ser carregadas de uma só vez na web, pois pesam dezenas de megabytes e travam o navegador móvel. O comando <code className="text-white">npm run slide:generate</code> fatiará a foto em milhares de pequenos azulejos de 256x256 pixels com diferentes níveis de zoom.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-white/[0.06] space-y-2">
                <span className="font-mono text-[#d4af37] font-bold text-sm">Etapa 3: Envio para o Supabase Storage</span>
                <p>
                  O comando <code className="text-white">npm run slide:upload</code> transfere os azulejos em lotes paralelos diretamente para o bucket <code className="text-[#d4af37]">laminas-dzi</code> no seu Supabase. Dessa forma, seu repositório Git permanece leve, e os alunos no Brasil e no mundo desfrutam de carregamento instantâneo via CDN.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-white/[0.06] space-y-2">
                <span className="font-mono text-[#d4af37] font-bold text-sm">Etapa 4: Cadastro & Mapeamento Anatômico Interativo</span>
                <p>
                  Com a lâmina publicada, abra a aba <strong>&ldquo;Mapeador de Pinos&rdquo;</strong> do CMS. Clique visualmente sobre as células, vasos ou regiões de interesse para cravar os marcadores diagnósticos. Você pode clicar no botão <strong>&ldquo;Copiar Hiperlink para o Texto&rdquo;</strong> e colar o link diretamente no texto descritivo da lâmina, criando uma experiência interativa e imersiva para os estudantes de medicina!
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
