import { db } from "./firebase-config.js";
import { escaparHTML } from "./sanitizer.js";
import {
  subscribeActiveSlides,
  getActiveSlides,
  isActiveSlidesLoaded,
  normalizeActiveSlide
} from "./active-slides-store.js?v=20261123v1";

let slidesCache = [];
let isCacheLoaded = false;
let debounceTimer;
let _unsubStore = null;

export function invalidarCacheBusca() {
  isCacheLoaded = false;
  slidesCache = getActiveSlides();
}

export function initGlobalSearch() {
  const searchInput = document.getElementById("global-search-input");
  const searchClear = document.getElementById("global-search-clear");
  const dropdown = document.getElementById("global-search-dropdown");
  const resultsList = document.getElementById("global-search-results");
  const emptyState = document.getElementById("global-search-empty");
  const searchContainer = document.getElementById("global-search-container");
  const searchKbd = document.getElementById("global-search-kbd");

  if (!searchInput) return;

  if (_unsubStore) {
    try {
      _unsubStore();
    } catch (e) {}
  }
  _unsubStore = subscribeActiveSlides(({ slides, loaded }) => {
    slidesCache = Array.isArray(slides) ? slides : [];
    if (loaded) isCacheLoaded = true;
    if (dropdown && !dropdown.classList.contains("hidden")) {
      const currentTerm = searchInput.value.trim();
      if (currentTerm.length >= 2) {
        performSearch(currentTerm);
      }
    }
  });

  const atualizarKbd = () => {
    if (!searchKbd) return;
    const oculto = document.activeElement === searchInput || searchInput.value.trim().length > 0;
    searchKbd.classList.toggle("opacity-0", oculto);
  };

  // Garante sincronização apenas de lâminas com status === "ativa" no Firestore
  const loadCache = async () => {
    if (isActiveSlidesLoaded()) {
      slidesCache = getActiveSlides();
      isCacheLoaded = true;
      return;
    }
    if (isCacheLoaded) return;

    if (typeof db !== "undefined" && db) {
      try {
        const snapshot = await Promise.race([
          db.collection("laminas").where("status", "==", "ativa").get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
        ]);
        const list = [];
        snapshot.docs.forEach((doc) => {
          const item = normalizeActiveSlide(doc.id, doc.data());
          if (item) list.push(item);
        });
        slidesCache = list;
        isCacheLoaded = true;
      } catch (e) {
        slidesCache = getActiveSlides();
        isCacheLoaded = true;
        console.warn("[SearchEngine] Falha ao consultar lâminas ativas:", e.message || e);
      }
    } else {
      slidesCache = getActiveSlides();
      isCacheLoaded = true;
    }
  };

  searchInput.addEventListener("focus", () => {
    atualizarKbd();
    loadCache();
  });
  searchInput.addEventListener("blur", atualizarKbd);

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim();
    atualizarKbd();

    if (term.length > 0) {
      if (searchClear) {
        searchClear.classList.remove("hidden");
        searchClear.classList.add("flex");
      }
    } else {
      if (searchClear) {
        searchClear.classList.add("hidden");
        searchClear.classList.remove("flex");
      }
      if (dropdown) dropdown.classList.add("hidden");
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!isCacheLoaded) await loadCache();
      performSearch(term);
    }, 220);
  });

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.classList.add("hidden");
      searchClear.classList.remove("flex");
      if (dropdown) dropdown.classList.add("hidden");
      searchInput.focus();
      atualizarKbd();
    });
  }

  document.addEventListener("click", (e) => {
    if (dropdown && searchContainer && !searchContainer.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ativo = document.activeElement;
      const tag = ativo ? ativo.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ativo?.isContentEditable) return;
      const pgHome = document.getElementById("pgHome");
      if (pgHome && pgHome.classList.contains("hidden")) return;
      e.preventDefault();
      const rect = searchInput.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
        searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          searchInput.focus({ preventScroll: true });
          atualizarKbd();
        }, 120);
      } else {
        searchInput.focus();
        atualizarKbd();
      }
      return;
    }

    if (e.key === "Escape") {
      if (dropdown) dropdown.classList.add("hidden");
      if (document.activeElement === searchInput) {
        searchInput.blur();
        atualizarKbd();
      }
    }
  });

  function removeAccents(str) {
    if (str === null || str === undefined) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function performSearch(term) {
    if (!dropdown) return;
    if (term.length < 2) {
      dropdown.classList.add("hidden");
      return;
    }

    dropdown.classList.remove("hidden");
    const normalizedTerm = removeAccents(term);

    const matches = slidesCache.filter((slide) => {
      const nome = removeAccents(slide.nome);
      const topico = removeAccents(slide.topicoLabel || slide.topico);
      const disciplina = removeAccents(slide.disciplinaLabel || slide.disciplina);
      const coloracao = removeAccents(slide.stainBadge || slide.coloracao);

      return (
        nome.includes(normalizedTerm) ||
        topico.includes(normalizedTerm) ||
        disciplina.includes(normalizedTerm) ||
        coloracao.includes(normalizedTerm)
      );
    });

    renderResults(matches, term);
  }

  function renderResults(matches, term) {
    if (!resultsList || !emptyState) return;
    resultsList.innerHTML = "";

    if (matches.length === 0) {
      emptyState.innerHTML = `<p class="text-slate-700 text-sm font-medium">Nenhuma lâmina encontrada para &ldquo;${escaparHTML(term)}&rdquo;</p><p class="text-slate-400 text-xs mt-1">Tente buscar por &ldquo;osso&rdquo;, &ldquo;pele&rdquo; ou &ldquo;H&amp;E&rdquo;.</p>`;
      emptyState.classList.remove("hidden");
      resultsList.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    resultsList.classList.remove("hidden");

    matches.forEach((slide) => {
      const li = document.createElement("li");
      li.className = "px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex flex-col gap-1";

      const title = slide.nome || "Lâmina";
      const topico = slide.topicoShort || slide.topicoLabel || slide.topico || "Histologia";
      const coloracao = slide.stainBadge || slide.coloracao || "Histologia";

      li.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-900 font-medium text-sm">${escaparHTML(title)}</span>
          <span class="text-[10px] bg-teal-50 text-teal-800 border border-teal-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold shrink-0">${escaparHTML(topico)}</span>
        </div>
        <div class="text-xs text-slate-500 font-sans flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
          <span>${escaparHTML(coloracao)}</span>
        </div>
      `;

      li.addEventListener("click", () => {
        window.location.href = `microscopio.html?id=${encodeURIComponent(String(slide.id || ""))}`;
      });

      resultsList.appendChild(li);
    });
  }
}
