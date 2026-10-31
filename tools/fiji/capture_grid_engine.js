/**
 * ==============================================================================
 * Palas Atlas - Motor de Navegação e Grade de Captura (Microscopia)
 * ==============================================================================
 * Suporta:
 * 1. Modo Descoberta (Y Fixo, X Dinâmico infinito com serpente vertical).
 * 2. Modo Fixo Tradicional (X e Y predefinidos).
 * 3. Cálculos de percurso em serpente: Snake by Columns (Down & Right).
 * 4. Diagnóstico matemático de fechamento de matriz para o Fiji Grid Stitching.
 *    (A geração de comandos PowerShell e macros Fiji é responsabilidade exclusiva
 *     do CommandGenerator em bench-copilot.js).
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PalasGridEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  class CaptureGridEngine {
    constructor(options = {}) {
      this.mode = options.mode || 'dynamic'; // 'dynamic' | 'fixed'
      this.rowsY = Math.max(1, parseInt(options.rowsY, 10) || 6);
      this.fixedColsX = Math.max(1, parseInt(options.fixedColsX, 10) || 3);
      this.overlapPercent = Math.max(5, Math.min(40, parseInt(options.overlapPercent, 10) || 15));
      this.photoPrefix = options.photoPrefix || 'osso_maduro';

      this.currentStep = 0; // 0-indexed: índice do campo atual no visor (e total já capturado antes de concluir)
      this.maxStepReached = 0;
      this.history = []; // registros de fotos efetivamente disparadas com timestamp
      this.isFinished = false;
    }

    /**
     * Define o modo de operação ('dynamic' ou 'fixed')
     */
    setMode(mode) {
      if (mode !== 'dynamic' && mode !== 'fixed') {
        throw new Error(`Modo inválido: ${mode}. Use 'dynamic' ou 'fixed'.`);
      }
      this.mode = mode;
      if (mode === 'dynamic') {
        this.isFinished = false;
      }
      return this;
    }

    /**
     * Atualiza as dimensões configuradas
     */
    setDimensions({ rowsY, fixedColsX }) {
      if (rowsY !== undefined) {
        this.rowsY = Math.max(1, parseInt(rowsY, 10) || 1);
      }
      if (fixedColsX !== undefined) {
        this.fixedColsX = Math.max(1, parseInt(fixedColsX, 10) || 1);
      }
      return this;
    }

    /**
     * Quantidade total de fotos efetivamente capturadas até o momento
     */
    get totalCaptured() {
      if (this.mode === 'fixed' && this.isFinished) {
        return this.fixedColsX * this.rowsY;
      }
      return this.currentStep;
    }

    /**
     * Quantidade total de colunas visíveis/ativas na grade
     */
    get activeCols() {
      if (this.mode === 'fixed') {
        return this.fixedColsX;
      }
      const colFromCurrent = Math.floor(this.currentStep / this.rowsY);
      const colFromMax = Math.floor(this.maxStepReached / this.rowsY);
      return Math.max(1, colFromCurrent + 1, colFromMax + 1);
    }

    /**
     * Total de fotos estimadas (no modo fixo) ou planejadas até a coluna ativa
     */
    get totalPhotosExpected() {
      if (this.mode === 'fixed') {
        return this.fixedColsX * this.rowsY;
      }
      return Math.max(this.currentStep + 1, this.maxStepReached + 1);
    }

    /**
     * Calcula as coordenadas e a direção óptica de alinhamento para qualquer passo (0-indexed).
     *
     * Regra Fiji: Snake by Columns (Down & Right)
     * - Coluna par (0, 2, 4...): Desce (y = 0 -> rowsY - 1)
     * - Transição de coluna (stepInCol === 0 para col > 0): Move à DIREITA (x -> x + 1, mesmo y)
     * - Coluna ímpar (1, 3, 5...): Sobe (y = rowsY - 1 -> 0)
     *
     * IMPORTANTE:
     * `action` representa o movimento do charriot que o microscopista executa PARA ALINHAR
     * este campo (`stepIndex`) em relação à foto anterior (`stepIndex - 1`), garantindo 100%
     * de sincronia entre o comando de voz, o card da UI e a borda projetada pelo Onion Skin.
     */
    getStepInfo(stepIndex) {
      const Y = this.rowsY;
      const safeIndex = Math.max(0, stepIndex);
      const col = Math.floor(safeIndex / Y);
      const stepInCol = safeIndex % Y;
      const isGoingDown = (col % 2 === 0);
      const row = isGoingDown ? stepInCol : (Y - 1 - stepInCol);
      const stepNum = safeIndex + 1;
      const isLastInCol = (stepInCol === Y - 1);
      const isFirstInCol = (stepInCol === 0);

      const maxFixedSteps = this.fixedColsX * Y;
      const isLastOverall = (this.mode === 'fixed' && safeIndex === (maxFixedSteps - 1));

      // Direção de entrada: como o charriot se moveu de (stepIndex - 1) para (stepIndex)
      let entryDirection = 'START';
      if (safeIndex === 0) {
        entryDirection = 'START';
      } else if (isFirstInCol) {
        entryDirection = 'RIGHT';
      } else if (isGoingDown) {
        entryDirection = 'DOWN';
      } else {
        entryDirection = 'UP';
      }

      // Direção de saída: o que acontecerá após capturar este passo
      let nextDirection = 'DOWN';
      if (isLastOverall) {
        nextDirection = 'FINISH';
      } else if (isLastInCol) {
        nextDirection = 'RIGHT';
      } else if (isGoingDown) {
        nextDirection = 'DOWN';
      } else {
        nextDirection = 'UP';
      }

      let action = entryDirection;
      let icon = '⬇️';
      let title = 'Desça na Vertical';
      let desc = `Mova o charriot para BAIXO alinhando com a faixa fantasma no topo (${this.overlapPercent}%) e dispare a Foto ${stepNum}.`;
      let audioCue = 'Desça';

      if (this.mode === 'fixed' && this.isFinished && safeIndex === maxFixedSteps - 1) {
        action = 'FINISH';
        icon = '🎉';
        title = 'Varredura Concluída!';
        desc = `Todas as ${maxFixedSteps} fotos da grade ${this.fixedColsX}×${Y} foram registradas. Gere o manifesto ou os scripts do Fiji.`;
        audioCue = 'Varredura concluída';
      } else if (safeIndex === 0) {
        action = 'START';
        icon = '🎯';
        title = '1º Campo • Topo Esquerdo';
        desc = `Enquadre o canto superior esquerdo do tecido, trave foco/exposição e dispare a Foto 1 (depois desça na Coluna 1).`;
        audioCue = 'Primeiro campo, topo esquerdo';
      } else if (entryDirection === 'RIGHT') {
        action = 'RIGHT';
        icon = '➡️';
        title = `Mova para a DIREITA (Col ${col + 1})`;
        desc = `Fim da Coluna ${col}! Mova 1 campo para a DIREITA alinhando com a borda esquerda (${this.overlapPercent}% overlap) para iniciar a Coluna ${col + 1}.`;
        audioCue = 'Vire à direita';
      } else if (entryDirection === 'UP') {
        action = 'UP';
        icon = '⬆️';
        title = isLastInCol ? `Suba • Topo da Coluna ${col + 1}` : 'Suba na Vertical';
        desc = `Mova o charriot para CIMA alinhando com a faixa fantasma na base (${this.overlapPercent}% overlap) e dispare a Foto ${stepNum}.`;
        audioCue = 'Suba';
      } else {
        action = 'DOWN';
        icon = '⬇️';
        title = isLastInCol ? `Desça • Base da Coluna ${col + 1}` : 'Desça na Vertical';
        desc = `Mova o charriot para BAIXO alinhando com a faixa fantasma no topo (${this.overlapPercent}% overlap) e dispare a Foto ${stepNum}.`;
        audioCue = 'Desça';
      }

      return {
        stepIndex: safeIndex,
        stepNum,
        col,                 // 0-indexed (Coluna 0 = Coluna 1 para o usuário)
        row,                 // 0-indexed (Linha 0 = topo)
        colUser: col + 1,    // 1-indexed
        rowUser: row + 1,    // 1-indexed
        stepInCol,           // Passo dentro da coluna (0 a Y - 1)
        stepInColUser: stepInCol + 1,
        isGoingDown,
        isLastInCol,
        isFirstInCol,
        isLastOverall,
        entryDirection,      // 'START' | 'DOWN' | 'UP' | 'RIGHT'
        nextDirection,       // 'DOWN' | 'UP' | 'RIGHT' | 'FINISH'
        action,              // 'START' | 'DOWN' | 'UP' | 'RIGHT' | 'FINISH'
        icon,
        title,
        desc,
        audioCue
      };
    }

    /**
     * Retorna os dados do passo ativo atual
     */
    getCurrentStepInfo() {
      return this.getStepInfo(this.currentStep);
    }

    /**
     * Registra a captura do passo atual e avança para o próximo passo
     */
    next() {
      if (this.mode === 'fixed' && this.isFinished) {
        return this.getCurrentStepInfo();
      }

      const current = this.getCurrentStepInfo();
      this.history.push({
        stepIndex: current.stepIndex,
        stepNum: current.stepNum,
        col: current.col,
        row: current.row,
        action: current.action,
        timestamp: Date.now()
      });

      if (this.mode === 'fixed') {
        const maxSteps = this.fixedColsX * this.rowsY;
        if (this.currentStep >= maxSteps - 1) {
          this.isFinished = true;
          this.maxStepReached = Math.max(this.maxStepReached, this.currentStep);
          return this.getCurrentStepInfo();
        }
      }

      this.currentStep++;
      if (this.currentStep > this.maxStepReached) {
        this.maxStepReached = this.currentStep;
      }

      return this.getCurrentStepInfo();
    }

    /**
     * Retorna ao passo anterior (desfazer)
     */
    prev() {
      if (this.mode === 'fixed' && this.isFinished) {
        this.isFinished = false;
        this.history.pop();
        return this.getCurrentStepInfo();
      }
      if (this.currentStep > 0) {
        this.currentStep--;
        this.isFinished = false;
        if (this.history.length > this.currentStep) {
          this.history.length = this.currentStep;
        }
      }
      return this.getCurrentStepInfo();
    }

    /**
     * Salta diretamente para um passo específico
     */
    goToStep(index) {
      if (index < 0) return this.getCurrentStepInfo();
      if (this.mode === 'fixed') {
        const maxSteps = this.fixedColsX * this.rowsY;
        if (index >= maxSteps) return this.getCurrentStepInfo();
      }
      this.isFinished = false;
      this.currentStep = index;
      if (this.currentStep > this.maxStepReached) {
        this.maxStepReached = this.currentStep;
      }
      return this.getCurrentStepInfo();
    }

    /**
     * Reinicia toda a contagem
     */
    reset() {
      this.currentStep = 0;
      this.maxStepReached = 0;
      this.history = [];
      this.isFinished = false;
      return this.getCurrentStepInfo();
    }

    /**
     * Gera a matriz 2D completa das células para renderização na UI
     * Retorna um array de linhas (tamanho rowsY), onde cada linha é um array de colunas (tamanho activeCols)
     */
    getMatrix() {
      const Y = this.rowsY;
      const X = this.activeCols;
      const matrix = Array.from({ length: Y }, () => Array(X).fill(null));
      const capturedTotal = this.totalCaptured;

      const totalStepsInActiveGrid = X * Y;
      for (let s = 0; s < totalStepsInActiveGrid; s++) {
        const info = this.getStepInfo(s);
        if (info.col < X && info.row < Y) {
          const isCompleted = this.isFinished ? (s < capturedTotal) : (s < this.currentStep);
          const isCurrent = !this.isFinished && (s === this.currentStep);
          matrix[info.row][info.col] = {
            ...info,
            isCurrent,
            isCompleted,
            isUpcoming: !isCompleted && !isCurrent
          };
        }
      }

      return {
        rows: Y,
        cols: X,
        grid: matrix
      };
    }

    /**
     * Diagnóstico matemático de finalização de lâmina.
     * Analisa se as fotos efetivamente capturadas formam um retângulo completo
     * ou se a última coluna ficou incompleta.
     */
    getCompletionSummary() {
      const Y = this.rowsY;
      const actualCaptured = this.totalCaptured;
      // Se o usuário abrir o diagnóstico antes de disparar fotos, considera a grade configurada como preview
      const effectivePhotos = actualCaptured > 0
        ? actualCaptured
        : (this.mode === 'fixed' ? this.fixedColsX * Y : Y);

      const fullCols = Math.floor(effectivePhotos / Y);
      const remainder = effectivePhotos % Y;
      const totalColsTouched = Math.max(1, Math.ceil(effectivePhotos / Y));
      const isRectangular = (actualCaptured > 0 && remainder === 0);
      const missingInLastCol = remainder === 0 ? 0 : (Y - remainder);

      // Parâmetros geométricos recomendados para o Fiji
      const gridX = remainder === 0 ? Math.max(1, fullCols) : totalColsTouched;
      const gridY = Y;
      const expectedTotalPhotos = gridX * gridY;

      return {
        photoPrefix: this.photoPrefix,
        photoPattern: `${this.photoPrefix}_{i}.jpg`,
        totalPhotosCaptured: actualCaptured,
        effectivePhotos,
        rowsY: Y,
        fullCols,
        remainder,
        totalColsTouched,
        isRectangular,
        missingInLastCol,
        gridX,
        gridY,
        expectedTotalPhotos,
        overlapPercent: this.overlapPercent,
        solutions: (actualCaptured === 0 || isRectangular) ? [] : [
          {
            id: 'complete_scan',
            title: `Continuar no microscópio (+${missingInLastCol} ${missingInLastCol === 1 ? 'foto' : 'fotos'})`,
            desc: `Capture mais ${missingInLastCol} ${missingInLastCol === 1 ? 'campo' : 'campos'} na Coluna ${totalColsTouched} (mesmo em fundo claro) para fechar a matriz ${gridX}×${gridY} perfeitamente.`,
            recommended: true
          },
          {
            id: 'dummy_fill',
            title: `Preencher ${missingInLastCol} ${missingInLastCol === 1 ? 'arquivo faltante' : 'arquivos faltantes'} via PowerShell (Dummy Fill)`,
            desc: `Duplica a última foto (${this.photoPrefix}_${actualCaptured}.jpg) até ${this.photoPrefix}_${expectedTotalPhotos}.jpg para o Fiji não abortar por arquivo ausente.`,
            recommended: false
          },
          {
            id: 'drop_incomplete',
            title: `Usar apenas ${fullCols} ${fullCols === 1 ? 'coluna completa' : 'colunas completas'} (${fullCols * Y} fotos)`,
            desc: fullCols > 0
              ? `Configure Grid Size X = ${fullCols} no Fiji e ignore as últimas ${remainder} fotos da Coluna ${totalColsTouched}.`
              : `A 1ª coluna ainda possui apenas ${remainder} de ${Y} fotos. Capture pelo menos ${missingInLastCol} fotos adicionais.`,
            recommended: false
          }
        ]
      };
    }

    /**
     * Exporta manifesto da sessão em formato JSON
     */
    exportManifest(extraCommands = {}) {
      const summary = this.getCompletionSummary();
      return {
        app: 'Palas Atlas Capture Assistant',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        mode: this.mode,
        config: {
          photoPrefix: this.photoPrefix,
          rowsY: this.rowsY,
          colsX: summary.gridX,
          overlapPercent: this.overlapPercent,
          pattern: summary.photoPattern
        },
        scanSummary: summary,
        automation: extraCommands,
        stepHistory: this.history
      };
    }
  }

  return {
    CaptureGridEngine
  };
}));
