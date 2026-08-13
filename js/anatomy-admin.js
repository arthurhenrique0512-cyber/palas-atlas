import { db } from "./firebase-config.js";

// Variável para armazenar o listener do onSnapshot para podermos cancelar se precisar
let unsubscribeAnatomia = null;
let currentCamadasAnatomia = [];

document.addEventListener("DOMContentLoaded", () => {
  // Inicialização apenas se estiver na página index.html com o form de anatomia
  const btnSalvar = document.getElementById("btnSalvarAnatomia");
  if (!btnSalvar) return;

  btnSalvar.addEventListener("click", salvarCamadaAnatomia);
  
  const filtroRegiao = document.getElementById("filtroRegiaoAnatomia");
  if (filtroRegiao) {
    filtroRegiao.addEventListener("change", (e) => {
      carregarTabelaAnatomia(e.target.value);
    });
  }

  // Carrega a tabela inicialmente para todas as regiões (ou a padrão)
  carregarTabelaAnatomia("todas");
});

async function salvarCamadaAnatomia() {
  const btn = document.getElementById("btnSalvarAnatomia");
  const idEmEdicao = document.getElementById("anaIdEmEdicao").value;
  
  const regiao = document.getElementById("anaRegiao").value;
  const imagemUrl = document.getElementById("anaImgUrl").value.trim();
  const ordemDissecacao = parseInt(document.getElementById("anaOrdem").value.trim(), 10);
  const legenda = document.getElementById("anaLegenda").value.trim();

  if (!imagemUrl || isNaN(ordemDissecacao)) {
    alert("Preencha a URL da imagem e a Ordem de Dissecação!");
    return;
  }

  const payload = {
    regiao,
    imagemUrl,
    ordemDissecacao,
    legenda,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };

  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    if (idEmEdicao) {
      await db.collection("anatomia_pecas").doc(idEmEdicao).update(payload);
      alert("Camada atualizada com sucesso!");
    } else {
      payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("anatomia_pecas").add(payload);
      alert("Nova camada de anatomia cadastrada com sucesso!");
    }
    limparFormularioAnatomia();
  } catch (error) {
    console.error("Erro ao salvar anatomia:", error);
    alert("Erro ao salvar: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar Camada Cadavérica";
  }
}

function carregarTabelaAnatomia(filtroRegiao) {
  const tbody = document.getElementById("tabelaAnatomiaCms");
  if (!tbody) return;

  if (unsubscribeAnatomia) {
    unsubscribeAnatomia();
  }

  let query = db.collection("anatomia_pecas");
  if (filtroRegiao !== "todas") {
    query = query.where("regiao", "==", filtroRegiao);
  }
  
  // Ordena sempre pela região primeiro (se não estiver filtrando) e depois pela ordem
  if (filtroRegiao === "todas") {
    query = query.orderBy("regiao", "asc").orderBy("ordemDissecacao", "asc");
  } else {
    query = query.orderBy("ordemDissecacao", "asc");
  }

  unsubscribeAnatomia = query.onSnapshot((snapshot) => {
    currentCamadasAnatomia = [];
    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-4"><div class="p-8 text-center border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">Nenhuma camada de dissecação cadastrada para esta região.</div></td></tr>`;
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      currentCamadasAnatomia.push({ id: doc.id, ...data });
    });

    currentCamadasAnatomia.forEach((camada, index) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-neutral-800/30 transition-colors group";

      // Botões de subir/descer ficam ativos/inativos dependendo da posição na mesma região
      const isFirst = index === 0 || currentCamadasAnatomia[index - 1].regiao !== camada.regiao;
      const isLast = index === currentCamadasAnatomia.length - 1 || currentCamadasAnatomia[index + 1].regiao !== camada.regiao;

      tr.innerHTML = `
        <td class="py-3 px-4 text-center font-mono text-emerald-400">
          <div class="flex items-center justify-center gap-1">
            <span class="w-6">${camada.ordemDissecacao}</span>
            <div class="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="window.AppAnatomia.subirOrdem('${camada.id}', ${index})" class="text-neutral-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed p-0.5" ${isFirst ? 'disabled' : ''}>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>
              <button onclick="window.AppAnatomia.descerOrdem('${camada.id}', ${index})" class="text-neutral-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed p-0.5" ${isLast ? 'disabled' : ''}>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 capitalize">${camada.regiao.replace('-', ' ')}</td>
        <td class="py-3 px-4 max-w-[200px] truncate text-xs font-mono text-neutral-400" title="${camada.imagemUrl}">${camada.imagemUrl.split('/').pop()}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="window.AppAnatomia.editarCamada('${camada.id}')" class="text-blue-400 hover:text-blue-300 text-xs font-medium mr-3">Editar</button>
          <button onclick="window.AppAnatomia.excluirCamada('${camada.id}')" class="text-red-400 hover:text-red-300 text-xs font-medium">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }, (error) => {
    console.error("Erro no listener de anatomia:", error);
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-xs text-red-500">Erro ao carregar dados.</td></tr>`;
  });
}

function limparFormularioAnatomia() {
  document.getElementById("anaIdEmEdicao").value = "";
  document.getElementById("anaImgUrl").value = "";
  document.getElementById("anaLegenda").value = "";
  document.getElementById("anaOrdem").value = "";
  document.getElementById("btnSalvarAnatomia").textContent = "Salvar Camada Cadavérica";
}

async function subirOrdem(docId, indexAtual) {
  if (indexAtual <= 0) return;
  const camadaAtual = currentCamadasAnatomia[indexAtual];
  const camadaAcima = currentCamadasAnatomia[indexAtual - 1];

  if (camadaAtual.regiao !== camadaAcima.regiao) return;

  // Troca os números de ordem de dissecação
  const ordemAtual = camadaAtual.ordemDissecacao;
  const ordemAcima = camadaAcima.ordemDissecacao;

  try {
    const batch = db.batch();
    batch.update(db.collection("anatomia_pecas").doc(camadaAtual.id), { ordemDissecacao: ordemAcima });
    batch.update(db.collection("anatomia_pecas").doc(camadaAcima.id), { ordemDissecacao: ordemAtual });
    await batch.commit();
  } catch (error) {
    console.error("Erro ao subir ordem:", error);
    alert("Falha ao reordenar.");
  }
}

async function descerOrdem(docId, indexAtual) {
  if (indexAtual >= currentCamadasAnatomia.length - 1) return;
  const camadaAtual = currentCamadasAnatomia[indexAtual];
  const camadaAbaixo = currentCamadasAnatomia[indexAtual + 1];

  if (camadaAtual.regiao !== camadaAbaixo.regiao) return;

  const ordemAtual = camadaAtual.ordemDissecacao;
  const ordemAbaixo = camadaAbaixo.ordemDissecacao;

  try {
    const batch = db.batch();
    batch.update(db.collection("anatomia_pecas").doc(camadaAtual.id), { ordemDissecacao: ordemAbaixo });
    batch.update(db.collection("anatomia_pecas").doc(camadaAbaixo.id), { ordemDissecacao: ordemAtual });
    await batch.commit();
  } catch (error) {
    console.error("Erro ao descer ordem:", error);
    alert("Falha ao reordenar.");
  }
}

function editarCamada(docId) {
  const camada = currentCamadasAnatomia.find(c => c.id === docId);
  if (!camada) return;

  document.getElementById("anaIdEmEdicao").value = camada.id;
  document.getElementById("anaRegiao").value = camada.regiao;
  document.getElementById("anaImgUrl").value = camada.imagemUrl;
  document.getElementById("anaOrdem").value = camada.ordemDissecacao;
  document.getElementById("anaLegenda").value = camada.legenda || "";
  
  document.getElementById("btnSalvarAnatomia").textContent = "Atualizar Camada Cadavérica";
  
  // Rola suavemente para o topo do form
  document.getElementById("topicoCmsAnatomia").scrollIntoView({ behavior: 'smooth' });
}

async function excluirCamada(docId) {
  if (!confirm("Tem certeza que deseja excluir esta camada da dissecação?")) return;
  try {
    await db.collection("anatomia_pecas").doc(docId).delete();
  } catch (error) {
    console.error("Erro ao excluir camada:", error);
    alert("Erro ao excluir.");
  }
}

// Expondo globalmente para os botões do HTML chamarem
window.AppAnatomia = {
  subirOrdem,
  descerOrdem,
  editarCamada,
  excluirCamada
};
