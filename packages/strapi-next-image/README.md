# strapi-next-image

A drop-in replacement for `next/image` that brings Next.js-style image optimization to **any** React app using Strapi v5.

## Install

```bash
npm install strapi-next-image
```

Requires `react >= 18.0.0` as a peer dependency.

## Usage

```tsx
import Image from 'strapi-next-image';

function Hero({ cover }) {
  return (
    <Image
      src={cover}           // StrapiMedia object — width, height, alt auto-populated
      sizes="(max-width: 768px) 100vw, 800px"
      fill
      priority
      style={{ objectFit: 'cover' }}
    />
  );
}
```

Pass a `StrapiMedia` object to `src` and the component extracts `width`, `height`, `alt`, and `blurDataURL` for you. You can also pass a plain URL string if you supply those props manually.

## Configuration

Customize breakpoints, quality, and format settings by calling `configure()` once at your app entry point:

```ts
import { configure } from 'strapi-next-image';

configure({
  deviceSizes: [640, 1080, 1920],
  imageSizes: [64, 256],
  qualities: [80],
  formats: ['image/avif', 'image/webp'],
});
```

| Option | Default | Description |
|---|---|---|
| `deviceSizes` | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | Viewport breakpoints for responsive `srcSet` |
| `imageSizes` | `[32, 48, 64, 96, 128, 256, 384]` | Fixed-width image sizes |
| `qualities` | `[75]` | Allowed quality values |
| `formats` | `['image/webp']` | Output formats |
| `dangerouslyAllowSVG` | `false` | Allow SVG passthrough |
| `unoptimized` | `false` | Bypass optimization globally |

## `getImageProps`

Compute optimized image URLs without rendering a component:

```tsx
import { getImageProps } from 'strapi-next-image';

const { props } = getImageProps({ src: cover, alt: 'Hero', sizes: '100vw', fill: true });
```

## Backend

This package is designed to work with the [strapi-plugin-next-image](https://www.npmjs.com/package/strapi-plugin-next-image) Strapi v5 plugin, which provides the image optimization endpoint.

## Documentation

For full documentation, configuration reference, and API details, see the [monorepo README](https://github.com/edmogeor/strapi-plugin-next-image#readme).

## Attribution

This package includes code ported from and adapted from the [Next.js](https://github.com/vercel/next.js) Image component by Vercel, Inc., licensed under the MIT License. See [NOTICE](https://github.com/edmogeor/strapi-plugin-next-image/blob/main/NOTICE) for details.

## License

[MIT](https://github.com/edmogeor/strapi-plugin-next-image/blob/main/LICENSE)
