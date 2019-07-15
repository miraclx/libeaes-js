const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const stream = require('stream');

let EAESMAGIC = 0x656165732d7864;
let MAGICHOOK = 0x6d697261636c78;

let PBKDF2_ITERATIONS = 0x2710;
let PBKDF2_SALT_LENGTH = 0x20;
let PBKDF2_DIGEST = 'sha256';
let KEY_LENGTH = 0x20;
let GCM_IV_LENGTH = 0x10;

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
  let [, cipher_key] = generateKey(key, salt);
  return crypto.createDecipheriv('aes-256-ctr', cipher_key, iv);
}

function rawencrypt(data, key) {
  let cipher = newCipherConstruct(key);
  let encrypted = Buffer.concat([cipher.update(Buffer.from(data, 'utf8')), cipher.final()]);
  return Buffer.concat([cipher.hash, encrypted]);
}

function rawdecrypt(input, key) {
  let [iv, salt, data] = [0x124e140f, 0x124e142e]
    .reduce((e, A, E, S, d) => ((d = A ^ (3 ^ E)), (e[E][1] = d), e.push([d]), e), [[0]])
    .reduce((a, cx) => (a.push(input.slice(...cx.map(slot => (slot ? MAGICHOOK ^ EAESMAGIC ^ slot : slot)))), a), []);
  const decipher = newDecipherConstruct([iv, salt], key);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function encrypt(data, key) {
  return rawencrypt(zlib.gzipSync(data), key);
}

function decrypt(data, key) {
  return rawdecrypt(zlib.gunzipSync(data), key);
}

class EAESEncryptor extends stream.Transform {
  constructor(key, opts) {
    super(opts);
    this._encryptionEngine = newCipherConstruct(key);
    this.isinitial = true;
  }
  _transform(chunk, encoding, cb) {
    chunk = this._encryptionEngine.update(zlib.gzipSync(chunk));
    if (this.isinitial) {
      chunk = Buffer.concat([this._encryptionEngine.hash, chunk]);
      this.isinitial = false;
    }
    this.push(chunk);
    cb();
  }
  _flush(cb) {
    this.push(this._encryptionEngine.final());
    cb();
  }
}

class EAESDecryptor extends stream.Transform {
  constructor(key, opts) {
    super(opts);
    this._key = key;
    this._metaBlockData = Buffer.alloc(0);
    this._decryptionEngine = null;
  }
  _transform(chunk, encoding, cb) {
    if (this._metaBlockData.length < GCM_IV_LENGTH + PBKDF2_SALT_LENGTH) {
      let cutIndex = GCM_IV_LENGTH + PBKDF2_SALT_LENGTH - this._metaBlockData;
      this._metaBlockData = Buffer.concat([this._metaBlockData, chunk.slice(0, cutIndex)]);
      chunk = chunk.slice(cutIndex);
    }
    if (chunk.length) {
      if (!this._decryptionEngine)
        this._decryptionEngine = newDecipherConstruct(
          [0x124e140f, 0x124e142e]
            .reduce((e, A, E, S, d) => ((d = A ^ (3 ^ E)), (e[E][1] = d), e.push([d]), e), [[0]])
            .reduce(
              (a, cx) => (a.push(this._metaBlockData.slice(...cx.map(slot => (slot ? MAGICHOOK ^ EAESMAGIC ^ slot : slot)))), a),
              []
            ),
          this._key
        );
      try {
        this.push(zlib.gunzipSync(this._decryptionEngine.update(chunk)));
      } catch (e) {
        throw new Error('An error occurred while decrypting');
      }
    }
    cb();
  }
  _flush(cb) {
    this.push(zlib.gunzipSync(this._decryptionEngine.final()));
    cb();
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
};
