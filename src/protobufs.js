/* vim: ts=4:sw=4 */

// this is concatinated after ../protos/WhisperTextProtocol.proto
// Internal.protoText is getting passed in from that file
// (see the Gruntfile's `protos_concat` routine)
// here we export the loaded protobuf, an object
//    { WhisperMessage, PreKeyWhisperMessage }
module.exports = (function protobuf() {
  'use strict';
  // var dcodeIO = require('../build/dcodeIO.js');
  var protobufjs = require('protobufjs')

  function loadProtoBufs(filename) {
    return protobufjs.parse(Internal.protoText['protos/' + filename])//.build('textsecure');
  }

  var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');
  console.log(protocolMessages.root.get('WhisperMesssage'))

  return {
    WhisperMessage            : protocolMessages.root.nested.textsecure.nested.WhisperMessage,
    PreKeyWhisperMessage      : protocolMessages.root.nested.textsecure.nested.PreKeyWhisperMessage
    // WhisperMessage            : protocolMessages.WhisperMessage,
    // PreKeyWhisperMessage      : protocolMessages.PreKeyWhisperMessage
  };
})();
