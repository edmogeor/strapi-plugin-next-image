// Ported from Next.js get-img-props.ts with Strapi-specific adaptations.
// https://github.com/vercel/next.js — Copyright (c) 2024 Vercel, Inc. — MIT License
import { getImageBlurSvg } from './image-blur-svg';
import { imageConfigDefault } from './image-config';
import {
  isStrapiMedia,
  type ImageConfig,
  type ImageConfigComplete,
  type ImageLoader,
  type ImageLoaderWithConfig,
  type ImageProps,
  type ImgProps,
  type PlaceholderStyle,
  type PlaceholderValue,
  type StrapiMedia,
} from './types';

const VALID_LOADING_VALUES = ['lazy', 'eager', undefined] as const;

import { warnOnce } from './warn-once';

const INVALID_BACKGROUND_SIZE_VALUES = ['-moz-initial', 'fill', 'none', 'scale-down', undefined];

// LCP detection: track all images for PerformanceObserver
let perfObserver: PerformanceObserver | undefined;
const allImgs = new Map<
  string,
  { src: string; loading: string | undefined; placeholder: PlaceholderValue }
>();

function getInt(x: unknown): number | undefined {
  if (typeof x === 'undefined') return x;
  if (typeof x === 'number') return Number.isFinite(x) ? x : NaN;
  if (typeof x === 'string' && /^[0-9]+$/.test(x)) return parseInt(x, 10);
  return NaN;
}

function getWidths(
  { deviceSizes, allSizes }: ImageConfig,
  width: number | undefined,
  sizes: string | undefined,
): { widths: number[]; kind: 'w' | 'x' } {
  if (sizes) {
    const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
    const percentSizes: number[] = [];
    for (let match; (match = viewportWidthRe.exec(sizes)); match) {
      percentSizes.push(parseInt(match[2]));
    }
    if (percentSizes.length) {
      const smallestRatio = Math.min(...percentSizes) * 0.01;
      return {
        widths: allSizes.filter((s) => s >= deviceSizes[0] * smallestRatio),
        kind: 'w',
      };
    }
    return { widths: allSizes, kind: 'w' };
  }
  if (typeof width !== 'number') {
    return { widths: deviceSizes, kind: 'w' };
  }

  const widths = [
    ...new Set(
      [width, width * 2].map((w) => allSizes.find((p) => p >= w) || allSizes[allSizes.length - 1]),
    ),
  ];
  return { widths, kind: 'x' };
}

interface GenImgAttrsData {
  config: ImageConfig;
  src: string;
  unoptimized: boolean;
  loader: ImageLoaderWithConfig;
  width?: number;
  quality?: number;
  sizes?: string;
}

interface GenImgAttrsResult {
  src: string;
  srcSet: string | undefined;
  sizes: string | undefined;
}

function generateImgAttrs({
  config,
  src,
  unoptimized,
  width,
  quality,
  sizes,
  loader,
}: GenImgAttrsData): GenImgAttrsResult {
  if (unoptimized) {
    return { src, srcSet: undefined, sizes: undefined };
  }

  const { widths, kind } = getWidths(config, width, sizes);
  const last = widths.length - 1;

  const makeUrl = (w: number) => loader({ config, src, quality, width: w });

  return {
    sizes: !sizes && kind === 'w' ? '100vw' : sizes,
    srcSet: widths.map((w, i) => `${makeUrl(w)} ${kind === 'w' ? w : i + 1}${kind}`).join(', '),
    src: makeUrl(widths[last]),
  };
}

type ValidationInputs = {
  src: string;
  srcProp: ImageProps['src'];
  widthInt: number | undefined;
  heightInt: number | undefined;
  width: ImageProps['width'];
  height: ImageProps['height'];
  fill: boolean;
  style: ImageProps['style'];
  loading: ImageProps['loading'];
  priority: boolean;
  placeholder: PlaceholderValue;
  blurDataURL: string | undefined;
  config: ImageConfig;
  qualityInt: number | undefined;
  isDefaultLoader: boolean;
  loader: ImageLoaderWithConfig;
  imgRest: Record<string, unknown>;
  unoptimized: boolean;
};

function validateImgProps(inputs: ValidationInputs): boolean {
  const {
    src,
    srcProp,
    widthInt,
    heightInt,
    width,
    height,
    fill,
    style,
    loading,
    priority,
    placeholder,
    blurDataURL,
    config,
    qualityInt,
    isDefaultLoader,
    loader,
    imgRest,
    unoptimized,
  } = inputs;

  if (!src) return true;

  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x20]/.test(src)) {
    throw new Error(
      `Image with src "${src}" cannot start with a space or control character. The href property must be a valid URL.`,
    );
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20]$/.test(src)) {
    throw new Error(
      `Image with src "${src}" cannot end with a space or control character. The href property must be a valid URL.`,
    );
  }
  if (fill) {
    if (width) {
      throw new Error(
        `Image with src "${src}" has both "width" and "fill" properties. Only one should be used.`,
      );
    }
    if (height) {
      throw new Error(
        `Image with src "${src}" has both "height" and "fill" properties. Only one should be used.`,
      );
    }
    if (style?.position && style.position !== 'absolute') {
      throw new Error(
        `Image with src "${src}" has both "fill" and "style.position" properties. Images with "fill" always use position absolute - it cannot be modified.`,
      );
    }
    if (style?.width && style.width !== '100%') {
      throw new Error(
        `Image with src "${src}" has both "fill" and "style.width" properties. Images with "fill" always use width 100% - it cannot be modified.`,
      );
    }
    if (style?.height && style.height !== '100%') {
      throw new Error(
        `Image with src "${src}" has both "fill" and "style.height" properties. Images with "fill" always use height 100% - it cannot be modified.`,
      );
    }
  } else if (!isStrapiMedia(srcProp)) {
    if (typeof widthInt === 'undefined') {
      throw new Error(`Image with src "${src}" is missing required "width" property.`);
    } else if (isNaN(widthInt)) {
      throw new Error(
        `Image with src "${src}" has invalid "width" property. Expected a numeric value in pixels but received "${width}".`,
      );
    }
    if (typeof heightInt === 'undefined') {
      throw new Error(`Image with src "${src}" is missing required "height" property.`);
    } else if (isNaN(heightInt)) {
      throw new Error(
        `Image with src "${src}" has invalid "height" property. Expected a numeric value in pixels but received "${height}".`,
      );
    }
  }
  if (!VALID_LOADING_VALUES.includes(loading)) {
    throw new Error(
      `Image with src "${src}" has invalid "loading" property. Provided "${loading}" should be one of ${VALID_LOADING_VALUES.map(String).join(',')}.`,
    );
  }
  if (priority && loading === 'lazy') {
    throw new Error(
      `Image with src "${src}" has both "priority" and "loading='lazy'" properties. Only one should be used.`,
    );
  }
  if (placeholder !== 'empty' && placeholder !== 'blur' && !placeholder.startsWith('data:image/')) {
    throw new Error(`Image with src "${src}" has invalid "placeholder" property "${placeholder}".`);
  }
  if (placeholder !== 'empty') {
    if (widthInt && heightInt && widthInt * heightInt < 1600) {
      warnOnce(
        `Image with src "${src}" is smaller than 40x40. Consider removing the "placeholder" property to improve performance.`,
      );
    }
  }
  if (qualityInt && config.qualities && !config.qualities.includes(qualityInt)) {
    warnOnce(
      `Image with src "${src}" is using quality "${qualityInt}" which is not configured in qualities [${config.qualities.join(', ')}]. Please update your config to [${[...config.qualities, qualityInt].sort().join(', ')}].`,
    );
  }
  if (placeholder === 'blur' && !blurDataURL) {
    throw new Error(
      `Image with src "${src}" has "placeholder='blur'" property but is missing the "blurDataURL" property.\nPossible solutions:\n  - Add a "blurDataURL" property\n  - Remove the "placeholder" property`,
    );
  }
  if (!unoptimized && !isDefaultLoader) {
    const urlStr = loader({
      config,
      src,
      width: widthInt || 400,
      quality: qualityInt || 75,
    });
    let url: URL | undefined;
    try {
      url = new URL(urlStr);
    } catch {}
    if (urlStr === src || (url && url.pathname === src && !url.search)) {
      warnOnce(
        `Image with src "${src}" has a "loader" property that does not implement width. Please implement it or use the "unoptimized" property instead.`,
      );
    }
  }
  if ('ref' in imgRest) {
    warnOnce(
      `Image with src "${src}" is using unsupported "ref" property. Consider using the "onLoad" property instead.`,
    );
  }
  if ('onLoadingComplete' in imgRest) {
    warnOnce(
      `Image with src "${src}" is using removed "onLoadingComplete" property. Use "onLoad" instead.`,
    );
  }
  const removedProps = ['layout', 'objectFit', 'objectPosition', 'lazyBoundary', 'lazyRoot'];
  for (const key of removedProps) {
    if (key in imgRest) {
      warnOnce(
        `Image with src "${src}" is using removed prop "${key}". This prop is no longer supported.`,
      );
    }
  }

  // LCP detection
  if (typeof window !== 'undefined' && !perfObserver && window.PerformanceObserver) {
    perfObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        // @ts-expect-error — LargestContentfulPaint "element" prop not typed in TS lib
        const imgSrc = (entry.element as HTMLImageElement | undefined)?.src || '';
        const lcpImage = allImgs.get(imgSrc);
        if (
          lcpImage &&
          lcpImage.loading === 'lazy' &&
          lcpImage.placeholder === 'empty' &&
          !lcpImage.src.startsWith('data:') &&
          !lcpImage.src.startsWith('blob:')
        ) {
          warnOnce(
            `Image with src "${lcpImage.src}" was detected as the Largest Contentful Paint (LCP). Please add the \`loading="eager"\` property if this image is above the fold.`,
          );
        }
      }
    });
    try {
      perfObserver.observe({
        type: 'largest-contentful-paint',
        buffered: true,
      });
    } catch (err) {
      console.error(err);
    }
  }

  return false;
}

// Compute <img> props from ImageProps. Ported from Next.js get-img-props.ts.
export function getImgProps(
  {
    src: srcProp,
    sizes,
    unoptimized = false,
    priority = false,
    loading,
    className,
    quality,
    width,
    height,
    fill = false,
    style,
    overrideSrc,
    onLoad,
    onError,
    placeholder = 'empty',
    blurDataURL,
    fetchPriority,
    decoding = 'async',
    alt: altProp,
    loader: customImageLoader,
    ...imgRest
  }: ImageProps,
  options: {
    defaultLoader: ImageLoaderWithConfig;
    imgConf: ImageConfigComplete;
    showAltText?: boolean;
    blurComplete?: boolean;
  },
): {
  props: ImgProps;
  meta: {
    unoptimized: boolean;
    priority: boolean;
    placeholder: NonNullable<ImageProps['placeholder']>;
    fill: boolean;
  };
} {
  const { imgConf, showAltText, blurComplete, defaultLoader } = options;
  let config: ImageConfig;
  const c = imgConf || imageConfigDefault;

  if ('allSizes' in c) {
    config = c as ImageConfig;
  } else {
    const allSizes = [...c.deviceSizes, ...c.imageSizes].sort((a, b) => a - b);
    const deviceSizes = c.deviceSizes.sort((a, b) => a - b);
    const qualities = c.qualities?.sort((a, b) => a - b);
    config = { ...c, allSizes, deviceSizes, qualities };
  }

  // --- Resolve loader ---
  // imgRest contains only genuine HTML attributes safe to spread on <img>.
  // customImageLoader was extracted in the parameter destructuring above.
  let loader: ImageLoaderWithConfig = defaultLoader;
  if (customImageLoader) {
    const customLoader = customImageLoader as ImageLoader;
    loader = ({ config: _, ...opts }) => customLoader(opts);
  }

  const isDefaultLoader = '__strapi_img_default' in loader;

  // --- Handle Strapi media object or string src ---
  let src: string;
  let widthInt = getInt(width);
  let heightInt = getInt(height);
  let alt: string;

  if (isStrapiMedia(srcProp)) {
    const media = srcProp as StrapiMedia;
    src = media.url;
    alt = altProp || media.alternativeText || '';

    if (!fill) {
      if (!widthInt && !heightInt) {
        widthInt = media.width;
        heightInt = media.height;
      } else if (widthInt && !heightInt) {
        const ratio = widthInt / media.width;
        heightInt = Math.round(media.height * ratio);
      } else if (!widthInt && heightInt) {
        const ratio = heightInt / media.height;
        widthInt = Math.round(media.width * ratio);
      }
    }

    blurDataURL = blurDataURL || media.blurDataURL;
  } else {
    src = srcProp as string;
    alt = altProp;
  }

  let isLazy = !priority && (loading === 'lazy' || typeof loading === 'undefined');
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    unoptimized = true;
    isLazy = false;
  }
  if (config.unoptimized) {
    unoptimized = true;
  }
  if (isDefaultLoader && !config.dangerouslyAllowSVG && src.split('?', 1)[0].endsWith('.svg')) {
    unoptimized = true;
  }

  const qualityInt = getInt(quality);

  if (process.env.NODE_ENV !== 'production') {
    const emptySrc = validateImgProps({
      src,
      srcProp,
      widthInt,
      heightInt,
      width,
      height,
      fill,
      style,
      loading,
      priority,
      placeholder,
      blurDataURL,
      config,
      qualityInt,
      isDefaultLoader,
      loader,
      imgRest,
      unoptimized,
    });
    if (emptySrc) {
      unoptimized = true;
    }
  }

  const imgStyle = Object.assign(
    fill
      ? {
          position: 'absolute' as const,
          height: '100%',
          width: '100%',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        }
      : {},
    showAltText ? {} : { color: 'transparent' },
    style,
  );

  let backgroundImage: string | null = null;
  if (!blurComplete && placeholder !== 'empty') {
    if (placeholder === 'blur') {
      const blurSvg = getImageBlurSvg({
        widthInt,
        heightInt,
        blurDataURL: blurDataURL || '',
        objectFit: imgStyle.objectFit,
      });
      backgroundImage = `url("data:image/svg+xml;charset=utf-8,${blurSvg}")`;
    } else {
      backgroundImage = `url("${placeholder}")`;
    }
  }

  let backgroundSize: string;
  const objectFitValue = imgStyle.objectFit as string | undefined;
  if (objectFitValue && !INVALID_BACKGROUND_SIZE_VALUES.includes(objectFitValue)) {
    backgroundSize = objectFitValue;
  } else if (objectFitValue === 'fill') {
    backgroundSize = '100% 100%';
  } else {
    backgroundSize = 'cover';
  }

  const placeholderStyle: PlaceholderStyle = backgroundImage
    ? {
        backgroundSize,
        backgroundPosition: imgStyle.objectPosition || '50% 50%',
        backgroundRepeat: 'no-repeat',
        backgroundImage,
      }
    : {};

  const imgAttributes = generateImgAttrs({
    config,
    src,
    unoptimized,
    width: widthInt,
    quality: qualityInt,
    sizes,
    loader,
  });

  const loadingFinal = isLazy ? 'lazy' : loading;

  if (process.env.NODE_ENV !== 'production') {
    if (typeof window !== 'undefined') {
      let fullUrl: URL;
      try {
        fullUrl = new URL(imgAttributes.src);
      } catch {
        fullUrl = new URL(imgAttributes.src, window.location.href);
      }
      allImgs.set(fullUrl.href, { src, loading: loadingFinal, placeholder });
    }
  }

  const props: ImgProps = {
    ...imgRest,
    alt,
    loading: loadingFinal,
    fetchPriority,
    width: widthInt,
    height: heightInt,
    decoding,
    className,
    style: { ...imgStyle, ...placeholderStyle },
    sizes: imgAttributes.sizes,
    srcSet: imgAttributes.srcSet,
    src: overrideSrc || imgAttributes.src,
  };

  if (onLoad) props.onLoad = onLoad;
  if (onError) props.onError = onError;

  const meta = { unoptimized, priority, placeholder, fill };
  return { props, meta };
}
