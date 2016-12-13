/* vim: ts=4:sw=4 */

'use strict';

var Crypto = require('../src/crypto.js');
var SignalProtocolStore = require('./InMemorySignalProtocolStore.js');
var assert = require('chai').assert;
var test_util = require('./test_helpers.js');
var hexToArrayBuffer = test_util.hexToArrayBuffer;
var assertEqualArrayBuffers = test_util.assertEqualArrayBuffers;


function testSignalProtocolStore (testIdentityKeyStore, testPreKeyStore, testSignedPreKeyStore, testSessionStore) {
  describe("SignalProtocolStore", function() {
    var store = new SignalProtocolStore();
    var registrationId = 1337;
    var identityKey = {
      pubKey: Crypto.crypto.getRandomBytes(33),
      privKey: Crypto.crypto.getRandomBytes(32),
    };
    before(function() {
      store.put('registrationId', registrationId);
      store.put('identityKey', identityKey);
    });
    testIdentityKeyStore(store, registrationId, identityKey);
    testPreKeyStore(store);
    testSignedPreKeyStore(store);
    testSessionStore(store);
  });
}

module.exports = testSignalProtocolStore;
