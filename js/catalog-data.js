/**
 * ============================================================================
 * ACERVO E ESTRUTURA DE DADOS DAS DISCIPLINAS DO CICLO BÁSICO (PALAS ATLAS)
 * ============================================================================
 * Bibliografias Oficiais:
 * - Histologia: Junqueira & Carneiro (Histologia Básica)
 * - Patologia: Robbins & Cotran (Bases Patológicas das Doenças)
 * - Parasitologia: Neves (Parasitologia Humana)
 * - Microbiologia: Murray (Microbiologia Médica)
 * 
 * Zero Truncamento | Zero Emojis | Clinical Precision UI
 */

export const catalogData = {
  histologia: {
    tituloDisciplina: "Histologia",
    bibliografia: "Junqueira & Carneiro - Histologia Básica",
    caminhoBase: "/assets/histologia/",
    corDestaque: "border-sky-600 bg-sky-50 text-slate-900",
    corPino: "bg-sky-600",
    topicos: [
      {
        id: "epitelial",
        titulo: "Tecido Epitelial de Revestimento e Glandular",
        resumo: "Caracterizado por células poliédricas fortemente justapostas, assentadas sobre uma lâmina basal, com escassa matriz extracelular e ausência de vascularização direta (nutrido por difusão a partir do conjuntivo adjacente). Exibe polaridade celular definida (domínios apical, lateral e basal) e especializações de membrana (microvilosidades, cílios, desmossomos e junções de oclusão). Divisões principais: epitélios de revestimento (classificados pelo número de camadas e forma celular) e epitélios glandulares (exócrinos, organizados em ductos e porções secretoras acinares ou tubulares; e endócrinos, cordonais ou foliculares, que lançam hormônios na circulação).",
        laminasEstaticas: [
          {
            id: "a3oRvXvJpMKAtU2RE85q",
            nome: "Pele Espessa",
            coloracao: "Hematoxilina e Eosina (H&E) • 40x",
            disciplina: "histologia",
            topico: "epitelial",
            maxMagnification: 40,
            zoom4xRatio: 0.65,
            defaultCenter: { x: 0.5, y: 0.70 },
            dziUrl: "assets/histologia/lamina-real1.dzi",
            imageUrl: "assets/histologia/lamina-real1.dzi",
            caminhoImagemBase: "assets/histologia/lamina-real1-preview.jpg",
            thumbnailUrl: "assets/histologia/lamina-real1-preview.jpg",
            questoes: [
              {
                x: 1631.39,
                y: 6802.9,
                enunciado: "Identifique o estrato epidérmico caracterizado por queratinócitos achatados repletos de grânulos basofílicos densos de querato-hialina.",
                alternativas: [
                  "Camada Granulosa (grânulos de querato-hialina)",
                  "Camada Basal (melanócitos)",
                  "Camada Espinhosa (desmossomos)",
                  "Derme Papilar (tecido conjuntivo frouxo)"
                ],
                alternativaCorreta: 0,
                explicacao: "A camada granulosa da epiderme da pele espessa exibe queratinócitos com abundantes grânulos basofílicos de querato-hialina, responsáveis pela maturação e síntese da queratina madura."
              }
            ]
          }
        ]
      },
      {
        id: "conjuntivo",
        titulo: "Tecido Conjuntivo Propriamente Dito",
        resumo: "Tecido de preenchimento, sustentação e defesa, caracterizado por abundante matriz extracelular (MEC) composta por substância fundamental amorfa (glicosaminoglicanos, proteoglicanos e glicoproteínas) e fibras estruturais (colágenas, elásticas e reticulares). Possui população celular diversificada, incluindo fibroblastos/fibrócitos (síntese de MEC), macrófagos, mastócitos, plasmócitos e leucócitos transitórios. Subdivide-se em Conjuntivo Frouxo (flexível, altamente vascularizado, suporta epitélios) e Conjuntivo Denso (predomínio de colágeno tipo I, resistente a forças de tração, podendo ser Não Modelado ou Modelado/Tendíneo)."
      },
      {
        id: "adiposo",
        titulo: "Tecido Adiposo Unilocular e Multilocular",
        resumo: "Variedade especializada de tecido conjuntivo na qual predominam os adipócitos. O Tecido Adiposo Unilocular (Gordura Branca/Amarela) apresenta células esféricas contendo uma única e grande gotícula lipídica central que desloca o núcleo e o citoplasma para a periferia; atua no armazenamento energético (triglicerídeos), isolamento térmico e modelagem corporal. O Tecido Adiposo Multilocular (Gordura Castanha) apresenta adipócitos menores com múltiplas gotículas lipídicas, núcleo central e abundantes mitocôndrias ricas em UCP-1 (termogenina); é altamente vascularizado e especializado na produção direta de calor (termogênese sem tremor)."
      },
      {
        id: "cartilaginoso",
        titulo: "Tecido Cartilaginoso Hialino, Elástico e Fibroso",
        resumo: "Forma especializada de tecido conjuntivo de suporte, de consistência rígida, avascular, anervado e nutrido via difusão pelo pericôndrio adjacente (ausente nas superfícies articulares e fibrocartilagem). Suas células são os condroblastos e os condrócitos (alojados em lacunas e organizados em grupos isógenos). Tipos morfológicos: Cartilagem Hialina (mais comum, matriz homogênea rica em colágeno tipo II e agrecano); Cartilagem Elástica (semelhante à hialina, mas acrescida de densa rede de fibras elásticas; presente no pavilhão auditivo e epiglote); e Fibrocartilagem (tecido de transição rico em feixes espessos de colágeno tipo I paralelos, sem pericôndrio; presente nos discos intervertebrais e sínfise púbica)."
      },
      {
        id: "osseo",
        titulo: "Tecido Ósseo Compacto e Esponjoso",
        resumo: "Tecido conjuntivo rígido e mineralizado, composto por matriz orgânica (predomínio de colágeno tipo I) impregnada por matriz inorgânica (cristais de hidroxiapatita). Suas células incluem osteoblastos (síntese do osteoide), osteócitos (manutenção da matriz em lacunas comunicadas por canalículos) e osteoclastos (células multinucleadas responsáveis pela reabsorção óssea). Apresenta-se como Óssea Compacto (organizado em Sistemas de Havers ou Ósteons, com lamelas concêntricas ao redor de canais vasculares) e Óssea Esponjoso (rede tridimensional de trabéculas ósseas que delimitam cavidades preenchidas por medula óssea).",
        laminasEstaticas: [
          {
            id: "cw3XGCgUwN71XdlwkUe5",
            nome: "Osso Maduro 40x",
            coloracao: "Desgaste • 40x Mapeamento 6x8 (48 fotos)",
            disciplina: "histologia",
            topico: "osseo",
            maxMagnification: 100,
            zoom4xRatio: 0.28,
            defaultCenter: { x: 0.5, y: 0.5 },
            dziUrl: "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi",
            imageUrl: "assets/histologia/osso_maduro_desgaste_ct_3.0.dzi",
            caminhoImagemBase: "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg",
            thumbnailUrl: "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg"
          },
          {
            id: "FFGk5d9kOAct5HIDdjQ7",
            nome: "Osso Maduro 10x",
            coloracao: "Desgaste • 10x Mapeamento 2x5",
            disciplina: "histologia",
            topico: "osseo",
            maxMagnification: 40,
            zoom4xRatio: 0.35,
            defaultCenter: { x: 0.5, y: 0.5 },
            dziUrl: "assets/histologia/osso_maduro_desgaste_ct_2.0.dzi",
            imageUrl: "assets/histologia/osso_maduro_desgaste_ct_2.0.dzi",
            caminhoImagemBase: "assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg",
            thumbnailUrl: "assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg"
          },
          {
            id: "96ZYqoM2SV8p4fB2QgeM",
            nome: "Osso Maduro",
            coloracao: "Desgaste • 40x",
            disciplina: "histologia",
            topico: "osseo",
            maxMagnification: 40,
            zoom4xRatio: 0.28,
            defaultCenter: { x: 0.65, y: 0.525 },
            dziUrl: "assets/histologia/osso_maduro_desgaste_ct.dzi",
            imageUrl: "assets/histologia/osso_maduro_desgaste_ct.dzi",
            caminhoImagemBase: "assets/histologia/osso_maduro_desgaste_ct-preview.jpg",
            thumbnailUrl: "assets/histologia/osso_maduro_desgaste_ct-preview.jpg"
          }
        ]
      },
      {
        id: "nervoso",
        titulo: "Tecido Nervoso e Células da Neuroglia",
        resumo: "Composto por neurônios — células altamente especializadas na recepção, processamento e condução do impulso nervoso (constituídos por corpo celular/pericário rico em substância de Nissl, dendritos e axônio) — e pelas células da neuroglia (glia). No Sistema Nervoso Central (SNC), a glia compreende os Astrócitos (sustentação, regulação iônica e formação dos pés vasculares na barreira hematoencefálica), Oligodendrócitos (mielinização central de múltiplos axônios), Microglia (fagócitos/macrófagos residentes) e Células Ependimárias (revestimento dos ventrículos). No Sistema Nervoso Periférico (SNP), inclui as Células de Schwann (mielinização periférica) e Células Satélites."
      },
      {
        id: "muscular",
        titulo: "Tecido Muscular Estriado Esquelético, Cardíaco e Liso",
        resumo: `
  <p>Especializado na contratilidade através do deslizamento dos miofilamentos de actina e miosina.</p>
  <p>O <strong class="text-slate-900 font-bold">Muscular Estriado Esquelético</strong> apresenta fibras cilíndricas, longas, multinucleadas com núcleos periféricos e estriações transversais organizadas em sarcômeros (contração rápida e voluntária).</p>
  <p>O <strong class="text-slate-900 font-bold">Muscular Estriado Cardíaco</strong> é constituído por células ramificadas com 1 a 2 núcleos centrais, unidas por discos intercalares com junções comunicantes e desmossomos (contração involuntária e rítmica).</p>
  <p>O <strong class="text-slate-900 font-bold">Muscular Liso</strong> apresenta células fusiformes, uninucleadas centrais e sem estriações transversais (âncora em corpos densos; contração lenta, sustentada e involuntária em vísceras e vasos).</p>
`
      },
      {
        id: "circulatorio",
        titulo: "Sistema Circulatório e Microvascularização",
        resumo: "Sistema estruturado em vasos sanguíneos cuja parede padrão é formada por três túnicas: Íntima (endotélio plano simples e camada subendotelial), Média (músculo liso e lâminas elásticas) e Adventícia (tecido conjuntivo com vasa vasorum em grandes vasos). A Microvascularização compreende arteríolas, capilares e venulíneas post-capilares. Os capilares contêm apenas endotélio e lâmina basal, subdividindo-se em: Contínuos (junções oclusivas seladas, sem poros; ex: músculo e SNC), Fenestrados (poros perfurados na parede endotelial; ex: rins e intestinos) e Sinusoides/Descontínuos (trajeto tortuoso, amplas fenestras e lâmina basal descontínua; ex: fígado, baço e medula óssea)."
      }
    ]
  },
  anatomia: {
    tituloDisciplina: "Anatomia Macroscópica",
    bibliografia: "Gray's Anatomia - Base Anatômica da Prática Clínica",
    caminhoBase: "/assets/anatomia/",
    corDestaque: "border-slate-600 bg-slate-50 text-slate-800",
    corPino: "bg-slate-600",
    topicos: [
      {
        id: "esqueletico",
        titulo: "Osteologia e Sistema Articular",
        resumo: "Estudo das estruturas ósseas, cartilagens e articulações que formam o arcabouço de sustentação do corpo humano. Em desenvolvimento ativo para inclusão de peças 3D e pranchas fotográficas fotorealistas."
      },
      {
        id: "nervoso",
        titulo: "Neuroanatomia Topográfica",
        resumo: "Análise das divisões estruturais do Sistema Nervoso Central (Encéfalo e Medula Espinal) e Sistema Nervoso Periférico. Inclui configuração externa do tronco encefálico, sulcos corticais e vascularização poligoniana de Willis."
      }
    ]
  },
  patologia: {
    tituloDisciplina: "Patologia",
    bibliografia: "Robbins & Cotran - Bases Patológicas das Doenças",
    caminhoBase: "/assets/patologia/",
    corDestaque: "border-rose-600 bg-rose-50 text-rose-900",
    corPino: "bg-rose-600",
    topicos: [
      {
        id: "lesao_celular",
        titulo: "Lesão, Adaptação e Morte Celular (Necroses e Apoptose)",
        resumo: "Respostas celulares frente a estresses fisiológicos e estímulos nocivos, englobando adaptações reversíveis (hipertrofia, hiperplasia, atrofia e metaplasia) e lesões celulares. A persistência da injúria conduz à morte celular: necrose (processo acidental com perda da integridade de membrana, inflamação local e padrões morfológicos coagulativo, liquefativo, caseoso, gorduroso e fibrinoide) ou apoptose (morte programada mediada por caspases, sem resposta inflamatória adjacente)."
      },
      {
        id: "inflamacao_reparo",
        titulo: "Inflamação Aguda, Crônica e Reparo Tecidual",
        resumo: "Resposta vascular e celular protetora dos tecidos conjuntivos frente a infecções e danos teciduais. A inflamação aguda caracteriza-se por alterações no calibre vascular, exsudação plasmática (edema) e influxo predominante de neutrófilos. A inflamação crônica cursa com infiltração mononuclear (macrófagos, linfócitos, plasmócitos), destruição tecidual e tentativas simultâneas de reparo (angiogênese e deposição de colágeno por fibroblastos), podendo culminar em fibrose ou regeneração tecidual."
      },
      {
        id: "disturbios_hemodinamicos",
        titulo: "Distúrbios Hemodinâmicos (Trombose, Embolia, Infarto e Edema)",
        resumo: "Alterações no fluxo sanguíneo, hemostasia e equilíbrio hidrostático tecidual. Inclui edema (acúmulo de líquido intersticial por aumento de pressão hidrostática ou queda da pressão oncótica), trombose (formação patológica intravascular de trombos arteriais ou venosos regida pela Tríade de Virchow), embolia (impactação de êmbolos tromboembólicos, gasosos ou gordurosos) e infarto (área de necrose isquêmica por oclusão do suprimento arterial ou venoso)."
      },
      {
        id: "neoplasias",
        titulo: "Neoplasias Benignas e Malignas (Carcinomas, Sarcomas e Linfomas)",
        resumo: "Proliferação autônoma e desregulada de células decorrente de alterações genéticas e epigenéticas em proto-oncogenes e genes supressores de tumor. Diferenciação entre neoplasias benignas (bem circunscritas, expansivas e sem capacidade de metástase) e malignas (infiltrativas, com atipia citológica, pleomorfismo, mitoses atípicas e potencial de invasão vascular e disseminação linfática ou hematogênica)."
      },
      {
        id: "patologia_sistemica",
        titulo: "Patologia Sistêmica (Cardiovascular, Respiratória e Digestiva)",
        resumo: "Expressão histopatológica de doenças nos principais sistemas orgânicos, abrangendo lesões ateroscleróticas e infarto agudo do miocárdio no sistema cardiovascular; pneumonias bacterianas, enfisema e bronquite crônica no sistema respiratório; e gastrites associadas a Helicobacter pylori, úlceras pépticas e doenças inflamatórias intestinais no trato gastrointestinal."
      }
    ]
  },
  parasitologia: {
    tituloDisciplina: "Parasitologia",
    bibliografia: "Neves - Parasitologia Humana",
    caminhoBase: "/assets/parasitologia/",
    corDestaque: "border-emerald-600 bg-emerald-50 text-emerald-900",
    corPino: "bg-emerald-600",
    topicos: [
      {
        id: "protozoo_enterica",
        titulo: "Protozoologia Entérica (Entamoeba histolytica, Giardia duodenalis, Cryptosporidium)",
        resumo: "Protozoários do trato digestivo transmitidos por veiculação fecal-oral através de água e alimentos contaminados com cistos ou oocistos. Estudo morfológico e patogênico de Entamoeba histolytica (trofozoítos com eritrofagocitose e úlceras em botão de camisa), Giardia duodenalis (trofozoítos piriformes com disco suctorial que atapetam a mucosa duodenal) e Cryptosporidium spp. (oocistos esféricos ácido-resistentes em coloração de Ziehl-Neelsen modificado)."
      },
      {
        id: "protozoo_tissular",
        titulo: "Protozoologia Tissular e Sanguínea (Trypanosoma cruzi, Leishmania spp., Plasmodium spp., Toxoplasma gondii)",
        resumo: "Agentes causadores de protozooses sistêmicas transmitidas por vetores artrópodes ou ingestão tecidual. Análise morfológica de tripomastigotas e amastigotas de Trypanosoma cruzi (Doença de Chagas); formas amastigotas de Leishmania em macrófagos; anéis jovens, esquizontes e gametócitos de Plasmodium spp. (Malária); e taquizoítos e cistos teciduais com bradizoítos de Toxoplasma gondii."
      },
      {
        id: "nematoideos",
        titulo: "Helmintologia - Nematódeos (Ascaris, Ancylostoma, Enterobius, Strongyloides)",
        resumo: "Vermes cilíndricos com tubo digestivo completo e sexos separados. Morfologia de adultos e ovos diagnósticos nos exames parasitológicos de fezes: ovos mamelonados de Ascaris lumbricoides, ovos larvados de Ancylostoma e Necator, ovos assimétricos em formato de 'D' de Enterobius vermicularis (pesquisa em fita adesiva) e larvas rabditoides e filarioides de Strongyloides stercoralis."
      },
      {
        id: "cestodeos_trematodeos",
        titulo: "Helmintologia - Cestódeos e Trematódeos (Taenia solium/saginata, Schistosoma mansoni)",
        resumo: "Platelmintos de corpo achatado dorsoventralmente. Cestódeos (tênias): escólex com ventosas e rostro com ganchos (T. solium) ou inerme (T. saginata), proglotes grávidas e ovos com membrana externa radialmente estriada. Trematódeos: Schistosoma mansoni com dimorfismo sexual evidente (macho com canal ginecóforo abrigando a fêmea) e ovos ovalados dotados de espículo lateral conspícuo."
      }
    ]
  },
  microbiologia: {
    tituloDisciplina: "Microbiologia",
    bibliografia: "Murray - Microbiologia Médica",
    caminhoBase: "/assets/microbiologia/",
    corDestaque: "border-amber-600 bg-amber-50 text-amber-900",
    corPino: "bg-amber-600",
    topicos: [
      {
        id: "bacterio_gram_pos",
        titulo: "Bacteriologia - Cocos e Bastonetes Gram-Positivos (Staphylococcus, Streptococcus, Bacillus)",
        resumo: "Bactérias com espessa camada de peptideoglicano e ácidos teicoicos que retêm o complexo cristal violeta-iodo na coloração de Gram, exibindo coloração azul-púrpura. Inclui cocos em arranjo de cachos (Staphylococcus spp., avaliados por testes de catalase e coagulase) ou em cadeias (Streptococcus spp., diferenciados pelo padrão de hemólise em ágar-sangue), além de bacilos formadores de esporos como Bacillus e Clostridium."
      },
      {
        id: "bacterio_gram_neg",
        titulo: "Bacteriologia - Bacilos e Cocos Gram-Negativos (Enterobactérias, Pseudomonas, Neisseria)",
        resumo: "Microrganismos com fina parede de peptideoglicano e membrana externa rica em lipopolissacarídeo (LPS / endotoxina), descorados pelo álcool-acetona e contracorados em rosa/vermelho pela fucsina ou safranina. Abrange enterobactérias fermentadoras de glicose (Escherichia coli, Klebsiella), bacilos não fermentadores ambientais (Pseudomonas aeruginosa) e diplococos reniformes como Neisseria meningitidis e Neisseria gonorrhoeae."
      },
      {
        id: "bacterio_baar",
        titulo: "Bacteriologia - Bacilos Álcool-Ácido Resistentes / BAAR (Mycobacterium tuberculosis e M. leprae)",
        resumo: "Bactérias do gênero Mycobacterium caracterizadas por parede celular rica em ácidos micólicos de alta hidrofobicidade, impermeáveis à coloração de Gram comum. Identificados pela técnica de Ziehl-Neelsen, na qual retêm a fucsina fenicada mesmo após lavagem com álcool-ácido clorídrico, visualizando-se bacilos delgados fúcsia/vermelhos sobre fundo azul de metileno."
      },
      {
        id: "micologia_medica",
        titulo: "Micologia Médica (Fungos Leveduriformes, Filamentosos e Dimórficos - Candida, Aspergillus, Paracoccidioides)",
        resumo: "Morfologia microscópica de fungos de importância médica caracterizados por parede celular de quitina e glucanos. Compreende leveduras monocelulares com brotamento e pseudohifas (Candida spp.), bolores filamentosos com hifas hialinas septadas e conídios (Aspergillus spp.) e fungos dimórficos térmicos com clássica morfologia leveduriforme em 'roda de leme' em tecidos aquecidos (Paracoccidioides brasiliensis)."
      }
    ]
  },
  anatomia: {
    tituloDisciplina: "Anatomia Macroscópica",
    bibliografia: "Gray's Anatomy & Sobotta",
    caminhoBase: "/assets/anatomia/",
    corDestaque: "border-emerald-600 bg-emerald-50 text-emerald-800",
    corPino: "bg-emerald-600",
    topicos: []
  }
};

/**
 * Retorna todos os tópicos integrados em formato unificado para catálogos interativos.
 */
export function getAllTopics() {
  const todos = [];
  Object.keys(catalogData).forEach((key) => {
    const d = catalogData[key];
    d.topicos.forEach((topico) => {
      todos.push({
        disciplina: key,
        tituloDisciplina: d.tituloDisciplina,
        caminhoBase: d.caminhoBase,
        corDestaque: d.corDestaque,
        ...topico
      });
    });
  });
  return todos;
}

/**
 * Sincroniza e funde em tempo real as lâminas e peças cadastradas ou editadas no
 * Painel do Desenvolvedor (salvas no localStorage) com a estrutura teórica oficial de catalogData.
 */
export function sincronizarAcervoPersonalizado() {
  let acervoSalvo = [];
  try {
    const raw = localStorage.getItem("palas_atlas_custom_slides");
    if (raw) acervoSalvo = JSON.parse(raw);
  } catch (e) {
    acervoSalvo = [];
  }
  if (!Array.isArray(acervoSalvo) || acervoSalvo.length === 0) return;

  window.App = window.App || {};
  window.App._slidesListOverride = window.App._slidesListOverride || [];

  acervoSalvo.forEach((lam) => {
    // Adiciona ou atualiza no cache de substituição geral do Palas Atlas
    const idxOverride = window.App._slidesListOverride.findIndex((l) => l.id === lam.id || (l.nome && lam.nome && l.nome.toLowerCase().trim() === lam.nome.toLowerCase().trim()));
    if (idxOverride !== -1) {
      window.App._slidesListOverride[idxOverride] = lam;
    } else {
      window.App._slidesListOverride.push(lam);
    }

    // Identifica a disciplina e o tópico curriculares alvo no catálogo oficial
    const disc = catalogData[lam.disciplina];
    if (disc && Array.isArray(disc.topicos)) {
      const topicoObj = disc.topicos.find((t) => t.id === lam.topico || (t.titulo && t.titulo.toLowerCase().includes((lam.topico || "").toLowerCase())));
      if (topicoObj) {
        topicoObj.laminasEstaticas = Array.isArray(topicoObj.laminasEstaticas) ? topicoObj.laminasEstaticas : [];
        // Atualiza a lâmina original/existente do catálogo ou adiciona no topo da lista se for uma nova lâmina
        const idxLam = topicoObj.laminasEstaticas.findIndex((l) => l.id === lam.id || (l.nome && lam.nome && l.nome.toLowerCase().trim() === lam.nome.toLowerCase().trim()));
        if (idxLam !== -1) {
          topicoObj.laminasEstaticas[idxLam] = lam;
        } else {
          topicoObj.laminasEstaticas.unshift(lam);
        }
      }
    }
  });
}

// Expõe no namespace global para re-sincronização instantânea ao publicar no CMS e invoca na inicialização
window.App = window.App || {};
window.App.sincronizarAcervoPersonalizado = sincronizarAcervoPersonalizado;
if (typeof window !== "undefined") {
  sincronizarAcervoPersonalizado();
}
