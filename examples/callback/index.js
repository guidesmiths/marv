const path = require('path');
const driver = require('marv-pg-driver');
const marv = require('../../api/callback');

const options = {
  table: 'marv_callback_example_migrations',
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

marv.scan(directory, (err, migrations) => {
  if (err) throw err;
  marv.migrate(migrations, driver(options), (err) => {
    if (err) throw err;
    /* eslint-disable-next-line no-console */
    console.log('Migration successful');
    process.exit();
  });
});

/* eslint-disable-next-line no-empty-function */
setInterval(() => {}, 10000);
