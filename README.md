# signal-protocol

[![Build Status](https://travis-ci.org/elsehow/signal-protocol.svg?branch=master)](https://travis-ci.org/elsehow/signal-protocol)
[![Dependencies](https://david-dm.org/elsehow/signal-protocol/status.svg)](https://david-dm.org/elsehow/signal-protocol)
[![DevDependencies](https://david-dm.org/elsehow/signal-protocol/dev-status.svg)](https://david-dm.org/elsehow/signal-protocol?type=dev)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/elsehow.svg)](https://saucelabs.com/u/elsehow)


A ratcheting forward secrecy protocol that works in synchronous and
asynchronous messaging environments.

This repository is forked from WhisperSystem's own [libsignal-protocol-javascript](https://github.com/WhisperSystems/libsignal-protocol-javascript) by **[@liliakai](https://github.com/liliakai)**, modified to support node and the browser. I use [node-webcrypto-ossl](https://github.com/PeculiarVentures/node-webcrypto-ossl) as a drop-in native replacement for WebCrypto API.

**WARNING: This code has NOT been reviewed by an experienced cryptographer. IT IS FOR RESEARCH ONLY!!!!!**

You can read more about the signal protocol 
(formerly /axolotl/ for its self-healing abilities)
[here](https://whispersystems.org/blog/advanced-ratcheting/).

## Install

```sh
npm install signal-protocol
```

## Usage

There are two ways to use this package.

You can require with your front-end bundler of choice (e.g. browserify, webpack):

```js
var signal = require('signal-protocol')
```

**IMPT NOTE!!!** If you intend to call this from the browser, have your bundler exclude `src/node_polyfills.js`. You won't need that file for your browser bundles, and it could crash your bundler. (Even at best, it will add tons of useless junk to your bundled js file).

Or, you can include the prebundled `dist/libsignal.js` in your HTML file.

The following steps will walk you through the lifecycle of the signal protocol

### Generate an indentity + PreKeys

This protocol uses a concept called 'PreKeys'. A PreKey is an ECPublicKey and
an associated unique ID which are stored together by a server. PreKeys can also
be signed.

At install time, clients generate a single signed PreKey, as well as a large
list of unsigned PreKeys, and transmit all of them to the server.

```js
var signal = require('signal-protocol')
var KeyHelper = signal.KeyHelper;

var registrationId = KeyHelper.generateRegistrationId();
// Store registrationId somewhere durable and safe.

KeyHelper.generateIdentityKeyPair().then(function(identityKeyPair) {
    // keyPair -> { pubKey: ArrayBuffer, privKey: ArrayBuffer }
    // Store identityKeyPair somewhere durable and safe.
});

KeyHelper.generatePreKey(keyId).then(function(preKey) {
    store.storePreKey(preKey.keyId, preKey.keyPair);
});

KeyHelper.generateSignedPreKey(identityKeyPair, keyId).then(function(signedPreKey) {
    store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);
});

// Register preKeys and signedPreKey with the server
```

### Build a session

Signal Protocol is session-oriented. Clients establish a "session," which is
then used for all subsequent encrypt/decrypt operations. There is no need to
ever tear down a session once one has been established.

Sessions are established in one of two ways:

1. PreKeyBundles. A client that wishes to send a message to a recipient can
   establish a session by retrieving a PreKeyBundle for that recipient from the
   server.
1. PreKeySignalMessages. A client can receive a PreKeySignalMessage from a
   recipient and use it to establish a session.

#### A note on state

An established session encapsulates a lot of state between two clients. That
state is maintained in durable records which need to be kept for the life of
the session.

State is kept in the following places:

* Identity State. Clients will need to maintain the state of their own identity
  key pair, as well as identity keys received from other clients.
* PreKey State. Clients will need to maintain the state of their generated
  PreKeys.
* Signed PreKey States. Clients will need to maintain the state of their signed
  PreKeys.
* Session State. Clients will need to maintain the state of the sessions they
  have established.

A signal client needs to implement a storage interface that will manage
loading and storing of identity, prekeys, signed prekeys, and session state.
See `test/InMemorySignalProtocolStore.js` for an example.

#### Building a session

Once your storage interface is implemented, building a session is fairly straightforward:

```js
var store   = new MySignalProtocolStore();
var address = new signal.SignalProtocolAddress(recipientId, deviceId);

// Instantiate a SessionBuilder for a remote recipientId + deviceId tuple.
var sessionBuilder = new signal.SessionBuilder(store, address);

// Process a prekey fetched from the server. Returns a promise that resolves
// once a session is created and saved in the store, or rejects if the
// identityKey differs from a previously seen identity for this address.
var promise = sessionBuilder.processPreKey({
    registrationId: <Number>,
    identityKey: <ArrayBuffer>,
    signedPreKey: {
        keyId     : <Number>,
        publicKey : <ArrayBuffer>,
        signature : <ArrayBuffer>
    },
    preKey: {
        keyId     : <Number>,
        publicKey : <ArrayBuffer>
    }
});

promise.then(function onsuccess() {
  // encrypt messages
});

promise.catch(function onerror(error) {
  // handle identity key conflict
});
```


### Encrypting

Once you have a session established with an address, you can encrypt messages
using SessionCipher.

```js
var plaintext = "Hello world";
var sessionCipher = new signal.SessionCipher(store, address);
sessionCipher.encrypt(plaintext).then(function(ciphertext) {
    // ciphertext -> { type: <Number>, body: <string> }
    handle(ciphertext.type, ciphertext.body);
});
```

### Decrypting

Ciphertexts come in two flavors: WhisperMessage and PreKeyWhisperMessage.

```js
var address = new signal.SignalProtocolAddress(recipientId, deviceId);
var sessionCipher = new signal.SessionCipher(store, address);

// Decrypt a PreKeyWhisperMessage by first establishing a new session.
// Returns a promise that resolves when the message is decrypted or
// rejects if the identityKey differs from a previously seen identity for this
// address.
sessionCipher.decryptPreKeyWhisperMessage(ciphertext).then(function(plaintext) {
    // handle plaintext ArrayBuffer
}).catch(function(error) {
    // handle identity key conflict
});

// Decrypt a normal message using an existing session
var sessionCipher = new signal.SessionCipher(store, address);
sessionCipher.decryptWhisperMessage(ciphertext).then(function(plaintext) {
    // handle plaintext ArrayBuffer
});
```

## Cryptography Notice

 A number of nations restrict the use or export of cryptography. If you are potentially subject to such restrictions you should seek competent professional legal advice before attempting to develop or distribute cryptographic code.

## License

I (elsehow) release copyright to
Copyright 2015-2016 Open Whisper Systems 
under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
