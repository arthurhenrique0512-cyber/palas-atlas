import { db } from "./firebase-config.js";

let slidesCache = [];
let isCacheLoaded = false;
let debounceTimer;

export function initGlobalSearch() {
  const searchInput = document.getElementById("global-search-input");
  const searchClear = document.getElementById("global-search-clear");
  const dropdown = document.getElementById("global-search-dropdown");
  const resultsList = document.getElementById("global-search-results");
  const emptyState = document.getElementById("global-search-empty");
  const searchContainer = document.getElementById("global-search-container");

  if (!searchInput) return;

  // Carrega o cache das lâminas ativas ao focar no input pela primeira vez
  const loadCache = async () => {
    if (isCacheLoaded || !db) return;
    try {
      console.log("[SearchEngine] Baixando acervo para busca...");
      const snapshot = await db.collection("laminas").get();
      // Filtra client-side para evitar problemas de índice no Firestore
      slidesCache = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(lamina => lamina.status === "ativa");
      isCacheLoaded = true;
      console.log(`[SearchEngine] ${slidesCache.length} lâminas ativas carregadas no cache.`);
    } catch (e) {
      console.error("[SearchEngine] Erro ao carregar acervo para busca:", e);
    }
  };

  searchInput.addEventListener("focus", loadCache);

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim();
    
    // Toggle botão de clear
    if (term.length > 0) {
      searchClear.classList.remove("hidden");
      searchClear.classList.add("flex");
    } else {
      searchClear.classList.add("hidden");
      searchClear.classList.remove("flex");
      dropdown.classList.add("hidden");
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
      dropdown.classList.add("hidden");
      searchInput.focus();
    });
  }

  // Fechar dropdown clicando fora
  document.addEventListener("click", (e) => {
    if (searchContainer && !searchContainer.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  // Fechar com ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      searchInput.blur();
    }
  });

  function removeAccents(str) {
    if (str === null || str === undefined) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function performSearch(term) {
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
      li.className = "px-4 py-3 hover:bg-zinc-800/80 cursor-pointer border-b border-zinc-800/50 last:border-0 transition-colors flex flex-col gap-1";
      
      const title = slide.nome || slide.titulo || "Lâmina Sem Título";
      const topico = slide.topico || "Geral";
      const coloracao = slide.coloracao || "H&E";

      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-zinc-200 font-medium text-sm">${title}</span>
          <span class="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">${topico}</span>
        </div>
        <div class="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
          ${coloracao}
        </div>
      `;

      li.addEventListener("click", () => {
        // Redireciona direto para o Microscópio
        window.location.href = `microscopio.html?id=${slide.id}`;
      });

      resultsList.appendChild(li);
    });
  }
}
