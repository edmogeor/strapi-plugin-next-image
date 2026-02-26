import register from './register';
import bootstrap from './bootstrap';
import config from './config';
import routes from './routes/content-api';
import imageOptimizeController from './controllers/image-optimize';
import configController from './controllers/config';
import imageOptimizeService from './services/image-optimize';
import cacheService from './services/cache';
import blurPlaceholderService from './services/blur-placeholder';

export default () => ({
  register,
  bootstrap,
  config,
  routes: {
    'content-api': routes,
  },
  controllers: {
    'next-image': imageOptimizeController,
    config: configController,
  },
  services: {
    'next-image': imageOptimizeService,
    cache: cacheService,
    'blur-placeholder': blurPlaceholderService,
  },
});
