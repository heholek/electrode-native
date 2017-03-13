import {publishMiniApp} from '../../lib/publication';

exports.command = 'publish [fullNapSelector]'
exports.desc = 'Publish mini app to given native app'

exports.builder = function (yargs) {
  return yargs
    .option('fullNapSelector', {
      alias: 's',
      describe: 'Full native application selector'
    })
    .option('force', {
      alias: 'f',
      type: 'bool',
      describe: 'Force publish'
    })
    .option('verbose', {
      describe: 'Verbose output'
    })
    .option('containerVersion', {
      describe: 'Version to apply to generated container'
    })
    .option('npmPublish', {
      describe: 'Publish to npm'
    })
};

exports.handler = function (argv) {
  return publishMiniApp({
    fullNapSelector: argv.fullNapSelector,
    force: argv.force,
    verbose: argv.verbose,
    containerVersion: argv.containerVersion,
    npmPublish: argv.npmPublish
  });
};
