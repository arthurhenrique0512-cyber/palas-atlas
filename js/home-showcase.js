/**
 * ============================================================================
 * CONTROLADOR AO VIVO DA HOME (PALAS ATLAS)
 * ============================================================================
 * Unifica e alimenta exclusivamente por lâminas com status === "ativa":
 *   1. Prancha Óptica do Hero (#heroOpticalStage) — sem marcações, rotação por hora.
 *   2. Vitrine do Console (#heroSlideShowcase) — crossfade + zoom contínuo.
 *   3. Lâminas Populares (#secaoLaminasPopulares) — teto de 4 cartões com rotação automática.
 *   4. Contadores dinâmicos de Histologia, módulos e links padrão do microscópio.
 */
import { escaparHTML } from "./sanitizer.js";
import {
  subscribeActiveSlides,
  getHourlySlideIndex,
  getMsUntilNextHour
} from "./active-slides-store.js?v=20261123v1";

const MAX_POPULAR_VISIBLE = 4;
const VITRINE_INTERVAL_MS = 8000;
const POPULAR_INTERVAL_MS = 9000;

export function initHomeShowcase() {
  if (!document.getElementById("pgHome")) return;

  let activeSlides = [];
  let isOverrideActive = false;

  // Estado do Hero (rotação horária)
  let hourlyTimer = null;

  // Estado da Vitrine
  let vitrineIndex = 0;
  let vitrineTimer = null;
  let vitrineHovered = false;
  let vitrineTransitioning = false;

  // Estado de Lâminas Populares (máx. 4 visíveis + rotação)
  let popularFilter = "todas";
  let popularStep = 0;
  let popularTimer = null;
  let popularPaused = false;
  let popularFadeTimer = null;

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // -------------------------------------------------------------------------
  // 1. PRANCHA ÓPTICA DO HERO (HORÁRIA + SEM MARCAÇÕES + LUPA 2.4x)
  // -------------------------------------------------------------------------
  function renderHeroPlate(nowMs = Date.now()) {
    const imgEl = document.getElementById("heroSpecimenImg");
    const titleEl = document.getElementById("heroSpecimenTitle");
    const metaEl = document.getElementById("heroSpecimenMeta");
    const linkEl = document.getElementById("heroSpecimenLink");
    const winEl = document.getElementById("heroOpticalWindow");
    const loupeEl = document.getElementById("heroOpticalLoupe");

    if (!activeSlides.length) {
      if (titleEl) titleEl.textContent = "Acervo em carregamento";
      if (metaEl) metaEl.textContent = "Aguardando lâminas ativas";
      if (imgEl) imgEl.classList.add("opacity-0");
      return;
    }

    const idx = getHourlySlideIndex(activeSlides.length, nowMs);
    const slide = activeSlides[idx];
    if (!slide) return;

    if (imgEl) {
      if (imgEl.getAttribute("src") !== slide.thumbnailUrl) {
        imgEl.src = slide.thumbnailUrl;
      }
      imgEl.alt = `${slide.nome} — Lâmina histológica real`;
      imgEl.classList.remove("hidden", "opacity-0");
      imgEl.classList.add("opacity-100");
    }
    if (titleEl) titleEl.textContent = slide.nome;
    if (metaEl) metaEl.textContent = `${slide.topicoShort} · ${slide.stainBadge}`;
    if (linkEl) linkEl.setAttribute("href", slide.link);
    if (winEl) winEl.setAttribute("data-href", slide.link);
    if (loupeEl) loupeEl.style.backgroundImage = `url('${slide.thumbnailUrl}')`;
  }

  function scheduleNextHourRotation() {
    clearTimeout(hourlyTimer);
    hourlyTimer = setTimeout(() => {
      renderHeroPlate(Date.now());
      scheduleNextHourRotation();
    }, getMsUntilNextHour(Date.now()));
  }

  function setupHeroOpticalStage() {
    const win = document.getElementById("heroOpticalWindow");
    const img = document.getElementById("heroSpecimenImg");
    const loupe = document.getElementById("heroOpticalLoupe");

    if (win) {
      win.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        const href = win.getAttribute("data-href");
        if (href) window.location.href = href;
      });
    }

    if (win && img && loupe && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const ZOOM = 2.4;
      const LOUPE_RADIUS = 68;
      win.addEventListener("mousemove", (e) => {
        if (window.innerWidth < 1024 || !img.getAttribute("src")) {
          loupe.classList.remove("is-visible");
          return;
        }
        const rect = win.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const natW = img.naturalWidth || rect.width;
        const natH = img.naturalHeight || rect.height;
        const coverScale = Math.max(rect.width / natW, rect.height / natH);
        const renderedW = natW * coverScale;
        const renderedH = natH * coverScale;
        const offsetX = (rect.width - renderedW) / 2;
        const offsetY = (rect.height - renderedH) / 2;
        const bgW = renderedW * ZOOM;
        const bgH = renderedH * ZOOM;
        const bgX = LOUPE_RADIUS - (cx - offsetX) * ZOOM;
        const bgY = LOUPE_RADIUS - (cy - offsetY) * ZOOM;

        loupe.style.transform = `translate3d(${cx - LOUPE_RADIUS}px, ${cy - LOUPE_RADIUS}px, 0)`;
        loupe.style.backgroundSize = `${bgW}px ${bgH}px`;
        loupe.style.backgroundPosition = `${bgX}px ${bgY}px`;
        loupe.classList.add("is-visible");
      });
      win.addEventListener("mouseleave", () => {
        loupe.classList.remove("is-visible");
      });
    }

    const progressBar = document.getElementById("palasScrollProgress");
    if (progressBar) {
      let ticking = false;
      const updateScrollProgress = () => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, Math.max(0, window.scrollY / max));
        progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
        ticking = false;
      };
      window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(updateScrollProgress);
          }
        },
        { passive: true }
      );
      updateScrollProgress();
    }
  }

  // -------------------------------------------------------------------------
  // 2. VITRINE DO CONSOLE DE BUSCA (#heroSlideShowcase)
  // -------------------------------------------------------------------------
  function triggerVitrineZoom(imgEl) {
    if (!imgEl) return;
    imgEl.style.transition = "none";
    imgEl.style.transform = "scale(1)";
    imgEl.style.opacity = "0";
    void imgEl.offsetWidth;
    imgEl.style.transition = "opacity 0.6s ease-out, transform 6s cubic-bezier(0.25, 1, 0.5, 1)";
    imgEl.style.opacity = "1";
    imgEl.style.transform = "scale(1.05)";
  }

  function renderVitrineSlide(idx, forceImmediate = false) {
    const imgEl = document.getElementById("vitrineImage");
    const textContentEl = document.getElementById("vitrineTextContent");
    const badgeWrapperEl = document.getElementById("vitrineBadgeWrapper");
    const titleEl = document.getElementById("vitrineTitle");
    const catEl = document.getElementById("vitrineCategory");
    const stainEl = document.getElementById("vitrineStainBadge");
    const actionEl = document.getElementById("vitrineActionBtn");
    const counterEl = document.getElementById("vitrineCounter");

    if (!activeSlides.length) {
      if (counterEl) counterEl.textContent = "00 / 00";
      if (titleEl) titleEl.textContent = "Acervo em sincronização";
      if (catEl) catEl.textContent = "HISTOLOGIA";
      if (badgeWrapperEl) badgeWrapperEl.classList.add("hidden");
      if (imgEl) imgEl.style.opacity = "0";
      return;
    }

    if (vitrineTransitioning && !forceImmediate) return;

    const nextIndex = ((idx % activeSlides.length) + activeSlides.length) % activeSlides.length;
    const slide = activeSlides[nextIndex];

    const applyContent = () => {
      vitrineIndex = nextIndex;
      if (imgEl) {
        imgEl.classList.remove("hidden");
        imgEl.src = slide.thumbnailUrl;
        imgEl.alt = slide.nome;
        imgEl.onerror = function () {
          this.onerror = null;
          this.src = "assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg";
        };
      }
      if (titleEl) titleEl.textContent = slide.nome;
      if (catEl) {
        catEl.textContent = `${slide.disciplinaLabel} · ${slide.topicoShort}`.toUpperCase();
      }
      if (stainEl && badgeWrapperEl) {
        badgeWrapperEl.classList.remove("hidden");
        stainEl.textContent = slide.stainBadge;
      }
      if (actionEl) actionEl.href = slide.link;
      if (counterEl) {
        const cur = String(vitrineIndex + 1).padStart(2, "0");
        const tot = String(activeSlides.length).padStart(2, "0");
        counterEl.textContent = `${cur} / ${tot}`;
      }
    };

    const elementsToFade = [textContentEl, badgeWrapperEl].filter(Boolean);

    if (forceImmediate) {
      applyContent();
      if (imgEl) triggerVitrineZoom(imgEl);
      elementsToFade.forEach((el) => {
        el.classList.remove("opacity-0");
        el.classList.add("opacity-100");
        el.style.opacity = "1";
      });
      return;
    }

    vitrineTransitioning = true;
    if (imgEl) imgEl.style.opacity = "0";
    elementsToFade.forEach((el) => {
      el.classList.remove("opacity-100");
      el.classList.add("opacity-0");
      el.style.opacity = "0";
    });

    setTimeout(() => {
      applyContent();
      if (imgEl) triggerVitrineZoom(imgEl);

      requestAnimationFrame(() => {
        elementsToFade.forEach((el) => {
          el.classList.remove("opacity-0");
          el.classList.add("opacity-100");
          el.style.opacity = "1";
        });
        setTimeout(() => {
          vitrineTransitioning = false;
        }, 120);
      });
    }, 140);
  }

  function startVitrineTimer() {
    clearInterval(vitrineTimer);
    if (!vitrineHovered && activeSlides.length > 1 && !prefersReducedMotion()) {
      vitrineTimer = setInterval(() => {
        renderVitrineSlide(vitrineIndex + 1);
      }, VITRINE_INTERVAL_MS);
    }
  }

  function stopVitrineTimer() {
    clearInterval(vitrineTimer);
    vitrineTimer = null;
  }

  function setupVitrine() {
    const prevBtn = document.getElementById("vitrinePrevBtn");
    const nextBtn = document.getElementById("vitrineNextBtn");
    const cardEl = document.getElementById("heroSlideShowcase");

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        renderVitrineSlide(vitrineIndex - 1);
        startVitrineTimer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        renderVitrineSlide(vitrineIndex + 1);
        startVitrineTimer();
      });
    }
    if (cardEl) {
      cardEl.addEventListener("mouseenter", () => {
        vitrineHovered = true;
        stopVitrineTimer();
      });
      cardEl.addEventListener("mouseleave", () => {
        vitrineHovered = false;
        startVitrineTimer();
      });
      cardEl.addEventListener("click", (e) => {
        if (e.target.closest("button, a")) return;
        const actionBtn = document.getElementById("vitrineActionBtn");
        const href = actionBtn ? actionBtn.getAttribute("href") : "";
        if (href && href !== "#") window.location.href = href;
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. LÂMINAS POPULARES (MÁX. 4 VISÍVEIS + ROTAÇÃO AUTOMÁTICA)
  // -------------------------------------------------------------------------
  function getFilteredPopularPool() {
    if (popularFilter === "todas") return activeSlides;
    return activeSlides.filter((s) => s.topico === popularFilter);
  }

  function getPopularWindow(pool) {
    if (!pool.length) {
      return { visible: [], totalSteps: 0, safeStep: 0 };
    }
    if (pool.length > MAX_POPULAR_VISIBLE) {
      const totalSteps = Math.ceil(pool.length / MAX_POPULAR_VISIBLE);
      const safeStep = ((popularStep % totalSteps) + totalSteps) % totalSteps;
      const start = safeStep * MAX_POPULAR_VISIBLE;
      return {
        visible: pool.slice(start, start + MAX_POPULAR_VISIBLE),
        totalSteps,
        safeStep
      };
    }
    if (pool.length >= 2) {
      const totalSteps = pool.length;
      const safeStep = ((popularStep % totalSteps) + totalSteps) % totalSteps;
      const visible = [...pool.slice(safeStep), ...pool.slice(0, safeStep)];
      return { visible, totalSteps, safeStep };
    }
    return { visible: pool, totalSteps: 1, safeStep: 0 };
  }

  function renderPopularFilterPills() {
    const container = document.getElementById("homeSlidesFilters");
    if (!container) return;

    const counts = new Map();
    const labels = new Map();
    activeSlides.forEach((s) => {
      if (!s.topico) return;
      counts.set(s.topico, (counts.get(s.topico) || 0) + 1);
      labels.set(s.topico, s.topicoLabel);
    });

    if (popularFilter !== "todas" && !counts.has(popularFilter)) {
      popularFilter = "todas";
      popularStep = 0;
    }

    if (counts.size < 2) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    const makeBtn = (key, label) => {
      const active = popularFilter === key;
      const cls = active
        ? "home-slide-filter-btn px-3 py-1.5 rounded-lg bg-teal-900 text-white shadow-xs transition-colors text-[11px] font-medium tabular-nums cursor-pointer"
        : "home-slide-filter-btn px-3 py-1.5 rounded-lg text-slate-600 hover:text-teal-900 hover:bg-slate-50 transition-colors text-[11px] font-medium tabular-nums cursor-pointer";
      return `<button type="button" data-slide-filter="${escaparHTML(key)}" class="${cls}">${escaparHTML(label)}</button>`;
    };

    const parts = [makeBtn("todas", `Todas (${activeSlides.length})`)];
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([topicKey, qtd]) => {
        parts.push(makeBtn(topicKey, `${labels.get(topicKey) || topicKey} (${qtd})`));
      });

    container.innerHTML = parts.join("");
  }

  function buildPopularCardHTML(slide, layoutClass, isFeatured) {
    const mppTexto = `${(40 / (slide.maxMagnification || 40) * 0.156).toFixed(2).replace(".", ",")} µm/px`;
    const titleSize = isFeatured ? "text-base sm:text-lg lg:text-xl" : "text-base sm:text-lg";
    const descSize = isFeatured ? "text-xs sm:text-[13px]" : "text-xs";

    return `
      <div
        data-slide-id="${escaparHTML(slide.id)}"
        data-slide-topic="${escaparHTML(slide.topico)}"
        class="popular-slide-card ${layoutClass} palas-card-tactile palas-card-interactive group bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer"
      >
        <div class="bento-card-inner flex flex-col w-full h-full">
          <div class="bento-media relative w-full aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200/70">
            <img
              src="${escaparHTML(slide.thumbnailUrl)}"
              alt="${escaparHTML(slide.nome)}"
              class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              loading="lazy"
            />
            <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-900/5"></div>
            <div class="absolute top-2.5 left-2.5">
              <span class="bg-white/95 backdrop-blur-md text-slate-800 border border-slate-200/90 text-[10.5px] font-mono tabular-nums font-semibold px-2.5 py-1 rounded-md shadow-sm">
                ${escaparHTML(slide.stainBadge)}
              </span>
            </div>
          </div>

          <div class="bento-body-wrap flex-1 flex flex-col justify-between">
            <div class="p-4 sm:p-5">
              <div class="flex items-center justify-between gap-2 text-[10px] font-mono tracking-[0.06em] tabular-nums mb-1.5">
                <span class="uppercase text-teal-700 font-semibold">${escaparHTML(slide.topicoLabel)}</span>
                <span class="text-slate-400 normal-case">${escaparHTML(mppTexto)}</span>
              </div>
              <h3 class="popular-slide-title font-serif font-bold ${titleSize} text-slate-900 group-hover:text-teal-900 transition-colors leading-snug mb-1.5">
                ${escaparHTML(slide.nome)}
              </h3>
              <p class="${descSize} text-slate-600 leading-relaxed font-sans">
                ${escaparHTML(slide.subtitulo)}
              </p>
            </div>

            <div class="px-4 sm:px-5 pb-4 sm:pb-5 mt-auto">
              <a
                href="${escaparHTML(slide.link)}"
                class="pt-3 border-t border-slate-100 w-full text-xs font-semibold text-teal-800 group-hover:text-teal-950 transition-colors flex items-center justify-between no-underline"
              >
                <span>Abrir no microscópio</span>
                <span class="text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPopularGrid(animateFade = false) {
    const grid = document.getElementById("homeSlidesGrid");
    const countLabel = document.getElementById("homeSlidesCountLabel");
    const controlsWrap = document.getElementById("popularRotationControls");
    const rotCounter = document.getElementById("popularRotationCounter");
    if (!grid) return;

    const pool = getFilteredPopularPool();
    const { visible, totalSteps, safeStep } = getPopularWindow(pool);
    popularStep = safeStep;

    if (countLabel) {
      if (pool.length === 0) {
        countLabel.textContent = "Nenhuma lâmina ativa";
      } else if (pool.length > MAX_POPULAR_VISIBLE) {
        countLabel.textContent = `Mostrando ${visible.length} de ${pool.length} · máx. 4 por vez`;
      } else {
        countLabel.textContent = `${pool.length} ${pool.length === 1 ? "lâmina ativa" : "lâminas ativas"}`;
      }
    }

    if (controlsWrap && rotCounter) {
      if (totalSteps > 1) {
        controlsWrap.classList.remove("hidden");
        controlsWrap.classList.add("inline-flex");
        const cur = String(safeStep + 1).padStart(2, "0");
        const tot = String(totalSteps).padStart(2, "0");
        rotCounter.textContent = `${cur} / ${tot}`;
      } else {
        controlsWrap.classList.add("hidden");
        controlsWrap.classList.remove("inline-flex");
      }
    }

    const commitRender = () => {
      grid.setAttribute("data-count", String(visible.length));
      if (visible.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-mono">
            Nenhuma lâmina ativa encontrada para este filtro.
          </div>
        `;
      } else {
        grid.innerHTML = visible
          .map((slide, idx) => {
            let cls = "";
            let featured = false;
            if (visible.length === 4) {
              if (idx === 0) {
                cls = "bento-primary";
                featured = true;
              } else if (idx === 1) {
                cls = "bento-accent";
                featured = true;
              } else {
                cls = "bento-wide";
              }
            }
            return buildPopularCardHTML(slide, cls, featured);
          })
          .join("");
      }
      grid.classList.remove("popular-grid-fading");
    };

    clearTimeout(popularFadeTimer);
    if (animateFade && !prefersReducedMotion()) {
      grid.classList.add("popular-grid-fading");
      popularFadeTimer = setTimeout(commitRender, 150);
    } else {
      commitRender();
    }
  }

  function startPopularRotationTimer() {
    clearInterval(popularTimer);
    const pool = getFilteredPopularPool();
    if (!popularPaused && pool.length >= 2 && !prefersReducedMotion()) {
      popularTimer = setInterval(() => {
        popularStep += 1;
        renderPopularGrid(true);
      }, POPULAR_INTERVAL_MS);
    }
  }

  function setupPopularSection() {
    const filterContainer = document.getElementById("homeSlidesFilters");
    const grid = document.getElementById("homeSlidesGrid");
    const prevBtn = document.getElementById("popularPrevBtn");
    const nextBtn = document.getElementById("popularNextBtn");
    const section = document.getElementById("secaoLaminasPopulares");

    if (filterContainer) {
      filterContainer.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-slide-filter]");
        if (!btn) return;
        const target = btn.getAttribute("data-slide-filter") || "todas";
        window.App.filtrarLaminasHome(target);
      });
    }

    if (grid) {
      grid.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        const card = e.target.closest("[data-slide-id]");
        if (!card) return;
        const link = card.querySelector("a");
        const href = link ? link.getAttribute("href") : "";
        if (href) window.location.href = href;
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        window.App.rotacionarLaminasPopulares(-1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        window.App.rotacionarLaminasPopulares(1);
      });
    }

    if (section) {
      section.addEventListener("mouseenter", () => {
        popularPaused = true;
        clearInterval(popularTimer);
      });
      section.addEventListener("mouseleave", () => {
        popularPaused = false;
        startPopularRotationTimer();
      });
      section.addEventListener("focusin", () => {
        popularPaused = true;
        clearInterval(popularTimer);
      });
      section.addEventListener("focusout", () => {
        popularPaused = false;
        startPopularRotationTimer();
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. METADADOS E LINKS DINÂMICOS DA HOME (APENAS LÂMINAS ATIVAS)
  // -------------------------------------------------------------------------
  function updateHomeDynamicMeta() {
    const countBadge = document.getElementById("histologiaCountBadge");
    if (countBadge) {
      const n = activeSlides.length;
      countBadge.textContent = `8 módulos · ${n} ${n === 1 ? "lâmina" : "lâminas"}`;
    }

    const activeTopics = new Set(activeSlides.map((s) => s.topico).filter(Boolean));
    document.querySelectorAll("[data-home-module-topic]").forEach((btn) => {
      const topic = btn.getAttribute("data-home-module-topic");
      const hasActive = activeTopics.has(topic);
      const dot = btn.querySelector("[data-topic-dot]");
      btn.classList.toggle("text-white", hasActive);
      btn.classList.toggle("text-slate-300", !hasActive);
      if (dot) {
        dot.classList.toggle("hidden", !hasActive);
      }
    });

    const defaultHref = activeSlides[0]?.link || "microscopio.html?id=cw3XGCgUwN71XdlwkUe5";
    document.querySelectorAll("[data-default-microscope-link]").forEach((el) => {
      el.setAttribute("href", defaultHref);
    });
  }

  function applySlides(nextSlides, resetIndexes = false) {
    activeSlides = Array.isArray(nextSlides) ? nextSlides : [];
    if (resetIndexes) {
      vitrineIndex = 0;
      popularStep = 0;
    } else {
      if (vitrineIndex >= activeSlides.length) vitrineIndex = 0;
    }
    renderHeroPlate(Date.now());
    scheduleNextHourRotation();
    renderVitrineSlide(vitrineIndex, true);
    startVitrineTimer();
    renderPopularFilterPills();
    renderPopularGrid(false);
    startPopularRotationTimer();
    updateHomeDynamicMeta();
  }

  // Exposição na API global para filtros e controle de rotação
  window.App = window.App || {};
  window.App.filtrarLaminasHome = function (filtro) {
    popularFilter = filtro || "todas";
    popularStep = 0;
    renderPopularFilterPills();
    renderPopularGrid(false);
    startPopularRotationTimer();
  };

  window.App.rotacionarLaminasPopulares = function (delta = 1) {
    const pool = getFilteredPopularPool();
    if (pool.length < 2) return;
    popularStep += Number(delta) || 1;
    renderPopularGrid(true);
    startPopularRotationTimer();
  };

  // Utilitário seguro apenas para testes locais de regressão (>4 lâminas)
  window.__palasPreviewActiveSlides = function (mockList) {
    if (Array.isArray(mockList)) {
      isOverrideActive = true;
      applySlides(mockList, true);
    } else {
      isOverrideActive = false;
    }
  };

  setupHeroOpticalStage();
  setupVitrine();
  setupPopularSection();

  const unsub = subscribeActiveSlides(({ slides, loaded }) => {
    if (isOverrideActive) return;
    if (!loaded && (!slides || slides.length === 0)) {
      renderVitrineSlide(0, true);
      return;
    }
    applySlides(slides, false);
  });

  window.addEventListener("pagehide", () => {
    clearTimeout(hourlyTimer);
    clearTimeout(popularFadeTimer);
    stopVitrineTimer();
    clearInterval(popularTimer);
    if (typeof unsub === "function") unsub();
  });
}
