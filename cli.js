#!node

const fs = require('fs');
const xbytes = require('xbytes');
const commander = require('commander');
const ProgressBar = require('xprogress');
const ninjaQuery = require('ninja_query');
const packageJson = require('./package.json');
const {EAESEncryptor, EAESDecryptor} = require('.');

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
      outfile,
      bullet: '\u2022',
    },
    flipper: [...Array(10)].map((...[, i]) => `:{color:random}${':{bullet}'.repeat(i + 1)}:{color:close}`),
    label,
  });
  const {bar} = progressStream;
  return {bar, progressStream};
}

function getFinalListener(msg, i, o, bar) {
  const startTime = new Date();
  return () => {
    const {size: inputSize} = fs.statSync(i);
    const {size: outputSize} = fs.statSync(o);
    let delta = ((outputSize - inputSize) / inputSize) * 100;
    const direction = delta < 0 ? 'Deflation' : delta > 0 ? 'Inflation' : 'Static';
    delta = Math.abs(delta).toFixed(2);
    bar.end(
      [
        ` ${msg}`,
        `  \u2022 Runtime     : ${(new Date() - startTime) / 1000}s`,
        `  \u2022 Input File  : [${i}]`,
        `  \u2022 Output File : [${o}]`,
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
    process.stdout.write(`\x1b[33m[i]\x1b[0m Removing incomplete output file ${outfile}...`);
    fs.unlink(outfile, _err => console.log(_err ? '\x1b[31mfailed\x1b[0m' : '\x1b[32mdone\x1b[0m'));
  };
}

function processEncrypt(infile, outfile, args) {
  if (!fs.existsSync(infile)) console.error('\x1b[31m[!]\x1b[0m The specified input file is unexistent'), process.exit(1);
  if (fs.existsSync(outfile) && !args.force)
    console.error('\x1b[33m[!]\x1b[0m The output file already exists!, to force overwrite use the `-f` flag'), process.exit(1);
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile())
    console.error(`\x1b[31m[!]\x1b[0m The specified input file [${infile}] is not a file`), process.exit(1);

  function doEncrypt(password) {
    const encryptor = new EAESEncryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = fs.createWriteStream(outfile);
    const {bar, progressStream} = buildProgress(infile, outfile, 'Encrypting');
    infileStream
      .pipe(progressStream.next())
      .pipe(
        encryptor
          .on('error:encryptor', wrapError(bar, outfile, 'An error occurred while encrypting'))
          .on('error:compressor', wrapError(bar, outfile, 'An error occurred while compressing')),
      )
      .pipe(outfileStream)
      .on('finish', getFinalListener('Encryption Complete!', infile, outfile, bar));
  }

  args.key
    ? doEncrypt(args.key)
    : passwordQuery('Please enter the password for encrypting :').then(({password}) => doEncrypt(password));
}

function processDecrypt(infile, outfile, args) {
  if (!fs.existsSync(infile)) console.error('\x1b[31m[!]\x1b[0m The specified input file is unexistent'), process.exit(1);
  if (fs.existsSync(outfile) && !args.force)
    console.error('\x1b[33m[!]\x1b[0m The output file already exists!, to force overwrite use the `-f` flag'), process.exit(1);
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile())
    console.error(`\x1b[31m[!]\x1b[0m The specified input file [${infile}] is not a file`), process.exit(1);

  function doDecrypt(password) {
    const decryptor = new EAESDecryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = fs.createWriteStream(outfile);
    const {bar, progressStream} = buildProgress(infile, outfile, 'Decrypting');
    infileStream
      .pipe(progressStream.next())
      .pipe(
        decryptor
          .on('error:decryptor', wrapError(bar, outfile, 'An error occurred while decrypting'))
          .on('error:decompressor', wrapError(bar, outfile, 'An error occurred while decompressing')),
      )
      .pipe(outfileStream)
      .on('finish', getFinalListener('Decryption Complete!', infile, outfile, bar));
  }

  args.key
    ? doDecrypt(args.key)
    : passwordQuery('Please enter the password for decrypting :', false).then(({password}) => doDecrypt(password));
}

commander.usage('[[<command>] [<content> [<options>]]] [-h] [-v]').version(`v${packageJson.version}`, '-v, --version');

commander
  .command('encrypt <file> <output>')
  .alias('enc')
  .description('Use the EAES Algorithm to encrypt a specified file')
  .option('-f, --force', 'Explicitly force overwrite of output file (if existent)')
  .option('-k, --key <password>', 'Password to be used in the operation')
  .action(processEncrypt);
commander
  .command('decrypt <file> <output>')
  .alias('dec')
  .description('Use the EAES Algorithm to decrypt an encrypted file')
  .option('-f, --force', 'Explicitly force overwrite of output file (if existent)')
  .option('-k, --key <password>', 'Password to be used in the operation')
  .action(processDecrypt);

function main(argv) {
  if (!argv.includes('-v')) {
    console.log(`lib-EAES Version ${packageJson.version}`);
    console.log('=========================================================================================');
    console.log('\u2022', packageJson.description);
    console.log('\u2022', `Authors: ${packageJson.authors.join(', ')}`);
    console.log('=========================================================================================');
    if (!argv.slice(2).filter(v => v !== '-').length) commander.outputHelp();
  }
  commander.parse(argv);
}

main(process.argv);
