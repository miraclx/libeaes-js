#!/usr/bin/env node

const fs = require('fs');
const tty = require('tty');
const util = require('util');
const stream = require('stream');
const xbytes = require('xbytes');
const commander = require('commander');
const ProgressBar = require('xprogress');
const ninjaQuery = require('ninja_query');
const packageJson = require('./package.json');
const {EAESEncryptor, EAESDecryptor} = require('.');

const [log, error] = [, ,].fill(
  (function ninjaLoggers() {
    let output;
    if (!process.stdout.isTTY && ['linux', 'android', 'darwin'].includes(process.platform))
      (output = new tty.WriteStream(fs.openSync('/dev/tty', 'w'))), process.on('beforeExit', () => output.destroy());
    else output = process.stdout;
    return function ninjaLogger(...args) {
      output.write(`${util.format(...args)}\n`);
    };
  })(),
);

function passwordQuery(query, confirm = true) {
  return ninjaQuery.password(
    {name: 'password', message: query, mask: '*'},
    {
      confirm,
      confirmMessage: 'Re-enter to confirm :',
      unmatchMessage: "\x1b[33m[!]\x1b[0m Passwords don't match",
    },
  );
}

function buildProgress(infile, outfile, label) {
  const progressStream = ProgressBar.stream(fs.statSync(infile).size, {
    template: [
      ':{label} :{flipper}',
      ' | :{bullet} [:{infile}] -> [:{outfile}]',
      ' | [:{bar}] [:3{percentage}%] (:{eta}) [:{size}/:{size:total}]',
    ],
    variables: {
      infile,
      outfile: outfile || '<stdout>',
      bullet: '\u2022',
    },
    flipper: [...Array(10)].map((...[, i]) => `:{color:random}${':{bullet}'.repeat(i + 1)}:{color:close}`),
    label,
  });
  const {bar} = progressStream;
  return {bar, progressStream};
}

function getFinalListener(msg, i, oStream, bar) {
  const startTime = new Date();
  return () => {
    const {size: inputSize} = fs.statSync(i);
    const outputSize = oStream.length;
    let delta = ((outputSize - inputSize) / inputSize) * 100;
    const direction = delta < 0 ? 'Deflation' : delta > 0 ? 'Inflation' : 'Static';
    delta = Math.abs(delta).toFixed(2);
    bar.end(
      [
        ` ${msg}`,
        `  \u2022 Runtime     : ${(new Date() - startTime) / 1000}s`,
        `  \u2022 Input File  : [${i}]`,
        `  \u2022 Output File : [${oStream.outfile || '<stdout>'}]`,
        `  \u2022 Input Size  : ${xbytes(inputSize)}`,
        `  \u2022 Output Size : ${xbytes(outputSize)}`,
        `  \u2022 ${direction}   : ${delta}%`,
        '',
      ].join('\n'),
    );
  };
}

function wrapError(bar, outfile, msg) {
  return err => {
    bar.end(
      `\x1b[31m[!]\x1b[0m ${msg}\n${`${err}`
        .split('\n')
        .map(v => ` \x1b[36m\u2022\x1b[0m ${v}`)
        .join('\n')}\n`,
    );
    if (outfile)
      process.stdout.write(`\x1b[33m[i]\x1b[0m Removing incomplete output file ${outfile}...`),
        fs.unlink(outfile, _err => log(_err ? '\x1b[31mfailed\x1b[0m' : '\x1b[32mdone\x1b[0m'));
  };
}

function wrapOutFile(outfile) {
  const outFileStream = outfile ? fs.createWriteStream(outfile) : process.stdout;
  const streamWrapper = new stream.Writable({
    write(v, e, c) {
      this.length = (this.length || 0) + v.length;
      outFileStream.write(v, e, c);
    },
  });
  process.stdout.on('error', er => streamWrapper.emit('error', er));
  streamWrapper.outfile = outfile;
  streamWrapper.coreFileStream = outFileStream;
  return streamWrapper;
}

function processEncrypt(infile, outfile, args) {
  if (!fs.existsSync(infile)) error('\x1b[31m[!]\x1b[0m The specified input file is unexistent'), process.exit(1);
  if (fs.existsSync(outfile) && !args.force)
    error('\x1b[33m[!]\x1b[0m The output file already exists!, to force overwrite use the `-f` flag'), process.exit(1);
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile()) error(`\x1b[31m[!]\x1b[0m The specified input file [${infile}] is not a file`), process.exit(1);
  if (!outfile && process.stdout.isTTY)
    error(`\x1b[31m[!]\x1b[0m No output was specified. Try defining an output file or piping the output.`), process.exit(1);

  function doEncrypt(password) {
    const encryptor = new EAESEncryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = wrapOutFile(outfile);
    const {bar, progressStream} = buildProgress(infile, outfile, 'Encrypting');
    infileStream
      .pipe(progressStream.next())
      .pipe(
        encryptor
          .on('error:encryptor', wrapError(bar, outfile, 'An error occurred while encrypting'))
          .on('error:compressor', wrapError(bar, outfile, 'An error occurred while compressing')),
      )
      .pipe(outfileStream.on('error', wrapError(bar, outfile, 'An error occurred while processing output')))
      .on('finish', getFinalListener('Encryption Complete!', infile, outfileStream, bar));
  }

  args.key
    ? doEncrypt(args.key)
    : passwordQuery('Please enter the password for encrypting :').then(({password}) => doEncrypt(password));
}

function processDecrypt(infile, outfile, args) {
  if (!fs.existsSync(infile)) error('\x1b[31m[!]\x1b[0m The specified input file is unexistent'), process.exit(1);
  if (fs.existsSync(outfile) && !args.force)
    error('\x1b[33m[!]\x1b[0m The output file already exists!, to force overwrite use the `-f` flag'), process.exit(1);
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile()) error(`\x1b[31m[!]\x1b[0m The specified input file [${infile}] is not a file`), process.exit(1);
  if (!outfile && process.stdout.isTTY)
    error(`\x1b[31m[!]\x1b[0m No output was specified. Try defining an output file or piping the output.`), process.exit(1);

  function doDecrypt(password) {
    const decryptor = new EAESDecryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = wrapOutFile(outfile);
    const {bar, progressStream} = buildProgress(infile, outfile, 'Decrypting');
    infileStream
      .pipe(progressStream.next())
      .pipe(
        decryptor
          .on('error:decryptor', wrapError(bar, outfile, 'An error occurred while decrypting'))
          .on('error:decompressor', wrapError(bar, outfile, 'An error occurred while decompressing')),
      )
      .pipe(outfileStream.on('error', wrapError(bar, outfile, 'An error occurred while processing output')))
      .on('finish', getFinalListener('Decryption Complete!', infile, outfileStream, bar));
  }

  args.key
    ? doDecrypt(args.key)
    : passwordQuery('Please enter the password for decrypting :', false).then(({password}) => doDecrypt(password));
}

commander.usage('[[<command>] [<content> [<options>]]] [-h] [-v]').version(`v${packageJson.version}`, '-v, --version');

commander
  .command('encrypt <file> [output]')
  .alias('enc')
  .description('Use the EAES Algorithm to encrypt a specified file')
  .option('-f, --force', 'Explicitly force overwrite of output file (if existent)')
  .option('-k, --key <password>', 'Password to be used in the operation')
  .action(processEncrypt);
commander
  .command('decrypt <file> [output]')
  .alias('dec')
  .description('Use the EAES Algorithm to decrypt an encrypted file')
  .option('-f, --force', 'Explicitly force overwrite of output file (if existent)')
  .option('-k, --key <password>', 'Password to be used in the operation')
  .action(processDecrypt);

function main(argv) {
  if (!argv.includes('-v')) {
    log(`lib-EAES Version ${packageJson.version}`);
    log('=========================================================================================');
    log('\u2022', packageJson.description);
    log('\u2022', `Authors: ${packageJson.authors.join(', ')}`);
    log('=========================================================================================');
    if (!argv.slice(2).filter(v => v !== '-').length) commander.outputHelp();
  }
  commander.parse(argv);
}

main(process.argv);
