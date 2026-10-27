/**
 * Palas Atlas - Organizador e Renomeador de Imagens de Microscopia
 * 
 * Ordena fotos por timestamp exato (milissegundos) de criação/modificação
 * e renomeia substituindo o caractere 'x' (ou '{x}') pelo índice sequencial (1, 2, 3...).
 * 
 * Uso:
 *   node rename_images.js --dir "C:\caminho\das\fotos" --pattern "musculo_x.jpg"
 * 
 * Exemplo de resultado:
 *   musculo_1.jpg, musculo_2.jpg, musculo_3.jpg ...
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  let dir = process.cwd();
  let pattern = 'campo_x.jpg';
  let dryRun = false;
  let useMtime = false; // default to birthtime (creation time), fallback to mtime

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' || args[i] === '-d') {
      dir = args[++i];
    } else if (args[i] === '--pattern' || args[i] === '-p') {
      pattern = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--mtime') {
      useMtime = true;
    }
  }

  return { dir: path.resolve(dir), pattern, dryRun, useMtime };
}

function run() {
  const { dir, pattern, dryRun, useMtime } = parseArgs();

  console.log('='.repeat(60));
  console.log('🔬 Palas Atlas - Renomeador de Imagens por Milissegundos');
  console.log('='.repeat(60));
  console.log(`📁 Diretório: ${dir}`);
  console.log(`🏷️  Padrão:    ${pattern}`);
  console.log(`⚙️  Modo:      ${dryRun ? 'DRY-RUN (Simulação - sem alterar arquivos)' : 'REAL (Renomeando)'}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(dir)) {
    console.error(`❌ Erro: Diretório não encontrado: ${dir}`);
    process.exit(1);
  }

  if (!pattern.includes('x') && !pattern.includes('{x}')) {
    console.error(`❌ Erro: O padrão precisa conter 'x' para a numeração (ex: musculo_x.jpg)`);
    process.exit(1);
  }

  // Extensões de imagem comuns de câmeras de microscópio
  const validExts = ['.jpg', '.jpeg', '.tif', '.tiff', '.png', '.bmp'];

  // Listar arquivos
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const imageFiles = entries
    .filter(e => e.isFile() && validExts.includes(path.extname(e.name).toLowerCase()))
    .map(e => {
      const fullPath = path.join(dir, e.name);
      const stat = fs.statSync(fullPath);
      // Precisão em milissegundos
      // birthtimeMs é criação; mtimeMs é modificação (salvamento na câmera)
      const timeMs = useMtime ? stat.mtimeMs : (stat.birthtimeMs || stat.mtimeMs);
      return {
        name: e.name,
        fullPath,
        timeMs,
        date: new Date(timeMs).toISOString()
      };
    });

  if (imageFiles.length === 0) {
    console.warn(`⚠️ Nenhuma imagem encontrada em ${dir}`);
    return;
  }

  // Ordenar cronologicamente estrito por milissegundos
  imageFiles.sort((a, b) => a.timeMs - b.timeMs);

  console.log(`📸 Encontradas ${imageFiles.length} imagens. Ordem cronológica detectada:\n`);

  // Renomear em duas etapas para evitar conflitos de nomes existentes
  const tempRenames = [];
  imageFiles.forEach((file, idx) => {
    const indexNumber = idx + 1; // 1, 2, 3...
    const newName = pattern.replace('{x}', indexNumber).replace('x', indexNumber);
    const tempName = `__temp_palas_${Date.now()}_${idx}_${file.name}`;
    
    console.log(`[${indexNumber.toString().padStart(3, ' ')}] ${file.name} (${file.date}) -> ${newName}`);

    tempRenames.push({
      original: file.fullPath,
      temp: path.join(dir, tempName),
      final: path.join(dir, newName)
    });
  });

  if (dryRun) {
    console.log('\n✅ Simulação concluída com sucesso. Nenhuma alteração foi gravada.');
    console.log('Para aplicar, execute sem a flag --dry-run');
    return;
  }

  // Passo 1: Mover para nomes temporários
  for (const item of tempRenames) {
    fs.renameSync(item.original, item.temp);
  }

  // Passo 2: Mover para nomes finais
  for (const item of tempRenames) {
    fs.renameSync(item.temp, item.final);
  }

  console.log(`\n🎉 Sucesso! ${tempRenames.length} arquivos renomeados perfeitamente.`);
  console.log(`Agora abra o Fiji e execute o macro de stitching com o padrão: ${pattern.replace('{x}', '{i}').replace('x', '{i}')}`);
}

run();
