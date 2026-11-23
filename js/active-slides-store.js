/**
 * ============================================================================
 * STORE REATIVO DE LÂMINAS ATIVAS DO CLOUD FIRESTORE (SINGLE SOURCE OF TRUTH)
 * ============================================================================
 * Garante que apenas documentos com status === "ativa" sejam exibidos no site
 * público (Hero, Vitrine, Busca, Catálogo de Tópicos e Microscópio).
 *
 * `KNOWN_SLIDE_HINTS` é usado EXCLUSIVAMENTE para enriquecer metadados ausentes
 * (como coloração genérica "Outra" ou thumbnail DZI) de lâminas já confirmadas
 * como ativas no Firestore — jamais como catálogo paralelo de fallback.
 */
import { db } from "./firebase-config.js";

const KNOWN_SLIDE_HINTS = {
  cw3XGCgUwN71XdlwkUe5: {
    stain: "Desgaste",
    maxMag: 40,
    previewImage: "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg",
    subtitulo: "Ósteons, canalículos e linhas cimentantes em 40x."
  },
  FFGk5d9kOAct5HIDdjQ7: {
    stain: "Desgaste",
    maxMag: 10,
    previewImage: "assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg",
    subtitulo: "Visão panorâmica do tecido ósseo compacto cortical."
  },
  a3oRvXvJpMKAtU2RE85q: {
    stain: "H&E",
    maxMag: 40,
    previewImage: "assets/histologia/lamina-real1-preview.jpg",
    subtitulo: "Epiderme estratificada queratinizada e derme papilar."
  }
};

export const TOPIC_LABELS = {
  epitelial: "Tecido Epitelial",
  conjuntivo: "Tecido Conjuntivo",
  adiposo: "Tecido Adiposo",
  cartilaginoso: "Tecido Cartilaginoso",
  osseo: "Tecido Ósseo",
  nervoso: "Tecido Nervoso",
  muscular: "Tecido Muscular",
  circulatorio: "Sistema Circulatório"
};

export const TOPIC_SHORT_LABELS = {
  epitelial: "Epitelial",
  conjuntivo: "Conjuntivo",
  adiposo: "Adiposo",
  cartilaginoso: "Cartilaginoso",
  osseo: "Ósseo",
  nervoso: "Nervoso",
  muscular: "Muscular",
  circulatorio: "Circulatório"
};

const DISCIPLINA_LABELS = {
  histologia: "Histologia",
  patologia: "Patologia",
  parasitologia: "Parasitologia",
  microbiologia: "Microbiologia"
};

const ORDEM_PRIORITARIA = [
  "cw3XGCgUwN71XdlwkUe5",
  "a3oRvXvJpMKAtU2RE85q",
  "FFGk5d9kOAct5HIDdjQ7"
];

let _activeSlides = [];
let _isLoaded = false;
let _lastError = null;
let _unsubscribeSnapshot = null;
const _listeners = new Set();

export function isGenericStain(val) {
  const clean = String(val || "").trim().toLowerCase();
  return !clean || [
    "outra",
    "outro",
    "outras",
    "geral",
    "campo microscópico",
    "campo microscopico"
  ].includes(clean);
}

function sanitizePreviewUrl(rawUrl) {
  const s = String(rawUrl || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("//")
  ) {
    return "";
  }
  return s.replace(/^\/(?!\/)/, "");
}

export function derivePreviewImage(id, data = {}) {
  const hint = KNOWN_SLIDE_HINTS[id];
  const explicit = sanitizePreviewUrl(
    data.thumbnailUrl || data.previewImage || data.imagemCapa || data.capaUrl || ""
  );
  if (explicit && !explicit.toLowerCase().endsWith(".dzi")) {
    return explicit;
  }

  const rawSource = sanitizePreviewUrl(
    data.dziUrl || data.imagemUrl || data.imageUrl || data.caminhoImagemBase || ""
  );
  if (rawSource.toLowerCase().endsWith(".dzi")) {
    const baseDzi = rawSource.replace(/\.dzi$/i, "");
    if (baseDzi.includes("lamina-real1") || baseDzi.includes("pele")) {
      return "assets/histologia/lamina-real1-preview.jpg";
    }
    if (baseDzi.includes("osso_maduro_desgaste_ct_3.0")) {
      return "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
    }
    if (baseDzi.includes("osso_maduro_desgaste_ct_2.0")) {
      return "assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg";
    }
    if (baseDzi.includes("osso_maduro_desgaste_ct")) {
      return "assets/histologia/osso_maduro_desgaste_ct-preview.jpg";
    }
    return `${baseDzi}-preview.jpg`;
  }

  if (rawSource) return rawSource;
  if (hint?.previewImage) return hint.previewImage;
  return "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
}

function formatStainLabel(rawColoracao, maxMag, hint) {
  let base = String(rawColoracao || "").trim();
  if (isGenericStain(base)) {
    base = hint?.stain || "";
  }
  if (!base) {
    return `${maxMag}x`;
  }
  if (/\b\d+x\b/i.test(base)) {
    return base;
  }
  return `${base} · ${maxMag}x`;
}

export function normalizeActiveSlide(id, data) {
  if (!data || String(data.status || "").toLowerCase().trim() !== "ativa") {
    return null;
  }
  const cleanId = String(id || "").trim();
  const nome = String(data.nome || "").trim();
  if (!cleanId || !nome) return null;

  const hint = KNOWN_SLIDE_HINTS[cleanId];
  const disciplina = String(data.disciplina || "histologia").trim().toLowerCase() || "histologia";
  const topico = String(data.topico || "").trim().toLowerCase();
  const maxMag = Number(data.maxMagnification || data.maxMag || hint?.maxMag) || 40;
  const coloracaoClean = !isGenericStain(data.coloracao)
    ? String(data.coloracao).trim()
    : (hint?.stain || "Coloração histológica");
  const stainBadge = formatStainLabel(data.coloracao, maxMag, hint);
  const subtitulo = String(data.subtitulo || hint?.subtitulo || "Preparação histológica digitalizada.").trim();

  return {
    id: cleanId,
    nome,
    disciplina,
    disciplinaLabel: DISCIPLINA_LABELS[disciplina] || (disciplina.charAt(0).toUpperCase() + disciplina.slice(1)),
    topico,
    topicoLabel: TOPIC_LABELS[topico] || (topico ? topico.charAt(0).toUpperCase() + topico.slice(1) : "Histologia"),
    topicoShort: TOPIC_SHORT_LABELS[topico] || (topico ? topico.charAt(0).toUpperCase() + topico.slice(1) : "Geral"),
    coloracao: coloracaoClean,
    stainBadge,
    maxMagnification: maxMag,
    subtitulo,
    thumbnailUrl: derivePreviewImage(cleanId, data),
    link: `microscopio.html?id=${encodeURIComponent(cleanId)}`,
    raw: data
  };
}

function sortSlidesDeterministic(list) {
  return [...list].sort((a, b) => {
    const ia = ORDEM_PRIORITARIA.indexOf(a.id);
    const ib = ORDEM_PRIORITARIA.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const byName = a.nome.localeCompare(b.nome, "pt-BR");
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

function notifyListeners() {
  const payload = {
    slides: _activeSlides,
    loaded: _isLoaded,
    error: _lastError
  };
  _listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error("[ActiveSlidesStore] Erro ao notificar listener:", err);
    }
  });
}

function ensureFirestoreSubscription() {
  if (_unsubscribeSnapshot) return;
  if (typeof db === "undefined" || !db) {
    _isLoaded = true;
    _lastError = new Error("Firestore indisponível");
    notifyListeners();
    return;
  }

  try {
    _unsubscribeSnapshot = db
      .collection("laminas")
      .where("status", "==", "ativa")
      .onSnapshot(
        (snapshot) => {
          const next = [];
          snapshot.forEach((doc) => {
            const normalized = normalizeActiveSlide(doc.id, doc.data());
            if (normalized) next.push(normalized);
          });
          _activeSlides = sortSlidesDeterministic(next);
          _isLoaded = true;
          _lastError = null;
          notifyListeners();
        },
        (err) => {
          _lastError = err;
          _isLoaded = true;
          console.warn("[ActiveSlidesStore] Erro no listener Firestore:", err);
          notifyListeners();
        }
      );
  } catch (err) {
    _lastError = err;
    _isLoaded = true;
    console.warn("[ActiveSlidesStore] Falha ao iniciar listener Firestore:", err);
    notifyListeners();
  }
}

export function subscribeActiveSlides(listener) {
  ensureFirestoreSubscription();
  if (typeof listener === "function") {
    _listeners.add(listener);
    listener({
      slides: _activeSlides,
      loaded: _isLoaded,
      error: _lastError
    });
  }
  return () => {
    _listeners.delete(listener);
  };
}

export function getActiveSlides() {
  ensureFirestoreSubscription();
  return _activeSlides;
}

export function isActiveSlidesLoaded() {
  return _isLoaded;
}

export function getHourlySlideIndex(length, nowMs = Date.now()) {
  const total = Number(length) || 0;
  if (total <= 0) return 0;
  return Math.floor(nowMs / 3600000) % total;
}

export function getMsUntilNextHour(nowMs = Date.now()) {
  const remainder = nowMs % 3600000;
  return (3600000 - remainder) + 150;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (typeof _unsubscribeSnapshot === "function") {
      try {
        _unsubscribeSnapshot();
      } catch (e) {}
      _unsubscribeSnapshot = null;
    }
  });

  window.PalasActiveSlides = {
    subscribe: subscribeActiveSlides,
    getSlides: getActiveSlides,
    isLoaded: isActiveSlidesLoaded,
    getHourlySlideIndex
  };
}
