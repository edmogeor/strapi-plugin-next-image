import path from 'path';

export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.join(__dirname, '..', 'data', 'data.db'),
    },
    useNullAsDefault: true,
  },
});
