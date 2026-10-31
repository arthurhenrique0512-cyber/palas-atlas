const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Converte qualquer imagem (TIF, PNG, JPG) para Pirâmide Deep Zoom (DZI)
 * Uso: node scripts/generate_dzi.js <caminho-da-imagem> [nome-da-lamina] [diretorio-saida]
 */
async function generateDZI() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
Uso: node scripts/generate_dzi.js <caminho-da-imagem> [nome-slug] [diretorio-saida]

Exemplo:
  node scripts/generate_dzi.js ./minha_foto_costurada.tif cortex-cerebral assets/histologia
    `);
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  if (!fs.existsSync(inputPath)) {
    console.error(`[Erro] Arquivo não encontrado: ${inputPath}`);
    process.exit(1);
  }

  const defaultBase = path.basename(inputPath, path.extname(inputPath))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');

  const baseName = args[1] || defaultBase;
  const outDir = path.resolve(args[2] || 'assets/histologia');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[Palas Atlas DZI Generator]`);
  console.log(`- Imagem Fonte: ${inputPath}`);
  console.log(`- Nome Base:    ${baseName}`);
  console.log(`- Saída:        ${outDir}`);

  const targetDz = path.join(outDir, `${baseName}.dz`);
  const finalDzi = path.join(outDir, `${baseName}.dzi`);
  const previewJpg = path.join(outDir, `${baseName}-preview.jpg`);

  console.log(`Gerando pirâmide de Deep Zoom... Isso pode levar alguns segundos para imagens gigapixel.`);
  const start = Date.now();

  // 1. Gera o DZI e a pasta de azulejos
  await sharp(inputPath)
    .tile({
      size: 256,
      overlap: 0,
      layout: 'dz',
      format: 'jpg',
      quality: 90
    })
    .toFile(targetDz);

  // sharp gera [baseName].dz.dzi e [baseName].dz_files -> ajusta para [baseName].dzi e [baseName]_files
  const generatedDzi = `${targetDz}.dzi`;
  const generatedFiles = `${targetDz}_files`;
  const finalFiles = path.join(outDir, `${baseName}_files`);

  if (fs.existsSync(generatedDzi)) {
    if (fs.existsSync(finalDzi)) fs.unlinkSync(finalDzi);
    fs.renameSync(generatedDzi, finalDzi);
  }
  if (fs.existsSync(generatedFiles)) {
    if (fs.existsSync(finalFiles)) fs.rmSync(finalFiles, { recursive: true, force: true });
    fs.renameSync(generatedFiles, finalFiles);
  }

  // 2. Gera o preview/thumbnail otimizado de alta resolução (largura 1200px)
  await sharp(inputPath)
    .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(previewJpg);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n🎉 Pirâmide DZI gerada com sucesso em ${elapsed}s!`);
  console.log(`- Arquivo DZI:   ${finalDzi}`);
  console.log(`- Azulejos:      ${finalFiles}/`);
  console.log(`- Thumbnail:     ${previewJpg}`);
  console.log(`\nCaminho pronto para registrar no CMS:`);
  console.log(`assets/histologia/${baseName}.dzi`);
}

generateDZI().catch((err) => {
  console.error('[Erro Fatal]', err);
  process.exit(1);
});
