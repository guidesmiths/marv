var fs = require('fs')
var path = require('path')
var async = require('async')
var debug = require('debug')('marv:scan')

module.exports = function scanDirectory(directory, cb) {

    var scanDirectory = async.seq(readDirectory, getMigrations)
    var getMigration = async.seq(readFile, buildMigration)

    function readDirectory(cb) {
        debug('Reading directory %s', directory)
        fs.readdir(directory, cb)
    }

    function getMigrations(files, cb) {
        async.reduce(files, [], function(migrations, file, cb) {
            getMigration(file, function(err, migration) {
                if (err) return cb(err)
                cb(null, migrations.concat(migration))
            })
        }, cb)
    }

    function readFile(file, cb) {
        var pathToFile = path.join(directory, file)
        debug('Reading file %s', file)
        fs.readFile(pathToFile, 'utf-8', function(err, script) {
            cb(err, file, script)
        })
    }

    function buildMigration(file, script, cb) {
        const parts = path.basename(file, path.extname(file)).split(/\./)
        const level = parseInt(parts.shift(), 10)
        const comment = parts.join('.').replace(/[-_\.]/g, ' ')
        cb(null, { level: level, comment: comment, script: script })
    }

    scanDirectory(cb)
}
