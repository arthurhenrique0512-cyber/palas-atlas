/**
 * Palas Atlas - Painel de Configurações Global (Web Component)
 * Responsável por gerenciar as preferências do usuário via LocalStorage
 * e aplicar modificações globais na interface da aplicação.
 */

class SettingsPanel extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    
    // Definições padrão
    this.settings = {
      theme: 'dark', // 'dark' ou 'light'
      typography: 'medium', // 'small', 'medium', 'large'
      density: 'comfortable', // 'compact', 'comfortable'
      reduceMotion: false // boolean
    };

    // Tentar carregar do localStorage
    this.loadSettings();
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
    this.applySettingsGlobally();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem('@PalasAtlas:Settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (err) {
      console.warn("Falha ao carregar configurações do LocalStorage", err);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('@PalasAtlas:Settings', JSON.stringify(this.settings));
      this.applySettingsGlobally();
    } catch (err) {
      console.warn("Falha ao salvar configurações no LocalStorage", err);
    }
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    const drawer = this.querySelector('#settings-drawer');
    const overlay = this.querySelector('#settings-overlay');
    
    if (this.isOpen) {
      drawer.classList.remove('translate-x-full');
      overlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
      drawer.classList.add('translate-x-full');
      overlay.classList.add('opacity-0', 'pointer-events-none');
    }
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
    this.updateUI();
  }

  applySettingsGlobally() {
    const root = document.documentElement;

    // 1. Tipografia (Ajusta o font-size raiz, escalando rem)
    if (this.settings.typography === 'small') root.style.fontSize = '14px';
    else if (this.settings.typography === 'large') root.style.fontSize = '18px';
    else root.style.fontSize = '16px'; // medium

    // 2. Acessibilidade: Reduzir Movimento
    if (this.settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // 3. Tema Light/Dark
    // Injeta estilo dinâmico global se for Light Mode
    let themeStyle = document.getElementById('dynamic-theme-style');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'dynamic-theme-style';
      document.head.appendChild(themeStyle);
    }

    if (this.settings.theme === 'light') {
      themeStyle.textContent = `
        body.theme-override-enabled, 
        body.theme-override-enabled main.bg-neutral-900,
        body.theme-override-enabled .bg-neutral-950,
        body.theme-override-enabled .bg-neutral-900 {
          background-color: #f8fafc !important;
          color: #1e293b !important;
        }
        body.theme-override-enabled .text-white { color: #0f172a !important; }
        body.theme-override-enabled .text-neutral-400 { color: #475569 !important; }
        body.theme-override-enabled .text-neutral-300 { color: #334155 !important; }
        body.theme-override-enabled .border-neutral-800 { border-color: #e2e8f0 !important; }
        body.theme-override-enabled .border-neutral-700 { border-color: #cbd5e1 !important; }
      `;
      document.body.classList.add('theme-override-enabled');
    } else {
      themeStyle.textContent = '';
      document.body.classList.remove('theme-override-enabled');
    }

    // 4. Densidade
    if (this.settings.density === 'compact') {
      root.classList.add('density-compact');
    } else {
      root.classList.remove('density-compact');
    }

    // Estilos extras injetados
    let extraStyle = document.getElementById('settings-extra-style');
    if (!extraStyle) {
      extraStyle = document.createElement('style');
      extraStyle.id = 'settings-extra-style';
      extraStyle.textContent = `
        html.reduce-motion * {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
        html.density-compact .gap-6 { gap: 1rem !important; }
        html.density-compact .p-6 { padding: 1rem !important; }
        html.density-compact .py-12 { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
      `;
      document.head.appendChild(extraStyle);
    }
  }

  updateUI() {
    // Atualiza o estado visual dos botões do painel baseado no state atual
    const btns = this.querySelectorAll('[data-setting]');
    btns.forEach(btn => {
      const key = btn.getAttribute('data-setting');
      const val = btn.getAttribute('data-value');
      
      // Reseta classes ativas
      if (btn.tagName.toLowerCase() === 'button') {
        btn.classList.remove('bg-sky-600', 'text-white', 'border-sky-500');
        btn.classList.add('bg-neutral-800/50', 'text-neutral-400', 'border-transparent');
        
        // Ativa o selecionado
        if (this.settings[key] === val || (val === 'true' && this.settings[key] === true) || (val === 'false' && this.settings[key] === false)) {
          btn.classList.remove('bg-neutral-800/50', 'text-neutral-400', 'border-transparent');
          btn.classList.add('bg-sky-600', 'text-white', 'border-sky-500', 'border');
        }
      }
    });

    // Toggle (checkbox visual)
    const toggleMotion = this.querySelector('#btn-reduce-motion');
    if (toggleMotion) {
      if (this.settings.reduceMotion) {
        toggleMotion.classList.add('bg-sky-500');
        toggleMotion.classList.remove('bg-neutral-600');
        toggleMotion.firstElementChild.classList.add('translate-x-4');
      } else {
        toggleMotion.classList.remove('bg-sky-500');
        toggleMotion.classList.add('bg-neutral-600');
        toggleMotion.firstElementChild.classList.remove('translate-x-4');
      }
    }
  }

  render() {
    this.innerHTML = `
      <!-- Overlay -->
      <div id="settings-overlay" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] opacity-0 pointer-events-none transition-opacity duration-300"></div>
      
      <!-- Drawer -->
      <div id="settings-drawer" class="fixed top-0 right-0 h-full w-full max-w-sm bg-neutral-900/90 backdrop-blur-xl border-l border-neutral-800 shadow-2xl z-[9999] transform translate-x-full transition-transform duration-300 flex flex-col">
        
        <div class="flex items-center justify-between p-6 border-b border-neutral-800/50">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <h2 class="text-lg font-medium text-white tracking-wide">Configurações</h2>
          </div>
          <button id="close-settings" class="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          <!-- Tema -->
          <div class="space-y-3">
            <label class="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">Tema Visual</label>
            <div class="grid grid-cols-2 gap-3">
              <button data-setting="theme" data-value="dark" class="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                <span class="text-sm font-medium">Clássico (Dark)</span>
              </button>
              <button data-setting="theme" data-value="light" class="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                <span class="text-sm font-medium">Clínico (Light)</span>
              </button>
            </div>
          </div>

          <!-- Tipografia -->
          <div class="space-y-3">
            <label class="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">Tamanho da Fonte</label>
            <div class="flex p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button data-setting="typography" data-value="small" class="flex-1 py-2 text-sm rounded-lg cursor-pointer transition-colors">A-</button>
              <button data-setting="typography" data-value="medium" class="flex-1 py-2 text-sm rounded-lg cursor-pointer transition-colors">Padrão</button>
              <button data-setting="typography" data-value="large" class="flex-1 py-2 text-lg rounded-lg cursor-pointer transition-colors">A+</button>
            </div>
          </div>

          <!-- Densidade -->
          <div class="space-y-3">
            <label class="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">Densidade de Informação</label>
            <div class="grid grid-cols-2 gap-3">
              <button data-setting="density" data-value="comfortable" class="p-3 text-sm rounded-xl cursor-pointer transition-colors border border-transparent">Confortável</button>
              <button data-setting="density" data-value="compact" class="p-3 text-sm rounded-xl cursor-pointer transition-colors border border-transparent">Compacta</button>
            </div>
          </div>

          <!-- Acessibilidade -->
          <div class="space-y-4 pt-4 border-t border-neutral-800/50">
            <label class="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">Acessibilidade</label>
            
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Reduzir Movimento</p>
                <p class="text-xs text-neutral-500 mt-0.5">Desativa animações globais.</p>
              </div>
              <button id="btn-reduce-motion" class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none cursor-pointer bg-neutral-600">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1"></span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.updateUI();
  }

  attachEvents() {
    this.querySelector('#settings-overlay').addEventListener('click', () => this.togglePanel());
    this.querySelector('#close-settings').addEventListener('click', () => this.togglePanel());
    
    // Listen to standard buttons
    const btns = this.querySelectorAll('button[data-setting]');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = btn.getAttribute('data-setting');
        const val = btn.getAttribute('data-value');
        this.updateSetting(key, val);
      });
    });

    // Listen to accessibility toggle
    const motionToggle = this.querySelector('#btn-reduce-motion');
    if (motionToggle) {
      motionToggle.addEventListener('click', () => {
        this.updateSetting('reduceMotion', !this.settings.reduceMotion);
      });
    }

    // Escuta evento global disparado pelo botão do header
    window.addEventListener('open-settings-panel', () => {
      this.togglePanel();
    });
  }
}

// Registra o custom element
customElements.define('settings-panel', SettingsPanel);

// Utilitário global para abrir o painel em qualquer tela
window.App = window.App || {};
window.App.openSettings = function() {
  window.dispatchEvent(new Event('open-settings-panel'));
};
