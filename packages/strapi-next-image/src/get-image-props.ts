import { getImgProps } from './get-img-props';
import { imageConfigDefault } from './image-config';
import defaultLoader from './image-loader';
import type { ImageProps } from './types';

/**
 * Compute image props without rendering a component.
 * Same as Next.js `getImageProps()`.
 *
 * @example
 * ```tsx
 * const { props } = getImageProps({
 *   src: strapiMedia,
 *   sizes: '100vw',
 * });
 *
 * <picture>
 *   <source srcSet={props.srcSet} sizes={props.sizes} />
 *   <img {...props} />
 * </picture>
 * ```
 */
export function getImageProps(imageProps: ImageProps) {
  return getImgProps(imageProps, {
    defaultLoader,
    imgConf: imageConfigDefault,
  });
}
