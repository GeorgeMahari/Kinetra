"""Renders the app icon, Android adaptive icon layers and splash image from the Kinetra mark.

The geometry and colours are the ones in src/components/brand/Logo.tsx and
src/design-system/tokens.ts (LogoMark: an eight-axis outline with an uneven inner profile,
a gradient fill and a centre dot). Run from mobile/:  python scripts/render-app-icons.py
Needs Pillow. Rendered at 4x and downsampled for smooth edges.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SS = 4  # supersampling factor

FOREST700 = "#2F6B45"
FOREST600 = "#2F7A4F"
FOREST300 = "#7CC796"
BLAZE_BLUE = "#2563C9"
WHITE = "#FFFFFF"

AXES = 8
OUTER = 44
PROFILE = [0.92, 0.62, 0.8, 0.5, 0.86, 0.68, 0.74, 0.56]


def rgb(hex_: str) -> tuple[int, int, int]:
    h = hex_.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def points(radii: list[float], scale: float, ox: float, oy: float) -> list[tuple[float, float]]:
    out = []
    for i, r in enumerate(radii):
        a = math.pi * 2 * i / AXES - math.pi / 2
        out.append((ox + (50 + math.cos(a) * r) * scale, oy + (50 + math.sin(a) * r) * scale))
    return out


def gradient(size: int, c0: str, c1: str) -> Image.Image:
    """Diagonal linear gradient (x1=0,y1=0 -> x2=1,y2=1), like the SVG LinearGradient."""
    a, b = rgb(c0), rgb(c1)
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3)) + (255,)
    return img


def mark(canvas: int, mark_size: float, *, on_shell: bool, mono: bool = False) -> Image.Image:
    """The LogoMark drawn centred on a transparent canvas of `canvas` px."""
    big = canvas * SS
    scale = mark_size * SS / 100
    ox = oy = (big - mark_size * SS) / 2
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    outer = points([OUTER] * AXES, scale, ox, oy)
    if mono:
        ring = (255, 255, 255, 255)
    elif on_shell:
        ring = rgb(WHITE) + (round(255 * 0.4),)
    else:
        ring = rgb(FOREST300) + (round(255 * 0.55),)
    # Closing past the first vertex gives that corner a proper join (no notch at the top).
    draw.line(outer + outer[:2], fill=ring, width=max(1, round(2.5 * scale)), joint="curve")

    profile = points([OUTER * f for f in PROFILE], scale, ox, oy)
    shape = Image.new("L", (big, big), 0)
    ImageDraw.Draw(shape).polygon(profile, fill=255)
    if mono:
        fill = Image.new("RGBA", (big, big), (255, 255, 255, 255))
    else:
        x0 = round(ox)
        size = round(mark_size * SS)
        grad = gradient(size // SS, WHITE if on_shell else FOREST600, FOREST300 if on_shell else BLAZE_BLUE)
        grad = grad.resize((size, size), Image.BILINEAR)
        fill = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        fill.paste(grad, (x0, x0))
    layer.paste(fill, (0, 0), shape)

    cx = cy = big / 2
    r = 4.5 * scale
    dot = (0, 0, 0, 0) if mono else (rgb(FOREST700 if on_shell else WHITE) + (255,))
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=dot)
    return layer.resize((canvas, canvas), Image.LANCZOS)


def solid(canvas: int, color: str) -> Image.Image:
    return Image.new("RGBA", (canvas, canvas), rgb(color) + (255,))


def main() -> None:
    # iOS / generic icon: the shell variant of the mark on the forest shell, no transparency.
    icon = solid(1024, FOREST700)
    icon.alpha_composite(mark(1024, 760, on_shell=True))
    icon.convert("RGB").save(ASSETS / "icon.png")

    # Android adaptive icon: 512 px layers; content kept inside the central safe zone (~66%).
    solid(512, FOREST700).save(ASSETS / "android-icon-background.png")
    mark(512, 300, on_shell=True).save(ASSETS / "android-icon-foreground.png")
    mark(512, 300, on_shell=True, mono=True).save(ASSETS / "android-icon-monochrome.png")

    # Splash: the light-ground mark on a transparent canvas (background colour set in app.json).
    mark(1024, 1024, on_shell=False).save(ASSETS / "splash-icon.png")

    # Web favicon.
    fav = solid(48, FOREST700)
    fav.alpha_composite(mark(48, 40, on_shell=True))
    fav.save(ASSETS / "favicon.png")


if __name__ == "__main__":
    main()
