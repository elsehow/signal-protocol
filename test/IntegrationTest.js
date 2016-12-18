var signal = require('..');
var SignalStore = require('./InMemorySignalProtocolStore.js')
var assert = require('chai').assert;
var util = require('../src/helpers.js')

describe('Integration test', function() {
  it('imports all methods', function(done) {
    assert.isDefined(signal);
    assert.isDefined(signal.KeyHelper);
    assert.isDefined(signal.SignalProtocolAddress);
    assert.isDefined(signal.SessionBuilder);
    assert.isDefined(signal.SessionCipher);
    assert.isDefined(signal.FingerprintGenerator);
    assert.isDefined(signal._crypto);
    assert.isDefined(signal._curve);
    done();
  });

  it('can play out install-time key stuff', function (done) {
    var KeyHelper = signal.KeyHelper;
    var registrationId = KeyHelper.generateRegistrationId();
    var keyId = 1337;
    var ikp = null; // ref for later
    assert.isDefined(registrationId);
    KeyHelper.generateIdentityKeyPair().then(function(identityKeyPair) {
      assert.isDefined(identityKeyPair.pubKey);
      assert.isDefined(identityKeyPair.privKey);
      ikp = identityKeyPair;
    }).then(function () {
      return KeyHelper.generatePreKey(keyId);
    }).then(function(preKey) {
      assert.isDefined(preKey.keyId);
      assert.isDefined(preKey.keyPair);
    }).then(function () {
      return KeyHelper.generateSignedPreKey(ikp, keyId);
    }).then(function(signedPreKey) {
        assert.isDefined(signedPreKey.keyId);
        assert.isDefined(signedPreKey.keyPair);
    }).then(done, done);
  });

  function generateIdentity(store) {
    return Promise.all([
      signal.KeyHelper.generateIdentityKeyPair(),
      signal.KeyHelper.generateRegistrationId(),
    ]).then(function(result) {
      store.put('identityKey', result[0]);
      store.put('registrationId', result[1]);
    });
  }

  function generatePreKeyBundle(store, preKeyId, signedPreKeyId) {
    return Promise.all([
      store.getIdentityKeyPair(),
      store.getLocalRegistrationId()
    ]).then(function(result) {
      var identity = result[0];
      var registrationId = result[1];

      return Promise.all([
        signal.KeyHelper.generatePreKey(preKeyId),
        signal.KeyHelper.generateSignedPreKey(identity, signedPreKeyId),
      ]).then(function(keys) {
        var preKey = keys[0];
        var signedPreKey = keys[1];

        store.storePreKey(preKeyId, preKey.keyPair);
        store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

        return {
          identityKey: identity.pubKey,
          registrationId : registrationId,
          preKey:  {
            keyId     : preKeyId,
            publicKey : preKey.keyPair.pubKey
          },
          signedPreKey: {
            keyId     : signedPreKeyId,
            publicKey : signedPreKey.keyPair.pubKey,
            signature : signedPreKey.signature
          }
        };
      });
    });
  }

    // returns a promise of
    // [ aliceSessionCipher, bobSessionCipher ]
    function bobAliceSessionCiphers () {
        var ALICE_ADDRESS = new signal.SignalProtocolAddress("+14151111111", 1);
        var BOB_ADDRESS   = new signal.SignalProtocolAddress("+14152222222", 1);

        var aliceStore = new SignalStore();
        var bobStore = new SignalStore();

        var bobPreKeyId = 1337;
        var bobSignedKeyId = 1;

        return Promise.all([
            generateIdentity(aliceStore),
            generateIdentity(bobStore),
        ]).then(function() {
            return generatePreKeyBundle(bobStore, bobPreKeyId, bobSignedKeyId);
        }).then(function(preKeyBundle) {
            var builder = new signal.SessionBuilder(aliceStore, BOB_ADDRESS);
            return builder.processPreKey(preKeyBundle);
        }).then(function () {
            var aliceSessionCipher = new signal.SessionCipher(aliceStore, BOB_ADDRESS);
            var bobSessionCipher = new signal.SessionCipher(bobStore, ALICE_ADDRESS);
            return [ aliceSessionCipher, bobSessionCipher ];
        })
    }

  it('can encrypt + decrypt a long message', function (done) {
      bobAliceSessionCiphers()
          .then(function (ciphers) { 
              var aliceSessionCipher = ciphers[0]
              var bobSessionCipher = ciphers[1]
              var plaintext = require('./long-plaintext.json').plaintext;
              var b = new Buffer(plaintext, 'utf-8');
              aliceSessionCipher.encrypt(b)
                  .then(c => bobSessionCipher.decryptPreKeyWhisperMessage(c.body, 'binary'))
                  .then(decodedPlaintext => {
                      assert.equal(plaintext,new Buffer(decodedPlaintext));
                      done();
                  }).catch(function (err) {
                      assert.isUndefined(err);
                  });
          })
  });
})
