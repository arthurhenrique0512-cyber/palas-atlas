/**
 * ============================================================================
 * PALAS ATLAS — CERTIDÃO ÓPTICA (Calibração e Ampliação Real por Lâmina)
 * ============================================================================
 * Módulo puro (sem DOM) compartilhado pelo Microscópio Virtual, pelo CMS e
 * pelos testes automatizados.
 *
 * Princípio físico:
 *   A única grandeza verdadeira de uma imagem de microscopia digital é o
 *   tamanho real de cada pixel — µm/pixel (MPP). Ampliação máxima, régua e
 *   campo de visão DERIVAM do MPP; nunca de um número digitado.
 *
 *   Uma lâmina varrida com a objetiva O e costurada sem reamostragem possui,
 *   em resolução nativa (1 px imagem = 1 px tela), exatamente a ampliação O.
 *   Se qualquer etapa (costura, exportação, DZI) reduziu a imagem por um
 *   fator f (< 1), o MPP efetivo aumenta (MPP / f) e a ampliação máxima real
 *   cai proporcionalmente (O × f). Ampliar além disso é "ampliação vazia".
 *
 * Fórmulas:
 *   MPP_efetivo       = MPP_calibrado / fatorReducao
 *   Ampliação_máxima  = Objetiva × (MPP_calibrado / MPP_efetivo)
 *   Ampliação_exibida = Ampliação_máxima × (zoomAtual / zoomNativo)
 * ============================================================================
 */

/** Objetivas comerciais reconhecidas pelo sistema. */
export const OBJETIVAS_PADRAO = [2, 4, 10, 20, 40, 60, 100];

/**
 * Faixas plausíveis de MPP (µm/pixel) na resolução nativa de cada objetiva,
 * cobrindo sensores de 1,4–6,5 µm com adaptadores C-mount de 0,35x a 1,0x.
 * Fora destas faixas, a calibração ou a objetiva declarada é suspeita.
 */
export const FAIXAS_MPP_ESPERADAS = {
  2:   { min: 0.70,  max: 9.30 },
  4:   { min: 0.35,  max: 4.65 },
  10:  { min: 0.14,  max: 1.86 },
  20:  { min: 0.07,  max: 0.93 },
  40:  { min: 0.035, max: 0.47 },
  60:  { min: 0.023, max: 0.31 },
  100: { min: 0.014, max: 0.19 }
};

/** Tolerância (fração) para considerar duas dimensões/ampliações equivalentes. */
const TOLERANCIA_IGUALDADE = 0.01;
/** Tolerância (fração) na checagem geométrica da grade de costura. */
const TOLERANCIA_GRADE = 0.20;

export const SELOS = {
  VERIFICADA: "verificada",
  ESTIMADA: "estimada",
  NAO_VERIFICADA: "nao_verificada"
};

function numeroPositivo(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Estimativa teórica de MPP a partir do hardware.
 *   MPP ≈ tamanho do pixel do sensor (µm) ÷ (objetiva × adaptador C-mount)
 */
export function estimarMppTeorico({ tamanhoPixelSensorUm, objetiva, adaptador = 1 } = {}) {
  const px = numeroPositivo(tamanhoPixelSensorUm);
  const obj = numeroPositivo(objetiva);
  const ad = numeroPositivo(adaptador) || 1;
  if (!px || !obj) return null;
  return px / (obj * ad);
}

/**
 * Calibração por micrômetro objetivo: distância conhecida (µm) entre duas
 * marcas e a distância medida em pixels na foto (mesma objetiva).
 */
export function calcularMppPorMicrometro({ distanciaUm, distanciaPx } = {}) {
  const um = numeroPositivo(distanciaUm);
  const px = numeroPositivo(distanciaPx);
  if (!um || !px) return null;
  return um / px;
}

/**
 * Fator de redução aplicado entre a imagem costurada e a pirâmide final.
 * 1.0 = resolução preservada; 0.5 = reduzida pela metade.
 * Nunca retorna > 1 (ampliar a imagem não cria resolução).
 */
export function calcularFatorReducao({ costuraLargura, costuraAltura, dziLargura, dziAltura } = {}) {
  const cw = numeroPositivo(costuraLargura);
  const dw = numeroPositivo(dziLargura);
  if (!cw || !dw) return 1;
  let fator = dw / cw;
  const ch = numeroPositivo(costuraAltura);
  const dh = numeroPositivo(dziAltura);
  if (ch && dh) fator = Math.min(fator, dh / ch);
  if (Math.abs(fator - 1) <= TOLERANCIA_IGUALDADE) return 1;
  return Math.min(1, fator);
}

export function calcularMppEfetivo(mppCalibrado, fatorReducao = 1) {
  const mpp = numeroPositivo(mppCalibrado);
  const f = numeroPositivo(fatorReducao) || 1;
  if (!mpp) return null;
  return mpp / Math.min(1, f);
}

export function calcularAmpliacaoMaximaReal(objetiva, mppCalibrado, mppEfetivo) {
  const obj = numeroPositivo(objetiva);
  const mc = numeroPositivo(mppCalibrado);
  const me = numeroPositivo(mppEfetivo);
  if (!obj) return null;
  if (!mc || !me) return obj;
  return obj * (mc / me);
}

/**
 * Checagem geométrica da grade: a largura costurada deve ser compatível com
 *   fotoLargura + (colunas − 1) × fotoLargura × (1 − overlap)
 * Um desvio grande indica reamostragem em alguma etapa.
 */
export function verificarGradeCostura({ fotoLargura, fotoAltura, colunas, linhas, overlap, costuraLargura, costuraAltura } = {}) {
  const fw = numeroPositivo(fotoLargura);
  const fh = numeroPositivo(fotoAltura);
  const c = numeroPositivo(colunas);
  const l = numeroPositivo(linhas);
  const cw = numeroPositivo(costuraLargura);
  const ch = numeroPositivo(costuraAltura);
  if (!fw || !fh || !c || !l || !cw || !ch) return null;

  let ov = Number(overlap) || 0;
  if (ov > 1) ov = ov / 100; // aceita 15 ou 0.15
  ov = Math.max(0, Math.min(0.9, ov));

  const esperadaLargura = fw + (c - 1) * fw * (1 - ov);
  const esperadaAltura  = fh + (l - 1) * fh * (1 - ov);
  const desvioLargura = (cw - esperadaLargura) / esperadaLargura;
  const desvioAltura  = (ch - esperadaAltura) / esperadaAltura;
  const escalaEstimada = Math.min(cw / esperadaLargura, ch / esperadaAltura);

  return {
    esperadaLargura: Math.round(esperadaLargura),
    esperadaAltura: Math.round(esperadaAltura),
    desvioLargura,
    desvioAltura,
    escalaEstimada,
    consistente: Math.abs(desvioLargura) <= TOLERANCIA_GRADE && Math.abs(desvioAltura) <= TOLERANCIA_GRADE
  };
}

export function mppDentroDaFaixa(objetiva, mpp) {
  const faixa = FAIXAS_MPP_ESPERADAS[Number(objetiva)];
  const m = numeroPositivo(mpp);
  if (!faixa || !m) return null;
  return m >= faixa.min && m <= faixa.max;
}

/**
 * Emite a Certidão Óptica de uma lâmina.
 *
 * @param {Object} params
 * @param {Object} [params.lamina]    Documento da lâmina (Firestore/acervo)
 * @param {Object} [params.manifesto] Conteúdo do <lamina>.optics.json (pipeline)
 * @param {Object} [params.perfil]    Perfil óptico do equipamento (calibrações)
 * @param {Object} [params.dimensoesDzi] { largura, altura } lidas do DZI aberto
 */
export function emitirCertidaoOptica({ lamina = {}, manifesto = null, perfil = null, dimensoesDzi = null } = {}) {
  const m = manifesto || {};
  const alertas = [];

  // 1. Objetiva de captura (manifesto > lâmina)
  const objetiva =
    numeroPositivo(m.objetiva) ||
    numeroPositivo(lamina.objetivaCaptura) ||
    numeroPositivo(lamina.maxMagnification) ||
    numeroPositivo(lamina.maxMag) ||
    40;

  // 2. MPP calibrado e procedência
  let mppCalibrado = null;
  let metodo = "declarado";
  const calibPerfil = perfil && perfil.calibracoes ? numeroPositivo(perfil.calibracoes[String(objetiva)]) : null;
  const metodoPerfil = String((perfil && perfil.metodo) || "").toLowerCase();

  if (numeroPositivo(m.mppCalibrado)) {
    mppCalibrado = Number(m.mppCalibrado);
    metodo = String(m.metodoCalibracao || "manifesto").toLowerCase();
  } else if (calibPerfil) {
    mppCalibrado = calibPerfil;
    metodo = metodoPerfil || "perfil";
  } else {
    const teorico = estimarMppTeorico({
      tamanhoPixelSensorUm: m.tamanhoPixelSensorUm ?? perfil?.tamanhoPixelSensorUm,
      objetiva,
      adaptador: m.adaptador ?? perfil?.adaptador
    });
    if (teorico) {
      mppCalibrado = teorico;
      metodo = "teorico_sensor";
    } else if (numeroPositivo(lamina.mpp)) {
      mppCalibrado = Number(lamina.mpp);
      metodo = lamina.metodoCalibracao ? String(lamina.metodoCalibracao).toLowerCase() : "declarado";
    }
  }

  // 3. Fator de redução entre costura e DZI
  const dziLargura = numeroPositivo(dimensoesDzi?.largura) || numeroPositivo(m.dziLargura);
  const dziAltura  = numeroPositivo(dimensoesDzi?.altura)  || numeroPositivo(m.dziAltura);
  let fatorReducao = numeroPositivo(m.fatorReducao) || 1;
  if (numeroPositivo(m.costuraLargura) && dziLargura) {
    fatorReducao = calcularFatorReducao({
      costuraLargura: m.costuraLargura,
      costuraAltura: m.costuraAltura,
      dziLargura,
      dziAltura
    });
  }
  fatorReducao = Math.min(1, fatorReducao);

  if (fatorReducao < 1) {
    alertas.push({
      nivel: "aviso",
      codigo: "imagem_reduzida",
      mensagem: `A imagem foi reduzida para ${(fatorReducao * 100).toFixed(1)}% entre a costura e a pirâmide DZI. A ampliação máxima real foi rebaixada automaticamente.`
    });
  }

  // 4. Checagem geométrica da grade (detecta reamostragem dentro da costura)
  const grade = verificarGradeCostura({
    fotoLargura: m.fotoLargura,
    fotoAltura: m.fotoAltura,
    colunas: m.grade?.colunas,
    linhas: m.grade?.linhas,
    overlap: m.grade?.overlap,
    costuraLargura: m.costuraLargura,
    costuraAltura: m.costuraAltura
  });
  if (grade && !grade.consistente) {
    alertas.push({
      nivel: "aviso",
      codigo: "grade_inconsistente",
      mensagem: `Dimensões costuradas (${m.costuraLargura}×${m.costuraAltura}) divergem do esperado pela grade (~${grade.esperadaLargura}×${grade.esperadaAltura}). Verifique se as fotos foram redimensionadas antes da costura.`
    });
    if (grade.escalaEstimada < 1 - TOLERANCIA_GRADE) {
      fatorReducao = Math.min(fatorReducao, grade.escalaEstimada);
    }
  }

  const mppEfetivo = mppCalibrado ? calcularMppEfetivo(mppCalibrado, fatorReducao) : null;
  let ampliacaoMaxima = mppCalibrado
    ? calcularAmpliacaoMaximaReal(objetiva, mppCalibrado, mppEfetivo)
    : objetiva * fatorReducao;
  ampliacaoMaxima = Math.round(ampliacaoMaxima * 10) / 10;

  // 5. Faixa plausível do MPP para a objetiva declarada
  if (mppCalibrado && mppDentroDaFaixa(objetiva, mppCalibrado) === false) {
    const faixa = FAIXAS_MPP_ESPERADAS[objetiva];
    alertas.push({
      nivel: "erro",
      codigo: "mpp_fora_da_faixa",
      mensagem: `MPP de ${mppCalibrado.toFixed(4)} µm/px é implausível para objetiva de ${objetiva}x (faixa esperada ${faixa.min}–${faixa.max} µm/px). Revise a objetiva declarada ou a calibração.`
    });
  }

  // 6. Selo de procedência
  let selo = SELOS.NAO_VERIFICADA;
  const temManifesto = !!manifesto;
  if (mppCalibrado && metodo.includes("micrometro") && temManifesto) {
    selo = SELOS.VERIFICADA;
  } else if (mppCalibrado && (temManifesto || metodo.includes("micrometro") || metodo === "teorico_sensor")) {
    selo = SELOS.ESTIMADA;
  }
  if (alertas.some(a => a.nivel === "erro") && selo === SELOS.VERIFICADA) {
    selo = SELOS.ESTIMADA;
  }
  if (!temManifesto) {
    alertas.push({
      nivel: "info",
      codigo: "sem_manifesto",
      mensagem: "Lâmina sem manifesto de captura (.optics.json). A ampliação máxima usa a objetiva declarada e não pôde ser comprovada."
    });
  }

  // 7. Dimensão física da lâmina digitalizada
  let dimensaoFisicaMm = null;
  if (mppEfetivo && dziLargura && dziAltura) {
    dimensaoFisicaMm = {
      largura: (dziLargura * mppEfetivo) / 1000,
      altura: (dziAltura * mppEfetivo) / 1000
    };
  }

  return {
    objetiva,
    mppCalibrado,
    mppEfetivo,
    fatorReducao,
    ampliacaoMaxima,
    metodo,
    selo,
    alertas,
    grade,
    dimensaoFisicaMm,
    perfilOptico: m.perfilOptico || lamina.perfilOptico || null,
    emitidaEm: new Date().toISOString()
  };
}

/**
 * Ampliação exibida para o zoom atual. Nunca ultrapassa a ampliação máxima.
 */
export function calcularAmpliacaoExibida(ampliacaoMaxima, zoomAtual, zoomNativo) {
  const amax = numeroPositivo(ampliacaoMaxima);
  const z = numeroPositivo(zoomAtual);
  const zn = numeroPositivo(zoomNativo);
  if (!amax || !z || !zn) return null;
  const amp = amax * (z / zn);
  // Erros de ponto flutuante da mola do OpenSeadragon no teto
  if (amp >= amax * (1 - 0.005)) return amax;
  return amp;
}

/** Zoom do visualizador correspondente a uma ampliação desejada. */
export function calcularZoomParaAmpliacao(ampliacao, ampliacaoMaxima, zoomNativo) {
  const a = numeroPositivo(ampliacao);
  const amax = numeroPositivo(ampliacaoMaxima);
  const zn = numeroPositivo(zoomNativo);
  if (!a || !amax || !zn) return null;
  return zn * (Math.min(a, amax) / amax);
}

/**
 * Largura real (µm) do campo exibido na tela.
 * Em zoom nativo, 1 px de tela mostra 1 px de imagem (MPP efetivo).
 */
export function calcularCampoDeVisaoUm(larguraTelaPx, zoomAtual, zoomNativo, mppEfetivo) {
  const w = numeroPositivo(larguraTelaPx);
  const z = numeroPositivo(zoomAtual);
  const zn = numeroPositivo(zoomNativo);
  const mpp = numeroPositivo(mppEfetivo);
  if (!w || !z || !zn || !mpp) return null;
  return w * (zn / z) * mpp;
}

/** Formata comprimento em µm/mm de forma legível. */
export function formatarComprimento(um) {
  const v = Number(um);
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 1 : 2).replace(".", ",")} mm`;
  if (v >= 100) return `${Math.round(v)} µm`;
  return `${v.toFixed(1).replace(".", ",")} µm`;
}

/** Objetiva disponível para a lâmina? (respeita tolerância de 1%) */
export function objetivaDisponivel(objetiva, ampliacaoMaxima) {
  const o = numeroPositivo(objetiva);
  const amax = numeroPositivo(ampliacaoMaxima);
  if (!o || !amax) return false;
  return o <= amax * (1 + TOLERANCIA_IGUALDADE);
}

export const ROTULOS_SELO = {
  verificada: "Verificada por micrômetro",
  estimada: "Estimada",
  nao_verificada: "Não verificada"
};
