# 🔬 Guia Rápido de Bancada — Projeto Piloto Palas Atlas
*(Escaneamento de Lâmina no Microscópio & Costura no Fiji)*

---

## 1. No Laboratório (No Microscópio)

### A. Movimento da Varredura (Serpente Vertical)
Você escolheu o padrão **Snake by Columns (Down & Right)**:
```
(Início Topo-Esquerdo)
[ Foto 1 ]           [ Foto 8 ]  --->  [ Foto 9 ]
    ↓                    ↑                 ↓
[ Foto 2 ]           [ Foto 7 ]        [ Foto 10 ]
    ↓                    ↑                 ↓
[ Foto 3 ]           [ Foto 6 ]        [ Foto 11 ]
    ↓                    ↑                 ↓
[ Foto 4 ]  --->     [ Foto 5 ]        [ Foto 12 ]
(Desce Col. 1)     (Sobe Col. 2)     (Desce Col. 3)
```

### B. Regras de Ouro para o Stitching Não Falhar
1. **Overlap (10% a 15%)**: 
   - Ao mover o charriot, olhe uma estrutura de referência na borda da imagem anterior e deixe-a aparecer cerca de 15% dentro do novo campo.
2. **Travar Balanço de Branco e Exposição**:
   - No software da câmera do microscópio, desative o *Auto-Exposure* e *Auto-White Balance* após regular no primeiro campo. Se cada foto tiver brilho ou tom diferente, a costura fica com aspecto de "tabuleiro de xadrez".
3. **Cuidado com o Micrométrico (Foco)**:
   - Tente manter o foco homogêneo. Mudanças bruscas de plano focal reduzem a correlação entre as bordas.
4. **Anote a Grade**:
   - Quantas fotos na vertical (linhas $Y$)? Ex: 4 fotos.
   - Quantas colunas na horizontal (colunas $X$)? Ex: 3 colunas.
   - Total de fotos = $X \times Y$ (ex: $3 \times 4 = 12$).

---

## 2. Nomenclatura e Ordenação Temporal (Milissegundos)

Ao salvar as fotos no computador da faculdade ou passar pro seu pendrive, os nomes originais podem vir estranhos (`IMG_001.jpg`, `Capture_0001.jpg`, etc.).

O renomeador do Palas Atlas analisa a **data/hora exata até os milissegundos** de cada arquivo e renomeia na ordem exata em que você tirou as fotos.

### Como rodar:

Se você definir o padrão como `musculo_x.jpg`:

#### Opção A (Node.js):
```powershell
node tools/fiji/rename_images.js --dir "C:\Caminho\Das\Fotos" --pattern "musculo_x.jpg"
```

#### Opção B (PowerShell direto no Windows):
```powershell
.\tools\fiji\rename_images.ps1 -Dir "C:\Caminho\Das\Fotos" -Pattern "musculo_x.jpg"
```

#### Opção C (Comigo aqui no chat):
Quando você voltar do laboratório com a pasta de fotos, você só precisa me dizer:
> *"As fotos estão na pasta X e o padrão é musculo_x.jpg, grade 3x4"*  
E eu executo a ordenação e renomeação imediatamente para você!

---

## 3. Costurando no Fiji (ImageJ)

1. Abra o **Fiji**.
2. Arraste o arquivo [`tools/fiji/stitch_lamina.ijm`](file:///c:/Users/iagom/OneDrive/Documentos/palas-atlas/tools/fiji/stitch_lamina.ijm) para dentro da janela do Fiji (ou vá em `Plugins > Macros > Run...`).
3. Uma janelinha vai se abrir pedindo:
   - **Diretório das imagens**: Selecione a pasta onde estão as fotos renomeadas.
   - **Padrão do nome**: `musculo_{i}.jpg` *(o Fiji usa `{i}` onde era o `x`)*.
   - **Grid Size X (Colunas)**: Ex: 3.
   - **Grid Size Y (Linhas)**: Ex: 4.
   - **Overlap**: 15%.
4. Clique em **OK**.
5. O Fiji calculará os deslocamentos com precisão subpixel, fará a fusão linear das bordas (*Linear Blending*) e gerará a lâmina inteira panorâmica `lamina_completa_costurada.tif`!

---

## 4. Próximo Passo no Palas Atlas

Com o `.tif` gigante em mãos:
- Convertemos para pirâmide de Deep Zoom (DZI / OpenSeadragon) com 1 comando (`vips dzsave`).
- Carregamos diretamente no visualizador interativo do Palas ([`microscopio.html`](file:///c:/Users/iagom/OneDrive/Documentos/palas-atlas/microscopio.html)).
