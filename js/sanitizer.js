/**
 * sanitizer.js — Sanitização e Defesa contra XSS (Palas Atlas)
 * Isola a limpeza de HTML para que o Dashboard e o Microscópio não
 * compartilhem efeitos colaterais de importação.
 */

/**
 * Remove elementos e atributos potencialmente perigosos do HTML usando DOMParser nativo.
 * Elimina scripts, iframes, objetos, links javascript: e manipuladores on* (onerror, onclick, etc.).
 *
 * @param {string} html - Fragmento de HTML bruto vindo do CMS ou Firestore.
 * @returns {string} HTML sanitizado sem vetores de execução.
 */
export function removerConteudoPerigoso(html) {
  if (!html || typeof html !== "string") return "";
  if (typeof DOMParser === "undefined") {
    return String(html).replace(/<\s*(script|iframe|object|embed|style|link|meta)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,style,link,meta,base,form,frame,frameset").forEach(el => el.remove());

  doc.body.querySelectorAll("*").forEach(el => {
    [...el.attributes].forEach(attr => {
      const nome = attr.name.toLowerCase();
      const valor = String(attr.value).replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
      if (
        nome.startsWith("on") ||
        nome === "srcdoc" ||
        ((nome === "href" || nome === "src" || nome === "xlink:href" || nome === "action" || nome === "formaction") &&
          (valor.startsWith("javascript:") || valor.startsWith("vbscript:") || valor.startsWith("data:text/html")))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

/**
 * Sanitiza o HTML da descrição morfológica, removendo artefatos poluentes
 * (como spans com inline styles de tailwind, animações, blockquotes e &nbsp;)
 * garantindo quebra natural de linha (word-wrap) sem cortar texto à direita.
 * Preserva estritamente os links de pinos (.pin-link ou data-pin-id) e formatações legítimas.
 *
 * @param {string} html - HTML da descrição
 * @returns {string} HTML tratado e limpo
 */
export function sanitizarHTMLDescricao(html) {
  if (!html || typeof html !== "string") return "";

  // 0. Segurança: remove scripts, iframes, handlers on* e URLs javascript: (evita XSS armazenado)
  html = removerConteudoPerigoso(html);

  // 1. Substitui espaços não-quebráveis (&nbsp; e \u00a0) por espaço comum para permitir quebra de linha
  let limpo = html.replace(/&nbsp;/g, " ").replace(/\u00a0/g, " ");

  // 2. Remove tags blockquote mantendo o conteúdo interno
  limpo = limpo.replace(/<\/?blockquote[^>]*>/gi, "");

  // 3. Remove spans aninhados residuais com inline styles
  // Preserva estritamente spans que sejam pin-link ou tenham data-pin-id
  for (let i = 0; i < 6; i++) {
    limpo = limpo.replace(/<span\s+(?![^>]*class=["'][^"']*pin-link[^"']*["'])(?![^>]*data-pin-id)[^>]*>([\s\S]*?)<\/span>/gi, "$1");
  }

  // 4. Remove atributos poluentes de bibliotecas externas (ex: node="[object Object]")
  limpo = limpo.replace(/<(p|div|h1|h2|h3|h4|h5|h6)\s+[^>]*node=[^>]*>/gi, "<$1>");
  limpo = limpo.replace(/style=["'][^"']*--tw-[^"']*["']/gi, "");
  limpo = limpo.replace(/style=["'][^"']*animation:[^"']*["']/gi, "");

  // 5. Ajusta pontuações acidentalmente presas dentro ou com espaços antes de vírgula/ponto/parêntese
  limpo = limpo.replace(/([a-zA-ZÀ-ÿ0-9]+)\)([ \t]*<\/span>)/gi, "$1$2)");
  limpo = limpo.replace(/([a-zA-ZÀ-ÿ0-9]+),([ \t]*<\/span>)/gi, "$1$2,");
  limpo = limpo.replace(/\s+([,.;:)])/g, "$1");
  limpo = limpo.replace(/([(])\s+/g, "$1");

  // 6. Normaliza múltiplos espaços e quebras consecutivas
  limpo = limpo.replace(/[ \t]{2,}/g, " ");

  return limpo.trim();
}

/**
 * Formata o texto descritivo morfológico da lâmina com alto contraste e tipografia editorial.
 * Remove classes legadas de texto claro ou baixa opacidade (como text-neutral-300, text-slate-400).
 * Separa a introdução/visão geral em parágrafos confortáveis e estrutura linhas iniciadas
 * por marcador (•, -, *) contendo dois pontos (:) em tópicos acadêmicos organizados:
 * - Marcador: text-teal-700 dark:text-teal-400 font-bold
 * - Nome da estrutura (antes de :): font-semibold text-slate-900 dark:text-teal-100
 * - Explicação (após :): text-slate-700 dark:text-slate-300 font-normal mb-3
 * Preserva integralmente hiperlinks de pinos (.pin-link, data-pin-id).
 *
 * @param {string} rawInput - Texto ou HTML bruto da descrição
 * @returns {string} HTML estruturado e formatado
 */
export function formatarDescricaoMorfolgica(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return "";

  // 1. Sanitização básica contra scripts e lixo de tags/estilos
  let texto = sanitizarHTMLDescricao(rawInput);

  // 2. Remove classes residuais de baixa opacidade e cores claras que quebram o contraste em modo claro
  texto = texto.replace(/\b(?:text-slate-[234]00|text-neutral-[234]00|text-zinc-[234]00|text-gray-[234]00|text-white(?:\/\d+)?|opacity-(?:[1-7]\d|80))\b/gi, "");

  // 3. Normaliza quebras estruturais para quebra de linha \n
  texto = texto
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(?:li|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // Remove tags de bloco circundantes que possam sobrar
  texto = texto.replace(/<\/?(?:ul|ol|tbody|table|body|section|article)[^>]*>/gi, "");

  // 4. Divide o texto por quebras de linha (\r?\n)
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (linhas.length === 0) return "";

  const blocos = [];

  for (const linhaBruta of linhas) {
    // Preserva títulos se existirem (<h[1-6] ...>Conteúdo</h[1-6]>)
    const matchH = linhaBruta.match(/^<h([1-6])[^>]*>([\s\S]*?)(?:<\/h\1>)?$/i);
    if (matchH) {
      blocos.push(`<h3 class="text-base font-serif font-bold text-slate-900 dark:text-white mb-3 mt-1 leading-snug">${matchH[2]}</h3>`);
      continue;
    }

    // Limpa tags <p>, <div> ou <li> de abertura/fechamento se ainda estiverem envoltas
    let linha = linhaBruta.replace(/^<(?:p|div|li)[^>]*>/i, "").replace(/<\/(?:p|div|li)>$/i, "").trim();
    if (!linha) continue;

    // Detecta se a linha inicia por marcador de lista (•, -, *, &bull;, &#8226;)
    const matchMarcador = linha.match(/^([•\-\*]|&bull;|&#8226;)\s*(.+)$/);
    // Detecta caso venha de <li> original com <strong>Termo:</strong> sem marcador explícito
    const matchForte = !matchMarcador ? linha.match(/^<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*(.+)$/i) : null;

    if (matchMarcador) {
      const conteudo = matchMarcador[2].trim();
      // Encontra o separador ':' garantindo que não está dentro de tags HTML (ex: atributos do .pin-link)
      let separadorIndex = -1;
      let dentroDeTag = false;
      for (let i = 0; i < conteudo.length; i++) {
        if (conteudo[i] === "<") dentroDeTag = true;
        else if (conteudo[i] === ">") dentroDeTag = false;
        else if (conteudo[i] === ":" && !dentroDeTag) {
          separadorIndex = i;
          break;
        }
      }

      if (separadorIndex !== -1) {
        let termo = conteudo.slice(0, separadorIndex).trim();
        let explicacao = conteudo.slice(separadorIndex + 1).trim();
        if (termo.endsWith(":")) termo = termo.slice(0, -1).trim();
        termo = termo.replace(/^<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>$/i, "$1").trim();

        blocos.push(
          `<div class="flex items-start gap-2 mb-3 text-sm leading-relaxed">\n` +
          `  <span class="text-teal-700 dark:text-teal-400 font-bold shrink-0 select-none leading-relaxed">•</span>\n` +
          `  <div>\n` +
          `    <span class="font-semibold text-slate-900 dark:text-teal-100">${termo}:</span>\n` +
          `    <span class="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">${explicacao ? " " + explicacao : ""}</span>\n` +
          `  </div>\n` +
          `</div>`
        );
        continue;
      } else {
        // Tópico com marcador mas sem ':'
        blocos.push(
          `<div class="flex items-start gap-2 mb-3 text-sm leading-relaxed">\n` +
          `  <span class="text-teal-700 dark:text-teal-400 font-bold shrink-0 select-none leading-relaxed">•</span>\n` +
          `  <span class="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">${conteudo}</span>\n` +
          `</div>`
        );
        continue;
      }
    } else if (matchForte && matchForte[1].endsWith(":")) {
      let termo = matchForte[1].slice(0, -1).trim();
      let explicacao = matchForte[2].trim();
      blocos.push(
        `<div class="flex items-start gap-2 mb-3 text-sm leading-relaxed">\n` +
        `  <span class="text-teal-700 dark:text-teal-400 font-bold shrink-0 select-none leading-relaxed">•</span>\n` +
        `  <div>\n` +
        `    <span class="font-semibold text-slate-900 dark:text-teal-100">${termo}:</span>\n` +
        `    <span class="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">${explicacao ? " " + explicacao : ""}</span>\n` +
        `  </div>\n` +
        `</div>`
      );
      continue;
    }

    // Parágrafo comum (introdução, visão geral, parágrafos finais)
    blocos.push(`<p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4">${linha}</p>`);
  }

  return blocos.join("\n");
}

if (typeof window !== "undefined") {
  window.formatarDescricaoMorfolgica = formatarDescricaoMorfolgica;
  window.sanitizarHTMLDescricao = sanitizarHTMLDescricao;
}
