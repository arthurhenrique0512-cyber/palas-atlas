/**
 * Gerenciador de Estado Global Reativo (Store)
 * Controla o fluxo da disciplina ativa e notifica os componentes de IU cadastrados.
 */

const listeners = new Set();

const state = {
  frenteAtiva: null // Valores aceitos: 'anatomia' | 'histologia' | null
};

/**
 * Registra um ouvinte para receber atualizações do estado da aplicação.
 * @param {Function} callback - Função que será invocada sempre que o estado sofrer mutação.
 * @returns {Function} Função de cancelamento da inscrição (unsubscribe).
 */
export function subscribe(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Notifica de forma sincrônica todos os módulos inscritos no estado.
 */
function notify() {
  const immutableState = getState();
  listeners.forEach((callback) => {
    try {
      callback(immutableState);
    } catch (error) {
      console.error("Erro na execução do callback de estado:", error);
    }
  });
}

/**
 * Altera a frente ativa no sistema e dispara os eventos de notificação.
 * @param {string|null} frente - Identificador da frente ('anatomia', 'histologia' ou null).
 */
export function setFrenteAtiva(frente) {
  if (state.frenteAtiva === frente) return;
  state.frenteAtiva = frente;
  notify();
}

/**
 * Retorna uma cópia imutável do estado atual.
 * @returns {Object} Representação congelada de state.
 */
export function getState() {
  return Object.freeze({ ...state });
}
