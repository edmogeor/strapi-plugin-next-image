# Strapi Image Monorepo

This repository provides tools for implementing Next.js-style image optimization (`<Image />`) in React applications powered by a Strapi v5 backend, such as Vite, Create React App, or Astro.

---

## Packages

This monorepo contains two packages that work together to provide on-the-fly image optimization:

### 1. [`strapi-plugin-next-image`](./packages/strapi-plugin-next-image)
A Strapi v5 plugin that provides an on-the-fly image optimization API endpoint (`/api/image-optimize`). It uses `sharp` to process images when requested.

### 2. [`strapi-next-image`](./packages/strapi-next-image)
A React `<Image />` component designed as a drop-in replacement for `next/image`. It integrates with the `strapi-plugin-next-image` API to generate responsive image sets (`srcSet` and `sizes`).

---

## Installation and Setup

### 1. Backend Setup (Strapi v5)

Install the plugin in your Strapi project:

```bash
npm install strapi-plugin-next-image
```

Rebuild your Strapi admin panel:

```bash
npm run build
```

The `/api/image-optimize` endpoint is now available on your Strapi server.

### 2. Frontend Setup (React)

Install the React component in your frontend application:

```bash
npm install strapi-next-image
```

Import and use the component. Passing a `StrapiMedia` object to the `src` prop will automatically populate the `width`, `height`, and `alt` attributes.

```tsx
import Image from 'strapi-next-image';

export default function MyComponent({ strapiCoverImage }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      <Image
        src={strapiCoverImage}
        sizes="(max-width: 768px) 100vw, 800px"
        fill
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}
```

---

## Advanced Usage

### Manual Image Properties

If you only have the image URL, you must manually supply the `width`, `height`, and `alt` attributes:

```tsx
<Image
  src="/uploads/my-awesome-photo.jpg"
  alt="A description of the photo"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

### Custom Quality and Preloading

You can override the default image quality (75) and mark images for preloading using the `priority` property. Preloading is highly recommended for Above-the-Fold (LCP) images to improve performance metrics.

```tsx
<Image
  src={strapiCoverImage}
  quality={90}
  priority // Injects a <link rel="preload"> tag into the document head
/>
```

### Unoptimized Mode

To render the original image directly from Strapi without optimization, use the `unoptimized` flag:

```tsx
<Image
  src={strapiCoverImage}
  unoptimized
/>
```

### Advanced `getImageProps`

If you need to use the optimized image data for a CSS `background-image` or a custom `<picture>` element, you can use the `getImageProps` utility which works identically to the `next/image` equivalent.

```tsx
import { getImageProps } from 'strapi-next-image';

export default function Hero({ strapiCoverImage }) {
  const { props } = getImageProps({
    src: strapiCoverImage,
    alt: 'Hero background',
    sizes: '100vw',
    fill: true,
  });

  return (
    <div style={{ backgroundImage: `image-set(${props.srcSet})` }}>
      <h1>Hero Title</h1>
    </div>
  );
}
```

---

## Development

To set up the repository for development:

1. Clone or fork this repository.
2. Run `npm install` from the root directory to install all dependencies.
3. Package source code is located in the `packages/` directory.
4. Run `npm run build --workspaces` to build all packages.

---

## License

[MIT License](./LICENSE)
