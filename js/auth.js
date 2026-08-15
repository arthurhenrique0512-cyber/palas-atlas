/**
 * auth.js — Módulo de Autenticação Firebase (Palas Atlas Dashboard)
 * Carregado como script clássico após os SDKs do Firebase via CDN.
 */

// Configuração Firebase (inline para uso como script clássico, sem ES module)
const _firebaseConfig = {
  apiKey:            "AIzaSyAv68_VWTEPFoDOyKrvz-jmPRycVNek_2M",
  authDomain:        "palas-atlas.firebaseapp.com",
  projectId:         "palas-atlas",
  storageBucket:     "palas-atlas.firebasestorage.app",
  messagingSenderId: "668077173166",
  appId:             "1:668077173166:web:02fe56efa874f36dedc03f"
};

if (!firebase.apps.length) {
  firebase.initializeApp(_firebaseConfig);
}

const _auth = firebase.auth();

function initDashboardAuth() {
  _auth.onAuthStateChanged((user) => {
    const overlay = document.getElementById('dashLoginOverlay');
    if (!overlay) return;
    if (user) {
      overlay.classList.add('hidden');
      console.info('[Auth] Admin autenticado:', user.email);
    } else {
      overlay.classList.remove('hidden');
      console.info('[Auth] Sem sessão. Modal de login exibido.');
    }
  });
}

async function dashboardLogin() {
  const email    = document.getElementById('dashLoginEmail')?.value?.trim();
  const password = document.getElementById('dashLoginPassword')?.value;
  const errorEl  = document.getElementById('dashLoginError');
  const btnText  = document.getElementById('dashLoginBtnText');
  const spinner  = document.getElementById('dashLoginSpinner');

  if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
  if (!email || !password) { _showAuthError('Preencha o e-mail e a senha.'); return; }

  if (btnText) btnText.textContent = 'Verificando...';
  if (spinner) spinner.classList.remove('hidden');

  try {
    await _auth.signInWithEmailAndPassword(email, password);
    const emailEl = document.getElementById('dashLoginEmail');
    const passEl  = document.getElementById('dashLoginPassword');
    if (emailEl) emailEl.value = '';
    if (passEl)  passEl.value  = '';
  } catch (err) {
    _showAuthError(_mapFirebaseError(err.code));
  } finally {
    if (btnText) btnText.textContent = 'Entrar no Painel';
    if (spinner) spinner.classList.add('hidden');
  }
}

async function dashboardLogout() {
  try { await _auth.signOut(); } catch (err) { console.error('[Auth] Erro logout:', err); }
}

function getCurrentUser() { return _auth.currentUser; }

function _showAuthError(msg) {
  const el = document.getElementById('dashLoginError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _mapFirebaseError(code) {
  const m = {
    'auth/user-not-found':         'E-mail não encontrado.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-email':          'E-mail inválido.',
    'auth/too-many-requests':      'Muitas tentativas. Tente mais tarde.',
    'auth/invalid-credential':     'Credenciais inválidas.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  };
  return m[code] || 'Erro ao autenticar. Tente novamente.';
}

window.App = window.App || {};
window.App.dashboardLogin  = dashboardLogin;
window.App.dashboardLogout = dashboardLogout;
window.App.getCurrentUser  = getCurrentUser;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardAuth);
} else {
  initDashboardAuth();
}
