/**
 * Palas Atlas - Bench Copilot & Hardware Integration Engine
 * ==============================================================================
 * Módulos de Engenharia e Ergonomia de Bancada para Microscopia:
 * 1. WakeLockManager: Anti-bloqueio de tela contínuo com recuperação por visibilidade e gesto
 * 2. BenchAudioSynthesizer: Síntese de áudio centralizada via Web Audio API (Zero arquivos externos)
 * 3. CapturePersistence: Persistência anti-pânico contínua e recuperação via localStorage
 * 4. CommandGenerator: Gerador unificado de comandos PowerShell, Node e macros Fiji (ImageJ)
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
      this._gestureBound = false;

      this._initVisibilityListener();

      if (this.autoRequest && this.isSupported) {
        // request() retorna Promise<boolean>; se bloqueado sem gesto inicial, agenda ativação no 1º gesto
        this.request({ silentOnGestureBlock: true }).then((ok) => {
          if (!ok) {
            this._bindFirstGestureActivation();
          }
        });
      } else if (!this.isSupported) {
        this._notify('unsupported', 'A Screen Wake Lock API não é suportada neste navegador.');
      }
    }

    _bindFirstGestureActivation() {
      if (this._gestureBound) return;
      this._gestureBound = true;

      const activateOnGesture = async () => {
        this._gestureBound = false;
        window.removeEventListener('click', activateOnGesture);
        window.removeEventListener('keydown', activateOnGesture);
        window.removeEventListener('touchstart', activateOnGesture);

        if (this._userWantsActive && !this.isActive) {
          await this.request();
        }
      };

      window.addEventListener('click', activateOnGesture, { once: true, passive: true });
      window.addEventListener('keydown', activateOnGesture, { once: true, passive: true });
      window.addEventListener('touchstart', activateOnGesture, { once: true, passive: true });
    }

    _initVisibilityListener() {
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this._userWantsActive && !this.isActive) {
          const ok = await this.request({ silentOnGestureBlock: true });
          if (!ok) {
            this._bindFirstGestureActivation();
          }
        }
      });
    }

    async request(opts = {}) {
      if (!this.isSupported) {
        this._notify('unsupported', 'A Screen Wake Lock API não é suportada neste navegador.');
        return false;
      }

      try {
        if (this.sentinel !== null) {
          try {
            await this.sentinel.release();
          } catch (e) {}
          this.sentinel = null;
        }

        const sentinel = await navigator.wakeLock.request('screen');
        this.sentinel = sentinel;
        this.isActive = true;
        this._userWantsActive = true;

        if (typeof sentinel.addEventListener === 'function') {
          sentinel.addEventListener('release', () => {
            if (this.sentinel === sentinel) {
              this.isActive = false;
              this.sentinel = null;
              this._notify('inactive', 'Bloqueio de tela liberado.');
            }
          });
        }

        this._notify('active', 'Tela mantida sempre ativa.');
        return true;
      } catch (err) {
        this.isActive = false;
        this.sentinel = null;
        if (opts.silentOnGestureBlock) {
          this._notify('pending', 'Aguardando interação para travar tela ativa.');
        } else {
          this._notify('error', `Não foi possível manter a tela ativa: ${err.message || err}`);
        }
        return false;
      }
    }

    async release() {
      this._userWantsActive = false;
      if (this.sentinel) {
        const current = this.sentinel;
        this.sentinel = null;
        try {
          await current.release();
        } catch (e) {}
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
        status, // 'active' | 'inactive' | 'pending' | 'unsupported' | 'error'
        isActive: this.isActive,
        isSupported: this.isSupported,
        message
      });
    }
  }


  // ============================================================================
  // 2. BENCH AUDIO SYNTHESIZER (Síntese Sonora Centralizada Web Audio API)
  // ============================================================================
  class BenchAudioSynthesizer {
    constructor(options = {}) {
      this.ctx = null;
      this.isMuted = false;
      try {
        this.isMuted = (localStorage.getItem('palas_bench_audio_muted') === 'true');
      } catch (e) {}
      this.volume = typeof options.volume === 'number' ? options.volume : 0.24;
      this.onMuteChange = typeof options.onMuteChange === 'function' ? options.onMuteChange : () => {};

      this._bindGestureUnlock();
    }

    _bindGestureUnlock() {
      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true, passive: true });
      window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
      window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    }

    /**
     * Garante que o AudioContext exista e esteja em estado 'running' antes de agendar osciladores,
     * respeitando a política de Autoplay do Chrome sem gerar avisos no console.
     */
    async _withRunningContext(callback) {
      if (this.isMuted) return false;
      try {
        if (!this.ctx) {
          const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtxClass) return false;
          this.ctx = new AudioCtxClass();
        }
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }
        if (this.ctx.state === 'running') {
          callback(this.ctx, this.ctx.currentTime);
          return true;
        }
      } catch (e) {
        // Silencia bloqueios de autoplay quando chamado fora de gesto de usuário
      }
      return false;
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
     * Disparo de captura (Obturador óptico + confirmação aguda limpa: 880Hz -> 1180Hz)
     */
    playShot() {
      return this._withRunningContext((ctx, now) => {
        // Camada 1: Transiente mecânico curto de obturador
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(720, now);
        clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

        clickGain.gain.setValueAtTime(this.volume * 0.8, now);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.05);

        // Camada 2: Bipe tonal de confirmação
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + 0.015);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.085);

        gain.gain.setValueAtTime(0.001, now + 0.015);
        gain.gain.linearRampToValueAtTime(this.volume, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.015);
        osc.stop(now + 0.11);
      });
    }

    /**
     * Alias semântico para compatibilidade com chamadas de obturador
     */
    playShutter() {
      return this.playShot();
    }

    /**
     * Bipe melódico de transição para "Fim de Coluna / Virar à Direita"
     * Acorde de duas notas ascendentes em quinta perfeita (D5 587Hz -> A5 880Hz).
     */
    playTurn() {
      return this._withRunningContext((ctx, now) => {
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
      });
    }

    /**
     * Fanfarra curta e triunfante para "Varredura Concluída!"
     * Arpejo de 4 notas ascendentes (C5 -> E5 -> G5 -> C6).
     */
    playVictory() {
      return this._withRunningContext((ctx, baseTime) => {
        const arpeggio = [
          { freq: 523.25, offset: 0.00, dur: 0.13, type: 'triangle' }, // C5
          { freq: 659.25, offset: 0.11, dur: 0.13, type: 'triangle' }, // E5
          { freq: 783.99, offset: 0.22, dur: 0.16, type: 'sine' },     // G5
          { freq: 1046.50, offset: 0.35, dur: 0.55, type: 'sine' }     // C6
        ];

        arpeggio.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = baseTime + note.offset;

          osc.type = note.type;
          osc.frequency.setValueAtTime(note.freq, noteStart);

          gain.gain.setValueAtTime(0.001, noteStart);
          gain.gain.linearRampToValueAtTime(this.volume * 1.3, noteStart + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteStart);
          osc.stop(noteStart + note.dur + 0.04);
        });
      });
    }

    /**
     * Som de retorno / voltar passo (440Hz -> 260Hz)
     */
    playUndo() {
      return this._withRunningContext((ctx, now) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(this.volume * 0.65, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);
      });
    }

    /**
     * Alerta grave duplo para desconexão de câmera USB ou falha de hardware
     */
    playAlert() {
      return this._withRunningContext((ctx, now) => {
        [0, 0.14].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + offset;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(idx === 0 ? 320 : 240, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(this.volume * 0.9, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.12);
        });
      });
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
          maxStepReached: state.maxStepReached || state.currentStep || 0,
          isFinished: !!state.isFinished,
          cols: state.cols || 3,
          rows: state.rows || 6,
          sampleName: state.sampleName || 'osso_maduro',
          objective: state.objective || '10x',
          overlap: state.overlap || 15,
          mode: state.mode || 'dynamic',
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
      if (data.isFinished) return false;
      if (typeof data.currentStep !== 'number' || data.currentStep <= 0) return false;

      if (data.mode === 'fixed') {
        const total = (data.cols || 3) * (data.rows || 6);
        return data.currentStep < total;
      }
      // No modo dinâmico, qualquer sessão iniciada (currentStep > 0) e não marcada como concluída é recuperável
      return true;
    }

    formatTimeAgo(timestamp) {
      if (!timestamp) return 'recentemente';
      const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
      if (diffSec < 60) return `há ${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `há ${diffHrs}h`;
      return `há ${Math.floor(diffHrs / 24)} dias`;
    }
  }


  // ============================================================================
  // 4. COMMAND GENERATOR (Unificação PowerShell, Node & Fiji ImageJ)
  // ============================================================================
  class CommandGenerator {
    static sanitizeName(name) {
      if (!name || typeof name !== 'string' || !name.trim()) return 'amostra_1';
      return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }

    static generatePowerShell(config = {}) {
      const sample = this.sanitizeName(config.sampleName || config.photoPrefix);
      const pattern = `${sample}_x.jpg`;
      return `.\\tools\\fiji\\rename_images.ps1 -Dir "C:\\fotos\\${sample}" -Pattern "${pattern}"`;
    }

    static generatePowerShellOneLiner(config = {}) {
      const sample = this.sanitizeName(config.sampleName || config.photoPrefix);
      const pattern = `${sample}_x.jpg`;
      return `powershell -ExecutionPolicy Bypass -File .\\tools\\fiji\\rename_images.ps1 -Dir "C:\\fotos\\${sample}" -Pattern "${pattern}"`;
    }

    static generateNodeRename(config = {}) {
      const sample = this.sanitizeName(config.sampleName || config.photoPrefix);
      const pattern = `${sample}_x.jpg`;
      return `node tools/fiji/rename_images.js --dir "C:\\fotos\\${sample}" --pattern "${pattern}"`;
    }

    /**
     * Gera script PowerShell para preencher arquivos faltantes (Dummy Fill)
     * quando uma varredura é interrompida antes de fechar a última coluna.
     */
    static generateDummyFillPowerShell(config = {}) {
      const sample = this.sanitizeName(config.sampleName || config.photoPrefix);
      const captured = Math.max(1, parseInt(config.totalPhotosCaptured, 10) || 1);
      const missing = Math.max(1, parseInt(config.missingInLastCol, 10) || 1);
      return `1..${missing} | ForEach-Object { Copy-Item "${sample}_${captured}.jpg" "${sample}_$(${captured} + $_).jpg" }`;
    }

    static generateFijiParameters(config = {}) {
      const sample = this.sanitizeName(config.sampleName || config.photoPrefix);
      const cols = Math.max(1, parseInt(config.cols || config.gridX, 10) || 1);
      const rows = Math.max(1, parseInt(config.rows || config.gridY, 10) || 6);
      const overlap = Math.max(5, Math.min(40, parseInt(config.overlap || config.overlapPercent, 10) || 15));
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

    static generateFijiMacroSnippet(config = {}) {
      const p = this.generateFijiParameters(config);
      const objective = config.objective || '10x';

      return `// ==============================================================================
// Palas Atlas - Macro de Costura (Stitching) no Fiji (ImageJ)
// Amostra: ${p.sample} (${objective}) | Grade: ${p.gridX} colunas x ${p.gridY} linhas (${p.totalPhotos} fotos)
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
print("✅ Lâmina costurada com sucesso! Pronta para converter para DZI.");`;
    }

    static async copyWithFeedback(text, buttonEl) {
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
        }, 2000);
      }

      return copied;
    }
  }


  // Exporta para escopo global ou módulos CommonJS
  const exported = {
    WakeLockManager,
    BenchAudioSynthesizer,
    CapturePersistence,
    CommandGenerator
  };

  global.PalasBench = exported;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
