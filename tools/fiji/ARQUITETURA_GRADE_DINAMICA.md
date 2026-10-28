# 🔬 Arquitetura da Grade Dinâmica & Modo Descoberta — Palas Atlas

Este documento descreve a especificação técnica, modelo matemático, estruturas de dados e guia de integração para o **Assistente de Captura em Microscópio (Copiloto de Bancada v2.0)**.

---

## 1. Visão Geral e Problema Resolvido

Ao escanear lâminas histológicas manualmente no microscópio óptico:
- O pesquisador conhece a **altura do corte** (quantos campos verticais $Y$ são necessários para cobrir de cima a baixo).
- A **largura do tecido** ($X$ colunas horizontais) é frequentemente **desconhecida** e varia de lâmina para lâmina.
- O algoritmo padrão do **Fiji (ImageJ) Grid/Collection stitching** exige o percurso **"Snake by Columns (Down & Right)"** e uma matriz retangular completa de $X \times Y$ imagens.

### O "Modo Descoberta"
1. O usuário define apenas $Y$ (ex: 6 linhas).
2. A interface inicia exibindo apenas a **Coluna 1**.
3. O pesquisador desce (fotos 1 a 6). No campo 6, recebe o aviso de virar à direita.
4. Ao avançar para a foto 7, a **Coluna 2** é criada em tempo real na interface, e a rota inverte para **SUBIR** (fotos 7 a 12).
5. No topo da Coluna 2 (foto 12), vira à direita; a **Coluna 3** é criada, descendo novamente.
6. O processo se expande dinamicamente à direita até o tecido acabar.
7. O botão **"🏁 Concluir Lâmina"** pode ser acionado a qualquer momento, diagnosticando se a grade está completa ou oferecendo caminhos elegantes de fechamento retangular para o Fiji.

---

## 2. Modelo Matemático do Percurso (Snake by Columns)

Dado o índice do passo de disparo $i \in \{0, 1, 2, \dots, N-1\}$ (onde o número da foto é $n = i + 1$) e a altura fixada $Y$:

$$c = \lfloor i / Y \rfloor \quad \text{(índice da coluna, 0-indexed)}$$
$$s = i \pmod Y \quad \text{(índice do passo dentro da coluna, } 0 \le s < Y\text{)}$$
$$\text{isGoingDown} = (c \pmod 2 == 0)$$

A linha atual $r$ (0-indexed, onde 0 é o topo) é:

$$r = \begin{cases} s, & \text{se } \text{isGoingDown} = \text{true (colunas pares)} \\ Y - 1 - s, & \text{se } \text{isGoingDown} = \text{false (colunas ímpares)} \end{cases}$$

### Determinação da Ação Imediata (Charriot)

| Condição | Ação | Ícone | Direção do Charriot |
| :--- | :--- | :--- | :--- |
| $s = Y - 1$ | `RIGHT` | ➡️ | Mover 1 campo para a direita (15% overlap) para abrir nova coluna |
| $s < Y - 1 \land \text{isGoingDown}$ | `DOWN` | ⬇️ | Descer 1 campo na vertical (15% overlap) |
| $s < Y - 1 \land \neg\text{isGoingDown}$ | `UP` | ⬆️ | Subir 1 campo na vertical (15% overlap) |

---

## 3. Tratamento de Coluna Incompleta na Finalização

Quando o usuário clica em **"Concluir Lâmina"** com $N$ fotos capturadas:

- $C_{\text{completas}} = \lfloor N / Y \rfloor$
- $R = N \pmod Y$ (resto de fotos na última coluna)
- $C_{\text{total}} = \lceil N / Y \rceil$

### Caso 1: Matriz Perfeita ($R = 0$)
- $X = C_{\text{completas}}$
- $Y = \text{rowsY}$
- Total de fotos = $X \times Y$.
- O Fiji recebe os parâmetros diretos e processa sem nenhuma intervenção.

### Caso 2: Coluna Incompleta ($R > 0$)
Faltam $M = Y - R$ fotos para fechar o retângulo. O sistema disponibiliza 3 soluções:
1. **Continuar Captura (+M fotos)**: O pesquisador bate mais $M$ fotos descendo/subindo no campo vazio da borda para fechar o retângulo de forma limpa.
2. **Preenchimento Dummy (PowerShell / Node)**: Gera cópias da última foto com os nomes faltantes (`lamina_16.jpg`, `lamina_17.jpg`...), permitindo ao Fiji costurar a matriz completa e depois cortar o excesso.
3. **Descartar Coluna Incompleta**: Utiliza apenas as colunas completas ($X = C_{\text{completas}}$).

---

## 4. Estrutura de Dados do Objeto StepInfo

```typescript
interface StepInfo {
  stepIndex: number;      // 0-indexed (ex: 0, 1, 2...)
  stepNum: number;        // 1-indexed (ex: 1, 2, 3...)
  col: number;            // 0-indexed (Coluna lógica na matriz)
  row: number;            // 0-indexed (Linha lógica: 0 = topo)
  colUser: number;        // 1-indexed (Coluna para exibição: Col 1, Col 2...)
  rowUser: number;        // 1-indexed (Linha para exibição: Lin 1, Lin 2...)
  stepInCol: number;      // Passo dentro da coluna (0 a Y-1)
  stepInColUser: number;  // 1 a Y
  isGoingDown: boolean;   // true se a coluna atual desce
  isLastInCol: boolean;   // true se atingiu o fim da coluna e deve virar à direita
  isFirstInCol: boolean;  // true se é o primeiro ponto da coluna
  isLastOverall: boolean; // true apenas no modo fixo ao atingir X * Y
  action: 'DOWN' | 'UP' | 'RIGHT' | 'FINISH';
  icon: '⬇️' | '⬆️' | '➡️' | '🎉';
  title: string;          // ex: "Mova para a DIREITA"
  desc: string;           // Instrução detalhada com % de overlap
  audioCue: string;       // Frase concisa para Text-to-Speech ("Desça", "Suba", "Vire à direita")
}
```

---

## 5. Estrutura de Dados do Relatório de Conclusão

```typescript
interface CompletionSummary {
  totalPhotosCaptured: number;
  rowsY: number;
  fullCols: number;
  remainder: number;
  totalColsTouched: number;
  isRectangular: boolean;
  missingInLastCol: number;
  gridX: number;
  gridY: number;
  expectedTotalPhotos: number;
  overlapPercent: number;
  photoPattern: string;       // ex: "lamina_{i}.jpg"
  fijiMacroCode: string;      // Script pronto para colar no Fiji
  renameCmdNode: string;      // Comando node rename_images.js
  renameCmdPs: string;        // Comando powershell
  solutions: Array<{
    id: 'complete_scan' | 'dummy_fill' | 'drop_incomplete';
    title: string;
    desc: string;
    recommended: boolean;
  }>;
}
```

---

## 6. Arquivos Entregues

1. **[`tools/fiji/capture_grid_engine.js`](file:///c:/Users/iagom/OneDrive/Documentos/palas-atlas/tools/fiji/capture_grid_engine.js)**:
   - Classe UMD reutilizável `PalasGridEngine.CaptureGridEngine`.
   - Compatível com Node.js, navegadores e ES Modules.
   - Suporta `mode: 'dynamic'` e `mode: 'fixed'`.
   - Inclui métodos `next()`, `prev()`, `goToStep(idx)`, `reset()`, `getMatrix()`, `getCompletionSummary()`, `exportManifest()`.

2. **[`tools/fiji/assistente_captura.html`](file:///c:/Users/iagom/OneDrive/Documentos/palas-atlas/tools/fiji/assistente_captura.html)**:
   - Interface Web completa com Tailwind CSS e Dark Mode.
   - Seletor de Modo Descoberta vs Grade Fixa.
   - Renderização gráfica da grade em colunas dinâmicas verticais com badges direcionais (`Col 1 ⬇`, `Col 2 ⬆`...) e coluna fantasma expansível (`+ Nova Coluna`).
   - Card de ação imediata com feedback visual gigante e animações.
   - Síntese de voz em português (Web Speech API) e beeps sintetizados (Web Audio API) para operação hands-free no microscópio.
   - Mira de sobreposição de 15% (overlap) com referências de retículo.
   - Modal de finalização com cópia em 1 clique dos scripts do Fiji, comandos de renomeação e download do manifesto JSON da lâmina.
   - Suporte completo a atalhos de teclado: `Espaço`, `Enter`, `Setas`, `F`, `R`, `M`, `Esc`.
