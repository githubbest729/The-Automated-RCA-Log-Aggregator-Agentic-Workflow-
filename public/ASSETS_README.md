# Required Public Assets

`logo.svg` is generated for you and already in this folder. The following
raster assets are referenced by `app/layout.tsx` metadata but must be
supplied manually (design tools can't reliably hand-author binary
image formats), and placed at these exact paths:

| File                     | Path                            | Recommended size   | Purpose                                   |
|---------------------------|----------------------------------|---------------------|--------------------------------------------|
| `favicon.ico`              | `/public/favicon.ico`            | 32x32 / 48x48 multi-size | Browser tab icon                     |
| `apple-touch-icon.png`     | `/public/apple-touch-icon.png`   | 180x180 PNG         | iOS home-screen icon                       |
| `og-image.png`             | `/public/og-image.png`           | 1200x630 PNG        | Open Graph / link-preview image (Slack, Teams, LinkedIn, etc.) |
| `icon-192.png` (optional)  | `/public/icon-192.png`           | 192x192 PNG         | PWA / Android icon                         |
| `icon-512.png` (optional)  | `/public/icon-512.png`           | 512x512 PNG         | PWA / Android icon                         |

Quick way to generate them from `logo.svg` using ImageMagick or a
similar tool once you have Node/Bun installed:

```bash
# Example using the `sharp` CLI or any SVG->PNG converter of your choice
npx svg2png-cli public/logo.svg --width=1200 --height=630 --output=public/og-image.png
npx svg2png-cli public/logo.svg --width=180 --height=180 --output=public/apple-touch-icon.png
```

For `og-image.png` specifically, consider designing a wider banner (not
just the square logo) that includes the product name "Automated RCA Log
Aggregator" and a tagline, since it's what renders in link previews.
