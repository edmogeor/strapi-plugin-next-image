# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-03-05

### Added

- **strapi-next-image** — The component now automatically requests server-side blur generation (`?blur=1`) if a blur placeholder is missing from the Strapi media library
- **strapi-plugin-next-image** — `GET /api/next-image` now supports an optional `blur=1` query parameter to trigger on-demand generation and persistence of missing blur placeholders
- **strapi-plugin-next-image** — The optimization controller now performs a fast ETag check (`peekEtag`) to return `304 Not Modified` without reading the image buffer from disk if the client already has the current version

### Fixed

- **strapi-plugin-next-image** — Added an in-memory LRU cache (200 entries) for the optimization service, significantly reducing disk I/O for frequently requested image variants
- **strapi-plugin-next-image** — The config endpoint (`/api/next-image/config`) now includes an ETag and `Cache-Control` headers (5 min max-age, 24h stale-while-revalidate), and the frontend component now respects these headers
- **strapi-plugin-next-image** — Cache invalidation now also clears the blur placeholder confirmation state, ensuring placeholders are re-checked if an image is replaced
- **strapi-plugin-next-image** — Fixed missing `Content-Length` header in optimized image responses

## [0.2.3] - 2026-03-05

### Fixed

- **strapi-plugin-next-image** — All file I/O in the cache and optimization services is now fully async (`fs/promises`), freeing the event loop during disk reads and writes
- **strapi-plugin-next-image** — Concurrent cold-cache requests for the same image variant are now de-duplicated: only one Sharp pipeline runs and all waiting requests share the result

## [0.2.2] - 2026-03-04

### Fixed

- **strapi-next-image** — `initializeStrapiImage` now defers the async config fetch on the client until after React hydration (`setTimeout(0)`), preventing hydration mismatches caused by `deviceSizes` changing mid-render
- **strapi-next-image** — Config is memoised on first render in `Image` (with an empty deps array); this is safe because `path` is set synchronously before the first render, and avoids unnecessary re-renders when the async fetch completes

## [0.2.1] - 2026-03-04

### Fixed

- **strapi-next-image** — Image loader now strips the host from absolute `src` URLs (e.g. from Strapi's media library) before passing them to the `/api/next-image` endpoint, preventing double-host URLs in optimized image requests

## [0.2.0] - 2026-03-04

### Fixed

- **strapi-next-image** — `initializeStrapiImage` now sets the Strapi URL synchronously before the async config fetch, so images point to Strapi immediately even when the call is not awaited (fire-and-forget usage)
- **strapi-next-image** — `Image` component now reads `imageConfigDefault` fresh on each render instead of memoising it at mount time, ensuring config updates from `initializeStrapiImage` are reflected
- **strapi-next-image** — Fixed potential array mutation when sorting `deviceSizes`, `imageSizes`, and `qualities` inside the `Image` component

### Changed

- **strapi-plugin-next-image** — Fixed plugin build types output
- **ci** — Switched to npm trusted publishing (OIDC provenance); `NPM_TOKEN` secret no longer required

## [0.1.0] - 2026-02-26

### Added

- **strapi-next-image** — React `<Image>` component, drop-in replacement for `next/image`
  - Responsive `srcSet` and `sizes` generation
  - Blur placeholder support with smooth fade-in
  - `fill` mode for container-relative sizing
  - `priority` prop for LCP preloading
  - `getImageProps()` utility for non-component usage
  - `configure()` function for runtime image config overrides
  - Custom loader support via `createStrapiLoader()`
- **strapi-plugin-next-image** — Strapi v5 plugin
  - `GET /api/next-image` endpoint powered by Sharp
  - On-the-fly resize and format conversion (WebP/AVIF)
  - Auto-generated base64 blur placeholders on upload
  - File-based cache with configurable TTL, ETags, and `Cache-Control: immutable`
  - Animated image detection (GIF, WebP, APNG) — served untouched
