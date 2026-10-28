/**
 * ============================================================================
 * PALAS ATLAS — MICROSCOPE CAMERA & ONION SKIN (GHOSTING) ENGINE
 * Módulo WebRTC de Alta Resolução e Alinhamento Óptico com Margem de Overlap
 * ============================================================================
 * Desenvolvido para microscopia óptica de alta precisão (Palas Atlas / Fiji Stitching).
 * Suporta câmeras USB microscópicas (UVC), webcams, congelamento de inspeção,
 * espelhamento óptico (prismas), retículo micrométrico e ghosting direcional de 15%.
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
    this.frozenFrameCanvas = null;

    // Configurações Ópticas e Visuais
    this.isFlippedH = false;
    this.isFlippedV = false;
    this.overlapPct = options.defaultOverlap || 0.15; // 15% padrão Fiji
    this.ghostOpacity = options.defaultOpacity || 0.45; // 45% transparência
    this.ghostBlendMode = 'normal'; // 'normal', 'cyan', 'difference'
    this.showReticle = true;

    // Histórico de Captura e Fantasma
    this.lastCapturedFrame = null; // HTMLCanvasElement com frame de alta resolução
    this.capturedFrames = new Map(); // stepIndex -> { canvas, timestamp, direction }
    this.currentDirection = 'DOWN'; // 'DOWN', 'UP', 'RIGHT', 'LEFT', 'DONE', null
    this.previousStepNumber = null;

    // Audio Context para som de obturador sintetizado (zero assets externos)
    this.audioCtx = null;

    // Inicialização de Canvas em memória
    this.captureCanvas = document.createElement('canvas');
    this.captureCtx = this.captureCanvas.getContext('2d');
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
      console.warn('[MicroscopeCamera] Atenção: Arquivo aberto via file://. Acesso à câmera pode ser bloqueado pelo Chrome.');
    }

    await this.enumerateDevices();

    // Ouvinte para quando o usuário plugar/desplugar a câmera USB do microscópio
    if (navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = async () => {
        console.log('[MicroscopeCamera] Dispositivo USB alterado ou conectado.');
        await this.enumerateDevices();
      };
    }

    // Configurar redimensionamento responsivo do overlay
    window.addEventListener('resize', () => {
      if (this.isActive) this.syncCanvasResolution();
    });

    return true;
  }

  /**
   * Enumera as câmeras de vídeo conectadas
   */
  async enumerateDevices() {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      this.devices = allDevices.filter(d => d.kind === 'videoinput');

      if (this.deviceSelect) {
        this.deviceSelect.innerHTML = '';
        
        if (this.devices.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'Nenhuma câmera detectada (conecte o USB)';
          this.deviceSelect.appendChild(opt);
          return;
        }

        // Tentar identificar câmera externa/microscópio prioritariamente
        let preferredIndex = 0;
        this.devices.forEach((device, index) => {
          const opt = document.createElement('option');
          opt.value = device.deviceId;
          const label = device.label || `Câmera ${index + 1} (${device.deviceId.slice(0, 8)}...)`;
          opt.textContent = label;

          // Se tiver "USB", "Microscope", "UVC", "Endoscope" ou "External", prioriza
          const lower = label.toLowerCase();
          if (lower.includes('usb') || lower.includes('microscope') || lower.includes('uvc') || lower.includes('camera 2')) {
            preferredIndex = index;
          }

          this.deviceSelect.appendChild(opt);
        });

        if (!this.selectedDeviceId && this.devices[preferredIndex]) {
          this.selectedDeviceId = this.devices[preferredIndex].deviceId;
          this.deviceSelect.value = this.selectedDeviceId;
        }
      }
    } catch (err) {
      console.warn('[MicroscopeCamera] Erro ao listar dispositivos antes da permissão:', err);
    }
  }

  /**
   * Inicia o fluxo de vídeo WebRTC com resolução Full HD ideal (1920x1080)
   */
  async startCamera(deviceId = null) {
    if (deviceId) {
      this.selectedDeviceId = deviceId;
    } else if (this.deviceSelect && this.deviceSelect.value) {
      this.selectedDeviceId = this.deviceSelect.value;
    }

    this.stopCamera();

    const videoConstraints = {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, min: 15 }
    };

    if (this.selectedDeviceId) {
      videoConstraints.deviceId = { exact: this.selectedDeviceId };
    }

    this.updateStatus('connecting', 'Conectando câmera...');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
      this.isActive = true;
      this.isFrozen = false;

      // Aguardar o vídeo carregar dimensões nativas
      await new Promise(resolve => {
        this.videoElement.onloadedmetadata = () => {
          this.syncCanvasResolution();
          resolve();
        };
      });

      const track = this.stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};
      const width = settings.width || this.videoElement.videoWidth || 1920;
      const height = settings.height || this.videoElement.videoHeight || 1080;
      const fps = Math.round(settings.frameRate || 30);

      this.updateStatus('active', `Ao Vivo: ${width}x${height} @ ${fps}fps`);

      // Após permissão, os rótulos de hardware são liberados; atualiza dropdown
      await this.enumerateDevices();
      if (this.deviceSelect && track.label) {
        // Encontrar e marcar a câmera correta
        Array.from(this.deviceSelect.options).forEach(opt => {
          if (opt.value === track.getSettings().deviceId) {
            opt.selected = true;
          }
        });
      }

      this.renderOverlay();
      return true;

    } catch (err) {
      console.error('[MicroscopeCamera] Falha ao iniciar câmera:', err);
      this.handleCameraError(err);
      return false;
    }
  }

  /**
   * Tratamento amigável e técnico dos erros do getUserMedia
   */
  handleCameraError(err) {
    this.stopCamera();
    let userMsg = '';
    let category = 'error';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      userMsg = 'Permissão negada. Clique no ícone de CADEADO na barra de endereços do navegador e permita o uso da Câmera.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      userMsg = 'Câmera não encontrada. Verifique se o cabo USB da câmera do microscópio está bem conectado.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      userMsg = 'Câmera em uso. Feche outros aplicativos de microscopia (AmScope, ToupLite, OBS, Zoom) que possam estar com a câmera aberta.';
    } else if (err.name === 'OverconstrainedError') {
      userMsg = 'A câmera não suporta resolução Full HD. Tentando modo de compatibilidade automático...';
      // Tentativa de fallback sem restrição de resolução
      setTimeout(() => this.fallbackCamera(), 500);
      return;
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
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
      this.isActive = true;
      this.isFrozen = false;
      this.videoElement.onloadedmetadata = () => {
        this.syncCanvasResolution();
        this.renderOverlay();
      };
      this.updateStatus('active', 'Ao Vivo (Modo Compatibilidade)');
    } catch (err) {
      this.handleCameraError(err);
    }
  }

  /**
   * Encerra o fluxo de vídeo da câmera
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.isActive = false;
    this.isFrozen = false;
    this.frozenFrameCanvas = null;
    this.updateStatus('stopped', 'Câmera Pausada');
    this.renderOverlay();
  }

  /**
   * Alterna entre Iniciar e Pausar Câmera
   */
  async toggleCamera() {
    if (this.isActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  /**
   * Congela ou descongela o feed ao vivo para inspeção fina do microscopista
   */
  toggleFreeze() {
    if (!this.isActive) return false;

    if (!this.isFrozen) {
      // Congelar: captura o frame atual e desenha no canvas
      const w = this.videoElement.videoWidth || 1920;
      const h = this.videoElement.videoHeight || 1080;
      
      this.frozenFrameCanvas = document.createElement('canvas');
      this.frozenFrameCanvas.width = w;
      this.frozenFrameCanvas.height = h;
      const ctx = this.frozenFrameCanvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, w, h);

      this.videoElement.pause();
      this.isFrozen = true;
      this.updateStatus('frozen', '❄️ Imagem Congelada (Alinhamento)');
    } else {
      // Descongelar
      this.videoElement.play();
      this.isFrozen = false;
      this.frozenFrameCanvas = null;
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
    const transformStr = `scale(${scaleX}, ${scaleY})`;
    this.videoElement.style.transform = transformStr;
    // O canvas de overlay não é espelhado por CSS, pois o retículo e badges devem permanecer legíveis!
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

    // Ajustar o container de vídeo para a proporção exata da câmera sem distorção
    if (this.container && w > 0 && h > 0) {
      this.container.style.aspectRatio = `${w} / ${h}`;
    }

    this.renderOverlay();
  }

  /**
   * Define o percentual de sobreposição (overlap)
   */
  setOverlap(percent) {
    this.overlapPct = Math.max(0.05, Math.min(0.40, percent));
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
   * Dispara o som de clique de obturador mecânico sintético via Web Audio
   */
  playShutterSound() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      // Ignora silenciosamente se o áudio estiver bloqueado
    }
  }

  /**
   * Flash visual na tela para indicar disparo de foto
   */
  triggerVisualFlash() {
    if (!this.container) return;
    const flashDiv = document.createElement('div');
    flashDiv.className = 'absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 z-50';
    flashDiv.style.opacity = '0.7';
    this.container.appendChild(flashDiv);
    requestAnimationFrame(() => {
      flashDiv.style.opacity = '0';
      setTimeout(() => flashDiv.remove(), 250);
    });
  }

  /**
   * CAPTURA DE FOTO E ARMAZENAMENTO PARA O ONION SKIN
   * @param {number} stepIndex - Índice do passo recém-concluído (0, 1, 2...)
   * @param {string} nextDirection - Próximo movimento ('DOWN', 'UP', 'RIGHT', 'LEFT', 'DONE')
   * @param {number} stepNumber - Número legível da foto (ex: 1, 2, 3...)
   */
  captureFrame(stepIndex, nextDirection = 'DOWN', stepNumber = 1) {
    let sourceCanvas = null;

    if (this.isActive && this.videoElement.videoWidth > 0) {
      const w = this.videoElement.videoWidth;
      const h = this.videoElement.videoHeight;

      const snap = document.createElement('canvas');
      snap.width = w;
      snap.height = h;
      const sCtx = snap.getContext('2d');

      // Se houver espelhamento óptico ativo, aplica na captura para bater com a tela
      sCtx.save();
      if (this.isFlippedH || this.isFlippedV) {
        sCtx.translate(this.isFlippedH ? w : 0, this.isFlippedV ? h : 0);
        sCtx.scale(this.isFlippedH ? -1 : 1, this.isFlippedV ? -1 : 1);
      }
      sCtx.drawImage(this.videoElement, 0, 0, w, h);
      sCtx.restore();

      sourceCanvas = snap;
    } else {
      // Fallback: Gera um padrão sintético texturizado de microscopia para testes
      sourceCanvas = this.generateSyntheticMicroscopyFrame(stepNumber);
    }

    this.lastCapturedFrame = sourceCanvas;
    this.currentDirection = nextDirection;
    this.previousStepNumber = stepNumber;

    // Salva no histórico de frames
    this.capturedFrames.set(stepIndex, {
      canvas: sourceCanvas,
      stepNumber,
      direction: nextDirection,
      timestamp: new Date().toISOString()
    });

    // Efeitos de feedback
    this.playShutterSound();
    this.triggerVisualFlash();

    // Renderizar o novo ghosting para o próximo passo
    this.renderOverlay();

    if (this.onFrameCaptured) {
      this.onFrameCaptured({
        stepIndex,
        stepNumber,
        nextDirection,
        canvas: sourceCanvas
      });
    }

    return sourceCanvas;
  }

  /**
   * Restaura o ghosting de um passo anterior quando o usuário clica em "Voltar"
   */
  restoreStep(stepIndex, nextDirection = 'DOWN', prevStepNumber = null) {
    const prevItem = this.capturedFrames.get(stepIndex - 1);
    if (prevItem) {
      this.lastCapturedFrame = prevItem.canvas;
      this.previousStepNumber = prevItem.stepNumber;
    } else {
      this.lastCapturedFrame = null;
      this.previousStepNumber = null;
    }
    this.currentDirection = nextDirection;
    this.renderOverlay();
  }

  /**
   * Limpa o fantasma atual
   */
  clearGhost() {
    this.lastCapturedFrame = null;
    this.previousStepNumber = null;
    this.renderOverlay();
  }

  /**
   * RENDERIZADOR PRINCIPAL DO OVERLAY (Ghosting + Linhas de 15% + Mira Reticular)
   */
  renderOverlay() {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    // 1. Limpa o canvas
    ctx.clearRect(0, 0, w, h);

    if (w === 0 || h === 0) return;

    // 2. Desenhar Onion Skin (Ghosting) se houver foto anterior
    if (this.lastCapturedFrame && this.ghostOpacity > 0 && this.currentDirection !== 'DONE') {
      this.drawGhostingSlice(ctx, w, h);
    }

    // 3. Desenhar Mira Central Reticular (se ativada)
    if (this.showReticle) {
      this.drawMicroscopyReticle(ctx, w, h);
    }

    // 4. Se a varredura estiver concluída, exibe banner festivo
    if (this.currentDirection === 'DONE') {
      this.drawDoneBanner(ctx, w, h);
    }
  }

  /**
   * Desenha a faixa de 15% de Overlap de acordo com a direção do movimento
   */
  drawGhostingSlice(ctx, W, H) {
    const P = this.overlapPct; // Ex: 0.15
    const src = this.lastCapturedFrame;
    const srcW = src.width;
    const srcH = src.height;

    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    let dx = 0, dy = 0, dw = W, dh = H;
    let lineStart = { x: 0, y: 0 };
    let lineEnd = { x: 0, y: 0 };
    let badgeText = '';
    let badgePos = { x: 0, y: 0 };

    /**
     * MECÂNICA ÓPTICA DA VARREDURA EM SERPENTE:
     * - Se o próximo movimento é DESCER (DOWN):
     *   O novo campo ao vivo está ABAIXO do campo anterior.
     *   Portanto, a faixa INFERIOR de 15% da foto anterior
     *   se sobrepõe com a faixa SUPERIOR de 15% do campo atual.
     * 
     * - Se o próximo movimento é SUBIR (UP):
     *   O novo campo ao vivo está ACIMA do campo anterior.
     *   Portanto, a faixa SUPERIOR de 15% da foto anterior
     *   se sobrepõe com a faixa INFERIOR de 15% do campo atual.
     * 
     * - Se o próximo movimento é DIREITA (RIGHT):
     *   O novo campo ao vivo está À DIREITA do campo anterior.
     *   Portanto, a faixa DIREITA de 15% da foto anterior
     *   se sobrepõe com a faixa ESQUERDA de 15% do campo atual.
     */
    if (this.currentDirection === 'DOWN') {
      // Recorta faixa inferior de 15% da anterior
      sx = 0;
      sy = srcH * (1 - P);
      sw = srcW;
      sh = srcH * P;

      // Desenha no topo de 15% do canvas ao vivo
      dx = 0;
      dy = 0;
      dw = W;
      dh = H * P;

      lineStart = { x: 0, y: H * P };
      lineEnd = { x: W, y: H * P };
      badgeText = `▲ FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (TOPO)`;
      badgePos = { x: W / 2, y: (H * P) / 2 };

    } else if (this.currentDirection === 'UP') {
      // Recorta faixa superior de 15% da anterior
      sx = 0;
      sy = 0;
      sw = srcW;
      sh = srcH * P;

      // Desenha no fundo de 15% do canvas ao vivo
      dx = 0;
      dy = H * (1 - P);
      dw = W;
      dh = H * P;

      lineStart = { x: 0, y: H * (1 - P) };
      lineEnd = { x: W, y: H * (1 - P) };
      badgeText = `▼ FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (FUNDO)`;
      badgePos = { x: W / 2, y: H - (H * P) / 2 };

    } else if (this.currentDirection === 'RIGHT') {
      // Recorta faixa direita de 15% da anterior
      sx = srcW * (1 - P);
      sy = 0;
      sw = srcW * P;
      sh = srcH;

      // Desenha na borda esquerda de 15% do canvas ao vivo
      dx = 0;
      dy = 0;
      dw = W * P;
      dh = H;

      lineStart = { x: W * P, y: 0 };
      lineEnd = { x: W * P, y: H };
      badgeText = `◄ FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (ESQ)`;
      badgePos = { x: (W * P) / 2, y: H / 2 };

    } else if (this.currentDirection === 'LEFT') {
      // Recorta faixa esquerda de 15%
      sx = 0;
      sy = 0;
      sw = srcW * P;
      sh = srcH;

      // Desenha na borda direita de 15%
      dx = W * (1 - P);
      dy = 0;
      dw = W * P;
      dh = H;

      lineStart = { x: W * (1 - P), y: 0 };
      lineEnd = { x: W * (1 - P), y: H };
      badgeText = `FOTO #${this.previousStepNumber || ''} ANTERIOR — OVERLAP ${Math.round(P * 100)}% (DIR) ►`;
      badgePos = { x: W - (W * P) / 2, y: H / 2 };
    }

    // Desenho do Ghost com efeito de transparência
    ctx.save();
    ctx.globalAlpha = this.ghostOpacity;

    if (this.ghostBlendMode === 'cyan') {
      // Modo Ciano: Realce óptico com contraste para cortes histológicos (H&E)
      ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.fillRect(dx, dy, dw, dh);
    } else if (this.ghostBlendMode === 'difference') {
      // Modo Diferença: Estruturas alinhadas tendem a se anular/destacar
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      // Modo Normal com Alpha
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();

    // Linha divisória pontilhada com brilho neon
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = Math.max(2, Math.round(W * 0.0015));
    ctx.strokeStyle = '#f59e0b'; // Âmbar / Neon
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 8;
    ctx.moveTo(lineStart.x, lineStart.y);
    ctx.lineTo(lineEnd.x, lineEnd.y);
    ctx.stroke();
    ctx.restore();

    // Badge explicativo sobreposto na faixa
    this.drawOverlapBadge(ctx, badgeText, badgePos.x, badgePos.y, W, H);
  }

  /**
   * Desenha um badge translúcido de identificação da faixa de overlap
   */
  drawOverlapBadge(ctx, text, x, y, W, H) {
    ctx.save();
    const fontSize = Math.max(11, Math.round(H * 0.022));
    ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(text);
    const paddingX = 14;
    const paddingY = 8;
    const boxW = textMetrics.width + paddingX * 2;
    const boxH = fontSize + paddingY * 2;

    // Fundo do Pill escuro com borda âmbar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
    ctx.lineWidth = 1.5;

    const rx = x - boxW / 2;
    const ry = y - boxH / 2;
    const radius = 6;

    ctx.beginPath();
    ctx.roundRect(rx, ry, boxW, boxH, radius);
    ctx.fill();
    ctx.stroke();

    // Texto com contraste
    ctx.fillStyle = '#fde68a';
    ctx.fillText(text, x, y);
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

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.55)'; // Indigo translúcido
    ctx.lineWidth = 1.2;

    // 1. Círculo Central Pequeno (Foco Primário)
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.04, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Círculo Médio
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.15, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Cruz Reticular com Marcadores Micrométricos (Ticks)
    const armLength = scale * 0.25;
    ctx.beginPath();
    // Eixo Horizontal
    ctx.moveTo(cx - armLength, cy);
    ctx.lineTo(cx + armLength, cy);
    // Eixo Vertical
    ctx.moveTo(cx, cy - armLength);
    ctx.lineTo(cx, cy + armLength);
    ctx.stroke();

    // Ticks micrométricos a cada 2% da tela
    const tickStep = scale * 0.025;
    const tickSize = 4;
    ctx.beginPath();
    for (let i = 1; i <= 8; i++) {
      const d = i * tickStep;
      // Horizontais
      ctx.moveTo(cx + d, cy - tickSize);
      ctx.lineTo(cx + d, cy + tickSize);
      ctx.moveTo(cx - d, cy - tickSize);
      ctx.lineTo(cx - d, cy + tickSize);
      // Verticais
      ctx.moveTo(cx - tickSize, cy + d);
      ctx.lineTo(cx + tickSize, cy + d);
      ctx.moveTo(cx - tickSize, cy - d);
      ctx.lineTo(cx + tickSize, cy - d);
    }
    ctx.stroke();

    // Ponto central diminuto
    ctx.fillStyle = '#818cf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Banner de comemoração ao término da lâmina
   */
  drawDoneBanner(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, W, H);

    const fontSize = Math.max(18, Math.round(H * 0.05));
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#34d399';
    ctx.fillText('🎉 Varredura Completa!', W / 2, H / 2 - 20);

    ctx.font = `500 ${Math.round(fontSize * 0.6)}px Inter, sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Todas as fotos do grid foram capturadas.', W / 2, H / 2 + 25);
    ctx.restore();
  }

  /**
   * Gera uma imagem sintética com aspecto histológico (H&E) caso nenhuma câmera esteja plugada
   */
  generateSyntheticMicroscopyFrame(stepNumber) {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // Fundo rosa suave (típico de estroma/citoplasma histológico)
    const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
    grad.addColorStop(0, '#fce7f3');
    grad.addColorStop(0.5, '#fbcfe8');
    grad.addColorStop(1, '#f472b6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Núcleos celulares em roxo/azul hematoxilina aleatórios
    const rng = (seed) => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let seed = stepNumber * 777;
    for (let i = 0; i < 90; i++) {
      const cx = rng(seed++) * 1920;
      const cy = rng(seed++) * 1080;
      const r = 8 + rng(seed++) * 16;
      ctx.fillStyle = rng(seed++) > 0.3 ? '#6b21a8' : '#4c1d95';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.3, r, rng(seed++) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Carimbo de identificação
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`SIMULAÇÃO HISTOLÓGICA — CAMPO #${stepNumber}`, 80, 120);

    return canvas;
  }

  /**
   * Notifica alteração de status para a UI
   */
  updateStatus(state, message) {
    if (this.statusBadge) {
      this.statusBadge.className = 'text-xs px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 transition-all shadow-sm ';
      if (state === 'active') {
        this.statusBadge.className += 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ${message}`;
      } else if (state === 'connecting') {
        this.statusBadge.className += 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> ${message}`;
      } else if (state === 'frozen') {
        this.statusBadge.className += 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
        this.statusBadge.innerHTML = `<span>❄️</span> ${message}`;
      } else if (state === 'error') {
        this.statusBadge.className += 'bg-rose-500/20 text-rose-400 border border-rose-500/40';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> ${message}`;
      } else {
        this.statusBadge.className += 'bg-slate-800 text-slate-400 border border-slate-700';
        this.statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> ${message}`;
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
      alert(`[Aviso da Câmera] ${errObj.message}`);
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

// Exporta globalmente para compatibilidade total em navegador e módulos
if (typeof window !== 'undefined') {
  window.MicroscopeCameraManager = MicroscopeCameraManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MicroscopeCameraManager };
}
