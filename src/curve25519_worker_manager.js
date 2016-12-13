'use strict';

// I am the...workee?
var origCurve25519 = require('./curve25519_wrapper.js');
// var CurveWrapper = require('./curve25519_wrapper.js');

// function workerRoutine () {
//   self.onmessage = function(e) {
//     origCurve25519.curve25519_async[e.data.methodName].apply(null, e.data.args).then(function(result) {
//       self.postMessage({ id: e.data.id, result: result });
//     }).catch(function(error) {
//       self.postMessage({ id: e.data.id, error: error.message });
//     });
//   };
// }


function Curve25519Worker() {
  this.jobs = {};
  this.jobId = 0;
  // BROWSER POLYFILL
  try {
    var work = require('webworkify');
    this.worker = work(require('./curve25519_worker.js'));
  } catch (e) {
    var Worker  = require('./node_polyfills.js').Worker;
    var routine = require('./curve_work_routine.js');
    this.worker = new Worker(routine);
  }
  // this.worker = new Worker(url);
  this.worker.onmessage = function(e) {
    var job = this.jobs[e.data.id];
    if (e.data.error && typeof job.onerror === 'function') {
      job.onerror(new Error(e.data.error));
    } else if (typeof job.onsuccess === 'function') {
      job.onsuccess(e.data.result);
    }
    delete this.jobs[e.data.id];
  }.bind(this);
}

Curve25519Worker.prototype = {
  constructor: Curve25519Worker,
  postMessage: function(methodName, args, onsuccess, onerror) {
    return new Promise(function(resolve, reject) {
      this.jobs[this.jobId] = { onsuccess: resolve, onerror: reject };
      this.worker.postMessage({ id: this.jobId, methodName: methodName, args: args });
      this.jobId++;
    }.bind(this));
  },
  keyPair: function(privKey) {
    return this.postMessage('keyPair', [privKey]);
  },
  sharedSecret: function(pubKey, privKey) {
    return this.postMessage('sharedSecret', [pubKey, privKey]);
  },
  sign: function(privKey, message) {
    return this.postMessage('sign', [privKey, message]);
  },
  verify: function(pubKey, message, sig) {
    return this.postMessage('verify', [pubKey, message, sig]);
  }
};

// stuf for export

var self = {};

self.startWorker = function(url) {
  self.stopWorker(); // there can be only one
  self.curve25519_async = new Curve25519Worker(url);
};

self.stopWorker = function() {
  if (self.curve25519_async instanceof Curve25519Worker) {
    var worker = self.curve25519_async.worker;
    self.curve25519_async = origCurve25519;
    worker.terminate();
  }
};


module.exports = self;
