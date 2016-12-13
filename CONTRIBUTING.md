# Contributing

Thank you for contributing!


## Getting started

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

## Code structure

The source is organized like this:

```
/dist       # Distributables
/build      # Intermediate build files
/src        # JS source files
/native     # C source files for curve25519
/protos     # Protobuf definitions
/test       # Tests
```

The main app entrypoint is `src/main.js`. This is what the caller would require in node, or bundle in browserify (though see note below, Node/browser polyfills).

The main test entrypoint is `test/main.js`.
`test/index.html` compiles everything we need for our tests in the browser.

You can run these by serving the project root and visiting /test (e.g. http://localhost:8000/test).


## Node/browser polyfills

There are 2 node polyfills for browser stuff, one in `src/crypto.js` and one in `src/curve25519_worker_manager.js`
Just search the source for:

```js
// BROWSER POLYFILL
```

to see where they are used.

The file with *all* the polyfills is `src/node_polyfills.js`

We ignore this file when we do our browserify build for testing.

**NOTE/QUESTION**.
Ignoring the polyfill in our test browserify build certainly makes the tests pass, but a caller who downloads the stuff from npm, tries to `require` our package and browserify it for themelves, will be in for a nasty surprise. Lots of native gunk will show up in their browserify errors, and they will probably be confused and walk away. So, how should we make the browser-side require more seamless? Can we have people require a browserified build we produce?


## TODO
- Integrate native test into grunt test routine
- Travis builds for node?
- Fix native bundling issue, mentioned above
