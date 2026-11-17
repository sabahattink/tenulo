"""
Generates Tenulo's icon, adaptive icon layers, splash images, notification icon and Play Store
graphics.

The mark: a lowercase "t" whose crossbar sprouts a leaf, the "t + sprout" design made in Canva and
redrawn here as geometry so it stays crisp from the 24 dp status bar to the 512 px store icon.
The notification icon (modules/tenulo-native/.../tenulo_ic_notification.xml) is written from the
same geometry.

Deterministic: same input, same pixels. Run from the repo root:
    python scripts/brand.py [path/to/Roboto.ttf]
The font (OFL, github.com/google/fonts; Android's own /system/fonts/Roboto-Regular.ttf works) is
only needed for the store feature graphics and is not shipped in the app.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
STORE = ROOT / "docs" / "store"
NOTIFICATION_ICON = (
    ROOT / "modules" / "tenulo-native" / "android" / "src" / "main" / "res" / "drawable" / "tenulo_ic_notification.xml"
)

SAGE = (47, 107, 91)
SAGE_DEEP = (36, 86, 73)
SAGE_LIGHT = (127, 194, 174)
PAPER = (244, 241, 234)

SUPERSAMPLE = 4

Point = tuple[float, float]
Cubic = tuple[Point, Point, Point, Point]

# The mark on a 24 x 24 grid. Strokes are round-capped tubes STROKE wide; the leaf is filled.
STROKE = 3.0
# The stem, ending in the "t"'s rising hook.
STEM: list[Cubic] = [
    ((10.4, 3.4), (10.4, 3.4), (10.4, 14.6), (10.4, 14.6)),
    ((10.4, 14.6), (10.4, 19.0), (14.2, 20.6), (16.8, 17.2)),
]
CROSSBAR: list[Cubic] = [((6.6, 8.6), (6.6, 8.6), (14.2, 8.6), (14.2, 8.6))]
# The sprout, growing up and to the right from the crossbar's end.
LEAF: list[Cubic] = [
    ((14.2, 8.6), (14.0, 5.0), (16.6, 3.0), (20.0, 2.8)),
    ((20.0, 2.8), (20.2, 6.2), (17.8, 8.6), (14.2, 8.6)),
]
# The middle of the mark's bounding box, placed at the middle of every canvas.
GRID_CENTER = (13.3, 11.9)


def cubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: int = 400) -> list[Point]:
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


def draw_mark(img: Image.Image, center: Point, unit: float, color) -> None:
    """Draws the mark with grid unit `unit` px, grid centre at `center`.

    Strokes are stamped as closely spaced discs: PIL's wide polylines leave notches at every joint,
    discs give a clean round tube with round caps.
    """
    d = ImageDraw.Draw(img)
    cx, cy = center

    def tx(p: Point) -> Point:
        return (cx + (p[0] - GRID_CENTER[0]) * unit, cy + (p[1] - GRID_CENTER[1]) * unit)

    r = STROKE * unit / 2
    for seg in STEM + CROSSBAR:
        for p in cubic(*seg):
            x, y = tx(p)
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    d.polygon([tx(p) for seg in LEAF for p in cubic(*seg)], fill=color)


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


def mark_image(size: int, glyph_fraction: float, color, background=None) -> Image.Image:
    """`glyph_fraction`: width of the 24-unit grid as a fraction of the canvas."""
    s = size * SUPERSAMPLE
    img = background.resize((s, s)) if background is not None else canvas(size)
    draw_mark(img, (s / 2, s / 2), s * glyph_fraction / 24, color)
    return finish(img, size)


def path_data(segments: list[Cubic], close: bool = False) -> str:
    """SVG / VectorDrawable path data for consecutive cubic segments."""

    def f(v: float) -> str:
        return f"{v:g}"

    first = segments[0][0]
    parts = [f"M{f(first[0])},{f(first[1])}"]
    for _, c1, c2, end in segments:
        parts.append(f"C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(end[0])},{f(end[1])}")
    return " ".join(parts) + (" Z" if close else "")


def notification_vector() -> str:
    """The status-bar icon: the mark in white, centred on the 24 dp grid. Android tints it."""
    dx = 12 - GRID_CENTER[0]
    dy = 12 - GRID_CENTER[1]
    stroke = (
        '    <path\n      android:fillColor="#00000000"\n      android:strokeColor="#FFFFFFFF"\n'
        f'      android:strokeWidth="{STROKE:g}"\n      android:strokeLineCap="round"\n'
        '      android:strokeLineJoin="round"\n'
    )
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<!-- Status-bar icon: the app mark, a \"t\" sprouting a leaf. Android tints it; only the alpha\n"
        "     matters. Written by scripts/brand.py from the same geometry as the app icon. -->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '  android:width="24dp"\n  android:height="24dp"\n'
        '  android:viewportWidth="24"\n  android:viewportHeight="24">\n'
        f'  <group android:translateX="{dx:g}" android:translateY="{dy:g}">\n'
        f'{stroke}      android:pathData="{path_data(STEM)}" />\n'
        f'{stroke}      android:pathData="{path_data(CROSSBAR)}" />\n'
        '    <path\n      android:fillColor="#FFFFFFFF"\n'
        f'      android:pathData="{path_data(LEAF, close=True)}" />\n'
        "  </group>\n"
        "</vector>\n"
    )


def main() -> None:
    font_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    ASSETS.mkdir(exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    sage_bg = vertical_gradient(1024, 1024, (52, 117, 99), SAGE_DEEP)

    # Legacy / store icon: full square, Android applies its own mask.
    mark_image(1024, 0.62, PAPER + (255,), background=sage_bg).convert("RGB").save(ASSETS / "icon.png")
    mark_image(512, 0.62, PAPER + (255,), background=sage_bg).convert("RGB").save(STORE / "icon-512.png")

    # Adaptive icon: 108 dp canvas, 66 dp safe circle (r = 313 px of 1024). At 0.54 the mark's
    # farthest point (about 13 grid units from its centre) sits ~302 px out, inside the circle.
    mark_image(1024, 0.54, PAPER + (255,)).save(ASSETS / "android-icon-foreground.png")
    sage_bg.convert("RGB").save(ASSETS / "android-icon-background.png")
    mark_image(1024, 0.54, (255, 255, 255, 255)).save(ASSETS / "android-icon-monochrome.png")

    # Splash: the mark alone; the plugin sets the background color per scheme.
    mark_image(1024, 0.8, SAGE + (255,)).save(ASSETS / "splash-icon.png")
    mark_image(1024, 0.8, SAGE_LIGHT + (255,)).save(ASSETS / "splash-icon-dark.png")

    mark_image(48, 0.7, PAPER + (255,), background=sage_bg).convert("RGB").save(ASSETS / "favicon.png")

    NOTIFICATION_ICON.write_text(notification_vector(), encoding="utf-8", newline="\n")

    if font_path is not None:
        for lang, copy in FEATURE_COPY.items():
            feature_graphic(font_path, sage_bg, copy, STORE / FEATURE_FILES[lang])


# What the app is, per store language. No drug names, no claims.
FEATURE_COPY = {
    "en": ("Your whole day,", "in one calm log.", "GLP-1, weight, food and water.", "No account. Stays on your phone."),
    "tr": ("Bütün günün,", "tek bir sakin kayıtta.", "GLP-1, kilo, beslenme ve su.", "Hesap yok. Telefonunda kalır."),
}
FEATURE_FILES = {"en": "feature-graphic.png", "tr": "feature-graphic-tr.png"}


def feature_graphic(font_path: Path, sage_bg: Image.Image, copy: tuple[str, str, str, str], out: Path) -> None:
    """Play Store feature graphic, 1024 x 500.

    Paper with the welcome screen's paper-cut trend landscape (assets/illustrations, made in Canva)
    on the right, its left edge fading into the paper so the hills have no hard cut.
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
    icon = mark_image(84 * s, 0.62, PAPER + (255,), background=sage_bg)
    rounded = Image.new("L", icon.size, 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, icon.width - 1, icon.height - 1], radius=20 * s, fill=255)
    icon.putalpha(rounded)
    img.alpha_composite(icon, (64 * s, 96 * s))

    ink = (28, 33, 30, 255)
    muted = (91, 97, 92, 255)
    head1, head2, line1, line2 = copy
    d.text((166 * s, 92 * s), "Tenulo", font=font(80, b"Bold"), fill=SAGE + (255,))
    d.text((66 * s, 218 * s), head1, font=font(40, b"Bold"), fill=ink)
    d.text((66 * s, 266 * s), head2, font=font(40, b"Bold"), fill=ink)
    d.text((68 * s, 338 * s), line1, font=font(24, b"Medium"), fill=muted)
    d.text((68 * s, 372 * s), line2, font=font(24, b"Regular"), fill=muted)
    img.resize((w, h), Image.LANCZOS).convert("RGB").save(out)


if __name__ == "__main__":
    main()
