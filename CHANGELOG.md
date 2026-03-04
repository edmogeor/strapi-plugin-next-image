# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
