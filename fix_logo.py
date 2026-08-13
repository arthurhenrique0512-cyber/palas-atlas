from PIL import Image
import os

try:
    img_path = 'assets/logo-simplificada.png'
    out_path = 'assets/logo-transparente.png'
    
    if not os.path.exists(img_path):
        print(f"Erro: Arquivo original {img_path} não encontrado.")
        exit(1)

    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    # Replace white-ish background with transparent
    for item in datas:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(out_path, 'PNG')
    print("Logo fixa gerada com sucesso e salva em", out_path)
except Exception as e:
    print(f"Erro ao processar imagem: {e}")
