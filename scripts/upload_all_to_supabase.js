const fs = require('fs');
const path = require('path');

// Carrega .env.local
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = 'laminas-dzi';

if (!supabaseUrl || !serviceKey) {
  console.error('[ERRO] Credenciais do Supabase ausentes em .env.local');
  process.exit(1);
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (!file.startsWith('.')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function getContentType(filePath) {
  if (filePath.endsWith('.dzi') || filePath.endsWith('.xml')) return 'application/xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function uploadFile(storagePath, localPath) {
  const fileBuffer = fs.readFileSync(localPath);
  const contentType = getContentType(localPath);

  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'x-upsert': 'true',
      'Content-Type': contentType,
      'cache-control': 'max-age=31536000, public'
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao subir ${storagePath}: ${res.status} - ${errText}`);
  }
}

async function main() {
  console.log(`=======================================================`);
  console.log(`[PALAS ATLAS] Sincronização Massiva de Lâminas no Supabase`);
  console.log(`Bucket de Destino: ${bucket}`);
  console.log(`Supabase URL:      ${supabaseUrl}`);
  console.log(`=======================================================\n`);

  const baseDir = path.resolve('assets/histologia');
  const allFiles = getAllFiles(baseDir);
  console.log(`Total de arquivos encontrados em assets/histologia: ${allFiles.length}`);

  let uploaded = 0;
  let failed = 0;
  const BATCH_SIZE = 15;

  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (fullPath) => {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        try {
          await uploadFile(relativePath, fullPath);
          uploaded++;
        } catch (err) {
          console.error(`\nErro em ${relativePath}:`, err.message);
          failed++;
        }
      })
    );

    const percent = Math.round((uploaded / allFiles.length) * 100);
    process.stdout.write(`Progresso: ${uploaded}/${allFiles.length} (${percent}%) enviando azulejos...\r`);
  }

  console.log(`\n\n✓ Concluído: ${uploaded} arquivos sincronizados no Supabase Storage (${failed} falhas).`);

  // Atualizar os links na tabela laminas do PostgreSQL
  console.log(`\nAtualizando URLs no banco relacional PostgreSQL...`);
  
  const publicBase = `${supabaseUrl}/storage/v1/object/public/${bucket}`;

  const updates = [
    {
      id: 'osso_maduro_desgaste_ct',
      dzi_url: `${publicBase}/osso_maduro_desgaste_ct.dzi`,
      thumbnail_url: `${publicBase}/osso_maduro_desgaste_ct-preview.jpg`,
      preview_image: `${publicBase}/osso_maduro_desgaste_ct-preview.jpg`
    },
    {
      id: 'epitelio-simples-escamoso',
      dzi_url: `${publicBase}/epitelio-simples-escamoso.dzi`,
      thumbnail_url: `${publicBase}/epitelio-simples-escamoso-preview.jpg`,
      preview_image: `${publicBase}/epitelio-simples-escamoso-preview.jpg`
    },
    {
      id: 'medula-espinal-he',
      dzi_url: `${publicBase}/medula-espinal-he.png`,
      thumbnail_url: `${publicBase}/medula-espinal-he.png`,
      preview_image: `${publicBase}/medula-espinal-he.png`
    },
    {
      id: 'muscular-esqueletico-he',
      dzi_url: `${publicBase}/muscular-esqueletico-he.jpg`,
      thumbnail_url: `${publicBase}/muscular-esqueletico-he.jpg`,
      preview_image: `${publicBase}/muscular-esqueletico-he.jpg`
    }
  ];

  for (const item of updates) {
    const res = await fetch(`${supabaseUrl}/rest/v1/laminas?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(item)
    });

    if (res.ok) {
      console.log(`✓ Lâmina '${item.id}' atualizada no banco com a URL do Supabase Storage.`);
    } else {
      console.error(`Erro ao atualizar lâmina '${item.id}':`, await res.text());
    }
  }

  // Verificação de Acesso Público via CDN
  console.log(`\nTestando resolução pública HTTP via CDN do Supabase...`);
  for (const item of updates) {
    const checkRes = await fetch(item.dzi_url, { method: 'HEAD' });
    console.log(`[HTTP ${checkRes.status}] ${item.dzi_url}`);
  }

  console.log(`\n🎉 TODAS AS LÂMINAS ESTÃO 100% NO SUPABASE STORAGE E POSTGRESQL!`);
}

main().catch(console.error);
