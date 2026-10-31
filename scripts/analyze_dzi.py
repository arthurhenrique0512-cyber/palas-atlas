#!/usr/bin/env python3
"""
Palas Atlas — Analisador Óptico de Arquivos Deep Zoom (DZI)
Uso:
  python3 scripts/analyze_dzi.py <caminho-ou-url.dzi> [maxMagnification]
"""
import sys, os, xml.etree.ElementTree as ET, urllib.request, ssl

def analyze_dzi(source, max_mag=40):
    content = ""
    if source.startswith("http://") or source.startswith("https://"):
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(source, headers={"User-Agent": "PalasAtlas-DziAnalyzer/1.0"})
        with urllib.request.urlopen(req, context=ctx) as resp:
            content = resp.read().decode("utf-8")
    else:
        if not os.path.exists(source):
            print(f"[Erro] Arquivo não encontrado: {source}")
            sys.exit(1)
        with open(source, "r", encoding="utf-8") as f:
            content = f.read()

    root = ET.fromstring(content)
    ns = {"dz": "http://schemas.microsoft.com/deepzoom/2008"}
    size_elem = root.find("dz:Size", ns)
    if size_elem is None:
        size_elem = root.find("Size")

    if size_elem is None:
        print("[Erro] Elemento <Size> não encontrado no arquivo DZI.")
        sys.exit(1)

    width = int(size_elem.attrib.get("Width", 0))
    height = int(size_elem.attrib.get("Height", 0))
    tile_size = int(root.attrib.get("TileSize", 256))
    overlap = int(root.attrib.get("Overlap", 0))
    img_format = root.attrib.get("Format", "jpg")

    megapixels = (width * height) / 1_000_000
    aspect_ratio = width / height if height > 0 else 1.0

    prop_4x = (4.0 / max_mag) * 100
    prop_10x = (10.0 / max_mag) * 100
    prop_40x = (40.0 / max_mag) * 100
    prop_60x = (60.0 / max_mag) * 100
    prop_100x = (100.0 / max_mag) * 100

    print("=" * 65)
    print("🔬 PALAS ATLAS • RELATÓRIO DE CALIBRAÇÃO ÓPTICA DZI")
    print("=" * 65)
    print(f"Origem do DZI:       {source}")
    print(f"Resolução Nativa:    {width:,} × {height:,} pixels ({megapixels:.2f} MP)")
    print(f"Proporção de Tela:   {aspect_ratio:.3f} : 1 ({'Paisagem' if aspect_ratio > 1 else 'Retrato/Faixa'})")
    print(f"Configuração Pirâmide: TileSize={tile_size}px, Overlap={overlap}px, Formato={img_format}")
    print(f"Objetiva de Captura: {max_mag}x (100% da resolução 1:1)")
    print("-" * 65)
    print("📐 PROPORÇÕES ÓPTICAS EXATAS PARA O MICROSCÓPIO DIGITAL:")
    print(f"  • Objetiva  4x (Panorâmica):   {prop_4x:5.1f}% da resolução ({int(width * (4.0/max_mag)):,} × {int(height * (4.0/max_mag)):,} px)")
    print(f"  • Objetiva 10x (Médio Aumento):{prop_10x:5.1f}% da resolução ({int(width * (10.0/max_mag)):,} × {int(height * (10.0/max_mag)):,} px)")
    print(f"  • Objetiva 40x (Alta Resolução):{prop_40x:5.1f}% da resolução ({int(width * (40.0/max_mag)):,} × {int(height * (40.0/max_mag)):,} px) [1:1 Nativo]")
    if max_mag >= 60:
        print(f"  • Objetiva 60x:                {prop_60x:5.1f}% da resolução ({int(width * (60.0/max_mag)):,} × {int(height * (60.0/max_mag)):,} px)")
    if max_mag >= 100:
        print(f"  • Objetiva 100x (Imersão):     {prop_100x:5.1f}% da resolução ({int(width * (100.0/max_mag)):,} × {int(height * (100.0/max_mag)):,} px)")
    print("-" * 65)
    print("Fórmula aplicada no motor OpenSeadragon:")
    print("  Zoom(M) = nativeZoom * (M / maxMagnification)")
    print("  Magnificação(Zoom) = maxMagnification * (ZoomAtual / nativeZoom)")
    print("=" * 65)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/analyze_dzi.py <caminho-ou-url.dzi> [maxMagnification]")
        sys.exit(1)
    src = sys.argv[1]
    mag = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    analyze_dzi(src, mag)
