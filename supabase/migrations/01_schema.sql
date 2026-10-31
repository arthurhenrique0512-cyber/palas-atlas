-- ============================================================================
-- PALAS ATLAS — ESQUEMA RELACIONAL OFICIAL (POSTGRESQL / SUPABASE)
-- ============================================================================

-- 1. Tabela de Disciplinas do Ciclo Básico
CREATE TABLE IF NOT EXISTS public.disciplinas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descricao TEXT,
    bibliografia TEXT,
    ordem INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tabela de Módulos e Tópicos Curriculares
CREATE TABLE IF NOT EXISTS public.topicos (
    id TEXT PRIMARY KEY,
    disciplina_id TEXT NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL,
    resumo TEXT,
    ordem INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(disciplina_id, slug)
);

-- 3. Tabela Canônica de Lâminas e Peças Morfológicas
CREATE TABLE IF NOT EXISTS public.laminas (
    id TEXT PRIMARY KEY,
    disciplina_id TEXT NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
    topico_id TEXT REFERENCES public.topicos(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL,
    coloracao TEXT DEFAULT 'Hematoxilina e Eosina (H&E)' NOT NULL,
    specimen TEXT,
    max_magnification INT DEFAULT 40 CHECK (max_magnification IN (4, 10, 40, 60, 100)),
    mpp NUMERIC(6, 4) DEFAULT 0.2500, -- Microns por pixel para régua física
    default_center JSONB DEFAULT '{"x": 0.5, "y": 0.5}'::JSONB,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'rascunho')),
    dzi_url TEXT NOT NULL,
    preview_image TEXT,
    thumbnail_url TEXT,
    descricao_html TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(disciplina_id, slug)
);

-- 4. Tabela de Pinos / Marcadores Anatômicos Interativos
CREATE TABLE IF NOT EXISTS public.pinos (
    id TEXT PRIMARY KEY,
    lamina_id TEXT NOT NULL REFERENCES public.laminas(id) ON DELETE CASCADE,
    rotulo TEXT NOT NULL,
    x NUMERIC(10, 2) NOT NULL, -- Coordenada X na imagem nativa
    y NUMERIC(10, 2) NOT NULL, -- Coordenada Y na imagem nativa
    zoom NUMERIC(6, 2),        -- Zoom sugerido para focar na estrutura
    descricao TEXT,
    ordem INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para buscas rápidas e performance
CREATE INDEX IF NOT EXISTS idx_topicos_disciplina ON public.topicos(disciplina_id);
CREATE INDEX IF NOT EXISTS idx_laminas_disciplina_topico ON public.laminas(disciplina_id, topico_id);
CREATE INDEX IF NOT EXISTS idx_laminas_status ON public.laminas(status);
CREATE INDEX IF NOT EXISTS idx_pinos_lamina ON public.pinos(lamina_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — BLINDAGEM DE DADOS
-- ============================================================================

ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laminas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinos ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura Pública para Estudantes e Visitantes
CREATE POLICY "Leitura pública de disciplinas" 
    ON public.disciplinas FOR SELECT 
    USING (true);

CREATE POLICY "Leitura pública de tópicos" 
    ON public.topicos FOR SELECT 
    USING (true);

CREATE POLICY "Leitura pública de lâminas ativas" 
    ON public.laminas FOR SELECT 
    USING (status = 'ativa' OR auth.role() = 'authenticated');

CREATE POLICY "Leitura pública de pinos" 
    ON public.pinos FOR SELECT 
    USING (true);

-- Políticas de Escrita Restritas a Usuários Autenticados (Admin/Curadores)
CREATE POLICY "Escrita administrativa em disciplinas" 
    ON public.disciplinas FOR ALL 
    TO authenticated 
    USING (true) WITH CHECK (true);

CREATE POLICY "Escrita administrativa em tópicos" 
    ON public.topicos FOR ALL 
    TO authenticated 
    USING (true) WITH CHECK (true);

CREATE POLICY "Escrita administrativa em lâminas" 
    ON public.laminas FOR ALL 
    TO authenticated 
    USING (true) WITH CHECK (true);

CREATE POLICY "Escrita administrativa em pinos" 
    ON public.pinos FOR ALL 
    TO authenticated 
    USING (true) WITH CHECK (true);

-- ============================================================================
-- STORAGE: BUCKET PÚBLICO PARA TILES DEEP ZOOM (DZI)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('laminas-dzi', 'laminas-dzi', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Acesso público aos azulejos DZI" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'laminas-dzi');

CREATE POLICY "Upload administrativo de azulejos DZI" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'laminas-dzi');
