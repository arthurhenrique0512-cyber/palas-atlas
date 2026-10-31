export interface Disciplina {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
  bibliografia?: string;
  ordem?: number;
  created_at?: string;
}

export interface Topico {
  id: string;
  disciplina_id: string;
  titulo: string;
  slug: string;
  resumo?: string;
  ordem?: number;
  created_at?: string;
}

export interface Pino {
  id: string;
  lamina_id: string;
  rotulo: string;
  x: number;
  y: number;
  zoom?: number;
  descricao?: string;
  ordem?: number;
}

export interface Lamina {
  id: string;
  disciplina_id: string;
  topico_id?: string;
  nome: string;
  slug: string;
  coloracao: string;
  specimen?: string;
  max_magnification: 4 | 10 | 40 | 60 | 100;
  mpp?: number;
  default_center?: { x: number; y: number };
  status: 'ativa' | 'inativa' | 'rascunho';
  dzi_url: string;
  preview_image?: string;
  thumbnail_url?: string;
  descricao_html?: string;
  pinos?: Pino[];
  created_at?: string;
  updated_at?: string;
}
