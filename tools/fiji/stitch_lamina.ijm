// ==============================================================================
// Palas Atlas - Macro de Stitching (Costura) Automatizado para Fiji (ImageJ)
// ==============================================================================
// Varredura: Serpente por colunas (Desce -> Direita -> Sobe -> Direita -> Desce...)
// Algoritmo: Grid/Collection stitching (Stephan Preibisch)
// ==============================================================================

#@ File (label="Diretório das imagens:", style="directory") inputDir
#@ String (label="Padrão do nome do arquivo (use {i}):", value="musculo_{i}.jpg") filePattern
#@ Integer (label="Colunas (Grid Size X - passos horizontais):", value=3) gridX
#@ Integer (label="Linhas (Grid Size Y - passos verticais):", value=4) gridY
#@ Integer (label="Overlap aproximado (%):", value=15) overlap
#@ Boolean (label="Salvar resultado automaticamente como TIF?", value=true) saveTif

// Formatar barra de diretório para evitar problemas no Windows
dirStr = replace(inputDir, "\\", "/");
if (!endsWith(dirStr, "/")) {
    dirStr = dirStr + "/";
}

totalImages = gridX * gridY;
print("\\Clear");
print("=======================================================");
print("🔬 Palas Atlas - Iniciando Costura da Lâmina");
print("=======================================================");
print("Diretório: " + dirStr);
print("Padrão:    " + filePattern);
print("Grade:     " + gridX + " colunas x " + gridY + " linhas (" + totalImages + " fotos)");
print("Overlap:   " + overlap + "%");
print("Modo:      Snake by Columns (Down & Right)");
print("=======================================================");

// Parâmetros do plugin Grid/Collection stitching
stitchParams = "type=[Grid: snake by columns] " +
               "order=[Down & Right] " +
               "grid_size_x=" + gridX + " " +
               "grid_size_y=" + gridY + " " +
               "tile_overlap=" + overlap + " " +
               "first_file_index_i=1 " +
               "directory=[" + dirStr + "] " +
               "file_names=" + filePattern + " " +
               "output_textfile_name=TileConfiguration.txt " +
               "fusion_method=[Linear Blending] " +
               "regression_threshold=0.30 " +
               "max/avg_displacement_threshold=2.50 " +
               "absolute_displacement_threshold=3.50 " +
               "compute_overlap " +
               "subpixel_accuracy " +
               "computation_parameters=[Save computation time (but use more RAM)] " +
               "image_output=[Fuse and display]";

print("Executando Grid/Collection stitching...");
run("Grid/Collection stitching", stitchParams);

// Renomear a janela final
rename("Palas_Lamina_Costurada");

if (saveTif) {
    outPath = dirStr + "lamina_completa_costurada.tif";
    print("Salvando imagem composta em: " + outPath);
    saveAs("Tiff", outPath);
    print("✅ Imagem salva com sucesso!");
}

print("🎉 Processamento concluído com sucesso!");
