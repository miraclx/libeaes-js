# libE-AES

> Enhanced simultaneous compression + encryption

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

[![NPM][npm-image-url]][npm-url]

## Installing

Via [NPM][npm]:

``` bash
npm install libeaes
```

## Usage

``` javascript
// Node CommonJS
const libeaes = require('libeaes');
// Or ES6
import libeaes from 'libeaes';
```

## Examples

### Singular Operation

``` javascript
let password = "#P@$$W0R9";
let encrypted = libeaes.encrypt('Hello world', password);
// Compressed, encrypted content

let decrypted = libeaes.decrypt(encrypted, password);
// "Hello world"
```

### Stream Operation

``` javascript
// Encrypt a stream, pipe output elsewhere
let encryptor = libeaes.EAESEncryptor("#P@$$W0R9");
inputStream.pipe(encryptor).pipe(outputStream);

// Decrypt a stream, pipe output elsewhere
let decryptor = libeaes.EAESDecryptor("#P@$$W0R9");
inputStream.pipe(decryptor).pipe(outputStream);

// Stream sequential encryption and decryption operations
let encryptor = libeaes.EAESEncryptor("#P@$$W0R9");
let decryptor = libeaes.EAESDecryptor("#P@$$W0R9");

inputStream.pipe(encryptor).pipe(decryptor).pipe(outputStream);
// inputStream == outputStream
```

### File Operations

``` javascript
libeaes.encryptFileStream("rawfile.txt", "encryptedfile.txt", "#P@$$W0R9");
libeaes.decryptFileStream("encryptedfile.txt", "decryptedfile.txt", "#P@$$W0R9");
```


## API

### libeaes.encrypt(data, key)

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Compress + Encrypt the input data, return the processed data

### libeaes.decrypt(data, key)

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Decrypt + Decompress the input data, return the processed data

### libeaes.rawencrypt(data, key) *_Excluding compression_

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Encrypt the input data, return the processed data.

Input data is encrypted without initial compression.


### libeaes.rawdecrypt(data, key) *_Excluding decompression_

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Decrypt raw input data, return the processed data.

Input data is assumed to be uncompressed.

### Class: EAESEncryptor(key[, opts]) <sub>extends</sub> [`zlib.Gunzip`][gzip]

* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `opts`: [&lt;zlib options&gt;](https://nodejs.org/api/zlib.html#zlib_class_options)

Create a Transforming EAES Encryptor.

Data piped in here is compressed and encryped with the `key` configuration.

EAES Streams are encrypted, compressed streams that are tailored to [the algorithm](lib/index.js) in this repo.

The `opts` object are passed directly into [zlib.Gzip][gzip]

#### Event: `'error'`

* `err`: [&lt;Error&gt;][error]
* `code`: [&lt;number&gt;][number]

This is emitted by either the compression or encryption process.

`code` is `1` when emitted by the encryption engine and [`undefined`][undefined] otherwise.

Catch errors explicitly with the `'error:compressor'` and `'error:encryptor'` events.

#### Event: `'error:encryptor'`

* `err`: [&lt;Error&gt;][error]

The `'error:encryptor'` event is emitted if an error occurred while encrypting compressed data. The listener callback is passed a single `Error` argument when called.

The stream is not closed when the `'error:encryptor'` event is emitted.

#### Event: `'error:compressor'`

* `err`: [&lt;Error&gt;][error]

The `'error:compressor'` event is emitted if an error occurred while encrypting raw data. The listener callback is passed a single `Error` argument when called.

The stream is not closed when the `'error:compressor'` event is emitted.


### Class: EAESDecryptor(key[, opts]) <sub>extends</sub> [`zlib.Gunzip`][gunzip]

* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `opts`: [&lt;zlib options&gt;](https://nodejs.org/api/zlib.html#zlib_class_options)

Create an EAES Decryptor Stream.

Data piped in here is decrypted and decompressed with the `key` configuration.

EAES Streams are encrypted, compressed streams that are tailored to [the algorithm](lib/index.js) in this repo.

The `opts` object are passed directly into [zlib.Gunzip][gunzip]

#### Event: `'error'`

* `err`: [&lt;Error&gt;][error]
* `code`: [&lt;number&gt;][number]

This is emitted by either the decompression or decryption process.

`code` is `1` when emitted by the decryption engine and [`undefined`][undefined] otherwise.

Catch errors explicitly with the `'error:decompressor'` and `'error:decryptor'` events.

#### Event: `'error:decryptor'`

* `err`: [&lt;Error&gt;][error]

The `'error:decryptor'` event is emitted if an error occurred while decrypting decompressed data. The listener callback is passed a single `Error` argument when called.

The stream is not closed when the `'error:decryptor'` event is emitted.

#### Event: `'error:decompressor'`

* `err`: [&lt;Error&gt;][error]

The `'error:decompressor'` event is emitted if an error occurred while decrypting raw data. The listener callback is passed a single `Error` argument when called.

The stream is not closed when the `'error:decompressor'` event is emitted.

### libeaes.encryptFileStream(infile, outfile, key)

* `infile`: [&lt;string&gt;][string] | [&lt;buffer&gt;][buffer] | [&lt;url&gt;][url]
* `outfile`: [&lt;string&gt;][string] | [&lt;buffer&gt;][buffer] | [&lt;url&gt;][url]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;fs.WriteStream&gt;](https://nodejs.org/api/fs.html#fs_class_fs_writestream)

Read the file, compress and encrypt each chunk, write to the outfile

### libeaes.decryptFileStream(infile, outfile, key)

* `infile`: [&lt;string&gt;][string] | [&lt;buffer&gt;][buffer] | [&lt;url&gt;][url]
* `outfile`: [&lt;string&gt;][string] | [&lt;buffer&gt;][buffer] | [&lt;url&gt;][url]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;fs.WriteStream&gt;](https://nodejs.org/api/fs.html#fs_class_fs_writestream)

Read the file, decrypt and decompress each chunk, write to the outfile

## Development

### Building

Feel free to clone, use in adherance to the [license](#license) and perhaps send pull requests

``` bash
git clone https://github.com/miraclx/libeaes-js.git
cd libeaes-js
npm install
# hack on code
npm run build
npm test
```

### Testing

Tests are executed with [Jest][jest]. To use it, simple run `npm install`, it will install
Jest and its dependencies in your project's `node_modules` directory followed by `npm run build` and finally `npm test`.

To run the tests:

```bash
npm install
npm run build
npm test
```

## License

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) &lt;omiraculous@gmail.com&gt;

[npm]:  https://github.com/npm/cli "The Node Package Manager"
[jest]:  https://github.com/facebook/jest "Delightful JavaScript Testing"
[license]:  LICENSE "Apache 2.0 License"
[author-url]: https://github.com/miraclx

[npm-url]: https://npmjs.org/package/libeaes
[npm-image]: https://badgen.net/npm/node/libeaes
[npm-image-url]: https://nodei.co/npm/libeaes.png?stars&downloads
[downloads-url]: https://npmjs.org/package/libeaes
[downloads-image]: https://badgen.net/npm/dm/libeaes

[url]: https://nodejs.org/api/url.html#url_the_whatwg_url_api
[buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type
[transform]: https://nodejs.org/api/stream.html#stream_class_stream_transform
