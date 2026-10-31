/**
 * ============================================================================
 * PALAS ATLAS — MICROSCOPE CAMERA & ONION SKIN (GHOSTING) ENGINE
 * Módulo WebRTC de Alta Resolução e Alinhamento Óptico com Margem de Overlap
 * ============================================================================
 * Desenvolvido para microscopia óptica de alta precisão (Palas Atlas / Fiji Stitching).
 * Suporta câmeras USB microscópicas (UVC), simulador óptico H&E em tempo real,
 * congelamento de inspeção, espelhamento óptico (prismas), retículo micrométrico
 * e recorte de 15% em canvas offscreen dedicado (Onion Skin).
 *
 * NOTA ARQUITETURAL:
 * Todo o feedback sonoro é centralizado no BenchAudioSynthesizer (bench-copilot.js).
 */

class MicroscopeCameraManager {
  constructor(options = {}) {
    // Elementos DOM
    this.videoElement = options.videoElement || document.getElementById('videoFeed');
    this.overlayCanvas = options.overlayCanvas || document.getElementById('overlayCanvas');
    this.container = options.container || document.getElementById('cameraContainer');
    this.deviceSelect = options.deviceSelect || document.getElementById('cameraSelect');
    this.statusBadge = options.statusBadge || document.getElementById('cameraStatusBadge');

    // Callbacks de evento
    this.onStatusChange = options.onStatusChange || null;
    this.onError = options.onError || null;
    this.onFrameCaptured = options.onFrameCaptured || null;

    // Estado da Câmera
    this.stream = null;
    this.devices = [];
    this.selectedDeviceId = null;
    this.isActive = false;
    this.isFrozen = false;
    this._stoppingIntentionally = false;

    // Simulador de Stream Virtual (para bancada sem hardware / testes DevTools)
    this._simCanvas = null;
    this._simAnimId = null;
    this._simStepHint = { col: 0, row: 0, stepNum: 1 };

    // Configurações Ópticas e Visuais
    this.isFlippedH = false;
    this.isFlippedV = false;
    this.overlapPct = options.defaultOverlap || 0.15; // 15% padrão Fiji
    this.ghostOpacity = options.defaultOpacity || 0.45; // 45% transparência
    this.ghostBlendMode = 'normal'; // 'normal', 'cyan', 'difference'
    this.showReticle = true;

    // Histórico de Captura e Fantasma com limite de cache em RAM
    this.maxCachedCanvases = options.maxCachedCanvases || 8;
    this.lastCapturedFrame = null; // HTMLCanvasElement do último frame capturado
    this.capturedFrames = new Map(); // stepIndex -> { canvas, jpegUrl, thumbUrl, timestamp, direction, stepNumber }
    this.currentDirection = 'START'; // 'START', 'DOWN', 'UP', 'RIGHT', 'LEFT', 'FINISH', 'DONE'
    this.previousStepNumber = null;

    // Canvas Offscreen dedicado exclusivamente à fatia de 15% do Onion Skin
    this.offscreenStripCanvas = document.createElement('canvas');
    this.offscreenStripCtx = this.offscreenStripCanvas.getContext('2d');
    this.lastSliceMetrics = null;

    // Canvas Offscreen reutilizável para geração de miniaturas da galeria
    this._thumbCanvas = document.createElement('canvas');
    this._thumbCanvas.width = 320;
    this._thumbCanvas.height = 180;
    this._thumbCtx = this._thumbCanvas.getContext('2d');

    this._boundResize = () => {
      if (this.isActive) this.syncCanvasResolution();
    };
  }

  /**
   * Verifica se o navegador suporta WebRTC e se está em contexto seguro (HTTPS ou localhost)
   */
  checkEnvironment() {
    const isSecure = window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    return {
      isSecure,
      hasMediaDevices,
      isSupported: isSecure && hasMediaDevices,
      isLocalFile: window.location.protocol === 'file:'
    };
  }

  /**
   * Inicializa o gerenciador, detecta dispositivos e escuta alterações
   */
  async init() {
    const env = this.checkEnvironment();
    if (!env.hasMediaDevices) {
      this.notifyError({
        name: 'NotSupportedError',
        message: 'A API de mídia (WebRTC) não está disponível neste navegador.'
      });
      return false;
    }

    if (env.isLocalFile) {
      console.warn('[MicroscopeCamera] Arquivo aberto via file://. Acesso à câmera pode ser bloqueado pelo navegador.');
    }

    await this.enumerateDevices();

    if (navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = async () => {
        await this.enumerateDevices();
      };
    }

    window.removeEventListener('resize', this._boundResize);
    window.addEventListener('resize', this._boundResize, { passive: true });

    this.syncCanvasResolution();
    return true;
  }

  /**
   * Enumera as câmeras de vídeo conectadas e adiciona o Simulador Óptico H&E
   */
  async enumerateDevices() {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      this.devices = allDevices.filter(d => d.kind === 'videoinput');

      if (this.deviceSelect) {
        const previousSelection = this.selectedDeviceId || this.deviceSelect.value;
        this.deviceSelect.innerHTML = '';

        let preferredIndex = 0;
        this.devices.forEach((device, index) => {
          const opt = document.createElement('option');
          opt.value = device.deviceId || `hw-cam-${index}`;
          const label = device.label || `Câmera USB ${index + 1}`;
          opt.textContent = label;

          const lower = label.toLowerCase();
          if (lower.includes('usb') || lower.includes('microscope') || lower.includes('uvc') || lower.includes('camera 2')) {
            preferredIndex = index;
          }

          this.deviceSelect.appendChild(opt);
        });

        // Opção de Simulador Óptico H&E 1080p para validação e treino sem hardware
        const simOpt = document.createElement('option');
        simOpt.value = 'virtual-he-1080p';
        simOpt.textContent = '🧪 Simulador Óptico H&E (1920×1080 @ 30fps)';
        this.deviceSelect.appendChild(simOpt);

        if (previousSelection && Array.from(this.deviceSelect.options).some(o => o.value === previousSelection)) {
          this.selectedDeviceId = previousSelection;
          this.deviceSelect.value = previousSelection;
        } else if (this.devices.length > 0 && this.devices[preferredIndex].deviceId) {
          this.selectedDeviceId = this.devices[preferredIndex].deviceId;
          this.deviceSelect.value = this.selectedDeviceId;
        } else if (this.devices.length === 0) {
          this.selectedDeviceId = 'virtual-he-1080p';
          this.deviceSelect.value = 'virtual-he-1080p';
        }
      }
    } catch (err) {
      console.warn('[MicroscopeCamera] Erro ao listar dispositivos:', err);
    }
  }

  /**
   * Inicia um stream sintético contínuo em 1920x1080 para testes de bancada / DevTools
   */
  _startVirtualStream() {
    this._stopVirtualStream();
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    this._simCanvas = canvas;

    // Desenha um frame estático de alta definição e atualiza suavemente a 15fps para baixo uso de CPU
    let tick = 0;
    const baseFrame = this.generateSyntheticMicroscopyFrame(this._simStepHint.stepNum || 1);

    const renderTick = () => {
      if (!this._simCanvas) return;
      tick++;
      ctx.drawImage(baseFrame, 0, 0);
      // Indicador discreto de stream ativo
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(60, 48, 620, 54);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 48, 620, 54);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(`STREAM ÓPTICO H&E 1080p • CAMPO #${this._simStepHint.stepNum || 1}`, 80, 82);

      this._simAnimId = requestAnimationFrame(renderTick);
    };
    renderTick();

    return canvas.captureStream(30);
  }

  _stopVirtualStream() {
    if (this._simAnimId) {
      cancelAnimationFrame(this._simAnimId);
      this._simAnimId = null;
    }
    this._simCanvas = null;
  }

  /**
   * Atualiza dica de posição para que o simulador óptico acompanhe o campo atual
   */
  setSimulationStepHint({ col = 0, row = 0, stepNum = 1 } = {}) {
    this._simStepHint = { col, row, stepNum };
  }

  /**
   * Inicia o fluxo de vídeo WebRTC com negociação ideal Full HD (1920x1080)
   */
  async startCamera(deviceId = null) {
    if (deviceId !== null && deviceId !== undefined) {
      this.selectedDeviceId = deviceId;
    } else if (this.deviceSelect && this.deviceSelect.value) {
      this.selectedDeviceId = this.deviceSelect.value;
    }

    this.stopCamera();
    this._stoppingIntentionally = false;
    this.updateStatus('connecting', 'Conectando câmera...');

    try {
      if (this.selectedDeviceId === 'virtual-he-1080p') {
        this.stream = this._startVirtualStream();
      } else {
        const videoConstraints = {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        };

        if (this.selectedDeviceId && !this.selectedDeviceId.startsWith('hw-cam-')) {
          videoConstraints.deviceId = { exact: this.selectedDeviceId };
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      }

      return await this._attachStream(this.stream);
    } catch (err) {
      console.error('[MicroscopeCamera] Falha ao iniciar câmera:', err);
      this.handleCameraError(err);
      return false;
    }
  }

  async _attachStream(stream) {
    this.videoElement.srcObject = stream;
    try {
      await this.videoElement.play();
    } catch (e) {}

    this.isActive = true;
    this.isFrozen = false;

    if (this.videoElement.readyState < 1) {
      await new Promise((resolve) => {
        const onLoaded = () => {
          this.videoElement.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        this.videoElement.addEventListener('loadedmetadata', onLoaded, { once: true });
        setTimeout(resolve, 800);
      });
    }

    this.syncCanvasResolution();

    const track = stream.getVideoTracks()[0];
    const settings = (track && typeof track.getSettings === 'function') ? track.getSettings() : {};
    const width = settings.width || this.videoElement.videoWidth || 1920;
    const height = settings.height || this.videoElement.videoHeight || 1080;
    const fps = Math.round(settings.frameRate || 30);

    // Monitoramento de desconexão abrupta do cabo USB / encerramento da trilha
    if (track) {
      const handleTrackEnded = () => {
        if (this._stoppingIntentionally || !this.isActive) return;
        console.warn('[MicroscopeCamera] Stream de vídeo encerrado inesperadamente (cabo USB desconectado).');
        this._cleanupActiveStream();
        this.updateStatus('error', 'Câmera Desconectada');
        this.notifyError({
          name: 'StreamDisconnectedError',
          message: 'A conexão com a câmera USB foi interrompida. Verifique o cabo USB e reconecte.'
        });
      };
      track.addEventListener('ended', handleTrackEnded, { once: true });
      track.onended = handleTrackEnded;
    }

    const modeTag = this.selectedDeviceId === 'virtual-he-1080p' ? 'Simulador' : 'Ao Vivo';
    this.updateStatus('active', `${modeTag}: ${width}×${height} @ ${fps}fps`);

    await this.enumerateDevices();
    if (this.deviceSelect) {
      if (this.selectedDeviceId === 'virtual-he-1080p') {
        this.deviceSelect.value = 'virtual-he-1080p';
      } else if (settings.deviceId) {
        this.selectedDeviceId = settings.deviceId;
        this.deviceSelect.value = settings.deviceId;
      }
    }

    this.renderOverlay();
    return true;
  }

  /**
   * Tratamento amigável e técnico dos erros do getUserMedia
   */
  handleCameraError(err) {
    if (err.name === 'OverconstrainedError') {
      this.fallbackCamera();
      return;
    }

    this._cleanupActiveStream();
    let userMsg = '';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      userMsg = 'Permissão negada. Permita o uso da câmera na barra de endereços do navegador.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      userMsg = 'Câmera USB não encontrada. Verifique a conexão USB ou selecione o Simulador Óptico H&E.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      userMsg = 'Câmera ocupada por outro software (AmScope, ToupView, OBS). Feche-o e tente novamente.';
    } else {
      userMsg = `Erro na câmera (${err.name}): ${err.message || 'Falha de comunicação de hardware.'}`;
    }

    this.updateStatus('error', 'Câmera Desconectada / Erro');
    this.notifyError({ name: err.name, message: userMsg, raw: err });
  }

  /**
   * Fallback com restrições mínimas em caso de erro de resolução
   */
  async fallbackCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      await this._attachStream(this.stream);
    } catch (err) {
      this._cleanupActiveStream();
      this.updateStatus('error', 'Câmera Desconectada / Erro');
      this.notifyError({ name: err.name, message: err.message || 'Falha no modo de compatibilidade.', raw: err });
    }
  }

  _cleanupActiveStream() {
    this._stopVirtualStream();
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.onended = null;
        try { track.stop(); } catch (e) {}
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.isActive = false;
    this.isFrozen = false;
  }

  /**
   * Encerra o fluxo de vídeo da câmera
   */
  stopCamera() {
    this._stoppingIntentionally = true;
    this._cleanupActiveStream();
    this.updateStatus('stopped', 'Câmera Pausada');
    this.renderOverlay();
  }

  /**
   * Alterna entre Iniciar e Pausar Câmera
   */
  async toggleCamera() {
    if (this.isActive) {
      this.stopCamera();
      return false;
    } else {
      return await this.startCamera();
    }
  }

  /**
   * Congela ou descongela o feed ao vivo para inspeção fina do microscopista
   */
  toggleFreeze() {
    if (!this.isActive) return false;

    if (!this.isFrozen) {
      this.videoElement.pause();
      this.isFrozen = true;
      this.updateStatus('frozen', 'Imagem Congelada (Inspeção)');
    } else {
      this.videoElement.play().catch(() => {});
      this.isFrozen = false;
      this.updateStatus('active', 'Ao Vivo');
    }

    this.renderOverlay();
    return this.isFrozen;
  }

  /**
   * Espelhamento Horizontal (Flip H) para compensar reflexão de espelhos/prismas
   */
  toggleFlipH() {
    this.isFlippedH = !this.isFlippedH;
    this.applyTransform();
    return this.isFlippedH;
  }

  /**
   * Espelhamento Vertical (Flip V) para compensar inversão de lentes
   */
  toggleFlipV() {
    this.isFlippedV = !this.isFlippedV;
    this.applyTransform();
    return this.isFlippedV;
  }

  applyTransform() {
    const scaleX = this.isFlippedH ? -1 : 1;
    const scaleY = this.isFlippedV ? -1 : 1;
    this.videoElement.style.transform = `scale(${scaleX}, ${scaleY})`;
    this.renderOverlay();
  }

  /**
   * Sincroniza a resolução interna do canvas com a resolução nativa do sensor
   */
  syncCanvasResolution() {
    if (!this.overlayCanvas || !this.videoElement) return;

    const w = this.videoElement.videoWidth || 1920;
    const h = this.videoElement.videoHeight || 1080;

    if (this.overlayCanvas.width !== w || this.overlayCanvas.height !== h) {
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;
    }

    if (this.container && w > 0 && h > 0) {
      this.container.style.aspectRatio = `${w} / ${h}`;
    }

    this.renderOverlay();
  }

  /**
   * Define o percentual de sobreposição (overlap) e recalcula a fatia offscreen
   */
  setOverlap(percent) {
    this.overlapPct = Math.max(0.05, Math.min(0.40, percent));
    this._updateOffscreenGhostStrip();
    this.renderOverlay();
  }

  /**
   * Define a opacidade do ghosting (0.0 a 1.0)
   */
  setGhostOpacity(val) {
    this.ghostOpacity = Math.max(0, Math.min(1, val));
    this.renderOverlay();
  }

  /**
   * Define o modo de mesclagem visual do fantasma
   */
  setBlendMode(mode) {
    this.ghostBlendMode = mode; // 'normal', 'cyan', 'difference'
    this.renderOverlay();
  }

  /**
   * Ativa ou desativa a mira reticular micrométrica
   */
  setShowReticle(visible) {
    this.showReticle = !!visible;
    this.renderOverlay();
  }

  /**
   * Flash visual discreto na tela para indicar disparo de foto
   */
  triggerVisualFlash() {
    if (!this.container) return;
    const flashDiv = document.createElement('div');
    flashDiv.className = 'absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 z-50';
    flashDiv.style.opacity = '0.55';
    this.container.appendChild(flashDiv);
    requestAnimationFrame(() => {
      flashDiv.style.opacity = '0';
      setTimeout(() => flashDiv.remove(), 180);
    });
  }

  /**
   * Recorta apenas a faixa de 15% relevante do último frame para o canvas offscreen dedicado
   */
  _updateOffscreenGhostStrip() {
    const src = this.lastCapturedFrame;
    const dir = this.currentDirection;
    if (!src || !dir || dir === 'START' || dir === 'FINISH' || dir === 'DONE') {
      this.lastSliceMetrics = null;
      return;
    }

    const P = this.overlapPct;
    const srcW = src.width || 1920;
    const srcH = src.height || 1080;

    let sx = 0, sy = 0, sw = srcW, sh = srcH;

    if (dir === 'DOWN') {
      // Charriot desceu: a borda INFERIOR (15%) da foto anterior sobrepõe o TOPO (15%) do campo atual
      sx = 0;
      sy = Math.round(srcH * (1 - P));
      sw = srcW;
      sh = Math.max(1, srcH - sy);
    } else if (dir === 'UP') {
      // Charriot subiu: a borda SUPERIOR (15%) da foto anterior sobrepõe a BASE (15%) do campo atual
      sx = 0;
      sy = 0;
      sw = srcW;
      sh = Math.max(1, Math.round(srcH * P));
    } else if (dir === 'RIGHT') {
      // Charriot moveu à direita: a borda DIREITA (15%) da foto anterior sobrepõe a ESQUERDA (15%) do campo atual
      sx = Math.round(srcW * (1 - P));
      sy = 0;
      sw = Math.max(1, srcW - sx);
      sh = srcH;
    } else if (dir === 'LEFT') {
      sx = 0;
      sy = 0;
      sw = Math.max(1, Math.round(srcW * P));
      sh = srcH;
    } else {
      this.lastSliceMetrics = null;
      return;
    }

    this.offscreenStripCanvas.width = sw;
    this.offscreenStripCanvas.height = sh;
    this.offscreenStripCtx.clearRect(0, 0, sw, sh);
    this.offscreenStripCtx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);

    this.lastSliceMetrics = {
      direction: dir,
      overlapPct: P,
      sourceWidth: srcW,
      sourceHeight: srcH,
      sx,
      sy,
      sw,
      sh
    };
  }

  /**
   * Limita o número de elementos HTMLCanvasElement mantidos em memória RAM
   */
  _pruneCanvasCache() {
    if (this.capturedFrames.size <= this.maxCachedCanvases) return;
    const keys = Array.from(this.capturedFrames.keys()).sort((a, b) => a - b);
    const excess = keys.length - this.maxCachedCanvases;
    for (let i = 0; i < excess; i++) {
      const entry = this.capturedFrames.get(keys[i]);
      if (entry && entry.canvas && entry.canvas !== this.lastCapturedFrame) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.canvas = null;
      }
    }
  }

  /**
   * CAPTURA DE FOTO E ARMAZENAMENTO PARA O ONION SKIN
   * @param {number} stepIndex - Índice do passo recém-capturado (0, 1, 2...)
   * @param {string} nextDirection - Movimento para o próximo campo ('DOWN', 'UP', 'RIGHT', 'LEFT', 'FINISH')
   * @param {number} stepNumber - Número legível da foto (1, 2, 3...)
   */
  captureFrame(stepIndex, nextDirection = 'DOWN', stepNumber = 1) {
    let sourceCanvas = null;

    if (this.isActive && this.videoElement && this.videoElement.videoWidth > 0) {
      const w = this.videoElement.videoWidth;
      const h = this.videoElement.videoHeight;

      const snap = document.createElement('canvas');
      snap.width = w;
      snap.height = h;
      const sCtx = snap.getContext('2d');

      sCtx.save();
      if (this.isFlippedH || this.isFlippedV) {
        sCtx.translate(this.isFlippedH ? w : 0, this.isFlippedV ? h : 0);
        sCtx.scale(this.isFlippedH ? -1 : 1, this.isFlippedV ? -1 : 1);
      }
      sCtx.drawImage(this.videoElement, 0, 0, w, h);
      sCtx.restore();

      sourceCanvas = snap;
    } else {
      sourceCanvas = this.generateSyntheticMicroscopyFrame(stepNumber);
    }

    // Gera miniatura leve e JPEG de exportação
    this._thumbCtx.clearRect(0, 0, 320, 180);
    this._thumbCtx.drawImage(sourceCanvas, 0, 0, 320, 180);
    const thumbUrl = this._thumbCanvas.toDataURL('image/jpeg', 0.7);
    const jpegUrl = sourceCanvas.toDataURL('image/jpeg', 0.92);

    this.lastCapturedFrame = sourceCanvas;
    this.currentDirection = nextDirection;
    this.previousStepNumber = stepNumber;

    this.capturedFrames.set(stepIndex, {
      canvas: sourceCanvas,
      jpegUrl,
      thumbUrl,
      stepNumber,
      direction: nextDirection,
      timestamp: new Date().toISOString()
    });

    this._pruneCanvasCache();
    this._updateOffscreenGhostStrip();
    this.triggerVisualFlash();
    this.renderOverlay();

    if (this.onFrameCaptured) {
      this.onFrameCaptured({
        stepIndex,
        stepNumber,
        nextDirection,
        canvas: sourceCanvas,
        thumbUrl,
        jpegUrl
      });
    }

    return sourceCanvas;
  }

  /**
   * Restaura o ghosting de um passo quando o usuário clica em "Voltar" ou navega pelo mapa.
   * @param {number} currentStepIndex - Índice do passo atual no visor (o fantasma vem de currentStepIndex - 1)
   * @param {string} entryDirection - Direção do movimento que levou de (currentStepIndex - 1) até (currentStepIndex)
   */
  restoreStep(currentStepIndex, entryDirection = 'DOWN') {
    if (currentStepIndex <= 0 || entryDirection === 'START') {
      this.lastCapturedFrame = null;
      this.previousStepNumber = null;
      this.currentDirection = 'START';
      this._updateOffscreenGhostStrip();
      this.renderOverlay();
      return;
    }

    const prevItem = this.capturedFrames.get(currentStepIndex - 1);
    this.currentDirection = entryDirection;

    if (prevItem) {
      this.previousStepNumber = prevItem.stepNumber;
      if (prevItem.canvas) {
        this.lastCapturedFrame = prevItem.canvas;
        this._updateOffscreenGhostStrip();
        this.renderOverlay();
      } else if (prevItem.jpegUrl) {
        const img = new Image();
        img.onload = () => {
          const restored = document.createElement('canvas');
          restored.width = img.naturalWidth || 1920;
          restored.height = img.naturalHeight || 1080;
          restored.getContext('2d').drawImage(img, 0, 0);
          prevItem.canvas = restored;
          this.lastCapturedFrame = restored;
          this._updateOffscreenGhostStrip();
          this.renderOverlay();
        };
        img.src = prevItem.jpegUrl;
      }
    } else {
      this.lastCapturedFrame = null;
      this.previousStepNumber = null;
      this._updateOffscreenGhostStrip();
      this.renderOverlay();
    }
  }

  /**
   * Limpa o fantasma atual do visor
   */
  clearGhost() {
    this.lastCapturedFrame = null;
    this.previousStepNumber = null;
    this.lastSliceMetrics = null;
    this.offscreenStripCanvas.width = 0;
    this.offscreenStripCanvas.height = 0;
    this.renderOverlay();
  }

  /**
   * Limpa todo o histórico de frames capturados e libera memória RAM
   */
  clearHistory() {
    this.capturedFrames.forEach((entry) => {
      if (entry && entry.canvas) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.canvas = null;
      }
    });
    this.capturedFrames.clear();
    this.currentDirection = 'START';
    this.clearGhost();
  }

  /**
   * Retorna telemetria e diagnóstico geométrico do Onion Skin para inspeção / DevTools
   */
  getGhostDiagnostics() {
    const W = this.overlayCanvas ? this.overlayCanvas.width : 1920;
    const H = this.overlayCanvas ? this.overlayCanvas.height : 1080;
    const P = this.overlapPct;
    const dir = this.currentDirection;

    let projection = null;
    if (dir === 'DOWN') {
      projection = { edge: 'TOP', dx: 0, dy: 0, dw: W, dh: Math.round(H * P) };
    } else if (dir === 'UP') {
      projection = { edge: 'BOTTOM', dx: 0, dy: Math.round(H * (1 - P)), dw: W, dh: Math.round(H * P) };
    } else if (dir === 'RIGHT') {
      projection = { edge: 'LEFT', dx: 0, dy: 0, dw: Math.round(W * P), dh: H };
    } else if (dir === 'LEFT') {
      projection = { edge: 'RIGHT', dx: Math.round(W * (1 - P)), dy: 0, dw: Math.round(W * P), dh: H };
    }

    return {
      hasGhostFrame: !!this.lastCapturedFrame,
      previousStepNumber: this.previousStepNumber,
      currentDirection: dir,
      overlapPct: P,
      ghostOpacity: this.ghostOpacity,
      offscreenStripSize: {
        width: this.offscreenStripCanvas.width,
        height: this.offscreenStripCanvas.height
      },
      sourceSlice: this.lastSliceMetrics,
      targetProjection: projection,
      cachedFramesCount: this.capturedFrames.size
    };
  }

  /**
   * RENDERIZADOR PRINCIPAL DO OVERLAY (Ghosting Offscreen 15% + Mira Reticular)
   */
  renderOverlay() {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    ctx.clearRect(0, 0, w, h);
    if (w === 0 || h === 0) return;

    const isDone = (this.currentDirection === 'DONE' || this.currentDirection === 'FINISH');

    if (this.lastCapturedFrame && this.ghostOpacity > 0 && !isDone && this.currentDirection !== 'START') {
      this.drawGhostingSlice(ctx, w, h);
    }

    if (this.showReticle) {
      this.drawMicroscopyReticle(ctx, w, h);
    }

    if (isDone) {
      this.drawDoneBanner(ctx, w, h);
    }
  }

  /**
   * Projeta a fatia de 15% pré-recortada no offscreenStripCanvas sobre a borda correspondente
   */
  drawGhostingSlice(ctx, W, H) {
    if (!this.lastSliceMetrics || this.offscreenStripCanvas.width === 0) {
      this._updateOffscreenGhostStrip();
    }
    if (!this.lastSliceMetrics || this.offscreenStripCanvas.width === 0) return;

    const P = this.overlapPct;
    let dx = 0, dy = 0, dw = W, dh = H;
    let lineStart = { x: 0, y: 0 };
    let lineEnd = { x: 0, y: 0 };
    let badgeText = '';
    let badgePos = { x: 0, y: 0 };

    if (this.currentDirection === 'DOWN') {
      dx = 0;
      dy = 0;
      dw = W;
      dh = Math.round(H * P);

      lineStart = { x: 0, y: dh };
      lineEnd = { x: W, y: dh };
      badgeText = `▲ FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (TOPO)`;
      badgePos = { x: W / 2, y: dh / 2 };

    } else if (this.currentDirection === 'UP') {
      dh = Math.round(H * P);
      dx = 0;
      dy = H - dh;
      dw = W;

      lineStart = { x: 0, y: dy };
      lineEnd = { x: W, y: dy };
      badgeText = `▼ FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (BASE)`;
      badgePos = { x: W / 2, y: dy + dh / 2 };

    } else if (this.currentDirection === 'RIGHT') {
      dx = 0;
      dy = 0;
      dw = Math.round(W * P);
      dh = H;

      lineStart = { x: dw, y: 0 };
      lineEnd = { x: dw, y: H };
      badgeText = `◄ FOTO #${this.previousStepNumber || ''} (${Math.round(P * 100)}% ESQ)`;
      badgePos = { x: dw / 2, y: H / 2 };

    } else if (this.currentDirection === 'LEFT') {
      dw = Math.round(W * P);
      dx = W - dw;
      dy = 0;
      dh = H;

      lineStart = { x: dx, y: 0 };
      lineEnd = { x: dx, y: H };
      badgeText = `FOTO #${this.previousStepNumber || ''} (${Math.round(P * 100)}% DIR) ►`;
      badgePos = { x: dx + dw / 2, y: H / 2 };
    } else {
      return;
    }

    ctx.save();
    ctx.globalAlpha = this.ghostOpacity;

    if (this.ghostBlendMode === 'cyan') {
      ctx.drawImage(this.offscreenStripCanvas, 0, 0, this.offscreenStripCanvas.width, this.offscreenStripCanvas.height, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.fillRect(dx, dy, dw, dh);
    } else if (this.ghostBlendMode === 'difference') {
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(this.offscreenStripCanvas, 0, 0, this.offscreenStripCanvas.width, this.offscreenStripCanvas.height, dx, dy, dw, dh);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.offscreenStripCanvas, 0, 0, this.offscreenStripCanvas.width, this.offscreenStripCanvas.height, dx, dy, dw, dh);
    }
    ctx.restore();

    // Linha divisória pontilhada de alinhamento óptico
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = Math.max(2, Math.round(W * 0.0016));
    ctx.strokeStyle = '#f59e0b';
    ctx.moveTo(lineStart.x, lineStart.y);
    ctx.lineTo(lineEnd.x, lineEnd.y);
    ctx.stroke();
    ctx.restore();

    this.drawOverlapBadge(ctx, badgeText, badgePos.x, badgePos.y, W, H);
  }

  /**
   * Desenha um badge de alto contraste identificando a faixa de overlap
   */
  drawOverlapBadge(ctx, text, x, y, W, H) {
    ctx.save();
    const fontSize = Math.max(11, Math.round(H * 0.02));
    ctx.font = `bold ${fontSize}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(text);
    const paddingX = 12;
    const paddingY = 6;
    const boxW = textMetrics.width + paddingX * 2;
    const boxH = fontSize + paddingY * 2;

    const clampedX = Math.max(boxW / 2 + 8, Math.min(W - boxW / 2 - 8, x));
    const clampedY = Math.max(boxH / 2 + 8, Math.min(H - boxH / 2 - 8, y));

    ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.lineWidth = 1.5;

    const rx = clampedX - boxW / 2;
    const ry = clampedY - boxH / 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, boxW, boxH, 6);
    } else {
      ctx.rect(rx, ry, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.fillText(text, clampedX, clampedY);
    ctx.restore();
  }

  /**
   * Desenha a mira central micrométrica de alta precisão
   */
  drawMicroscopyReticle(ctx, W, H) {
    ctx.save();
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.55)';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.04, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.15, 0, Math.PI * 2);
    ctx.stroke();

    const armLength = scale * 0.25;
    ctx.beginPath();
    ctx.moveTo(cx - armLength, cy);
    ctx.lineTo(cx + armLength, cy);
    ctx.moveTo(cx, cy - armLength);
    ctx.lineTo(cx, cy + armLength);
    ctx.stroke();

    const tickStep = scale * 0.025;
    const tickSize = 4;
    ctx.beginPath();
    for (let i = 1; i <= 8; i++) {
      const d = i * tickStep;
      ctx.moveTo(cx + d, cy - tickSize);
      ctx.lineTo(cx + d, cy + tickSize);
      ctx.moveTo(cx - d, cy - tickSize);
      ctx.lineTo(cx - d, cy + tickSize);
      ctx.moveTo(cx - tickSize, cy + d);
      ctx.lineTo(cx + tickSize, cy + d);
      ctx.moveTo(cx - tickSize, cy - d);
      ctx.lineTo(cx + tickSize, cy - d);
    }
    ctx.stroke();

    ctx.fillStyle = '#818cf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Banner ao término da lâmina no modo fixo
   */
  drawDoneBanner(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
    ctx.fillRect(0, 0, W, H);

    const fontSize = Math.max(18, Math.round(H * 0.045));
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#34d399';
    ctx.fillText('🎉 Varredura Concluída!', W / 2, H / 2 - 18);

    ctx.font = `500 ${Math.round(fontSize * 0.58)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Todos os campos da grade foram registrados.', W / 2, H / 2 + 24);
    ctx.restore();
  }

  /**
   * Gera uma imagem sintética com aspecto histológico (H&E) determinístico por campo
   */
  generateSyntheticMicroscopyFrame(stepNumber) {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
    grad.addColorStop(0, '#fce7f3');
    grad.addColorStop(0.5, '#fbcfe8');
    grad.addColorStop(1, '#f472b6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    const rng = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    let seed = (stepNumber || 1) * 777;
    for (let i = 0; i < 85; i++) {
      const cx = rng(seed++) * 1920;
      const cy = rng(seed++) * 1080;
      const r = 8 + rng(seed++) * 16;
      ctx.fillStyle = rng(seed++) > 0.3 ? '#6b21a8' : '#4c1d95';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.3, r, rng(seed++) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.font = 'bold 34px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(`SIMULAÇÃO HISTOLÓGICA H&E — CAMPO #${stepNumber}`, 80, 120);

    return canvas;
  }

  /**
   * Notifica alteração de status para a UI
   */
  updateStatus(state, message) {
    if (this.statusBadge) {
      let base = 'text-xs px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 transition-all ';
      if (state === 'active') {
        this.statusBadge.className = base + 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> <span>${message}</span>`;
      } else if (state === 'connecting') {
        this.statusBadge.className = base + 'bg-amber-950/80 text-amber-300 border border-amber-500/50';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> <span>${message}</span>`;
      } else if (state === 'frozen') {
        this.statusBadge.className = base + 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50';
        this.statusBadge.innerHTML = `<span>❄️</span> <span>${message}</span>`;
      } else if (state === 'error') {
        this.statusBadge.className = base + 'bg-rose-950/80 text-rose-300 border border-rose-500/50';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> <span>${message}</span>`;
      } else {
        this.statusBadge.className = base + 'bg-slate-900 text-slate-400 border border-slate-700';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> <span>${message}</span>`;
      }
    }

    if (this.onStatusChange) {
      this.onStatusChange({ state, message });
    }
  }

  /**
   * Notifica erro para a UI
   */
  notifyError(errObj) {
    if (this.onError) {
      this.onError(errObj);
    } else {
      console.warn('[MicroscopeCamera]', errObj.message);
    }
  }

  /**
   * Baixa a última foto capturada em JPEG no computador
   */
  downloadSnapshot(filename = 'captura_microscopio.jpg') {
    if (!this.lastCapturedFrame) return false;
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.lastCapturedFrame.toDataURL('image/jpeg', 0.95);
    link.click();
    return true;
  }
}

if (typeof window !== 'undefined') {
  window.MicroscopeCameraManager = MicroscopeCameraManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MicroscopeCameraManager };
}
