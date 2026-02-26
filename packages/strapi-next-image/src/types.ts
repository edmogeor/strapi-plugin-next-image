/**
 * Adapted from Next.js image types.
 * Original source: https://github.com/vercel/next.js
 * Copyright (c) 2024 Vercel, Inc. — MIT License
 */
import type { CSSProperties, JSX } from 'react';

// --- Strapi Media Types ---

export interface StrapiMediaFormat {
  name: string;
  hash: string;
  ext: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  url: string;
}

export interface StrapiMedia {
  id: number;
  url: string;
  width: number;
  height: number;
  alternativeText?: string | null;
  formats?: Record<string, StrapiMediaFormat> | null;
  mime?: string;
  hash?: string;
  ext?: string;
  blurDataURL?: string;
}

// --- Image Config Types ---

export type ImageFormat = 'image/avif' | 'image/webp';

export interface ImageConfigComplete {
  deviceSizes: number[];
  imageSizes: number[];
  qualities: number[] | undefined;
  formats: ImageFormat[];
  dangerouslyAllowSVG: boolean;
  unoptimized: boolean;
}

export type ImageConfig = ImageConfigComplete & {
  allSizes: number[];
};

// --- Loader Types ---

export type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

export type ImageLoader = (props: ImageLoaderProps) => string;

export type ImageLoaderWithConfig = (
  props: ImageLoaderProps & { config: Readonly<ImageConfig> }
) => string;

// --- Component Prop Types ---

const VALID_LOADING_VALUES = ['lazy', 'eager', undefined] as const;
export type LoadingValue = (typeof VALID_LOADING_VALUES)[number];

export type PlaceholderValue = 'blur' | 'empty' | `data:image/${string}`;
export type OnLoad = React.ReactEventHandler<HTMLImageElement>;
export type OnLoadingComplete = (img: HTMLImageElement) => void;

export type PlaceholderStyle = Partial<
  Pick<
    CSSProperties,
    'backgroundSize' | 'backgroundPosition' | 'backgroundRepeat' | 'backgroundImage'
  >
>;

export type ImageProps = Omit<
  JSX.IntrinsicElements['img'],
  'src' | 'srcSet' | 'ref' | 'alt' | 'width' | 'height' | 'loading'
> & {
  src: StrapiMedia | string;
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  loader?: ImageLoader;
  quality?: number | `${number}`;
  priority?: boolean;
  loading?: LoadingValue;
  placeholder?: PlaceholderValue;
  blurDataURL?: string;
  unoptimized?: boolean;
  overrideSrc?: string;
  decoding?: 'async' | 'auto' | 'sync';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
  /** @deprecated Use `onLoad` instead. */
  onLoadingComplete?: OnLoadingComplete;
  /** @deprecated Use `fill` instead. */
  layout?: string;
  /** @deprecated Use `style` instead. */
  objectFit?: string;
  /** @deprecated Use `style` instead. */
  objectPosition?: string;
  /** @deprecated Does nothing. */
  lazyBoundary?: string;
  /** @deprecated Does nothing. */
  lazyRoot?: string;
};

// ImgProps uses Omit<ImageProps, ...> so that arbitrary HTML attributes
// (data-*, aria-*, id, title, etc.) flow through from ImageProps to <img>.
export type ImgProps = Omit<ImageProps, 'src' | 'loader' | 'srcSet'> & {
  loading: LoadingValue;
  width: number | undefined;
  height: number | undefined;
  style: NonNullable<JSX.IntrinsicElements['img']['style']>;
  sizes: string | undefined;
  srcSet: string | undefined;
  src: string;
};

export function isStrapiMedia(src: unknown): src is StrapiMedia {
  return (
    typeof src === 'object' &&
    src !== null &&
    'url' in src &&
    'width' in src &&
    'height' in src &&
    typeof (src as StrapiMedia).url === 'string'
  );
}
