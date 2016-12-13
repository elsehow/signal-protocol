
var WebCrypto = require('node-webcrypto-ossl');
crypto = new WebCrypto();

module.exports = {
  crypto: crypto,
  Worker: require('tiny-worker')
};
