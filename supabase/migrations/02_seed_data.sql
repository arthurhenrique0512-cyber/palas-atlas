-- ============================================================================
-- PALAS ATLAS — CARGA INICIAL DE DADOS CANÔNICOS (SEED)
-- ============================================================================

-- 1. Inserir Disciplinas Ativas
INSERT INTO public.disciplinas (id, nome, slug, descricao, bibliografia, ordem)
VALUES
    ('histologia', 'Histologia', 'histologia', 'Estudo microscópico dos tecidos e sua organização funcional nos órgãos.', 'Junqueira & Carneiro - Histologia Básica', 1),
    ('patologia', 'Patologia Geral', 'patologia', 'Mecanismos celulares e teciduais de lesão, inflamação e neoplasias.', 'Robbins & Cotran - Bases Patológicas das Doenças', 2),
    ('parasitologia', 'Parasitologia Médica', 'parasitologia', 'Protozoários, helmintos e artrópodes de importância clínica.', 'Neves - Parasitologia Humana', 3),
    ('microbiologia', 'Microbiologia e Micologia', 'microbiologia', 'Morfologia de bactérias, fungos filamentosos e leveduras.', 'Murray - Microbiologia Médica', 4)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    bibliografia = EXCLUDED.bibliografia;

-- 2. Inserir Tópicos de Histologia
INSERT INTO public.topicos (id, disciplina_id, titulo, slug, resumo, ordem)
VALUES
    ('epitelial', 'histologia', 'Tecido Epitelial de Revestimento e Glandular', 'epitelial', 'Células fortemente justapostas, sobre lâmina basal, avascularizadas. Divisões em epitélios de revestimento e glandulares.', 1),
    ('conjuntivo', 'histologia', 'Tecido Conjuntivo Propriamente Dito', 'conjuntivo', 'Tecido de sustentação e defesa, rica matriz extracelular (colágeno, elastina) e células especializadas.', 2),
    ('adiposo', 'histologia', 'Tecido Adiposo Unilocular e Multilocular', 'adiposo', 'Adipócitos especializados em armazenamento energético (gordura branca) e termogênese (gordura marrom).', 3),
    ('cartilaginoso', 'histologia', 'Tecido Cartilaginoso Hialino, Elástico e Fibroso', 'cartilaginoso', 'Tecido rígido, avascular e anervado, com condrócitos em lacunas e rica matriz de proteoglicanos.', 4),
    ('osseo', 'histologia', 'Tecido Ósseo Compacto e Esponjoso', 'osseo', 'Matriz mineralizada rica em hidroxiapatita, osteoblastos, osteócitos em canalículos e osteoclastos.', 5),
    ('nervoso', 'histologia', 'Tecido Nervoso e Células da Neuroglia', 'nervoso', 'Neurônios e células gliais (astrócitos, oligodendrócitos, micróglia) do sistema nervoso central e periférico.', 6),
    ('muscular', 'histologia', 'Tecido Muscular Estriado Esquelético, Cardíaco e Liso', 'muscular', 'Fibras contráteis ricas em actina e miosina com controle voluntário e involuntário.', 7),
    ('circulatorio', 'histologia', 'Sistema Circulatório e Microvascularização', 'circulatorio', 'Coração, artérias, veias e capilares com endotélio contínuo, fenestrado ou sinusóide.', 8)
ON CONFLICT (id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    resumo = EXCLUDED.resumo;

-- 3. Inserir as 4 Lâminas Canônicas Oficiais do Acervo
INSERT INTO public.laminas (
    id, disciplina_id, topico_id, nome, slug, coloracao, specimen, max_magnification, mpp, default_center, status, dzi_url, preview_image, thumbnail_url, descricao_html
)
VALUES
    (
        'lamina-real1',
        'histologia',
        'epitelial',
        'Pele Espessa',
        'pele-espessa',
        'Hematoxilina e Eosina (H&E) • 40x',
        'Corte Histológico H&E',
        40,
        0.1560,
        '{"x": 0.5, "y": 0.7}'::jsonb,
        'ativa',
        'assets/histologia/lamina-real1.dzi',
        'assets/histologia/lamina-real1-preview.jpg',
        'assets/histologia/lamina-real1-preview.jpg',
        '<div class="prose-atlas"><h3>Pele Espessa — Epiderme e Derme</h3><p>Preparação histológica corada em H&amp;E evidenciando epitélio estratificado pavimentoso queratinizado com camada córnea espessa, cristas epidérmicas e papilas dérmicas.</p></div>'
    ),
    (
        'osso_maduro_desgaste_ct',
        'histologia',
        'osseo',
        'Osso Maduro',
        'osso-maduro-desgaste',
        'Desgaste • 40x',
        'Corte Transversal por Desgaste',
        40,
        0.1560,
        '{"x": 0.65, "y": 0.525}'::jsonb,
        'ativa',
        'assets/histologia/osso_maduro_desgaste_ct.dzi',
        'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
        'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
        '<div class="prose-atlas"><h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste</h3><p>Esta preparação histológica por desgaste exibe a arquitetura do <strong>tecido ósseo compacto maduro (lamelar)</strong>, preservando a matriz mineralizada rica em hidroxiapatita sem coloração química. A unidade estrutural predominante é o <strong>Sistema de Havers (ósteon)</strong>, caracterizado por cilindros concêntricos paralelos ao eixo longitudinal da diáfise.</p></div>'
    ),
    (
        'osso_maduro_desgaste_ct_2.0',
        'histologia',
        'osseo',
        'Osso Maduro 10x',
        'osso-maduro-desgaste-10x',
        'Desgaste • 10x Mapeamento 2x5',
        'Corte Transversal por Desgaste (Mapeamento 10x)',
        10,
        0.6250,
        '{"x": 0.5, "y": 0.5}'::jsonb,
        'ativa',
        'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
        'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
        'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
        '<div class="prose-atlas"><h3>Tecido Ósseo Maduro — Visão Panorâmica 10x</h3><p>Preparação histológica mapeada em objetiva de 10x com escaneamento em grade snake 2×5 (15% de sobreposição) e costura contínua, evidenciando a topografia cortical panorâmica do osso compacto.</p></div>'
    ),
    (
        'osso_maduro_desgaste_ct_3.0',
        'histologia',
        'osseo',
        'Osso Maduro 40x',
        'osso-maduro-desgaste-40x',
        'Desgaste • 40x Mapeamento 6x8',
        'Corte Transversal por Desgaste (Mapeamento 40x)',
        40,
        0.1560,
        '{"x": 0.5, "y": 0.5}'::jsonb,
        'ativa',
        'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
        'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
        'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
        '<div class="prose-atlas"><h3>Tecido Ósseo Maduro — Mapeamento de Alta Resolução 40x</h3><p>Mapeamento histológico contínuo em 40x (grade 6×8) com definição detalhada de canais de Havers, lamelas concêntricas, lacunas de osteócitos e rede canalicular.</p></div>'
    )
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    coloracao = EXCLUDED.coloracao,
    max_magnification = EXCLUDED.max_magnification,
    mpp = EXCLUDED.mpp,
    dzi_url = EXCLUDED.dzi_url,
    preview_image = EXCLUDED.preview_image,
    thumbnail_url = EXCLUDED.thumbnail_url,
    descricao_html = EXCLUDED.descricao_html;
