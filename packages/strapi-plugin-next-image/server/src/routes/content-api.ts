export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/',
      handler: 'image-optimize.optimize',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
