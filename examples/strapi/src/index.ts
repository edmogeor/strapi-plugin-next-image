import path from 'path';
import fs from 'fs';

export default {
  register() {},
  async bootstrap({ strapi }) {
    // Seed a test image on first run if no files exist yet
    const files = await strapi.db
      .query('plugin::upload.file')
      .findMany({ limit: 1 });

    if (files.length > 0) return;

    // Use strapi.dirs.app.root which always resolves to the project root
    const seedPath = path.join(strapi.dirs.app.root, 'seed', 'test-image.jpg');
    if (!fs.existsSync(seedPath)) {
      strapi.log.warn('Seed image not found at seed/test-image.jpg — skipping seed');
      return;
    }

    strapi.log.info('Seeding test image...');

    const stats = fs.statSync(seedPath);
    const upload = strapi.plugin('upload').service('upload');

    await upload.upload({
      data: {
        fileInfo: {
          name: 'test-image.jpg',
          alternativeText: 'A test landscape image from picsum.photos',
          caption: 'Seed image for visual testing',
        },
      },
      files: {
        filepath: seedPath,
        originalFilename: 'test-image.jpg',
        mimetype: 'image/jpeg',
        size: stats.size,
      },
    });

    strapi.log.info('Test image seeded successfully');
  },
  destroy() {},
};
