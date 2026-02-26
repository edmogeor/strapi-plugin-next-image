# strapi-plugin-next-image

A Strapi v5 plugin that serves optimized images via Sharp — resize, format conversion (WebP/AVIF), and automatic blur placeholder generation.

## Install

```bash
npm install strapi-plugin-next-image
npm run build   # rebuild the Strapi admin panel
```

Requires `@strapi/strapi ^5.0.0` and `sharp >=0.32.0` as peer dependencies.

## What it does

- Exposes a `GET /api/next-image` endpoint that resizes and converts images on the fly
- Auto-generates base64 blur placeholders (`blurDataURL`) for every uploaded image
- Caches optimized images on disk with configurable TTL, ETags, and `Cache-Control: immutable`
- Detects animated images (GIF, WebP, APNG) and serves them untouched

## Configuration

Configure in `config/plugins.ts`:

```ts
export default {
  'next-image': {
    config: {
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [32, 48, 64, 96, 128, 256, 384],
      qualities: [75],
      formats: ['image/webp'],
      minimumCacheTTL: 14400,
      dangerouslyAllowSVG: false,
      blurSize: 8,
    },
  },
};
```

| Option | Default | Description |
|---|---|---|
| `deviceSizes` | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | Viewport breakpoints |
| `imageSizes` | `[32, 48, 64, 96, 128, 256, 384]` | Fixed-width image sizes |
| `qualities` | `[75]` | Allowed quality values |
| `formats` | `['image/webp']` | Output formats |
| `minimumCacheTTL` | `14400` | Cache lifetime in seconds |
| `dangerouslyAllowSVG` | `false` | Allow SVG passthrough |
| `blurSize` | `8` | Width of blur placeholder thumbnails (px) |

## API

```
GET /api/next-image?url=/uploads/file.jpg&w=1080&q=75&f=webp
```

| Param | Required | Description |
|---|---|---|
| `url` | Yes | Path starting with `/uploads/` |
| `w` | Yes | Width — must be in `deviceSizes` or `imageSizes` |
| `q` | No | Quality 1–100 (default 75) |
| `f` | No | Format override (`webp`, `avif`) |

## Frontend

Pair with the [strapi-next-image](https://www.npmjs.com/package/strapi-next-image) React component for a complete `next/image`-style experience.

## Documentation

For full documentation, see the [monorepo README](https://github.com/edmogeor/strapi-plugin-next-image#readme).

## License

[MIT](https://github.com/edmogeor/strapi-plugin-next-image/blob/main/LICENSE)
