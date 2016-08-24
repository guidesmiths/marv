# Marv
[![Build Status](https://img.shields.io/travis/guidesmiths/marv/master.svg)](https://travis-ci.org/guidesmiths/marv)
[![Code Style](https://img.shields.io/badge/code%20style-imperative-brightgreen.svg)](https://github.com/guidesmiths/eslint-config-imperative)
<br>
Marv is a programatic database migration tool with plugable drivers. Works from a list of migrations...
```js
[ 
  { level: 1, comment: 'create-table', script: 'CREATE TABLE foo ( id INTEGER PRIMARY KEY );'},
  { level: 2, comment: 'create-another-table', script: 'CREATE TABLE bar ( id INTEGER PRIMARY KEY );'}
]
``` 
or from a directory where the files are in the following format...
```
migrations/
  |- 001.create-table.sql
  |- 002.create-another-table.sql
```

## The Code
```js
const marv = require('marv')
const pgDriver = require('marv-pg-driver')
const directory = path.join(process.cwd(), 'migrations' )
const driver = pgDriver({
    table: 'db_migrations',     // defaults to 'migrations'
    connection: {               // the connection sub document is passed directly to pg.Client
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: ''
    }
})
marv.scanDirectory(directory, (err, migrations) => {
    marv.migrate(migrations, driver, (err) => {
        if (err) console.error(err.message)
    })
})
```

## What makes Marv special
Before writing it we evaluated existing tools against the following criteria:

* Cluster safe
* Works with raw SQL
* Programatic API so we can invoke it on application startup
* Supports Postgres (other databases a bonus, but only when plugable - we don't want to include drivers we don't use)
* Can be run repeatedly from integration tests
* Reports errors via events, callbacks or rejections rather than throwing or logging
* Doesn't log to console
* Reasonable code hygene (small code base, short functions with single level of abstraction, low cylomatic complexity, etc)
* Reasonably well tested

Candidates were:

* [db-migrate](https://www.npmjs.com/package/db-migrate)
* [postgrator](https://www.npmjs.com/package/postgrator)
* [stringtree-migrate](https://www.npmjs.com/package/stringtree-migrate)
* [migrate-database](https://www.npmjs.com/package/migrate-database)
* [node-pg-migrate](https://www.npmjs.com/package/migrate-database)

Disappointingly they all failed. By comparison Marv is less than 100 lines (with around another 100 lines for the driver). Functions are typically 4 lines and operate at a single level of abstraction. The only conditional logic are guard conditions for errors.

One of the reasons Marv is has a small and simple code base is because it doesn't come with a lot of unnecessary bells and whistles. It doesn't support

* Undo actions (make your db changes backwards compatible otherwise you cannot deploy without downtime)
* A command line interface
* A DSL (high maintenance and restrictive)
* Conditional migrations - e.g. migrate up to level 10 (if you really want this you can do it with the api)
* Checksum validation (we may implement this in future)

### Drivers
* [marv-pg-driver](https://www.npmjs.com/package/marv-pg-driver)
* [marv-foxpro-driver](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

#### Contributing drivers
Each driver should implement the [compliance tests](https://www.npmjs.com/package/marv-compliance-tests) and include at least one end-to-end test. See [marv-pg-driver](https://www.npmjs.com/package/marv-pg-driver) for an example.

### But I don't want to to call my files NNN.create-foo-table.sql
That's OK. You just need to get your list of migrations some other way and pass them to ```marv.migrate```, e.g.

```js
marv.migrate([{
    level: 1,
    comment: 'create foo table'
    script: 'CREATE TABLE foo (id INTEGER PRIMARY KEY)'
}], driver, (err) => {
    if (err) console.error(err.message)
})
```

### How do I see what's going on
You can run marv with debug to see exactly what it's doing

```
DEBUG='marv:*' npm start

marv:index Connecting to database +0ms
marv:pg-driver Connecting to postgres://postgres:******@localhost:5432/postgres +0ms
marv:index Ensuring migrations table +23ms
marv:index Locking migrations table +5ms
marv:index Getting existing migrations +1ms
marv:index Getting deltas migrations +7ms
marv:index Running 0 migrations +2ms
marv:index Unlocking migrations table +0ms
marv:index Disconnecting from database +1ms
```



