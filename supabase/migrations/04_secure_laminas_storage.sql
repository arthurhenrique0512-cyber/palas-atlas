-- ============================================================================
-- PALAS ATLAS — BLINDAGEM DO STORAGE E AUDITORIA DE ACESSO A LÂMINAS DZI
-- ============================================================================

-- 1. Privatização do bucket de azulejos de lâminas histológicas
UPDATE storage.buckets
SET public = false
WHERE id = 'laminas-dzi';

-- 2. Revogação de leitura irrestrita/anônima nos objetos de azulejos
DROP POLICY IF EXISTS "Acesso público aos azulejos DZI" ON storage.objects;

-- 3. Nova política: leitura exclusiva para usuários autenticados ou Edge Functions (Service Role)
CREATE POLICY "Acesso seguro a azulejos DZI para usuários autorizados"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'laminas-dzi');

-- 4. Tabela de Auditoria e Rastreabilidade Forense de Acessos a Lâminas
CREATE TABLE IF NOT EXISTS public.laminas_access_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lamina_id TEXT NOT NULL REFERENCES public.laminas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email_hash TEXT,
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    session_ticket_hash TEXT,
    tiles_streamed INT DEFAULT 1,
    suspect_score INT DEFAULT 0, -- Score de suspeita de raspagem (0 = humano normal, > 50 = potencial scraper)
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices de busca e detecção de anomalias
CREATE INDEX IF NOT EXISTS idx_audit_lamina_created ON public.laminas_access_audit(lamina_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ip_hash ON public.laminas_access_audit(ip_hash);
CREATE INDEX IF NOT EXISTS idx_audit_suspect ON public.laminas_access_audit(suspect_score) WHERE suspect_score > 0;

-- RLS na tabela de auditoria
ALTER TABLE public.laminas_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inserção de auditoria via sistema"
    ON public.laminas_access_audit FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Leitura de auditoria restrita a administradores"
    ON public.laminas_access_audit FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.role() = 'authenticated');
