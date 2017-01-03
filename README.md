# Marv
Marv is a programmatic database migration tool with plugable drivers for mysql and postgres.

[![Build Status](https://img.shields.io/travis/guidesmiths/marv/master.svg)](https://travis-ci.org/guidesmiths/marv)
[![Code Style](https://img.shields.io/badge/code%20style-imperative-brightgreen.svg)](https://github.com/guidesmiths/eslint-config-imperative)

## TL;DR
Create a directory of migrations
```
migrations/
  |- 001.create-table.sql
  |- 002.create-another-table.sql
```
Run marv
```js
const path = require('path')
const marv = require('marv')
const driver = require('marv-pg-driver')
const options = { connection: { host: 'postgres.example.com' } }
const directory = path.join(process.cwd(), 'migrations' )

marv.scan(directory, (err, migrations) => {
    if (err) throw err
    marv.migrate(migrations, driver(options), (err) => {
        if (err) throw err
        // Done :)
    })
})
```
## Migration Files
Migration files are just SQL scripts. Filenames must be in the form ```<level><separator><comment>.<extension>``` where:

* level must be numeric
* separator can be any non numeric
* comment can contain any characters except '.'
* extension is any file extension. See [here](https://github.com/guidesmiths/marv/#filtering-migration-files) for how to filter migration files.

## Drivers
The following drivers exist for marv.

* [marv-pg-driver](https://www.npmjs.com/package/marv-pg-driver)
* [marv-mysql-driver](https://www.npmjs.com/package/marv-mysql-driver)
* [marv-foxpro-driver](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

If you want to add a new driver please use the [compliance tests](https://www.npmjs.com/package/marv-compliance-tests) and include at least one end-to-end test.
See [marv-pg-driver](https://www.npmjs.com/package/marv-pg-driver) for an example.

### Configuring Drivers
You can configure a driver by passing it options, e.g.
```js
const options = {
    // defaults to 'migrations'
    table: 'db_migrations',
    // The connection sub document is passed directly to the underlying database library,
    // in this case pg.Client
    connection: {               
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: ''
    }
}
marv.scan(directory, (err, migrations) => {
    if (err) throw err
    marv.migrate(migrations, driver(options), (err) => {
        if (err) throw err
        // Done :)
    })
})
```
## What Makes Marv Special
Before writing Marv we evaluated existing tools against the following criteria:

* Cluster safe
* Works with raw SQL
* Programmatic API so we can invoke it on application startup
* Supports multiple databases including Postgres and MySQL via **optional** plugins
* Can be run repeatedly from integration tests
* Reports errors via events, callbacks or promise rejections rather than throwing or logging
* Doesn't log to console
* Reasonable code hygiene
* Reasonably well tested

Candidates were:

* [pg-migrator](https://www.npmjs.com/package/pg-migrator)
* [db-migrate](https://www.npmjs.com/package/db-migrate)
* [migratio](https://www.npmjs.com/package/migratio)
* [postgrator](https://www.npmjs.com/package/postgrator)
* [stringtree-migrate](https://www.npmjs.com/package/stringtree-migrate)
* [migrate-database](https://www.npmjs.com/package/migrate-database)
* [node-pg-migrate](https://www.npmjs.com/package/node-pg-migrate)
* [east](https://www.npmjs.com/package/east)

Disappointingly they all failed. Marv does all these things in less than 100 lines (with around another 100 lines for a driver). Functions are typically under 4 lines and operate at a single level of abstraction. There is almost no conditional logic and thorough test coverage.

## What Marv Doesn't Do
One of the reasons Marv is has a small and simple code base is because it doesn't come with a lot of unnecessary bells and whistles. It doesn't support

* Rollbacks (we make our db changes backwards compatible so we can deploy without downtime).
* A DSL (high maintenance and restrictive)
* Conditional migrations
* A command line interface (we may implement this in future)
* Checksum validation (we may implement this in future)

## Advanced Usage
### Filtering Migration Files
If you would like to exclude files from your migrations directory you can specify a filter
```
migrations/
  |- 001.create-table.sql
  |- 002.create-another-table.sql
```

```js
marv.scan(directory, { filter: /\.sql$/ }, (err, migrations) => {
    if (err) throw err
    marv.migrate(migrations, driver, (err) => {
        if (err) throw err
    })
})
```

### Always Running A Migration
Sometimes you always want to run a migration. This can be useful if you want to manage an ever growing set of ref data. Rather than split the ref data across multiple *audited* migration steps you want to append them in a single file over time. The recommended way to do this with marv is to have separate directories for schema and ref data, and to tag the ref data migrations with ```audit: false```, e.g.

```
migrations/
  |- schema/
    |- 001.create-table.sql
    |- 002.create-another-table.sql
  |- refdata/
    |- 001.dataset-a.sql
    |- 002.database-b.sql
```

```js
async.series([
    (cb) => migrateSchema,
    (cb) => migrateRefData
], (err) => {
    if (err) throw err
})


function migrateSchema(cb) {
    const directory = path.join(process.cwd(), 'migrations', 'schema' )
    marv.scan(directory, (err, migrations) => {
        if (err) return cb(err)
        marv.migrate(migrations, driver, cb)
  })
}

function migrateRefData(cb) {
    const directory = path.join(process.cwd(), 'migrations', 'refdata' )
    marv.scan(directory, { audit: false }, (err, migrations) => {
        if (err) return cb(err)
        marv.migrate(migrations, driver, cb)
    })
}
```
By marking a migration as ```audit: false``` you're telling marv not to record whether it's been run before, and therefore run it every time.
It's therefore important to ensure unaudited migrations are idempotent, e.g.
```sql
INSERT INTO foo (id, name) VALUES
(1, 'xkcd'),
(2, 'dilbert')
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name RETURNING id;
```

## Debugging
You can run marv with debug to see exactly what it's doing
```
DEBUG='marv:*' npm start

marv:migrate Connecting driver +0ms
marv:pg-driver Connecting to postgres://postgres:******@localhost:5432/postgres +0ms
marv:migrate Ensuring migrations +23ms
marv:migrate Locking migrations +5ms
marv:migrate Getting existing migrations +1ms
marv:migrate Calculating deltas +7ms
marv:migrate Running 0 migrations +2ms
marv:migrate Unlocking migrations +0ms
marv:migrate Disconnecting driver +1ms
marv:pg-driver Disconnecting from postgres://postgres:******@localhost:5432/postgres +0ms

```
