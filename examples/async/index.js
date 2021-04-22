const marv = require('../../api/promise');
const path = require('path');
const driver = require('marv-pg-driver');
const options = {
  table: 'marv_async_example_migrations',
  quiet: true,
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
  }
};
const directory = path.join(process.cwd(), 'migrations' );

(async () => {
  const migrations = await marv.scan(directory);
  await marv.migrate(migrations, driver(options));
  console.log('Migration successful');
  process.exit();
})();

/* eslint-disable-next-line no-empty-function */
setInterval(() => {}, Number.MAX_SAFE_INTEGER);
