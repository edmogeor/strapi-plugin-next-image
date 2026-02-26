import path from 'path';

export default ({ env }) => ({
  connection: {
    client: 'better-sqlite3',
    connection: {
      filename: path.join(__dirname, '..', 'data', 'data.db'),
    },
    useNullAsDefault: true,
  },
});
