import path from 'path';

export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('DATABASE_FILENAME', path.resolve(process.cwd(), 'data', 'data.db')),
    },
    useNullAsDefault: true,
  },
});
