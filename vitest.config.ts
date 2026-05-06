import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/strapi-next-image/vitest.config.ts',
      'packages/strapi-plugin-next-image/vitest.config.ts',
    ],
  },
});
