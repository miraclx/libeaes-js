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
// Encrypt
let encryptor = libeaes.EAESEncryptor("#P@$$W0R9");
inputStream.pipe(encryptor).pipe(outputStream);

// Decrypt stream
let decryptor = libeaes.EAESDecryptor("#P@$$W0R9");
inputStream.pipe(decryptor).pipe(outputStream);

// Both
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

### libeaes.rawencrypt(data, key)

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Encrypt the input data, return the processed data

### libeaes.rawdecrypt(data, key)

* `data`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* Returns: [&lt;Buffer&gt;][buffer]

Decrypt the input data, return the processed data

### Class: EAESEncryptor(key[, opts])

* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `opts`: &lt;object&lt
* Returns: [&lt;Buffer&gt;][buffer]

Create an Transforming EAES Encryptor
The opts object is passed into stream.[Transform][transform]

### Class: EAESDecryptor(key[, opts])

* `key`: [&lt;string&gt;][string] | [&lt;Buffer&gt;][buffer]
* `opts`: &lt;object&lt
* Returns: [&lt;Buffer&gt;][buffer]

Create an Transforming EAES Decryptor
The opts object is passed into [stream.Transform][transform]

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

[npm]:  https://github.com/npm/npm "The Node Package Manager"
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
