# Assets — Rentados

| Archivo | Uso |
|---------|-----|
| `app-icon.jpg` | Icono oficial de la app (1024×1024, fondo verde + casa) |
| `logo.png` | Misma marca en PNG (login y fallback) |
| `icon-192.png` / `icon-512.png` | PWA / “Agregar a pantalla de inicio” |
| `hero-login.jpg` | Imagen opcional para el panel lateral del login |

Raíz de `public/`:

| Archivo | Uso |
|---------|-----|
| `favicon-32.png` | Pestaña del navegador |
| `apple-touch-icon.png` | Icono en iOS al guardar en inicio |
| `site.webmanifest` | Metadatos PWA (`theme_color` verde `#1b3b2e`) |

Si cambias el icono, reemplaza `app-icon.jpg` y regenera los PNG con:

```bash
SRC=web/public/assets/app-icon.jpg
sips -s format png "$SRC" --out web/public/assets/logo.png
sips -z 180 180 web/public/assets/logo.png --out web/public/apple-touch-icon.png
sips -z 32 32 web/public/assets/logo.png --out web/public/favicon-32.png
sips -z 192 192 web/public/assets/logo.png --out web/public/assets/icon-192.png
sips -z 512 512 web/public/assets/logo.png --out web/public/assets/icon-512.png
```
