export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/',
      handler: 'next-image.optimize',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/config',
      handler: 'config.get',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
