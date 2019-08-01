/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const stream = require('stream');

// ================================ //
// =========DO NOT TOUCH=========== //
// ================================ //
const EAESMAGIC = 0x656165732d7864;
const MAGICHOOK = 0x6d697261636c78;
// ================================ //
// =========DO NOT TOUCH=========== //
// ================================ //

const PBKDF2_ITERATIONS = 0x2710;
const PBKDF2_SALT_LENGTH = 0x20;
const PBKDF2_DIGEST = 'sha256';
const KEY_LENGTH = 0x20;
const GCM_IV_LENGTH = 0x10;

function generateKey(key, salt) {
  salt = salt || crypto.randomBytes(PBKDF2_SALT_LENGTH);
  return [salt, crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)];
}

function newCipherConstruct(key) {
  const [iv, [salt, cipher_key]] = [crypto.randomBytes(GCM_IV_LENGTH), generateKey(key)];
  const cipher = crypto.createCipheriv('aes-256-ctr', cipher_key, iv);
  cipher.hash = Buffer.concat([iv, salt]);
  return cipher;
}

function newDecipherConstruct([iv, salt], key) {
  const [, cipher_key] = generateKey(key, salt);
  return crypto.createDecipheriv('aes-256-ctr', cipher_key, iv);
}

function rawencrypt(data, key) {
  const cipher = newCipherConstruct(key);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(data, 'utf8')), cipher.final()]);
  return Buffer.concat([cipher.hash, encrypted]);
}

function extractCoordsFromHeader(HEADER) {
  return [0x124e140f, 0x124e142e]
    .reduce((e, A, E, S, d) => ((d = A ^ (3 ^ E)), (e[E][1] = d), e.push([d]), e), [[0]])
    .reduce((a, cx) => (a.push(HEADER.slice(...cx.map(slot => (slot ? MAGICHOOK ^ EAESMAGIC ^ slot : slot)))), a), []);
}

function rawdecrypt(input, key) {
  const [iv, salt, data] = extractCoordsFromHeader(input);
  const decipher = newDecipherConstruct([iv, salt], key);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function encrypt(data, key) {
  return rawencrypt(zlib.gzipSync(data), key);
}

function decrypt(data, key) {
  return zlib.gunzipSync(rawdecrypt(data, key));
}

class EAESEncryptor extends stream.Transform {
  constructor(key, opts) {
    super(opts);
    this._compressionEngine = zlib.createGzip().on('error', err => this.emit('error', err));
    this._encryptionEngine = newCipherConstruct(key).on('error', err => this.emit('error', err));
    this.isinitial = true;
  }

  _transform(chunk, encoding, cb) {
    this._compressionEngine.write(chunk);
    if ((chunk = this._compressionEngine.read())) {
      chunk = this._encryptionEngine.update(chunk);
      if (this.isinitial) {
        chunk = Buffer.concat([this._encryptionEngine.hash, chunk]);
        this.isinitial = false;
      }
    }
    cb(null, chunk);
  }

  _flush(cb) {
    cb(null, this._encryptionEngine.final());
  }
}

// WIP
class EAESDecryptor extends stream.Transform {
  constructor(key, opts) {
    super(opts);
    this._key = key;
    this._metaBlockData = Buffer.alloc(0);
    this._decryptionEngine = null;
    this._decompressionEngine = zlib.createGunzip().on('error', err => this.emit('error', err));
  }

  _transform(chunk, encoding, cb) {
    if (this._metaBlockData.length < GCM_IV_LENGTH + PBKDF2_SALT_LENGTH) {
      const cutIndex = GCM_IV_LENGTH + PBKDF2_SALT_LENGTH - this._metaBlockData;
      this._metaBlockData = Buffer.concat([this._metaBlockData, chunk.slice(0, cutIndex)]);
      chunk = chunk.slice(cutIndex);
    }
    if (chunk.length) {
      if (!this._decryptionEngine)
        this._decryptionEngine = newDecipherConstruct(extractCoordsFromHeader(this._metaBlockData), this._key).on('error', err =>
          this.emit('error', err),
        );
      if ((chunk = this._decryptionEngine.update(chunk))) {
        this._decompressionEngine.write(chunk);
        chunk = this._decompressionEngine.read();
      }
    }
    cb(null, chunk);
  }

  _flush(cb) {
    let chunk;
    if ((chunk = this._decryptionEngine.final())) {
      this._decompressionEngine.write(chunk);
      chunk = this._decompressionEngine.read();
    }
    cb(null, chunk);
  }
}

function encryptFileStream(file, output, key) {
  return fs
    .createReadStream(file)
    .pipe(new EAESEncryptor(key))
    .pipe(fs.createWriteStream(output));
}

function decryptFileStream(file, output, key) {
  return fs
    .createReadStream(file)
    .pipe(new EAESDecryptor(key))
    .pipe(fs.createWriteStream(output));
}

module.exports = {
  encrypt,
  decrypt,
  rawdecrypt,
  rawencrypt,
  EAESEncryptor,
  EAESDecryptor,
  encryptFileStream,
  decryptFileStream,
  newCipherConstruct,
  newDecipherConstruct,
  extractCoordsFromHeader,
};
