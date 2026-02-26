# strapi-plugin-next-image

Next.js-style `<Image />` optimization for **any** React app powered by Strapi v5.

Drop in two packages — a Strapi plugin that serves optimized images via Sharp, and a React component that's API-compatible with `next/image` — and get responsive `srcSet` generation, automatic WebP/AVIF conversion, blur placeholders, and aggressive caching out of the box.

[![CI](https://github.com/edmogeor/strapi-plugin-next-image/actions/workflows/ci.yml/badge.svg)](https://github.com/edmogeor/strapi-plugin-next-image/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Features

- **Responsive images** — automatic `srcSet` and `sizes` for every breakpoint
- **Format negotiation** — serves AVIF > WebP > JPEG based on the client's `Accept` header
- **Blur placeholders** — auto-generated base64 blur thumbnails on upload, with a smooth fade-in
- **Aggressive caching** — file-based cache with configurable TTL, ETags, and `Cache-Control: immutable`
- **Animated image support** — detects animated GIF, WebP, and APNG and serves them untouched
- **Priority / preload** — `priority` prop injects `<link rel="preload">` for LCP images
- **Fill mode** — container-relative sizing, just like `next/image`
- **Custom loaders** — point the component at any optimization endpoint
- **Type-safe** — full TypeScript definitions, including a `StrapiMedia` type guard

---

## Packages

| Package | Description |
|---|---|
| [`strapi-plugin-next-image`](./packages/strapi-plugin-next-image) | Strapi v5 plugin — exposes `GET /api/image-optimize` powered by Sharp |
| [`strapi-next-image`](./packages/strapi-next-image) | React `<Image />` component — drop-in `next/image` replacement |

---

## Quick Start

### 1. Backend (Strapi v5)

```bash
npm install strapi-plugin-next-image
npm run build   # rebuild admin panel
```

The plugin auto-registers the `/api/image-optimize` endpoint and starts generating blur placeholders for every new upload.

### 2. Frontend (React)

```bash
npm install strapi-next-image
```

```tsx
import Image from 'strapi-next-image';

function Hero({ cover }) {
  return (
    <Image
      src={cover}           // StrapiMedia object — width, height, alt auto-populated
      sizes="(max-width: 768px) 100vw, 800px"
      fill
      priority              // preload for LCP
      style={{ objectFit: 'cover' }}
    />
  );
}
```

Pass a `StrapiMedia` object to `src` and the component extracts `width`, `height`, `alt`, and `blurDataURL` for you. You can also pass a plain URL string if you supply those props manually.

---

## Usage

### Blur Placeholders

The Strapi plugin automatically generates a tiny base64 JPEG for every uploaded image and stores it in a `blurDataURL` field on the media entry. The React component picks this up and renders a blurred SVG overlay that fades out once the full image loads.

No configuration needed — it works out of the box.

### Manual Image Properties

When you only have a URL (not a full `StrapiMedia` object), provide dimensions and alt text yourself:

```tsx
<Image
  src="/uploads/photo.jpg"
  alt="A description of the photo"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

### Quality and Priority

Override the default quality (75) and mark above-the-fold images for preloading:

```tsx
<Image
  src={cover}
  quality={90}
  priority   // injects <link rel="preload"> into <head>
/>
```

### Unoptimized Mode

Bypass the optimization endpoint and render the original image directly:

```tsx
<Image src={cover} unoptimized />
```

### `getImageProps`

Need optimized URLs for a CSS `background-image` or a custom `<picture>` element? Use the utility function:

```tsx
import { getImageProps } from 'strapi-next-image';

const { props } = getImageProps({
  src: cover,
  alt: 'Hero background',
  sizes: '100vw',
  fill: true,
});

// props.srcSet, props.src, props.width, props.height, etc.
```

### Custom Strapi URL

If your Strapi server runs on a different origin, create a custom loader:

```tsx
import Image from 'strapi-next-image';
import { createStrapiLoader } from 'strapi-next-image';

const loader = createStrapiLoader('https://cms.example.com');

<Image src={cover} loader={loader} sizes="100vw" />
```

---

## Configuration

### Frontend (React)

Customize the image breakpoints, quality, and format settings used by the `<Image>` component and `getImageProps()`. Call `configure()` once at your app's entry point (e.g. `_app.tsx`, `layout.tsx`, or `main.tsx`) before any images render:

```ts
import { configure } from 'strapi-next-image';

configure({
  deviceSizes: [640, 1080, 1920],
  imageSizes: [64, 256],
  qualities: [80],
  formats: ['image/avif', 'image/webp'],
});
```

Any field you omit keeps its default value.

| Option | Type | Default | Description |
|---|---|---|---|
| `deviceSizes` | `number[]` | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | Viewport breakpoints for responsive `srcSet` generation |
| `imageSizes` | `number[]` | `[32, 48, 64, 96, 128, 256, 384]` | Fixed-width sizes for non-responsive images |
| `qualities` | `number[]` | `[75]` | Allowed quality values |
| `formats` | `string[]` | `['image/webp']` | Output formats passed to the optimization endpoint |
| `dangerouslyAllowSVG` | `boolean` | `false` | Allow SVG passthrough (skips optimization) |
| `unoptimized` | `boolean` | `false` | Bypass optimization globally (serve original files) |

### Strapi Plugin

Configure in `config/plugins.ts`:

```ts
export default {
  'image-optimize': {
    config: {
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [32, 48, 64, 96, 128, 256, 384],
      qualities: [75],
      formats: ['image/webp'],
      minimumCacheTTL: 14400,       // seconds (default: 4 hours)
      dangerouslyAllowSVG: false,
      blurSize: 8,                  // blur thumbnail width in px
    },
  },
};
```

| Option | Default | Description |
|---|---|---|
| `deviceSizes` | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | Viewport breakpoints for responsive images |
| `imageSizes` | `[32, 48, 64, 96, 128, 256, 384]` | Fixed-width image sizes |
| `qualities` | `[75]` | Allowed quality values |
| `formats` | `['image/webp']` | Output formats the endpoint will serve |
| `minimumCacheTTL` | `14400` | Cache lifetime in seconds |
| `dangerouslyAllowSVG` | `false` | Allow SVG passthrough |
| `blurSize` | `8` | Width of blur placeholder thumbnails |

### API Endpoint

```
GET /api/image-optimize?url=/uploads/file.jpg&w=1080&q=75&f=webp
```

| Param | Required | Description |
|---|---|---|
| `url` | Yes | Path starting with `/uploads/` |
| `w` | Yes | Width — must be in `deviceSizes` or `imageSizes` |
| `q` | No | Quality 1–100 (default 75) |
| `f` | No | Format override (`webp`, `avif`) |

Responds with optimized binary image data, `Cache-Control: public, max-age={TTL}, immutable`, and an `ETag` for conditional requests.

---

## Development

```bash
git clone https://github.com/edmogeor/strapi-plugin-next-image.git
cd strapi-plugin-next-image
npm install
npm run build --workspaces
npm run test --workspaces
```

---

## License

[MIT](./LICENSE)
