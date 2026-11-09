/**
 * ============================================================================
 * PALAS ATLAS — MOTOR DE SEGURANÇA E PROTEÇÃO DE LÂMINAS DIGITAIS (WSI/DZI)
 * ============================================================================
 * Camada de proteção no cliente contra raspagem (scraping), download não
 * autorizado, captura de tela limpa e pirataria de lâminas histológicas.
 *
 * Recursos:
 *  1. Marca d'água dinâmica estocástica com identificação do usuário e data/hora.
 *  2. Bloqueio de clique direito, arrasto de imagem e atalhos de salvamento/impressão.
 *  3. Proteção e Taint de Canvas contra extração via toDataURL/toBlob.
 *  4. Gestão de tickets efêmeros de sessão para requisições de azulejos DZI.
 *  5. Toast discreto de notificação de segurança pedagógica.
 */

class SlideSecurityEngine {
  constructor() {
    this.initialized = false;
    this.sessionTicket = null;
    this.ticketExpiresAt = 0;
    this.viewerElement = null;
    this.watermarkCanvas = null;
    this.watermarkAnimFrame = null;
    this.currentSlideId = null;
    this.currentUserIdentifier = null;
    this.driftOffsetX = 0;
    this.driftOffsetY = 0;
    this.driftDirection = 1;
    this.lastDriftUpdate = 0;
    this.hardenedEventsBound = false;
  }

  /**
   * Inicializa o motor de proteção para o visualizador
   * @param {Object} options
   * @param {HTMLElement} options.viewerElement Container do visualizador
   * @param {string} options.slideId Identificador da lâmina atual
   * @param {string} [options.userEmail] E-mail ou identificador do usuário
   */
  init(options = {}) {
    this.viewerElement = options.viewerElement || document.getElementById('osd-viewer');
    this.currentSlideId = options.slideId || 'lamina-anon';
    this.currentUserIdentifier = options.userEmail || this._obterIdentificadorSessao();

    if (!this.viewerElement) {
      console.warn('[Palas Security] Elemento #osd-viewer não encontrado para blindagem.');
      return;
    }

    // 1. Blindagem do DOM e atalhos de teclado (executado uma única vez)
    if (!this.hardenedEventsBound) {
      this._aplicarBlindagemCliente();
      this._protegerCanvasAPI();
      this.hardenedEventsBound = true;
    }

    // 2. Instanciação e amarração da marca d'água dinâmica
    this._montarMarcaDaguaDinamica();

    // 3. Ouvinte para sincronizar com mudanças de tema (claro/escuro) e redimensionamento
    window.addEventListener('resize', () => this._redimensionarMarcaDagua());
    const observer = new MutationObserver(() => this._redimensionarMarcaDagua());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    // 4. Inicia ciclo de autenticação de sessão de azulejos
    this.renovarTicketSessao(this.currentSlideId);

    // 5. Rastreamento dinâmico do usuário autenticado no Firebase
    const setupAuthListener = () => {
      try {
        if (window.firebase && typeof window.firebase.auth === 'function') {
          window.firebase.auth().onAuthStateChanged((user) => {
            if (user && user.email) {
              this.currentUserIdentifier = user.email;
              this._desenharMarcaDagua();
            }
          });
        }
      } catch (e) {}
    };
    setupAuthListener();
    window.addEventListener('palas-firebase-ready', setupAuthListener);

    this.initialized = true;
    console.info('[Palas Security] Blindagem ativa contra cópia e raspagem de lâminas.');
  }

  /**
   * Atualiza a lâmina em foco e renova os parâmetros da marca d'água
   */
  setSlide(slideId, userEmail = null) {
    this.currentSlideId = slideId;
    if (userEmail) this.currentUserIdentifier = userEmail;
    this.renovarTicketSessao(slideId);
    this._desenharMarcaDagua();
  }

  /**
   * Gera ou recupera um identificador anônimo rastreável baseado no navegador
   */
  _obterIdentificadorSessao() {
    try {
      let anonId = sessionStorage.getItem('palas_sec_sid');
      if (!anonId) {
        const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
        const ts = Date.now().toString(36).toUpperCase();
        anonId = `EST-${ts}-${rand}`;
        sessionStorage.setItem('palas_sec_sid', anonId);
      }
      return anonId;
    } catch (e) {
      return `SID-${Math.floor(Math.random() * 900000 + 100000)}`;
    }
  }

  /**
   * Cria o canvas da marca d'água posicionado exatamente sobre a área óptica
   */
  _montarMarcaDaguaDinamica() {
    if (this.watermarkCanvas && this.watermarkCanvas.parentNode) {
      this.watermarkCanvas.parentNode.removeChild(this.watermarkCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'palas-security-watermark-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '18'; // Acima dos azulejos e pinos, abaixo dos botões do revólver
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.opacity = '1';

    this.viewerElement.appendChild(canvas);
    this.watermarkCanvas = canvas;
    this._redimensionarMarcaDagua();

    // Loop de micro-deriva estocástica para quebrar filtros medianos de remoção algorítmica
    this._iniciarAnimacaoDeriva();
  }

  _redimensionarMarcaDagua() {
    if (!this.watermarkCanvas || !this.viewerElement) return;
    const rect = this.viewerElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.watermarkCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.watermarkCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this._desenharMarcaDagua();
  }

  _iniciarAnimacaoDeriva() {
    if (this.watermarkAnimFrame) cancelAnimationFrame(this.watermarkAnimFrame);

    const loop = (timestamp) => {
      // Atualiza a posição a cada 45 segundos de forma suave
      if (!this.lastDriftUpdate || timestamp - this.lastDriftUpdate > 45000) {
        this.lastDriftUpdate = timestamp;
        this.driftOffsetX = (this.driftOffsetX + 37) % 180;
        this.driftOffsetY = (this.driftOffsetY + 23) % 180;
        this._desenharMarcaDagua();
      }
      this.watermarkAnimFrame = requestAnimationFrame(loop);
    };
    this.watermarkAnimFrame = requestAnimationFrame(loop);
  }

  /**
   * Renderiza a matriz diagonal da marca d'água de alta fidelidade
   */
  _desenharMarcaDagua() {
    if (!this.watermarkCanvas) return;
    const ctx = this.watermarkCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this.watermarkCanvas.width;
    const height = this.watermarkCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    // Opacidade calculada para ser perceptível em prints mas não poluir o estudo citológico
    const textColor = isLight 
      ? 'rgba(15, 23, 42, 0.055)' 
      : 'rgba(255, 255, 255, 0.048)';
    const goldAccent = isLight 
      ? 'rgba(180, 83, 9, 0.06)' 
      : 'rgba(212, 175, 55, 0.065)';

    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR');
    const userLabel = this.currentUserIdentifier.includes('@') 
      ? this._ofuscarEmail(this.currentUserIdentifier)
      : this.currentUserIdentifier;

    const textoLinha1 = `PALAS ATLAS • ACERVO PROTEGIDO`;
    const textoLinha2 = `${userLabel} • ${dataStr} • CÓPIA PROIBIDA`;

    ctx.save();
    ctx.rotate((-22 * Math.PI) / 180);

    const stepX = 380 * dpr;
    const stepY = 220 * dpr;
    const startX = -width + (this.driftOffsetX * dpr);
    const endX = width * 2;
    const startY = -height + (this.driftOffsetY * dpr);
    const endY = height * 2;

    ctx.font = `600 ${11 * dpr}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = 'center';

    for (let x = startX; x < endX; x += stepX) {
      for (let y = startY; y < endY; y += stepY) {
        ctx.fillStyle = goldAccent;
        ctx.fillText(textoLinha1, x, y);
        ctx.fillStyle = textColor;
        ctx.fillText(textoLinha2, x, y + (16 * dpr));
      }
    }

    ctx.restore();
  }

  _ofuscarEmail(email) {
    const partes = email.split('@');
    if (partes.length !== 2) return email;
    const user = partes[0];
    const dominio = partes[1];
    const visivel = user.length <= 3 ? user[0] + '**' : user.substring(0, 2) + '***' + user.slice(-1);
    return `${visivel}@${dominio}`;
  }

  /**
   * Aplica travas no navegador para impedir atalhos e menus comuns de extração
   */
  _aplicarBlindagemCliente() {
    // 1. Bloqueia botão direito do mouse no container óptico
    this.viewerElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._exibirAvisoSeguranca('Download direto e clique direito desativados para proteção de direitos autorais.');
      return false;
    }, true);

    // 2. Previne arrasto de elementos para salvar como imagem
    this.viewerElement.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    }, true);

    // 3. Intercepta atalhos de salvar página, imprimir e inspecionar código
    window.addEventListener('keydown', (e) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key ? e.key.toLowerCase() : '';

      // Ctrl/Cmd + S (Salvar página)
      // Ctrl/Cmd + P (Imprimir)
      // Ctrl/Cmd + U (Exibir código-fonte)
      if (isCmdOrCtrl && (key === 's' || key === 'p' || key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        this._exibirAvisoSeguranca('Esta lâmina faz parte do acervo curricular protegido. O salvamento e impressão direta são desabilitados.');
        return false;
      }
    }, true);
  }

  /**
   * Protege chamadas ao Canvas para evitar raspagem em loop (canvas.toDataURL)
   */
  _protegerCanvasAPI() {
    try {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      const self = this;

      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        if (this.closest && this.closest('#osd-viewer')) {
          console.warn('[Palas Security] Tentativa não autorizada de extração de dados do Canvas.');
          self._exibirAvisoSeguranca('A extração automatizada de pixels do microscópio é monitorada e não autorizada.');
          const dummy = document.createElement('canvas');
          dummy.width = 1; dummy.height = 1;
          return originalToDataURL.apply(dummy, args);
        }
        return originalToDataURL.apply(this, args);
      };

      HTMLCanvasElement.prototype.toBlob = function(...args) {
        if (this.closest && this.closest('#osd-viewer')) {
          console.warn('[Palas Security] Tentativa não autorizada de extração de Blob do Canvas.');
          self._exibirAvisoSeguranca('A extração automatizada de pixels do microscópio é monitorada e não autorizada.');
          const callback = args[0];
          if (typeof callback === 'function') callback(null);
          return;
        }
        return originalToBlob.apply(this, args);
      };
    } catch (err) {
      console.warn('[Palas Security] Hook de Canvas não aplicável neste ambiente:', err);
    }
  }

  /**
   * Solicita um ticket de sessão efêmero assinado para requisições de azulejos
   */
  async renovarTicketSessao(slideId) {
    if (!slideId) return null;
    const now = Date.now();
    if (this.sessionTicket && this.ticketExpiresAt > now + 60000) {
      return this.sessionTicket;
    }

    try {
      const res = await fetch(`/api/tile-auth?id=${encodeURIComponent(slideId)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        this.sessionTicket = data.token;
        this.ticketExpiresAt = data.expiresAt || (now + 15 * 60 * 1000);
        return this.sessionTicket;
      }
    } catch (e) {
      // Fallback em caso de ambiente estático sem servidor de funções ativo
    }

    // Fallback gerado localmente para manter a consistência de interface
    this.sessionTicket = `palas-sec-${btoa(slideId + ':' + now).substring(0, 24)}`;
    this.ticketExpiresAt = now + 15 * 60 * 1000;
    return this.sessionTicket;
  }

  /**
   * Constrói a URL segura de um azulejo com proteção contra hotlink e scrapers
   * @param {string} rawTileUrl URL nativa do azulejo
   */
  obterUrlAzulejoProtegida(rawTileUrl) {
    if (!rawTileUrl) return rawTileUrl;
    if (rawTileUrl.includes('/api/tile?')) return rawTileUrl;

    const token = this.sessionTicket || 'active';
    const isWebProtocol = window.location.protocol === 'http:' || window.location.protocol === 'https:';

    if (isWebProtocol) {
      // Normaliza o caminho relativo do azulejo removendo domínio e prefixo
      let cleanPath = rawTileUrl.replace(/^[a-z]+:\/\/[^\/]+/i, '');
      cleanPath = cleanPath.split('?')[0].replace(/^\/+/, '');
      cleanPath = cleanPath.replace(/^assets\/histologia\//, '');

      return `/api/tile?p=${encodeURIComponent(cleanPath)}&t=${encodeURIComponent(token)}`;
    }

    // Fallback para desenvolvimento local via file://
    const separador = rawTileUrl.includes('?') ? '&' : '?';
    return `${rawTileUrl}${separador}token=${encodeURIComponent(token)}`;
  }

  /**
   * Exibe uma notificação sutil e sóbria de segurança ao usuário
   */
  _exibirAvisoSeguranca(mensagem) {
    let toast = document.getElementById('palas-security-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'palas-security-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      toast.style.zIndex = '9999';
      toast.style.backgroundColor = 'rgba(15, 23, 42, 0.94)';
      toast.style.color = '#f8fafc';
      toast.style.border = '1px solid rgba(212, 175, 55, 0.4)';
      toast.style.padding = '10px 18px';
      toast.style.borderRadius = '12px';
      toast.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6)';
      toast.style.fontSize = '12px';
      toast.style.fontFamily = "'Inter', system-ui, sans-serif";
      toast.style.letterSpacing = '0.02em';
      toast.style.pointerEvents = 'none';
      toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      toast.style.opacity = '0';
      toast.style.backdropFilter = 'blur(10px)';
      toast.style.webkitBackdropFilter = 'blur(10px)';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg style="width: 16px; height: 16px; color: #d4af37; shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        <span>${mensagem}</span>
      </div>
    `;

    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 4200);
  }
}

// Instância singleton global para exportação
const slideSecurity = new SlideSecurityEngine();
window.slideSecurity = slideSecurity;

export { slideSecurity, SlideSecurityEngine };
