# ANTIGRAVITY.md — Manual Oficial do Estúdio de Mídia Palas Atlas

> **Escopo:** Este arquivo define as regras invioláveis de marca, escopo científico, identidade visual e especificações técnicas para toda produção de mídia do **Palas Atlas** (`https://palasatlas.netlify.app`) neste workspace: **Instagram Reels**, **Stories**, **imagens estáticas**, **carrosséis 4:5**, **capas de Reels** e **peças de design editorial/acadêmico**.

---

## 1. Regras Invioláveis de Marca e Estética

### 1.1 Estritamente Light Mode (Modo Claro Obrigatório)
- Toda captura de tela (`index.html`, `microscopio.html`), card, capa, fundo, overlay ou template HTML **DEVE operar exclusivamente em Light Mode** (`data-theme="light"`, `localStorage.palas_theme = "light"`, sem classe `.dark`).
- **PROIBIDO** usar Dark Mode (`#060608`, `#05070c`, `data-theme="dark"`, fundos escuros em cards ou interfaces pretas) em qualquer peça exportada.
- Utilizar exclusivamente a paleta clara institucional sincronizada em `context/design-tokens.json`, `context/styles.css` e `context/tailwind.config.js`:
  - **Canvas / Fundo Clínico:** `#f8fafc` (Slate-50)
  - **Superfícies / Cards:** `#ffffff` (Branco puro com borda `1px solid rgba(15, 23, 42, 0.08)` ou `#e2e8f0`)
  - **Palco Óptico (Viewer Stage):** `#eef2f6`
  - **Tipografia Principal (Alto Contraste):** `#0f172a` (Slate-900), `#334155` (Slate-700) e `#64748b` (Slate-500)
  - **Acento Institucional Primário:** `#0369a1` (Azul-Petróleo / Sky-700) e `#0284c7` (Sky-600)
  - **Acento Clínico Histológico:** `#0f766e` (Teal-700) e `#0d9488` (Teal-600)
  - **Filete / Detalhe Clássico Discreto:** `#d4af37` (Gold Palas Atlas, apenas em detalhes sutis de acabamento editorial)

### 1.2 Produção Realista (Zero Efeitos Artificiais)
- Todas as peças devem utilizar **capturas reais da interface do Palas Atlas** e **imagens/tiles reais das lâminas digitais em funcionamento** no motor OpenSeadragon.
- **ESTRITAMENTE PROIBIDO** adicionar:
  - Efeitos neon ou brilhos artificiais (glows saturados, lens flares, blooms)
  - Partículas flutuantes ou poeira luminosa
  - HUDs futuristas, retículas sci-fi, grade cibernética ou elementos 3D fictícios
- Manter estética **editorial científica minimalista**, sóbria e de precisão clínica.

### 1.3 Exclusividade em Histologia
- O estúdio produz conteúdo **exclusivamente sobre Histologia e microscopia óptica**.
- **PROIBIDO** incluir anatomia macroscópica, peças cadavéricas, osteologia 3D macroscópica, patologia, parasitologia, microbiologia ou qualquer outra disciplina fora da Histologia.

### 1.4 Acervo Oficial Restrito (Apenas 4 Lâminas Reais)
É permitido utilizar **exclusivamente** as **4 lâminas reais** catalogadas em `context/acervo-laminas.json`:

1. **`Osso Maduro`** — ID `osso_maduro_desgaste_ct` (alias legado `96ZYqoM2SV8p4fB2QgeM`) • Desgaste • 40x (`6120 × 4944 px`)
2. **`Osso Maduro 10x`** — ID `osso_maduro_desgaste_ct_2.0` (alias legado `FFGk5d9kOAct5HIDdjQ7`) • Corte por Desgaste • 10x Mapeamento 2×5 (`2300 × 3670 px`)
3. **`Osso Maduro 40x`** — ID `osso_maduro_desgaste_ct_3.0` (alias legado `cw3XGCgUwN71XdlwkUe5`) • Corte por Desgaste • 40x Mapeamento 6×8 (`6430 × 5630 px`)
4. **`Pele Espessa`** — ID `lamina-real1` (alias legado `a3oRvXvJpMKAtU2RE85q`) • H&E • 40x (`2536 × 9370 px`) *(nota: eventualmente citada em rascunhos como "Pé de Espessura"; o título oficial é `Pele Espessa`)*

**PROIBIDO** inventar lâminas, buscar fotos em bancos externos ou ilustrar tecidos não presentes nessas 4 lâminas reais.

---

## 2. Tipografia e Identidade da Marca

Sincronizada diretamente de `context/tailwind.config.js` e `app/layout.tsx`:
- **Display / Logotipo (`PALAS ATLAS`):** `Cormorant Garamond`, serif (pesos `500, 600, 700`), tracking amplo (`0.18em`–`0.22em`) acompanhado do emblema oficial da coruja (`context/logo-coruja.svg`). Em Light Mode: `PALAS` em `#0f172a`, coruja e `ATLAS` em `#0369a1`.
- **Títulos Editoriais (`font-serif` no Tailwind do projeto):** `Plus Jakarta Sans`, sans-serif (pesos `500, 600, 700, 800`).
- **Corpo e UI (`font-sans`):** `Inter`, sans-serif (pesos `300, 400, 500, 600, 700`).
- **Dados Técnicos e Ópticos (`font-mono`):** `JetBrains Mono`, monospace (pesos `400, 500, 600`), com `tabular-nums` para ampliações (`4x`, `10x`, `40x`), resolução (`µm/px`) e contadores de carrossel.

---

## 3. Padrões Técnicos de Exportação e Safe Zones

### 3.1 Vídeo Vertical — Reels e Stories (`9:16`)
- **Resolução:** `1080 × 1920 px`
- **Taxa de quadros:** `60 fps` constantes
- **Codec / Container:** `H.264` (`libx264`, `-pix_fmt yuv420p`, `-movflags +faststart`) em `.mp4`
- **Bitrate:** Alto bitrate obrigatório **`>= 15 Mbps`** (padrão do pipeline: `18 Mbps`, `-minrate 15M`, `-maxrate 24M`)
- **Captura Mobile Retina:** Viewport `390 × 844`, `deviceScaleFactor: 3` em Light Mode via Playwright

### 3.2 Imagem Estática, Carrosséis e Capas
- **Feed / Carrosséis:** `1080 × 1350 px` (`4:5`) em **`PNG` sem perda**
- **Capas de Reels / Stories estáticos:** `1080 × 1920 px` (`9:16`) em **`PNG` sem perda**

### 3.3 Safe Zones do Instagram (Invioláveis em `1080 × 1920 px`)
Todo texto, título, legenda, marcador ou componente gráfico essencial deve permanecer dentro da área segura:
- **Margem Superior Livre:** mínimo **`140 px`**
- **Margem Inferior Livre:** mínimo **`260 px`**
- **Margem Lateral Direita Livre:** mínimo **`90 px`** (evita sobreposição com ícones de curtir/comentar/compartilhar)
- **Margem Lateral Esquerda Recomendada:** mínimo **`64 px`**

Em peças **`1080 × 1350 px` (Feed 4:5)**:
- Manter margens editoriais mínimas de **`72 px`** em todos os lados e centralizar a informação principal pensando também no corte `3:4` / `1:1` do grid do perfil.

### 3.4 Movimentação Óptica Realista
- Todo movimento de câmera (`pan` X/Y e `zoom` entre objetivas) deve usar **curvas suaves (`ease-in-out` / `cubic-bezier(0.42, 0, 0.58, 1)`)**, simulando o deslocamento mecânico contínuo da platina e a rotação do revólver de objetivas (`4x → 10x → 40x`).
- Respeitar sempre a trava física de ampliação real da lâmina (`maxMagnification`), sem esticar pixels além da resolução nativa `1:1` e aguardando carregamento completo dos azulejos DZI antes de registrar cada quadro.

---

## 4. Arquitetura do Estúdio e Nomenclatura

- `context/` — Arquivos reais de estilo sincronizados (`tailwind.config.js`, `globals.css`, `styles.css`, `splash.css`, `logo-coruja.svg`), `design-tokens.json` e `acervo-laminas.json`.
- `templates/` — Templates HTML/Tailwind base (`templates/editorial-card.html`) operando estritamente em Light Mode e respeitando as Safe Zones.
- `pipelines/` — Motores TypeScript automatizados:
  - `pipelines/capture-reels.ts` — Captura OpenSeadragon quadro a quadro a `60fps` em Light Mode e codifica MP4 H.264 (`>= 15 Mbps`) em `exports/reels/` ou `exports/stories/`.
  - `pipelines/render-design.ts` — Renderiza capas `1080×1920` e posts/carrosséis `1080×1350` em PNG lossless dentro de `exports/feed/`.
- `exports/` — Saídas organizadas por formato com prefixo de data obrigatório **`YYYY-MM-DD-nome`**:
  - `exports/reels/YYYY-MM-DD-nome.mp4`
  - `exports/stories/YYYY-MM-DD-nome.mp4` (ou `.png`)
  - `exports/feed/YYYY-MM-DD-nome.png` (ou pasta `exports/feed/YYYY-MM-DD-nome/slide-01.png` para carrosséis)
