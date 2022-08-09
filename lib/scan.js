const fs = require('fs');
const path = require('path');
const format = require('util').format;
const _ = require('lodash');
const async = require('async');
const XRegExp = require('xregexp');

const migrationFilePattern = XRegExp('^(?<level>\\d+)[^\\d](?<comment>.*?)\\.', 'i');
const directivePattern = XRegExp('^--\\s*@MARV\\s+(?<key>\\w+)\\s*=\\s*(?<value>.+)$', 'mig');
const debug = require('debug')('marv:scan');

module.exports = function scan(...args) {
  if (args.length === 2) return module.exports(args[0], {}, args[1]);
  const [directory, options, cb] = args;
  if (options.migrations) {
    /* eslint-disable-next-line no-console */
    if (!options.quiet) console.warn("The 'migrations' option is deprecated. Please use 'directives' instead. You can disable this warning by setting 'quiet' to true.");
    options.directives = options.migrations;
    delete options.migrations;
  }

  const scanDirectory = async.seq(readDirectory, ensureFilesNotFolders, getMarvRc, getMigrations, validateMigrations);
  const getMigration = async.seq(readFile, buildMigration);
  const config = _.merge({ filter: /.*/, directives: {} }, options);

  function readDirectory(cb) {
    debug('Reading directory %s', directory);
    fs.readdir(directory, cb);
  }
  function ensureFilesNotFolders(files, cb) {
    debug('Ensuring that no files read in the directory were folders', directory);
    const filePaths = files.map((file) => path.join(directory, file));
    async.map(filePaths, fs.lstat, (err, results) => {
      if (err) return cb(err);
      const directoryItemsWithoutFolders = files.filter((file, index) => !results[index].isDirectory());
      cb(null, directoryItemsWithoutFolders);
    });
  }

  function getMarvRc(files, cb) {
    if (!_.includes(files, '.marvrc')) return cb(null, files);

    debug('Loading runtime configuration from .marvrc');
    const pathToFile = path.join(directory, '.marvrc');
    fs.readFile(pathToFile, 'utf-8', (err, marvrc) => {
      if (err) return cb(err);
      _.merge(config, JSON.parse(marvrc));
      cb(null, _.without(files, '.marvrc'));
    });
  }

  function getMigrations(files, cb) {
    async.reduce(
      files,
      [],
      (migrations, file, cb) => {
        getMigration(file, (err, migration) => {
          if (err) return cb(err);
          cb(null, _.chain(migrations).concat(migration).compact().value());
        });
      },
      cb
    );
  }

  function validateMigrations(migrations, cb) {
    const duplicateLevels = _.reduce(migrations, toDuplicateLevels, []);
    const duplicates = _.filter(migrations, (migration) => duplicateLevels.indexOf(migration.level) >= 0);
    if (duplicates.length > 0) return cb(new Error(format('Found migrations with duplicate levels: %s', _.map(duplicates, 'filename').join(', '))));
    return cb(null, migrations);
  }

  function toDuplicateLevels(duplicates, migration, i, migrations) {
    return _.findIndex(migrations, (candidate) => migration.level === candidate.level) !== i && duplicates.indexOf(migration.level) < 0 ? duplicates.concat(migration.level) : duplicates;
  }

  function readFile(file, cb) {
    const pathToFile = path.join(directory, file);
    debug('Reading file %s', file);
    fs.readFile(pathToFile, 'utf-8', (err, script) => {
      cb(err, file, script);
    });
  }

  function parseDirectives(script) {
    const directives = {};
    XRegExp.forEach(script, directivePattern, (match) => {
      directives[match[1].toLowerCase()] = match[2].trim();
    });
    return directives;
  }

  function buildMigration(file, script, cb) {
    const match = XRegExp.exec(file, migrationFilePattern);
    if (!match) {
      debug('%s does not match %s -- skipping', file, migrationFilePattern);
      return cb();
    }
    if (!new RegExp(config.filter).test(file)) {
      debug('%s does not match %s -- skipping', file, config.filter);
      return cb();
    }
    const level = parseInt(match.groups.level, 10);
    const comment = match.groups.comment.replace(/[-_]+/g, ' ');
    const parsedDirectives = parseDirectives(script);
    const directives = _.merge({}, config.directives, parsedDirectives);

    cb(null, {
      filename: file,
      level,
      comment,
      script,
      directives,
      audit: config.directives.audit, // backwards compatibility
      namespace: config.namespace,
    });
  }

  scanDirectory(cb);
};
