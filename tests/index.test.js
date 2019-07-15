const libeaes = require('../dist');

const input = Buffer.from('helloworld');
const password = '#P@$$W0R9';

test('check decryption results in input data', () => {
  const encrypted = libeaes.encrypt(input, password);
  const decrypted = libeaes.decrypt(encrypted, password);

  expect(decrypted).toStrictEqual(input);
});
