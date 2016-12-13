var assert = require('chai').assert;

function assertEqualArrayBuffers(ab1, ab2) {
  assert.deepEqual(new Uint8Array(ab1), new Uint8Array(ab2));
};

function hexToArrayBuffer(str) {
  var ret = new ArrayBuffer(str.length / 2);
  var array = new Uint8Array(ret);
  for (var i = 0; i < str.length/2; i++)
    array[i] = parseInt(str.substr(i*2, 2), 16);
  return ret;
};

module.exports = {
  assertEqualArrayBuffers: assertEqualArrayBuffers,
  hexToArrayBuffer: hexToArrayBuffer
};
