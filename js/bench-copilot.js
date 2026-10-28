/**
 * Palas Atlas - Bench Copilot & Hardware Integration Engine
 * ==============================================================================
 * Módulos de Engenharia e Ergonomia de Bancada para Microscopia:
 * 1. WakeLockManager: Anti-bloqueio de tela contínuo com recuperação por visibilidade
 * 2. BenchAudioSynthesizer: Síntese de áudio autônoma via Web Audio API (Zero arquivos externos)
 * 3. CapturePersistence: Persistência anti-pânico contínua e recuperação via localStorage
 * 4. CommandGenerator: Gerador dinâmico de comandos PowerShell e macros Fiji (ImageJ)
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // ============================================================================
  // 1. WAKE LOCK MANAGER (Anti-Apagamento de Tela)
  // ============================================================================
  class WakeLockManager {
    constructor(options = {}) {
      this.sentinel = null;
      this.isActive = false;
      this.isSupported = ('wakeLock' in navigator && typeof navigator.wakeLock.request === 'function');
      this.autoRequest = options.autoRequest !== false;
      this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};
      this._userWantsActive = this.autoRequest;

      this._initVisibilityListener();

      if (this.autoRequest && this.isSupported) {
        // Tenta ativar na inicialização ou no primeiro gesto
        this.request().catch(() => {
          // Navegadores modernos podem requerer interação do usuário primeiro
          this._bindFirstGestureActivation();
        });
      }
    }

    _bindFirstGestureActivation() {
      const activateOnGesture = async () => {
        if (this._userWantsActive && !this.isActive) {
          await this.request();
        }
        window.removeEventListener('click', activateOnGesture);
        window.removeEventListener('keydown', activateOnGesture);
        window.removeEventListener('touchstart', activateOnGesture);
      };

      window.addEventListener('click', activateOnGesture, { once: true });
      window.addEventListener('keydown', activateOnGesture, { once: true });
      window.addEventListener('touchstart', activateOnGesture, { once: true });
    }

    _initVisibilityListener() {
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this._userWantsActive && !this.isActive) {
          try {
            await this.request();
          } catch (e) {
            console.warn('[WakeLock] Falha na auto-recuperação pós-visibilidade:', e);
          }
        }
      });
    }

    async request() {
      if (!this.isSupported) {
        this._notify('unsupported', 'A Screen Wake Lock API não é suportada neste navegador.');
        return false;
      }

      try {
        if (this.sentinel !== null) {
          await this.release();
        }

        this.sentinel = await navigator.wakeLock.request('screen');
        this.isActive = true;
        this._userWantsActive = true;

        this.sentinel.addEventListener('release', () => {
          // Só marca inativo se não for um ciclo planejado de re-solicitação
          this.isActive = false;
          this.sentinel = null;
          this._notify('inactive', 'Bloqueio de tela liberado.');
        });

        this._notify('active', 'Tela mantida sempre ativa com sucesso.');
        return true;
      } catch (err) {
        this.isActive = false;
        this.sentinel = null;
        this._notify('error', `Não foi possível manter a tela ativa: ${err.message || err}`);
        return false;
      }
    }

    async release() {
      this._userWantsActive = false;
      if (this.sentinel) {
        try {
          await this.sentinel.release();
        } catch (e) {}
        this.sentinel = null;
      }
      this.isActive = false;
      this._notify('inactive', 'Modo de tela ativa desativado.');
    }

    async toggle() {
      if (this.isActive) {
        await this.release();
        return false;
      } else {
        this._userWantsActive = true;
        return await this.request();
      }
    }

    _notify(status, message = '') {
      this.onStateChange({
        status, // 'active' | 'inactive' | 'unsupported' | 'error'
        isActive: this.isActive,
        isSupported: this.isSupported,
        message
      });
    }
  }


  // ============================================================================
  // 2. BENCH AUDIO SYNTHESIZER (Síntese Sonora Web Audio API)
  // ============================================================================
  class BenchAudioSynthesizer {
    constructor(options = {}) {
      this.ctx = null;
      this.isMuted = (localStorage.getItem('palas_bench_audio_muted') === 'true');
      this.volume = typeof options.volume === 'number' ? options.volume : 0.22;
      this.onMuteChange = typeof options.onMuteChange === 'function' ? options.onMuteChange : () => {};

      // Inicialização lazy ao primeiro gesto
      this._bindGestureUnlock();
    }

    _bindGestureUnlock() {
      const unlockAudio = () => {
        this._ensureContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
    }

    _ensureContext() {
      if (!this.ctx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      try {
        localStorage.setItem('palas_bench_audio_muted', this.isMuted ? 'true' : 'false');
      } catch (e) {}
      this.onMuteChange(this.isMuted);

      if (!this.isMuted) {
        this.playShot();
      }
      return this.isMuted;
    }

    setMuted(state) {
      this.isMuted = !!state;
      try {
        localStorage.setItem('palas_bench_audio_muted', this.isMuted ? 'true' : 'false');
      } catch (e) {}
      this.onMuteChange(this.isMuted);
    }

    /**
     * Bipe curto e nítido de disparo comum (880Hz -> 1100Hz)
     * Resposta acústica percussiva e agradável para confirmar o clique no microscópio.
     */
    playShot() {
      if (this.isMuted) return;
      const ctx = this._ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.07);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(this.volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.095);
    }

    /**
     * Bipe melódico de transição para "Fim de Coluna / Virar à Direita"
     * Acorde de duas notas ascendentes em quinta perfeita (D5 587Hz -> A5 880Hz).
     */
    playTurn() {
      if (this.isMuted) return;
      const ctx = this._ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Nota 1: D5 (587.33 Hz) com onda triangular para riqueza harmônica
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(this.volume * 1.1, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Nota 2: A5 (880.00 Hz) ascendente
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.09);
      gain2.gain.setValueAtTime(0.001, now + 0.09);
      gain2.gain.linearRampToValueAtTime(this.volume * 1.25, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.33);
    }

    /**
     * Fanfarra curta e triunfante de vitória para "Varredura Concluída!"
     * Arpejo de 4 notas ascendentes (C5 -> E5 -> G5 -> C6).
     */
    playVictory() {
      if (this.isMuted) return;
      const ctx = this._ensureContext();
      if (!ctx) return;

      const baseTime = ctx.currentTime;
      const arpeggio = [
        { freq: 523.25, offset: 0.00, dur: 0.13, type: 'triangle' }, // C5
        { freq: 659.25, offset: 0.11, dur: 0.13, type: 'triangle' }, // E5
        { freq: 783.99, offset: 0.22, dur: 0.16, type: 'sine' },     // G5
        { freq: 1046.50, offset: 0.35, dur: 0.65, type: 'sine' }    // C6
      ];

      arpeggio.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = baseTime + note.offset;

        osc.type = note.type;
        osc.frequency.setValueAtTime(note.freq, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(this.volume * 1.35, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + note.dur + 0.05);
      });
    }

    /**
     * Som de retorno / voltar passo (440Hz -> 280Hz)
     */
    playUndo() {
      if (this.isMuted) return;
      const ctx = this._ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.7, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    }
  }


  // ============================================================================
  // 3. CAPTURE PERSISTENCE (Persistência Anti-Pânico localStorage)
  // ============================================================================
  class CapturePersistence {
    constructor(storageKey = 'palas_atlas_captura_state_v2') {
      this.storageKey = storageKey;
    }

    save(state) {
      if (!state) return false;
      try {
        const payload = {
          version: 2,
          currentStep: state.currentStep || 0,
          cols: state.cols || 3,
          rows: state.rows || 4,
          sampleName: state.sampleName || 'amostra_1',
          objective: state.objective || '10x',
          overlap: state.overlap || 15,
          mode: state.mode || 'snake_columns',
          history: Array.isArray(state.history) ? state.history : [],
          startTime: state.startTime || Date.now(),
          lastUpdated: Date.now()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
        return true;
      } catch (err) {
        console.warn('[Persistence] Falha ao persistir estado da captura:', err);
        return false;
      }
    }

    load() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        return parsed;
      } catch (err) {
        console.warn('[Persistence] Estado corrompido no localStorage, descartando:', err);
        this.clear();
        return null;
      }
    }

    clear() {
      try {
        localStorage.removeItem(this.storageKey);
        return true;
      } catch (e) {
        return false;
      }
    }

    hasIncompleteSession() {
      const data = this.load();
      if (!data) return false;
      const total = (data.cols || 3) * (data.rows || 4);
      // Incompleta se começou (step > 0) e não passou do total final
      return (typeof data.currentStep === 'number' && data.currentStep > 0 && data.currentStep < total);
    }

    formatTimeAgo(timestamp) {
      if (!timestamp) return 'recentemente';
      const diffSec = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSec < 60) return `há ${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `há ${diffHrs}h`;
      return `há ${Math.floor(diffHrs / 24)} dias`;
    }
  }


  // ============================================================================
  // 4. COMMAND GENERATOR (PowerShell & Fiji ImageJ Automation)
  // ============================================================================
  class CommandGenerator {
    static sanitizeName(name) {
      if (!name || typeof name !== 'string' || !name.trim()) return 'amostra_1';
      return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }

    static generatePowerShell(config) {
      const sample = this.sanitizeName(config.sampleName);
      const pattern = `${sample}_x.jpg`;
      return `.\\tools\\fiji\\rename_images.ps1 -Dir "C:\\fotos\\${sample}" -Pattern "${pattern}"`;
    }

    static generatePowerShellOneLiner(config) {
      const sample = this.sanitizeName(config.sampleName);
      const pattern = `${sample}_x.jpg`;
      return `powershell -ExecutionPolicy Bypass -File .\\tools\\fiji\\rename_images.ps1 -Dir "C:\\fotos\\${sample}" -Pattern "${pattern}"`;
    }

    static generateFijiParameters(config) {
      const sample = this.sanitizeName(config.sampleName);
      const cols = parseInt(config.cols) || 3;
      const rows = parseInt(config.rows) || 4;
      const overlap = parseInt(config.overlap) || 15;
      const filePattern = `${sample}_{i}.jpg`;
      const directory = `C:/fotos/${sample}/`;

      return {
        sample,
        directory,
        filePattern,
        gridX: cols,
        gridY: rows,
        overlap,
        totalPhotos: cols * rows,
        stitchingType: 'Grid: snake by columns',
        order: 'Down & Right'
      };
    }

    static generateFijiMacroSnippet(config) {
      const p = this.generateFijiParameters(config);

      return `// ==============================================================================
// Palas Atlas - Macro de Costura (Stitching) no Fiji (ImageJ)
// Amostra: ${p.sample} (${config.objective || '10x'}) | Grade: ${p.gridX} colunas x ${p.gridY} linhas (${p.totalPhotos} fotos)
// ==============================================================================

dirStr = "${p.directory}";
filePattern = "${p.filePattern}";
gridX = ${p.gridX};
gridY = ${p.gridY};
overlap = ${p.overlap};

print("\\\\Clear");
print("🔬 Palas Atlas - Iniciando Costura da Amostra: ${p.sample}");

stitchParams = "type=[Grid: snake by columns] " +
               "order=[Down & Right] " +
               "grid_size_x=" + gridX + " " +
               "grid_size_y=" + gridY + " " +
               "tile_overlap=" + overlap + " " +
               "first_file_index_i=1 " +
               "directory=[" + dirStr + "] " +
               "file_names=" + filePattern + " " +
               "output_textfile_name=TileConfiguration.txt " +
               "fusion_method=[Linear Blending] " +
               "regression_threshold=0.30 " +
               "max/avg_displacement_threshold=2.50 " +
               "absolute_displacement_threshold=3.50 " +
               "compute_overlap " +
               "subpixel_accuracy " +
               "computation_parameters=[Save computation time (but use more RAM)] " +
               "image_output=[Fuse and display]";

run("Grid/Collection stitching", stitchParams);
rename("Palas_${p.sample}_Costurada");

// Salva em TIF 
outTif = dirStr + "lamina_${p.sample}_costurada.tif";
print("Salvando TIF final em: " + outTif);
saveAs("Tiff", outTif);
print("✅ Lâmina costurada com sucesso! Pronto para converter para DZI.");`;
    }

    static async copyWithFeedback(text, buttonEl, defaultLabel = 'Copiar') {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (e) {}
      }

      if (!copied) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          copied = document.execCommand('copy');
        } catch (e) {}
        document.body.removeChild(textarea);
      }

      if (buttonEl) {
        const origContent = buttonEl.innerHTML;
        buttonEl.innerHTML = `<span class="flex items-center gap-1.5 text-emerald-300 font-bold"><span>✅</span> Copiado!</span>`;
        buttonEl.classList.add('border-emerald-500', 'bg-emerald-950/60');
        buttonEl.classList.remove('border-slate-700', 'bg-slate-800');

        setTimeout(() => {
          buttonEl.innerHTML = origContent;
          buttonEl.classList.remove('border-emerald-500', 'bg-emerald-950/60');
          buttonEl.classList.add('border-slate-700', 'bg-slate-800');
        }, 2200);
      }

      return copied;
    }
  }


  // Exporta para escopo global ou módulos
  global.PalasBench = {
    WakeLockManager,
    BenchAudioSynthesizer,
    CapturePersistence,
    CommandGenerator
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
