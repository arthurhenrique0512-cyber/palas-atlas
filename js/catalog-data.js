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
    corDestaque: "border-teal-700 bg-teal-50 text-slate-900",
    corPino: "bg-teal-700",
    topicos: [
      {
        id: "epitelial",
        titulo: "Tecido Epitelial de Revestimento e Glandular",
        resumo: "Caracterizado por células poliédricas fortemente justapostas, assentadas sobre uma lâmina basal, com escassa matriz extracelular e ausência de vascularização direta (nutrido por difusão a partir do conjuntivo adjacente). Exibe polaridade celular definida (domínios apical, lateral e basal) e especializações de membrana (microvilosidades, cílios, desmossomos e junções de oclusão). Divisões principais: epitélios de revestimento (classificados pelo número de camadas e forma celular) e epitélios glandulares (exócrinos, organizados em ductos e porções secretoras acinares ou tubulares; e endócrinos, cordonais ou foliculares, que lançam hormônios na circulação).",
        laminasEstaticas: []
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
        resumo: "Tecido conjuntivo rígido e mineralizado, composto por matriz orgânica (predomínio de colágeno tipo I) impregnada por matriz inorgânica (cristais de hidroxiapatita). Suas células incluem osteoblastos (síntese do osteoide), osteócitos (manutenção da matriz em lacunas comunicadas por canalículos) e osteoclastos (células multinucleadas responsáveis pela reabsorção óssea). Apresenta-se como Ósseo Compacto (organizado em Sistemas de Havers ou Ósteons, com lamelas concêntricas ao redor de canais vasculares) e Ósseo Esponjoso (rede tridimensional de trabéculas ósseas que delimitam cavidades preenchidas por medula óssea).",
        laminasEstaticas: []
      },
      {
        id: "nervoso",
        titulo: "Tecido Nervoso e Células da Neuroglia",
        resumo: "Composto por neurônios — células altamente especializadas na recepção, processamento e condução do impulso nervoso (constituídos por corpo celular/pericário rico em substância de Nissl, dendritos e axônio) — e pelas células da neuroglia (glia). No Sistema Nervoso Central (SNC), a glia compreende os Astrócitos (sustentação, regulação iônica e formação dos pés vasculares na barreira hematoencefálica), Oligodendrócitos (mielinização central de múltiplos axônios), Microglia (fagócitos/macrófagos residentes) e Células Ependimárias (revestimento dos ventrículos). No Sistema Nervoso Periférico (SNP), inclui as Células de Schwann (mielinização periférica) e Células Satélites."
      },
      {
        id: "muscular",
        titulo: "Tecido Muscular Estriado Esquelético, Cardíaco e Liso",
        resumo: "Especializado na contratilidade através do deslizamento dos miofilamentos de actina e miosina. O Muscular Estriado Esquelético apresenta fibras cilíndricas, longas, multinucleadas com núcleos periféricos e estriações transversais organizadas em sarcômeros (contração rápida e voluntária). O Muscular Estriado Cardíaco é constituído por células ramificadas com 1 a 2 núcleos centrais, unidas por discos intercalares com junções comunicantes e desmossomos (contração involuntária e rítmica). O Muscular Liso apresenta células fusiformes, uninucleadas centrais e sem estriações transversais (âncora em corpos densos; contração lenta, sustentada e involuntária em vísceras e vasos)."
      },
      {
        id: "circulatorio",
        titulo: "Sistema Circulatório e Microvascularização",
        resumo: "Sistema estruturado em vasos sanguíneos cuja parede padrão é formada por três túnicas: Íntima (endotélio plano simples e camada subendotelial), Média (músculo liso e lâminas elásticas) e Adventícia (tecido conjuntivo com vasa vasorum em grandes vasos). A Microvascularização compreende arteríolas, capilares e vênulas pós-capilares. Os capilares contêm apenas endotélio e lâmina basal, subdividindo-se em: Contínuos (junções oclusivas seladas, sem poros; ex: músculo e SNC), Fenestrados (poros perfurados na parede endotelial; ex: rins e intestinos) e Sinusoides/Descontínuos (trajeto tortuoso, amplas fenestras e lâmina basal descontínua; ex: fígado, baço e medula óssea)."
      }
    ]
  },
  patologia: {
    tituloDisciplina: "Patologia",
    bibliografia: "Robbins & Cotran - Bases Patológicas das Doenças",
    caminhoBase: "/assets/patologia/",
    corDestaque: "border-rose-600 bg-rose-50 text-rose-900",
    corPino: "bg-rose-600",
    topicos: []
  },
  parasitologia: {
    tituloDisciplina: "Parasitologia",
    bibliografia: "Neves - Parasitologia Humana",
    caminhoBase: "/assets/parasitologia/",
    corDestaque: "border-emerald-600 bg-emerald-50 text-emerald-900",
    corPino: "bg-emerald-600",
    topicos: []
  },
  microbiologia: {
    tituloDisciplina: "Microbiologia",
    bibliografia: "Murray - Microbiologia Médica",
    caminhoBase: "/assets/microbiologia/",
    corDestaque: "border-amber-600 bg-amber-50 text-amber-900",
    corPino: "bg-amber-600",
    topicos: []
  }
};
