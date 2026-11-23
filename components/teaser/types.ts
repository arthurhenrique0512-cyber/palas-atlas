export type TeaserAct = 1 | 2 | 3 | 4;

export interface AnatomicalHotspot {
  id: string;
  code: string;
  structure: string;
  latinName: string;
  attachmentType: 'Origem' | 'Inserção' | 'Origem & Inserção' | 'Reparo Ósseo';
  muscle: string;
  clinicalNote: string;
  /** Approximate anatomical coordinate on the Right Scapula SDF space before surface snapping */
  approxPos: [number, number, number];
  /** Search direction pointing from inside bone toward the target cortical face */
  surfaceDir: [number, number, number];
  /** Timeline window [startSec, endSec] when this pin illuminates prominently */
  activeWindow: [number, number];
  /** Preferred side of the 9:16 screen for the floating callout label */
  labelAnchor: 'left' | 'right';
  accentColor: string;
}

export type AtlasSourceId = 'netter' | 'sobotta' | 'grays' | 'pernkopf';

export interface ClassicAtlasReference {
  id: AtlasSourceId;
  author: string;
  fullTitle: string;
  plateCode: string;
  editionNote: string;
  regionLabel: string;
  highlightLandmark: string;
  paperTint: string;
  inkColor: string;
  accentColor: string;
}

export interface RapidSwitchFrame {
  mode: '3d-pbr' | '3d-wire' | '3d-pins' | 'plate';
  plateId?: AtlasSourceId;
  badge: string;
  subtitle: string;
  startSec: number;
  endSec: number;
}

export const TEASER_DURATION_SEC = 25;

export const ACT_TIMINGS: Record<TeaserAct, { start: number; end: number; label: string }> = {
  1: { start: 0, end: 4, label: 'Abertura' },
  2: { start: 4, end: 12, label: 'Escápula 3D' },
  3: { start: 12, end: 20, label: 'Acervo Clássico' },
  4: { start: 20, end: 25, label: 'Acesse Agora' },
};

export const SCAPULA_HOTSPOTS: AnatomicalHotspot[] = [
  {
    id: 'fossa-supraespinal',
    code: '01',
    structure: 'Fossa Supraespinal',
    latinName: 'Fossa supraspinata',
    attachmentType: 'Origem',
    muscle: 'M. Supraespinal',
    clinicalNote: 'Manguito rotador • Inicia abdução (0°–15°)',
    approxPos: [-0.08, 0.72, 0.14],
    surfaceDir: [0, 0.25, 1],
    activeWindow: [5.0, 9.2],
    labelAnchor: 'left',
    accentColor: '#38bdf8',
  },
  {
    id: 'fossa-infraespinal',
    code: '02',
    structure: 'Fossa Infraespinal',
    latinName: 'Fossa infraspinata',
    attachmentType: 'Origem',
    muscle: 'M. Infraespinal',
    clinicalNote: 'Rotador lateral principal da articulação glenoumeral',
    approxPos: [-0.10, -0.14, 0.14],
    surfaceDir: [0, 0, 1],
    activeWindow: [6.0, 9.5],
    labelAnchor: 'left',
    accentColor: '#2dd4bf',
  },
  {
    id: 'tuberculo-infraglenoidal',
    code: '03',
    structure: 'Tubérculo Infraglenoidal',
    latinName: 'Tuberculum infraglenoidale',
    attachmentType: 'Origem',
    muscle: 'Cabeça Longa do Tríceps',
    clinicalNote: 'M. tríceps braquial • Estabiliza cabeça umeral',
    approxPos: [0.62, 0.19, 0.02],
    surfaceDir: [0.85, -0.35, 0.25],
    activeWindow: [7.8, 12.0],
    labelAnchor: 'right',
    accentColor: '#d4af37',
  },
  {
    id: 'processo-coracoide',
    code: '04',
    structure: 'Processo Coracóide',
    latinName: 'Processus coracoideus',
    attachmentType: 'Origem & Inserção',
    muscle: 'Peitoral Menor • Bíceps (C. Curta)',
    clinicalNote: 'Também origina o M. coracobraquial',
    approxPos: [0.63, 0.75, -0.44],
    surfaceDir: [0.68, 0.12, -0.72],
    activeWindow: [8.7, 12.0],
    labelAnchor: 'right',
    accentColor: '#f59e0b',
  },
];

export const CLASSIC_PLATES: ClassicAtlasReference[] = [
  {
    id: 'netter',
    author: 'Netter',
    fullTitle: 'Atlas de Anatomia Humana',
    plateCode: 'Prancha 408',
    editionNote: 'Osteologia do Círculo Escapular',
    regionLabel: 'Face Dorsal & Processo Coracóide',
    highlightLandmark: 'Origem do Tríceps & Manguito Rotador',
    paperTint: '#f5ecd9',
    inkColor: '#3c2a1e',
    accentColor: '#b45309',
  },
  {
    id: 'sobotta',
    author: 'Sobotta',
    fullTitle: 'Atlas de Anatomia Humana',
    plateCode: 'Fig. 214',
    editionNote: 'Scapula Dextra — Facies Dorsalis',
    regionLabel: 'Fossas Supra e Infraespinal',
    highlightLandmark: 'Espinha da Escápula & Cavidade Glenoidal',
    paperTint: '#f2f4ee',
    inkColor: '#1e293b',
    accentColor: '#0369a1',
  },
  {
    id: 'grays',
    author: "Gray's",
    fullTitle: "Gray's Anatomy",
    plateCode: 'Fig. 203',
    editionNote: 'Section IV — Osteology',
    regionLabel: 'Dorsum of Right Scapula',
    highlightLandmark: 'Infraglenoid Tubercle & Coracoid Process',
    paperTint: '#ede2cb',
    inkColor: '#2c2219',
    accentColor: '#78350f',
  },
  {
    id: 'pernkopf',
    author: 'Pernkopf',
    fullTitle: 'Topographische Anatomie',
    plateCode: 'Taf. 34',
    editionNote: 'Regio Scapularis Profunda',
    regionLabel: 'Incisura & Arcada Vasculonervosa',
    highlightLandmark: 'Relações Mioligamentares da Escápula',
    paperTint: '#f3ece0',
    inkColor: '#1f242c',
    accentColor: '#9f1239',
  },
];

export const RAPID_SWITCH_SEQUENCE: RapidSwitchFrame[] = [
  {
    mode: '3d-pbr',
    badge: 'MODELO 3D • PBR',
    subtitle: 'Escápula Direita (Cortical Real)',
    startSec: 14.2,
    endSec: 15.1,
  },
  {
    mode: 'plate',
    plateId: 'netter',
    badge: 'NETTER • PRANCHA 408',
    subtitle: 'Correspondência Anatômica Direta',
    startSec: 15.1,
    endSec: 16.0,
  },
  {
    mode: '3d-wire',
    badge: 'MALHA TOPOGRÁFICA 3D',
    subtitle: 'Espinha & Fossas Escapulares',
    startSec: 16.0,
    endSec: 16.8,
  },
  {
    mode: 'plate',
    plateId: 'sobotta',
    badge: 'SOBOTTA • FIG. 214',
    subtitle: 'Scapula Dextra — Vista Dorsal',
    startSec: 16.8,
    endSec: 17.7,
  },
  {
    mode: '3d-pins',
    badge: 'INSERÇÕES & ORIGENS 3D',
    subtitle: 'Tríceps (C. Longa) & Coracóide',
    startSec: 17.7,
    endSec: 18.5,
  },
  {
    mode: 'plate',
    plateId: 'grays',
    badge: "GRAY'S • FIG. 203",
    subtitle: 'Gravura Clássica de Osteologia',
    startSec: 18.5,
    endSec: 19.25,
  },
  {
    mode: 'plate',
    plateId: 'pernkopf',
    badge: 'PERNKOPF • TAF. 34',
    subtitle: 'Topografia Escapular Clássica',
    startSec: 19.25,
    endSec: 20.0,
  },
];
