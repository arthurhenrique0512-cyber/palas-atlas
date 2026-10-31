const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[Erro] Credenciais do Supabase não encontradas no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function uploadDziToStorage(baseName) {
  const dziPath = path.resolve(`assets/histologia/${baseName}.dzi`);
  const filesDir = path.resolve(`assets/histologia/${baseName}_files`);

  if (!fs.existsSync(dziPath)) {
    console.error(`[Erro] Arquivo não encontrado: ${dziPath}`);
    process.exit(1);
  }

  console.log(`[Upload Supabase Storage] Lâmina: ${baseName}`);

  // 1. Upload do arquivo .dzi mestre
  const dziContent = fs.readFileSync(dziPath);
  const { error: dziErr } = await supabase.storage
    .from('laminas-dzi')
    .upload(`${baseName}.dzi`, dziContent, {
      contentType: 'application/xml',
      upsert: true
    });

  if (dziErr) {
    console.error(`Erro ao subir ${baseName}.dzi:`, dziErr.message);
  } else {
    console.log(`✓ ${baseName}.dzi enviado`);
  }

  // 2. Upload recursivo dos azulejos
  function getAllFiles(dirPath, arrayOfFiles = []) {
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

  if (fs.existsSync(filesDir)) {
    const allTiles = getAllFiles(filesDir);
    console.log(`Enviando ${allTiles.length} azulejos para o bucket laminas-dzi...`);

    let uploaded = 0;
    // Envia em lotes de 10 concorrentes para rapidez
    const BATCH_SIZE = 10;
    for (let i = 0; i < allTiles.length; i += BATCH_SIZE) {
      const batch = allTiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (tilePath) => {
          const relativePath = path.relative(path.resolve('assets/histologia'), tilePath);
          const fileData = fs.readFileSync(tilePath);
          await supabase.storage.from('laminas-dzi').upload(relativePath, fileData, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
            upsert: true
          });
        })
      );
      uploaded += batch.length;
      if (uploaded % 100 === 0 || uploaded === allTiles.length) {
        process.stdout.write(`Progresso: ${uploaded}/${allTiles.length} tiles (${Math.round((uploaded / allTiles.length) * 100)}%)\r`);
      }
    }
    console.log(`\n✓ Todos os azulejos enviados com sucesso!`);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/laminas-dzi/${baseName}.dzi`;
  console.log(`\n🎉 URL Pública Global para o CMS:`);
  console.log(publicUrl);
}

const targetName = process.argv[2] || 'osso_maduro_desgaste_ct';
uploadDziToStorage(targetName).catch(console.error);
