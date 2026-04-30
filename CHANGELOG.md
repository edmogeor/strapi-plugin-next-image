# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-04-30

### Added

- **strapi-plugin-next-image** — `globals.ts` module declaring the Strapi v5 runtime global type, eliminating implicit `any` on untyped `strapi.*` accesses.
- **ci** — Validation step (`scripts/validate-config-sync.mjs`) that ensures client-side image config defaults match the server canonical source.
- **ci** — ESLint configured for TypeScript; all lint errors resolved across both packages.

### Changed

- **strapi-plugin-next-image** — MIME type ↔ file extension mapping centralized into a single canonical source (`EXT_TO_CONTENT_TYPE` in `image-utils.ts`). Updating it once updates `getContentTypeFromExt`, `getExtFromMime`, and the cache service simultaneously.
- **strapi-plugin-next-image** — All typed service accessors (`getCacheService`, `getBlurService`, `getOptimizeService`) moved to `types.ts`, centralising the `as unknown as` cast pattern so consumers get typed services without repeating casts.
- **strapi-plugin-next-image** — Added `getContentTypesRegistry` accessor to `types.ts`, replacing manual `(strapi as …).get('content-types')` casts in `register.ts`.
- **strapi-plugin-next-image** — Extracted `readDiskEntry` helper in the cache service to eliminate duplicated disk I/O logic across `peekEtag` and `get`.
- **strapi-plugin-next-image** — Cache service now derives content types from the canonical `getContentTypeFromExt` utility instead of a local hardcoded map.
- **strapi-plugin-next-image** — Image optimization service now derives file extensions from `getExtFromMime` instead of duplicating extension strings in each format branch.
- **strapi-next-image** — Extracted `validateImgProps` from `getImgProps`, reducing the function's cognitive complexity by 64% and line count by 37%.
- **strapi-next-image** — Removed redundant nested `process.env.NODE_ENV` guard inside `getImgProps` validation.

### Removed

- Duplicate `extToContentType` map in the cache service (now uses canonical map).
- Duplicate `getContentTypeFromExt` and `getExtFromMime` functions in the image optimization service (now imported from `image-utils.ts`).
- Duplicate `getCacheService` and `getBlurService` helpers in `bootstrap.ts` (now imported from `types.ts`).
- Duplicate `getCacheService` and `getOptimizeService` helpers in the image optimization controller (now imported from `types.ts`).
- Unused `export` on `EXT_TO_CONTENT_TYPE` (only used internally) and `OptimizeResult` interface.

## [0.3.12] - 2026-04-22

### Changed

- Updated dev dependencies: `jsdom` → 29, `typescript` → 6, `@strapi/sdk-plugin` → 6.
- Pinned React 19 at the workspace root to prevent a duplicate React instance caused by `@strapi/strapi`'s transitive dependency on React 18, which was breaking the `strapi-next-image` test suite.

## [0.3.11] - 2026-04-08

### Changed

- **strapi-plugin-next-image** — Service accessors (`getCacheService`, `getBlurService`) are now fully typed, replacing the previous untyped `getService(strapi, name)` helper. All `strapi.db.query('plugin::upload.file') as any` calls have been replaced with the typed `getUploadFileRepository()` utility, improving type safety throughout the plugin.
- **strapi-plugin-next-image** — `isAnimated` image detection extracted to a dedicated `image-utils` module for better separation of concerns.
- **strapi-next-image** — `warnOnce` extracted to a dedicated module.
- **strapi-plugin-next-image** — `InvalidateConfig` is now derived from `PluginConfig` via `Pick<>`, eliminating the duplicate type definition.

### Added

- **strapi-plugin-next-image** — Test suites for cache service, blur-placeholder service, image-optimize service, and controllers.
- Prettier formatting, husky pre-commit hook, and fallow dead-code analysis configured for the monorepo.

## [0.3.3] - 2026-03-09

### Fixed

- **strapi-plugin-next-image** — Blur placeholders are now invalidated and regenerated on demand when the `blurSize` config value changes. On startup, the plugin compares the current `blurSize` to the previously persisted value; if they differ, all stored `blurDataURL` fields are cleared so they are regenerated with the new size.

## [0.3.2] - 2026-03-06

### Fixed

- **strapi-next-image** — Fixed hydration mismatch caused by explicit `fetchpriority="auto"` attribute. `getDynamicProps` was removed and `suppressHydrationWarning` was added to the `<img>` element instead, matching Next.js's implementation.

## [0.3.1] - 2026-03-06

- **strapi-next-image** — Eliminated hydration mismatch caused by CORS blocking the client-side config fetch: the `Image` component now embeds the server-fetched config as a single inline `<script>` per page (deduplicated via `React.cache()`), and `initializeStrapiImage` reads it synchronously on the client before React hydration begins
- **strapi-plugin-next-image** — Config endpoint (`GET /api/next-image/config`) now returns `Access-Control-Allow-Origin: *`, allowing the client's deferred refresh fetch to succeed

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
