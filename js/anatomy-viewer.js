import { db } from "./firebase-config.js";

let currentLayers = [];

document.addEventListener("DOMContentLoaded", () => {
  const btnRegioes = document.querySelectorAll(".regiao-btn");
  const carouselContainer = document.getElementById("carouselContainer");
  const btnBackToTop = document.getElementById("btnBackToTop");

  if (carouselContainer && btnBackToTop) {
    carouselContainer.addEventListener("scroll", () => {
      if (carouselContainer.scrollLeft > 300) {
        btnBackToTop.classList.remove("opacity-0", "pointer-events-none");
      } else {
        btnBackToTop.classList.add("opacity-0", "pointer-events-none");
      }
    });
  }

  btnRegioes.forEach(btn => {
    btn.addEventListener("click", () => {
      // Atualiza estilizacao dos botoes
      btnRegioes.forEach(b => {
        b.classList.remove("bg-neutral-800", "text-white");
        b.classList.add("text-neutral-400", "hover:bg-neutral-800/50");
      });
      btn.classList.add("bg-neutral-800", "text-white");
      btn.classList.remove("text-neutral-400", "hover:bg-neutral-800/50");

      const regiao = btn.getAttribute("data-regiao");
      const nomeRegiao = btn.textContent.replace("→", "").trim();
      carregarRegiao(regiao, nomeRegiao);
    });
  });
});

async function carregarRegiao(regiaoId, regiaoNome) {
  const loader = document.getElementById("loaderImg");
  const msgVazio = document.getElementById("msgVazio");
  const carouselContainer = document.getElementById("carouselContainer");

  loader.classList.remove("hidden");
  carouselContainer.classList.add("hidden");
  msgVazio.classList.add("hidden");
  
  const startTime = Date.now();
  try {
    const snapshot = await db.collection("anatomia_pecas")
      .where("regiao", "==", regiaoId)
      .orderBy("ordemDissecacao", "asc")
      .get();

    currentLayers = [];
    snapshot.forEach(doc => {
      currentLayers.push({ id: doc.id, ...doc.data() });
    });

    if (currentLayers.length === 0) {
      msgVazio.textContent = "Nenhuma camada de dissecação cadastrada para esta região.";
      msgVazio.classList.remove("hidden");
    } else {
      msgVazio.classList.add("hidden");
      renderAllLayers(regiaoNome);
    }
  } catch (error) {
    console.error("Erro ao carregar região de anatomia:", error);
    msgVazio.textContent = "Erro de conexão ao carregar o atlas.";
    msgVazio.classList.remove("hidden");
  } finally {
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, 3000 - elapsed); // Garante no min 3 segundos
    setTimeout(() => {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(() => {
        loader.classList.add("hidden");
        loader.style.opacity = '';
        loader.style.pointerEvents = '';
      }, 1000);
    }, remainingTime);
  }
}

function renderAllLayers(regiaoNome) {
  const container = document.getElementById("carouselContainer");
  container.innerHTML = "";
  
  currentLayers.forEach((layer, index) => {
    const page = document.createElement("div");
    page.className = "flex-none w-full snap-center flex flex-col items-center justify-start py-10 px-4 sm:px-8";

    // Trata quebras de linha na legenda
    let legendaFormatada = layer.legenda || "";
    if (legendaFormatada.includes("\n") && !legendaFormatada.includes("<p>")) {
      legendaFormatada = legendaFormatada.split("\n").map(linha => {
        if (linha.trim()) return `<p class="mb-2">${linha}</p>`;
        return "";
      }).join("");
    }
    
    // Fallback image in case of error
    const fallbackImg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U1ZTQiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzcyNzE3YSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTRweCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2VtIEluZGlzcG9uw612ZWw8L3RleHQ+PC9zdmc+";

    const titleText = `${regiaoNome} — Camada ${index + 1}`;

    page.innerHTML = \`
      <h2 class="text-2xl font-bold text-neutral-900 mb-6 text-center">\${titleText}</h2>
      <img src="\${layer.imagemUrl}" alt="Dissecação \${titleText}" onerror="this.src='\${fallbackImg}'" class="max-w-full max-h-[60vh] object-contain mb-8">
      <div class="text-neutral-800 text-base leading-relaxed max-w-3xl w-full bg-gray-50/80 border border-gray-200 p-6 rounded-lg">
        \${legendaFormatada || "Sem legenda estrutural."}
      </div>
    \`;

    container.appendChild(page);
  });

  container.classList.remove("hidden");
  
  // Reseta o scroll para o começo
  setTimeout(() => {
    container.scrollLeft = 0;
  }, 50);
}
