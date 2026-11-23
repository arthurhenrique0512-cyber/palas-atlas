# 🧭 Guia Definitivo: Como Usar o Fiji Naturalmente
*(Dominando o ImageJ/Fiji sem atrito para o Palas Atlas e Histologia)*

---

## 💡 Filosofia: O Fiji não precisa ser difícil

O **Fiji** (distribuição com baterias inclusas do ImageJ) tem cara de software dos anos 90, mas é o canivete suíço mais rápido e poderoso da microscopia científica mundial.

Usar o Fiji **"naturalmente"** significa parar de se perder em centenas de menus aninhados e adotar os **hábitos dos especialistas**:
1. **Usar a busca rápida (`L`)** em vez de caçar menus.
2. **Navegar como no Photoshop/Figma** (Barra de espaço para arrastar a tela, scroll para zoom).
3. **Alimentar tudo por Arraste e Solte** (Drag & Drop na barra principal).
4. **Configurar a RAM uma única vez** para nunca mais ver erro de memória.

---

## ⚡ Passo 0: A Configuração de Ouro (Faça apenas 1 vez)

O erro nº 1 de quem usa o Fiji para lâminas histológicas é o temido `Java heap space (Out of Memory)`.

1. Abra o Fiji.
2. Vá em **Edit > Options > Memory & Threads...** (ou aperte `L` e digite `Memory`).
3. Em **Maximum memory**, defina cerca de **70% a 80% da memória RAM** do seu computador:
   - Se seu Mac/PC tem **8 GB**: coloque `6000` MB.
   - Se seu Mac/PC tem **16 GB**: coloque `12000` MB.
   - Se seu Mac/PC tem **32 GB**: coloque `24000` MB.
4. Clique em **OK** e reinicie o Fiji.

> [!TIP]
> **Dica de mestre**: Clique com o botão direito na barra de status do Fiji (onde mostra a memória no canto inferior) para forçar o **Garbage Collector** a liberar RAM instantaneamente quando terminar uma tarefa pesada.

---

## 🎯 Atalhos para Navegar com Fluidez Natural

Esqueça os cliques repetitivos. Decore apenas estes 5 atalhos:

| Ação | Atalho | O que faz |
| :--- | :--- | :--- |
| **Achar Qualquer Comando** | `L` *(ou Espaço com o cursor fora da imagem)* | Abre a barra de pesquisa instantânea. Digite o que quer (`stitch`, `crop`, `scale`) e tecle Enter. |
| **Mover a Imagem (Pan)** | Segurar **Barra de Espaço** + clicar e arrastar | Move o campo de visão livremente sem precisar selecionar a ferramenta "Mãozinha". |
| **Zoom Fluido** | `+` / `-` ou `Roda do Mouse / Dois dedos no Trackpad` | Aproxima e afasta suavemente do detalhe celular. |
| **Ajustar Brilho e Contraste** | `Ctrl + Shift + C` (Win) ou `Cmd + Shift + C` (Mac) | Abre a janela de contraste em tempo real para realçar HE ou Giemsa. |
| **Duplicar Imagem** | `Ctrl + Shift + D` (Win) ou `Cmd + Shift + D` (Mac) | Cria uma cópia de segurança antes de testar qualquer filtro ou recorte. |

---

## 🔬 O Fluxo Natural do Palas Atlas (Bancada ao Simulador)

O fluxo de trabalho foi desenhado para você trabalhar quase sem digitar nada:

```
[1. Microscópio + Assistente]
         │ (Captura com Ghosting 15%)
         ▼
[2. Pasta de Fotos]
         │ (Ordenação temporal: rename_images.js)
         ▼
[3. Fiji (Arraste & Solte)]
         │ (stitch_lamina.ijm costura em mosaico)
         ▼
[4. Lamina Gigante .tif]
         │ (generate_dzi.js cria pirâmide Deep Zoom)
         ▼
[5. Palas Atlas Simulator]
```

---

### Passo 1: Captura Tranquila no Microscópio
- Abra o assistente: [assistente_captura.html](file:///Users/arthur/.gemini/antigravity/scratch/simulador-medico-v3/tools/fiji/assistente_captura.html).
- O assistente usa **Onion Skinning (Ghosting)**: a borda da foto anterior é projetada sobre a câmera ao vivo.
- Ajuste o charriot até coincidir ~15% de sobreposição.
- Siga as colunas em serpente: **Desce Coluna 1 ➡️ Sobe Coluna 2 ➡️ Desce Coluna 3**.

---

### Passo 2: Renomeação Instantânea na Ordem Temporal
Ao copiar as fotos para o computador:
```bash
node tools/fiji/rename_images.js --dir "/caminho/das/fotos" --pattern "cortex_{i}.jpg"
```
*O script olha o milissegundo em que cada foto foi tirada e renomeia na ordem exata da grade (`cortex_1.jpg`, `cortex_2.jpg`...).*

---

### Passo 3: Costura Natural no Fiji (Sem complicação)

1. **Abra o Fiji**.
2. **Arraste o arquivo [`tools/fiji/stitch_lamina.ijm`](file:///Users/arthur/.gemini/antigravity/scratch/simulador-medico-v3/tools/fiji/stitch_lamina.ijm)** e solte direto em cima da barra de ferramentas do Fiji.
3. A macro abrirá uma caixinha intuitiva:
   - **Diretório das imagens**: Selecione a pasta das fotos.
   - **Padrão**: `cortex_{i}.jpg`
   - **Colunas (X)**: ex. `3`
   - **Linhas (Y)**: ex. `4`
   - **Overlap**: `15`%
4. Clique em **OK** e assista o Fiji alinhar as imagens subpixel por subpixel.
5. O arquivo `lamina_completa_costurada.tif` será salvo automaticamente na pasta!

---

### Passo 4: Costura Manual (Para quando quiser controle fino)

Se você quiser fazer sem a macro ou customizar os parâmetros:

1. No Fiji, aperte **`L`**.
2. Digite **`Grid/Collection`** e dê `Enter`.
3. Configure os campos principais:
   - **Type**: `Grid: snake by columns`
   - **Order**: `Down & Right`
   - **Grid size X / Y**: Suas colunas e linhas.
   - **Tile overlap [%]**: `15`
   - **Directory**: Sua pasta de fotos.
   - **File names**: `cortex_{i}.jpg`
   - **Fusion method**: `Linear Blending` *(suaviza as bordas perfeitamente)*.
   - **Computation parameters**: `Save computation time (but use more RAM)`.
4. Clique em **OK**.

---

## 🎨 Lapidação e Pós-Processamento Natural

Depois que a lâmina estiver costurada na janela do Fiji:

### 1. Cortar Bordas Pretas / Vistas Fora do Tecido
- Clique no ícone de **Retângulo** na barra de ferramentas (primeiro botão).
- Desenhe a área útil do tecido histológico.
- Aperte `Ctrl + Shift + X` (Win) ou `Cmd + Shift + X` (Mac) — atalho de `Image > Crop`.

### 2. Ajuste Fino de Contraste (Sem estourar os núcleos)
- Aperte `Ctrl + Shift + C` (ou `Cmd + Shift + C`).
- Clique em **Auto** para uma prévia.
- Se a lâmina estiver esbranquiçada ou muito escura, puxe os sliders de *Minimum* e *Maximum* delicadamente.
- Clique em **Apply** para gravar na imagem.

### 3. Inserir Barra de Escala Científica (µm)
Se você tirou foto de uma lâmina micrométrica (régua microscópica):
1. Abra a foto da régua e trace uma linha reta sobre 100 µm usando a ferramenta **Straight Line**.
2. Vá em **Analyze > Set Scale...**
   - **Known distance**: `100`
   - **Unit of length**: `um` (ou `µm`)
   - Marque **Global** para aplicar a todas as imagens da sessão.
3. Na lâmina costurada: aperte `L` e digite `Scale Bar`.
   - Escolha o tamanho (ex: `200 µm`), cor (preto ou branco) e posição.

---

## 🚀 Do Fiji ao Simulador Web Palas Atlas

Com o `.tif` gerado:

```bash
# Converte o TIF de alta resolução para Deep Zoom em segundos:
node scripts/generate_dzi.js "/caminho/da/lamina_completa_costurada.tif" cortex-cerebral
```

Pronto! Os azulejos e o arquivo `.dzi` serão gerados em `assets/histologia/cortex-cerebral.dzi` e estarão prontos para visualização suave com zoom infinito no [microscopio.html](file:///Users/arthur/.gemini/antigravity/scratch/simulador-medico-v3/microscopio.html).

---

## 🛠️ Resolução Rápida de Dúvidas Comuns

> [!WARNING]
> **"A costura parece um tabuleiro com fotos no lugar errado"**  
> Quase sempre é uma inversão do sentido da serpente:
> - Você subiu quando devia descer?
> - Verifique se a numeração temporal do arquivo corresponde exatamente ao percurso (o `assistente_captura.html` garante isso).

> [!TIP]
> **"As emendas ficaram com linhas visíveis (efeito vinheta)"**  
> Isso ocorre quando a iluminação do microscópio é mais forte no centro do que nas bordas.
> - No Fiji, certifique-se de que o **Fusion Method** está em `Linear Blending`.
> - Na captura, trave a exposição e balanço de branco da câmera antes da primeira foto.

> [!IMPORTANT]
> **"A imagem final tem mais de 4 GB"**  
> Imagens gigapixel com mais de 4 GB estouram o padrão TIFF tradicional (32-bit offset).
> - Ao salvar no Fiji, escolha **File > Save As > Bio-Formats** ou salve como **BigTIFF**.
> - O script `scripts/generate_dzi.js` (via `sharp`) lê BigTIFF nativamente sem travar.
