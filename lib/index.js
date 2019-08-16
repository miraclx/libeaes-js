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

class EAESEncryptor extends zlib.Gzip {
  constructor(key, opts) {
    super(opts);
    this.isinitial = true;
    this.overflow = Buffer.alloc(0);
    this._encryptionEngine = newCipherConstruct(key).on('error', err => this.emit('error', err, 1));
    this.on('error', (err, code) => this.emit(`error:${code ? 'encryptor' : 'compressor'}`, err));
  }

  push(chunk, encoding) {
    if (chunk) {
      chunk = this._encryptionEngine.update(chunk);
      if (this.isinitial) {
        chunk = Buffer.concat([this._encryptionEngine.hash, chunk]);
        this.isinitial = false;
      }
      chunk = Buffer.concat([this.overflow, chunk]);
      this.overflow = chunk.slice(this.readableHighWaterMark, Infinity);
      chunk = chunk.slice(0, this.readableHighWaterMark);
    }
    zlib.Gzip.prototype.push.call(this, chunk, encoding);
  }

  // eslint-disable-next-line no-underscore-dangle
  _flush(cb) {
    this.push.call(this, Buffer.alloc(0));
    this._transform(Buffer.alloc(0), '', cb);
  }
}

class EAESDecryptor extends zlib.Gunzip {
  constructor(key, opts) {
    super(opts);
    this.HEADER = Buffer.alloc(0);
    this._key = key;
    this._decryptionEngine = null;
    this.on('error', (err, code) => this.emit(`error:${code ? 'decryptor' : 'decompressor'}`, err));
  }

  // eslint-disable-next-line no-underscore-dangle
  _transform(chunk, encoding, cb) {
    if (this.HEADER.length < GCM_IV_LENGTH + PBKDF2_SALT_LENGTH) {
      const cutIndex = GCM_IV_LENGTH + PBKDF2_SALT_LENGTH - this.HEADER;
      this.HEADER = Buffer.concat([this.HEADER, chunk.slice(0, cutIndex)]);
      chunk = chunk.slice(cutIndex);
    }
    // eslint-disable-next-line no-underscore-dangle
    if (chunk.length) {
      if (!this._decryptionEngine)
        this._decryptionEngine = newDecipherConstruct(extractCoordsFromHeader(this.HEADER), this._key).on('error', err =>
          this.emit('error', err, 1),
        );
      chunk = this._decryptionEngine.update(chunk);
    }
    zlib.Gunzip.prototype._transform.call(this, chunk, encoding, cb);
  }

  _flush(cb) {
    zlib.Gunzip.prototype._transform.call(this, this._decryptionEngine.final(), '', cb);
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
