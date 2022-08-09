const path = require('path');
const driver = require('marv-pg-driver');
const marv = require('../../api/promise');

const options = {
  table: 'marv_async_example_migrations',
  quiet: true,
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
  },
};
const directory = path.join(process.cwd(), 'migrations');

(async () => {
  const migrations = await marv.scan(directory);
  await marv.migrate(migrations, driver(options));

  /* eslint-disable-next-line no-console */
  console.log('Migration successful');
  process.exit();
})();

/* eslint-disable-next-line no-empty-function */
setInterval(() => {}, 10000);
