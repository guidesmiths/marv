var Hath = require('hath')
var marv = require('..')

function migrationTableIsEmpty(t, done) {
    t.label('migration table is empty')
    var driver = stubDriver()
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
    ], driver, function(err) {
        if (err) throw err
        t.assert(driver.ran.length === 2, 'Expected 2 migrations but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 1, 'Expected level 1 but found level ' + driver.ran[0].level)
        t.assert(driver.ran[1].level === 2, 'Expected level 2 but found level ' + driver.ran[0].level)
        done()
    })
}

function migrationTableIsNotEmpty(t, done) {
    t.label('migration table is not empty')
    var driver = stubDriver([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
    ])
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' }
    ], driver, function(err) {
        if (err) throw err
        t.assert(driver.ran.length === 1, 'Expected 1 migration but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 3, 'Expected level 3 but found level ' + driver.ran[0].level)
        done()
    })
}

function migrationTableIsMissingEntries(t, done) {
    t.label('migration table is missing entries')
    var driver = stubDriver([
        { level: 3, script: 'meh' }
    ])
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' },
        { level: 4, script: 'meh' },
        { level: 5, script: 'meh' }
    ], driver, function(err) {
        if (err) throw err
        t.assert(driver.ran.length === 2, 'Expected 2 migrations but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 4, 'Expected level 4 but found level ' + driver.ran[0].level)
        t.assert(driver.ran[1].level === 5, 'Expected level 5 but found level ' + driver.ran[1].level)
        done()
    })
}

function stubDriver(existing) {
    return {
        connect: noop,
        disconnect: noop,
        deleteMigrations: noop,
        ensureMigrations: noop,
        lockMigrations: noop,
        unlockMigrations: noop,
        getMigrations: function(cb) {
            cb(null, existing || [])
        },
        runMigration: function(migration, cb) {
            this.ran = (this.ran || []).concat(migration)
            cb()
        }
    }
}

function noop() {
    arguments[arguments.length - 1]()
}

module.exports = Hath.suite('Marv Tests', [
    migrationTableIsEmpty,
    migrationTableIsNotEmpty,
    migrationTableIsMissingEntries
])

if (module === require.main) {
  module.exports(new Hath())
}