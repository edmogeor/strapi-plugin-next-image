/**
 * Adapted from the Next.js Image component.
 * Original source: https://github.com/vercel/next.js
 * Copyright (c) 2024 Vercel, Inc. — MIT License
 */
'use client';

import React, { useRef, useEffect, useCallback, useState, useMemo, forwardRef, cache } from 'react';
import ReactDOM from 'react-dom';
import { getImgProps } from './get-img-props';
import type { ImageProps, ImgProps, PlaceholderValue, OnLoad, OnLoadingComplete } from './types';
import { imageConfigDefault } from './image-config';
import defaultLoader from './image-loader';
import { warnOnce } from './warn-once';

// Escapes </script> sequences so the JSON is safe to embed inside a <script> tag.
function safeJsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// Per-request on the server (React's async context), module-singleton on the client.
// Ensures only the first <Image> in each render tree injects the config script.
const getConfigScriptState = cache(() => ({ injected: false }));

type ImgElementWithDataProp = HTMLImageElement & {
  'data-loaded-src': string | undefined;
};

type ImageElementProps = ImgProps & {
  unoptimized: boolean;
  placeholder: PlaceholderValue;
  onLoadRef: React.MutableRefObject<OnLoad | undefined>;
  onLoadingCompleteRef: React.MutableRefObject<OnLoadingComplete | undefined>;
  setBlurComplete: (b: boolean) => void;
  setShowAltText: (b: boolean) => void;
  sizesInput: string | undefined;
};

// See https://stackoverflow.com/q/39777833/266535 for why we use this ref
// handler instead of the img's onLoad attribute.
function handleLoading(
  img: ImgElementWithDataProp,
  placeholder: PlaceholderValue,
  onLoadRef: React.MutableRefObject<OnLoad | undefined>,
  onLoadingCompleteRef: React.MutableRefObject<OnLoadingComplete | undefined>,
  setBlurComplete: (b: boolean) => void,
  unoptimized: boolean,
  sizesInput: string | undefined,
) {
  const src = img?.src;
  if (!img || img['data-loaded-src'] === src) {
    return;
  }
  img['data-loaded-src'] = src;
  const p = 'decode' in img ? img.decode() : Promise.resolve();
  p.catch(() => {}).then(() => {
    if (!img.parentElement || !img.isConnected) {
      // Exit early in case of race condition:
      // - onload() is called
      // - decode() is called but incomplete
      // - unmount is called
      // - decode() completes
      return;
    }
    if (placeholder !== 'empty') {
      setBlurComplete(true);
    }
    if (onLoadRef?.current) {
      // Since we don't have the SyntheticEvent here,
      // we must create one with the same shape.
      // See https://reactjs.org/docs/events.html
      const event = new Event('load');
      Object.defineProperty(event, 'target', { writable: false, value: img });
      let prevented = false;
      let stopped = false;
      onLoadRef.current({
        ...event,
        nativeEvent: event,
        currentTarget: img,
        target: img,
        isDefaultPrevented: () => prevented,
        isPropagationStopped: () => stopped,
        persist: () => {},
        preventDefault: () => {
          prevented = true;
          event.preventDefault();
        },
        stopPropagation: () => {
          stopped = true;
          event.stopPropagation();
        },
      } as unknown as React.SyntheticEvent<HTMLImageElement>);
    }
    if (onLoadingCompleteRef?.current) {
      onLoadingCompleteRef.current(img);
    }
    if (process.env.NODE_ENV !== 'production') {
      const origSrc = new URL(src, 'http://n').searchParams.get('url') || src;
      if (img.getAttribute('data-nimg') === 'fill') {
        if (!unoptimized && (!sizesInput || sizesInput === '100vw')) {
          const widthViewportRatio = img.getBoundingClientRect().width / window.innerWidth;
          if (widthViewportRatio < 0.6) {
            if (sizesInput === '100vw') {
              warnOnce(
                `Image with src "${origSrc}" has "fill" prop and "sizes" prop of "100vw", but image is not rendered at full viewport width. Please adjust "sizes" to improve page performance.`,
              );
            } else {
              warnOnce(
                `Image with src "${origSrc}" has "fill" but is missing "sizes" prop. Please add it to improve page performance.`,
              );
            }
          }
        }
        if (img.parentElement) {
          const { position } = window.getComputedStyle(img.parentElement);
          const valid = ['absolute', 'fixed', 'relative'];
          if (!valid.includes(position)) {
            warnOnce(
              `Image with src "${origSrc}" has "fill" and parent element with invalid "position". Provided "${position}" should be one of ${valid
                .map(String)
                .join(',')}.`,
            );
          }
        }
        if (img.height === 0) {
          warnOnce(
            `Image with src "${origSrc}" has "fill" and a height value of 0. This is likely because the parent element of the image has not been styled to have a set height.`,
          );
        }
      }

      const heightModified = img.height.toString() !== img.getAttribute('height');
      const widthModified = img.width.toString() !== img.getAttribute('width');
      if (heightModified !== widthModified) {
        warnOnce(
          `Image with src "${origSrc}" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.`,
        );
      }
    }
  });
}

const ImageElement = forwardRef<HTMLImageElement | null, ImageElementProps>(
  (
    {
      src,
      srcSet,
      sizes,
      height,
      width,
      decoding,
      className,
      style,
      fetchPriority,
      placeholder,
      loading,
      unoptimized,
      fill,
      onLoadRef,
      onLoadingCompleteRef,
      setBlurComplete,
      setShowAltText,
      sizesInput,
      onLoad,
      onError,
      ...rest
    },
    forwardedRef,
  ) => {
    const ownRef = useCallback(
      (img: ImgElementWithDataProp | null) => {
        if (!img) {
          return;
        }
        if (onError) {
          // If the image has an error before react hydrates, then the error is lost.
          // The workaround is to wait until the image is mounted which is after hydration,
          // then we set the src again to trigger the error handler (if there was an error).
          // eslint-disable-next-line no-self-assign
          img.src = img.src;
        }
        if (process.env.NODE_ENV !== 'production') {
          if (!src) {
            console.error(`Image is missing required "src" property:`, img);
          }
          if (img.getAttribute('alt') === null) {
            console.error(
              `Image is missing required "alt" property. Please add Alternative Text to describe the image for screen readers and search engines.`,
            );
          }
        }
        if (img.complete) {
          handleLoading(
            img,
            placeholder,
            onLoadRef,
            onLoadingCompleteRef,
            setBlurComplete,
            unoptimized,
            sizesInput,
          );
        }
      },
      [
        src,
        placeholder,
        onLoadRef,
        onLoadingCompleteRef,
        setBlurComplete,
        onError,
        unoptimized,
        sizesInput,
      ],
    );

    const ref = useCallback(
      (node: HTMLImageElement | null) => {
        ownRef(node as ImgElementWithDataProp | null);
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        }
      },
      [ownRef, forwardedRef],
    );

    return (
      <img
        {...rest}
        fetchPriority={fetchPriority}
        // suppressHydrationWarning is needed because `fetchpriority` may differ
        // between SSR and client hydration (e.g. "auto" vs absent). This is the
        // same approach used by Next.js's own Image component.
        // See: https://react.dev/link/hydration-mismatch
        suppressHydrationWarning
        // It's intended to keep `loading` before `src` because React updates
        // props in order which causes Safari/Firefox to not lazy load properly.
        // See https://github.com/facebook/react/issues/25883
        loading={loading}
        width={width}
        height={height}
        decoding={decoding}
        data-nimg={fill ? 'fill' : '1'}
        className={className}
        style={style}
        // It's intended to keep `src` the last attribute because React updates
        // attributes in order. If we keep `src` the first one, Safari will
        // immediately start to fetch `src`, before `sizes` and `srcSet` are even
        // updated by React. That causes multiple unnecessary requests if `srcSet`
        // and `sizes` are defined.
        // This bug cannot be reproduced in Chrome or Firefox.
        sizes={sizes}
        srcSet={srcSet}
        src={src}
        ref={ref}
        onLoad={(event) => {
          const img = event.currentTarget as ImgElementWithDataProp;
          handleLoading(
            img,
            placeholder,
            onLoadRef,
            onLoadingCompleteRef,
            setBlurComplete,
            unoptimized,
            sizesInput,
          );
        }}
        onError={(event) => {
          // if the real image fails to load, this will ensure "alt" is visible
          setShowAltText(true);
          if (placeholder !== 'empty') {
            // If the real image fails to load, this will still remove the placeholder.
            setBlurComplete(true);
          }
          if (onError) {
            onError(event);
          }
        }}
      />
    );
  },
);
ImageElement.displayName = 'ImageElement';

function ImagePreload({ imgAttributes }: { imgAttributes: ImgProps }) {
  ReactDOM.preload(imgAttributes.src, {
    as: 'image',
    imageSrcSet: imgAttributes.srcSet,
    imageSizes: imgAttributes.sizes,
    crossOrigin: imgAttributes.crossOrigin,
    referrerPolicy: imgAttributes.referrerPolicy,
    fetchPriority: imgAttributes.fetchPriority,
  });
  return null;
}

/**
 * Drop-in replacement for Next.js `<Image>`.
 *
 * Usage: `import Image from 'strapi-next-image'`
 */
export const Image = forwardRef<HTMLImageElement | null, ImageProps>((props, forwardedRef) => {
  // Memoised with [] so the config is captured once on first render.
  // path is set synchronously by initializeStrapiImage before the first render,
  // so this is safe — and prevents re-renders when the async config fetch completes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { config, injectConfigScript } = useMemo(() => {
    const c = imageConfigDefault;
    const scriptState = getConfigScriptState();
    const injectConfigScript = !scriptState.injected;
    scriptState.injected = true;
    return {
      config: {
        ...c,
        allSizes: [...c.deviceSizes, ...c.imageSizes].sort((a, b) => a - b),
        deviceSizes: [...c.deviceSizes].sort((a, b) => a - b),
        qualities: c.qualities ? [...c.qualities].sort((a, b) => a - b) : undefined,
      },
      injectConfigScript,
    };
  }, []);

  const { onLoad, onLoadingComplete } = props;
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const onLoadingCompleteRef = useRef(onLoadingComplete);
  useEffect(() => {
    onLoadingCompleteRef.current = onLoadingComplete;
  }, [onLoadingComplete]);

  const [blurComplete, setBlurComplete] = useState(false);
  const [showAltText, setShowAltText] = useState(false);

  const { props: imgAttributes, meta: imgMeta } = getImgProps(props, {
    defaultLoader,
    imgConf: config,
    blurComplete,
    showAltText,
  });

  return (
    <>
      <ImageElement
        {...imgAttributes}
        unoptimized={imgMeta.unoptimized}
        placeholder={imgMeta.placeholder}
        fill={imgMeta.fill}
        onLoadRef={onLoadRef}
        onLoadingCompleteRef={onLoadingCompleteRef}
        setBlurComplete={setBlurComplete}
        setShowAltText={setShowAltText}
        sizesInput={props.sizes}
        ref={forwardedRef}
      />
      {imgMeta.priority ? <ImagePreload imgAttributes={imgAttributes} /> : null}
      {/* Injected once per render tree (first <Image> only) via React.cache().
            Embeds the server-fetched config so the client can apply it synchronously,
            avoiding a CORS round-trip. suppressHydrationWarning covers the edge case
            where initializeStrapiImage is called after hydration. */}
      {injectConfigScript && (
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `window.__STRAPI_IMAGE_CONFIG__=${safeJsonForScript({
              deviceSizes: imageConfigDefault.deviceSizes,
              imageSizes: imageConfigDefault.imageSizes,
              qualities: imageConfigDefault.qualities,
              formats: imageConfigDefault.formats,
              dangerouslyAllowSVG: imageConfigDefault.dangerouslyAllowSVG,
            })}`,
          }}
        />
      )}
    </>
  );
});
Image.displayName = 'Image';
