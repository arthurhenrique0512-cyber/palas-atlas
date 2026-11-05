const fs = require('fs');
const path = require('path');

if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[Erro] Credenciais do Supabase não encontradas no .env.local');
  process.exit(1);
}

const BUCKET = 'laminas-dzi';

async function uploadFile(remotePath, localPath, contentType) {
  const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${remotePath}`;
  const fileBuffer = fs.readFileSync(localPath);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000, immutable'
    },
    body: fileBuffer
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao subir ${remotePath}: ${res.status} ${errText}`);
  }
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

async function uploadDziToStorage(baseName) {
  const dziPath = path.resolve(`assets/histologia/${baseName}.dzi`);
  const previewPath = path.resolve(`assets/histologia/${baseName}-preview.jpg`);
  const filesDir = path.resolve(`assets/histologia/${baseName}_files`);

  if (!fs.existsSync(dziPath)) {
    console.error(`[Erro] Arquivo não encontrado: ${dziPath}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`[Upload Supabase Storage] Lâmina: ${baseName}`);
  console.log(`======================================================`);

  // 1. Upload .dzi
  console.log(`Enviando ${baseName}.dzi...`);
  await uploadFile(`${baseName}.dzi`, dziPath, 'application/xml');
  console.log(`✓ ${baseName}.dzi enviado`);

  // 2. Upload preview se existir
  if (fs.existsSync(previewPath)) {
    console.log(`Enviando ${baseName}-preview.jpg...`);
    await uploadFile(`${baseName}-preview.jpg`, previewPath, 'image/jpeg');
    console.log(`✓ ${baseName}-preview.jpg enviado`);
  }

  // 3. Upload dos azulejos
  if (fs.existsSync(filesDir)) {
    const allTiles = getAllFiles(filesDir);
    console.log(`Enviando ${allTiles.length} azulejos para o bucket ${BUCKET}...`);

    let uploaded = 0;
    const BATCH_SIZE = 15;
    for (let i = 0; i < allTiles.length; i += BATCH_SIZE) {
      const batch = allTiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (tilePath) => {
          const relPath = path.relative(path.resolve('assets/histologia'), tilePath);
          const ext = path.extname(tilePath).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
          await uploadFile(relPath, tilePath, contentType);
        })
      );
      uploaded += batch.length;
      process.stdout.write(`Progresso: ${uploaded}/${allTiles.length} azulejos (${Math.round((uploaded / allTiles.length) * 100)}%)\r`);
    }
    console.log(`\n✓ Todos os azulejos enviados com sucesso!`);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${baseName}.dzi`;
  console.log(`\n🎉 URL Pública Global no Supabase:`);
  console.log(publicUrl);
}

async function main() {
  const targetName = process.argv[2] || 'osso_maduro_desgaste_ct';
  await uploadDziToStorage(targetName);
}

main().catch(err => {
  console.error('\n[Erro no Upload]', err);
  process.exit(1);
});
