<#
.SYNOPSIS
    Palas Atlas - Renomeador Automático de Fotos de Microscopia por Milissegundos
.DESCRIPTION
    Ordena os arquivos por data/hora exata (com milissegundos) e renomeia substituindo
    o caractere 'x' por 1, 2, 3...
.EXAMPLE
    .\rename_images.ps1 -Dir "C:\fotos\lamina1" -Pattern "musculo_x.jpg"
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$Dir = ".",

    [Parameter(Mandatory=$false)]
    [string]$Pattern = "musculo_x.jpg",

    [switch]$DryRun
)

$targetDir = Resolve-Path $Dir
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🔬 Palas Atlas - Renomeador por Milissegundos (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Diretorio: $targetDir"
Write-Host "Padrao:    $Pattern"
Write-Host "Modo:      $(if ($DryRun) { 'SIMULACAO (DryRun)' } else { 'REAL' })"
Write-Host "============================================================"

if (-not ($Pattern -like "*x*")) {
    Write-Error "O padrao precisa conter a letra 'x' para a numeracao (ex: musculo_x.jpg)"
    exit 1
}

$extensions = @("*.jpg", "*.jpeg", "*.tif", "*.tiff", "*.png", "*.bmp")
$files = Get-ChildItem -Path $targetDir -File | Where-Object { 
    $ext = $_.Extension.ToLower()
    $ext -in @(".jpg", ".jpeg", ".tif", ".tiff", ".png", ".bmp")
}

if ($files.Count -eq 0) {
    Write-Warning "Nenhuma imagem encontrada em $targetDir"
    exit 0
}

# Ordena rigorosamente pelo carimbo de tempo com precisão de milissegundos/ticks
$sortedFiles = $files | Sort-Object -Property @{Expression = { $_.LastWriteTime.Ticks }}

Write-Host "Encontradas $($sortedFiles.Count) imagens em ordem cronologica:`n" -ForegroundColor Green

$renamePlan = @()
$i = 1

foreach ($file in $sortedFiles) {
    $timeFormatted = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss.fff")
    $newName = $Pattern -replace '\{x\}', $i -replace 'x', $i
    $tempName = "__temp_palas_$($i)_$($file.Name)"
    
    Write-Host ("[{0,3}] {1} ({2}) -> {3}" -f $i, $file.Name, $timeFormatted, $newName) -ForegroundColor Gray

    $renamePlan += [PSCustomObject]@{
        Original = $file.FullName
        TempPath = Join-Path $targetDir $tempName
        FinalPath = Join-Path $targetDir $newName
    }
    $i++
}

if ($DryRun) {
    Write-Host "`n[SIMULACAO] Nenhum arquivo foi modificado. Execute sem -DryRun para aplicar." -ForegroundColor Yellow
    exit 0
}

# Passo 1: Renomear para temp (evita colisões)
foreach ($item in $renamePlan) {
    Rename-Item -Path $item.Original -NewName (Split-Path $item.TempPath -Leaf)
}

# Passo 2: Renomear para o nome final
foreach ($item in $renamePlan) {
    Rename-Item -Path $item.TempPath -NewName (Split-Path $item.FinalPath -Leaf)
}

Write-Host "`nArquivos renomeados com sucesso! Pronto para costurar no Fiji." -ForegroundColor Green
