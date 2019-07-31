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

function buildProgress(size, infile, outfile, label) {
  const progressStream = ProgressBar.stream(size, {
    template: [
      ':{label} :{flipper}',
      ' \x1b[32m\u2022\x1b[0m [:{infile}] -> [:{outfile}]',
      ' [:{bar}] [:3{percentage}%] (:{eta}) [:{size}/:{size:total}]',
    ],
    variables: {infile, outfile},
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
    bar.end(`${msg}\n ${`\u2022 Runtime: ${(new Date() - startTime) / 1000}s`}\n ${`\u2022 ${direction} %: ${delta}%`} \n`);
  };
}

function processEncrypt(infile, outfile, args) {
  if (!fs.existsSync(infile)) throw Error('The specified input file is unexistent');
  if (fs.existsSync(outfile) && !args.force) throw Error('The output file already exists!, to force overwrite use the `-f` flag');
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile()) throw Error(`The specified input file [${infile}] is not a file`);

  function doEncrypt(password) {
    const encryptor = new EAESEncryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = fs.createWriteStream(outfile);
    const {bar, progressStream} = buildProgress(inputstat.size, infile, outfile, 'Encrypting...');
    infileStream
      .pipe(progressStream.next())
      .pipe(encryptor)
      .pipe(outfileStream)
      .on('finish', getFinalListener('Encryption Complete!', infile, outfile, bar));
  }

  args.key
    ? doEncrypt(args.key)
    : passwordQuery('Please enter the password for encrypting :').then(({password}) => doEncrypt(password));
}

function processDecrypt(infile, outfile, args) {
  const STARTTIME = new Date();
  if (!fs.existsSync(infile)) throw Error('The specified input file is unexistent');
  if (fs.existsSync(outfile) && !args.force) throw Error('The output file already exists!, to force overwrite use the `-f` flag');
  const inputstat = fs.statSync(infile);
  if (!inputstat.isFile()) throw Error(`The specified input file [${infile}] is not a file`);

  function doDecrypt(password) {
    const decryptor = new EAESDecryptor(password);
    const infileStream = fs.createReadStream(infile);
    const outfileStream = fs.createWriteStream(outfile);
    const {bar, progressStream} = buildProgress(inputstat.size, infile, outfile, 'Decrypting...');
    infileStream
      .pipe(progressStream.next())
      .pipe(decryptor)
      .pipe(outfileStream)
      .on('finish', getFinalListener('Decryption Complete!', infile, outfile, bar));
  }

  args.key
    ? doDecrypt(args.key)
    : passwordQuery('Please enter the password for decrypting :', false).then(({password}) => doDecrypt(password));
}

commander.usage('[[<command>] [<content> [<options>]]] [-h]');

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
  console.log(`lib-EAES Version ${packageJson.version}`);
  console.log('=========================================================================================');
  console.log('\u2022', packageJson.description);
  console.log('\u2022', `Authors: ${packageJson.authors.join(', ')}`);
  console.log('=========================================================================================');
  if (!argv.slice(2).length) commander.outputHelp();
  commander.parse(argv);
}

main(process.argv);