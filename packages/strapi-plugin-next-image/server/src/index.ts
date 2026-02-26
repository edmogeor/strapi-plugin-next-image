import register from './register';
import bootstrap from './bootstrap';
import config from './config';
import routes from './routes/content-api';
import controllers from './controllers/image-optimize';
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
    'image-optimize': controllers,
  },
  services: {
    'image-optimize': imageOptimizeService,
    cache: cacheService,
    'blur-placeholder': blurPlaceholderService,
  },
});
