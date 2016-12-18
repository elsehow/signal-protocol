/* vim: ts=4:sw=4 */

// this is concatinated after ../protos/WhisperTextProtocol.proto
// Internal.protoText is getting passed in from that file
// (see the Gruntfile's `protos_concat` routine)
// here we export the loaded protobuf, an object
//    { WhisperMessage, PreKeyWhisperMessage }
module.exports = (function protobuf() {
  'use strict';
  // var dcodeIO = require('../build/dcodeIO.js');
  var protobufjs = require('protobufjs');

  function loadProtoBufs(filename) {
    let protoText = Internal.protoText['protos/' + filename];
    return protobufjs.parse(protoText);//.build('textsecure');
  }

  var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');

  return {
    WhisperMessage            : protocolMessages.root.get('textsecure').get('WhisperMessage'),
    PreKeyWhisperMessage      : protocolMessages.root.get('textsecure').get('PreKeyWhisperMessage')
  };
})();
