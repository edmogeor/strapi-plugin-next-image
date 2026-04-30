// fallow-ignore-file unused-file
import type { Core } from '@strapi/types';

declare global {
  // Strapi v5 runtime injects the `strapi` global. This declaration
  // prevents implicit `any` on every untyped `strapi.*` access.
  var strapi: Core.Strapi;
}

export {};
