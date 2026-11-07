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

  // Placeholder Dinâmico e Atalhos de Teclado
  const placeholders = [
    "Buscar tecidos, órgãos ou lâminas em H&E...",
    "Buscar 'Osso Maduro em desgaste'...",
    "Buscar 'Epitélio estratificado pavimentoso'...",
    "Buscar 'Pele Espessa H&E'...",
    "Buscar 'Sistemas de Havers e Ósteons'...",
    "Buscar 'Colorações e técnicas especiais'..."
  ];
  let placeholderIndex = 0;
  let isInputFocused = false;

  const rotatePlaceholder = () => {
    if (isInputFocused || (searchInput && searchInput.value.trim().length > 0)) return;
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
    searchInput.placeholder = placeholders[placeholderIndex];
  };

  const placeholderTimer = setInterval(rotatePlaceholder, 3600);

  // Atalho global ⌘K / Ctrl+K e barra "/"
  document.addEventListener("keydown", (e) => {
    const isEditing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (e.key === "/" && !isEditing) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // Carrega o cache das lâminas ativas ao focar no input pela primeira vez
  const loadCache = async () => {
    if (isCacheLoaded || !db) return;
    try {
      const snapshot = await db.collection("laminas").where("status", "==", "ativa").get();
      slidesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      isCacheLoaded = true;
    } catch (e) {
      console.error("[SearchEngine] Erro ao carregar acervo para busca:", e);
    }
  };

  searchInput.addEventListener("focus", () => {
    isInputFocused = true;
    searchInput.placeholder = "Buscar tecidos, órgãos ou lâminas...";
    loadCache();
  });

  searchInput.addEventListener("blur", () => {
    isInputFocused = false;
    if (!searchInput.value.trim()) {
      searchInput.placeholder = placeholders[placeholderIndex];
    }
  });

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
      li.className = "px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex flex-col gap-1";
      
      const title = slide.nome || slide.titulo || "Lâmina Sem Título";
      const topico = slide.topico || "Geral";
      const coloracao = slide.coloracao || "H&E";

      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-slate-900 font-medium text-sm">${title}</span>
          <span class="text-[10px] bg-sky-50 text-sky-700 border border-sky-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">${topico}</span>
        </div>
        <div class="text-xs text-slate-500 font-sans flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
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
