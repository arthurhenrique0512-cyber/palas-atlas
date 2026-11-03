-- ============================================================================
-- PALAS ATLAS — MIGRAÇÃO 03: TIPOS GEOMÉTRICOS DE ANOTAÇÃO (PIN, ARROW, CIRCLE)
-- ============================================================================

-- Expande a tabela de pinos com suporte a círculos e setas direcionais
ALTER TABLE public.pinos 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'pin',
  ADD COLUMN IF NOT EXISTS radius NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS angle NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS end_x NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS end_y NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS stroke_color TEXT DEFAULT '#d4af37',
  ADD COLUMN IF NOT EXISTS fill_color TEXT DEFAULT 'rgba(212,175,55,0.15)';

-- Adiciona restrição de tipos válidos caso ainda não exista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pinos_type_check'
  ) THEN
    ALTER TABLE public.pinos 
      ADD CONSTRAINT pinos_type_check CHECK (type IN ('pin', 'arrow', 'circle'));
  END IF;
END $$;

-- Índice para buscas por tipo de marcação
CREATE INDEX IF NOT EXISTS idx_pinos_type ON public.pinos(type);

COMMENT ON COLUMN public.pinos.type IS 'Tipo de anotação morfológica: pin (ponto), arrow (seta direcional), circle (círculo delimitador)';
COMMENT ON COLUMN public.pinos.radius IS 'Raio do círculo em pixels da imagem original (para delimitar estruturas completas)';
COMMENT ON COLUMN public.pinos.angle IS 'Ângulo de rotação da seta em graus (0 a 360)';
COMMENT ON COLUMN public.pinos.end_x IS 'Coordenada X do ponto final da seta na imagem nativa';
COMMENT ON COLUMN public.pinos.end_y IS 'Coordenada Y do ponto final da seta na imagem nativa';
