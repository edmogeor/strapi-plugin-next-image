// Default export — drop-in replacement for next/image
// Usage: import Image from 'strapi-next-image'
export { Image as default, Image } from './image';

// Utility: compute image props without rendering (same as Next.js getImageProps)
export { getImageProps } from './get-image-props';

// Types
export type {
  StrapiMedia,
  StrapiMediaFormat,
  ImageProps,
  ImageLoader,
  ImageLoaderProps,
  ImageConfigComplete,
  PlaceholderValue,
} from './types';
