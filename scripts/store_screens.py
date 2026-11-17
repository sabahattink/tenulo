"""
Composes Tenulo's Play Store phone screenshots: a caption over the real app screen in a phone frame.

One set per store language. Inputs are raw device captures (1080 x 2400) in
docs/store/screenshots/raw/<lang>/, taken from a release build with the sample backup restored
(never real data) and the phone set to that language. Output is 1080 x 1920 (9:16) PNGs in
docs/store/screenshots/<lang>/. Captions match docs/store/listing.md. Deterministic: same input,
same pixels. Run from the repo root:
    python scripts/store_screens.py path/to/Roboto.ttf

No drug or food brand names and no medical claims in captions (AGENTS.md).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "docs" / "store" / "screenshots" / "raw"
OUT = ROOT / "docs" / "store" / "screenshots"

W, H = 1080, 1920
SUPERSAMPLE = 2
PAPER = (244, 241, 234)
SAGE = (47, 107, 91)
INK = (28, 33, 30)
MUTED = (91, 97, 92)
BEZEL = (28, 33, 30)

# Per store language: (raw file, output file, title, subtitle). Order and titles as in listing.md.
SCREENS: dict[str, list[tuple[str, str, str, str]]] = {
    "tr": [
        ("today.png", "01-today.png", "Günün\ntek bakışta", "Kalori, protein ve su, kendi hedeflerinle."),
        ("food.png", "02-food.png", "Ne yediğin,\nkolayca", "Öğünü seç, yiyeceği ara, porsiyonu seç."),
        ("progress.png", "03-trend.png", "Gürültü değil,\ntrend", "Günlük tartımların, önemli olan çizgide."),
        ("injection.png", "04-injection.png", "Senin planın,\nsenin bölgen", "Her iğneyi kaydet; en uzun süredir dinlenen bölgeyi gör."),
        ("welcome-private.png", "05-private.png", "Her şey\nbu telefonda", "Hesap yok. Analitik yok. Reklam yok."),
    ],
    "en": [
        ("today.png", "01-today.png", "Your day\nat a glance", "Energy, protein and water, against your own goals."),
        ("food.png", "02-food.png", "What you eat,\nmade easy", "Pick the meal, find the food, choose the portion."),
        ("progress.png", "03-trend.png", "Your trend,\nnot the noise", "Daily weigh-ins smoothed into the line that matters."),
        ("injection.png", "04-injection.png", "Your plan,\nyour sites", "Log each injection; see the site you used longest ago."),
        ("welcome-private.png", "05-private.png", "It stays on\nthis phone", "No account. No analytics. No ads."),
    ],
}

# Phone geometry on the 1080 x 1920 canvas: the screen keeps the capture's 9:20 shape and the
# whole phone, tab bar included, fits under the caption.
SCREEN_W = 610
SCREEN_H = SCREEN_W * 2400 // 1080
BEZEL_W = 16
SCREEN_RADIUS = 48
PHONE_TOP = 480
# Android's status bar on the 1080 x 2400 capture (24 dp at 420 dpi). Its icons belong to the test
# device, not to Tenulo, and demo mode does not hide all of them, so the strip is painted over
# with the app's own background just below it.
STATUS_BAR_H = 63


def font(path: Path, size: int, weight: bytes) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(path), size * SUPERSAMPLE)
    f.set_variation_by_name(weight)
    return f


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def without_status_bar(capture: Image.Image) -> Image.Image:
    clean = capture.copy()
    background = clean.getpixel((8, STATUS_BAR_H + 4))
    ImageDraw.Draw(clean).rectangle([0, 0, clean.width - 1, STATUS_BAR_H - 1], fill=background)
    return clean


def compose(font_path: Path, raw: Path, title: str, subtitle: str) -> Image.Image:
    s = SUPERSAMPLE
    img = Image.new("RGBA", (W * s, H * s), PAPER + (255,))
    d = ImageDraw.Draw(img)

    title_font = font(font_path, 84, b"Bold")
    y = 120 * s
    for line in title.split("\n"):
        width = d.textlength(line, font=title_font)
        d.text(((W * s - width) / 2, y), line, font=title_font, fill=SAGE + (255,))
        y += 98 * s
    sub_font = font(font_path, 36, b"Regular")
    width = d.textlength(subtitle, font=sub_font)
    d.text(((W * s - width) / 2, y + 22 * s), subtitle, font=sub_font, fill=MUTED + (255,))

    # Soft shadow, then the bezel, then the screen.
    phone_w = (SCREEN_W + 2 * BEZEL_W) * s
    phone_h = (SCREEN_H + 2 * BEZEL_W) * s
    left = (W * s - phone_w) // 2
    top = PHONE_TOP * s
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [left, top + 24 * s, left + phone_w, top + phone_h + 24 * s],
        radius=(SCREEN_RADIUS + BEZEL_W) * s,
        fill=(28, 33, 30, 40),
    )
    shadow = shadow.resize((W // 4, H // 4), Image.BILINEAR).resize(img.size, Image.BILINEAR)
    img.alpha_composite(shadow)
    ImageDraw.Draw(img).rounded_rectangle(
        [left, top, left + phone_w, top + phone_h], radius=(SCREEN_RADIUS + BEZEL_W) * s, fill=BEZEL + (255,)
    )
    capture = without_status_bar(Image.open(raw).convert("RGBA"))
    screen = capture.resize((SCREEN_W * s, SCREEN_H * s), Image.LANCZOS)
    screen.putalpha(rounded_mask(screen.size, SCREEN_RADIUS * s))
    img.alpha_composite(screen, (left + BEZEL_W * s, top + BEZEL_W * s))

    return img.resize((W, H), Image.LANCZOS).convert("RGB")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/store_screens.py path/to/Roboto.ttf")
    font_path = Path(sys.argv[1])
    for lang, screens in SCREENS.items():
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for raw_name, out_name, title, subtitle in screens:
            compose(font_path, RAW / lang / raw_name, title, subtitle).save(OUT / lang / out_name)


if __name__ == "__main__":
    main()
