import { catalogData } from '@/js/catalog-data.js';

export type DisciplineKey =
  | 'histologia'
  | 'anatomia'
  | 'patologia'
  | 'parasitologia'
  | 'microbiologia';

export interface ReelDisciplineCard {
  id: DisciplineKey;
  label: string;
  subtitle: string;
  bibliography: string;
  accentHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  dotClass: string;
  topics: string[];
  previewImage: string;
}

interface RawTopic {
  id: string;
  titulo: string;
  resumo?: string;
}

interface RawCatalogEntry {
  tituloDisciplina?: string;
  bibliografia?: string;
  topicos?: RawTopic[];
}

const rawCatalog = catalogData as Record<string, RawCatalogEntry>;

function extractTopicTitles(key: string, fallback: string[]): string[] {
  const entry = rawCatalog?.[key];
  if (entry && Array.isArray(entry.topicos) && entry.topicos.length > 0) {
    return entry.topicos.slice(0, 4).map((t) => t.titulo);
  }
  return fallback;
}

export const REAL_DISCIPLINES: ReelDisciplineCard[] = [
  {
    id: 'histologia',
    label: rawCatalog?.histologia?.tituloDisciplina || 'Histologia',
    subtitle: 'Cortes reais H&E, tricrômico e desgastes em até 40x nativo',
    bibliography:
      rawCatalog?.histologia?.bibliografia || 'Junqueira & Carneiro - Histologia Básica',
    accentHex: '#0f766e',
    badgeBgClass: 'bg-teal-50 border-teal-200',
    badgeTextClass: 'text-teal-800',
    dotClass: 'bg-sky-600',
    topics: extractTopicTitles('histologia', [
      'Tecido Epitelial de Revestimento e Glandular',
      'Tecido Ósseo Compacto e Esponjoso',
      'Tecido Muscular Estriado Esquelético, Cardíaco e Liso',
      'Tecido Nervoso e Células da Neuroglia',
    ]),
    previewImage: '/teaser-assets/pele-espessa-hd.jpg',
  },
  {
    id: 'anatomia',
    label: 'Anatomia Humana',
    subtitle: 'Osteologia 3D interativa com reparos, origens e inserções',
    bibliography: "Gray's Anatomia & Sobotta",
    accentHex: '#0369a1',
    badgeBgClass: 'bg-sky-50 border-sky-200',
    badgeTextClass: 'text-sky-800',
    dotClass: 'bg-[#0369a1]',
    topics: [
      'Osteologia e Sistema Articular (Escápula 3D)',
      'Neuroanatomia Topográfica',
      'Miologia • Origens e Inserções',
    ],
    previewImage: '/teaser-assets/osso-maduro-40x-hd.jpg',
  },
  {
    id: 'patologia',
    label: rawCatalog?.patologia?.tituloDisciplina || 'Patologia',
    subtitle: 'Lesões celulares, inflamação, trombose e neoplasias',
    bibliography:
      rawCatalog?.patologia?.bibliografia ||
      'Robbins & Cotran - Bases Patológicas das Doenças',
    accentHex: '#e11d48',
    badgeBgClass: 'bg-rose-50 border-rose-200',
    badgeTextClass: 'text-rose-800',
    dotClass: 'bg-rose-600',
    topics: extractTopicTitles('patologia', [
      'Lesão, Adaptação e Morte Celular',
      'Inflamação Aguda, Crônica e Reparo Tecidual',
      'Distúrbios Hemodinâmicos',
      'Neoplasias Benignas e Malignas',
    ]),
    previewImage: '/teaser-assets/medula-espinal-clean.jpg',
  },
  {
    id: 'parasitologia',
    label: rawCatalog?.parasitologia?.tituloDisciplina || 'Parasitologia',
    subtitle: 'Trofozoítos, cistos, ovos e helmintos de interesse médico',
    bibliography:
      rawCatalog?.parasitologia?.bibliografia || 'Neves - Parasitologia Humana',
    accentHex: '#059669',
    badgeBgClass: 'bg-emerald-50 border-emerald-200',
    badgeTextClass: 'text-emerald-800',
    dotClass: 'bg-emerald-600',
    topics: extractTopicTitles('parasitologia', [
      'Protozoologia Entérica (Entamoeba, Giardia)',
      'Protozoologia Tissular (T. cruzi, Leishmania)',
      'Helmintologia - Nematódeos e Cestódeos',
    ]),
    previewImage: '/teaser-assets/muscular-esqueletico-clean.jpg',
  },
  {
    id: 'microbiologia',
    label: rawCatalog?.microbiologia?.tituloDisciplina || 'Microbiologia',
    subtitle: 'Colorações de Gram, Ziehl-Neelsen (BAAR) e micologia clínica',
    bibliography:
      rawCatalog?.microbiologia?.bibliografia || 'Murray - Microbiologia Médica',
    accentHex: '#7c3aed',
    badgeBgClass: 'bg-violet-50 border-violet-200',
    badgeTextClass: 'text-violet-800',
    dotClass: 'bg-violet-600',
    topics: extractTopicTitles('microbiologia', [
      'Cocos e Bastonetes Gram-Positivos',
      'Bacilos e Cocos Gram-Negativos',
      'BAAR (Mycobacterium tuberculosis)',
      'Micologia Médica',
    ]),
    previewImage: '/teaser-assets/pele-espessa-hd.jpg',
  },
];

export interface SpecimenPin {
  id: string;
  number: number;
  label: string;
  detail: string;
  /** Normalized image coordinates (0..100%) on the stitched HD texture */
  xPct: number;
  yPct: number;
}

export const PELE_ESPESSA_PINS: SpecimenPin[] = [
  {
    id: 'pin-queratina',
    number: 1,
    label: 'Estrato Espinhoso / Queratinócitos',
    detail: 'Epitélio estratificado pavimentoso com desmossomos evidentes',
    xPct: 24.0,
    yPct: 13.1,
  },
  {
    id: 'pin-interface',
    number: 2,
    label: 'Interface Dermo-Epidérmica',
    detail: 'Cristas epidérmicas interdigitadas às papilas dérmicas',
    xPct: 37.5,
    yPct: 27.8,
  },
  {
    id: 'pin-colageno',
    number: 3,
    label: 'Derme Reticular (Colágeno Tipo I)',
    detail: 'Feixes colágenos espessos e densos corados em azul',
    xPct: 48.0,
    yPct: 54.4,
  },
  {
    id: 'pin-hemacia',
    number: 4,
    label: 'Hemácia / Vaso Sanguíneo',
    detail: 'Arteríola dérmica com eritrócitos intraluminais (ref. 7,5 µm)',
    xPct: 89.58,
    yPct: 83.66,
  },
];

export const OSSO_MADURO_PINS: SpecimenPin[] = [
  {
    id: 'pin-havers-sup',
    number: 1,
    label: 'Canal de Havers',
    detail: 'Canal vascular central do ósteon em corte transversal',
    xPct: 28.4,
    yPct: 16.4,
  },
  {
    id: 'pin-lacuna',
    number: 2,
    label: 'Lacuna de Osteócito & Canalículos',
    detail: 'Cavidade fusiforme com canalículos radiados na matriz mineralizada',
    xPct: 44.2,
    yPct: 43.8,
  },
  {
    id: 'pin-osteon-central',
    number: 3,
    label: 'Sistema de Havers (Lamelas Concêntricas)',
    detail: 'Cilindros lamelares concêntricos delimitados por linha cimentante',
    xPct: 56.3,
    yPct: 78.2,
  },
];

export const REAL_BENCH_QUESTION = {
  code: 'Q1',
  title: 'Identificação do Sistema de Havers (Ósteon)',
  prompt:
    'Examine o campo em 40× e diferencie o canal vascular central das lamelas concêntricas e lacunas osteocitárias.',
  notePreview: 'Canal de Havers central + lamelas concêntricas com canalículos radiados...',
  status: 'Salvo localmente',
};
