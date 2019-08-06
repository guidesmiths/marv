# Marv
Marv is a programmatic database migration tool with plugable drivers for mysql, postgres, mssql and sqlite.

[![Greenkeeper badge](https://badges.greenkeeper.io/guidesmiths/marv.svg)](https://greenkeeper.io/)
[![NPM version](https://img.shields.io/npm/v/marv.svg?style=flat-square)](https://www.npmjs.com/package/marv)
[![NPM downloads](https://img.shields.io/npm/dm/marv.svg?style=flat-square)](https://www.npmjs.com/package/marv)
[![Build Status](https://img.shields.io/travis/guidesmiths/marv/master.svg)](https://travis-ci.org/guidesmiths/marv)
[![Code Climate](https://codeclimate.com/github/guidesmiths/marv/badges/gpa.svg)](https://codeclimate.com/github/guidesmiths/marv)
[![Test Coverage](https://codeclimate.com/github/guidesmiths/marv/badges/coverage.svg)](https://codeclimate.com/github/guidesmiths/marv/coverage)
[![Code Style](https://img.shields.io/badge/code%20style-imperative-brightgreen.svg)](https://github.com/guidesmiths/eslint-config-imperative)
[![Dependency Status](https://david-dm.org/guidesmiths/marv.svg)](https://david-dm.org/guidesmiths/marv)
[![devDependencies Status](https://david-dm.org/guidesmiths/marv/dev-status.svg)](https://david-dm.org/guidesmiths/marv?type=dev)

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
* [marv-better-sqlite3-driver](https://www.npmjs.com/package/@open-fidias/marv-better-sqlite3-driver)
* [marv-mssql-driver](https://www.npmjs.com/package/@infinitaslearning/marv-mssql-driver)
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
* Follows the [rule of silence](http://www.linfo.org/rule_of_silence.html)
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

Disappointingly they all failed. Marv does all these things in less than 150 lines, with around another 100 lines for a driver.

## What Marv Doesn't Do
One of the reasons Marv is has a small and simple code base is because it doesn't come with a lot of unnecessary bells and whistles. It doesn't support

* Rollbacks (we make our db changes backwards compatible so we can deploy without downtime).
* A DSL (high maintenance and restrictive)
* Conditional migrations
* A command line interface (we may implement this in future)
* Checksum validation (we may implement this in future)

## Important Notes About Transactions
Marv is unlike some other migration libraries in that it **deliberately** doesn't run your scripts in a transaction. This is because some SQL statements **cannot** be run in a transaction, and others(e.g. locking in Postgres) will automatically commit the current transaction if one exists. Unfortunately this means that in rare situations, scripts may be only partially applied, e.g.
```sql
CREATE TABLE customer (
  id BIGSERIAL PRIMARY KEY,
  name TEXT
);
CREATE INDEX customer_name ON customer (
  name
);
```
If something goes wrong (e.g. a network outage) after `CREATE TABLE` but before `CREATE INDEX`, the table would be created without the index. Because scripts are audited on successful completion, the script will be included in the next migration run, but now the `CREATE TABLE` step will fail because the table already exists. One way to work around this is by explicitly specifying a transactions...
```sql
BEGIN TRANSACTION;
    CREATE TABLE customer (
      id BIGSERIAL PRIMARY KEY,
      name TEXT
    );
    CREATE INDEX customer_name ON customer (
      name
    );
END TRANSACTION;
```
However there's still a gotcha. Now the script will either be applied or not, but consider what will happen if the network outage occurs after the script has been applied, but before Marv inserts the audit record? Because the script hasn't been audited, Marv won't know that it completed successfully and will still include it in the next migration run. Once again it will fail on the `CREATE TABLE` step. A better workaround is to make your script idempotent, e.g.
```sql
CREATE TABLE IF NOT EXISTS customer (
  id BIGSERIAL PRIMARY KEY,
  name TEXT
);
CREATE INDEX IF NOT EXISTS customer_name ON customer (
  name
);
```
Unfortunately not all statements and SQL dialects have an equivalent of `IF NOT EXISTS`. If you're especially unlucky and something goes wrong while applying a non-atomic / non-idempotent script you will have some manual clean up to do. This may involve applying the missing steps and inserting the audit record manually. The exact syntax will vary from driver to driver but should be similar to...
```bash
$ cat migrations/002.create-customer-table.sql | md5
82b392f3594050ecefd768bfe258843b
```
```SQL
INSERT INTO migrations (level, comment, "timestamp", checksum) VALUES (2, 'create customer table', now(), '82b392f3594050ecefd768bfe258843b');
```

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
        // Done :)
    })
})
```

### Namespacing
All migration scripts are namespaced. If namespace is not provided explicitly they're assigned to the 'default' namespace. Namespaces can be used to isolate migrations when multiple applications maintain (a subset of) tables in same database.

Namespace can be passed as an option to the scan method, and all migrations returned from by will be assigned to that namespace. Alternatively the namespace can be set in a .marvrc file, in which case all the migrations in that folder will be assigned to it.

### .marvrc
You can configure marv by placing a .marvrc file in your migrations folder

```
migrations/
  |- .marvrc
  |- 001.create-table.sql
  |- 002.create-another-table.sql
```

```json
{
    "filter": "\\.sql$",
    "directives": {
        "audit": "false"
    },
    "namespace": "blogs"
}
```

```js
marv.scan(directory, { namespace: 'custom' }, (err, migrations) => {
    if (err) throw err
    marv.migrate(migrations, driver, (err) => {
        if (err) throw err
        // Done :)
    })
})
```

### Directives
Directives allow you to customise the behaviour of migrations. You can specify directives in three ways...

1. Programatically via marv.scan
    ```js
    marv.scan(directory, { filter: /\.sql$/ }, { directives: { audit: false } }, (err, migrations) => {
        if (err) throw err
        marv.migrate(migrations, driver, (err) => {
            if (err) throw err
            // Done :)
        })
    })
    ```

1. Via .marvrc
    ```json
    {
        "filter": "\\.sql$",
        "directives": {
            "audit": "false"
        }
    }
    ```

1. Using a specially formed comment in a migration file
    ```sql
    -- @MARV AUDIT = false
    INSERT INTO foo (id, name) VALUES
    (1, 'xkcd'),
    (2, 'dilbert')
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name RETURNING id;
    ```

The following directives are supported:

#### Audit Directive
```sql
-- @MARV AUDIT = false
```
When set to false, marv will run the migration but not record that it has been applied. This will cause it to be re-run repeatedly. This can be useful if you want to manage ref data, but does imply that SQL is idempotent.

#### Skip Directive
```sql
-- @MARV SKIP = true
```
When set to true, marv will skip the migration and the audit step.

#### Comment Directive
```sql
-- @MARV COMMENT = A much longer comment that can contain full stops. Yay!
```
Override the comment parse from the migration filename.

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
