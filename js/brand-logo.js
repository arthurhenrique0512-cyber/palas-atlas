/**
 * ============================================================================
 * BrandLogo — Web Component (Single Source of Truth)
 * ============================================================================
 * Atributos:
 *   is-home   : 'true' | 'false' (padrão: 'false')
 *               true  → emblema dourado/colorido (exclusivo da Home Page)
 *               false → emblema monocromático
 *
 *   theme     : 'dark-bg' (padrão) | 'light-bg'
 *               Controla a cor monocromática do texto quando is-home='false'.
 *               dark-bg  → texto em branco/slate claro (para fundos escuros)
 *               light-bg → texto em slate escuro (para fundos claros)
 *
 *   size      : 'sm' | 'md' (padrão) | 'lg'
 *               Escala proporcionalmente o emblema e o texto.
 *
 *   show-subtitle : 'true' (padrão) | 'false'
 *               Exibe ou oculta "ATLAS MORFOLÓGICO DIGITAL"
 *
 * Zero Emojis | Clinical Precision UI
 */

class BrandLogo extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['is-home', 'theme', 'size', 'show-subtitle', 'variant'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    // ─── Atributos ──────────────────────────────────────────────────────────
    const isHome       = this.getAttribute('is-home') === 'true'
                         // retrocompatibilidade: variant="dark" sem is-home → monocromático escuro
                         || false;
    const rawTheme     = this.getAttribute('theme') || 'dark-bg';
    const size         = this.getAttribute('size') || 'md';
    const showSubtitle = this.getAttribute('show-subtitle') !== 'false';
    // Retrocompatibilidade com o atributo legado "variant"
    const legacyVariant = this.getAttribute('variant'); // 'dark' | 'light' | null

    // ─── Resolução de tema ──────────────────────────────────────────────────
    // Prioridade: is-home > theme > variant legado
    let theme = rawTheme;
    if (legacyVariant === 'light') theme = 'light-bg';
    if (legacyVariant === 'dark')  theme = 'dark-bg';

    // ─── Tamanhos (escala proporcional) ────────────────────────────────────
    const sizes = {
      sm: {
        imgClass:      'h-7 md:h-8',
        textClass:     'text-sm md:text-sm',
        trackingPalas: 'tracking-[0.2em]',
        trackingAtlas: 'tracking-[0.2em]',
        subtitleClass: 'text-[8px] md:text-[9px] tracking-[0.28em]',
        gap:           'gap-1.5',
        subtitleMt:    'mt-0.5',
      },
      md: {
        imgClass:      'h-10 md:h-12',
        textClass:     'text-base md:text-lg',
        trackingPalas: 'tracking-[0.2em]',
        trackingAtlas: 'tracking-[0.2em]',
        subtitleClass: 'text-[9px] md:text-[10px] tracking-[0.32em]',
        gap:           'gap-2.5',
        subtitleMt:    'mt-0.5',
      },
      lg: {
        imgClass:      'h-14 md:h-16',
        textClass:     'text-lg md:text-xl',
        trackingPalas: 'tracking-[0.22em]',
        trackingAtlas: 'tracking-[0.22em]',
        subtitleClass: 'text-[10px] md:text-[11px] tracking-[0.34em]',
        gap:           'gap-3',
        subtitleMt:    'mt-1',
      },
    };
    const s = sizes[size] || sizes.md;

    // ─── Paleta de Cores ────────────────────────────────────────────────────
    let palasStyle    = '';
    let atlasStyle    = '';
    let subtitleStyle = '';
    let imgStyle      = '';

    if (isHome) {
      // HOME: emblema colorido dourado
      // PALAS: gradiente dourado quente
      palasStyle    = 'background: linear-gradient(to right, #f5d98b, #e8b84b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;';
      // ATLAS: dourado levemente mais claro
      atlasStyle    = 'color: #d4a843;';
      // DIRETRIZ 1: Subtítulo branco total na Home Page
      subtitleStyle = 'color: #ffffff;';
      // Emblema: filtro para tom dourado
      imgStyle      = 'filter: sepia(1) saturate(3) hue-rotate(5deg) brightness(1.05);';
    } else if (theme === 'light-bg') {
      // PÁGINAS INTERNAS (fundo claro): monocromático escuro
      palasStyle    = 'background: linear-gradient(to right, #1e293b, #334155); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;';
      atlasStyle    = 'color: #475569;';
      subtitleStyle = 'color: rgba(71, 85, 105, 0.7);';
      // Emblema: grayscale com tom escuro
      imgStyle      = 'filter: grayscale(1) brightness(0.3) contrast(1.2);';
    } else {
      // DARK-BG (Header escuro, CMS, Microscópio, Drawer): monocromático claro
      palasStyle    = 'background: linear-gradient(to right, #f1f5f9, #e2e8f0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;';
      atlasStyle    = 'color: #94a3b8;';
      subtitleStyle = 'color: rgba(148, 163, 184, 0.65);';
      // Emblema: grayscale com tom claro
      imgStyle      = 'filter: grayscale(1) brightness(1.8) contrast(0.9);';
    }

    // DIRETRIZ 2: Tema "pure-white" para a Aba Lateral (Sidebar)
    if (theme === 'pure-white') {
      palasStyle    = 'color: #ffffff;';
      atlasStyle    = 'color: #ffffff;';
      subtitleStyle = 'color: #ffffff;';
      // Converte imagem transparente/colorida para branco total
      imgStyle      = 'filter: brightness(0) invert(1);';
    }

    // ─── Template ───────────────────────────────────────────────────────────
    this.innerHTML = `
      <div class="flex flex-col items-center text-center select-none cursor-pointer group" style="text-decoration:none;">
        <div class="flex items-center ${s.gap}">

          <span
            class="font-serif font-bold ${s.textClass} ${s.trackingPalas} leading-none m-0 transition-all duration-300"
            style="${palasStyle}"
          >PALAS</span>

          <img
            src="assets/logo-transparente.png?v=4"
            alt="Emblema Palas Atlas"
            class="${s.imgClass} w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            style="${imgStyle} transform: translateZ(0); -webkit-backface-visibility: hidden; backface-visibility: hidden; will-change: transform;"
          />

          <span
            class="font-serif font-normal ${s.textClass} ${s.trackingAtlas} leading-none m-0 transition-all duration-300"
            style="${atlasStyle}"
          >ATLAS</span>

        </div>

        ${showSubtitle ? `
          <span
            class="font-sans uppercase ${s.subtitleClass} ${s.subtitleMt} leading-none font-medium tracking-widest transition-all duration-300 block"
            style="${subtitleStyle}"
          >Atlas Morfológico Digital</span>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('brand-logo', BrandLogo);
