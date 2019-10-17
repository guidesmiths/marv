var fs = require('fs');
var path = require('path');
var format = require('util').format;
var _ = require('lodash');
var async = require('async');
var XRegExp = require('xregexp');
var migrationFilePattern = XRegExp('^(?<level>\\d+)[^\\d](?<comment>.*?)\\.', 'i');
var directivePattern = XRegExp('^--\\s*@MARV\\s+(?<key>\\w+)\\s*=\\s*(?<value>.+)$', 'mig');
var debug = require('debug')('marv:scan');

module.exports = function scanDirectory(directory, options, cb) {
  if (arguments.length === 2) return module.exports(arguments[0], {}, arguments[1]);
  if (options.migrations) {
    if (!options.quiet) console.warn("The 'migrations' option is deprecated. Please use 'directives' instead. You can disable this warning by setting 'quiet' to true.");
    options.directives = options.migrations;
    delete options.migrations;
  }

  var scanDirectory = async.seq(readDirectory, ensureFilesNotFolders, getMarvRc, getMigrations, validateMigrations);
  var getMigration = async.seq(readFile, buildMigration);
  var config = _.merge({ filter: /.*/, directives: {} }, options);

  function readDirectory(cb) {
    debug('Reading directory %s', directory);
    fs.readdir(directory, cb);
  }
  function ensureFilesNotFolders(files, cb) {
    debug('Ensuring that no files read in the directory were folders', directory);
    let filePaths = files.map(function(file){
      return path.join(directory, file);
    });
    async.map(filePaths, fs.lstat, function(err, results){
      if (err) return cb(err);
      var directoryItemsWithoutFolders = files.filter(function(file, index){
        return !results[index].isDirectory();
      });
      cb(null, directoryItemsWithoutFolders);
    });
  }

  function getMarvRc(files, cb) {
    if (!_.includes(files, '.marvrc')) return cb(null, files);

    debug('Loading runtime configuration from .marvrc');
    var pathToFile = path.join(directory, '.marvrc');
    fs.readFile(pathToFile, 'utf-8', function(err, marvrc) {
      if (err) return cb(err);
      _.merge(config, JSON.parse(marvrc));
      cb(null, _.without(files, '.marvrc'));
    });
  }

  function getMigrations(files, cb) {
    async.reduce(files, [], function(migrations, file, cb) {
      getMigration(file, function(err, migration) {
        if (err) return cb(err);
        cb(null, _.chain(migrations).concat(migration).compact().value());
      });
    }, cb);
  }

  function validateMigrations(migrations, cb) {
    var duplicateLevels = _.reduce(migrations, toDuplicateLevels, []);
    var duplicates = _.filter(migrations, function(migration) {
      return duplicateLevels.indexOf(migration.level) >= 0;
    });
    if (duplicates.length > 0) return cb(new Error(format('Found migrations with duplicate levels: %s', _.map(duplicates, 'filename').join(', '))));
    return cb(null, migrations);
  }

  function toDuplicateLevels(duplicates, migration, i, migrations) {
    return _.findIndex(migrations, function(candidate) {
      return migration.level === candidate.level;
    }) !== i && duplicates.indexOf(migration.level) < 0 ? duplicates.concat(migration.level) : duplicates;
  }

  function readFile(file, cb) {
    var pathToFile = path.join(directory, file);
    debug('Reading file %s', file);
    fs.readFile(pathToFile, 'utf-8', function(err, script) {
      cb(err, file, script);
    });
  }

  function parseDirectives(script) {
    var directives = {};
    XRegExp.forEach(script, directivePattern, function(match) {
      directives[match[1].toLowerCase()] = match[2].trim();
    });
    return directives;
  };

  function buildMigration(file, script, cb) {
    var match = XRegExp.exec(file, migrationFilePattern);
    if (!match) {
      debug('%s does not match %s -- skipping', file, migrationFilePattern);
      return cb();
    } else if (!new RegExp(config.filter).test(file)) {
      debug('%s does not match %s -- skipping', file, config.filter);
      return cb();
    }
    var level = parseInt(match.level, 10);
    var comment = match.comment.replace(/[-_]+/g, ' ');
    var parsedDirectives = parseDirectives(script);
    var directives = _.merge({}, config.directives, parsedDirectives);

    cb(null, {
      filename: file,
      level: level,
      comment: comment,
      script: script,
      directives: directives,
      audit: config.directives.audit, // backwards compatibility
      namespace: config.namespace
    });
  }

  scanDirectory(cb);
};

