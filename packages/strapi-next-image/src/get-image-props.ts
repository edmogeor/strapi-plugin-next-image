import { getImgProps } from './get-img-props';
import { imageConfigDefault } from './image-config';
import defaultLoader from './image-loader';
import type { ImageProps } from './types';

// Compute image props without rendering a component, like Next.js getImageProps().
// Returns { props } for spreading onto <img>/<source> inside a custom <picture>.
export function getImageProps(imageProps: ImageProps) {
  return getImgProps(imageProps, {
    defaultLoader,
    imgConf: imageConfigDefault,
  });
}
