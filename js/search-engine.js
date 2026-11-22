import { db } from "./firebase-config.js";
import { escaparHTML } from "./sanitizer.js";
import { catalogData } from "./catalog-data.js?v=20261118v3";

let slidesCache = [];
let isCacheLoaded = false;
let debounceTimer;

export function invalidarCacheBusca() {
  slidesCache = [];
  isCacheLoaded = false;
}

function getEstaticasCatalogo() {
  const lista = [];
  Object.values(catalogData || {}).forEach((disc) => {
    (disc.topicos || []).forEach((t) => {
      (t.laminasEstaticas || t.laminas || []).forEach((lam) => {
        if (lam && lam.id) lista.push(lam);
      });
    });
  });
  return lista;
}

export function initGlobalSearch() {
  const searchInput = document.getElementById("global-search-input");
  const searchClear = document.getElementById("global-search-clear");
  const dropdown = document.getElementById("global-search-dropdown");
  const resultsList = document.getElementById("global-search-results");
  const emptyState = document.getElementById("global-search-empty");
  const searchContainer = document.getElementById("global-search-container");

  if (!searchInput) return;

  // Carrega o cache das lâminas ativas (Firestore + fallback estático do catálogo) ao focar pela primeira vez
  const loadCache = async () => {
    if (isCacheLoaded) return;
    const estaticas = getEstaticasCatalogo();
    const mapa = new Map();
    estaticas.forEach((s) => mapa.set(String(s.id), s));

    if (typeof db !== "undefined" && db) {
      try {
        const snapshot = await Promise.race([
          db.collection("laminas").where("status", "==", "ativa").get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
        ]);
        snapshot.docs.forEach((doc) => mapa.set(String(doc.id), { id: doc.id, ...doc.data() }));
        isCacheLoaded = true;
      } catch (e) {
        isCacheLoaded = true;
        console.warn("[SearchEngine] Usando fallback estático para busca:", e.message || e);
      }
    } else {
      isCacheLoaded = true;
    }
    slidesCache = Array.from(mapa.values());
  };

  searchInput.addEventListener("focus", loadCache);

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim();
    
    // Toggle botão de clear
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
      // Se por acaso o usuário digitar rápido demais antes do focus carregar
      if (!isCacheLoaded) await loadCache();
      performSearch(term);
    }, 300);
  });

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.classList.add("hidden");
      searchClear.classList.remove("flex");
      if (dropdown) dropdown.classList.add("hidden");
      searchInput.focus();
    });
  }

  // Fechar dropdown clicando fora
  document.addEventListener("click", (e) => {
    if (dropdown && searchContainer && !searchContainer.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  // Fechar com ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (dropdown) dropdown.classList.add("hidden");
      searchInput.blur();
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

    const matches = slidesCache.filter(slide => {
      const nome = removeAccents(slide.nome || slide.titulo);
      const topico = removeAccents(slide.topico);
      const disciplina = removeAccents(slide.disciplina);
      const coloracao = removeAccents(slide.coloracao);

      return nome.includes(normalizedTerm) || 
             topico.includes(normalizedTerm) || 
             disciplina.includes(normalizedTerm) || 
             coloracao.includes(normalizedTerm);
    });

    renderResults(matches, term);
  }

  function renderResults(matches, term) {
    if (!resultsList || !emptyState) return;
    resultsList.innerHTML = "";
    
    if (matches.length === 0) {
      emptyState.textContent = `Nenhuma lâmina encontrada para '${term}'`;
      emptyState.classList.remove("hidden");
      resultsList.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    resultsList.classList.remove("hidden");

    matches.forEach(slide => {
      const li = document.createElement("li");
      li.className = "px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex flex-col gap-1";
      
      const title = slide.nome || slide.titulo || "Lâmina Sem Título";
      const topico = slide.topico || "Geral";
      const coloracao = slide.coloracao || "H&E";

      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-slate-900 font-medium text-sm">${escaparHTML(title)}</span>
          <span class="text-[10px] bg-sky-50 text-sky-700 border border-sky-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">${escaparHTML(topico)}</span>
        </div>
        <div class="text-xs text-slate-500 font-sans flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
          <span>${escaparHTML(coloracao)}</span>
        </div>
      `;

      li.addEventListener("click", () => {
        // Redireciona direto para o Microscópio
        window.location.href = `microscopio.html?id=${encodeURIComponent(String(slide.id || ""))}`;
      });

      resultsList.appendChild(li);
    });
  }
}
