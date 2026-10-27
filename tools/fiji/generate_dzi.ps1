param (
    [Parameter(Mandatory=$true)]
    [string]$ImagePath,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "assets\histologia",

    [Parameter(Mandatory=$false)]
    [string]$BaseName = "osso_maduro_desgaste_ct",

    [Parameter(Mandatory=$false)]
    [int]$TileSize = 256,

    [Parameter(Mandatory=$false)]
    [int]$Overlap = 0,

    [Parameter(Mandatory=$false)]
    [string]$Format = "jpg",

    [Parameter(Mandatory=$false)]
    [int]$Quality = 90
)

Add-Type -AssemblyName System.Drawing

$resolvedImage = (Resolve-Path $ImagePath).Path
Write-Host "============================================================"
Write-Host "Palas Atlas - Gerador de Piramide Deep Zoom (DZI)"
Write-Host "============================================================"
Write-Host "Imagem Fonte: $resolvedImage"
Write-Host "Diretorio:    $OutputDir"
Write-Host "BaseName:     $BaseName"
Write-Host "TileSize:     $TileSize | Overlap: $Overlap | Formato: $Format"
Write-Host "============================================================"

if (-not (Test-Path $resolvedImage)) {
    Write-Error "Imagem nao encontrada: $resolvedImage"
    exit 1
}

# Criar pasta de saida
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$filesDir = Join-Path $OutputDir ($BaseName + "_files")
if (-not (Test-Path $filesDir)) {
    New-Item -ItemType Directory -Path $filesDir -Force | Out-Null
}

$dziPath = Join-Path $OutputDir ($BaseName + ".dzi")

# Carregar imagem mestre
$sourceBmp = [System.Drawing.Bitmap]::FromFile($resolvedImage)
$fullWidth = $sourceBmp.Width
$fullHeight = $sourceBmp.Height

Write-Host "Dimensoes da Imagem Mestre: $fullWidth x $fullHeight px"

# Calcular numero de niveis (N)
$maxDim = [math]::Max($fullWidth, $fullHeight)
$maxLevel = [int][math]::Ceiling([math]::Log($maxDim, 2))

Write-Host "Niveis da Piramide: 0 ate $maxLevel (Total: $($maxLevel + 1) niveis)"

# Escrever arquivo .dzi
$dziContent = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`r`n<Image TileSize=`"$TileSize`" Overlap=`"$Overlap`" Format=`"$Format`" xmlns=`"http://schemas.microsoft.com/deepzoom/2008`">`r`n  <Size Width=`"$fullWidth`" Height=`"$fullHeight`"/>`r`n</Image>"
Set-Content -Path $dziPath -Value $dziContent -Encoding utf8
Write-Host "Arquivo DZI criado em: $dziPath"

# Configurar encoder JPEG com qualidade
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

# Pre-calcular dimensoes de cada nivel de N ate 0
$levels = @()
$currW = $fullWidth
$currH = $fullHeight

for ($lvl = $maxLevel; $lvl -ge 0; $lvl--) {
    $levels += [PSCustomObject]@{
        Level = $lvl
        Width = $currW
        Height = $currH
    }
    $currW = [math]::Max(1, [int][math]::Ceiling($currW / 2))
    $currH = [math]::Max(1, [int][math]::Ceiling($currH / 2))
}

$levelDict = @{}
foreach ($l in $levels) {
    $levelDict[$l.Level] = $l
}

$totalTiles = 0

for ($lvl = $maxLevel; $lvl -ge 0; $lvl--) {
    $lvlInfo = $levelDict[$lvl]
    $w = $lvlInfo.Width
    $h = $lvlInfo.Height

    $lvlDir = Join-Path $filesDir "$lvl"
    if (-not (Test-Path $lvlDir)) {
        New-Item -ItemType Directory -Path $lvlDir -Force | Out-Null
    }

    $bmpToSlice = $null
    $needsDispose = $false

    if ($lvl -eq $maxLevel) {
        $bmpToSlice = $sourceBmp
    } else {
        $bmpToSlice = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($bmpToSlice)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($sourceBmp, 0, 0, $w, $h)
        $g.Dispose()
        $needsDispose = $true
    }

    $numCols = [int][math]::Ceiling($w / $TileSize)
    $numRows = [int][math]::Ceiling($h / $TileSize)

    for ($col = 0; $col -lt $numCols; $col++) {
        for ($row = 0; $row -lt $numRows; $row++) {
            $tileX = $col * $TileSize
            $tileY = $row * $TileSize
            $tileW = [math]::Min($TileSize, ($w - $tileX))
            $tileH = [math]::Min($TileSize, ($h - $tileY))

            if ($tileW -gt 0 -and $tileH -gt 0) {
                $srcRect = New-Object System.Drawing.Rectangle($tileX, $tileY, $tileW, $tileH)
                $tileBmp = New-Object System.Drawing.Bitmap($tileW, $tileH)
                $tg = [System.Drawing.Graphics]::FromImage($tileBmp)
                $destRect = New-Object System.Drawing.Rectangle(0, 0, $tileW, $tileH)
                $tg.DrawImage($bmpToSlice, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
                $tg.Dispose()

                $tileName = "$col" + "_" + "$row" + "." + $Format
                $tileFile = Join-Path $lvlDir $tileName

                if ($Format -eq "jpg" -or $Format -eq "jpeg") {
                    $tileBmp.Save($tileFile, $jpegCodec, $encoderParams)
                } else {
                    $tileBmp.Save($tileFile, [System.Drawing.Imaging.ImageFormat]::Png)
                }

                $tileBmp.Dispose()
                $totalTiles++
            }
        }
    }

    if ($needsDispose) {
        $bmpToSlice.Dispose()
    }

    $tilesInLvl = $numCols * $numRows
    Write-Host ("Nivel " + $lvl + ": " + $w + "x" + $h + " px (" + $numCols + " colunas x " + $numRows + " linhas = " + $tilesInLvl + " tiles)")
}

$sourceBmp.Dispose()
$encoderParams.Dispose()

Write-Host "============================================================"
Write-Host "Piramide Deep Zoom concluida com sucesso!"
Write-Host "Total de Tiles gerados: $totalTiles"
Write-Host "DZI: $dziPath"
Write-Host "============================================================"
