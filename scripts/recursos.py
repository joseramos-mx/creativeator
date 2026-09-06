# -*- coding: utf-8 -*-
"""
scripts/recursos.py — copia los recursos del kit de marca al proyecto.

Se corre una vez, a mano. Deja en public/ las fuentes, el logotipo en blanco,
el logotipo de la plataforma de citas recoloreado, las fotos de ejemplo y los
iconos de prueba ya normalizados. En la fase 5 los iconos entran por
scripts/ingesta-iconos.ts, que hace lo mismo pero para la coleccion completa.
"""
import os, shutil
from PIL import Image

KIT = r"c:\Users\Norks\Downloads\carruseles-kit"
RAIZ = r"c:\Users\Norks\creativeator"
P = lambda *a: os.path.join(RAIZ, *a)

def dirs(*rutas):
    for r in rutas: os.makedirs(r, exist_ok=True)

dirs(P("public","fonts"), P("public","marca"), P("public","media","impetigo-regreso-a-clases"),
     P("public","iconos","thumbs"), P("referencia"))

# ── fuentes ──────────────────────────────────────────────────────────────────
shutil.copy(os.path.join(KIT,"fuentes","AlbertSans-VariableFont_wght.ttf"), P("public","fonts","AlbertSans.ttf"))
shutil.copy(os.path.join(KIT,"fuentes","Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf"), P("public","fonts","Fraunces.ttf"))
print("fuentes: AlbertSans.ttf, Fraunces.ttf (la italica ya se bajo aparte)")

# ── logotipo de la marca, en blanco ──────────────────────────────────────────
lg = Image.open(os.path.join(KIT,"marca","Mesa de trabajo 1 copia 4logoc.png")).convert("RGBA")
lg.thumbnail((1400, 1400), Image.LANCZOS)
lg.save(P("public","marca","logo-blanco.png"))
print("logo-blanco.png", lg.size)

# ── logotipo de Doctoralia, todo en blanco ───────────────────────────────────
# El archivo del kit trae la estrella en verde; en la referencia va en blanco.
dl = Image.open(os.path.join(KIT,"marca","logo-doctoralia-primary-teal-white.png")).convert("RGBA")
px = dl.load()
for y in range(dl.height):
    for x in range(dl.width):
        r,g,b,a = px[x,y]
        if a: px[x,y] = (255,255,255,a)
dl.thumbnail((1200,1200), Image.LANCZOS)
dl.save(P("public","marca","doctoralia-blanco.png"))
print("doctoralia-blanco.png", dl.size)

# ── fotos de ejemplo ─────────────────────────────────────────────────────────
# Un JPEG de camara de 8 MB no aporta nada a un slide de 1080 px de ancho y
# hace la captura mas lenta: se limita el ancho y se recomprime.
fotos = {"85a72e5d0a48578687c1190d567e84c2.jpg":"portada.jpg",
         "c50a1c8d1cb5a03b532eb5372649ec78.jpg":"01.jpg",
         "3a1e24830ffbd2577ea0d1e2d5ea9184.jpg":"03.jpg"}
for orig, nuevo in fotos.items():
    im = Image.open(os.path.join(KIT,"media-ejemplo",orig)).convert("RGB")
    if im.width > 1600: im = im.resize((1600, round(im.height*1600.0/im.width)), Image.LANCZOS)
    im.save(P("public","media","impetigo-regreso-a-clases",nuevo), quality=88, optimize=True)
    print("media/%s" % nuevo, im.size)

# ── iconos de prueba, normalizados ───────────────────────────────────────────
# Se recorta el margen transparente y se vuelve a centrar sobre un lienzo
# cuadrado con 4 % de aire. Sin esto, dos iconos con el mismo tamano en CSS se
# ven de tamanos distintos: es la queja numero uno al maquetar.
nombres = {
 "image-3QgwSXrWjfSV2HYyhqEm4POcAvaRqP.png":"palomita-verde",
 "image-7yiU0MjbaL2wmQUiRa7RaDh2aqYnog.png":"curitas",
 "image-Ct8sqbDg45AoC6ztFNsOvWhJKzDa1V.png":"llanto",
 "image-GClCrIcEoGpc5hw6WOgnjy6Xh0NLzw(1).png":"alerta",
 "image-KdnyNDpBlR7y0DvMiDhXSQxM6EEkbv.png":"termometro",
 "image-MM6MGpIIMJfVCACaAbhJISGJKR78tb.png":"preservativo",
 "image-OY3MUpW2C7znoiJ6DlQN93Ku9ixhDJ.png":"informacion",
 "image-RSCqQgrjVGAcuRmzFKB3GMNZmCsun8.png":"adn",
 "image-VQR8WD7Kstbbu18lmkBzTDYjRgdiFK.png":"correr",
 "image-eOFnEC0uBB4zGebF8gMWIokSEIDHw8.png":"cuidado-de-piel",
 "image-l42jjw4mexpi6dC9cysObJUsCpzlB3.png":"silencio",
}
for orig, slug in sorted(nombres.items()):
    im = Image.open(os.path.join(KIT,"iconos-prueba",orig)).convert("RGBA")
    caja = im.split()[3].getbbox()
    if caja: im = im.crop(caja)
    lado = int(max(im.size) * 1.08)          # 4 % de aire por lado
    lienzo = Image.new("RGBA", (lado, lado), (0,0,0,0))
    lienzo.paste(im, ((lado-im.width)//2, (lado-im.height)//2), im)
    lienzo.resize((1024,1024), Image.LANCZOS).save(P("public","iconos",slug+".png"))
    lienzo.resize((192,192), Image.LANCZOS).save(P("public","iconos","thumbs",slug+".png"))
print("iconos normalizados:", len(nombres))

# ── capturas de referencia, con nombre por su papel ──────────────────────────
ref = {"Artboard 1 copy 5impetigo.png":"portada.png",
       "Artboard 1 copy 6impetigo.png":"contenido-01.png",
       "Artboard 1 copy 7impetigo.png":"contenido-02.png",
       "Artboard 1 copy 8impetigo.png":"contenido-03.png",
       "Artboard 1 copy 10impetigo.png":"lista-04.png",
       "Artboard 1 copy 11impetigo.png":"contenido-05.png",
       "Artboard 1 copy 9impetigo.png":"cierre-06.png"}
for orig, nuevo in ref.items():
    im = Image.open(os.path.join(KIT,"referencia",orig)).convert("RGB")
    im = im.resize((1080, 1350), Image.LANCZOS)      # al tamano del lienzo
    im.save(P("referencia",nuevo), optimize=True)
print("referencia:", len(ref), "capturas a 1080x1350")
