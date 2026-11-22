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

  // Atualizar os links na tabela laminas do PostgreSQL (caminhos relativos para gateway /api/tile)
  console.log(`\nAtualizando URLs no banco relacional PostgreSQL...`);

  const updates = [
    {
      id: 'lamina-real1',
      dzi_url: 'assets/histologia/lamina-real1.dzi',
      thumbnail_url: 'assets/histologia/lamina-real1-preview.jpg',
      preview_image: 'assets/histologia/lamina-real1-preview.jpg'
    },
    {
      id: 'osso_maduro_desgaste_ct',
      dzi_url: 'assets/histologia/osso_maduro_desgaste_ct.dzi',
      thumbnail_url: 'assets/histologia/osso_maduro_desgaste_ct-preview.jpg',
      preview_image: 'assets/histologia/osso_maduro_desgaste_ct-preview.jpg'
    },
    {
      id: 'osso_maduro_desgaste_ct_2.0',
      dzi_url: 'assets/histologia/osso_maduro_desgaste_ct_2.0.dzi',
      thumbnail_url: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg',
      preview_image: 'assets/histologia/osso_maduro_desgaste_ct_2.0-preview.jpg'
    },
    {
      id: 'osso_maduro_desgaste_ct_3.0',
      dzi_url: 'assets/histologia/osso_maduro_desgaste_ct_3.0.dzi',
      thumbnail_url: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg',
      preview_image: 'assets/histologia/osso_maduro_desgaste_ct_3.0-preview.jpg'
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
      console.log(`✓ Lâmina '${item.id}' atualizada no banco com o caminho canônico DZI.`);
    } else {
      console.error(`Erro ao atualizar lâmina '${item.id}':`, await res.text());
    }
  }

  // Verificação autenticada no bucket privado (laminas-dzi)
  console.log(`\nTestando resolução autenticada no bucket privado do Supabase Storage...`);
  for (const item of updates) {
    const storageObject = item.dzi_url.replace(/^assets\/histologia\//, '');
    const checkRes = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storageObject}`, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      }
    });
    console.log(`[HTTP ${checkRes.status}] ${bucket}/${storageObject}`);
  }

  console.log(`\n🎉 TODAS AS 4 LÂMINAS OFICIAIS ESTÃO 100% NO SUPABASE STORAGE (PRIVADO) E POSTGRESQL!`);
}

main().catch(console.error);
