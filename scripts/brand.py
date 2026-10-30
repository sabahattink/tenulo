"""
Generates Tenulo's icon, adaptive icon layers, splash images and Play Store graphics.

The mark: a smooth trend line falling through a scatter of faint daily readings, ending in a dot.
It is the app's one idea (a calm trend through noisy weigh-ins) and the same shape as the
notification icon in modules/tenulo-native.

Deterministic: same input, same pixels. Run from the repo root:
    python scripts/brand.py [path/to/Roboto.ttf]
The font (OFL, github.com/google/fonts) is only needed for the store feature graphic and is not
shipped in the app.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
STORE = ROOT / "docs" / "store"

SAGE = (47, 107, 91)
SAGE_DEEP = (36, 86, 73)
SAGE_LIGHT = (127, 194, 174)
PAPER = (244, 241, 234)
NIGHT = (16, 20, 18)

SUPERSAMPLE = 4

# The mark on a 24 x 24 grid (same geometry as the notification vector): a descending sigmoid,
# steep in the middle and levelling off, like a trend settling; the end is the chart's own
# "latest point" marker, a dot in a soft halo.
SEGMENTS = [
    ((3.5, 7.0), (7.0, 7.0), (9.0, 9.0), (11.5, 11.5)),
    ((11.5, 11.5), (14.0, 14.0), (15.8, 16.2), (18.8, 16.2)),
]
END = (18.8, 16.2)
DOT_R = 1.9
HALO_R = 3.4
READINGS = [(5.4, 9.8), (7.9, 5.4), (10.2, 13.2), (12.9, 9.3), (14.6, 16.9), (16.6, 13.3)]
READING_R = 0.85
STROKE = 2.2
GRID_CENTER = (12.4, 12.1)


def cubic(p0, p1, p2, p3, steps=400):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append(
            (
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            )
        )
    return out


def curve_points():
    pts = []
    for seg in SEGMENTS:
        pts.extend(cubic(*seg) if not pts else cubic(*seg)[1:])
    return pts


def disc(d: ImageDraw.ImageDraw, x: float, y: float, r: float, fill) -> None:
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_mark(img: Image.Image, center: tuple[float, float], unit: float, color, soft_color, readings=True):
    """Draws the mark with grid unit `unit` px, grid centre at `center`.

    The stroke is stamped as closely spaced discs: PIL's wide polylines leave notches at every
    joint, discs give a clean round tube with round caps.
    """
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    cx, cy = center

    def tx(p):
        return (cx + (p[0] - GRID_CENTER[0]) * unit, cy + (p[1] - GRID_CENTER[1]) * unit)

    if readings:
        for p in READINGS:
            disc(hd, *tx(p), READING_R * unit, soft_color)
    disc(hd, *tx(END), HALO_R * unit, soft_color)
    img.alpha_composite(halo)

    d = ImageDraw.Draw(img)
    r = STROKE * unit / 2
    for p in curve_points():
        disc(d, *tx(p), r, color)
    disc(d, *tx(END), DOT_R * unit, color)


def canvas(size: int, fill=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", (size * SUPERSAMPLE, size * SUPERSAMPLE), fill)


def finish(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def vertical_gradient(w: int, h: int, top, bottom) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return img


def mark_image(size: int, glyph_fraction: float, color, reading_color, background=None, readings=True) -> Image.Image:
    """`glyph_fraction`: width of the 24-unit grid as a fraction of the canvas."""
    s = size * SUPERSAMPLE
    img = background.resize((s, s)) if background is not None else canvas(size)
    unit = s * glyph_fraction / 24
    draw_mark(img, (s / 2, s / 2), unit, color, reading_color, readings)
    return finish(img, size)


def main() -> None:
    font_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    ASSETS.mkdir(exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    reading_on_sage = SAGE_LIGHT + (150,)
    sage_bg = vertical_gradient(1024, 1024, (52, 117, 99), SAGE_DEEP)

    # Legacy / store icon: full square, Android applies its own mask.
    mark_image(1024, 0.66, PAPER + (255,), reading_on_sage, background=sage_bg).convert("RGB").save(ASSETS / "icon.png")
    mark_image(512, 0.66, PAPER + (255,), reading_on_sage, background=sage_bg).convert("RGB").save(STORE / "icon-512.png")

    # Adaptive icon: 108 dp canvas, 66 dp safe circle (r = 313 px of 1024). At 0.52 the mark's
    # bounding-box corners sit ~276 px from the centre, inside the circle.
    mark_image(1024, 0.52, PAPER + (255,), reading_on_sage).save(ASSETS / "android-icon-foreground.png")
    sage_bg.convert("RGB").save(ASSETS / "android-icon-background.png")
    mark_image(1024, 0.52, (255, 255, 255, 255), (255, 255, 255, 120)).save(ASSETS / "android-icon-monochrome.png")

    # Splash: the mark alone; the plugin sets the background color per scheme.
    mark_image(1024, 0.86, SAGE + (255,), SAGE + (70,)).save(ASSETS / "splash-icon.png")
    mark_image(1024, 0.86, SAGE_LIGHT + (255,), SAGE_LIGHT + (80,)).save(ASSETS / "splash-icon-dark.png")

    mark_image(48, 0.7, PAPER + (255,), reading_on_sage, background=sage_bg).convert("RGB").save(ASSETS / "favicon.png")

    if font_path is not None:
        feature_graphic(font_path, sage_bg)


def feature_graphic(font_path: Path, sage_bg: Image.Image) -> None:
    """Play Store feature graphic, 1024 x 500. No drug names, no claims: what the app is.

    Warm paper with the welcome screen's paper-cut trend landscape (assets/illustrations, made in
    Canva) on the right, its left edge fading into the paper so the hills have no hard cut.
    """
    w, h = 1024, 500
    s = SUPERSAMPLE
    art = Image.open(ASSETS / "illustrations" / "trend.webp").convert("RGB")
    paper = art.getpixel((art.width - 8, 8))  # the illustration's own paper, so the seams vanish
    img = Image.new("RGBA", (w * s, h * s), paper + (255,))

    # The landscape band of the 960 px square, scaled to sit on the bottom edge.
    band = art.crop((30, 200, 960, 880)).resize((620 * s, 453 * s), Image.LANCZOS).convert("RGBA")
    # linear_gradient runs black to white downwards; turned a quarter it runs left to right.
    fade = Image.linear_gradient("L").rotate(90, expand=True).resize((220 * s, band.height))
    mask = Image.new("L", band.size, 255)
    mask.paste(fade, (0, 0))
    band.putalpha(mask)
    img.alpha_composite(band, ((w - 620) * s, (h - 453) * s))

    d = ImageDraw.Draw(img)

    def font(size: int, weight: bytes) -> ImageFont.FreeTypeFont:
        f = ImageFont.truetype(str(font_path), size * s)
        f.set_variation_by_name(weight)
        return f

    # The app icon beside the name, rounded like a launcher would show it.
    icon = mark_image(84 * s, 0.66, PAPER + (255,), SAGE_LIGHT + (150,), background=sage_bg)
    rounded = Image.new("L", icon.size, 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, icon.width - 1, icon.height - 1], radius=20 * s, fill=255)
    icon.putalpha(rounded)
    img.alpha_composite(icon, (64 * s, 96 * s))

    ink = (28, 33, 30, 255)
    muted = (91, 97, 92, 255)
    d.text((166 * s, 92 * s), "Tenulo", font=font(80, b"Bold"), fill=SAGE + (255,))
    d.text((66 * s, 218 * s), "Your trend,", font=font(40, b"Bold"), fill=ink)
    d.text((66 * s, 266 * s), "not the noise.", font=font(40, b"Bold"), fill=ink)
    d.text((68 * s, 338 * s), "Private GLP-1 and weight log.", font=font(24, b"Medium"), fill=muted)
    d.text((68 * s, 372 * s), "No account. Stays on your phone.", font=font(24, b"Regular"), fill=muted)
    img.resize((w, h), Image.LANCZOS).convert("RGB").save(STORE / "feature-graphic.png")


if __name__ == "__main__":
    main()
