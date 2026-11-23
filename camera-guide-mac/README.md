# 📷 CameraGuide 15% (macOS)

Aplicativo nativo, ultra-leve (~150 KB) e sem dependências para macOS que projeta uma camada transparente sempre visível (**Always-on-Top**) com as linhas de marcação nos **15% superior, inferior e laterais** para uso conjunto com qualquer aplicativo de câmera (Photo Booth, OBS Studio, QuickTime, Zoom, Google Meet, navegadores ou softwares médicos/odontológicos).

---

## 🚀 Como Iniciar

Você pode abrir o aplicativo com um duplo clique no arquivo:
`CameraGuide15.app`

Ou via Terminal:
```bash
open /Users/arthur/.gemini/antigravity/scratch/simulador-medico-v3/camera-guide-mac/CameraGuide15.app
```

> **Dica:** Se desejar ter o app sempre fácil de acessar, você pode arrastar o `CameraGuide15.app` para a sua pasta **Aplicativos** (`/Applications`) ou para a Mesa (Desktop).

---

## 🎯 Como Funciona

### 1. 🖐️ Modo Ajuste (Destravado - Inicial)
- Ao abrir o app, você verá a moldura na tela com uma borda azul pontilhada e um banner indicativo no topo.
- **Mover:** Clique em qualquer lugar dentro da janela e arraste para posicionar sobre o visor da câmera.
- **Redimensionar:** Arraste pelas bordas ou cantos para encaixar no tamanho exato da sua imagem.
- **Dimensões Predefinidas:** No menu do topo, você pode escolher **Tela Cheia**, **16:9**, **4:3** ou **1:1**.

### 2. 🔒 Modo Travar (Clique Vazado / Pass-Through)
- Quando a moldura estiver no lugar certo sobre a câmera, clique no ícone **⛶ 15%** na barra de menus superior do Mac (ao lado do relógio ou Wi-Fi) e selecione:
  **🔒 Travar (Permite Clicar na Câmera por Trás)** (ou atalho `Cmd + L`).
- As bordas de ajuste desaparecem e a janela se torna **100% vazada para o mouse**: você pode clicar em todos os botões do aplicativo de câmera por trás das linhas como se a janela nem estivesse ali!
- Para voltar a ajustar ou mover, basta clicar no ícone do menu superior e escolher **🔓 Destravar Posição**.

---

## ⚙️ Recursos Disponíveis no Menu Superior

Clicando no ícone **⛶ 15%** no menu superior do Mac:

- **🔒 Travar / 🔓 Destravar:** Alterna entre modo de ajuste e modo de clique vazado.
- **👁️ Mostrar / Ocultar Linhas:** Liga ou desliga as linhas temporariamente sem fechar o app.
- **🎨 Cor da Linha:**
  - Verde Neon (padrão)
  - Ciano
  - Amarelo
  - Vermelho
  - Branco
  - Laranja
  - Magenta
  - Preto
  *(Todas as linhas possuem traço de contraste escuro para máxima visibilidade tanto em fundos claros quanto escuros).*
- **📏 Espessura da Linha:** 1px, 2px, 3px, 4px ou 5px.
- **✨ Opacidade:** 100%, 85%, 65% ou 40%.
- **Linha Tracejada:** Alterna entre contínua e tracejada.
- **Marca de Centro (+):** Exibe uma cruz sutil no centro geométrico.
- **Grade Regra dos Terços (3x3):** Linhas auxiliares a 33.3% e 66.6%.
- **Rótulos "15%":** Indicadores numéricos discretos nos cantos e margens.
- **📐 Dimensões Predefinidas:** Tela Cheia, 16:9, 4:3, 1:1, Centralizar.
- **Sair:** Fecha o aplicativo.

---

## 🛠️ Recompilar (se desejar alterar o código)

O código-fonte está em `CameraGuideApp.swift`. Para recompilar a qualquer momento:
```bash
./build.sh
```
