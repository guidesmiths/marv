var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var async = require('async')
var XRegExp = require('xregexp')
var pattern = XRegExp('^(?<level>\\d+)[^\\d](?<comment>.*?)\\.', 'i')
var debug = require('debug')('marv:scan')

module.exports = function scanDirectory(directory, options, cb) {

    if (arguments.length === 2) module.exports(arguments[0], {}, arguments[1])

    var scanDirectory = async.seq(readDirectory, getMigrations)
    var getMigration = async.seq(readFile, buildMigration)
    var config = _.merge({ filter: /.*/ }, options)

    function readDirectory(cb) {
        debug('Reading directory %s', directory)
        fs.readdir(directory, cb)
    }

    function getMigrations(files, cb) {
        async.reduce(files, [], function(migrations, file, cb) {
            getMigration(file, function(err, migration) {
                if (err) return cb(err)
                cb(null, _.chain(migrations).concat(migration).compact().value())
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
        var match = XRegExp.exec(file, pattern)
        if (!match) {
            debug('%s does not match %s -- skipping', file, pattern)
            return cb()
        } else if (!config.filter.test(file)) {
            debug('%s does not match %s -- skipping', file, config.filter)
            return cb()
        }
        var level = parseInt(match.level, 10)
        var comment = match.comment.replace(/[-_]+/g, ' ')
        cb(null, { level: level, comment: comment, script: script })
    }

    scanDirectory(cb)
}

