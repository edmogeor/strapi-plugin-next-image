import path from 'path';
import fs from 'fs';

export default {
  register() {},
  async bootstrap({ strapi }) {
    // --- Seed a test image on first run ---
    const files = await strapi.db
      .query('plugin::upload.file')
      .findMany({ limit: 1 });

    if (files.length === 0) {
      const seedPath = path.join(strapi.dirs.app.root, 'seed', 'test-image.jpg');
      if (!fs.existsSync(seedPath)) {
        strapi.log.warn('Seed image not found at seed/test-image.jpg — skipping seed');
      } else {
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

        // Generate blur placeholder for the seeded image
        const seeded = await strapi.db
          .query('plugin::upload.file')
          .findOne({ where: { name: 'test-image.jpg' } });

        if (seeded && !seeded.blurDataURL) {
          const blurService = strapi.plugin('next-image').service('blur-placeholder');
          const blurDataURL = await blurService.generate(seeded.url, seeded.mime);
          if (blurDataURL) {
            await strapi.db.query('plugin::upload.file').update({
              where: { id: seeded.id },
              data: { blurDataURL },
            });
            strapi.log.info('Blur placeholder generated for seed image');
          }
        }
      }
    }

    // --- Grant public access to upload files API ---
    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (publicRole) {
      const uploadPermission = await strapi.db
        .query('plugin::users-permissions.permission')
        .findOne({
          where: {
            role: publicRole.id,
            action: 'plugin::upload.content-api.find',
          },
        });

      if (!uploadPermission) {
        await strapi.db
          .query('plugin::users-permissions.permission')
          .create({
            data: {
              action: 'plugin::upload.content-api.find',
              role: publicRole.id,
              enabled: true,
            },
          });
        strapi.log.info('Granted public access to upload files API');
      }
    }
  },
  destroy() {},
};
