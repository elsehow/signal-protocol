## Contributing

Thank you for contributing!

The source is organized like this:

```
/dist       # Distributables
/build      # Intermediate build files
/src        # JS source files
/native     # C source files for curve25519
/protos     # Protobuf definitions
/test       # Tests
```

To compile curve25519 from C souce files in `/native`, install
[emscripten](https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html).
Theen, build all the assets with

```
grunt build
```

To test, you can serve the project root on http, 
and navigate to localhost:[port]/test to see the Mocha tests run.

For the full CI experience, you will need an account with 
[Sauce Labs](https://saucelabs.com).  Get your username and API key, 
then set the appropriate envirionment variables to run the tests:

```sh
SAUCE_USERNAME="your-sauce-username" SAUCE_ACCESS_KEY="your-sauce-key" grunt test
```


## Node/browser polyfills

There are 2 node polyfills for browser stuff, one in `src/crypto.js` and one in `src/curve25519_worker_manager.js`
Just search the source for:

```js
// BROWSER POLYFILL
```
