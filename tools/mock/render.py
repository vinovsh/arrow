"""
Draws mock/data/level_NNN.json as mock/level_NNN.png, plus mock/overview.png.

    python tools/mock/render.py [FROM TO]

With a range, only those levels are drawn and the overview is written as
mock/overview_FROM_TO.png; without one, everything is drawn into mock/overview.png.

Board style follows the game and ref/Arrow: navy arrows on white, thin strokes, a
solid arrowhead at the head end. A faint dot marks every cell of the full grid so the
matrix size reads at a glance.
"""
import json
import math
import os
import glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "mock", "data")
OUT = os.path.join(ROOT, "mock")

NAVY = (6, 18, 66)
DOT = (214, 219, 232)
INK = (20, 24, 40)
MUTED = (110, 118, 140)
BG = (255, 255, 255)
PAGE = (243, 245, 250)
TIER = {
    "Easy": (46, 160, 90),
    "Medium": (40, 110, 220),
    "Hard": (235, 130, 20),
    "Very Hard": (215, 45, 60),
}
DIR = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}


def font(size, bold=False):
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(os.path.join("C:\\Windows\\Fonts", n), size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_board(level, size_px, ss=3, dots=True):
    """Render the board alone, supersampled, returns an RGB image size_px square."""
    n = level["gridSize"]
    S = size_px * ss
    pad = S * 0.03
    cell = (S - 2 * pad) / n
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)

    def c(x, y):
        return (pad + (x + 0.5) * cell, pad + (y + 0.5) * cell)

    if dots:
        r = max(1.0, cell * 0.06)
        for y in range(n):
            for x in range(n):
                cx, cy = c(x, y)
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DOT)

    w = max(2, int(round(cell * 0.2)))
    head_len = cell * 0.42
    head_half = cell * 0.27
    for a in level["arrows"]:
        cells = a["cells"]
        dx, dy = DIR[a["direction"]]
        pts = [c(x, y) for x, y in cells]
        hx, hy = pts[-1]
        # the line runs to the base of the arrowhead, which sits past the head cell centre
        tip = (hx + dx * cell * 0.4, hy + dy * cell * 0.4)
        base = (tip[0] - dx * head_len, tip[1] - dy * head_len)
        line = pts[:-1] + [base] if len(pts) > 1 else [(hx - dx * cell * 0.35, hy - dy * cell * 0.35), base]
        if len(pts) > 1 and (base[0] - pts[-1][0]) * dx + (base[1] - pts[-1][1]) * dy < 0:
            line = pts[:-1] + [pts[-1]]
        d.line(line, fill=NAVY, width=w, joint="curve")
        for p in line:
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=NAVY)
        px, py = -dy, dx
        tri = [
            tip,
            (base[0] + px * head_half, base[1] + py * head_half),
            (base[0] - px * head_half, base[1] - py * head_half),
        ]
        d.polygon(tri, fill=NAVY)
    return img.resize((size_px, size_px), Image.LANCZOS)


def pill(d, x, y, text, fnt, fg, bg):
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    w, h = r - l, b - t
    padx, pady = int(h * 0.9), int(h * 0.55)
    d.rounded_rectangle([x, y, x + w + 2 * padx, y + h + 2 * pady], radius=(h + 2 * pady) // 2, fill=bg)
    d.text((x + padx - l, y + pady - t), text, font=fnt, fill=fg)
    return x + w + 2 * padx


def card(level):
    W, H = 1080, 1400
    img = Image.new("RGB", (W, H), PAGE)
    d = ImageDraw.Draw(img)
    n = level["gridSize"]
    tier = level["tier"]
    s = level["stats"]
    d.text((60, 44), f"LEVEL {level['id']}", font=font(76, True), fill=INK)
    x = pill(d, 62, 150, f"{n} x {n}", font(34, True), (255, 255, 255), INK)
    x = pill(d, x + 16, 150, tier.upper(), font(34, True), (255, 255, 255), TIER[tier])
    sym = {"mirror": "Mirror symmetric", "rot4": "4-fold rotational", "rot2": "2-fold rotational",
           "partial": "Symmetric outline, asymmetric arrows", "none": "Asymmetric"}[level["symmetry"]]
    d.text((64, 222), f"{level['title']}  ·  {sym}", font=font(34), fill=MUTED)

    board_px = 960
    bx, by = 60, 300
    d.rounded_rectangle([bx - 6, by - 6, bx + board_px + 6, by + board_px + 6], radius=28, fill=BG)
    img.paste(draw_board(level, board_px), (bx, by))

    f = font(28)
    fb = font(28, True)
    items = [
        ("Arrows", s["arrows"]),
        ("Longest chain", s["depth"]),
        ("Free at start", s["freeAtStart"]),
        ("Blocked at start", f"{s['blockedStart']}%"),
        ("Avg length", s["meanLength"]),
        ("Turns", s["turns"]),
    ]
    cx = 64
    for label, value in items:
        d.text((cx, 1290), str(value), font=fb, fill=INK)
        d.text((cx, 1326), label, font=font(22), fill=MUTED)
        cx += 162
    return img


def overview(levels):
    cols = 8
    thumb = 300
    lab = 64
    gap = 18
    rows = math.ceil(len(levels) / cols)
    W = cols * thumb + (cols + 1) * gap
    H = 150 + rows * (thumb + lab) + (rows + 1) * gap
    img = Image.new("RGB", (W, H), PAGE)
    d = ImageDraw.Draw(img)
    d.text((gap + 6, 30), f"ARROW ESCAPE — MOCK LEVELS {levels[0]['id']}-{levels[-1]['id']}", font=font(52, True), fill=INK)
    lx = gap + 8
    for t, col in TIER.items():
        lx = pill(d, lx, 100, t, font(22, True), (255, 255, 255), col) + 10
    for i, lv in enumerate(levels):
        r, cidx = divmod(i, cols)
        x = gap + cidx * (thumb + gap)
        y = 150 + gap + r * (thumb + lab + gap)
        d.rounded_rectangle([x, y, x + thumb, y + thumb + lab], radius=14, fill=BG)
        img.paste(draw_board(lv, thumb - 16, ss=3, dots=False), (x + 8, y + 8))
        col = TIER[lv["tier"]]
        d.rectangle([x, y + thumb + 4, x + 8, y + thumb + lab - 10], fill=col)
        d.text((x + 16, y + thumb), f"L{lv['id']}  {lv['gridSize']}x{lv['gridSize']}", font=font(24, True), fill=INK)
        d.text((x + 16, y + thumb + 30), f"{lv['tier']} · {lv['title']} · {lv['stats']['arrows']}", font=font(18), fill=col)
    return img


def main():
    import sys
    lo, hi = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 10**9)
    files = sorted(glob.glob(os.path.join(DATA, "level_*.json")))
    levels = []
    for f in files:
        with open(f) as fh:
            lv = json.load(fh)
        if not lo <= lv["id"] <= hi:
            continue
        levels.append(lv)
        card(lv).save(os.path.join(OUT, f"level_{lv['id']:03d}.png"), optimize=True)
    levels.sort(key=lambda l: l["id"])
    name = "overview.png" if len(sys.argv) <= 2 else f"overview_{lo:03d}_{hi:03d}.png"
    overview(levels).save(os.path.join(OUT, name), optimize=True)
    print(f"rendered {len(levels)} levels + overview")


if __name__ == "__main__":
    main()
