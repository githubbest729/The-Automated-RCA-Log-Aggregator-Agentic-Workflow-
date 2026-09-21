"""
Generates the three missing public assets for the RCA Log Aggregator app:
  - favicon.ico            (16/32/48 multi-size)
  - apple-touch-icon.png   (180x180)
  - og-image.png           (1200x630)

Reuses the same color palette and motif as public/logo.svg (converging log
streams -> aggregation node -> alert marker) so the brand is consistent
across the favicon, touch icon, and social share image.

Run from the repo root (paths below are relative to public/):
    python3 scripts/generate_assets.py
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

# --- Palette (mirrors tailwind.config.ts) ---------------------------------
BASE_950 = (10, 14, 20)      # #0a0e14 - page background
BASE_900 = (15, 20, 28)      # #0f141c
BASE_800 = (23, 30, 41)      # #171e29
BASE_700 = (35, 44, 58)      # #232c3a
SIGNAL_500 = (34, 211, 238)  # #22d3ee - cyan, log streams
ALERT_500 = (245, 158, 11)   # #f59e0b - amber, alert/aggregation node
SLATE_100 = (241, 245, 249)
SLATE_400 = (148, 163, 184)

# NOTE: these font files were available in the sandbox that generated the
# committed assets but are NOT bundled with this repo. The three PNG/ICO
# files under public/ are already generated and checked in — you only need
# to touch this script if you want to regenerate them with different text
# or colors. To rerun it locally, install fonts and point these paths at
# real .ttf files, e.g.:
#   FONT_BOLD    -> a bold geometric/grotesk sans (Inter Bold, Manrope Bold, etc.)
#   FONT_REGULAR -> the matching regular weight
#   FONT_MONO    -> a monospace face (JetBrains Mono, IBM Plex Mono, etc.)
FONTS_DIR = "./fonts"  # put .ttf files here, or point at system font paths
FONT_BOLD = f"{FONTS_DIR}/YourFont-Bold.ttf"
FONT_REGULAR = f"{FONTS_DIR}/YourFont-Regular.ttf"
FONT_MONO = f"{FONTS_DIR}/YourFontMono-Regular.ttf"


def draw_mark(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float):
    """
    Draws the aggregator glyph centered at (cx, cy): three source nodes
    converging into an amber aggregation node, at the given scale (roughly
    the glyph's target width in px / 64).
    """
    s = scale

    def pt(x, y):
        # Coordinates authored against a 64x64 box, like logo.svg, then
        # scaled/translated around the given center.
        return (cx + (x - 32) * s, cy + (y - 32) * s)

    # Three converging streams
    stream_ys = [16, 32, 48]
    opacities = [0.85, 0.55, 0.85]
    for y, op in zip(stream_ys, opacities):
        color = tuple(int(c * op + BASE_950[i] * (1 - op)) for i, c in enumerate(SIGNAL_500))
        draw.line([pt(6, y), pt(24, y), pt(40, 32)], fill=color, width=max(2, int(2.5 * s)), joint="curve")
        draw.ellipse(
            [pt(6 - 3, y - 3), pt(6 + 3, y + 3)],
            fill=SIGNAL_500,
        )

    # Aggregation node
    draw.ellipse([pt(40 - 5, 32 - 5), pt(40 + 5, 32 + 5)], fill=ALERT_500)

    # Output line + alert arrow
    draw.line([pt(40, 32), pt(52, 32)], fill=ALERT_500, width=max(2, int(2.5 * s)))
    draw.line([pt(52, 32), pt(52, 18)], fill=ALERT_500, width=max(2, int(2.5 * s)))
    draw.line([pt(48, 22), pt(52, 18), pt(56, 22)], fill=ALERT_500, width=max(2, int(2.5 * s)), joint="curve")


def rounded_bg(size: int, radius_ratio: float = 0.22) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=BASE_950 + (255,))
    return img, draw


# ---------------------------------------------------------------------------
# 1. favicon.ico (multi-size: 16, 32, 48)
# ---------------------------------------------------------------------------
def build_favicon():
    sizes = [16, 32, 48]
    imgs = []
    for size in sizes:
        img, draw = rounded_bg(size, radius_ratio=0.28)
        # At tiny sizes, simplify to a bold dot-cluster rather than the full glyph.
        if size <= 16:
            # Minimal mark: single amber node with two cyan ticks — legible at 16px.
            draw.ellipse([size * 0.42, size * 0.42, size * 0.68, size * 0.68], fill=ALERT_500)
            draw.line([(size * 0.18, size * 0.3), (size * 0.4, size * 0.5)], fill=SIGNAL_500, width=2)
            draw.line([(size * 0.18, size * 0.7), (size * 0.4, size * 0.5)], fill=SIGNAL_500, width=2)
        else:
            draw_mark(draw, size // 2, size // 2, scale=size / 64)
        imgs.append(img)

    imgs[-1].save(
        "public/favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=imgs[:-1],
    )
    print("wrote public/favicon.ico")


# ---------------------------------------------------------------------------
# 2. apple-touch-icon.png (180x180, opaque background required by iOS)
# ---------------------------------------------------------------------------
def build_apple_touch_icon():
    size = 180
    img = Image.new("RGB", (size, size), BASE_950)
    draw = ImageDraw.Draw(img)
    # iOS applies its own corner mask, so we fill the full square (no rounding here).
    draw_mark(draw, size // 2, size // 2 + 4, scale=size / 64 * 0.82)
    img.save("public/apple-touch-icon.png", format="PNG")
    print("wrote public/apple-touch-icon.png")


# ---------------------------------------------------------------------------
# 3. og-image.png (1200x630 social share banner)
# ---------------------------------------------------------------------------
def build_og_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BASE_950)
    draw = ImageDraw.Draw(img)

    # Subtle vertical gradient (base-950 -> base-900) for depth.
    for y in range(H):
        t = y / H
        r = int(BASE_950[0] + (BASE_900[0] - BASE_950[0]) * t)
        g = int(BASE_950[1] + (BASE_900[1] - BASE_950[1]) * t)
        b = int(BASE_950[2] + (BASE_900[2] - BASE_950[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Faint technical grid, fading toward the edges for texture without noise.
    grid_step = 40
    for x in range(0, W, grid_step):
        draw.line([(x, 0), (x, H)], fill=BASE_800, width=1)
    for y in range(0, H, grid_step):
        draw.line([(0, y), (W, y)], fill=BASE_800, width=1)

    # Soft glow behind the mark using a blurred ellipse.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([60, 140, 420, 500], fill=ALERT_500 + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Large aggregator mark, upper-left.
    mark_cx, mark_cy = 130, 190
    draw_mark(draw, mark_cx, mark_cy, scale=3.6)

    # Small timeline strip beneath the mark, echoing the logo's tick marks.
    tl_y = 320
    draw.line([(70, tl_y), (300, tl_y)], fill=BASE_700, width=3)
    for i, x in enumerate([110, 170, 230]):
        color = ALERT_500 if i == 2 else SIGNAL_500
        draw.ellipse([x - 6, tl_y - 6, x + 6, tl_y + 6], fill=color)

    # Eyebrow label
    font_mono = ImageFont.truetype(FONT_MONO, 22)
    draw.text((70, 40), "SCADA · WINDOWS · SQL SERVER", font=font_mono, fill=SIGNAL_500)

    # Title (wrapped across two lines for legibility at social-card scale)
    font_title = ImageFont.truetype(FONT_BOLD, 64)
    draw.text((70, 380), "Automated RCA", font=font_title, fill=SLATE_100)
    draw.text((70, 452), "Log Aggregator", font=font_title, fill=SLATE_100)

    # Subtitle
    font_sub = ImageFont.truetype(FONT_REGULAR, 28)
    subtitle = "Unified Incident Timeline & AI-Powered Root Cause Analysis"
    draw.text((70, 540), subtitle, font=font_sub, fill=SLATE_400)

    # Thin accent rule along the bottom edge.
    draw.rectangle([0, H - 6, W, H], fill=ALERT_500)

    img.save("public/og-image.png", format="PNG")
    print("wrote public/og-image.png")


if __name__ == "__main__":
    build_favicon()
    build_apple_touch_icon()
    build_og_image()
