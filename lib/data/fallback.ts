import { Disciplina, Topico, Lamina } from '@/lib/supabase/types';

export const fallbackDisciplinas: Disciplina[] = [
  {
    id: 'histologia',
    nome: 'Histologia',
    slug: 'histologia',
    descricao: 'Estudo microscópico dos tecidos fundamentais e sua organização morfológica.',
    bibliografia: 'Junqueira & Carneiro - Histologia Básica',
    ordem: 1
  },
  {
    id: 'anatomia',
    nome: 'Anatomia Macroscópica',
    slug: 'anatomia',
    descricao: 'Dissecção, topografia e anatomia funcional dos sistemas orgânicos humanos.',
    bibliografia: 'Dangelo & Fattini - Anatomia Humana',
    ordem: 2
  },
  {
    id: 'patologia',
    nome: 'Patologia Geral',
    slug: 'patologia',
    descricao: 'Processos patológicos fundamentais, lesão celular, inflamação e oncologia.',
    bibliografia: 'Robbins & Cotran - Bases Patológicas das Doenças',
    ordem: 3
  },
  {
    id: 'parasitologia',
    nome: 'Parasitologia Médica',
    slug: 'parasitologia',
    descricao: 'Protozoologia médica, helmintologia e biologia dos artrópodes vetores.',
    bibliografia: 'Neves - Parasitologia Humana',
    ordem: 4
  },
  {
    id: 'microbiologia',
    nome: 'Microbiologia e Micologia',
    slug: 'microbiologia',
    descricao: 'Bacteriologia morfológica diagnóstica, micologia médica e colorações de Gram.',
    bibliografia: 'Murray - Microbiologia Médica',
    ordem: 5
  }
];

export const fallbackTopicos: Topico[] = [
  { id: 'epitelial', disciplina_id: 'histologia', titulo: 'Tecido Epitelial de Revestimento e Glandular', slug: 'epitelial', resumo: 'Células fortemente justapostas, sobre lâmina basal, avascularizadas. Divisões em epitélios de revestimento e glandulares.', ordem: 1 },
  { id: 'conjuntivo', disciplina_id: 'histologia', titulo: 'Tecido Conjuntivo Propriamente Dito', slug: 'conjuntivo', resumo: 'Tecido de sustentação e defesa, rica matriz extracelular (colágeno, elastina) e células especializadas.', ordem: 2 },
  { id: 'adiposo', disciplina_id: 'histologia', titulo: 'Tecido Adiposo Unilocular e Multilocular', slug: 'adiposo', resumo: 'Adipócitos especializados em armazenamento energético (gordura branca) e termogênese (gordura marrom).', ordem: 3 },
  { id: 'cartilaginoso', disciplina_id: 'histologia', titulo: 'Tecido Cartilaginoso Hialino, Elástico e Fibroso', slug: 'cartilaginoso', resumo: 'Tecido rígido, avascular e anervado, com condrócitos em lacunas e rica matriz de proteoglicanos.', ordem: 4 },
  { id: 'osseo', disciplina_id: 'histologia', titulo: 'Tecido Ósseo Compacto e Esponjoso', slug: 'osseo', resumo: 'Matriz mineralizada rica em hidroxiapatita, osteoblastos, osteócitos em canalículos e osteoclastos.', ordem: 5 },
  { id: 'nervoso', disciplina_id: 'histologia', titulo: 'Tecido Nervoso e Células da Neuroglia', slug: 'nervoso', resumo: 'Neurônios e células gliais (astrócitos, oligodendrócitos, micróglia) do sistema nervoso central e periférico.', ordem: 6 },
  { id: 'muscular', disciplina_id: 'histologia', titulo: 'Tecido Muscular Estriado Esquelético, Cardíaco e Liso', slug: 'muscular', resumo: 'Fibras contráteis ricas em actina e miosina com controle voluntário e involuntário.', ordem: 7 },
  { id: 'circulatorio', disciplina_id: 'histologia', titulo: 'Sistema Circulatório e Microvascularização', slug: 'circulatorio', resumo: 'Coração, artérias, veias e capilares com endotélio contínuo, fenestrado ou sinusóide.', ordem: 8 }
];

export const fallbackLaminas: Record<string, Lamina> = {
  'osso_maduro_desgaste_ct': {
    id: 'osso_maduro_desgaste_ct',
    disciplina_id: 'histologia',
    topico_id: 'osseo',
    nome: 'Osso Maduro (Lamelar) por Desgaste',
    slug: 'osso-maduro-desgaste',
    coloracao: 'Desgaste • 40x',
    specimen: 'Corte Transversal por Desgaste',
    max_magnification: 40,
    mpp: 0.25,
    default_center: { x: 0.65, y: 0.525 },
    status: 'ativa',
    dzi_url: '/assets/histologia/osso_maduro_desgaste_ct.dzi',
    preview_image: '/assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
    thumbnail_url: '/assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
    descricao_html: `
      <div class="prose-atlas space-y-4 text-neutral-300 text-sm leading-relaxed">
        <h3 class="text-base font-bold text-neutral-100">Tecido Ósseo Maduro — Corte Transversal por Desgaste</h3>
        <p>Esta preparação histológica por desgaste exibe a arquitetura do <strong>tecido ósseo compacto maduro (lamelar)</strong>, preservando a matriz mineralizada rica em hidroxiapatita sem coloração química. A unidade estrutural predominante é o <strong>Sistema de Havers (ósteon)</strong>, caracterizado por cilindros concêntricos paralelos ao eixo longitudinal da diáfise. No centro de cada sistema localiza-se o <strong>canal de Havers</strong>, por onde trafegavam vasos sanguíneos e nervos in vivo.</p>
        <p>Circundando os canais dispõem-se as <strong>lamelas concêntricas</strong>, formadas por fibras colágenas mineralizadas. Entre e no interior das lamelas evidenciam-se as <strong>lacunas dos osteócitos</strong>, que alojavam as células maduras. Emergindo radialmente das lacunas, uma intrincada rede de <strong>canalículos</strong> anastomosa-se em toda a matriz, permitindo a difusão de nutrientes e comunicação celular via junções comunicantes.</p>
        <p>Nos espaços entre ósteons adjacentes encontram-se as <strong>lamelas intersticiais</strong>, remanescentes de sistemas de Havers reabsorvidos durante a remodelação óssea. Canais transversais ou oblíquos (<strong>canais de Volkmann</strong>) comunicam os canais de Havers entre si, com a cavidade medular e com a superfície perióstica externa.</p>
      </div>
    `,
    pinos: []
  },
  'medula-espinal-he': {
    id: 'medula-espinal-he',
    disciplina_id: 'histologia',
    topico_id: 'nervoso',
    nome: 'Medula Espinal (Corte Transversal)',
    slug: 'medula-espinal',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Transversal',
    max_magnification: 40,
    mpp: 0.25,
    default_center: { x: 0.5, y: 0.5 },
    status: 'ativa',
    dzi_url: '/assets/histologia/medula-espinal-he.png',
    preview_image: '/assets/histologia/medula-espinal-he.png',
    thumbnail_url: '/assets/histologia/medula-espinal-he.png',
    descricao_html: '<p class="text-neutral-300 text-sm leading-relaxed">Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.</p>',
    pinos: []
  },
  '5kqs5Qv9fvWlpNSJoyPG': {
    id: '5kqs5Qv9fvWlpNSJoyPG',
    disciplina_id: 'histologia',
    topico_id: 'nervoso',
    nome: 'Medula Espinal (Corte Transversal)',
    slug: 'medula-espinal',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Transversal',
    max_magnification: 40,
    mpp: 0.25,
    default_center: { x: 0.5, y: 0.5 },
    status: 'ativa',
    dzi_url: '/assets/histologia/medula-espinal-he.png',
    preview_image: '/assets/histologia/medula-espinal-he.png',
    thumbnail_url: '/assets/histologia/medula-espinal-he.png',
    descricao_html: '<p class="text-neutral-300 text-sm leading-relaxed">Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.</p>',
    pinos: []
  },
  'epitelio-simples-escamoso': {
    id: 'epitelio-simples-escamoso',
    disciplina_id: 'histologia',
    topico_id: 'epitelial',
    nome: 'Epitélio Pavimentoso Simples',
    slug: 'epitelio-pavimentoso-simples',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Camada Única',
    max_magnification: 40,
    mpp: 0.25,
    default_center: { x: 0.5, y: 0.5 },
    status: 'ativa',
    dzi_url: '/assets/histologia/epitelio-simples-escamoso.dzi',
    preview_image: '/assets/histologia/epitelio-simples-escamoso-preview.jpg',
    thumbnail_url: '/assets/histologia/epitelio-simples-escamoso-preview.jpg',
    descricao_html: '<p class="text-neutral-300 text-sm leading-relaxed">Camada única de células epiteliais pavimentosas (achatadas) com núcleos elípticos proeminentes, adaptadas para transporte passivo e difusão de solutos.</p>',
    pinos: []
  },
  'muscular-esqueletico-he': {
    id: 'muscular-esqueletico-he',
    disciplina_id: 'histologia',
    topico_id: 'muscular',
    nome: 'Tecido Muscular Estriado Esquelético',
    slug: 'muscular-esqueletico',
    coloracao: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Longitudinal',
    max_magnification: 40,
    mpp: 0.25,
    default_center: { x: 0.5, y: 0.5 },
    status: 'ativa',
    dzi_url: '/assets/histologia/muscular-esqueletico-he.jpg',
    preview_image: '/assets/histologia/muscular-esqueletico-he.jpg',
    thumbnail_url: '/assets/histologia/muscular-esqueletico-he.jpg',
    descricao_html: '<p class="text-neutral-300 text-sm leading-relaxed">Corte longitudinal de músculo estriado esquelético. Fibras musculares multinucleadas com núcleos periféricos achatados e estriações transversais de actina e miosina.</p>',
    pinos: []
  }
};
