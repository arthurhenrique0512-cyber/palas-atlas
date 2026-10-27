/**
 * Configuração e inicialização do Firebase Cloud Firestore (Palas Atlas).
 * Migração definitiva para a nuvem oficial e limpeza de cache do localStorage.
 */

const firebaseConfig = window.__PALAS_FIREBASE_CONFIG__ || {
  apiKey: "AIzaSyAv68_VWTEPFoDOyKrvz-jmPRycVNek_2M",
  authDomain: "palas-atlas.firebaseapp.com",
  projectId: "palas-atlas",
  storageBucket: "palas-atlas.firebasestorage.app",
  messagingSenderId: "668077173166",
  appId: "1:668077173166:web:02fe56efa874f36dedc03f"
};
window.__PALAS_FIREBASE_CONFIG__ = firebaseConfig;

// Inicializa o SDK do Firebase caso nenhuma instância tenha sido carregada previamente
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

// Instâncias oficiais do Cloud Firestore e Auth para o ecossistema do Palas Atlas
const db = firebase.firestore();
const auth = typeof firebase.auth === "function" ? firebase.auth() : null;
try {
  window.dispatchEvent(new CustomEvent('palas-firebase-ready', { detail: { db, auth } }));
} catch (e) {}

// Limpeza definitiva dos dados antigos do localStorage para evitar duplicidades ou conflitos com a nuvem
try {
  localStorage.removeItem("palas_atlas_custom_slides");
  localStorage.removeItem("pecas_locais");
  localStorage.removeItem("palas_atlas_old_cache");
  console.info("[Palas Atlas - Cloud Firestore] Inicializado com sucesso. Cache do localStorage limpo e migrado para a nuvem.");
} catch (error) {
  console.warn("[Palas Atlas - Cloud Firestore] Aviso durante a limpeza do cache no localStorage:", error);
}

export { db, auth };

