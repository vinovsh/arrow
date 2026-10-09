"""Rasterize the app's SVG previews and compose the first review sheet."""
import json
import math
import pathlib
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

root = pathlib.Path(__file__).resolve().parents[2]
report = json.loads((root/'mock/review-first-20.json').read_text())
out = root/'mock/previews'

def font(size):
    for path in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans.ttf', 'Arial.ttf']:
        try:
            return ImageFont.truetype(path,size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)

for row in report:
    ident = f"level_{row['id']:03}"
    svg = ET.parse(out/f'{ident}.svg').getroot()
    ss = 3
    image = Image.new('RGB',(460*ss,460*ss),'white')
    draw = ImageDraw.Draw(image)
    for path in svg.findall('{http://www.w3.org/2000/svg}path'):
        pts = [( (float(x)+20)*ss, (float(y)+20)*ss) for x,y in re.findall(r'[ML] (-?[\d.]+) (-?[\d.]+)',path.attrib['d'])]
        if path.attrib.get('fill') == 'none':
            width = float(path.attrib['stroke-width'])*ss
            draw.line(pts,fill='#061242',width=round(width),joint='curve')
            for x,y in pts:
                draw.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill='#061242')
        else:
            draw.polygon(pts,fill='#061242')
    image.resize((460,460),Image.Resampling.LANCZOS).save(out/f'{ident}.png')

cols, cw, ch, header = 4, 360, 420, 110
sheet = Image.new('RGB',(cols*cw,5*ch+header),'#f3f5fa')
draw = ImageDraw.Draw(sheet)
draw.text((24,24),'ARROW ESCAPE / FIRST 20',font=font(32),fill='#061242')
draw.text((24,68),'Original replacement designs • Awaiting your review',font=font(18),fill='#536078')
for i,row in enumerate(report):
    x,y = i%cols*cw, i//cols*ch+header
    draw.text((x+18,y+10),f"{row['id']:02}  {row['title']}",font=font(19),fill='#061242')
    draw.text((x+18,y+40),row['tier'],font=font(16),fill='#536078')
    board=Image.open(out/f"level_{row['id']:03}.png").resize((326,326),Image.Resampling.LANCZOS)
    sheet.paste(board,(x+17,y+68))
    draw.text((x+18,y+398),f"{row['arrows']} arrows · {row['freeAtStart']} opening moves",font=font(14),fill='#536078')
sheet.save(root/'mock/first-20-overview.png')
print('20 preview images and first-20-overview.png written.')
