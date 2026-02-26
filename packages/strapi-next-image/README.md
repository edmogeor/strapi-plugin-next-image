# strapi-next-image

A drop-in replacement for `next/image` that brings Next.js-style image optimization to **any** React app using Strapi v5.

## Install

```bash
npm install strapi-next-image
```

Requires `react >= 18.0.0` as a peer dependency.

## Usage

```tsx
import { initializeStrapiImage } from 'strapi-next-image';
import Image from 'strapi-next-image';

// 1. Fetch config and auto-route to Strapi before React renders
await initializeStrapiImage('https://cms.example.com');

// 2. Render images anywhere in your app
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

By default, the component uses standard Next.js default breakpoints. 

To keep your frontend breakpoints mapped securely to your Strapi backend configuration, call `initializeStrapiImage()` once at your app's entry point to fetch the config synchronously from the Strapi server:

```ts
import { initializeStrapiImage } from 'strapi-next-image';

// Fetch config from Strapi before React renders
await initializeStrapiImage('https://cms.example.com');
```

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
