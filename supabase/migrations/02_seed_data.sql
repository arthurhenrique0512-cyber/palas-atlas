-- ============================================================================
-- PALAS ATLAS — CARGA INICIAL DE DADOS CANÔNICOS (SEED)
-- ============================================================================

-- 1. Inserir Disciplinas
INSERT INTO public.disciplinas (id, nome, slug, descricao, bibliografia, ordem)
VALUES
    ('histologia', 'Histologia', 'histologia', 'Estudo microscópico dos tecidos e sua organização funcional nos órgãos.', 'Junqueira & Carneiro - Histologia Básica', 1),
    ('anatomia', 'Anatomia Macroscópica', 'anatomia', 'Morfologia dos sistemas orgânicos, dissecção e topografia anatômica.', 'Dangelo & Fattini - Anatomia Humana', 2),
    ('patologia', 'Patologia Geral', 'patologia', 'Mecanismos celulares e teciduais de lesão, inflamação e neoplasias.', 'Robbins & Cotran - Bases Patológicas das Doenças', 3),
    ('parasitologia', 'Parasitologia Médica', 'parasitologia', 'Protozoários, helmintos e artrópodes de importância clínica.', 'Neves - Parasitologia Humana', 4),
    ('microbiologia', 'Microbiologia e Micologia', 'microbiologia', 'Morfologia de bactérias, fungos filamentosos e leveduras.', 'Murray - Microbiologia Médica', 5)
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

-- 3. Inserir Lâminas Canônicas do Acervo
INSERT INTO public.laminas (
    id, disciplina_id, topico_id, nome, slug, coloracao, specimen, max_magnification, mpp, default_center, status, dzi_url, preview_image, thumbnail_url, descricao_html
)
VALUES
    (
        'osso_maduro_desgaste_ct',
        'histologia',
        'osseo',
        'Osso Maduro (Lamelar) por Desgaste',
        'osso-maduro-desgaste',
        'Desgaste • 40x',
        'Corte Transversal por Desgaste',
        40,
        0.25,
        '{"x": 0.65, "y": 0.525}'::jsonb,
        'ativa',
        'assets/histologia/osso_maduro_desgaste_ct.dzi',
        'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
        'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
        '<div class="prose-atlas"><h3>Tecido Ósseo Maduro — Corte Transversal por Desgaste</h3><p>Esta preparação histológica por desgaste exibe a arquitetura do <strong>tecido ósseo compacto maduro (lamelar)</strong>, preservando a matriz mineralizada rica em hidroxiapatita sem coloração química. A unidade estrutural predominante é o <strong>Sistema de Havers (ósteon)</strong>, caracterizado por cilindros concêntricos paralelos ao eixo longitudinal da diáfise. No centro de cada sistema localiza-se o <strong>canal de Havers</strong>, por onde trafegavam vasos sanguíneos e nervos in vivo.</p><p>Circundando os canais dispõem-se as <strong>lamelas concêntricas</strong>, formadas por fibras colágenas mineralizadas. Entre e no interior das lamelas evidenciam-se as <strong>lacunas dos osteócitos</strong>, que alojavam as células maduras. Emergindo radialmente das lacunas, uma intrincada rede de <strong>canalículos</strong> anastomosa-se em toda a matriz, permitindo a difusão de nutrientes e comunicação celular via junções comunicantes.</p><p>Nos espaços entre ósteons adjacentes encontram-se as <strong>lamelas intersticiais</strong>, remanescentes de sistemas de Havers reabsorvidos durante a remodelação óssea. Canais transversais ou oblíquos (<strong>canais de Volkmann</strong>) comunicam os canais de Havers entre si, com a cavidade medular e com a superfície perióstica externa.</p></div>'
    ),
    (
        'medula-espinal-he',
        'histologia',
        'nervoso',
        'Medula Espinal (Corte Transversal)',
        'medula-espinal',
        'Hematoxilina e Eosina (H&E)',
        'Corte Transversal',
        40,
        0.25,
        '{"x": 0.5, "y": 0.5}'::jsonb,
        'ativa',
        'assets/histologia/medula-espinal-he.png',
        'assets/histologia/medula-espinal-he.png',
        'assets/histologia/medula-espinal-he.png',
        '<p>Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.</p>'
    ),
    (
        'epitelio-simples-escamoso',
        'histologia',
        'epitelial',
        'Epitélio Pavimentoso Simples',
        'epitelio-pavimentoso-simples',
        'Hematoxilina e Eosina (H&E)',
        'Camada Única',
        40,
        0.25,
        '{"x": 0.5, "y": 0.5}'::jsonb,
        'ativa',
        'assets/histologia/epitelio-simples-escamoso.dzi',
        'assets/histologia/epitelio-simples-escamoso-preview.jpg',
        'assets/histologia/epitelio-simples-escamoso-preview.jpg',
        '<p>Camada única de células epiteliais pavimentosas (achatadas) com núcleos elípticos proeminentes, adaptadas para transporte passivo e difusão de solutos.</p>'
    ),
    (
        'muscular-esqueletico-he',
        'histologia',
        'muscular',
        'Tecido Muscular Estriado Esquelético',
        'muscular-esqueletico',
        'Hematoxilina e Eosina (H&E)',
        'Corte Longitudinal',
        40,
        0.25,
        '{"x": 0.5, "y": 0.5}'::jsonb,
        'ativa',
        'assets/histologia/muscular-esqueletico-he.jpg',
        'assets/histologia/muscular-esqueletico-he.jpg',
        'assets/histologia/muscular-esqueletico-he.jpg',
        '<p>Corte longitudinal de músculo estriado esquelético. Fibras musculares multinucleadas com núcleos periféricos achatados e estriações transversais de actina e miosina.</p>'
    )
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    coloracao = EXCLUDED.coloracao,
    descricao_html = EXCLUDED.descricao_html;
