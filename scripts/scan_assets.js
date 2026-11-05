const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(__dirname, '../assets/histologia');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json');

function formatarNome(slug) {
  return slug
    .replace(/\.dzi$|\.jpg$|\.png$|\.jpeg$/i, '')
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function scanAssets() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('[Erro] Diretório de assets não encontrado:', ASSETS_DIR);
    process.exit(1);
  }

  const entries = fs.readdirSync(ASSETS_DIR);
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(ASSETS_DIR, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && entry.endsWith('.dzi')) {
      const baseSlug = entry.replace(/\.dzi$/i, '');
      const content = fs.readFileSync(fullPath, 'utf8');

      // Extrai dimensões do XML DZI
      const widthMatch = content.match(/Width="(\d+)"/i);
      const heightMatch = content.match(/Height="(\d+)"/i);
      const tileSizeMatch = content.match(/TileSize="(\d+)"/i);

      const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;
      const tileSize = tileSizeMatch ? parseInt(tileSizeMatch[1], 10) : 256;

      const previewCandidate = `${baseSlug}-preview.jpg`;
      const hasPreview = fs.existsSync(path.join(ASSETS_DIR, previewCandidate));

      const maxMag = baseSlug.includes("medula") ? 10 : 40;
      const mpp = baseSlug.includes("medula") ? 0.625 : 0.156;

      items.push({
        id: baseSlug,
        nome: formatarNome(baseSlug),
        tipo: 'dzi',
        formato: 'Deep Zoom Image (.dzi)',
        caminho: `assets/histologia/${entry}`,
        url: `assets/histologia/${entry}`,
        largura: width,
        altura: height,
        tileSize,
        maxMagnification: maxMag,
        mpp: mpp,
        metodoCalibracao: 'referencia_biologica_hemacia_7.5um',
        preview: hasPreview ? `assets/histologia/${previewCandidate}` : null
      });
    } else if (stat.isFile() && (entry.endsWith('.jpg') || entry.endsWith('.png')) && !entry.includes('-preview')) {
      const baseSlug = path.basename(entry, path.extname(entry));
      // Evita duplicar se for apenas o preview de um DZI existente
      if (!fs.existsSync(path.join(ASSETS_DIR, `${baseSlug}.dzi`))) {
        items.push({
          id: baseSlug,
          nome: formatarNome(baseSlug),
          tipo: 'static',
          formato: entry.endsWith('.png') ? 'PNG Estático' : 'JPEG Estático',
          caminho: `assets/histologia/${entry}`,
          url: `assets/histologia/${entry}`,
          largura: 0,
          altura: 0,
          preview: `assets/histologia/${entry}`
        });
      }
    }
  }

  // Ordena alfabeticamente pelo nome amigável
  items.sort((a, b) => a.nome.localeCompare(b.nome));

  const manifest = {
    geradoEm: new Date().toISOString(),
    total: items.length,
    assets: items
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✓ [Palas Atlas] Manifesto de assets gerado com ${items.length} itens em ${MANIFEST_PATH}`);
  items.forEach(i => console.log(`  • [${i.tipo.toUpperCase()}] ${i.nome} → ${i.caminho} (${i.largura}x${i.altura})`));
}

scanAssets();
