# 🔬 Guia Rápido de Bancada — Projeto Piloto Palas Atlas
*(Escaneamento de Lâmina no Microscópio & Costura no Fiji)*

---

## 1. No Laboratório (No Microscópio)

### A. Assistente Visual com Câmera USB e Ghosting (Onion Skin)
Para facilitar o alinhamento de bancada sem precisar calcular overlap no olho:
1. Conecte a Câmera USB do microscópio ao computador.
2. Inicie o servidor local: `node tools/server.js`
3. Abra no navegador: [http://localhost:8080/tools/fiji/assistente_captura.html](http://localhost:8080/tools/fiji/assistente_captura.html)
4. Selecione a câmera USB no dropdown e clique em **Ligar Câmera**.
5. Conforme você tira as fotos e avança com a **Barra de Espaço**, o assistente projeta automaticamente a faixa exata de 15% da foto anterior como um **fantasma translúcido** sobre o feed ao vivo da câmera:
   - Ao **Descer**: Faixa inferior da foto anterior surge no topo da tela.
   - Ao **Subir**: Faixa superior da foto anterior surge no fundo da tela.
   - Ao **Mover para a Direita**: Faixa direita da foto anterior surge na lateral esquerda.
6. Ajuste o charriot do microscópio até as estruturas celulares coincidirem perfeitamente com a borda tracejada em neon.
7. Pressione **F** para congelar/inspecionar o alinhamento e **R** para ligar a mira micrométrica.

### B. Recursos de Hardware e Ergonomia de Bancada (Palas Atlas)
Para garantir ergonomia máxima durante longas sessões no microscópio:
1. **Wake Lock API (Tela Sempre Ativa)**:
   - Evita que a tela do notebook ou tablet escureça ou suspenda durante a varredura.
   - Badge no cabeçalho: 🟢 **Tela Ativa** (ou ⚪ Tela: Auto ao clicar para alternar).
   - Auto-recuperação: se você alternar de aba e voltar, o bloqueio é restaurado automaticamente.
2. **Síntese Sonora Autônoma (Web Audio API)**:
   - Zero dependência de arquivos externos MP3/WAV (funciona 100% offline no laboratório).
   - **Bipe Curto Suave**: Confirmação auditiva imediata a cada foto disparada.
   - **Tom Melódico de Transição (D5 -> A5)**: Alerta acústico claro para *"Fim de Coluna / Mover Charriot para a Direita"*.
   - **Fanfarra Triunfante (C5 -> E5 -> G5 -> C6)**: Comemoração de varredura completa.
   - Botão **Bipes Ativos / Mudo** no cabeçalho para silenciar quando necessário.
3. **Persistência Anti-Pânico (`localStorage`)**:
   - Salva em tempo real cada campo fotografado, grade $X \times Y$, amostra, objetiva e histórico.
   - Se a bateria acabar ou a aba for fechada por acidente, ao recarregar surge o banner de restauração: *"Sessão anterior detectada: Foto X de Y na amostra Z. [Continuar Sessão] [Descartar]"*.
4. **Gerador Dinâmico de Comandos Fiji e PowerShell**:
   - Clique em **📋 Comandos Fiji** no cabeçalho para abrir o modal.
   - Copie o comando pronto do PowerShell (`rename_images.ps1`) com caminho e padrão já preenchidos.
   - Copie os parâmetros do plugin ou a macro ImageJ completa com 1 clique (`Copiado! ✅`).

### C. Movimento da Varredura (Serpente Vertical)
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

### D. Regras de Ouro para o Stitching Não Falhar
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
