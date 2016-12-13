// load a workr routine and export it
var workRoutine = require('./curve_work_routine.js');
// our export is a function that takes `self`
// `self` is passed in by webworkify.
// https://github.com/substack/webworkify
module.exports = function (self) {
  workRoutine.apply(self);
};
