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
 * Sanitiza o HTML da descrição morfológica, removendo artefatos poluentes copiados de chats de IA
 * (como spans parasitas com inline styles de tailwind, animações, blockquotes e &nbsp;)
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

  // 3. Remove spans aninhados parasitas com inline styles (de streaming de IA como ChatGPT)
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
