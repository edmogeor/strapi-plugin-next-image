<div align="center">
  <img src="https://raw.githubusercontent.com/edmogeor/strapi-plugin-next-image/main/assets/logo.png" width="140" alt="strapi-plugin-next-image logo"/>
  <h1>Next.js &lt;Image&gt; for Strapi</h1>
  <p>
    <a href="https://www.npmjs.com/package/strapi-plugin-next-image">
      <img src="https://img.shields.io/npm/v/strapi-plugin-next-image.svg" alt="npm version"/>
    </a>
    <a href="https://github.com/edmogeor/strapi-plugin-next-image/actions/workflows/ci.yml">
      <img src="https://github.com/edmogeor/strapi-plugin-next-image/actions/workflows/ci.yml/badge.svg" alt="CI"/>
    </a>
    <a href="https://github.com/fallow-rs/fallow">
      <img src="https://raw.githubusercontent.com/edmogeor/strapi-plugin-next-image/badges/badge.svg" alt="fallow health"/>
    </a>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
    </a>
  </p>
</div>

Drop-in `next/image`-compatible `<Image />` for any React app backed by Strapi v5. Responsive `srcSet`, WebP/AVIF conversion, blur placeholders, and aggressive caching — powered by Sharp.

## Packages

| Package                                                           | Description                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| [`strapi-plugin-next-image`](./packages/strapi-plugin-next-image) | Strapi v5 plugin — exposes `GET /api/next-image` via Sharp     |
| [`strapi-next-image`](./packages/strapi-next-image)               | React `<Image />` component — drop-in `next/image` replacement |

## Features

- **Responsive images** — automatic `srcSet` and `sizes` for every breakpoint
- **Format negotiation** — serves AVIF > WebP > JPEG based on `Accept` header
- **Blur placeholders** — auto-generated base64 thumbnails with fade-in
- **Aggressive caching** — file-based cache with configurable TTL, ETags, and `Cache-Control`
- **Animated image support** — GIF, WebP, and APNG served untouched
- **Priority / preload** — `priority` prop injects `<link rel="preload">` for LCP images
- **Fill mode** — container-relative sizing, just like `next/image`
- **Custom loaders** — point the component at any optimization endpoint
- **Type-safe** — full TypeScript definitions including a `StrapiMedia` type guard

## Quick Start

### 1. Backend (Strapi v5)

```bash
npm install strapi-plugin-next-image
npm run build
```

The plugin auto-registers `/api/next-image` and generates blur placeholders for every upload.

### 2. Frontend (React)

```bash
npm install strapi-next-image
```

```tsx
import { initializeStrapiImage } from 'strapi-next-image';
import Image from 'strapi-next-image';

// Call once at app entry point — syncs breakpoints from Strapi and sets the loader URL
await initializeStrapiImage('https://cms.example.com');

function Hero({ cover }) {
  return (
    <Image
      src={cover} // StrapiMedia object — width, height, alt, blurDataURL auto-populated
      sizes="(max-width: 768px) 100vw, 800px"
      fill
      priority
      style={{ objectFit: 'cover' }}
    />
  );
}
```

Pass a `StrapiMedia` object to `src` and the component extracts `width`, `height`, `alt`, and `blurDataURL` automatically. Plain URL strings work too if you supply those props manually.

## Usage

### Manual props (plain URL)

```tsx
<Image
  src="/uploads/photo.jpg"
  alt="A description of the photo"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

### Quality and priority

```tsx
<Image src={cover} quality={90} priority />
```

### Unoptimized

```tsx
<Image src={cover} unoptimized />
```

### `getImageProps`

For CSS `background-image` or custom `<picture>` elements:

```tsx
import { getImageProps } from 'strapi-next-image';

const { props } = getImageProps({ src: cover, alt: 'Hero', sizes: '100vw', fill: true });
// props.srcSet, props.src, props.width, props.height, etc.
```

### Custom Strapi URL

`initializeStrapiImage('https://cms.example.com')` configures the global loader — no per-image custom loaders needed. For a one-off override: `loader={createStrapiLoader('https://cms.example.com')}`.

## Configuration

### Backend (`config/plugins.ts`)

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

| Option                | Default                                         | Description                |
| --------------------- | ----------------------------------------------- | -------------------------- |
| `deviceSizes`         | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | Viewport breakpoints       |
| `imageSizes`          | `[32, 48, 64, 96, 128, 256, 384]`               | Fixed-width sizes          |
| `qualities`           | `[75]`                                          | Allowed quality values     |
| `formats`             | `['image/webp']`                                | Output formats             |
| `minimumCacheTTL`     | `14400`                                         | Cache lifetime in seconds  |
| `dangerouslyAllowSVG` | `false`                                         | Allow SVG passthrough      |
| `blurSize`            | `8`                                             | Blur thumbnail width in px |

### API Endpoint

```
GET /api/next-image?url=/uploads/file.jpg&w=1080&q=75&f=webp
```

| Param | Required | Description                                      |
| ----- | -------- | ------------------------------------------------ |
| `url` | Yes      | Path starting with `/uploads/`                   |
| `w`   | Yes      | Width — must be in `deviceSizes` or `imageSizes` |
| `q`   | No       | Quality 1–100 (default 75)                       |
| `f`   | No       | Format override (`webp`, `avif`)                 |

## Development

```bash
git clone https://github.com/edmogeor/strapi-plugin-next-image.git
cd strapi-plugin-next-image
npm install
npm run build --workspaces
npm run test --workspaces
```

The `examples/` directory has a full Strapi + Vite/React stack for manual testing:

```bash
npm run dev  # starts both Strapi and the frontend
```

Or separately:

```bash
cd examples/strapi && npm install && npm run develop
cd examples/frontend && npm install && npm run dev
```

Visit `http://localhost:1337/admin` to upload images, then `http://localhost:5173` to see the component in action.

## Attribution

Includes code ported from the [Next.js](https://github.com/vercel/next.js) Image component by Vercel, Inc. (MIT). See [NOTICE](./NOTICE).

## License

[MIT](./LICENSE)
