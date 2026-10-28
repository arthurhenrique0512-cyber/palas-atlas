/**
 * ==============================================================================
 * Palas Atlas - Motor de Navegação e Grade de Captura (Microscopia)
 * ==============================================================================
 * Suporta:
 * 1. Modo Descoberta (Y Fixo, X Dinâmico infinito com serpente vertical).
 * 2. Modo Fixo Tradicional (X e Y predefinidos).
 * 3. Cálculos de percurso em serpente: Snake by Columns (Down & Right).
 * 4. Diagnóstico e fechamento de matriz para o algoritmo Grid Stitching do Fiji.
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
      this.rowsY = parseInt(options.rowsY, 10) || 6;
      this.fixedColsX = parseInt(options.fixedColsX, 10) || 3;
      this.overlapPercent = parseInt(options.overlapPercent, 10) || 15;
      this.photoPrefix = options.photoPrefix || 'lamina';

      this.currentStep = 0; // 0-indexed: 0 -> foto 1
      this.maxStepReached = 0;
      this.history = []; // registros com timestamp
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
     * Quantidade total de colunas visíveis/ativas na grade
     */
    get activeCols() {
      if (this.mode === 'fixed') {
        return this.fixedColsX;
      }
      // No modo dinâmico: pelo menos 1 coluna, ou o maior índice de coluna atingido + 1
      const colFromCurrent = Math.floor(this.currentStep / this.rowsY);
      const colFromMax = Math.floor(this.maxStepReached / this.rowsY);
      return Math.max(1, colFromCurrent + 1, colFromMax + 1);
    }

    /**
     * Total de fotos estimadas (no modo fixo) ou capturadas até agora
     */
    get totalPhotosExpected() {
      if (this.mode === 'fixed') {
        return this.fixedColsX * this.rowsY;
      }
      return Math.max(this.currentStep + 1, this.maxStepReached + 1);
    }

    /**
     * Calcula as coordenadas e ação para qualquer passo (0-indexed)
     * Regra Fiji: Snake by Columns (Down & Right)
     * - Coluna 0 (par): Desce (y = 0 -> rowsY - 1)
     * - No fim da Coluna 0: Vira à direita para Coluna 1
     * - Coluna 1 (ímpar): Sobe (y = rowsY - 1 -> 0)
     * - No fim da Coluna 1: Vira à direita para Coluna 2
     * - Coluna 2 (par): Desce (y = 0 -> rowsY - 1)...
     */
    getStepInfo(stepIndex) {
      const Y = this.rowsY;
      const col = Math.floor(stepIndex / Y);
      const stepInCol = stepIndex % Y;
      const isGoingDown = (col % 2 === 0);
      const row = isGoingDown ? stepInCol : (Y - 1 - stepInCol);
      const stepNum = stepIndex + 1;
      const isLastInCol = (stepInCol === Y - 1);
      const isFirstInCol = (stepInCol === 0);

      // Verificação de fim absoluto no modo fixo
      const isLastOverall = (this.mode === 'fixed' && stepIndex === (this.fixedColsX * Y - 1));

      let action = 'DOWN';
      let icon = '⬇️';
      let title = 'Desça na Vertical';
      let desc = 'Tire a foto. Mova o charriot para BAIXO mantendo 15% de sobreposição.';
      let audioCue = 'Desça';

      if (isLastOverall) {
        action = 'FINISH';
        icon = '🎉';
        title = 'Varredura Concluída!';
        desc = 'Última foto disparada! Clique em Concluir Lâmina para gerar o manifesto e parâmetros do Fiji.';
        audioCue = 'Varredura concluída';
      } else if (isLastInCol) {
        action = 'RIGHT';
        icon = '➡️';
        title = 'Mova para a DIREITA';
        desc = `Fim da Coluna ${col + 1}! Mova 1 campo para a DIREITA (15% overlap) para iniciar a Coluna ${col + 2}.`;
        audioCue = 'Vire à direita';
      } else if (!isGoingDown) {
        action = 'UP';
        icon = '⬆️';
        title = 'Suba na Vertical';
        desc = 'Tire a foto. Mova o charriot para CIMA mantendo 15% de sobreposição.';
        audioCue = 'Suba';
      }

      return {
        stepIndex,
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
        action,              // 'DOWN' | 'UP' | 'RIGHT' | 'FINISH'
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
     * Avança para o próximo passo de captura
     */
    next() {
      if (this.mode === 'fixed') {
        const maxSteps = this.fixedColsX * this.rowsY;
        if (this.currentStep >= maxSteps - 1) {
          this.isFinished = true;
          return this.getCurrentStepInfo();
        }
      }

      // Registra histórico
      const current = this.getCurrentStepInfo();
      this.history.push({
        ...current,
        timestamp: Date.now()
      });

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
      if (this.currentStep > 0) {
        this.currentStep--;
        this.isFinished = false;
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

      const totalStepsInActiveGrid = X * Y;
      for (let s = 0; s < totalStepsInActiveGrid; s++) {
        const info = this.getStepInfo(s);
        if (info.col < X && info.row < Y) {
          matrix[info.row][info.col] = {
            ...info,
            isCurrent: (s === this.currentStep),
            isCompleted: (s < this.currentStep),
            isUpcoming: (s > this.currentStep)
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
     * Diagnóstico e resumo de finalização de lâmina
     * Analisa se a varredura formou um retângulo completo ou se foi interrompida no meio
     */
    getCompletionSummary() {
      const totalPhotos = this.currentStep + 1;
      const Y = this.rowsY;
      const fullCols = Math.floor(totalPhotos / Y);
      const remainder = totalPhotos % Y;
      const totalColsTouched = Math.ceil(totalPhotos / Y);
      const isRectangular = (remainder === 0);
      const missingInLastCol = isRectangular ? 0 : (Y - remainder);

      // Parâmetros recomendados para o Fiji
      const gridX = isRectangular ? fullCols : totalColsTouched;
      const gridY = Y;
      const expectedTotalPhotos = gridX * gridY;

      // Código da Macro Fiji
      const fijiMacroCode = `// =======================================================
// Palas Atlas - Macro de Stitching (Fiji / ImageJ)
// Lâmina: ${this.photoPrefix}
// Grade: ${gridX} colunas x ${gridY} linhas (${expectedTotalPhotos} fotos)
// =======================================================
run("Grid/Collection stitching", 
  "type=[Grid: snake by columns] " +
  "order=[Down & Right] " +
  "grid_size_x=${gridX} " +
  "grid_size_y=${gridY} " +
  "tile_overlap=${this.overlapPercent} " +
  "first_file_index_i=1 " +
  "directory=[C:/Caminho/Das/Fotos/] " +
  "file_names=${this.photoPrefix}_{i}.jpg " +
  "output_textfile_name=TileConfiguration.txt " +
  "fusion_method=[Linear Blending] " +
  "regression_threshold=0.30 " +
  "max/avg_displacement_threshold=2.50 " +
  "absolute_displacement_threshold=3.50 " +
  "compute_overlap subpixel_accuracy " +
  "computation_parameters=[Save computation time (but use more RAM)] " +
  "image_output=[Fuse and display]");`;

      // Comando de renomeação do Palas Atlas
      const renameCmdNode = `node tools/fiji/rename_images.js --dir "C:\\Caminho\\Fotos" --pattern "${this.photoPrefix}_x.jpg"`;
      const renameCmdPs = `.\\tools\\fiji\\rename_images.ps1 -Dir "C:\\Caminho\\Fotos" -Pattern "${this.photoPrefix}_x.jpg"`;

      return {
        totalPhotosCaptured: totalPhotos,
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
        photoPattern: `${this.photoPrefix}_{i}.jpg`,
        fijiMacroCode,
        renameCmdNode,
        renameCmdPs,
        // Opções de ação para o usuário caso não seja retangular
        solutions: isRectangular ? [] : [
          {
            id: 'complete_scan',
            title: `Continuar no microscópio (+${missingInLastCol} fotos)`,
            desc: `Desça/suba mais ${missingInLastCol} fotos na Coluna ${totalColsTouched} (mesmo em área vazia) para fechar a grade ${gridX}x${gridY} perfeitamente.`,
            recommended: true
          },
          {
            id: 'dummy_fill',
            title: `Preencher fotos faltantes com arquivo dummy`,
            desc: `Gera ${missingInLastCol} cópias com nomes ${this.photoPrefix}_${totalPhotos + 1}.jpg a ${this.photoPrefix}_${expectedTotalPhotos}.jpg para o Fiji não falhar.`,
            recommended: false
          },
          {
            id: 'drop_incomplete',
            title: `Descartar a Coluna ${totalColsTouched} (${remainder} fotos)`,
            desc: `Mantém apenas as ${fullCols} colunas perfeitas (${fullCols * Y} fotos). As últimas ${remainder} fotos serão ignoradas no Fiji.`,
            recommended: false
          }
        ]
      };
    }

    /**
     * Exporta manifesto da sessão em formato JSON
     */
    exportManifest() {
      const summary = this.getCompletionSummary();
      return {
        app: 'Palas Atlas Capture Assistant',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        mode: this.mode,
        config: {
          rowsY: this.rowsY,
          colsX: summary.gridX,
          overlapPercent: this.overlapPercent,
          pattern: summary.photoPattern
        },
        scanSummary: summary,
        stepHistory: this.history
      };
    }
  }

  return {
    CaptureGridEngine
  };
}));
