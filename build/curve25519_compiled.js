// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 34528;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([8,201,188,243,103,230,9,106,59,167,202,132,133,174,103,187,43,248,148,254,114,243,110,60,241,54,29,95,58,245,79,165,209,130,230,173,127,82,14,81,31,108,62,43,140,104,5,155,107,189,65,251,171,217,131,31,121,33,126,19,25,205,224,91,34,174,40,215,152,47,138,66,205,101,239,35,145,68,55,113,47,59,77,236,207,251,192,181,188,219,137,129,165,219,181,233,56,181,72,243,91,194,86,57,25,208,5,182,241,17,241,89,155,79,25,175,164,130,63,146,24,129,109,218,213,94,28,171,66,2,3,163,152,170,7,216,190,111,112,69,1,91,131,18,140,178,228,78,190,133,49,36,226,180,255,213,195,125,12,85,111,137,123,242,116,93,190,114,177,150,22,59,254,177,222,128,53,18,199,37,167,6,220,155,148,38,105,207,116,241,155,193,210,74,241,158,193,105,155,228,227,37,79,56,134,71,190,239,181,213,140,139,198,157,193,15,101,156,172,119,204,161,12,36,117,2,43,89,111,44,233,45,131,228,166,110,170,132,116,74,212,251,65,189,220,169,176,92,181,83,17,131,218,136,249,118,171,223,102,238,82,81,62,152,16,50,180,45,109,198,49,168,63,33,251,152,200,39,3,176,228,14,239,190,199,127,89,191,194,143,168,61,243,11,224,198,37,167,10,147,71,145,167,213,111,130,3,224,81,99,202,6,112,110,14,10,103,41,41,20,252,47,210,70,133,10,183,39,38,201,38,92,56,33,27,46,237,42,196,90,252,109,44,77,223,179,149,157,19,13,56,83,222,99,175,139,84,115,10,101,168,178,119,60,187,10,106,118,230,174,237,71,46,201,194,129,59,53,130,20,133,44,114,146,100,3,241,76,161,232,191,162,1,48,66,188,75,102,26,168,145,151,248,208,112,139,75,194,48,190,84,6,163,81,108,199,24,82,239,214,25,232,146,209,16,169,101,85,36,6,153,214,42,32,113,87,133,53,14,244,184,209,187,50,112,160,106,16,200,208,210,184,22,193,164,25,83,171,65,81,8,108,55,30,153,235,142,223,76,119,72,39,168,72,155,225,181,188,176,52,99,90,201,197,179,12,28,57,203,138,65,227,74,170,216,78,115,227,99,119,79,202,156,91,163,184,178,214,243,111,46,104,252,178,239,93,238,130,143,116,96,47,23,67,111,99,165,120,114,171,240,161,20,120,200,132,236,57,100,26,8,2,199,140,40,30,99,35,250,255,190,144,233,189,130,222,235,108,80,164,21,121,198,178,247,163,249,190,43,83,114,227,242,120,113,198,156,97,38,234,206,62,39,202,7,194,192,33,199,184,134,209,30,235,224,205,214,125,218,234,120,209,110,238,127,79,125,245,186,111,23,114,170,103,240,6,166,152,200,162,197,125,99,10,174,13,249,190,4,152,63,17,27,71,28,19,53,11,113,27,132,125,4,35,245,119,219,40,147,36,199,64,123,171,202,50,188,190,201,21,10,190,158,60,76,13,16,156,196,103,29,67,182,66,62,203,190,212,197,76,42,126,101,252,156,41,127,89,236,250,214,58,171,111,203,95,23,88,71,74,140,25,68,108,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,47,99,168,254,170,226,153,255,102,179,216,0,226,141,122,255,122,66,153,254,182,245,134,0,227,228,25,1,214,57,235,255,216,173,56,255,181,231,210,0,119,128,157,255,129,95,136,255,110,126,51,0,2,169,183,255,7,130,98,254,69,176,94,255,116,4,227,1,217,242,145,255,202,173,31,1,105,1,39,255,46,175,69,0,228,47,58,255,215,224,69,254,207,56,69,255,16,254,139,255,23,207,212,255,202,20,126,255,95,213,96,255,9,176,33,0,200,5,207,255,241,42,128,254,35,33,192,255,248,229,196,1,129,17,120,0,251,103,151,255,7,52,112,255,140,56,66,255,40,226,245,255,217,70,37,254,172,214,9,255,72,67,134,1,146,192,214,255,44,38,112,0,68,184,75,255,206,90,251,0,149,235,141,0,181,170,58,0,116,244,239,0,92,157,2,0,102,173,98,0,233,137,96,1,127,49,203,0,5,155,148,0,23,148,9,255,211,122,12,0,34,134,26,255,219,204,136,0,134,8,41,255,224,83,43,254,85,25,247,0,109,127,0,254,169,136,48,0,238,119,219,255,231,173,213,0,206,18,254,254,8,186,7,255,126,9,7,1,111,42,72,0,111,52,236,254,96,63,141,0,147,191,127,254,205,78,192,255,14,106,237,1,187,219,76,0,175,243,187,254,105,89,173,0,85,25,89,1,162,243,148,0,2,118,209,254,33,158,9,0,139,163,46,255,93,70,40,0,108,42,142,254,111,252,142,255,155,223,144,0,51,229,167,255,73,252,155,255,94,116,12,255,152,160,218,255,156,238,37,255,179,234,207,255,197,0,179,255,154,164,141,0,225,196,104,0,10,35,25,254,209,212,242,255,97,253,222,254,184,101,229,0,222,18,127,1,164,136,135,255,30,207,140,254,146,97,243,0,129,192,26,254,201,84,33,255,111,10,78,255,147,81,178,255,4,4,24,0,161,238,215,255,6,141,33,0,53,215,14,255,41,181,208,255,231,139,157,0,179,203,221,255,255,185,113,0,189,226,172,255,113,66,214,255,202,62,45,255,102,64,8,255,78,174,16,254,133,117,68,255,182,120,89,255,133,114,211,0,189,110,21,255,15,10,106,0,41,192,1,0,152,232,121,255,188,60,160,255,153,113,206,255,0,183,226,254,180,13,72,255,176,160,14,254,211,201,134,255,158,24,143,0,127,105,53,0,96,12,189,0,167,215,251,255,159,76,128,254,106,101,225,255,30,252,4,0,146,12,174,0,89,241,178,254,10,229,166,255,123,221,42,254,30,20,212,0,82,128,3,0,48,209,243,0,119,121,64,255,50,227,156,255,0,110,197,1,103,27,144,0,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,234,113,60,255,37,255,57,255,69,178,182,254,128,208,179,0,118,26,125,254,3,7,214,255,241,50,77,255,85,203,197,255,211,135,250,255,25,48,100,255,187,213,180,254,17,88,105,0,83,209,158,1,5,115,98,0,4,174,60,254,171,55,110,255,217,181,17,255,20,188,170,0,146,156,102,254,87,214,174,255,114,122,155,1,233,44,170,0,127,8,239,1,214,236,234,0,175,5,219,0,49,106,61,255,6,66,208,255,2,106,110,255,81,234,19,255,215,107,192,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,178,9,252,254,100,110,212,0,14,5,167,0,233,239,163,255,28,151,157,1,101,146,10,255,254,158,70,254,71,249,228,0,88,30,50,0,68,58,160,255,191,24,104,1,129,66,129,255,192,50,85,255,8,179,138,255,38,250,201,0,115,80,160,0,131,230,113,0,125,88,147,0,90,68,199,0,253,76,158,0,28,255,118,0,113,250,254,0,66,75,46,0,230,218,43,0,229,120,186,1,148,68,43,0,136,124,238,1,187,107,197,255,84,53,246,255,51,116,254,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,68,113,21,255,222,186,59,255,66,7,241,1,69,6,72,0,86,156,108,254,55,167,89,0,109,52,219,254,13,176,23,255,196,44,106,255,239,149,71,255,164,140,125,255,159,173,1,0,51,41,231,0,145,62,33,0,138,111,93,1,185,83,69,0,144,115,46,0,97,151,16,255,24,228,26,0,49,217,226,0,113,75,234,254,193,153,12,255,182,48,96,255,14,13,26,0,128,195,249,254,69,193,59,0,132,37,81,254,125,106,60,0,214,240,169,1,164,227,66,0,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,143,62,221,0,129,89,214,255,55,139,5,254,68,20,191,255,14,204,178,1,35,195,217,0,47,51,206,1,38,246,165,0,206,27,6,254,158,87,36,0,217,52,146,255,125,123,215,255,85,60,31,255,171,13,7,0,218,245,88,254,252,35,60,0,55,214,160,255,133,101,56,0,224,32,19,254,147,64,234,0,26,145,162,1,114,118,125,0,248,252,250,0,101,94,196,255,198,141,226,254,51,42,182,0,135,12,9,254,109,172,210,255,197,236,194,1,241,65,154,0,48,156,47,255,153,67,55,255,218,165,34,254,74,180,179,0,218,66,71,1,88,122,99,0,212,181,219,255,92,42,231,255,239,0,154,0,245,77,183,255,94,81,170,1,18,213,216,0,171,93,71,0,52,94,248,0,18,151,161,254,197,209,66,255,174,244,15,254,162,48,183,0,49,61,240,254,182,93,195,0,199,228,6,1,200,5,17,255,137,45,237,255,108,148,4,0,90,79,237,255,39,63,77,255,53,82,207,1,142,22,118,255,101,232,18,1,92,26,67,0,5,200,88,255,33,168,138,255,149,225,72,0,2,209,27,255,44,245,168,1,220,237,17,255,30,211,105,254,141,238,221,0,128,80,245,254,111,254,14,0,222,95,190,1,223,9,241,0,146,76,212,255,108,205,104,255,63,117,153,0,144,69,48,0,35,228,111,0,192,33,193,255,112,214,190,254,115,152,151,0,23,102,88,0,51,74,248,0,226,199,143,254,204,162,101,255,208,97,189,1,245,104,18,0,230,246,30,255,23,148,69,0,110,88,52,254,226,181,89,255,208,47,90,254,114,161,80,255,33,116,248,0,179,152,87,255,69,144,177,1,88,238,26,255,58,32,113,1,1,77,69,0,59,121,52,255,152,238,83,0,52,8,193,0,231,39,233,255,199,34,138,0,222,68,173,0,91,57,242,254,220,210,127,255,192,7,246,254,151,35,187,0,195,236,165,0,111,93,206,0,212,247,133,1,154,133,209,255,155,231,10,0,64,78,38,0,122,249,100,1,30,19,97,255,62,91,249,1,248,133,77,0,197,63,168,254,116,10,82,0,184,236,113,254,212,203,194,255,61,100,252,254,36,5,202,255,119,91,153,255,129,79,29,0,103,103,171,254,237,215,111,255,216,53,69,0,239,240,23,0,194,149,221,255,38,225,222,0,232,255,180,254,118,82,133,255,57,209,177,1,139,232,133,0,158,176,46,254,194,115,46,0,88,247,229,1,28,103,191,0,221,222,175,254,149,235,44,0,151,228,25,254,218,105,103,0,142,85,210,0,149,129,190,255,213,65,94,254,117,134,224,255,82,198,117,0,157,221,220,0,163,101,36,0,197,114,37,0,104,172,166,254,11,182,0,0,81,72,188,255,97,188,16,255,69,6,10,0,199,147,145,255,8,9,115,1,65,214,175,255,217,173,209,0,80,127,166,0,247,229,4,254,167,183,124,255,90,28,204,254,175,59,240,255,11,41,248,1,108,40,51,255,144,177,195,254,150,250,126,0,138,91,65,1,120,60,222,255,245,193,239,0,29,214,189,255,128,2,25,0,80,154,162,0,77,220,107,1,234,205,74,255,54,166,103,255,116,72,9,0,228,94,47,255,30,200,25,255,35,214,89,255,61,176,140,255,83,226,163,255,75,130,172,0,128,38,17,0,95,137,152,255,215,124,159,1,79,93,0,0,148,82,157,254,195,130,251,255,40,202,76,255,251,126,224,0,157,99,62,254,207,7,225,255,96,68,195,0,140,186,157,255,131,19,231,255,42,128,254,0,52,219,61,254,102,203,72,0,141,7,11,255,186,164,213,0,31,122,119,0,133,242,145,0,208,252,232,255,91,213,182,255,143,4,250,254,249,215,74,0,165,30,111,1,171,9,223,0,229,123,34,1,92,130,26,255,77,155,45,1,195,139,28,255,59,224,78,0,136,17,247,0,108,121,32,0,79,250,189,255,96,227,252,254,38,241,62,0,62,174,125,255,155,111,93,255,10,230,206,1,97,197,40,255,0,49,57,254,65,250,13,0,18,251,150,255,220,109,210,255,5,174,166,254,44,129,189,0,235,35,147,255,37,247,141,255,72,141,4,255,103,107,255,0,247,90,4,0,53,44,42,0,2,30,240,0,4,59,63,0,88,78,36,0,113,167,180,0,190,71,193,255,199,158,164,255,58,8,172,0,77,33,12,0,65,63,3,0,153,77,33,255,172,254,102,1,228,221,4,255,87,30,254,1,146,41,86,255,138,204,239,254,108,141,17,255,187,242,135,0,210,208,127,0,68,45,14,254,73,96,62,0,81,60,24,255,170,6,36,255,3,249,26,0,35,213,109,0,22,129,54,255,21,35,225,255,234,61,56,255,58,217,6,0,143,124,88,0,236,126,66,0,209,38,183,255,34,238,6,255,174,145,102,0,95,22,211,0,196,15,153,254,46,84,232,255,117,34,146,1,231,250,74,255,27,134,100,1,92,187,195,255,170,198,112,0,120,28,42,0,209,70,67,0,29,81,31,0,29,168,100,1,169,173,160,0,107,35,117,0,62,96,59,255,81,12,69,1,135,239,190,255,220,252,18,0,163,220,58,255,137,137,188,255,83,102,109,0,96,6,76,0,234,222,210,255,185,174,205,1,60,158,213,255,13,241,214,0,172,129,140,0,93,104,242,0,192,156,251,0,43,117,30,0,225,81,158,0,127,232,218,0,226,28,203,0,233,27,151,255,117,43,5,255,242,14,47,255,33,20,6,0,137,251,44,254,27,31,245,255,183,214,125,254,40,121,149,0,186,158,213,255,89,8,227,0,69,88,0,254,203,135,225,0,201,174,203,0,147,71,184,0,18,121,41,254,94,5,78,0,224,214,240,254,36,5,180,0,251,135,231,1,163,138,212,0,210,249,116,254,88,129,187,0,19,8,49,254,62,14,144,255,159,76,211,0,214,51,82,0,109,117,228,254,103,223,203,255,75,252,15,1,154,71,220,255,23,13,91,1,141,168,96,255,181,182,133,0,250,51,55,0,234,234,212,254,175,63,158,0,39,240,52,1,158,189,36,255,213,40,85,1,32,180,247,255,19,102,26,1,84,24,97,255,69,21,222,0,148,139,122,255,220,213,235,1,232,203,255,0,121,57,147,0,227,7,154,0,53,22,147,1,72,1,225,0,82,134,48,254,83,60,157,255,145,72,169,0,34,103,239,0,198,233,47,0,116,19,4,255,184,106,9,255,183,129,83,0,36,176,230,1,34,103,72,0,219,162,134,0,245,42,158,0,32,149,96,254,165,44,144,0,202,239,72,254,215,150,5,0,42,66,36,1,132,215,175,0,86,174,86,255,26,197,156,255,49,232,135,254,103,182,82,0,253,128,176,1,153,178,122,0,245,250,10,0,236,24,178,0,137,106,132,0,40,29,41,0,50,30,152,255,124,105,38,0,230,191,75,0,143,43,170,0,44,131,20,255,44,13,23,255,237,255,155,1,159,109,100,255,112,181,24,255,104,220,108,0,55,211,131,0,99,12,213,255,152,151,145,255,238,5,159,0,97,155,8,0,33,108,81,0,1,3,103,0,62,109,34,255,250,155,180,0,32,71,195,255,38,70,145,1,159,95,245,0,69,229,101,1,136,28,240,0,79,224,25,0,78,110,121,255,248,168,124,0,187,128,247,0,2,147,235,254,79,11,132,0,70,58,12,1,181,8,163,255,79,137,133,255,37,170,11,255,141,243,85,255,176,231,215,255,204,150,164,255,239,215,39,255,46,87,156,254,8,163,88,255,172,34,232,0,66,44,102,255,27,54,41,254,236,99,87,255,41,123,169,1,52,114,43,0,117,134,40,0,155,134,26,0,231,207,91,254,35,132,38,255,19,102,125,254,36,227,133,255,118,3,113,255,29,13,124,0,152,96,74,1,88,146,206,255,167,191,220,254,162,18,88,255,182,100,23,0,31,117,52,0,81,46,106,1,12,2,7,0,69,80,201,1,209,246,172,0,12,48,141,1,224,211,88,0,116,226,159,0,122,98,130,0,65,236,234,1,225,226,9,255,207,226,123,1,89,214,59,0,112,135,88,1,90,244,203,255,49,11,38,1,129,108,186,0,89,112,15,1,101,46,204,255,127,204,45,254,79,255,221,255,51,73,18,255,127,42,101,255,241,21,202,0,160,227,7,0,105,50,236,0,79,52,197,255,104,202,208,1,180,15,16,0,101,197,78,255,98,77,203,0,41,185,241,1,35,193,124,0,35,155,23,255,207,53,192,0,11,125,163,1,249,158,185,255,4,131,48,0,21,93,111,255,61,121,231,1,69,200,36,255,185,48,185,255,111,238,21,255,39,50,25,255,99,215,163,255,87,212,30,255,164,147,5,255,128,6,35,1,108,223,110,255,194,76,178,0,74,101,180,0,243,47,48,0,174,25,43,255,82,173,253,1,54,114,192,255,40,55,91,0,215,108,176,255,11,56,7,0,224,233,76,0,209,98,202,254,242,25,125,0,44,193,93,254,203,8,177,0,135,176,19,0,112,71,213,255,206,59,176,1,4,67,26,0,14,143,213,254,42,55,208,255,60,67,120,0,193,21,163,0,99,164,115,0,10,20,118,0,156,212,222,254,160,7,217,255,114,245,76,1,117,59,123,0,176,194,86,254,213,15,176,0,78,206,207,254,213,129,59,0,233,251,22,1,96,55,152,255,236,255,15,255,197,89,84,255,93,149,133,0,174,160,113,0,234,99,169,255,152,116,88,0,144,164,83,255,95,29,198,255,34,47,15,255,99,120,134,255,5,236,193,0,249,247,126,255,147,187,30,0,50,230,117,255,108,217,219,255,163,81,166,255,72,25,169,254,155,121,79,255,28,155,89,254,7,126,17,0,147,65,33,1,47,234,253,0,26,51,18,0,105,83,199,255,163,196,230,0,113,248,164,0,226,254,218,0,189,209,203,255,164,247,222,254,255,35,165,0,4,188,243,1,127,179,71,0,37,237,254,255,100,186,240,0,5,57,71,254,103,72,73,255,244,18,81,254,229,210,132,255,238,6,180,255,11,229,174,255,227,221,192,1,17,49,28,0,163,215,196,254,9,118,4,255,51,240,71,0,113,129,109,255,76,240,231,0,188,177,127,0,125,71,44,1,26,175,243,0,94,169,25,254,27,230,29,0,15,139,119,1,168,170,186,255,172,197,76,255,252,75,188,0,137,124,196,0,72,22,96,255,45,151,249,1,220,145,100,0,64,192,159,255,120,239,226,0,129,178,146,0,0,192,125,0,235,138,234,0,183,157,146,0,83,199,192,255,184,172,72,255,73,225,128,0,77,6,250,255,186,65,67,0,104,246,207,0,188,32,138,255,218,24,242,0,67,138,81,254,237,129,121,255,20,207,150,1,41,199,16,255,6,20,128,0,159,118,5,0,181,16,143,255,220,38,15,0,23,64,147,254,73,26,13,0,87,228,57,1,204,124,128,0,43,24,223,0,219,99,199,0,22,75,20,255,19,27,126,0,157,62,215,0,110,29,230,0,179,167,255,1,54,252,190,0,221,204,182,254,179,158,65,255,81,157,3,0,194,218,159,0,170,223,0,0,224,11,32,255,38,197,98,0,168,164,37,0,23,88,7,1,164,186,110,0,96,36,134,0,234,242,229,0,250,121,19,0,242,254,112,255,3,47,94,1,9,239,6,255,81,134,153,254,214,253,168,255,67,124,224,0,245,95,74,0,28,30,44,254,1,109,220,255,178,89,89,0,252,36,76,0,24,198,46,255,76,77,111,0,134,234,136,255,39,94,29,0,185,72,234,255,70,68,135,255,231,102,7,254,77,231,140,0,167,47,58,1,148,97,118,255,16,27,225,1,166,206,143,255,110,178,214,255,180,131,162,0,143,141,225,1,13,218,78,255,114,153,33,1,98,104,204,0,175,114,117,1,167,206,75,0,202,196,83,1,58,64,67,0,138,47,111,1,196,247,128,255,137,224,224,254,158,112,207,0,154,100,255,1,134,37,107,0,198,128,79,255,127,209,155,255,163,254,185,254,60,14,243,0,31,219,112,254,29,217,65,0,200,13,116,254,123,60,196,255,224,59,184,254,242,89,196,0,123,16,75,254,149,16,206,0,69,254,48,1,231,116,223,255,209,160,65,1,200,80,98,0,37,194,184,254,148,63,34,0,139,240,65,255,217,144,132,255,56,38,45,254,199,120,210,0,108,177,166,255,160,222,4,0,220,126,119,254,165,107,160,255,82,220,248,1,241,175,136,0,144,141,23,255,169,138,84,0,160,137,78,255,226,118,80,255,52,27,132,255,63,96,139,255,152,250,39,0,188,155,15,0,232,51,150,254,40,15,232,255,240,229,9,255,137,175,27,255,75,73,97,1,218,212,11,0,135,5,162,1,107,185,213,0,2,249,107,255,40,242,70,0,219,200,25,0,25,157,13,0,67,82,80,255,196,249,23,255,145,20,149,0,50,72,146,0,94,76,148,1,24,251,65,0,31,192,23,0,184,212,201,255,123,233,162,1,247,173,72,0,162,87,219,254,126,134,89,0,159,11,12,254,166,105,29,0,73,27,228,1,113,120,183,255,66,163,109,1,212,143,11,255,159,231,168,1,255,128,90,0,57,14,58,254,89,52,10,255,253,8,163,1,0,145,210,255,10,129,85,1,46,181,27,0,103,136,160,254,126,188,209,255,34,35,111,0,215,219,24,255,212,11,214,254,101,5,118,0,232,197,133,255,223,167,109,255,237,80,86,255,70,139,94,0,158,193,191,1,155,15,51,255,15,190,115,0,78,135,207,255,249,10,27,1,181,125,233,0,95,172,13,254,170,213,161,255,39,236,138,255,95,93,87,255,190,128,95,0,125,15,206,0,166,150,159,0,227,15,158,255,206,158,120,255,42,141,128,0,101,178,120,1,156,109,131,0,218,14,44,254,247,168,206,255,212,112,28,0,112,17,228,255,90,16,37,1,197,222,108,0,254,207,83,255,9,90,243,255,243,244,172,0,26,88,115,255,205,116,122,0,191,230,193,0,180,100,11,1,217,37,96,255,154,78,156,0,235,234,31,255,206,178,178,255,149,192,251,0,182,250,135,0,246,22,105,0,124,193,109,255,2,210,149,255,169,17,170,0,0,96,110,255,117,9,8,1,50,123,40,255,193,189,99,0,34,227,160,0,48,80,70,254,211,51,236,0,45,122,245,254,44,174,8,0,173,37,233,255,158,65,171,0,122,69,215,255,90,80,2,255,131,106,96,254,227,114,135,0,205,49,119,254,176,62,64,255,82,51,17,255,241,20,243,255,130,13,8,254,128,217,243,255,162,27,1,254,90,118,241,0,246,198,246,255,55,16,118,255,200,159,157,0,163,17,1,0,140,107,121,0,85,161,118,255,38,0,149,0,156,47,238,0,9,166,166,1,75,98,181,255,50,74,25,0,66,15,47,0,139,225,159,0,76,3,142,255,14,238,184,0,11,207,53,255,183,192,186,1,171,32,174,255,191,76,221,1,247,170,219,0,25,172,50,254,217,9,233,0,203,126,68,255,183,92,48,0,127,167,183,1,65,49,254,0,16,63,127,1,254,21,170,255,59,224,127,254,22,48,63,255,27,78,130,254,40,195,29,0,250,132,112,254,35,203,144,0,104,169,168,0,207,253,30,255,104,40,38,254,94,228,88,0,206,16,128,255,212,55,122,255,223,22,234,0,223,197,127,0,253,181,181,1,145,102,118,0,236,153,36,255,212,217,72,255,20,38,24,254,138,62,62,0,152,140,4,0,230,220,99,255,1,21,212,255,148,201,231,0,244,123,9,254,0,171,210,0,51,58,37,255,1,255,14,255,244,183,145,254,0,242,166,0,22,74,132,0,121,216,41,0,95,195,114,254,133,24,151,255,156,226,231,255,247,5,77,255,246,148,115,254,225,92,81,255,222,80,246,254,170,123,89,255,74,199,141,0,29,20,8,255,138,136,70,255,93,75,92,0,221,147,49,254,52,126,226,0,229,124,23,0,46,9,181,0,205,64,52,1,131,254,28,0,151,158,212,0,131,64,78,0,206,25,171,0,0,230,139,0,191,253,110,254,103,247,167,0,64,40,40,1,42,165,241,255,59,75,228,254,124,243,189,255,196,92,178,255,130,140,86,255,141,89,56,1,147,198,5,255,203,248,158,254,144,162,141,0,11,172,226,0,130,42,21,255,1,167,143,255,144,36,36,255,48,88,164,254,168,170,220,0,98,71,214,0,91,208,79,0,159,76,201,1,166,42,214,255,69,255,0,255,6,128,125,255,190,1,140,0,146,83,218,255,215,238,72,1,122,127,53,0,189,116,165,255,84,8,66,255,214,3,208,255,213,110,133,0,195,168,44,1,158,231,69,0,162,64,200,254,91,58,104,0,182,58,187,254,249,228,136,0,203,134,76,254,99,221,233,0,75,254,214,254,80,69,154,0,64,152,248,254,236,136,202,255,157,105,153,254,149,175,20,0,22,35,19,255,124,121,233,0,186,250,198,254,132,229,139,0,137,80,174,255,165,125,68,0,144,202,148,254,235,239,248,0,135,184,118,0,101,94,17,255,122,72,70,254,69,130,146,0,127,222,248,1,69,127,118,255,30,82,215,254,188,74,19,255,229,167,194,254,117,25,66,255,65,234,56,254,213,22,156,0,151,59,93,254,45,28,27,255,186,126,164,255,32,6,239,0,127,114,99,1,219,52,2,255,99,96,166,254,62,190,126,255,108,222,168,1,75,226,174,0,230,226,199,0,60,117,218,255,252,248,20,1,214,188,204,0,31,194,134,254,123,69,192,255,169,173,36,254,55,98,91,0,223,42,102,254,137,1,102,0,157,90,25,0,239,122,64,255,252,6,233,0,7,54,20,255,82,116,174,0,135,37,54,255,15,186,125,0,227,112,175,255,100,180,225,255,42,237,244,255,244,173,226,254,248,18,33,0,171,99,150,255,74,235,50,255,117,82,32,254,106,168,237,0,207,109,208,1,228,9,186,0,135,60,169,254,179,92,143,0,244,170,104,255,235,45,124,255,70,99,186,0,117,137,183,0,224,31,215,0,40,9,100,0,26,16,95,1,68,217,87,0,8,151,20,255,26,100,58,255,176,165,203,1,52,118,70,0,7,32,254,254,244,254,245,255,167,144,194,255,125,113,23,255,176,121,181,0,136,84,209,0,138,6,30,255,89,48,28,0,33,155,14,255,25,240,154,0,141,205,109,1,70,115,62,255,20,40,107,254,138,154,199,255,94,223,226,255,157,171,38,0,163,177,25,254,45,118,3,255,14,222,23,1,209,190,81,255,118,123,232,1,13,213,101,255,123,55,123,254,27,246,165,0,50,99,76,255,140,214,32,255,97,65,67,255,24,12,28,0,174,86,78,1,64,247,96,0,160,135,67,0,66,55,243,255,147,204,96,255,26,6,33,255,98,51,83,1,153,213,208,255,2,184,54,255,25,218,11,0,49,67,246,254,18,149,72,255,13,25,72,0,42,79,214,0,42,4,38,1,27,139,144,255,149,187,23,0,18,164,132,0,245,84,184,254,120,198,104,255,126,218,96,0,56,117,234,255,13,29,214,254,68,47,10,255,167,154,132,254,152,38,198,0,66,178,89,255,200,46,171,255,13,99,83,255,210,187,253,255,170,45,42,1,138,209,124,0,214,162,141,0,12,230,156,0,102,36,112,254,3,147,67,0,52,215,123,255,233,171,54,255,98,137,62,0,247,218,39,255,231,218,236,0,247,191,127,0,195,146,84,0,165,176,92,255,19,212,94,255,17,74,227,0,88,40,153,1,198,147,1,255,206,67,245,254,240,3,218,255,61,141,213,255,97,183,106,0,195,232,235,254,95,86,154,0,209,48,205,254,118,209,241,255,240,120,223,1,213,29,159,0,163,127,147,255,13,218,93,0,85,24,68,254,70,20,80,255,189,5,140,1,82,97,254,255,99,99,191,255,132,84,133,255,107,218,116,255,112,122,46,0,105,17,32,0,194,160,63,255,68,222,39,1,216,253,92,0,177,105,205,255,149,201,195,0,42,225,11,255,40,162,115,0,9,7,81,0,165,218,219,0,180,22,0,254,29,146,252,255,146,207,225,1,180,135,96,0,31,163,112,0,177,11,219,255,133,12,193,254,43,78,50,0,65,113,121,1,59,217,6,255,110,94,24,1,112,172,111,0,7,15,96,0,36,85,123,0,71,150,21,255,208,73,188,0,192,11,167,1,213,245,34,0,9,230,92,0,162,142,39,255,215,90,27,0,98,97,89,0,94,79,211,0,90,157,240,0,95,220,126,1,102,176,226,0,36,30,224,254,35,31,127,0,231,232,115,1,85,83,130,0,210,73,245,255,47,143,114,255,68,65,197,0,59,72,62,255,183,133,173,254,93,121,118,255,59,177,81,255,234,69,173,255,205,128,177,0,220,244,51,0,26,244,209,1,73,222,77,255,163,8,96,254,150,149,211,0,158,254,203,1,54,127,139,0,161,224,59,0,4,109,22,255,222,42,45,255,208,146,102,255,236,142,187,0,50,205,245,255,10,74,89,254,48,79,142,0,222,76,130,255,30,166,63,0,236,12,13,255,49,184,244,0,187,113,102,0,218,101,253,0,153,57,182,254,32,150,42,0,25,198,146,1,237,241,56,0,140,68,5,0,91,164,172,255,78,145,186,254,67,52,205,0,219,207,129,1,109,115,17,0,54,143,58,1,21,248,120,255,179,255,30,0,193,236,66,255,1,255,7,255,253,192,48,255,19,69,217,1,3,214,0,255,64,101,146,1,223,125,35,255,235,73,179,255,249,167,226,0,225,175,10,1,97,162,58,0,106,112,171,1,84,172,5,255,133,140,178,255,134,245,142,0,97,90,125,255,186,203,185,255,223,77,23,255,192,92,106,0,15,198,115,255,217,152,248,0,171,178,120,255,228,134,53,0,176,54,193,1,250,251,53,0,213,10,100,1,34,199,106,0,151,31,244,254,172,224,87,255,14,237,23,255,253,85,26,255,127,39,116,255,172,104,100,0,251,14,70,255,212,208,138,255,253,211,250,0,176,49,165,0,15,76,123,255,37,218,160,255,92,135,16,1,10,126,114,255,70,5,224,255,247,249,141,0,68,20,60,1,241,210,189,255,195,217,187,1,151,3,113,0,151,92,174,0,231,62,178,255,219,183,225,0,23,23,33,255,205,181,80,0,57,184,248,255,67,180,1,255,90,123,93,255,39,0,162,255,96,248,52,255,84,66,140,0,34,127,228,255,194,138,7,1,166,110,188,0,21,17,155,1,154,190,198,255,214,80,59,255,18,7,143,0,72,29,226,1,199,217,249,0,232,161,71,1,149,190,201,0,217,175,95,254,113,147,67,255,138,143,199,255,127,204,1,0,29,182,83,1,206,230,155,255,186,204,60,0,10,125,85,255,232,96,25,255,255,89,247,255,213,254,175,1,232,193,81,0,28,43,156,254,12,69,8,0,147,24,248,0,18,198,49,0,134,60,35,0,118,246,18,255,49,88,254,254,228,21,186,255,182,65,112,1,219,22,1,255,22,126,52,255,189,53,49,255,112,25,143,0,38,127,55,255,226,101,163,254,208,133,61,255,137,69,174,1,190,118,145,255,60,98,219,255,217,13,245,255,250,136,10,0,84,254,226,0,201,31,125,1,240,51,251,255,31,131,130,255,2,138,50,255,215,215,177,1,223,12,238,255,252,149,56,255,124,91,68,255,72,126,170,254,119,255,100,0,130,135,232,255,14,79,178,0,250,131,197,0,138,198,208,0,121,216,139,254,119,18,36,255,29,193,122,0,16,42,45,255,213,240,235,1,230,190,169,255,198,35,228,254,110,173,72,0,214,221,241,255,56,148,135,0,192,117,78,254,141,93,207,255,143,65,149,0,21,18,98,255,95,44,244,1,106,191,77,0,254,85,8,254,214,110,176,255,73,173,19,254,160,196,199,255,237,90,144,0,193,172,113,255,200,155,136,254,228,90,221,0,137,49,74,1,164,221,215,255,209,189,5,255,105,236,55,255,42,31,129,1,193,255,236,0,46,217,60,0,138,88,187,255,226,82,236,255,81,69,151,255,142,190,16,1,13,134,8,0,127,122,48,255,81,64,156,0,171,243,139,0,237,35,246,0,122,143,193,254,212,122,146,0,95,41,255,1,87,132,77,0,4,212,31,0,17,31,78,0,39,45,173,254,24,142,217,255,95,9,6,255,227,83,6,0,98,59,130,254,62,30,33,0,8,115,211,1,162,97,128,255,7,184,23,254,116,28,168,255,248,138,151,255,98,244,240,0,186,118,130,0,114,248,235,255,105,173,200,1,160,124,71,255,94,36,164,1,175,65,146,255,238,241,170,254,202,198,197,0,228,71,138,254,45,246,109,255,194,52,158,0,133,187,176,0,83,252,154,254,89,189,221,255,170,73,252,0,148,58,125,0,36,68,51,254,42,69,177,255,168,76,86,255,38,100,204,255,38,53,35,0,175,19,97,0,225,238,253,255,81,81,135,0,210,27,255,254,235,73,107,0,8,207,115,0,82,127,136,0,84,99,21,254,207,19,136,0,100,164,101,0,80,208,77,255,132,207,237,255,15,3,15,255,33,166,110,0,156,95,85,255,37,185,111,1,150,106,35,255,166,151,76,0,114,87,135,255,159,194,64,0,12,122,31,255,232,7,101,254,173,119,98,0,154,71,220,254,191,57,53,255,168,232,160,255,224,32,99,255,218,156,165,0,151,153,163,0,217,13,148,1,197,113,89,0,149,28,161,254,207,23,30,0,105,132,227,255,54,230,94,255,133,173,204,255,92,183,157,255,88,144,252,254,102,33,90,0,159,97,3,0,181,218,155,255,240,114,119,0,106,214,53,255,165,190,115,1,152,91,225,255,88,106,44,255,208,61,113,0,151,52,124,0,191,27,156,255,110,54,236,1,14,30,166,255,39,127,207,1,229,199,28,0,188,228,188,254,100,157,235,0,246,218,183,1,107,22,193,255,206,160,95,0,76,239,147,0,207,161,117,0,51,166,2,255,52,117,10,254,73,56,227,255,152,193,225,0,132,94,136,255,101,191,209,0,32,107,229,255,198,43,180,1,100,210,118,0,114,67,153,255,23,88,26,255,89,154,92,1,220,120,140,255,144,114,207,255,252,115,250,255,34,206,72,0,138,133,127,255,8,178,124,1,87,75,97,0,15,229,92,254,240,67,131,255,118,123,227,254,146,120,104,255,145,213,255,1,129,187,70,255,219,119,54,0,1,19,173,0,45,150,148,1,248,83,72,0,203,233,169,1,142,107,56,0,247,249,38,1,45,242,80,255,30,233,103,0,96,82,70,0,23,201,111,0,81,39,30,255,161,183,78,255,194,234,33,255,68,227,140,254,216,206,116,0,70,27,235,255,104,144,79,0,164,230,93,254,214,135,156,0,154,187,242,254,188,20,131,255,36,109,174,0,159,112,241,0,5,110,149,1,36,165,218,0,166,29,19,1,178,46,73,0,93,43,32,254,248,189,237,0,102,155,141,0,201,93,195,255,241,139,253,255,15,111,98,255,108,65,163,254,155,79,190,255,73,174,193,254,246,40,48,255,107,88,11,254,202,97,85,255,253,204,18,255,113,242,66,0,110,160,194,254,208,18,186,0,81,21,60,0,188,104,167,255,124,166,97,254,210,133,142,0,56,242,137,254,41,111,130,0,111,151,58,1,111,213,141,255,183,172,241,255,38,6,196,255,185,7,123,255,46,11,246,0,245,105,119,1,15,2,161,255,8,206,45,255,18,202,74,255,83,124,115,1,212,141,157,0,83,8,209,254,139,15,232,255,172,54,173,254,50,247,132,0,214,189,213,0,144,184,105,0,223,254,248,0,255,147,240,255,23,188,72,0,7,51,54,0,188,25,180,254,220,180,0,255,83,160,20,0,163,189,243,255,58,209,194,255,87,73,60,0,106,24,49,0,245,249,220,0,22,173,167,0,118,11,195,255,19,126,237,0,110,159,37,255,59,82,47,0,180,187,86,0,188,148,208,1,100,37,133,255,7,112,193,0,129,188,156,255,84,106,129,255,133,225,202,0,14,236,111,255,40,20,101,0,172,172,49,254,51,54,74,255,251,185,184,255,93,155,224,255,180,249,224,1,230,178,146,0,72,57,54,254,178,62,184,0,119,205,72,0,185,239,253,255,61,15,218,0,196,67,56,255,234,32,171,1,46,219,228,0,208,108,234,255,20,63,232,255,165,53,199,1,133,228,5,255,52,205,107,0,74,238,140,255,150,156,219,254,239,172,178,255,251,189,223,254,32,142,211,255,218,15,138,1,241,196,80,0,28,36,98,254,22,234,199,0,61,237,220,255,246,57,37,0,142,17,142,255,157,62,26,0,43,238,95,254,3,217,6,255,213,25,240,1,39,220,174,255,154,205,48,254,19,13,192,255,244,34,54,254,140,16,155,0,240,181,5,254,155,193,60,0,166,128,4,255,36,145,56,255,150,240,219,0,120,51,145,0,82,153,42,1,140,236,146,0,107,92,248,1,189,10,3,0,63,136,242,0,211,39,24,0,19,202,161,1,173,27,186,255,210,204,239,254,41,209,162,255,182,254,159,255,172,116,52,0,195,103,222,254,205,69,59,0,53,22,41,1,218,48,194,0,80,210,242,0,210,188,207,0,187,161,161,254,216,17,1,0,136,225,113,0,250,184,63,0,223,30,98,254,77,168,162,0,59,53,175,0,19,201,10,255,139,224,194,0,147,193,154,255,212,189,12,254,1,200,174,255,50,133,113,1,94,179,90,0,173,182,135,0,94,177,113,0,43,89,215,255,136,252,106,255,123,134,83,254,5,245,66,255,82,49,39,1,220,2,224,0,97,129,177,0,77,59,89,0,61,29,155,1,203,171,220,255,92,78,139,0,145,33,181,255,169,24,141,1,55,150,179,0,139,60,80,255,218,39,97,0,2,147,107,255,60,248,72,0,173,230,47,1,6,83,182,255,16,105,162,254,137,212,81,255,180,184,134,1,39,222,164,255,221,105,251,1,239,112,125,0,63,7,97,0,63,104,227,255,148,58,12,0,90,60,224,255,84,212,252,0,79,215,168,0,248,221,199,1,115,121,1,0,36,172,120,0,32,162,187,255,57,107,49,255,147,42,21,0,106,198,43,1,57,74,87,0,126,203,81,255,129,135,195,0,140,31,177,0,221,139,194,0,3,222,215,0,131,68,231,0,177,86,178,254,124,151,180,0,184,124,38,1,70,163,17,0,249,251,181,1,42,55,227,0,226,161,44,0,23,236,110,0,51,149,142,1,93,5,236,0,218,183,106,254,67,24,77,0,40,245,209,255,222,121,153,0,165,57,30,0,83,125,60,0,70,38,82,1,229,6,188,0,109,222,157,255,55,118,63,255,205,151,186,0,227,33,149,255,254,176,246,1,227,177,227,0,34,106,163,254,176,43,79,0,106,95,78,1,185,241,122,255,185,14,61,0,36,1,202,0,13,178,162,255,247,11,132,0,161,230,92,1,65,1,185,255,212,50,165,1,141,146,64,255,158,242,218,0,21,164,125,0,213,139,122,1,67,71,87,0,203,158,178,1,151,92,43,0,152,111,5,255,39,3,239,255,217,255,250,255,176,63,71,255,74,245,77,1,250,174,18,255,34,49,227,255,246,46,251,255,154,35,48,1,125,157,61,255,106,36,78,255,97,236,153,0,136,187,120,255,113,134,171,255,19,213,217,254,216,94,209,255,252,5,61,0,94,3,202,0,3,26,183,255,64,191,43,255,30,23,21,0,129,141,77,255,102,120,7,1,194,76,140,0,188,175,52,255,17,81,148,0,232,86,55,1,225,48,172,0,134,42,42,255,238,50,47,0,169,18,254,0,20,147,87,255,14,195,239,255,69,247,23,0,238,229,128,255,177,49,112,0,168,98,251,255,121,71,248,0,243,8,145,254,246,227,153,255,219,169,177,254,251,139,165,255,12,163,185,255,164,40,171,255,153,159,27,254,243,109,91,255,222,24,112,1,18,214,231,0,107,157,181,254,195,147,0,255,194,99,104,255,89,140,190,255,177,66,126,254,106,185,66,0,49,218,31,0,252,174,158,0,188,79,230,1,238,41,224,0,212,234,8,1,136,11,181,0,166,117,83,255,68,195,94,0,46,132,201,0,240,152,88,0,164,57,69,254,160,224,42,255,59,215,67,255,119,195,141,255,36,180,121,254,207,47,8,255,174,210,223,0,101,197,68,255,255,82,141,1,250,137,233,0,97,86,133,1,16,80,69,0,132,131,159,0,116,93,100,0,45,141,139,0,152,172,157,255,90,43,91,0,71,153,46,0,39,16,112,255,217,136,97,255,220,198,25,254,177,53,49,0,222,88,134,255,128,15,60,0,207,192,169,255,192,116,209,255,106,78,211,1,200,213,183,255,7,12,122,254,222,203,60,255,33,110,199,254,251,106,117,0,228,225,4,1,120,58,7,255,221,193,84,254,112,133,27,0,189,200,201,255,139,135,150,0,234,55,176,255,61,50,65,0,152,108,169,255,220,85,1,255,112,135,227,0,162,26,186,0,207,96,185,254,244,136,107,0,93,153,50,1,198,97,151,0,110,11,86,255,143,117,174,255,115,212,200,0,5,202,183,0,237,164,10,254,185,239,62,0,236,120,18,254,98,123,99,255,168,201,194,254,46,234,214,0,191,133,49,255,99,169,119,0,190,187,35,1,115,21,45,255,249,131,72,0,112,6,123,255,214,49,181,254,166,233,34,0,92,197,102,254,253,228,205,255,3,59,201,1,42,98,46,0,219,37,35,255,169,195,38,0,94,124,193,1,156,43,223,0,95,72,133,254,120,206,191,0,122,197,239,255,177,187,79,255,254,46,2,1,250,167,190,0,84,129,19,0,203,113,166,255,249,31,189,254,72,157,202,255,208,71,73,255,207,24,72,0,10,16,18,1,210,81,76,255,88,208,192,255,126,243,107,255,238,141,120,255,199,121,234,255,137,12,59,255,36,220,123,255,148,179,60,254,240,12,29,0,66,0,97,1,36,30,38,255,115,1,93,255,96,103,231,255], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([197,158,59,1,192,164,240,0,202,202,57,255,24,174,48,0,89,77,155,1,42,76,215,0,244,151,233,0,23,48,81,0,239,127,52,254,227,130,37,255,248,116,93,1,124,132,118,0,173,254,192,1,6,235,83,255,110,175,231,1,251,28,182,0,129,249,93,254,84,184,128,0,76,181,62,0,175,128,186,0,100,53,136,254,109,29,226,0,221,233,58,1,20,99,74,0,0,22,160,0,134,13,21,0,9,52,55,255,17,89,140,0,175,34,59,0,84,165,119,255,224,226,234,255,7,72,166,255,123,115,255,1,18,214,246,0,250,7,71,1,217,220,185,0,212,35,76,255,38,125,175,0,189,97,210,0,114,238,44,255,41,188,169,254,45,186,154,0,81,92,22,0,132,160,193,0,121,208,98,255,13,81,44,255,203,156,82,0,71,58,21,255,208,114,191,254,50,38,147,0,154,216,195,0,101,25,18,0,60,250,215,255,233,132,235,255,103,175,142,1,16,14,92,0,141,31,110,254,238,241,45,255,153,217,239,1,97,168,47,255,249,85,16,1,28,175,62,255,57,254,54,0,222,231,126,0,166,45,117,254,18,189,96,255,228,76,50,0,200,244,94,0,198,152,120,1,68,34,69,255,12,65,160,254,101,19,90,0,167,197,120,255,68,54,185,255,41,218,188,0,113,168,48,0,88,105,189,1,26,82,32,255,185,93,164,1,228,240,237,255,66,182,53,0,171,197,92,255,107,9,233,1,199,120,144,255,78,49,10,255,109,170,105,255,90,4,31,255,28,244,113,255,74,58,11,0,62,220,246,255,121,154,200,254,144,210,178,255,126,57,129,1,43,250,14,255,101,111,28,1,47,86,241,255,61,70,150,255,53,73,5,255,30,26,158,0,209,26,86,0,138,237,74,0,164,95,188,0,142,60,29,254,162,116,248,255,187,175,160,0,151,18,16,0,209,111,65,254,203,134,39,255,88,108,49,255,131,26,71,255,221,27,215,254,104,105,93,255,31,236,31,254,135,0,211,255,143,127,110,1,212,73,229,0,233,67,167,254,195,1,208,255,132,17,221,255,51,217,90,0,67,235,50,255,223,210,143,0,179,53,130,1,233,106,198,0,217,173,220,255,112,229,24,255,175,154,93,254,71,203,246,255,48,66,133,255,3,136,230,255,23,221,113,254,235,111,213,0,170,120,95,254,251,221,2,0,45,130,158,254,105,94,217,255,242,52,180,254,213,68,45,255,104,38,28,0,244,158,76,0,161,200,96,255,207,53,13,255,187,67,148,0,170,54,248,0,119,162,178,255,83,20,11,0,42,42,192,1,146,159,163,255,183,232,111,0,77,229,21,255,71,53,143,0,27,76,34,0,246,136,47,255,219,39,182,255,92,224,201,1,19,142,14,255,69,182,241,255,163,118,245,0,9,109,106,1,170,181,247,255,78,47,238,255,84,210,176,255,213,107,139,0,39,38,11,0,72,21,150,0,72,130,69,0,205,77,155,254,142,133,21,0,71,111,172,254,226,42,59,255,179,0,215,1,33,128,241,0,234,252,13,1,184,79,8,0,110,30,73,255,246,141,189,0,170,207,218,1,74,154,69,255,138,246,49,255,155,32,100,0,125,74,105,255,90,85,61,255,35,229,177,255,62,125,193,255,153,86,188,1,73,120,212,0,209,123,246,254,135,209,38,255,151,58,44,1,92,69,214,255,14,12,88,255,252,153,166,255,253,207,112,255,60,78,83,255,227,124,110,0,180,96,252,255,53,117,33,254,164,220,82,255,41,1,27,255,38,164,166,255,164,99,169,254,61,144,70,255,192,166,18,0,107,250,66,0,197,65,50,0,1,179,18,255,255,104,1,255,43,153,35,255,80,111,168,0,110,175,168,0,41,105,45,255,219,14,205,255,164,233,140,254,43,1,118,0,233,67,195,0,178,82,159,255,138,87,122,255,212,238,90,255,144,35,124,254,25,140,164,0,251,215,44,254,133,70,107,255,101,227,80,254,92,169,55,0,215,42,49,0,114,180,85,255,33,232,27,1,172,213,25,0,62,176,123,254,32,133,24,255,225,191,62,0,93,70,153,0,181,42,104,1,22,191,224,255,200,200,140,255,249,234,37,0,149,57,141,0,195,56,208,255,254,130,70,255,32,173,240,255,29,220,199,0,110,100,115,255,132,229,249,0,228,233,223,255,37,216,209,254,178,177,209,255,183,45,165,254,224,97,114,0,137,97,168,255,225,222,172,0,165,13,49,1,210,235,204,255,252,4,28,254,70,160,151,0,232,190,52,254,83,248,93,255,62,215,77,1,175,175,179,255,160,50,66,0,121,48,208,0,63,169,209,255,0,210,200,0,224,187,44,1,73,162,82,0,9,176,143,255,19,76,193,255,29,59,167,1,24,43,154,0,28,190,190,0,141,188,129,0,232,235,203,255,234,0,109,255,54,65,159,0,60,88,232,255,121,253,150,254,252,233,131,255,198,110,41,1,83,77,71,255,200,22,59,254,106,253,242,255,21,12,207,255,237,66,189,0,90,198,202,1,225,172,127,0,53,22,202,0,56,230,132,0,1,86,183,0,109,190,42,0,243,68,174,1,109,228,154,0,200,177,122,1,35,160,183,255,177,48,85,255,90,218,169,255,248,152,78,0,202,254,110,0,6,52,43,0,142,98,65,255,63,145,22,0,70,106,93,0,232,138,107,1,110,179,61,255,211,129,218,1,242,209,92,0,35,90,217,1,182,143,106,255,116,101,217,255,114,250,221,255,173,204,6,0,60,150,163,0,73,172,44,255,239,110,80,255,237,76,153,254,161,140,249,0,149,232,229,0,133,31,40,255,174,164,119,0,113,51,214,0,129,228,2,254,64,34,243,0,107,227,244,255,174,106,200,255,84,153,70,1,50,35,16,0,250,74,216,254,236,189,66,255,153,249,13,0,230,178,4,255,221,41,238,0,118,227,121,255,94,87,140,254,254,119,92,0,73,239,246,254,117,87,128,0,19,211,145,255,177,46,252,0,229,91,246,1,69,128,247,255,202,77,54,1,8,11,9,255,153,96,166,0,217,214,173,255,134,192,2,1,0,207,0,0,189,174,107,1,140,134,100,0,158,193,243,1,182,102,171,0,235,154,51,0,142,5,123,255,60,168,89,1,217,14,92,255,19,214,5,1,211,167,254,0,44,6,202,254,120,18,236,255,15,113,184,255,184,223,139,0,40,177,119,254,182,123,90,255,176,165,176,0,247,77,194,0,27,234,120,0,231,0,214,255,59,39,30,0,125,99,145,255,150,68,68,1,141,222,248,0,153,123,210,255,110,127,152,255,229,33,214,1,135,221,197,0,137,97,2,0,12,143,204,255,81,41,188,0,115,79,130,255,94,3,132,0,152,175,187,255,124,141,10,255,126,192,179,255,11,103,198,0,149,6,45,0,219,85,187,1,230,18,178,255,72,182,152,0,3,198,184,255,128,112,224,1,97,161,230,0,254,99,38,255,58,159,197,0,151,66,219,0,59,69,143,255,185,112,249,0,119,136,47,255,123,130,132,0,168,71,95,255,113,176,40,1,232,185,173,0,207,93,117,1,68,157,108,255,102,5,147,254,49,97,33,0,89,65,111,254,247,30,163,255,124,217,221,1,102,250,216,0,198,174,75,254,57,55,18,0,227,5,236,1,229,213,173,0,201,109,218,1,49,233,239,0,30,55,158,1,25,178,106,0,155,111,188,1,94,126,140,0,215,31,238,1,77,240,16,0,213,242,25,1,38,71,168,0,205,186,93,254,49,211,140,255,219,0,180,255,134,118,165,0,160,147,134,255,110,186,35,255,198,243,42,0,243,146,119,0,134,235,163,1,4,241,135,255,193,46,193,254,103,180,79,255,225,4,184,254,242,118,130,0,146,135,176,1,234,111,30,0,69,66,213,254,41,96,123,0,121,94,42,255,178,191,195,255,46,130,42,0,117,84,8,255,233,49,214,254,238,122,109,0,6,71,89,1,236,211,123,0,244,13,48,254,119,148,14,0,114,28,86,255,75,237,25,255,145,229,16,254,129,100,53,255,134,150,120,254,168,157,50,0,23,72,104,255,224,49,14,0,255,123,22,255,151,185,151,255,170,80,184,1,134,182,20,0,41,100,101,1,153,33,16,0,76,154,111,1,86,206,234,255,192,160,164,254,165,123,93,255,1,216,164,254,67,17,175,255,169,11,59,255,158,41,61,255,73,188,14,255,195,6,137,255,22,147,29,255,20,103,3,255,246,130,227,255,122,40,128,0,226,47,24,254,35,36,32,0,152,186,183,255,69,202,20,0,195,133,195,0,222,51,247,0,169,171,94,1,183,0,160,255,64,205,18,1,156,83,15,255,197,58,249,254,251,89,110,255,50,10,88,254,51,43,216,0,98,242,198,1,245,151,113,0,171,236,194,1,197,31,199,255,229,81,38,1,41,59,20,0,253,104,230,0,152,93,14,255,246,242,146,254,214,169,240,255,240,102,108,254,160,167,236,0,154,218,188,0,150,233,202,255,27,19,250,1,2,71,133,255,175,12,63,1,145,183,198,0,104,120,115,255,130,251,247,0,17,212,167,255,62,123,132,255,247,100,189,0,155,223,152,0,143,197,33,0,155,59,44,255,150,93,240,1,127,3,87,255,95,71,207,1,167,85,1,255,188,152,116,255,10,23,23,0,137,195,93,1,54,98,97,0,240,0,168,255,148,188,127,0,134,107,151,0,76,253,171,0,90,132,192,0,146,22,54,0,224,66,54,254,230,186,229,255,39,182,196,0,148,251,130,255,65,131,108,254,128,1,160,0,169,49,167,254,199,254,148,255,251,6,131,0,187,254,129,255,85,82,62,0,178,23,58,255,254,132,5,0,164,213,39,0,134,252,146,254,37,53,81,255,155,134,82,0,205,167,238,255,94,45,180,255,132,40,161,0,254,111,112,1,54,75,217,0,179,230,221,1,235,94,191,255,23,243,48,1,202,145,203,255,39,118,42,255,117,141,253,0,254,0,222,0,43,251,50,0,54,169,234,1,80,68,208,0,148,203,243,254,145,7,135,0,6,254,0,0,252,185,127,0,98,8,129,255,38,35,72,255,211,36,220,1,40,26,89,0,168,64,197,254,3,222,239,255,2,83,215,254,180,159,105,0,58,115,194,0,186,116,106,255,229,247,219,255,129,118,193,0,202,174,183,1,166,161,72,0,201,107,147,254,237,136,74,0,233,230,106,1,105,111,168,0,64,224,30,1,1,229,3,0,102,151,175,255,194,238,228,255,254,250,212,0,187,237,121,0,67,251,96,1,197,30,11,0,183,95,204,0,205,89,138,0,64,221,37,1,255,223,30,255,178,48,211,255,241,200,90,255,167,209,96,255,57,130,221,0,46,114,200,255,61,184,66,0,55,182,24,254,110,182,33,0,171,190,232,255,114,94,31,0,18,221,8,0,47,231,254,0,255,112,83,0,118,15,215,255,173,25,40,254,192,193,31,255,238,21,146,255,171,193,118,255,101,234,53,254,131,212,112,0,89,192,107,1,8,208,27,0,181,217,15,255,231,149,232,0,140,236,126,0,144,9,199,255,12,79,181,254,147,182,202,255,19,109,182,255,49,212,225,0,74,163,203,0,175,233,148,0,26,112,51,0,193,193,9,255,15,135,249,0,150,227,130,0,204,0,219,1,24,242,205,0,238,208,117,255,22,244,112,0,26,229,34,0,37,80,188,255,38,45,206,254,240,90,225,255,29,3,47,255,42,224,76,0,186,243,167,0,32,132,15,255,5,51,125,0,139,135,24,0,6,241,219,0,172,229,133,255,246,214,50,0,231,11,207,255,191,126,83,1,180,163,170,255,245,56,24,1,178,164,211,255,3,16,202,1,98,57,118,255,141,131,89,254,33,51,24,0,243,149,91,255,253,52,14,0,35,169,67,254,49,30,88,255,179,27,36,255,165,140,183,0,58,189,151,0,88,31,0,0,75,169,66,0,66,101,199,255,24,216,199,1,121,196,26,255,14,79,203,254,240,226,81,255,94,28,10,255,83,193,240,255,204,193,131,255,94,15,86,0,218,40,157,0,51,193,209,0,0,242,177,0,102,185,247,0,158,109,116,0,38,135,91,0,223,175,149,0,220,66,1,255,86,60,232,0,25,96,37,255,225,122,162,1,215,187,168,255,158,157,46,0,56,171,162,0,232,240,101,1,122,22,9,0,51,9,21,255,53,25,238,255,217,30,232,254,125,169,148,0,13,232,102,0,148,9,37,0,165,97,141,1,228,131,41,0,222,15,243,255,254,18,17,0,6,60,237,1,106,3,113,0,59,132,189,0,92,112,30,0,105,208,213,0,48,84,179,255,187,121,231,254,27,216,109,255,162,221,107,254,73,239,195,255,250,31,57,255,149,135,89,255,185,23,115,1,3,163,157,255,18,112,250,0,25,57,187,255,161,96,164,0,47,16,243,0,12,141,251,254,67,234,184,255,41,18,161,0,175,6,96,255,160,172,52,254,24,176,183,255,198,193,85,1,124,121,137,255,151,50,114,255,220,203,60,255,207,239,5,1,0,38,107,255,55,238,94,254,70,152,94,0,213,220,77,1,120,17,69,255,85,164,190,255,203,234,81,0,38,49,37,254,61,144,124,0,137,78,49,254,168,247,48,0,95,164,252,0,105,169,135,0,253,228,134,0,64,166,75,0,81,73,20,255,207,210,10,0,234,106,150,255,94,34,90,255,254,159,57,254,220,133,99,0,139,147,180,254,24,23,185,0,41,57,30,255,189,97,76,0,65,187,223,255,224,172,37,255,34,62,95,1,231,144,240,0,77,106,126,254,64,152,91,0,29,98,155,0,226,251,53,255,234,211,5,255,144,203,222,255,164,176,221,254,5,231,24,0,179,122,205,0,36,1,134,255,125,70,151,254,97,228,252,0,172,129,23,254,48,90,209,255,150,224,82,1,84,134,30,0,241,196,46,0,103,113,234,255,46,101,121,254,40,124,250,255,135,45,242,254,9,249,168,255,140,108,131,255,143,163,171,0,50,173,199,255,88,222,142,255,200,95,158,0,142,192,163,255,7,117,135,0,111,124,22,0,236,12,65,254,68,38,65,255,227,174,254,0,244,245,38,0,240,50,208,255,161,63,250,0,60,209,239,0,122,35,19,0,14,33,230,254,2,159,113,0,106,20,127,255,228,205,96,0,137,210,174,254,180,212,144,255,89,98,154,1,34,88,139,0,167,162,112,1,65,110,197,0,241,37,169,0,66,56,131,255,10,201,83,254,133,253,187,255,177,112,45,254,196,251,0,0,196,250,151,255,238,232,214,255,150,209,205,0,28,240,118,0,71,76,83,1,236,99,91,0,42,250,131,1,96,18,64,255,118,222,35,0,113,214,203,255,122,119,184,255,66,19,36,0,204,64,249,0,146,89,139,0,134,62,135,1,104,233,101,0,188,84,26,0,49,249,129,0,208,214,75,255,207,130,77,255,115,175,235,0,171,2,137,255,175,145,186,1,55,245,135,255,154,86,181,1,100,58,246,255,109,199,60,255,82,204,134,255,215,49,230,1,140,229,192,255,222,193,251,255,81,136,15,255,179,149,162,255,23,39,29,255,7,95,75,254,191,81,222,0,241,81,90,255,107,49,201,255,244,211,157,0,222,140,149,255,65,219,56,254,189,246,90,255,178,59,157,1,48,219,52,0,98,34,215,0,28,17,187,255,175,169,24,0,92,79,161,255,236,200,194,1,147,143,234,0,229,225,7,1,197,168,14,0,235,51,53,1,253,120,174,0,197,6,168,255,202,117,171,0,163,21,206,0,114,85,90,255,15,41,10,255,194,19,99,0,65,55,216,254,162,146,116,0,50,206,212,255,64,146,29,255,158,158,131,1,100,165,130,255,172,23,129,255,125,53,9,255,15,193,18,1,26,49,11,255,181,174,201,1,135,201,14,255,100,19,149,0,219,98,79,0,42,99,143,254,96,0,48,255,197,249,83,254,104,149,79,255,235,110,136,254,82,128,44,255,65,41,36,254,88,211,10,0,187,121,187,0,98,134,199,0,171,188,179,254,210,11,238,255,66,123,130,254,52,234,61,0,48,113,23,254,6,86,120,255,119,178,245,0,87,129,201,0,242,141,209,0,202,114,85,0,148,22,161,0,103,195,48,0,25,49,171,255,138,67,130,0,182,73,122,254,148,24,130,0,211,229,154,0,32,155,158,0,84,105,61,0,177,194,9,255,166,89,86,1,54,83,187,0,249,40,117,255,109,3,215,255,53,146,44,1,63,47,179,0,194,216,3,254,14,84,136,0,136,177,13,255,72,243,186,255,117,17,125,255,211,58,211,255,93,79,223,0,90,88,245,255,139,209,111,255,70,222,47,0,10,246,79,255,198,217,178,0,227,225,11,1,78,126,179,255,62,43,126,0,103,148,35,0,129,8,165,254,245,240,148,0,61,51,142,0,81,208,134,0,15,137,115,255,211,119,236,255,159,245,248,255,2,134,136,255,230,139,58,1,160,164,254,0,114,85,141,255,49,166,182,255,144,70,84,1,85,182,7,0,46,53,93,0,9,166,161,255,55,162,178,255,45,184,188,0,146,28,44,254,169,90,49,0,120,178,241,1,14,123,127,255,7,241,199,1,189,66,50,255,198,143,101,254,189,243,135,255,141,24,24,254,75,97,87,0,118,251,154,1,237,54,156,0,171,146,207,255,131,196,246,255,136,64,113,1,151,232,57,0,240,218,115,0,49,61,27,255,64,129,73,1,252,169,27,255,40,132,10,1,90,201,193,255,252,121,240,1,186,206,41,0,43,198,97,0,145,100,183,0,204,216,80,254,172,150,65,0,249,229,196,254,104,123,73,255,77,104,96,254,130,180,8,0,104,123,57,0,220,202,229,255,102,249,211,0,86,14,232,255,182,78,209,0,239,225,164,0,106,13,32,255,120,73,17,255,134,67,233,0,83,254,181,0,183,236,112,1,48,64,131,255,241,216,243,255,65,193,226,0,206,241,100,254,100,134,166,255,237,202,197,0,55,13,81,0,32,124,102,255,40,228,177,0,118,181,31,1,231,160,134,255,119,187,202,0,0,142,60,255,128,38,189,255,166,201,150,0,207,120,26,1,54,184,172,0,12,242,204,254,133,66,230,0,34,38,31,1,184,112,80,0,32,51,165,254,191,243,55,0,58,73,146,254,155,167,205,255,100,104,152,255,197,254,207,255,173,19,247,0,238,10,202,0,239,151,242,0,94,59,39,255,240,29,102,255,10,92,154,255,229,84,219,255,161,129,80,0,208,90,204,1,240,219,174,255,158,102,145,1,53,178,76,255,52,108,168,1,83,222,107,0,211,36,109,0,118,58,56,0,8,29,22,0,237,160,199,0,170,209,157,0,137,71,47,0,143,86,32,0,198,242,2,0,212,48,136,1,92,172,186,0,230,151,105,1,96,191,229,0,138,80,191,254,240,216,130,255,98,43,6,254,168,196,49,0,253,18,91,1,144,73,121,0,61,146,39,1,63,104,24,255,184,165,112,254,126,235,98,0,80,213,98,255,123,60,87,255,82,140,245,1,223,120,173,255,15,198,134,1,206,60,239,0,231,234,92,255,33,238,19,255,165,113,142,1,176,119,38,0,160,43,166,254,239,91,105,0,107,61,194,1,25,4,68,0,15,139,51,0,164,132,106,255,34,116,46,254,168,95,197,0,137,212,23,0,72,156,58,0,137,112,69,254,150,105,154,255,236,201,157,0,23,212,154,255,136,82,227,254,226,59,221,255,95,149,192,0,81,118,52,255,33,43,215,1,14,147,75,255,89,156,121,254,14,18,79,0,147,208,139,1,151,218,62,255,156,88,8,1,210,184,98,255,20,175,123,255,102,83,229,0,220,65,116,1,150,250,4,255,92,142,220,255,34,247,66,255,204,225,179,254,151,81,151,0,71,40,236,255,138,63,62,0,6,79,240,255,183,185,181,0,118,50,27,0,63,227,192,0,123,99,58,1,50,224,155,255,17,225,223,254,220,224,77,255,14,44,123,1,141,128,175,0,248,212,200,0,150,59,183,255,147,97,29,0,150,204,181,0,253,37,71,0,145,85,119,0,154,200,186,0,2,128,249,255,83,24,124,0,14,87,143,0,168,51,245,1,124,151,231,255,208,240,197,1,124,190,185,0,48,58,246,0,20,233,232,0,125,18,98,255,13,254,31,255,245,177,130,255,108,142,35,0,171,125,242,254,140,12,34,255,165,161,162,0,206,205,101,0,247,25,34,1,100,145,57,0,39,70,57,0,118,204,203,255,242,0,162,0,165,244,30,0,198,116,226,0,128,111,153,255,140,54,182,1,60,122,15,255,155,58,57,1,54,50,198,0,171,211,29,255,107,138,167,255,173,107,199,255,109,161,193,0,89,72,242,255,206,115,89,255,250,254,142,254,177,202,94,255,81,89,50,0,7,105,66,255,25,254,255,254,203,64,23,255,79,222,108,255,39,249,75,0,241,124,50,0,239,152,133,0,221,241,105,0,147,151,98,0,213,161,121,254,242,49,137,0,233,37,249,254,42,183,27,0,184,119,230,255,217,32,163,255,208,251,228,1,137,62,131,255,79,64,9,254,94,48,113,0,17,138,50,254,193,255,22,0,247,18,197,1,67,55,104,0,16,205,95,255,48,37,66,0,55,156,63,1,64,82,74,255,200,53,71,254,239,67,125,0,26,224,222,0,223,137,93,255,30,224,202,255,9,220,132,0,198,38,235,1,102,141,86,0,60,43,81,1,136,28,26,0,233,36,8,254,207,242,148,0,164,162,63,0,51,46,224,255,114,48,79,255,9,175,226,0,222,3,193,255,47,160,232,255,255,93,105,254,14,42,230,0,26,138,82,1,208,43,244,0,27,39,38,255,98,208,127,255,64,149,182,255,5,250,209,0,187,60,28,254,49,25,218,255,169,116,205,255,119,18,120,0,156,116,147,255,132,53,109,255,13,10,202,0,110,83,167,0,157,219,137,255,6,3,130,255,50,167,30,255,60,159,47,255,129,128,157,254,94,3,189,0,3,166,68,0,83,223,215,0,150,90,194,1,15,168,65,0,227,83,51,255,205,171,66,255,54,187,60,1,152,102,45,255,119,154,225,0,240,247,136,0,100,197,178,255,139,71,223,255,204,82,16,1,41,206,42,255,156,192,221,255,216,123,244,255,218,218,185,255,187,186,239,255,252,172,160,255,195,52,22,0,144,174,181,254,187,100,115,255,211,78,176,255,27,7,193,0,147,213,104,255,90,201,10,255,80,123,66,1,22,33,186,0,1,7,99,254,30,206,10,0,229,234,5,0,53,30,210,0,138,8,220,254,71,55,167,0,72,225,86,1,118,190,188,0,254,193,101,1,171,249,172,255,94,158,183,254,93,2,108,255,176,93,76,255,73,99,79,255,74,64,129,254,246,46,65,0,99,241,127,254,246,151,102,255,44,53,208,254,59,102,234,0,154,175,164,255,88,242,32,0,111,38,1,0,255,182,190,255,115,176,15,254,169,60,129,0,122,237,241,0,90,76,63,0,62,74,120,255,122,195,110,0,119,4,178,0,222,242,210,0,130,33,46,254,156,40,41,0,167,146,112,1,49,163,111,255,121,176,235,0,76,207,14,255,3,25,198,1,41,235,213,0,85,36,214,1,49,92,109,255,200,24,30,254,168,236,195,0,145,39,124,1,236,195,149,0,90,36,184,255,67,85,170,255,38,35,26,254,131,124,68,255,239,155,35,255,54,201,164,0,196,22,117,255,49,15,205,0,24,224,29,1,126,113,144,0,117,21,182,0,203,159,141,0,223,135,77,0,176,230,176,255,190,229,215,255,99,37,181,255,51,21,138,255,25,189,89,255,49,48,165,254,152,45,247,0,170,108,222,0,80,202,5,0,27,69,103,254,204,22,129,255,180,252,62,254,210,1,91,255,146,110,254,255,219,162,28,0,223,252,213,1,59,8,33,0,206,16,244,0,129,211,48,0,107,160,208,0,112,59,209,0,109,77,216,254,34,21,185,255,246,99,56,255,179,139,19,255,185,29,50,255,84,89,19,0,74,250,98,255,225,42,200,255,192,217,205,255,210,16,167,0,99,132,95,1,43,230,57,0,254,11,203,255,99,188,63,255,119,193,251,254,80,105,54,0,232,181,189,1,183,69,112,255,208,171,165,255,47,109,180,255,123,83,165,0,146,162,52,255,154,11,4,255,151,227,90,255,146,137,97,254,61,233,41,255,94,42,55,255,108,164,236,0,152,68,254,0,10,140,131,255,10,106,79,254,243,158,137,0,67,178,66,254,177,123,198,255,15,62,34,0,197,88,42,255,149,95,177,255,152,0,198,255,149,254,113,255,225,90,163,255,125,217,247,0,18,17,224,0,128,66,120,254,192,25,9,255,50,221,205,0,49,212,70,0,233,255,164,0,2,209,9,0,221,52,219,254,172,224,244,255,94,56,206,1,242,179,2,255,31,91,164,1,230,46,138,255,189,230,220,0,57,47,61,255,111,11,157,0,177,91,152,0,28,230,98,0,97,87,126,0,198,89,145,255,167,79,107,0,249,77,160,1,29,233,230,255,150,21,86,254,60,11,193,0,151,37,36,254,185,150,243,255,228,212,83,1,172,151,180,0,201,169,155,0,244,60,234,0,142,235,4,1,67,218,60,0,192,113,75,1,116,243,207,255,65,172,155,0,81,30,156,255,80,72,33,254,18,231,109,255,142,107,21,254,125,26,132,255,176,16,59,255,150,201,58,0,206,169,201,0,208,121,226,0,40,172,14,255,150,61,94,255,56,57,156,255,141,60,145,255,45,108,149,255,238,145,155,255,209,85,31,254,192,12,210,0,99,98,93,254,152,16,151,0,225,185,220,0,141,235,44,255,160,172,21,254,71,26,31,255,13,64,93,254,28,56,198,0,177,62,248,1,182,8,241,0,166,101,148,255,78,81,133,255,129,222,215,1,188,169,129,255,232,7,97,0,49,112,60,255,217,229,251,0,119,108,138,0,39,19,123,254,131,49,235,0,132,84,145,0,130,230,148,255,25,74,187,0,5,245,54,255,185,219,241,1,18,194,228,255,241,202,102,0,105,113,202,0,155,235,79,0,21,9,178,255,156,1,239,0,200,148,61,0,115,247,210,255,49,221,135,0,58,189,8,1,35,46,9,0,81,65,5,255,52,158,185,255,125,116,46,255,74,140,13,255,210,92,172,254,147,23,71,0,217,224,253,254,115,108,180,255,145,58,48,254,219,177,24,255,156,255,60,1,154,147,242,0,253,134,87,0,53,75,229,0,48,195,222,255,31,175,50,255,156,210,120,255,208,35,222,255,18,248,179,1,2,10,101,255,157,194,248,255,158,204,101,255,104,254,197,255,79,62,4,0,178,172,101,1,96,146,251,255,65,10,156,0,2,137,165,255,116,4,231,0,242,215,1,0,19,35,29,255,43,161,79,0,59,149,246,1,251,66,176,0,200,33,3,255,80,110,142,255,195,161,17,1,228,56,66,255,123,47,145,254,132,4,164,0,67,174,172,0,25,253,114,0,87,97,87,1,250,220,84,0,96,91,200,255,37,125,59,0,19,65,118,0,161,52,241,255,237,172,6,255,176,191,255,255,1,65,130,254,223,190,230,0,101,253,231,255,146,35,109,0,250,29,77,1,49,0,19,0,123,90,155,1,22,86,32,255,218,213,65,0,111,93,127,0,60,93,169,255,8,127,182,0,17,186,14,254,253,137,246,255,213,25,48,254,76,238,0,255,248,92,70,255,99,224,139,0,184,9,255,1,7,164,208,0,205,131,198,1,87,214,199,0,130,214,95,0,221,149,222,0,23,38,171,254,197,110,213,0,43,115,140,254,215,177,118,0,96,52,66,1,117,158,237,0,14,64,182,255,46,63,174,255,158,95,190,255,225,205,177,255,43,5,142,255,172,99,212,255,244,187,147,0,29,51,153,255,228,116,24,254,30,101,207,0,19,246,150,255,134,231,5,0,125,134,226,1,77,65,98,0,236,130,33,255,5,110,62,0,69,108,127,255,7,113,22,0,145,20,83,254,194,161,231,255,131,181,60,0,217,209,177,255,229,148,212,254,3,131,184,0,117,177,187,1,28,14,31,255,176,102,80,0,50,84,151,255,125,31,54,255,21,157,133,255,19,179,139,1,224,232,26,0,34,117,170,255,167,252,171,255,73,141,206,254,129,250,35,0,72,79,236,1,220,229,20,255,41,202,173,255,99,76,238,255,198,22,224,255,108,198,195,255,36,141,96,1,236,158,59,255,106,100,87,0,110,226,2,0,227,234,222,0,154,93,119,255,74,112,164,255,67,91,2,255,21,145,33,255,102,214,137,255,175,230,103,254,163,246,166,0,93,247,116,254,167,224,28,255,220,2,57,1,171,206,84,0,123,228,17,255,27,120,119,0,119,11,147,1,180,47,225,255,104,200,185,254,165,2,114,0,77,78,212,0,45,154,177,255,24,196,121,254,82,157,182,0,90,16,190,1,12,147,197,0,95,239,152,255,11,235,71,0,86,146,119,255,172,134,214,0,60,131,196,0,161,225,129,0,31,130,120,254,95,200,51,0,105,231,210,255,58,9,148,255,43,168,221,255,124,237,142,0,198,211,50,254,46,245,103,0,164,248,84,0,152,70,208,255,180,117,177,0,70,79,185,0,243,74,32,0,149,156,207,0,197,196,161,1,245,53,239,0,15,93,246,254,139,240,49,255,196,88,36,255,162,38,123,0,128,200,157,1,174,76,103,255,173,169,34,254,216,1,171,255,114,51,17,0,136,228,194,0,110,150,56,254,106,246,159,0,19,184,79,255,150,77,240,255,155,80,162,0,0,53,169,255,29,151,86,0,68,94,16,0,92,7,110,254,98,117,149,255,249,77,230,255,253,10,140,0,214,124,92,254,35,118,235,0,89,48,57,1,22,53,166,0,184,144,61,255,179,255,194,0,214,248,61,254,59,110,246,0,121,21,81,254,166,3,228,0,106,64,26,255,69,232,134,255,242,220,53,254,46,220,85,0,113,149,247,255,97,179,103,255,190,127,11,0,135,209,182,0,95,52,129,1,170,144,206,255,122,200,204,255,168,100,146,0,60,144,149,254,70,60,40,0,122,52,177,255,246,211,101,255,174,237,8,0,7,51,120,0,19,31,173,0,126,239,156,255,143,189,203,0,196,128,88,255,233,133,226,255,30,125,173,255,201,108,50,0,123,100,59,255,254,163,3,1,221,148,181,255,214,136,57,254,222,180,137,255,207,88,54,255,28,33,251,255,67,214,52,1,210,208,100,0,81,170,94,0,145,40,53,0,224,111,231,254,35,28,244,255,226,199,195,254,238,17,230,0,217,217,164,254,169,157,221,0,218,46,162,1,199,207,163,255,108,115,162,1,14,96,187,255,118,60,76,0,184,159,152,0,209,231,71,254,42,164,186,255,186,153,51,254,221,171,182,255,162,142,173,0,235,47,193,0,7,139,16,1,95,164,64,255,16,221,166,0,219,197,16,0,132,29,44,255,100,69,117,255,60,235,88,254,40,81,173,0,71,190,61,255,187,88,157,0,231,11,23,0,237,117,164,0,225,168,223,255,154,114,116,255,163,152,242,1,24,32,170,0,125,98,113,254,168,19,76,0,17,157,220,254,155,52,5,0,19,111,161,255,71,90,252,255,173,110,240,0,10,198,121,255,253,255,240,255,66,123,210,0,221,194,215,254,121,163,17,255,225,7,99,0,190,49,182,0,115,9,133,1,232,26,138,255,213,68,132,0,44,119,122,255,179,98,51,0,149,90,106,0,71,50,230,255,10,153,118,255,177,70,25,0,165,87,205,0,55,138,234,0,238,30,97,0,113,155,207,0,98,153,127,0,34,107,219,254,117,114,172,255,76,180,255,254,242,57,179,255,221,34,172,254,56,162,49,255,83,3,255,255,113,221,189,255,188,25,228,254,16,88,89,255,71,28,198,254,22,17,149,255,243,121,254,255,107,202,99,255,9,206,14,1,220,47,153,0,107,137,39,1,97,49,194,255,149,51,197,254,186,58,11,255,107,43,232,1,200,6,14,255,181,133,65,254,221,228,171,255,123,62,231,1,227,234,179,255,34,189,212,254,244,187,249,0,190,13,80,1,130,89,1,0,223,133,173,0,9,222,198,255,66,127,74,0,167,216,93,255,155,168,198,1,66,145,0,0,68,102,46,1,172,90,154,0,216,128,75,255,160,40,51,0,158,17,27,1,124,240,49,0,236,202,176,255,151,124,192,255,38,193,190,0,95,182,61,0,163,147,124,255,255,165,51,255,28,40,17,254,215,96,78,0,86,145,218,254,31,36,202,255,86,9,5,0,111,41,200,255,237,108,97,0,57,62,44,0,117,184,15,1,45,241,116,0,152,1,220,255,157,165,188,0,250,15,131,1,60,44,125,255,65,220,251,255,75,50,184,0,53,90,128,255,231,80,194,255,136,129,127,1,21,18,187,255,45,58,161,255,71,147,34,0,174,249,11,254,35,141,29,0,239,68,177,255,115,110,58,0,238,190,177,1,87,245,166,255,190,49,247,255,146,83,184,255,173,14,39,255,146,215,104,0,142,223,120,0,149,200,155,255,212,207,145,1,16,181,217,0,173,32,87,255,255,35,181,0,119,223,161,1,200,223,94,255,70,6,186,255,192,67,85,255,50,169,152,0,144,26,123,255,56,243,179,254,20,68,136,0,39,140,188,254,253,208,5,255,200,115,135,1,43,172,229,255,156,104,187,0,151,251,167,0,52,135,23,0,151,153,72,0,147,197,107,254,148,158,5,255,238,143,206,0,126,153,137,255,88,152,197,254,7,68,167,0,252,159,165,255,239,78,54,255,24,63,55,255,38,222,94,0,237,183,12,255,206,204,210,0,19,39,246,254,30,74,231,0,135,108,29,1,179,115,0,0,117,118,116,1,132,6,252,255,145,129,161,1,105,67,141,0,82,37,226,255,238,226,228,255,204,214,129,254,162,123,100,255,185,121,234,0,45,108,231,0,66,8,56,255,132,136,128,0,172,224,66,254,175,157,188,0,230,223,226,254,242,219,69,0,184,14,119,1,82,162,56,0,114,123,20,0,162,103,85,255,49,239,99,254,156,135,215,0,111,255,167,254,39,196,214,0,144,38,79,1,249,168,125,0,155,97,156,255,23,52,219,255,150,22,144,0,44,149,165,255,40,127,183,0,196,77,233,255,118,129,210,255,170,135,230,255,214,119,198,0,233,240,35,0,253,52,7,255,117,102,48,255,21,204,154,255,179,136,177,255,23,2,3,1,149,130,89,255,252,17,159,1,70,60,26,0,144,107,17,0,180,190,60,255,56,182,59,255,110,71,54,255,198,18,129,255,149,224,87,255,223,21,152,255,138,22,182,255,250,156,205,0,236,45,208,255,79,148,242,1,101,70,209,0,103,78,174,0,101,144,172,255,152,136,237,1,191,194,136,0,113,80,125,1,152,4,141,0,155,150,53,255,196,116,245,0,239,114,73,254,19,82,17,255,124,125,234,255,40,52,191,0,42,210,158,255,155,132,165,0,178,5,42,1,64,92,40,255,36,85,77,255,178,228,118,0,137,66,96,254,115,226,66,0,110,240,69,254,151,111,80,0,167,174,236,255,227,108,107,255,188,242,65,255,183,81,255,0,57,206,181,255,47,34,181,255,213,240,158,1,71,75,95,0,156,40,24,255,102,210,81,0,171,199,228,255,154,34,41,0,227,175,75,0,21,239,195,0,138,229,95,1,76,192,49,0,117,123,87,1,227,225,130,0,125,62,63,255,2,198,171,0,254,36,13,254,145,186,206,0,148,255,244,255,35,0,166,0,30,150,219,1,92,228,212,0,92,198,60,254,62,133,200,255,201,41,59,0,125,238,109,255,180,163,238,1,140,122,82,0,9,22,88,255,197,157,47,255,153,94,57,0,88,30,182,0,84,161,85,0,178,146,124,0,166,166,7,255,21,208,223,0,156,182,242,0,155,121,185,0,83,156,174,254,154,16,118,255,186,83,232,1,223,58,121,255,29,23,88,0,35,125,127,255,170,5,149,254,164,12,130,255,155,196,29,0,161,96,136,0,7,35,29,1,162,37,251,0,3,46,242,255,0,217,188,0,57,174,226,1,206,233,2,0,57,187,136,254,123,189,9,255,201,117,127,255,186,36,204,0,231,25,216,0,80,78,105,0,19,134,129,255,148,203,68,0,141,81,125,254,248,165,200,255,214,144,135,0,151,55,166,255,38,235,91,0,21,46,154,0,223,254,150,255,35,153,180,255,125,176,29,1,43,98,30,255,216,122,230,255,233,160,12,0,57,185,12,254,240,113,7,255,5,9,16,254,26,91,108,0,109,198,203,0,8,147,40,0,129,134,228,255,124,186,40,255,114,98,132,254,166,132,23,0,99,69,44,0,9,242,238,255,184,53,59,0,132,129,102,255,52,32,243,254,147,223,200,255,123,83,179,254,135,144,201,255,141,37,56,1,151,60,227,255,90,73,156,1,203,172,187,0,80,151,47,255,94,137,231,255,36,191,59,255,225,209,181,255,74,215,213,254,6,118,179,255,153,54,193,1,50,0,231,0,104,157,72,1,140,227,154,255,182,226,16,254,96,225,92,255,115,20,170,254,6,250,78,0,248,75,173,255,53,89,6,255,0,180,118,0,72,173,1,0,64,8,206,1,174,133,223,0,185,62,133,255,214,11,98,0,197,31,208,0,171,167,244,255,22,231,181,1,150,218,185,0,247,169,97,1,165,139,247,255,47,120,149,1,103,248,51,0,60,69,28,254,25,179,196,0,124,7,218,254,58,107,81,0,184,233,156,255,252,74,36,0,118,188,67,0,141,95,53,255,222,94,165,254,46,61,53,0,206,59,115,255,47,236,250,255,74,5,32,1,129,154,238,255,106,32,226,0,121,187,61,255,3,166,241,254,67,170,172,255,29,216,178,255,23,201,252,0,253,110,243,0,200,125,57,0,109,192,96,255,52,115,238,0,38,121,243,255,201,56,33,0,194,118,130,0,75,96,25,255,170,30,230,254,39,63,253,0,36,45,250,255,251,1,239,0,160,212,92,1,45,209,237,0,243,33,87,254,237,84,201,255,212,18,157,254,212,99,127,255,217,98,16,254,139,172,239,0,168,201,130,255,143,193,169,255,238,151,193,1,215,104,41,0,239,61,165,254,2,3,242,0,22,203,177,254,177,204,22,0,149,129,213,254,31,11,41,255,0,159,121,254,160,25,114,255,162,80,200,0,157,151,11,0,154,134,78,1,216,54,252,0,48,103,133,0,105,220,197,0,253,168,77,254,53,179,23,0,24,121,240,1,255,46,96,255,107,60,135,254,98,205,249,255,63,249,119,255,120,59,211,255,114,180,55,254,91,85,237,0,149,212,77,1,56,73,49,0,86,198,150,0,93,209,160,0,69,205,182,255,244,90,43,0,20,36,176,0,122,116,221,0,51,167,39,1,231,1,63,255,13,197,134,0,3,209,34,255,135,59,202,0,167,100,78,0,47,223,76,0,185,60,62,0,178,166,123,1,132,12,161,255,61,174,43,0,195,69,144,0,127,47,191,1,34,44,78,0,57,234,52,1,255,22,40,255,246,94,146,0,83,228,128,0,60,78,224,255,0,96,210,255,153,175,236,0,159,21,73,0,180,115,196,254,131,225,106,0,255,167,134,0,159,8,112,255,120,68,194,255,176,196,198,255,118,48,168,255,93,169,1,0,112,200,102,1,74,24,254,0,19,141,4,254,142,62,63,0,131,179,187,255,77,156,155,255,119,86,164,0,170,208,146,255,208,133,154,255,148,155,58,255,162,120,232,254,252,213,155,0,241,13,42,0,94,50,131,0,179,170,112,0,140,83,151,255,55,119,84,1,140,35,239,255,153,45,67,1,236,175,39,0,54,151,103,255,158,42,65,255,196,239,135,254,86,53,203,0,149,97,47,254,216,35,17,255,70,3,70,1,103,36,90,255,40,26,173,0,184,48,13,0,163,219,217,255,81,6,1,255,221,170,108,254,233,208,93,0,100,201,249,254,86,36,35,255,209,154,30,1,227,201,251,255,2,189,167,254,100,57,3,0,13,128,41,0,197,100,75,0,150,204,235,255,145,174,59,0,120,248,149,255,85,55,225,0,114,210,53,254,199,204,119,0,14,247,74,1,63,251,129,0,67,104,151,1,135,130,80,0,79,89,55,255,117,230,157,255,25,96,143,0,213,145,5,0,69,241,120,1,149,243,95,255,114,42,20,0,131,72,2,0,154,53,20,255,73,62,109,0,196,102,152,0,41,12,204,255,122,38,11,1,250,10,145,0,207,125,148,0,246,244,222,255,41,32,85,1,112,213,126,0,162,249,86,1,71,198,127,255,81,9,21,1,98,39,4,255,204,71,45,1,75,111,137,0,234,59,231,0,32,48,95,255,204,31,114,1,29,196,181,255,51,241,167,254,93,109,142,0,104,144,45,0,235,12,181,255,52,112,164,0,76,254,202,255,174,14,162,0,61,235,147,255,43,64,185,254,233,125,217,0,243,88,167,254,74,49,8,0,156,204,66,0,124,214,123,0,38,221,118,1,146,112,236,0,114,98,177,0,151,89,199,0,87,197,112,0,185,149,161,0,44,96,165,0,248,179,20,255,188,219,216,254,40,62,13,0,243,142,141,0,229,227,206,255,172,202,35,255,117,176,225,255,82,110,38,1,42,245,14,255,20,83,97,0,49,171,10,0,242,119,120,0,25,232,61,0,212,240,147,255,4,115,56,255,145,17,239,254,202,17,251,255,249,18,245,255,99,117,239,0,184,4,179,255,246,237,51,255,37,239,137,255,166,112,166,255,81,188,33,255,185,250,142,255,54,187,173,0,208,112,201,0,246,43,228,1,104,184,88,255,212,52,196,255,51,117,108,255,254,117,155,0,46,91,15,255,87,14,144,255,87,227,204,0,83,26,83,1,159,76,227,0,159,27,213,1,24,151,108,0,117,144,179,254,137,209,82,0,38,159,10,0,115,133,201,0,223,182,156,1,110,196,93,255,57,60,233,0,5,167,105,255,154,197,164,0,96,34,186,255,147,133,37,1,220,99,190,0,1,167,84,255,20,145,171,0,194,197,251,254,95,78,133,255,252,248,243,255,225,93,131,255,187,134,196,255,216,153,170,0,20,118,158,254,140,1,118,0,86,158,15,1,45,211,41,255,147,1,100,254,113,116,76,255,211,127,108,1,103,15,48,0,193,16,102,1,69,51,95,255,107,128,157,0,137,171,233,0,90,124,144,1,106,161,182,0,175,76,236,1,200,141,172,255,163,58,104,0,233,180,52,255,240,253,14,255,162,113,254,255,38,239,138,254,52,46,166,0,241,101,33,254,131,186,156,0,111,208,62,255,124,94,160,255,31,172,254,0,112,174,56,255,188,99,27,255,67,138,251,0,125,58,128,1,156,152,174,255,178,12,247,255,252,84,158,0,82,197,14,254,172,200,83,255,37,39,46,1,106,207,167,0,24,189,34,0,131,178,144,0,206,213,4,0,161,226,210,0,72,51,105,255,97,45,187,255,78,184,223,255,176,29,251,0,79,160,86,255,116,37,178,0,82,77,213,1,82,84,141,255,226,101,212,1,175,88,199,255,245,94,247,1,172,118,109,255,166,185,190,0,131,181,120,0,87,254,93,255,134,240,73,255,32,245,143,255,139,162,103,255,179,98,18,254,217,204,112,0,147,223,120,255,53,10,243,0,166,140,150,0,125,80,200,255,14,109,219,255,91,218,1,255,252,252,47,254,109,156,116,255,115,49,127,1,204,87,211,255,148,202,217,255,26,85,249,255,14,245,134,1,76,89,169,255,242,45,230,0,59,98,172,255,114,73,132,254,78,155,49,255,158,126,84,0,49,175,43,255,16,182,84,255,157,103,35,0,104,193,109,255,67,221,154,0,201,172,1,254,8,162,88,0,165,1,29,255,125,155,229,255,30,154,220,1,103,239,92,0,220,1,109,255,202,198,1,0,94,2,142,1,36,54,44,0,235,226,158,255,170,251,214,255,185,77,9,0,97,74,242,0,219,163,149,255,240,35,118,255,223,114,88,254,192,199,3,0,106,37,24,255,201,161,118,255,97,89,99,1,224,58,103,255,101,199,147,254,222,60,99,0,234,25,59,1,52,135,27,0,102,3,91,254,168,216,235,0,229,232,136,0,104,60,129,0,46,168,238,0,39,191,67,0,75,163,47,0,143,97,98,255,56,216,168,1,168,233,252,255,35,111,22,255,92,84,43,0,26,200,87,1,91,253,152,0,202,56,70,0,142,8,77,0,80,10,175,1,252,199,76,0,22,110,82,255,129,1,194,0,11,128,61,1,87,14,145,255,253,222,190,1,15,72,174,0,85,163,86,254,58,99,44,255,45,24,188,254,26,205,15,0,19,229,210,254,248,67,195,0,99,71,184,0,154,199,37,255,151,243,121,255,38,51,75,255,201,85,130,254,44,65,250,0,57,147,243,254,146,43,59,255,89,28,53,0,33,84,24,255,179,51,18,254,189,70,83,0,11,156,179,1,98,134,119,0,158,111,111,0,119,154,73,255,200,63,140,254,45,13,13,255,154,192,2,254,81,72,42,0,46,160,185,254,44,112,6,0,146,215,149,1,26,176,104,0,68,28,87,1,236,50,153,255,179,128,250,254,206,193,191,255,166,92,137,254,53,40,239,0,210,1,204,254,168,173,35,0,141,243,45,1,36,50,109,255,15,242,194,255,227,159,122,255,176,175,202,254,70,57,72,0,40,223,56,0,208,162,58,255,183,98,93,0,15,111,12,0,30,8,76,255,132,127,246,255,45,242,103,0,69,181,15,255,10,209,30,0,3,179,121,0,241,232,218,1,123,199,88,255,2,210,202,1,188,130,81,255,94,101,208,1,103,36,45], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10240);
/* memory initializer */ allocate([76,193,24,1,95,26,241,255,165,162,187,0,36,114,140,0,202,66,5,255,37,56,147,0,152,11,243,1,127,85,232,255,250,135,212,1,185,177,113,0,90,220,75,255,69,248,146,0,50,111,50,0,92,22,80,0,244,36,115,254,163,100,82,255,25,193,6,1,127,61,36,0,253,67,30,254,65,236,170,255,161,17,215,254,63,175,140,0,55,127,4,0,79,112,233,0,109,160,40,0,143,83,7,255,65,26,238,255,217,169,140,255,78,94,189,255,0,147,190,255,147,71,186,254,106,77,127,255,233,157,233,1,135,87,237,255,208,13,236,1,155,109,36,255,180,100,218,0,180,163,18,0,190,110,9,1,17,63,123,255,179,136,180,255,165,123,123,255,144,188,81,254,71,240,108,255,25,112,11,255,227,218,51,255,167,50,234,255,114,79,108,255,31,19,115,255,183,240,99,0,227,87,143,255,72,217,248,255,102,169,95,1,129,149,149,0,238,133,12,1,227,204,35,0,208,115,26,1,102,8,234,0,112,88,143,1,144,249,14,0,240,158,172,254,100,112,119,0,194,141,153,254,40,56,83,255,121,176,46,0,42,53,76,255,158,191,154,0,91,209,92,0,173,13,16,1,5,72,226,255,204,254,149,0,80,184,207,0,100,9,122,254,118,101,171,255,252,203,0,254,160,207,54,0,56,72,249,1,56,140,13,255,10,64,107,254,91,101,52,255,225,181,248,1,139,255,132,0,230,145,17,0,233,56,23,0,119,1,241,255,213,169,151,255,99,99,9,254,185,15,191,255,173,103,109,1,174,13,251,255,178,88,7,254,27,59,68,255,10,33,2,255,248,97,59,0,26,30,146,1,176,147,10,0,95,121,207,1,188,88,24,0,185,94,254,254,115,55,201,0,24,50,70,0,120,53,6,0,142,66,146,0,228,226,249,255,104,192,222,1,173,68,219,0,162,184,36,255,143,102,137,255,157,11,23,0,125,45,98,0,235,93,225,254,56,112,160,255,70,116,243,1,153,249,55,255,129,39,17,1,241,80,244,0,87,69,21,1,94,228,73,255,78,66,65,255,194,227,231,0,61,146,87,255,173,155,23,255,112,116,219,254,216,38,11,255,131,186,133,0,94,212,187,0,100,47,91,0,204,254,175,255,222,18,215,254,173,68,108,255,227,228,79,255,38,221,213,0,163,227,150,254,31,190,18,0,160,179,11,1,10,90,94,255,220,174,88,0,163,211,229,255,199,136,52,0,130,95,221,255,140,188,231,254,139,113,128,255,117,171,236,254,49,220,20,255,59,20,171,255,228,109,188,0,20,225,32,254,195,16,174,0,227,254,136,1,135,39,105,0,150,77,206,255,210,238,226,0,55,212,132,254,239,57,124,0,170,194,93,255,249,16,247,255,24,151,62,255,10,151,10,0,79,139,178,255,120,242,202,0,26,219,213,0,62,125,35,255,144,2,108,255,230,33,83,255,81,45,216,1,224,62,17,0,214,217,125,0,98,153,153,255,179,176,106,254,131,93,138,255,109,62,36,255,178,121,32,255,120,252,70,0,220,248,37,0,204,88,103,1,128,220,251,255,236,227,7,1,106,49,198,255,60,56,107,0,99,114,238,0,220,204,94,1,73,187,1,0,89,154,34,0,78,217,165,255,14,195,249,255,9,230,253,255,205,135,245,0,26,252,7,255,84,205,27,1,134,2,112,0,37,158,32,0,231,91,237,255,191,170,204,255,152,7,222,0,109,192,49,0,193,166,146,255,232,19,181,255,105,142,52,255,103,16,27,1,253,200,165,0,195,217,4,255,52,189,144,255,123,155,160,254,87,130,54,255,78,120,61,255,14,56,41,0,25,41,125,255,87,168,245,0,214,165,70,0,212,169,6,255,219,211,194,254,72,93,164,255,197,33,103,255,43,142,141,0,131,225,172,0,244,105,28,0,68,68,225,0,136,84,13,255,130,57,40,254,139,77,56,0,84,150,53,0,54,95,157,0,144,13,177,254,95,115,186,0,117,23,118,255,244,166,241,255,11,186,135,0,178,106,203,255,97,218,93,0,43,253,45,0,164,152,4,0,139,118,239,0,96,1,24,254,235,153,211,255,168,110,20,255,50,239,176,0,114,41,232,0,193,250,53,0,254,160,111,254,136,122,41,255,97,108,67,0,215,152,23,255,140,209,212,0,42,189,163,0,202,42,50,255,106,106,189,255,190,68,217,255,233,58,117,0,229,220,243,1,197,3,4,0,37,120,54,254,4,156,134,255,36,61,171,254,165,136,100,255,212,232,14,0,90,174,10,0,216,198,65,255,12,3,64,0,116,113,115,255,248,103,8,0,231,125,18,255,160,28,197,0,30,184,35,1,223,73,249,255,123,20,46,254,135,56,37,255,173,13,229,1,119,161,34,255,245,61,73,0,205,125,112,0,137,104,134,0,217,246,30,255,237,142,143,0,65,159,102,255,108,164,190,0,219,117,173,255,34,37,120,254,200,69,80,0,31,124,218,254,74,27,160,255,186,154,199,255,71,199,252,0,104,81,159,1,17,200,39,0,211,61,192,1,26,238,91,0,148,217,12,0,59,91,213,255,11,81,183,255,129,230,122,255,114,203,145,1,119,180,66,255,72,138,180,0,224,149,106,0,119,82,104,255,208,140,43,0,98,9,182,255,205,101,134,255,18,101,38,0,95,197,166,255,203,241,147,0,62,208,145,255,133,246,251,0,2,169,14,0,13,247,184,0,142,7,254,0,36,200,23,255,88,205,223,0,91,129,52,255,21,186,30,0,143,228,210,1,247,234,248,255,230,69,31,254,176,186,135,255,238,205,52,1,139,79,43,0,17,176,217,254,32,243,67,0,242,111,233,0,44,35,9,255,227,114,81,1,4,71,12,255,38,105,191,0,7,117,50,255,81,79,16,0,63,68,65,255,157,36,110,255,77,241,3,255,226,45,251,1,142,25,206,0,120,123,209,1,28,254,238,255,5,128,126,255,91,222,215,255,162,15,191,0,86,240,73,0,135,185,81,254,44,241,163,0,212,219,210,255,112,162,155,0,207,101,118,0,168,72,56,255,196,5,52,0,72,172,242,255,126,22,157,255,146,96,59,255,162,121,152,254,140,16,95,0,195,254,200,254,82,150,162,0,119,43,145,254,204,172,78,255,166,224,159,0,104,19,237,255,245,126,208,255,226,59,213,0,117,217,197,0,152,72,237,0,220,31,23,254,14,90,231,255,188,212,64,1,60,101,246,255,85,24,86,0,1,177,109,0,146,83,32,1,75,182,192,0,119,241,224,0,185,237,27,255,184,101,82,1,235,37,77,255,253,134,19,0,232,246,122,0,60,106,179,0,195,11,12,0,109,66,235,1,125,113,59,0,61,40,164,0,175,104,240,0,2,47,187,255,50,12,141,0,194,139,181,255,135,250,104,0,97,92,222,255,217,149,201,255,203,241,118,255,79,151,67,0,122,142,218,255,149,245,239,0,138,42,200,254,80,37,97,255,124,112,167,255,36,138,87,255,130,29,147,255,241,87,78,255,204,97,19,1,177,209,22,255,247,227,127,254,99,119,83,255,212,25,198,1,16,179,179,0,145,77,172,254,89,153,14,255,218,189,167,0,107,233,59,255,35,33,243,254,44,112,112,255,161,127,79,1,204,175,10,0,40,21,138,254,104,116,228,0,199,95,137,255,133,190,168,255,146,165,234,1,183,99,39,0,183,220,54,254,255,222,133,0,162,219,121,254,63,239,6,0,225,102,54,255,251,18,246,0,4,34,129,1,135,36,131,0,206,50,59,1,15,97,183,0,171,216,135,255,101,152,43,255,150,251,91,0,38,145,95,0,34,204,38,254,178,140,83,255,25,129,243,255,76,144,37,0,106,36,26,254,118,144,172,255,68,186,229,255,107,161,213,255,46,163,68,255,149,170,253,0,187,17,15,0,218,160,165,255,171,35,246,1,96,13,19,0,165,203,117,0,214,107,192,255,244,123,177,1,100,3,104,0,178,242,97,255,251,76,130,255,211,77,42,1,250,79,70,255,63,244,80,1,105,101,246,0,61,136,58,1,238,91,213,0,14,59,98,255,167,84,77,0,17,132,46,254,57,175,197,255,185,62,184,0,76,64,207,0,172,175,208,254,175,74,37,0,138,27,211,254,148,125,194,0,10,89,81,0,168,203,101,255,43,213,209,1,235,245,54,0,30,35,226,255,9,126,70,0,226,125,94,254,156,117,20,255,57,248,112,1,230,48,64,255,164,92,166,1,224,214,230,255,36,120,143,0,55,8,43,255,251,1,245,1,106,98,165,0,74,107,106,254,53,4,54,255,90,178,150,1,3,120,123,255,244,5,89,1,114,250,61,255,254,153,82,1,77,15,17,0,57,238,90,1,95,223,230,0,236,52,47,254,103,148,164,255,121,207,36,1,18,16,185,255,75,20,74,0,187,11,101,0,46,48,129,255,22,239,210,255,77,236,129,255,111,77,204,255,61,72,97,255,199,217,251,255,42,215,204,0,133,145,201,255,57,230,146,1,235,100,198,0,146,73,35,254,108,198,20,255,182,79,210,255,82,103,136,0,246,108,176,0,34,17,60,255,19,74,114,254,168,170,78,255,157,239,20,255,149,41,168,0,58,121,28,0,79,179,134,255,231,121,135,255,174,209,98,255,243,122,190,0,171,166,205,0,212,116,48,0,29,108,66,255,162,222,182,1,14,119,21,0,213,39,249,255,254,223,228,255,183,165,198,0,133,190,48,0,124,208,109,255,119,175,85,255,9,209,121,1,48,171,189,255,195,71,134,1,136,219,51,255,182,91,141,254,49,159,72,0,35,118,245,255,112,186,227,255,59,137,31,0,137,44,163,0,114,103,60,254,8,213,150,0,162,10,113,255,194,104,72,0,220,131,116,255,178,79,92,0,203,250,213,254,93,193,189,255,130,255,34,254,212,188,151,0,136,17,20,255,20,101,83,255,212,206,166,0,229,238,73,255,151,74,3,255,168,87,215,0,155,188,133,255,166,129,73,0,240,79,133,255,178,211,81,255,203,72,163,254,193,168,165,0,14,164,199,254,30,255,204,0,65,72,91,1,166,74,102,255,200,42,0,255,194,113,227,255,66,23,208,0,229,216,100,255,24,239,26,0,10,233,62,255,123,10,178,1,26,36,174,255,119,219,199,1,45,163,190,0,16,168,42,0,166,57,198,255,28,26,26,0,126,165,231,0,251,108,100,255,61,229,121,255,58,118,138,0,76,207,17,0,13,34,112,254,89,16,168,0,37,208,105,255,35,201,215,255,40,106,101,254,6,239,114,0,40,103,226,254,246,127,110,255,63,167,58,0,132,240,142,0,5,158,88,255,129,73,158,255,94,89,146,0,230,54,146,0,8,45,173,0,79,169,1,0,115,186,247,0,84,64,131,0,67,224,253,255,207,189,64,0,154,28,81,1,45,184,54,255,87,212,224,255,0,96,73,255,129,33,235,1,52,66,80,255,251,174,155,255,4,179,37,0,234,164,93,254,93,175,253,0,198,69,87,255,224,106,46,0,99,29,210,0,62,188,114,255,44,234,8,0,169,175,247,255,23,109,137,255,229,182,39,0,192,165,94,254,245,101,217,0,191,88,96,0,196,94,99,255,106,238,11,254,53,126,243,0,94,1,101,255,46,147,2,0,201,124,124,255,141,12,218,0,13,166,157,1,48,251,237,255,155,250,124,255,106,148,146,255,182,13,202,0,28,61,167,0,217,152,8,254,220,130,45,255,200,230,255,1,55,65,87,255,93,191,97,254,114,251,14,0,32,105,92,1,26,207,141,0,24,207,13,254,21,50,48,255,186,148,116,255,211,43,225,0,37,34,162,254,164,210,42,255,68,23,96,255,182,214,8,255,245,117,137,255,66,195,50,0,75,12,83,254,80,140,164,0,9,165,36,1,228,110,227,0,241,17,90,1,25,52,212,0,6,223,12,255,139,243,57,0,12,113,75,1,246,183,191,255,213,191,69,255,230,15,142,0,1,195,196,255,138,171,47,255,64,63,106,1,16,169,214,255,207,174,56,1,88,73,133,255,182,133,140,0,177,14,25,255,147,184,53,255,10,227,161,255,120,216,244,255,73,77,233,0,157,238,139,1,59,65,233,0,70,251,216,1,41,184,153,255,32,203,112,0,146,147,253,0,87,101,109,1,44,82,133,255,244,150,53,255,94,152,232,255,59,93,39,255,88,147,220,255,78,81,13,1,32,47,252,255,160,19,114,255,93,107,39,255,118,16,211,1,185,119,209,255,227,219,127,254,88,105,236,255,162,110,23,255,36,166,110,255,91,236,221,255,66,234,116,0,111,19,244,254,10,233,26,0,32,183,6,254,2,191,242,0,218,156,53,254,41,60,70,255,168,236,111,0,121,185,126,255,238,142,207,255,55,126,52,0,220,129,208,254,80,204,164,255,67,23,144,254,218,40,108,255,127,202,164,0,203,33,3,255,2,158,0,0,37,96,188,255,192,49,74,0,109,4,0,0,111,167,10,254,91,218,135,255,203,66,173,255,150,194,226,0,201,253,6,255,174,102,121,0,205,191,110,0,53,194,4,0,81,40,45,254,35,102,143,255,12,108,198,255,16,27,232,255,252,71,186,1,176,110,114,0,142,3,117,1,113,77,142,0,19,156,197,1,92,47,252,0,53,232,22,1,54,18,235,0,46,35,189,255,236,212,129,0,2,96,208,254,200,238,199,255,59,175,164,255,146,43,231,0,194,217,52,255,3,223,12,0,138,54,178,254,85,235,207,0,232,207,34,0,49,52,50,255,166,113,89,255,10,45,216,255,62,173,28,0,111,165,246,0,118,115,91,255,128,84,60,0,167,144,203,0,87,13,243,0,22,30,228,1,177,113,146,255,129,170,230,254,252,153,129,255,145,225,43,0,70,231,5,255,122,105,126,254,86,246,148,255,110,37,154,254,209,3,91,0,68,145,62,0,228,16,165,255,55,221,249,254,178,210,91,0,83,146,226,254,69,146,186,0,93,210,104,254,16,25,173,0,231,186,38,0,189,122,140,255,251,13,112,255,105,110,93,0,251,72,170,0,192,23,223,255,24,3,202,1,225,93,228,0,153,147,199,254,109,170,22,0,248,101,246,255,178,124,12,255,178,254,102,254,55,4,65,0,125,214,180,0,183,96,147,0,45,117,23,254,132,191,249,0,143,176,203,254,136,183,54,255,146,234,177,0,146,101,86,255,44,123,143,1,33,209,152,0,192,90,41,254,83,15,125,255,213,172,82,0,215,169,144,0,16,13,34,0,32,209,100,255,84,18,249,1,197,17,236,255,217,186,230,0,49,160,176,255,111,118,97,255,237,104,235,0,79,59,92,254,69,249,11,255,35,172,74,1,19,118,68,0,222,124,165,255,180,66,35,255,86,174,246,0,43,74,111,255,126,144,86,255,228,234,91,0,242,213,24,254,69,44,235,255,220,180,35,0,8,248,7,255,102,47,92,255,240,205,102,255,113,230,171,1,31,185,201,255,194,246,70,255,122,17,187,0,134,70,199,255,149,3,150,255,117,63,103,0,65,104,123,255,212,54,19,1,6,141,88,0,83,134,243,255,136,53,103,0,169,27,180,0,177,49,24,0,111,54,167,0,195,61,215,255,31,1,108,1,60,42,70,0,185,3,162,255,194,149,40,255,246,127,38,254,190,119,38,255,61,119,8,1,96,161,219,255,42,203,221,1,177,242,164,255,245,159,10,0,116,196,0,0,5,93,205,254,128,127,179,0,125,237,246,255,149,162,217,255,87,37,20,254,140,238,192,0,9,9,193,0,97,1,226,0,29,38,10,0,0,136,63,255,229,72,210,254,38,134,92,255,78,218,208,1,104,36,84,255,12,5,193,255,242,175,61,255,191,169,46,1,179,147,147,255,113,190,139,254,125,172,31,0,3,75,252,254,215,36,15,0,193,27,24,1,255,69,149,255,110,129,118,0,203,93,249,0,138,137,64,254,38,70,6,0,153,116,222,0,161,74,123,0,193,99,79,255,118,59,94,255,61,12,43,1,146,177,157,0,46,147,191,0,16,255,38,0,11,51,31,1,60,58,98,255,111,194,77,1,154,91,244,0,140,40,144,1,173,10,251,0,203,209,50,254,108,130,78,0,228,180,90,0,174,7,250,0,31,174,60,0,41,171,30,0,116,99,82,255,118,193,139,255,187,173,198,254,218,111,56,0,185,123,216,0,249,158,52,0,52,180,93,255,201,9,91,255,56,45,166,254,132,155,203,255,58,232,110,0,52,211,89,255,253,0,162,1,9,87,183,0,145,136,44,1,94,122,245,0,85,188,171,1,147,92,198,0,0,8,104,0,30,95,174,0,221,230,52,1,247,247,235,255,137,174,53,255,35,21,204,255,71,227,214,1,232,82,194,0,11,48,227,255,170,73,184,255,198,251,252,254,44,112,34,0,131,101,131,255,72,168,187,0,132,135,125,255,138,104,97,255,238,184,168,255,243,104,84,255,135,216,226,255,139,144,237,0,188,137,150,1,80,56,140,255,86,169,167,255,194,78,25,255,220,17,180,255,17,13,193,0,117,137,212,255,141,224,151,0,49,244,175,0,193,99,175,255,19,99,154,1,255,65,62,255,156,210,55,255,242,244,3,255,250,14,149,0,158,88,217,255,157,207,134,254,251,232,28,0,46,156,251,255,171,56,184,255,239,51,234,0,142,138,131,255,25,254,243,1,10,201,194,0,63,97,75,0,210,239,162,0,192,200,31,1,117,214,243,0,24,71,222,254,54,40,232,255,76,183,111,254,144,14,87,255,214,79,136,255,216,196,212,0,132,27,140,254,131,5,253,0,124,108,19,255,28,215,75,0,76,222,55,254,233,182,63,0,68,171,191,254,52,111,222,255,10,105,77,255,80,170,235,0,143,24,88,255,45,231,121,0,148,129,224,1,61,246,84,0,253,46,219,255,239,76,33,0,49,148,18,254,230,37,69,0,67,134,22,254,142,155,94,0,31,157,211,254,213,42,30,255,4,228,247,254,252,176,13,255,39,0,31,254,241,244,255,255,170,45,10,254,253,222,249,0,222,114,132,0,255,47,6,255,180,163,179,1,84,94,151,255,89,209,82,254,229,52,169,255,213,236,0,1,214,56,228,255,135,119,151,255,112,201,193,0,83,160,53,254,6,151,66,0,18,162,17,0,233,97,91,0,131,5,78,1,181,120,53,255,117,95,63,255,237,117,185,0,191,126,136,255,144,119,233,0,183,57,97,1,47,201,187,255,167,165,119,1,45,100,126,0,21,98,6,254,145,150,95,255,120,54,152,0,209,98,104,0,143,111,30,254,184,148,249,0,235,216,46,0,248,202,148,255,57,95,22,0,242,225,163,0,233,247,232,255,71,171,19,255,103,244,49,255,84,103,93,255,68,121,244,1,82,224,13,0,41,79,43,255,249,206,167,255,215,52,21,254,192,32,22,255,247,111,60,0,101,74,38,255,22,91,84,254,29,28,13,255,198,231,215,254,244,154,200,0,223,137,237,0,211,132,14,0,95,64,206,255,17,62,247,255,233,131,121,1,93,23,77,0,205,204,52,254,81,189,136,0,180,219,138,1,143,18,94,0,204,43,140,254,188,175,219,0,111,98,143,255,151,63,162,255,211,50,71,254,19,146,53,0,146,45,83,254,178,82,238,255,16,133,84,255,226,198,93,255,201,97,20,255,120,118,35,255,114,50,231,255,162,229,156,255,211,26,12,0,114,39,115,255,206,212,134,0,197,217,160,255,116,129,94,254,199,215,219,255,75,223,249,1,253,116,181,255,232,215,104,255,228,130,246,255,185,117,86,0,14,5,8,0,239,29,61,1,237,87,133,255,125,146,137,254,204,168,223,0,46,168,245,0,154,105,22,0,220,212,161,255,107,69,24,255,137,218,181,255,241,84,198,255,130,122,211,255,141,8,153,255,190,177,118,0,96,89,178,0,255,16,48,254,122,96,105,255,117,54,232,255,34,126,105,255,204,67,166,0,232,52,138,255,211,147,12,0,25,54,7,0,44,15,215,254,51,236,45,0,190,68,129,1,106,147,225,0,28,93,45,254,236,141,15,255,17,61,161,0,220,115,192,0,236,145,24,254,111,168,169,0,224,58,63,255,127,164,188,0,82,234,75,1,224,158,134,0,209,68,110,1,217,166,217,0,70,225,166,1,187,193,143,255,16,7,88,255,10,205,140,0,117,192,156,1,17,56,38,0,27,124,108,1,171,215,55,255,95,253,212,0,155,135,168,255,246,178,153,254,154,68,74,0,232,61,96,254,105,132,59,0,33,76,199,1,189,176,130,255,9,104,25,254,75,198,102,255,233,1,112,0,108,220,20,255,114,230,70,0,140,194,133,255,57,158,164,254,146,6,80,255,169,196,97,1,85,183,130,0,70,158,222,1,59,237,234,255,96,25,26,255,232,175,97,255,11,121,248,254,88,35,194,0,219,180,252,254,74,8,227,0,195,227,73,1,184,110,161,255,49,233,164,1,128,53,47,0,82,14,121,255,193,190,58,0,48,174,117,255,132,23,32,0,40,10,134,1,22,51,25,255,240,11,176,255,110,57,146,0,117,143,239,1,157,101,118,255,54,84,76,0,205,184,18,255,47,4,72,255,78,112,85,255,193,50,66,1,93,16,52,255,8,105,134,0,12,109,72,255,58,156,251,0,144,35,204,0,44,160,117,254,50,107,194,0,1,68,165,255,111,110,162,0,158,83,40,254,76,214,234,0,58,216,205,255,171,96,147,255,40,227,114,1,176,227,241,0,70,249,183,1,136,84,139,255,60,122,247,254,143,9,117,255,177,174,137,254,73,247,143,0,236,185,126,255,62,25,247,255,45,64,56,255,161,244,6,0,34,57,56,1,105,202,83,0,128,147,208,0,6,103,10,255,74,138,65,255,97,80,100,255,214,174,33,255,50,134,74,255,110,151,130,254,111,84,172,0,84,199,75,254,248,59,112,255,8,216,178,1,9,183,95,0,238,27,8,254,170,205,220,0,195,229,135,0,98,76,237,255,226,91,26,1,82,219,39,255,225,190,199,1,217,200,121,255,81,179,8,255,140,65,206,0,178,207,87,254,250,252,46,255,104,89,110,1,253,189,158,255,144,214,158,255,160,245,54,255,53,183,92,1,21,200,194,255,146,33,113,1,209,1,255,0,235,106,43,255,167,52,232,0,157,229,221,0,51,30,25,0,250,221,27,1,65,147,87,255,79,123,196,0,65,196,223,255,76,44,17,1,85,241,68,0,202,183,249,255,65,212,212,255,9,33,154,1,71,59,80,0,175,194,59,255,141,72,9,0,100,160,244,0,230,208,56,0,59,25,75,254,80,194,194,0,18,3,200,254,160,159,115,0,132,143,247,1,111,93,57,255,58,237,11,1,134,222,135,255,122,163,108,1,123,43,190,255,251,189,206,254,80,182,72,255,208,246,224,1,17,60,9,0,161,207,38,0,141,109,91,0,216,15,211,255,136,78,110,0,98,163,104,255,21,80,121,255,173,178,183,1,127,143,4,0,104,60,82,254,214,16,13,255,96,238,33,1,158,148,230,255,127,129,62,255,51,255,210,255,62,141,236,254,157,55,224,255,114,39,244,0,192,188,250,255,228,76,53,0,98,84,81,255,173,203,61,254,147,50,55,255,204,235,191,0,52,197,244,0,88,43,211,254,27,191,119,0,188,231,154,0,66,81,161,0,92,193,160,1,250,227,120,0,123,55,226,0,184,17,72,0,133,168,10,254,22,135,156,255,41,25,103,255,48,202,58,0,186,149,81,255,188,134,239,0,235,181,189,254,217,139,188,255,74,48,82,0,46,218,229,0,189,253,251,0,50,229,12,255,211,141,191,1,128,244,25,255,169,231,122,254,86,47,189,255,132,183,23,255,37,178,150,255,51,137,253,0,200,78,31,0,22,105,50,0,130,60,0,0,132,163,91,254,23,231,187,0,192,79,239,0,157,102,164,255,192,82,20,1,24,181,103,255,240,9,234,0,1,123,164,255,133,233,0,255,202,242,242,0,60,186,245,0,241,16,199,255,224,116,158,254,191,125,91,255,224,86,207,0,121,37,231,255,227,9,198,255,15,153,239,255,121,232,217,254,75,112,82,0,95,12,57,254,51,214,105,255,148,220,97,1,199,98,36,0,156,209,12,254,10,212,52,0,217,180,55,254,212,170,232,255,216,20,84,255,157,250,135,0,157,99,127,254,1,206,41,0,149,36,70,1,54,196,201,255,87,116,0,254,235,171,150,0,27,163,234,0,202,135,180,0,208,95,0,254,123,156,93,0,183,62,75,0,137,235,182,0,204,225,255,255,214,139,210,255,2,115,8,255,29,12,111,0,52,156,1,0,253,21,251,255,37,165,31,254,12,130,211,0,106,18,53,254,42,99,154,0,14,217,61,254,216,11,92,255,200,197,112,254,147,38,199,0,36,252,120,254,107,169,77,0,1,123,159,255,207,75,102,0,163,175,196,0,44,1,240,0,120,186,176,254,13,98,76,255,237,124,241,255,232,146,188,255,200,96,224,0,204,31,41,0,208,200,13,0,21,225,96,255,175,156,196,0,247,208,126,0,62,184,244,254,2,171,81,0,85,115,158,0,54,64,45,255,19,138,114,0,135,71,205,0,227,47,147,1,218,231,66,0,253,209,28,0,244,15,173,255,6,15,118,254,16,150,208,255,185,22,50,255,86,112,207,255,75,113,215,1,63,146,43,255,4,225,19,254,227,23,62,255,14,255,214,254,45,8,205,255,87,197,151,254,210,82,215,255,245,248,247,255,128,248,70,0,225,247,87,0,90,120,70,0,213,245,92,0,13,133,226,0,47,181,5,1,92,163,105,255,6,30,133,254,232,178,61,255,230,149,24,255,18,49,158,0,228,100,61,254,116,243,251,255,77,75,92,1,81,219,147,255,76,163,254,254,141,213,246,0,232,37,152,254,97,44,100,0,201,37,50,1,212,244,57,0,174,171,183,255,249,74,112,0,166,156,30,0,222,221,97,255,243,93,73,254,251,101,100,255,216,217,93,255,254,138,187,255,142,190,52,255,59,203,177,255,200,94,52,0,115,114,158,255,165,152,104,1,126,99,226,255,118,157,244,1,107,200,16,0,193,90,229,0,121,6,88,0,156,32,93,254,125,241,211,255,14,237,157,255,165,154,21,255,184,224,22,255,250,24,152,255,113,77,31,0,247,171,23,255,237,177,204,255,52,137,145,255,194,182,114,0,224,234,149,0,10,111,103,1,201,129,4,0,238,142,78,0,52,6,40,255,110,213,165,254,60,207,253,0,62,215,69,0,96,97,0,255,49,45,202,0,120,121,22,255,235,139,48,1,198,45,34,255,182,50,27,1,131,210,91,255,46,54,128,0,175,123,105,255,198,141,78,254,67,244,239,255,245,54,103,254,78,38,242,255,2,92,249,254,251,174,87,255,139,63,144,0,24,108,27,255,34,102,18,1,34,22,152,0,66,229,118,254,50,143,99,0,144,169,149,1,118,30,152,0,178,8,121,1,8,159,18,0,90,101,230,255,129,29,119,0,68,36,11,1,232,183,55,0,23,255,96,255,161,41,193,255,63,139,222,0,15,179,243,0,255,100,15,255,82,53,135,0,137,57,149,1,99,240,170,255,22,230,228,254,49,180,82,255,61,82,43,0,110,245,217,0,199,125,61,0,46,253,52,0,141,197,219,0,211,159,193,0,55,121,105,254,183,20,129,0,169,119,170,255,203,178,139,255,135,40,182,255,172,13,202,255,65,178,148,0,8,207,43,0,122,53,127,1,74,161,48,0,227,214,128,254,86,11,243,255,100,86,7,1,245,68,134,255,61,43,21,1,152,84,94,255,190,60,250,254,239,118,232,255,214,136,37,1,113,76,107,255,93,104,100,1,144,206,23,255,110,150,154,1,228,103,185,0,218,49,50,254,135,77,139,255,185,1,78,0,0,161,148,255,97,29,233,255,207,148,149,255,160,168,0,0,91,128,171,255,6,28,19,254,11,111,247,0,39,187,150,255,138,232,149,0,117,62,68,255,63,216,188,255,235,234,32,254,29,57,160,255,25,12,241,1,169,60,191,0,32,131,141,255,237,159,123,255,94,197,94,254,116,254,3,255,92,179,97,254,121,97,92,255,170,112,14,0,21,149,248,0,248,227,3,0,80,96,109,0,75,192,74,1,12,90,226,255,161,106,68,1,208,114,127,255,114,42,255,254,74,26,74,255,247,179,150,254,121,140,60,0,147,70,200,255,214,40,161,255,161,188,201,255,141,65,135,255,242,115,252,0,62,47,202,0,180,149,255,254,130,55,237,0,165,17,186,255,10,169,194,0,156,109,218,255,112,140,123,255,104,128,223,254,177,142,108,255,121,37,219,255,128,77,18,255,111,108,23,1,91,192,75,0,174,245,22,255,4,236,62,255,43,64,153,1,227,173,254,0,237,122,132,1,127,89,186,255,142,82,128,254,252,84,174,0,90,179,177,1,243,214,87,255,103,60,162,255,208,130,14,255,11,130,139,0,206,129,219,255,94,217,157,255,239,230,230,255,116,115,159,254,164,107,95,0,51,218,2,1,216,125,198,255,140,202,128,254,11,95,68,255,55,9,93,254,174,153,6,255,204,172,96,0,69,160,110,0,213,38,49,254,27,80,213,0,118,125,114,0,70,70,67,255,15,142,73,255,131,122,185,255,243,20,50,254,130,237,40,0,210,159,140,1,197,151,65,255,84,153,66,0,195,126,90,0,16,238,236,1,118,187,102,255,3,24,133,255,187,69,230,0,56,197,92,1,213,69,94,255,80,138,229,1,206,7,230,0,222,111,230,1,91,233,119,255,9,89,7,1,2,98,1,0,148,74,133,255,51,246,180,255,228,177,112,1,58,189,108,255,194,203,237,254,21,209,195,0,147,10,35,1,86,157,226,0,31,163,139,254,56,7,75,255,62,90,116,0,181,60,169,0,138,162,212,254,81,167,31,0,205,90,112,255,33,112,227,0,83,151,117,1,177,224,73,255,174,144,217,255,230,204,79,255,22,77,232,255,114,78,234,0,224,57,126,254,9,49,141,0,242,147,165,1,104,182,140,255,167,132,12,1,123,68,127,0,225,87,39,1,251,108,8,0,198,193,143,1,121,135,207,255,172,22,70,0,50,68,116,255,101,175,40,255,248,105,233,0,166,203,7,0,110,197,218,0,215,254,26,254,168,226,253,0,31,143,96,0,11,103,41,0,183,129,203,254,100,247,74,255,213,126,132,0,210,147,44,0,199,234,27,1,148,47,181,0,155,91,158,1,54,105,175,255,2,78,145,254,102,154,95,0,128,207,127,254,52,124,236,255,130,84,71,0,221,243,211,0,152,170,207,0,222,106,199,0,183,84,94,254,92,200,56,255,138,182,115,1,142,96,146,0,133,136,228,0,97,18,150,0,55,251,66,0,140,102,4,0,202,103,151,0,30,19,248,255,51,184,207,0,202,198,89,0,55,197,225,254,169,95,249,255,66,65,68,255,188,234,126,0,166,223,100,1,112,239,244,0,144,23,194,0,58,39,182,0,244,44,24,254,175,68,179,255,152,118,154,1,176,162,130,0,217,114,204,254,173,126,78,255,33,222,30,255,36,2,91,255,2,143,243,0,9,235,215,0,3,171,151,1,24,215,245,255,168,47,164,254,241,146,207,0,69,129,180,0,68,243,113,0,144,53,72,254,251,45,14,0,23,110,168,0,68,68,79,255,110,70,95,254,174,91,144,255,33,206,95,255,137,41,7,255,19,187,153,254,35,255,112,255,9,145,185,254,50,157,37,0,11,112,49,1,102,8,190,255,234,243,169,1,60,85,23,0,74,39,189,0,116,49,239,0,173,213,210,0,46,161,108,255,159,150,37,0,196,120,185,255,34,98,6,255,153,195,62,255,97,230,71,255,102,61,76,0,26,212,236,255,164,97,16,0,198,59,146,0,163,23,196,0,56,24,61,0,181,98,193,0,251,147,229,255,98,189,24,255,46,54,206,255,234,82,246,0,183,103,38,1,109,62,204,0,10,240,224,0,146,22,117,255,142,154,120,0,69,212,35,0,208,99,118,1,121,255,3,255,72,6,194,0,117,17,197,255,125,15,23,0,154,79,153,0,214,94,197,255,185,55,147,255,62,254,78,254,127,82,153,0,110,102,63,255,108,82,161,255,105,187,212,1,80,138,39,0,60,255,93,255,72,12,186,0,210,251,31,1,190,167,144,255,228,44,19,254,128,67,232,0,214,249,107,254,136,145,86,255,132,46,176,0,189,187,227,255,208,22,140,0,217,211,116,0,50,81,186,254,139,250,31,0,30,64,198,1,135,155,100,0,160,206,23,254,187,162,211,255,16,188,63,0,254,208,49,0,85,84,191,0,241,192,242,255,153,126,145,1,234,162,162,255,230,97,216,1,64,135,126,0,190,148,223,1,52,0,43,255,28,39,189,1,64,136,238,0,175,196,185,0,98,226,213,255,127,159,244,1,226,175,60,0,160,233,142,1,180,243,207,255,69,152,89,1,31,101,21,0,144,25,164,254,139,191,209,0,91,25,121,0,32,147,5,0,39,186,123,255,63,115,230,255,93,167,198,255,143,213,220,255,179,156,19,255,25,66,122,0,214,160,217,255,2,45,62,255,106,79,146,254,51,137,99,255,87,100,231,255,175,145,232,255,101,184,1,255,174,9,125,0,82,37,161,1,36,114,141,255,48,222,142,255,245,186,154,0,5,174,221,254,63,114,155,255,135,55,160,1,80,31,135,0,126,250,179,1,236,218,45,0,20,28,145,1,16,147,73,0,249,189,132,1,17,189,192,255,223,142,198,255,72,20,15,255,250,53,237,254,15,11,18,0,27,211,113,254,213,107,56,255,174,147,146,255,96,126,48,0,23,193,109,1,37,162,94,0,199,157,249,254,24,128,187,255,205,49,178,254,93,164,42,255,43,119,235,1,88,183,237,255,218,210,1,255,107,254,42,0,230,10,99,255,162,0,226,0,219,237,91,0,129,178,203,0,208,50,95,254,206,208,95,255,247,191,89,254,110,234,79,255,165,61,243,0,20,122,112,255,246,246,185,254,103,4,123,0,233,99,230,1,219,91,252,255,199,222,22,255,179,245,233,255,211,241,234,0,111,250,192,255,85,84,136,0,101,58,50,255,131,173,156,254,119,45,51,255,118,233,16,254,242,90,214,0,94,159,219,1,3,3,234,255,98,76,92,254,80,54,230,0,5,228,231,254,53,24,223,255,113,56,118,1,20,132,1,255,171,210,236,0,56,241,158,255,186,115,19,255,8,229,174,0,48,44,0,1,114,114,166,255,6,73,226,255,205,89,244,0,137,227,75,1,248,173,56,0,74,120,246,254,119,3,11,255,81,120,198,255,136,122,98,255,146,241,221,1,109,194,78,255,223,241,70,1,214,200,169,255,97,190,47,255,47,103,174,255,99,92,72,254,118,233,180,255,193,35,233,254,26,229,32,255,222,252,198,0,204,43,71,255,199,84,172,0,134,102,190,0,111,238,97,254,230,40,230,0,227,205,64,254,200,12,225,0,166,25,222,0,113,69,51,255,143,159,24,0,167,184,74,0,29,224,116,254,158,208,233,0,193,116,126,255,212,11,133,255,22,58,140,1,204,36,51,255,232,30,43,0,235,70,181,255,64,56,146,254,169,18,84,255,226,1,13,255,200,50,176,255,52,213,245,254,168,209,97,0,191,71,55,0,34,78,156,0,232,144,58,1,185,74,189,0,186,142,149,254,64,69,127,255,161,203,147,255,176,151,191,0,136,231,203,254,163,182,137,0,161,126,251,254,233,32,66,0,68,207,66,0,30,28,37,0,93,114,96,1,254,92,247,255,44,171,69,0,202,119,11,255,188,118,50,1,255,83,136,255,71,82,26,0,70,227,2,0,32,235,121,1,181,41,154,0,71,134,229,254,202,255,36,0,41,152,5,0,154,63,73,255,34,182,124,0,121,221,150,255,26,204,213,1,41,172,87,0,90,157,146,255,109,130,20,0,71,107,200,255,243,102,189,0,1,195,145,254,46,88,117,0,8,206,227,0,191,110,253,255,109,128,20,254,134,85,51,255,137,177,112,1,216,34,22,255,131,16,208,255,121,149,170,0,114,19,23,1,166,80,31,255,113,240,122,0,232,179,250,0,68,110,180,254,210,170,119,0,223,108,164,255,207,79,233,255,27,229,226,254,209,98,81,255,79,68,7,0,131,185,100,0,170,29,162,255,17,162,107,255,57,21,11,1,100,200,181,255,127,65,166,1,165,134,204,0,104,167,168,0,1,164,79,0,146,135,59,1,70,50,128,255,102,119,13,254,227,6,135,0,162,142,179,255,160,100,222,0,27,224,219,1,158,93,195,255,234,141,137,0,16,24,125,255,238,206,47,255,97,17,98,255,116,110,12,255,96,115,77,0,91,227,232,255,248,254,79,255,92,229,6,254,88,198,139,0,206,75,129,0,250,77,206,255,141,244,123,1,138,69,220,0,32,151,6,1,131,167,22,255,237,68,167,254,199,189,150,0,163,171,138,255,51,188,6,255,95,29,137,254,148,226,179,0,181,107,208,255,134,31,82,255,151,101,45,255,129,202,225,0,224,72,147,0,48,138,151,255,195,64,206,254,237,218,158,0,106,29,137,254,253,189,233,255,103,15,17,255,194,97,255,0,178,45,169,254,198,225,155,0,39,48,117,255,135,106,115,0,97,38,181,0,150,47,65,255,83,130,229,254,246,38,129,0,92,239,154,254,91,99,127,0,161,111,33,255,238,217,242,255,131,185,195,255,213,191,158,255,41,150,218,0,132,169,131,0,89,84,252,1,171,70,128,255,163,248,203,254,1,50,180,255,124,76,85,1,251,111,80,0,99,66,239,255,154,237,182,255,221,126,133,254,74,204,99,255,65,147,119,255,99,56,167,255,79,248,149,255,116,155,228,255,237,43,14,254,69,137,11,255,22,250,241,1,91,122,143,255,205,249,243,0,212,26,60,255,48,182,176,1,48,23,191,255,203,121,152,254,45,74,213,255,62,90,18,254,245,163,230,255,185,106,116,255,83,35,159,0,12,33,2,255,80,34,62,0,16,87,174,255,173,101,85,0,202,36,81,254,160,69,204,255,64,225,187,0,58,206,94,0,86,144,47,0,229,86,245,0,63,145,190,1,37,5,39,0,109,251,26,0,137,147,234,0,162,121,145,255,144,116,206,255,197,232,185,255,183,190,140,255,73,12,254,255,139,20,242,255,170,90,239,255,97,66,187,255,245,181,135,254,222,136,52,0,245,5,51,254,203,47,78,0,152,101,216,0,73,23,125,0,254,96,33,1,235,210,73,255,43,209,88,1,7,129,109,0,122,104,228,254,170,242,203,0,242,204,135,255,202,28,233,255,65,6,127,0,159,144,71,0,100,140,95,0,78,150,13,0,251,107,118,1,182,58,125,255,1,38,108,255,141,189,209,255,8,155,125,1,113,163,91,255,121,79,190,255,134,239,108,255,76,47,248,0,163,228,239,0,17,111,10,0,88,149,75,255,215,235,239,0,167,159,24,255,47,151,108,255,107,209,188,0,233,231,99,254,28,202,148,255,174,35,138,255,110,24,68,255,2,69,181,0,107,102,82,0,102,237,7,0,92,36,237,255,221,162,83,1,55,202,6,255,135,234,135,255,24,250,222,0,65,94,168,254,245,248,210,255,167,108,201,254,255,161,111,0,205,8,254,0,136,13,116,0,100,176,132,255,43,215,126,255,177,133,130,255,158,79,148,0,67,224,37,1,12,206,21,255,62,34,110,1,237,104,175,255,80,132,111,255,142,174,72,0,84,229,180,254,105,179,140,0,64,248,15,255,233,138,16,0,245,67,123,254,218,121,212,255,63,95,218,1,213,133,137,255,143,182,82,255,48,28,11,0,244,114,141,1,209,175,76,255,157,181,150,255,186,229,3,255,164,157,111,1,231,189,139,0,119,202,190,255,218,106,64,255,68,235,63,254,96,26,172,255,187,47,11,1,215,18,251,255,81,84,89,0,68,58,128,0,94,113,5,1,92,129,208,255,97,15,83,254,9,28,188,0,239,9,164,0,60,205,152,0,192,163,98,255,184,18,60,0,217,182,139,0,109,59,120,255,4,192,251,0,169,210,240,255,37,172,92,254,148,211,245,255,179,65,52,0,253,13,115,0,185,174,206,1,114,188,149,255,237,90,173,0,43,199,192,255,88,108,113,0,52,35,76,0,66,25,148,255,221,4,7,255,151,241,114,255,190,209,232,0,98,50,199,0,151,150,213,255,18,74,36,1,53,40,7,0,19,135,65,255,26,172,69,0,174,237,85,0,99,95,41,0,3,56,16,0,39,160,177,255,200,106,218,254,185,68,84,255,91,186,61,254,67,143,141,255,13,244,166,255,99,114,198,0,199,110,163,255,193,18,186,0,124,239,246,1,110,68,22,0,2,235,46,1,212,60,107,0,105,42,105,1,14,230,152,0,7,5,131,0,141,104,154,255,213,3,6,0,131,228,162,255,179,100,28,1,231,123,85,255,206,14,223,1,253,96,230,0,38,152,149,1,98,137,122,0,214,205,3,255,226,152,179,255,6,133,137,0,158,69,140,255,113,162,154,255,180,243,172,255,27,189,115,255,143,46,220,255,213,134,225,255,126,29,69,0,188,43,137,1,242,70,9,0,90,204,255,255,231,170,147,0,23,56,19,254,56,125,157,255,48,179,218,255,79,182,253,255,38,212,191,1,41,235,124,0,96,151,28,0,135,148,190,0,205,249,39,254,52,96,136,255,212,44,136,255,67,209,131,255,252,130,23,255,219,128,20,255,198,129,118,0,108,101,11,0,178,5,146,1,62,7,100,255,181,236,94,254,28,26,164,0,76,22,112,255,120,102,79,0,202,192,229,1,200,176,215,0,41,64,244,255,206,184,78,0,167,45,63,1,160,35,0,255,59,12,142,255,204,9,144,255,219,94,229,1,122,27,112,0,189,105,109,255,64,208,74,255,251,127,55,1,2,226,198,0,44,76,209,0,151,152,77,255,210,23,46,1,201,171,69,255,44,211,231,0,190,37,224,255,245,196,62,255,169,181,222,255,34,211,17,0,119,241,197,255,229,35,152,1,21,69,40,255,178,226,161,0,148,179,193,0,219,194,254,1,40,206,51,255,231,92,250,1,67,153,170,0,21,148,241,0,170,69,82,255,121,18,231,255,92,114,3,0,184,62,230,0,225,201,87,255,146,96,162,255,181,242,220,0,173,187,221,1,226,62,170,255,56,126,217,1,117,13,227,255,179,44,239,0,157,141,155,255,144,221,83,0,235,209,208,0,42,17,165,1,251,81,133,0,124,245,201,254,97,211,24,255,83,214,166,0,154,36,9,255,248,47,127,0,90,219,140,255,161,217,38,254,212,147,63,255,66,84,148,1,207,3,1,0,230,134,89,1,127,78,122,255,224,155,1,255,82,136,74,0,178,156,208,255,186,25,49,255,222,3,210,1,229,150,190,255,85,162,52,255,41,84,141,255,73,123,84,254,93,17,150,0,119,19,28,1,32,22,215,255,28,23,204,255,142,241,52,255,228,52,125,0,29,76,207,0,215,167,250,254,175,164,230,0,55,207,105,1,109,187,245,255,161,44,220,1,41,101,128,255,167,16,94,0,93,214,107,255,118,72,0,254,80,61,234,255,121,175,125,0,139,169,251,0,97,39,147,254,250,196,49,255,165,179,110,254,223,70,187,255,22,142,125,1,154,179,138,255,118,176,42,1,10,174,153,0,156,92,102,0,168,13,161,255,143,16,32,0,250,197,180,255,203,163,44,1,87,32,36,0,161,153,20,255,123,252,15,0,25,227,80,0,60,88,142,0,17,22,201,1,154,205,77,255,39,63,47,0,8,122,141,0,128,23,182,254,204,39,19,255,4,112,29,255,23,36,140,255,210,234,116,254,53,50,63,255,121,171,104,255,160,219,94,0,87,82,14,254,231,42,5,0,165,139,127,254,86,78,38,0,130,60,66,254,203,30,45,255,46,196,122,1,249,53,162,255,136,143,103,254,215,210,114,0,231,7,160,254,169,152,42,255,111,45,246,0,142,131,135,255,131,71,204,255,36,226,11,0,0,28,242,255,225,138,213,255,247,46,216,254,245,3,183,0,108,252,74,1,206,26,48,255,205,54,246,255,211,198,36,255,121,35,50,0,52,216,202,255,38,139,129,254,242,73,148,0,67,231,141,255,42,47,204,0,78,116,25,1,4,225,191,255,6,147,228,0,58,88,177,0,122,165,229,255,252,83,201,255,224,167,96,1,177,184,158,255,242,105,179,1,248,198,240,0,133,66,203,1,254,36,47,0,45,24,115,255,119,62,254,0,196,225,186,254,123,141,172,0,26,85,41,255,226,111,183,0,213,231,151,0,4,59,7,255,238,138,148,0,66,147,33,255,31,246,141,255,209,141,116,255,104,112,31,0,88,161,172,0,83,215,230,254,47,111,151,0,45,38,52,1,132,45,204,0,138,128,109,254,233,117,134,255,243,190,173,254,241,236,240,0,82,127,236,254,40,223,161,255,110,182,225,255,123,174,239,0,135,242,145,1,51,209,154,0,150,3,115,254,217,164,252,255,55,156,69,1,84,94,255,255,232,73,45,1,20,19,212,255,96,197,59,254,96,251,33,0,38,199,73,1,64,172,247,255,117,116,56,255,228,17,18,0,62,138,103,1,246,229,164,255,244,118,201,254,86,32,159,255,109,34,137,1,85,211,186,0,10,193,193,254,122,194,177,0,122,238,102,255,162,218,171,0,108,217,161,1,158,170,34,0,176,47,155,1,181,228,11,255,8,156,0,0,16,75,93,0,206,98,255,1,58,154,35,0,12,243,184,254,67,117,66,255,230,229,123,0,201,42,110], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+20480);
/* memory initializer */ allocate([134,228,178,254,186,108,118,255,58,19,154,255,82,169,62,255,114,143,115,1,239,196,50,255,173,48,193,255,147,2,84,255,150,134,147,254,95,232,73,0,109,227,52,254,191,137,10,0,40,204,30,254,76,52,97,255,164,235,126,0,254,124,188,0,74,182,21,1,121,29,35,255,241,30,7,254,85,218,214,255,7,84,150,254,81,27,117,255,160,159,152,254,66,24,221,255,227,10,60,1,141,135,102,0,208,189,150,1,117,179,92,0,132,22,136,255,120,199,28,0,21,129,79,254,182,9,65,0,218,163,169,0,246,147,198,255,107,38,144,1,78,175,205,255,214,5,250,254,47,88,29,255,164,47,204,255,43,55,6,255,131,134,207,254,116,100,214,0,96,140,75,1,106,220,144,0,195,32,28,1,172,81,5,255,199,179,52,255,37,84,203,0,170,112,174,0,11,4,91,0,69,244,27,1,117,131,92,0,33,152,175,255,140,153,107,255,251,135,43,254,87,138,4,255,198,234,147,254,121,152,84,255,205,101,155,1,157,9,25,0,72,106,17,254,108,153,0,255,189,229,186,0,193,8,176,255,174,149,209,0,238,130,29,0,233,214,126,1,61,226,102,0,57,163,4,1,198,111,51,255,45,79,78,1,115,210,10,255,218,9,25,255,158,139,198,255,211,82,187,254,80,133,83,0,157,129,230,1,243,133,134,255,40,136,16,0,77,107,79,255,183,85,92,1,177,204,202,0,163,71,147,255,152,69,190,0,172,51,188,1,250,210,172,255,211,242,113,1,89,89,26,255,64,66,111,254,116,152,42,0,161,39,27,255,54,80,254,0,106,209,115,1,103,124,97,0,221,230,98,255,31,231,6,0,178,192,120,254,15,217,203,255,124,158,79,0,112,145,247,0,92,250,48,1,163,181,193,255,37,47,142,254,144,189,165,255,46,146,240,0,6,75,128,0,41,157,200,254,87,121,213,0,1,113,236,0,5,45,250,0,144,12,82,0,31,108,231,0,225,239,119,255,167,7,189,255,187,228,132,255,110,189,34,0,94,44,204,1,162,52,197,0,78,188,241,254,57,20,141,0,244,146,47,1,206,100,51,0,125,107,148,254,27,195,77,0,152,253,90,1,7,143,144,255,51,37,31,0,34,119,38,255,7,197,118,0,153,188,211,0,151,20,116,254,245,65,52,255,180,253,110,1,47,177,209,0,161,99,17,255,118,222,202,0,125,179,252,1,123,54,126,255,145,57,191,0,55,186,121,0,10,243,138,0,205,211,229,255,125,156,241,254,148,156,185,255,227,19,188,255,124,41,32,255,31,34,206,254,17,57,83,0,204,22,37,255,42,96,98,0,119,102,184,1,3,190,28,0,110,82,218,255,200,204,192,255,201,145,118,0,117,204,146,0,132,32,98,1,192,194,121,0,106,161,248,1,237,88,124,0,23,212,26,0,205,171,90,255,248,48,216,1,141,37,230,255,124,203,0,254,158,168,30,255,214,248,21,0,112,187,7,255,75,133,239,255,74,227,243,255,250,147,70,0,214,120,162,0,167,9,179,255,22,158,18,0,218,77,209,1,97,109,81,255,244,33,179,255,57,52,57,255,65,172,210,255,249,71,209,255,142,169,238,0,158,189,153,255,174,254,103,254,98,33,14,0,141,76,230,255,113,139,52,255,15,58,212,0,168,215,201,255,248,204,215,1,223,68,160,255,57,154,183,254,47,231,121,0,106,166,137,0,81,136,138,0,165,43,51,0,231,139,61,0,57,95,59,254,118,98,25,255,151,63,236,1,94,190,250,255,169,185,114,1,5,250,58,255,75,105,97,1,215,223,134,0,113,99,163,1,128,62,112,0,99,106,147,0,163,195,10,0,33,205,182,0,214,14,174,255,129,38,231,255,53,182,223,0,98,42,159,255,247,13,40,0,188,210,177,1,6,21,0,255,255,61,148,254,137,45,129,255,89,26,116,254,126,38,114,0,251,50,242,254,121,134,128,255,204,249,167,254,165,235,215,0,202,177,243,0,133,141,62,0,240,130,190,1,110,175,255,0,0,20,146,1,37,210,121,255,7,39,130,0,142,250,84,255,141,200,207,0,9,95,104,255,11,244,174,0,134,232,126,0,167,1,123,254,16,193,149,255,232,233,239,1,213,70,112,255,252,116,160,254,242,222,220,255,205,85,227,0,7,185,58,0,118,247,63,1,116,77,177,255,62,245,200,254,63,18,37,255,107,53,232,254,50,221,211,0,162,219,7,254,2,94,43,0,182,62,182,254,160,78,200,255,135,140,170,0,235,184,228,0,175,53,138,254,80,58,77,255,152,201,2,1,63,196,34,0,5,30,184,0,171,176,154,0,121,59,206,0,38,99,39,0,172,80,77,254,0,134,151,0,186,33,241,254,94,253,223,255,44,114,252,0,108,126,57,255,201,40,13,255,39,229,27,255,39,239,23,1,151,121,51,255,153,150,248,0,10,234,174,255,118,246,4,254,200,245,38,0,69,161,242,1,16,178,150,0,113,56,130,0,171,31,105,0,26,88,108,255,49,42,106,0,251,169,66,0,69,93,149,0,20,57,254,0,164,25,111,0,90,188,90,255,204,4,197,0,40,213,50,1,212,96,132,255,88,138,180,254,228,146,124,255,184,246,247,0,65,117,86,255,253,102,210,254,254,121,36,0,137,115,3,255,60,24,216,0,134,18,29,0,59,226,97,0,176,142,71,0,7,209,161,0,189,84,51,254,155,250,72,0,213,84,235,255,45,222,224,0,238,148,143,255,170,42,53,255,78,167,117,0,186,0,40,255,125,177,103,255,69,225,66,0,227,7,88,1,75,172,6,0,169,45,227,1,16,36,70,255,50,2,9,255,139,193,22,0,143,183,231,254,218,69,50,0,236,56,161,1,213,131,42,0,138,145,44,254,136,229,40,255,49,63,35,255,61,145,245,255,101,192,2,254,232,167,113,0,152,104,38,1,121,185,218,0,121,139,211,254,119,240,35,0,65,189,217,254,187,179,162,255,160,187,230,0,62,248,14,255,60,78,97,0,255,247,163,255,225,59,91,255,107,71,58,255,241,47,33,1,50,117,236,0,219,177,63,254,244,90,179,0,35,194,215,255,189,67,50,255,23,135,129,0,104,189,37,255,185,57,194,0,35,62,231,255,220,248,108,0,12,231,178,0,143,80,91,1,131,93,101,255,144,39,2,1,255,250,178,0,5,17,236,254,139,32,46,0,204,188,38,254,245,115,52,255,191,113,73,254,191,108,69,255,22,69,245,1,23,203,178,0,170,99,170,0,65,248,111,0,37,108,153,255,64,37,69,0,0,88,62,254,89,148,144,255,191,68,224,1,241,39,53,0,41,203,237,255,145,126,194,255,221,42,253,255,25,99,151,0,97,253,223,1,74,115,49,255,6,175,72,255,59,176,203,0,124,183,249,1,228,228,99,0,129,12,207,254,168,192,195,255,204,176,16,254,152,234,171,0,77,37,85,255,33,120,135,255,142,194,227,1,31,214,58,0,213,187,125,255,232,46,60,255,190,116,42,254,151,178,19,255,51,62,237,254,204,236,193,0,194,232,60,0,172,34,157,255,189,16,184,254,103,3,95,255,141,233,36,254,41,25,11,255,21,195,166,0,118,245,45,0,67,213,149,255,159,12,18,255,187,164,227,1,160,25,5,0,12,78,195,1,43,197,225,0,48,142,41,254,196,155,60,255,223,199,18,1,145,136,156,0,252,117,169,254,145,226,238,0,239,23,107,0,109,181,188,255,230,112,49,254,73,170,237,255,231,183,227,255,80,220,20,0,194,107,127,1,127,205,101,0,46,52,197,1,210,171,36,255,88,3,90,255,56,151,141,0,96,187,255,255,42,78,200,0,254,70,70,1,244,125,168,0,204,68,138,1,124,215,70,0,102,66,200,254,17,52,228,0,117,220,143,254,203,248,123,0,56,18,174,255,186,151,164,255,51,232,208,1,160,228,43,255,249,29,25,1,68,190,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,160,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,220,130,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,244,127,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+30720);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_bitshift64Ashr"] = _bitshift64Ashr;

   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
   
  Module["___muldsi3"] = ___muldsi3; 
  Module["___muldi3"] = ___muldi3;

  function _llvm_stackrestore(p) {
      var self = _llvm_stacksave;
      var ret = self.LLVM_SAVEDSTACKS[p];
      self.LLVM_SAVEDSTACKS.splice(p, 1);
      Runtime.stackRestore(ret);
    }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    } 
  Module["_sbrk"] = _sbrk;

  function _llvm_stacksave() {
      var self = _llvm_stacksave;
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = [];
      }
      self.LLVM_SAVEDSTACKS.push(Runtime.stackSave());
      return self.LLVM_SAVEDSTACKS.length-1;
    }

  
  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy; 
  Module["_memmove"] = _memmove;


  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory


function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "_llvm_stackrestore": _llvm_stackrestore, "_llvm_stacksave": _llvm_stacksave, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
'use asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var ___lock=env.___lock;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _llvm_stackrestore=env._llvm_stackrestore;
  var _llvm_stacksave=env._llvm_stacksave;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _crypto_verify_32_ref($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = $3 ^ $2;
 $5 = ((($0)) + 1|0);
 $6 = HEAP8[$5>>0]|0;
 $7 = ((($1)) + 1|0);
 $8 = HEAP8[$7>>0]|0;
 $9 = $8 ^ $6;
 $10 = $9 | $4;
 $11 = ((($0)) + 2|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = ((($1)) + 2|0);
 $14 = HEAP8[$13>>0]|0;
 $15 = $14 ^ $12;
 $16 = $10 | $15;
 $17 = ((($0)) + 3|0);
 $18 = HEAP8[$17>>0]|0;
 $19 = ((($1)) + 3|0);
 $20 = HEAP8[$19>>0]|0;
 $21 = $20 ^ $18;
 $22 = $16 | $21;
 $23 = ((($0)) + 4|0);
 $24 = HEAP8[$23>>0]|0;
 $25 = ((($1)) + 4|0);
 $26 = HEAP8[$25>>0]|0;
 $27 = $26 ^ $24;
 $28 = $22 | $27;
 $29 = ((($0)) + 5|0);
 $30 = HEAP8[$29>>0]|0;
 $31 = ((($1)) + 5|0);
 $32 = HEAP8[$31>>0]|0;
 $33 = $32 ^ $30;
 $34 = $28 | $33;
 $35 = ((($0)) + 6|0);
 $36 = HEAP8[$35>>0]|0;
 $37 = ((($1)) + 6|0);
 $38 = HEAP8[$37>>0]|0;
 $39 = $38 ^ $36;
 $40 = $34 | $39;
 $41 = ((($0)) + 7|0);
 $42 = HEAP8[$41>>0]|0;
 $43 = ((($1)) + 7|0);
 $44 = HEAP8[$43>>0]|0;
 $45 = $44 ^ $42;
 $46 = $40 | $45;
 $47 = ((($0)) + 8|0);
 $48 = HEAP8[$47>>0]|0;
 $49 = ((($1)) + 8|0);
 $50 = HEAP8[$49>>0]|0;
 $51 = $50 ^ $48;
 $52 = $46 | $51;
 $53 = ((($0)) + 9|0);
 $54 = HEAP8[$53>>0]|0;
 $55 = ((($1)) + 9|0);
 $56 = HEAP8[$55>>0]|0;
 $57 = $56 ^ $54;
 $58 = $52 | $57;
 $59 = ((($0)) + 10|0);
 $60 = HEAP8[$59>>0]|0;
 $61 = ((($1)) + 10|0);
 $62 = HEAP8[$61>>0]|0;
 $63 = $62 ^ $60;
 $64 = $58 | $63;
 $65 = ((($0)) + 11|0);
 $66 = HEAP8[$65>>0]|0;
 $67 = ((($1)) + 11|0);
 $68 = HEAP8[$67>>0]|0;
 $69 = $68 ^ $66;
 $70 = $64 | $69;
 $71 = ((($0)) + 12|0);
 $72 = HEAP8[$71>>0]|0;
 $73 = ((($1)) + 12|0);
 $74 = HEAP8[$73>>0]|0;
 $75 = $74 ^ $72;
 $76 = $70 | $75;
 $77 = ((($0)) + 13|0);
 $78 = HEAP8[$77>>0]|0;
 $79 = ((($1)) + 13|0);
 $80 = HEAP8[$79>>0]|0;
 $81 = $80 ^ $78;
 $82 = $76 | $81;
 $83 = ((($0)) + 14|0);
 $84 = HEAP8[$83>>0]|0;
 $85 = ((($1)) + 14|0);
 $86 = HEAP8[$85>>0]|0;
 $87 = $86 ^ $84;
 $88 = $82 | $87;
 $89 = ((($0)) + 15|0);
 $90 = HEAP8[$89>>0]|0;
 $91 = ((($1)) + 15|0);
 $92 = HEAP8[$91>>0]|0;
 $93 = $92 ^ $90;
 $94 = $88 | $93;
 $95 = ((($0)) + 16|0);
 $96 = HEAP8[$95>>0]|0;
 $97 = ((($1)) + 16|0);
 $98 = HEAP8[$97>>0]|0;
 $99 = $98 ^ $96;
 $100 = $94 | $99;
 $101 = ((($0)) + 17|0);
 $102 = HEAP8[$101>>0]|0;
 $103 = ((($1)) + 17|0);
 $104 = HEAP8[$103>>0]|0;
 $105 = $104 ^ $102;
 $106 = $100 | $105;
 $107 = ((($0)) + 18|0);
 $108 = HEAP8[$107>>0]|0;
 $109 = ((($1)) + 18|0);
 $110 = HEAP8[$109>>0]|0;
 $111 = $110 ^ $108;
 $112 = $106 | $111;
 $113 = ((($0)) + 19|0);
 $114 = HEAP8[$113>>0]|0;
 $115 = ((($1)) + 19|0);
 $116 = HEAP8[$115>>0]|0;
 $117 = $116 ^ $114;
 $118 = $112 | $117;
 $119 = ((($0)) + 20|0);
 $120 = HEAP8[$119>>0]|0;
 $121 = ((($1)) + 20|0);
 $122 = HEAP8[$121>>0]|0;
 $123 = $122 ^ $120;
 $124 = $118 | $123;
 $125 = ((($0)) + 21|0);
 $126 = HEAP8[$125>>0]|0;
 $127 = ((($1)) + 21|0);
 $128 = HEAP8[$127>>0]|0;
 $129 = $128 ^ $126;
 $130 = $124 | $129;
 $131 = ((($0)) + 22|0);
 $132 = HEAP8[$131>>0]|0;
 $133 = ((($1)) + 22|0);
 $134 = HEAP8[$133>>0]|0;
 $135 = $134 ^ $132;
 $136 = $130 | $135;
 $137 = ((($0)) + 23|0);
 $138 = HEAP8[$137>>0]|0;
 $139 = ((($1)) + 23|0);
 $140 = HEAP8[$139>>0]|0;
 $141 = $140 ^ $138;
 $142 = $136 | $141;
 $143 = ((($0)) + 24|0);
 $144 = HEAP8[$143>>0]|0;
 $145 = ((($1)) + 24|0);
 $146 = HEAP8[$145>>0]|0;
 $147 = $146 ^ $144;
 $148 = $142 | $147;
 $149 = ((($0)) + 25|0);
 $150 = HEAP8[$149>>0]|0;
 $151 = ((($1)) + 25|0);
 $152 = HEAP8[$151>>0]|0;
 $153 = $152 ^ $150;
 $154 = $148 | $153;
 $155 = ((($0)) + 26|0);
 $156 = HEAP8[$155>>0]|0;
 $157 = ((($1)) + 26|0);
 $158 = HEAP8[$157>>0]|0;
 $159 = $158 ^ $156;
 $160 = $154 | $159;
 $161 = ((($0)) + 27|0);
 $162 = HEAP8[$161>>0]|0;
 $163 = ((($1)) + 27|0);
 $164 = HEAP8[$163>>0]|0;
 $165 = $164 ^ $162;
 $166 = $160 | $165;
 $167 = ((($0)) + 28|0);
 $168 = HEAP8[$167>>0]|0;
 $169 = ((($1)) + 28|0);
 $170 = HEAP8[$169>>0]|0;
 $171 = $170 ^ $168;
 $172 = $166 | $171;
 $173 = ((($0)) + 29|0);
 $174 = HEAP8[$173>>0]|0;
 $175 = ((($1)) + 29|0);
 $176 = HEAP8[$175>>0]|0;
 $177 = $176 ^ $174;
 $178 = $172 | $177;
 $179 = ((($0)) + 30|0);
 $180 = HEAP8[$179>>0]|0;
 $181 = ((($1)) + 30|0);
 $182 = HEAP8[$181>>0]|0;
 $183 = $182 ^ $180;
 $184 = $178 | $183;
 $185 = ((($0)) + 31|0);
 $186 = HEAP8[$185>>0]|0;
 $187 = ((($1)) + 31|0);
 $188 = HEAP8[$187>>0]|0;
 $189 = $188 ^ $186;
 $190 = $184 | $189;
 $191 = $190&255;
 $192 = (($191) + 511)|0;
 $193 = $192 >>> 8;
 $194 = $193 & 1;
 $195 = (($194) + -1)|0;
 return ($195|0);
}
function _curve25519_sign($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$alloca_mul = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0;
 var sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0;
 $4 = sp + 8|0;
 $5 = sp + 168|0;
 $6 = sp;
 $7 = (($3) + 64)|0;
 $8 = (_llvm_stacksave()|0);
 $$alloca_mul = $7;
 $9 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0;;
 $10 = $6;
 $11 = $10;
 HEAP32[$11>>2] = 0;
 $12 = (($10) + 4)|0;
 $13 = $12;
 HEAP32[$13>>2] = 0;
 dest=$5; src=$1; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 _crypto_sign_ed25519_ref10_ge_scalarmult_base($4,$1);
 $14 = ((($5)) + 32|0);
 _crypto_sign_ed25519_ref10_ge_p3_tobytes($14,$4);
 $15 = ((($5)) + 63|0);
 $16 = HEAP8[$15>>0]|0;
 $17 = $16 & -128;
 (_crypto_sign_modified($9,$6,$2,$3,0,$5)|0);
 dest=$0; src=$9; stop=dest+64|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 $18 = ((($0)) + 63|0);
 $19 = HEAP8[$18>>0]|0;
 $20 = $19 | $17;
 HEAP8[$18>>0] = $20;
 _llvm_stackrestore(($8|0));
 STACKTOP = sp;return;
}
function _curve25519_verify($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$alloca_mul = 0, $$alloca_mul9 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 288|0;
 $4 = sp + 208|0;
 $5 = sp + 168|0;
 $6 = sp + 128|0;
 $7 = sp + 88|0;
 $8 = sp + 48|0;
 $9 = sp + 8|0;
 $10 = sp + 248|0;
 $11 = sp;
 $12 = (($3) + 64)|0;
 $13 = (_llvm_stacksave()|0);
 $$alloca_mul = $12;
 $14 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0;;
 $$alloca_mul9 = $12;
 $15 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul9)|0)+15)&-16)|0;;
 _crypto_sign_ed25519_ref10_fe_frombytes($4,$1);
 _crypto_sign_ed25519_ref10_fe_1($8);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$8);
 _crypto_sign_ed25519_ref10_fe_add($6,$4,$8);
 _crypto_sign_ed25519_ref10_fe_invert($7,$6);
 _crypto_sign_ed25519_ref10_fe_mul($9,$5,$7);
 _crypto_sign_ed25519_ref10_fe_tobytes($10,$9);
 $16 = ((($0)) + 63|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17 & -128;
 $19 = ((($10)) + 31|0);
 $20 = HEAP8[$19>>0]|0;
 $21 = $20 | $18;
 HEAP8[$19>>0] = $21;
 $22 = $17 & 127;
 HEAP8[$16>>0] = $22;
 dest=$14; src=$0; stop=dest+64|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 $23 = ((($14)) + 64|0);
 _memcpy(($23|0),($2|0),($3|0))|0;
 $24 = (_crypto_sign_edwards25519sha512batch_ref10_open($15,$11,$14,$12,0,$10)|0);
 _llvm_stackrestore(($13|0));
 STACKTOP = sp;return ($24|0);
}
function _crypto_hash_sha512_ref($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0;
 $4 = sp;
 _sph_sha512_init($4);
 _sph_sha384($4,$1,$2);
 _sph_sha512_close($4,$0);
 STACKTOP = sp;return 0;
}
function _crypto_sign_modified($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 320|0;
 $6 = sp + 288|0;
 $7 = sp + 224|0;
 $8 = sp + 160|0;
 $9 = sp;
 $10 = ((($5)) + 32|0);
 dest=$6; src=$10; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 $11 = (_i64Add(($3|0),($4|0),64,0)|0);
 $12 = tempRet0;
 $13 = $1;
 $14 = $13;
 HEAP32[$14>>2] = $11;
 $15 = (($13) + 4)|0;
 $16 = $15;
 HEAP32[$16>>2] = $12;
 $17 = ((($0)) + 64|0);
 _memmove(($17|0),($2|0),($3|0))|0;
 $18 = ((($0)) + 32|0);
 _memmove(($18|0),($5|0),32)|0;
 $19 = (_i64Add(($3|0),($4|0),32,0)|0);
 $20 = tempRet0;
 (_crypto_hash_sha512_ref($7,$18,$19,$20)|0);
 dest=$18; src=$6; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 _crypto_sign_ed25519_ref10_sc_reduce($7);
 _crypto_sign_ed25519_ref10_ge_scalarmult_base($9,$7);
 _crypto_sign_ed25519_ref10_ge_p3_tobytes($0,$9);
 (_crypto_hash_sha512_ref($8,$0,$11,$12)|0);
 _crypto_sign_ed25519_ref10_sc_reduce($8);
 _crypto_sign_ed25519_ref10_sc_muladd($18,$8,$5,$7);
 STACKTOP = sp;return 0;
}
function _curve25519_donna($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 368|0;
 $3 = sp + 248|0;
 $4 = sp + 168|0;
 $5 = sp + 80|0;
 $6 = sp;
 $7 = sp + 328|0;
 dest=$7; src=$1; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 _fexpand($3,$2);
 _cmult($4,$5,$7,$3);
 _crecip($6,$5);
 _fmul($5,$4,$6);
 _fcontract($0,$5);
 STACKTOP = sp;return 0;
}
function _fexpand($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2&255;
 $4 = ((($1)) + 1|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5&255;
 $7 = (_bitshift64Shl(($6|0),0,8)|0);
 $8 = tempRet0;
 $9 = $7 | $3;
 $10 = ((($1)) + 2|0);
 $11 = HEAP8[$10>>0]|0;
 $12 = $11&255;
 $13 = (_bitshift64Shl(($12|0),0,16)|0);
 $14 = tempRet0;
 $15 = $9 | $13;
 $16 = $8 | $14;
 $17 = ((($1)) + 3|0);
 $18 = HEAP8[$17>>0]|0;
 $19 = $18&255;
 $20 = (_bitshift64Shl(($19|0),0,24)|0);
 $21 = tempRet0;
 $22 = $20 & 50331648;
 $23 = $15 | $22;
 $24 = $0;
 $25 = $24;
 HEAP32[$25>>2] = $23;
 $26 = (($24) + 4)|0;
 $27 = $26;
 HEAP32[$27>>2] = $16;
 $28 = HEAP8[$17>>0]|0;
 $29 = $28&255;
 $30 = ((($1)) + 4|0);
 $31 = HEAP8[$30>>0]|0;
 $32 = $31&255;
 $33 = (_bitshift64Shl(($32|0),0,8)|0);
 $34 = tempRet0;
 $35 = $33 | $29;
 $36 = ((($1)) + 5|0);
 $37 = HEAP8[$36>>0]|0;
 $38 = $37&255;
 $39 = (_bitshift64Shl(($38|0),0,16)|0);
 $40 = tempRet0;
 $41 = $35 | $39;
 $42 = $34 | $40;
 $43 = ((($1)) + 6|0);
 $44 = HEAP8[$43>>0]|0;
 $45 = $44&255;
 $46 = (_bitshift64Shl(($45|0),0,24)|0);
 $47 = tempRet0;
 $48 = $41 | $46;
 $49 = $42 | $47;
 $50 = (_bitshift64Lshr(($48|0),($49|0),2)|0);
 $51 = tempRet0;
 $52 = $50 & 33554431;
 $53 = ((($0)) + 8|0);
 $54 = $53;
 $55 = $54;
 HEAP32[$55>>2] = $52;
 $56 = (($54) + 4)|0;
 $57 = $56;
 HEAP32[$57>>2] = 0;
 $58 = HEAP8[$43>>0]|0;
 $59 = $58&255;
 $60 = ((($1)) + 7|0);
 $61 = HEAP8[$60>>0]|0;
 $62 = $61&255;
 $63 = (_bitshift64Shl(($62|0),0,8)|0);
 $64 = tempRet0;
 $65 = $63 | $59;
 $66 = ((($1)) + 8|0);
 $67 = HEAP8[$66>>0]|0;
 $68 = $67&255;
 $69 = (_bitshift64Shl(($68|0),0,16)|0);
 $70 = tempRet0;
 $71 = $65 | $69;
 $72 = $64 | $70;
 $73 = ((($1)) + 9|0);
 $74 = HEAP8[$73>>0]|0;
 $75 = $74&255;
 $76 = (_bitshift64Shl(($75|0),0,24)|0);
 $77 = tempRet0;
 $78 = $71 | $76;
 $79 = $72 | $77;
 $80 = (_bitshift64Lshr(($78|0),($79|0),3)|0);
 $81 = tempRet0;
 $82 = $80 & 67108863;
 $83 = ((($0)) + 16|0);
 $84 = $83;
 $85 = $84;
 HEAP32[$85>>2] = $82;
 $86 = (($84) + 4)|0;
 $87 = $86;
 HEAP32[$87>>2] = 0;
 $88 = HEAP8[$73>>0]|0;
 $89 = $88&255;
 $90 = ((($1)) + 10|0);
 $91 = HEAP8[$90>>0]|0;
 $92 = $91&255;
 $93 = (_bitshift64Shl(($92|0),0,8)|0);
 $94 = tempRet0;
 $95 = $93 | $89;
 $96 = ((($1)) + 11|0);
 $97 = HEAP8[$96>>0]|0;
 $98 = $97&255;
 $99 = (_bitshift64Shl(($98|0),0,16)|0);
 $100 = tempRet0;
 $101 = $95 | $99;
 $102 = $94 | $100;
 $103 = ((($1)) + 12|0);
 $104 = HEAP8[$103>>0]|0;
 $105 = $104&255;
 $106 = (_bitshift64Shl(($105|0),0,24)|0);
 $107 = tempRet0;
 $108 = $101 | $106;
 $109 = $102 | $107;
 $110 = (_bitshift64Lshr(($108|0),($109|0),5)|0);
 $111 = tempRet0;
 $112 = $110 & 33554431;
 $113 = ((($0)) + 24|0);
 $114 = $113;
 $115 = $114;
 HEAP32[$115>>2] = $112;
 $116 = (($114) + 4)|0;
 $117 = $116;
 HEAP32[$117>>2] = 0;
 $118 = HEAP8[$103>>0]|0;
 $119 = $118&255;
 $120 = ((($1)) + 13|0);
 $121 = HEAP8[$120>>0]|0;
 $122 = $121&255;
 $123 = (_bitshift64Shl(($122|0),0,8)|0);
 $124 = tempRet0;
 $125 = $123 | $119;
 $126 = ((($1)) + 14|0);
 $127 = HEAP8[$126>>0]|0;
 $128 = $127&255;
 $129 = (_bitshift64Shl(($128|0),0,16)|0);
 $130 = tempRet0;
 $131 = $125 | $129;
 $132 = $124 | $130;
 $133 = ((($1)) + 15|0);
 $134 = HEAP8[$133>>0]|0;
 $135 = $134&255;
 $136 = (_bitshift64Shl(($135|0),0,24)|0);
 $137 = tempRet0;
 $138 = $131 | $136;
 $139 = $132 | $137;
 $140 = (_bitshift64Lshr(($138|0),($139|0),6)|0);
 $141 = tempRet0;
 $142 = $140 & 67108863;
 $143 = ((($0)) + 32|0);
 $144 = $143;
 $145 = $144;
 HEAP32[$145>>2] = $142;
 $146 = (($144) + 4)|0;
 $147 = $146;
 HEAP32[$147>>2] = 0;
 $148 = ((($1)) + 16|0);
 $149 = HEAP8[$148>>0]|0;
 $150 = $149&255;
 $151 = ((($1)) + 17|0);
 $152 = HEAP8[$151>>0]|0;
 $153 = $152&255;
 $154 = (_bitshift64Shl(($153|0),0,8)|0);
 $155 = tempRet0;
 $156 = $154 | $150;
 $157 = ((($1)) + 18|0);
 $158 = HEAP8[$157>>0]|0;
 $159 = $158&255;
 $160 = (_bitshift64Shl(($159|0),0,16)|0);
 $161 = tempRet0;
 $162 = $156 | $160;
 $163 = $155 | $161;
 $164 = ((($1)) + 19|0);
 $165 = HEAP8[$164>>0]|0;
 $166 = $165&255;
 $167 = (_bitshift64Shl(($166|0),0,24)|0);
 $168 = tempRet0;
 $169 = $167 & 16777216;
 $170 = $162 | $169;
 $171 = ((($0)) + 40|0);
 $172 = $171;
 $173 = $172;
 HEAP32[$173>>2] = $170;
 $174 = (($172) + 4)|0;
 $175 = $174;
 HEAP32[$175>>2] = $163;
 $176 = HEAP8[$164>>0]|0;
 $177 = $176&255;
 $178 = ((($1)) + 20|0);
 $179 = HEAP8[$178>>0]|0;
 $180 = $179&255;
 $181 = (_bitshift64Shl(($180|0),0,8)|0);
 $182 = tempRet0;
 $183 = $181 | $177;
 $184 = ((($1)) + 21|0);
 $185 = HEAP8[$184>>0]|0;
 $186 = $185&255;
 $187 = (_bitshift64Shl(($186|0),0,16)|0);
 $188 = tempRet0;
 $189 = $183 | $187;
 $190 = $182 | $188;
 $191 = ((($1)) + 22|0);
 $192 = HEAP8[$191>>0]|0;
 $193 = $192&255;
 $194 = (_bitshift64Shl(($193|0),0,24)|0);
 $195 = tempRet0;
 $196 = $189 | $194;
 $197 = $190 | $195;
 $198 = (_bitshift64Lshr(($196|0),($197|0),1)|0);
 $199 = tempRet0;
 $200 = $198 & 67108863;
 $201 = ((($0)) + 48|0);
 $202 = $201;
 $203 = $202;
 HEAP32[$203>>2] = $200;
 $204 = (($202) + 4)|0;
 $205 = $204;
 HEAP32[$205>>2] = 0;
 $206 = HEAP8[$191>>0]|0;
 $207 = $206&255;
 $208 = ((($1)) + 23|0);
 $209 = HEAP8[$208>>0]|0;
 $210 = $209&255;
 $211 = (_bitshift64Shl(($210|0),0,8)|0);
 $212 = tempRet0;
 $213 = $211 | $207;
 $214 = ((($1)) + 24|0);
 $215 = HEAP8[$214>>0]|0;
 $216 = $215&255;
 $217 = (_bitshift64Shl(($216|0),0,16)|0);
 $218 = tempRet0;
 $219 = $213 | $217;
 $220 = $212 | $218;
 $221 = ((($1)) + 25|0);
 $222 = HEAP8[$221>>0]|0;
 $223 = $222&255;
 $224 = (_bitshift64Shl(($223|0),0,24)|0);
 $225 = tempRet0;
 $226 = $219 | $224;
 $227 = $220 | $225;
 $228 = (_bitshift64Lshr(($226|0),($227|0),3)|0);
 $229 = tempRet0;
 $230 = $228 & 33554431;
 $231 = ((($0)) + 56|0);
 $232 = $231;
 $233 = $232;
 HEAP32[$233>>2] = $230;
 $234 = (($232) + 4)|0;
 $235 = $234;
 HEAP32[$235>>2] = 0;
 $236 = HEAP8[$221>>0]|0;
 $237 = $236&255;
 $238 = ((($1)) + 26|0);
 $239 = HEAP8[$238>>0]|0;
 $240 = $239&255;
 $241 = (_bitshift64Shl(($240|0),0,8)|0);
 $242 = tempRet0;
 $243 = $241 | $237;
 $244 = ((($1)) + 27|0);
 $245 = HEAP8[$244>>0]|0;
 $246 = $245&255;
 $247 = (_bitshift64Shl(($246|0),0,16)|0);
 $248 = tempRet0;
 $249 = $243 | $247;
 $250 = $242 | $248;
 $251 = ((($1)) + 28|0);
 $252 = HEAP8[$251>>0]|0;
 $253 = $252&255;
 $254 = (_bitshift64Shl(($253|0),0,24)|0);
 $255 = tempRet0;
 $256 = $249 | $254;
 $257 = $250 | $255;
 $258 = (_bitshift64Lshr(($256|0),($257|0),4)|0);
 $259 = tempRet0;
 $260 = $258 & 67108863;
 $261 = ((($0)) + 64|0);
 $262 = $261;
 $263 = $262;
 HEAP32[$263>>2] = $260;
 $264 = (($262) + 4)|0;
 $265 = $264;
 HEAP32[$265>>2] = 0;
 $266 = HEAP8[$251>>0]|0;
 $267 = $266&255;
 $268 = ((($1)) + 29|0);
 $269 = HEAP8[$268>>0]|0;
 $270 = $269&255;
 $271 = (_bitshift64Shl(($270|0),0,8)|0);
 $272 = tempRet0;
 $273 = $271 | $267;
 $274 = ((($1)) + 30|0);
 $275 = HEAP8[$274>>0]|0;
 $276 = $275&255;
 $277 = (_bitshift64Shl(($276|0),0,16)|0);
 $278 = tempRet0;
 $279 = $273 | $277;
 $280 = $272 | $278;
 $281 = ((($1)) + 31|0);
 $282 = HEAP8[$281>>0]|0;
 $283 = $282&255;
 $284 = (_bitshift64Shl(($283|0),0,24)|0);
 $285 = tempRet0;
 $286 = $279 | $284;
 $287 = $280 | $285;
 $288 = (_bitshift64Lshr(($286|0),($287|0),6)|0);
 $289 = tempRet0;
 $290 = $288 & 33554431;
 $291 = ((($0)) + 72|0);
 $292 = $291;
 $293 = $292;
 HEAP32[$293>>2] = $290;
 $294 = (($292) + 4)|0;
 $295 = $294;
 HEAP32[$295>>2] = 0;
 return;
}
function _cmult($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0104 = 0, $$06994 = 0, $$07093 = 0, $$071103 = 0, $$072102 = 0, $$074101 = 0, $$076100 = 0, $$07899 = 0, $$08098 = 0, $$08297 = 0, $$08496 = 0, $$17392 = 0, $$17392$phi = 0, $$17591 = 0, $$17591$phi = 0, $$17790 = 0, $$17790$phi = 0, $$17989 = 0, $$17989$phi = 0, $$18188 = 0;
 var $$18188$phi = 0, $$18387 = 0, $$18387$phi = 0, $$18586 = 0, $$18586$phi = 0, $$195 = 0, $$195$phi = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, $exitcond105 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 1216|0;
 $4 = sp + 1064|0;
 $5 = sp + 912|0;
 $6 = sp + 760|0;
 $7 = sp + 608|0;
 $8 = sp + 456|0;
 $9 = sp + 304|0;
 $10 = sp + 152|0;
 $11 = sp;
 $12 = ((($5)) + 8|0);
 _memset(($12|0),0,144)|0;
 $13 = $5;
 $14 = $13;
 HEAP32[$14>>2] = 1;
 $15 = (($13) + 4)|0;
 $16 = $15;
 HEAP32[$16>>2] = 0;
 $17 = ((($6)) + 8|0);
 _memset(($17|0),0,144)|0;
 $18 = $6;
 $19 = $18;
 HEAP32[$19>>2] = 1;
 $20 = (($18) + 4)|0;
 $21 = $20;
 HEAP32[$21>>2] = 0;
 _memset(($7|0),0,152)|0;
 _memset(($8|0),0,152)|0;
 $22 = ((($9)) + 8|0);
 _memset(($22|0),0,144)|0;
 $23 = $9;
 $24 = $23;
 HEAP32[$24>>2] = 1;
 $25 = (($23) + 4)|0;
 $26 = $25;
 HEAP32[$26>>2] = 0;
 _memset(($10|0),0,152)|0;
 $27 = ((($11)) + 8|0);
 _memset(($27|0),0,144)|0;
 $28 = $11;
 $29 = $28;
 HEAP32[$29>>2] = 1;
 $30 = (($28) + 4)|0;
 $31 = $30;
 HEAP32[$31>>2] = 0;
 $32 = ((($4)) + 80|0);
 dest=$32; stop=dest+72|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 dest=$4; src=$3; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $$0104 = $4;$$071103 = 0;$$072102 = $11;$$074101 = $10;$$076100 = $9;$$07899 = $8;$$08098 = $5;$$08297 = $7;$$08496 = $6;
 while(1) {
  $33 = (31 - ($$071103))|0;
  $34 = (($2) + ($33)|0);
  $35 = HEAP8[$34>>0]|0;
  $$06994 = $35;$$07093 = 0;$$17392 = $$072102;$$17591 = $$074101;$$17790 = $$076100;$$17989 = $$07899;$$18188 = $$08098;$$18387 = $$08297;$$18586 = $$08496;$$195 = $$0104;
  while(1) {
   $36 = $$06994&255;
   $37 = $36 >>> 7;
   _swap_conditional($$18586,$$195,$37,0);
   _swap_conditional($$18387,$$18188,$37,0);
   _fmonty($$17591,$$17392,$$17989,$$17790,$$18586,$$18387,$$195,$$18188,$3);
   _swap_conditional($$17591,$$17989,$37,0);
   _swap_conditional($$17392,$$17790,$37,0);
   $38 = $36 << 1;
   $39 = $38&255;
   $40 = (($$07093) + 1)|0;
   $exitcond = ($40|0)==(8);
   if ($exitcond) {
    break;
   } else {
    $$195$phi = $$17989;$$18586$phi = $$17591;$$18387$phi = $$17392;$$18188$phi = $$17790;$$17989$phi = $$195;$$17790$phi = $$18188;$$17591$phi = $$18586;$$17392$phi = $$18387;$$06994 = $39;$$07093 = $40;$$195 = $$195$phi;$$18586 = $$18586$phi;$$18387 = $$18387$phi;$$18188 = $$18188$phi;$$17989 = $$17989$phi;$$17790 = $$17790$phi;$$17591 = $$17591$phi;$$17392 = $$17392$phi;
   }
  }
  $41 = (($$071103) + 1)|0;
  $exitcond105 = ($41|0)==(32);
  if ($exitcond105) {
   break;
  } else {
   $$0104 = $$17989;$$071103 = $41;$$072102 = $$18387;$$074101 = $$18586;$$076100 = $$18188;$$07899 = $$195;$$08098 = $$17790;$$08297 = $$17392;$$08496 = $$17591;
  }
 }
 dest=$0; src=$$17591; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 dest=$1; src=$$17392; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _crecip($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$317 = 0, $$416 = 0, $$515 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 800|0;
 $2 = sp + 720|0;
 $3 = sp + 640|0;
 $4 = sp + 560|0;
 $5 = sp + 480|0;
 $6 = sp + 400|0;
 $7 = sp + 320|0;
 $8 = sp + 240|0;
 $9 = sp + 160|0;
 $10 = sp + 80|0;
 $11 = sp;
 _fsquare($2,$1);
 _fsquare($11,$2);
 _fsquare($10,$11);
 _fmul($3,$10,$1);
 _fmul($4,$3,$2);
 _fsquare($10,$4);
 _fmul($5,$10,$3);
 _fsquare($10,$5);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fmul($6,$10,$5);
 _fsquare($10,$6);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fmul($7,$11,$6);
 _fsquare($10,$7);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fmul($10,$11,$7);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fmul($8,$10,$6);
 _fsquare($10,$8);
 _fsquare($11,$10);
 $$317 = 2;
 while(1) {
  _fsquare($10,$11);
  _fsquare($11,$10);
  $12 = (($$317) + 2)|0;
  $13 = ($12|0)<(50);
  if ($13) {
   $$317 = $12;
  } else {
   break;
  }
 }
 _fmul($9,$11,$8);
 _fsquare($11,$9);
 _fsquare($10,$11);
 $$416 = 2;
 while(1) {
  _fsquare($11,$10);
  _fsquare($10,$11);
  $14 = (($$416) + 2)|0;
  $15 = ($14|0)<(100);
  if ($15) {
   $$416 = $14;
  } else {
   break;
  }
 }
 _fmul($11,$10,$9);
 _fsquare($10,$11);
 _fsquare($11,$10);
 $$515 = 2;
 while(1) {
  _fsquare($10,$11);
  _fsquare($11,$10);
  $16 = (($$515) + 2)|0;
  $17 = ($16|0)<(50);
  if ($17) {
   $$515 = $16;
  } else {
   break;
  }
 }
 _fmul($10,$11,$8);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fsquare($10,$11);
 _fsquare($11,$10);
 _fmul($0,$11,$4);
 STACKTOP = sp;return;
}
function _fmul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $3 = sp;
 _fproduct($3,$1,$2);
 _freduce_degree($3);
 _freduce_coefficients($3);
 dest=$0; src=$3; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _fcontract($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0135149 = 0, $$1136 = 0, $$3150 = 0, $$promoted = 0, $$promoted163 = 0, $$promoted165 = 0, $$promoted167 = 0, $$promoted169 = 0, $$promoted171 = 0, $$promoted173 = 0, $$promoted175 = 0, $$promoted177 = 0, $$promoted179 = 0, $$sink141 = 0, $$sink141$1 = 0, $$sink141$1$1 = 0, $$sink141$1199 = 0, $$sink141$2 = 0, $$sink141$2$1 = 0, $$sink141$3 = 0;
 var $$sink141$3$1 = 0, $$sink141$4 = 0, $$sink141$4$1 = 0, $$sink141$5 = 0, $$sink141$5$1 = 0, $$sink141$6 = 0, $$sink141$6$1 = 0, $$sink141$7 = 0, $$sink141$7$1 = 0, $$sink141$8 = 0, $$sink141$8$1 = 0, $$sink3 = 0, $$sink3$1 = 0, $$sink3$2 = 0, $$sink3$3 = 0, $$sink3$4 = 0, $$sink3$5 = 0, $$sink3$6 = 0, $$sink3$7 = 0, $$sink3$8 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0;
 var $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0;
 var $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0;
 var $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0;
 var $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0;
 var $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $2 = sp;
 $3 = $1;
 $4 = $3;
 $5 = HEAP32[$4>>2]|0;
 $6 = (($3) + 4)|0;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 HEAP32[$2>>2] = $5;
 $9 = ((($1)) + 8|0);
 $10 = $9;
 $11 = $10;
 $12 = HEAP32[$11>>2]|0;
 $13 = (($10) + 4)|0;
 $14 = $13;
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($2)) + 4|0);
 HEAP32[$16>>2] = $12;
 $17 = ((($1)) + 16|0);
 $18 = $17;
 $19 = $18;
 $20 = HEAP32[$19>>2]|0;
 $21 = (($18) + 4)|0;
 $22 = $21;
 $23 = HEAP32[$22>>2]|0;
 $24 = ((($2)) + 8|0);
 HEAP32[$24>>2] = $20;
 $25 = ((($1)) + 24|0);
 $26 = $25;
 $27 = $26;
 $28 = HEAP32[$27>>2]|0;
 $29 = (($26) + 4)|0;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = ((($2)) + 12|0);
 HEAP32[$32>>2] = $28;
 $33 = ((($1)) + 32|0);
 $34 = $33;
 $35 = $34;
 $36 = HEAP32[$35>>2]|0;
 $37 = (($34) + 4)|0;
 $38 = $37;
 $39 = HEAP32[$38>>2]|0;
 $40 = ((($2)) + 16|0);
 HEAP32[$40>>2] = $36;
 $41 = ((($1)) + 40|0);
 $42 = $41;
 $43 = $42;
 $44 = HEAP32[$43>>2]|0;
 $45 = (($42) + 4)|0;
 $46 = $45;
 $47 = HEAP32[$46>>2]|0;
 $48 = ((($2)) + 20|0);
 HEAP32[$48>>2] = $44;
 $49 = ((($1)) + 48|0);
 $50 = $49;
 $51 = $50;
 $52 = HEAP32[$51>>2]|0;
 $53 = (($50) + 4)|0;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = ((($2)) + 24|0);
 HEAP32[$56>>2] = $52;
 $57 = ((($1)) + 56|0);
 $58 = $57;
 $59 = $58;
 $60 = HEAP32[$59>>2]|0;
 $61 = (($58) + 4)|0;
 $62 = $61;
 $63 = HEAP32[$62>>2]|0;
 $64 = ((($2)) + 28|0);
 HEAP32[$64>>2] = $60;
 $65 = ((($1)) + 64|0);
 $66 = $65;
 $67 = $66;
 $68 = HEAP32[$67>>2]|0;
 $69 = (($66) + 4)|0;
 $70 = $69;
 $71 = HEAP32[$70>>2]|0;
 $72 = ((($2)) + 32|0);
 HEAP32[$72>>2] = $68;
 $73 = ((($1)) + 72|0);
 $74 = $73;
 $75 = $74;
 $76 = HEAP32[$75>>2]|0;
 $77 = (($74) + 4)|0;
 $78 = $77;
 $79 = HEAP32[$78>>2]|0;
 $80 = ((($2)) + 36|0);
 HEAP32[$80>>2] = $76;
 $81 = ((($2)) + 4|0);
 $82 = ((($2)) + 8|0);
 $83 = ((($2)) + 12|0);
 $84 = ((($2)) + 16|0);
 $85 = ((($2)) + 20|0);
 $86 = ((($2)) + 24|0);
 $87 = ((($2)) + 28|0);
 $88 = ((($2)) + 32|0);
 $89 = ((($2)) + 36|0);
 $$promoted163 = HEAP32[$2>>2]|0;
 $$promoted179 = HEAP32[$89>>2]|0;
 $$promoted177 = HEAP32[$88>>2]|0;
 $$promoted175 = HEAP32[$87>>2]|0;
 $$promoted173 = HEAP32[$86>>2]|0;
 $$promoted171 = HEAP32[$85>>2]|0;
 $$promoted169 = HEAP32[$84>>2]|0;
 $$promoted167 = HEAP32[$83>>2]|0;
 $$promoted165 = HEAP32[$82>>2]|0;
 $$promoted = HEAP32[$81>>2]|0;
 $90 = $$promoted163 >> 31;
 $91 = $90 & $$promoted163;
 $$sink141 = $91 >> 26;
 $92 = (0 - ($$sink141))|0;
 $93 = $92 << 26;
 $94 = (($93) + ($$promoted163))|0;
 $95 = (($$sink141) + ($$promoted))|0;
 $96 = $95 >> 31;
 $97 = $96 & $95;
 $$sink141$1 = $97 >> 25;
 $98 = (0 - ($$sink141$1))|0;
 $99 = $98 << 25;
 $100 = (($99) + ($95))|0;
 $101 = (($$sink141$1) + ($$promoted165))|0;
 $102 = $101 >> 31;
 $103 = $102 & $101;
 $$sink141$2 = $103 >> 26;
 $104 = (0 - ($$sink141$2))|0;
 $105 = $104 << 26;
 $106 = (($105) + ($101))|0;
 $107 = (($$sink141$2) + ($$promoted167))|0;
 $108 = $107 >> 31;
 $109 = $108 & $107;
 $$sink141$3 = $109 >> 25;
 $110 = (0 - ($$sink141$3))|0;
 $111 = $110 << 25;
 $112 = (($111) + ($107))|0;
 $113 = (($$sink141$3) + ($$promoted169))|0;
 $114 = $113 >> 31;
 $115 = $114 & $113;
 $$sink141$4 = $115 >> 26;
 $116 = (0 - ($$sink141$4))|0;
 $117 = $116 << 26;
 $118 = (($117) + ($113))|0;
 $119 = (($$sink141$4) + ($$promoted171))|0;
 $120 = $119 >> 31;
 $121 = $120 & $119;
 $$sink141$5 = $121 >> 25;
 $122 = (0 - ($$sink141$5))|0;
 $123 = $122 << 25;
 $124 = (($123) + ($119))|0;
 $125 = (($$sink141$5) + ($$promoted173))|0;
 $126 = $125 >> 31;
 $127 = $126 & $125;
 $$sink141$6 = $127 >> 26;
 $128 = (0 - ($$sink141$6))|0;
 $129 = $128 << 26;
 $130 = (($129) + ($125))|0;
 $131 = (($$sink141$6) + ($$promoted175))|0;
 $132 = $131 >> 31;
 $133 = $132 & $131;
 $$sink141$7 = $133 >> 25;
 $134 = (0 - ($$sink141$7))|0;
 $135 = $134 << 25;
 $136 = (($135) + ($131))|0;
 $137 = (($$sink141$7) + ($$promoted177))|0;
 $138 = $137 >> 31;
 $139 = $138 & $137;
 $$sink141$8 = $139 >> 26;
 $140 = (0 - ($$sink141$8))|0;
 $141 = $140 << 26;
 $142 = (($141) + ($137))|0;
 $143 = (($$sink141$8) + ($$promoted179))|0;
 $144 = $143 >> 31;
 $145 = $144 & $143;
 $146 = $145 >> 25;
 $147 = Math_imul($146, -33554432)|0;
 $148 = (($147) + ($143))|0;
 $149 = ($146*19)|0;
 $150 = (($149) + ($94))|0;
 $151 = $150 >> 31;
 $152 = $151 & $150;
 $$sink141$1199 = $152 >> 26;
 $153 = (0 - ($$sink141$1199))|0;
 $154 = $153 << 26;
 $155 = (($154) + ($150))|0;
 $156 = (($$sink141$1199) + ($100))|0;
 $157 = $156 >> 31;
 $158 = $157 & $156;
 $$sink141$1$1 = $158 >> 25;
 $159 = (0 - ($$sink141$1$1))|0;
 $160 = $159 << 25;
 $161 = (($160) + ($156))|0;
 $162 = (($$sink141$1$1) + ($106))|0;
 $163 = $162 >> 31;
 $164 = $163 & $162;
 $$sink141$2$1 = $164 >> 26;
 $165 = (0 - ($$sink141$2$1))|0;
 $166 = $165 << 26;
 $167 = (($166) + ($162))|0;
 $168 = (($$sink141$2$1) + ($112))|0;
 $169 = $168 >> 31;
 $170 = $169 & $168;
 $$sink141$3$1 = $170 >> 25;
 $171 = (0 - ($$sink141$3$1))|0;
 $172 = $171 << 25;
 $173 = (($172) + ($168))|0;
 $174 = (($$sink141$3$1) + ($118))|0;
 $175 = $174 >> 31;
 $176 = $175 & $174;
 $$sink141$4$1 = $176 >> 26;
 $177 = (0 - ($$sink141$4$1))|0;
 $178 = $177 << 26;
 $179 = (($178) + ($174))|0;
 $180 = (($$sink141$4$1) + ($124))|0;
 $181 = $180 >> 31;
 $182 = $181 & $180;
 $$sink141$5$1 = $182 >> 25;
 $183 = (0 - ($$sink141$5$1))|0;
 $184 = $183 << 25;
 $185 = (($184) + ($180))|0;
 $186 = (($$sink141$5$1) + ($130))|0;
 $187 = $186 >> 31;
 $188 = $187 & $186;
 $$sink141$6$1 = $188 >> 26;
 $189 = (0 - ($$sink141$6$1))|0;
 $190 = $189 << 26;
 $191 = (($190) + ($186))|0;
 $192 = (($$sink141$6$1) + ($136))|0;
 $193 = $192 >> 31;
 $194 = $193 & $192;
 $$sink141$7$1 = $194 >> 25;
 $195 = (0 - ($$sink141$7$1))|0;
 $196 = $195 << 25;
 $197 = (($196) + ($192))|0;
 $198 = (($$sink141$7$1) + ($142))|0;
 $199 = $198 >> 31;
 $200 = $199 & $198;
 $$sink141$8$1 = $200 >> 26;
 $201 = (0 - ($$sink141$8$1))|0;
 $202 = $201 << 26;
 $203 = (($202) + ($198))|0;
 $204 = (($$sink141$8$1) + ($148))|0;
 $205 = $204 >> 31;
 $206 = $205 & $204;
 $207 = $206 >> 25;
 $208 = Math_imul($207, -33554432)|0;
 $209 = (($208) + ($204))|0;
 $210 = ($207*19)|0;
 $211 = (($210) + ($155))|0;
 HEAP32[$81>>2] = $161;
 HEAP32[$2>>2] = $211;
 HEAP32[$82>>2] = $167;
 HEAP32[$83>>2] = $173;
 HEAP32[$84>>2] = $179;
 HEAP32[$85>>2] = $185;
 HEAP32[$86>>2] = $191;
 HEAP32[$87>>2] = $197;
 HEAP32[$88>>2] = $203;
 HEAP32[$89>>2] = $209;
 $212 = HEAP32[$2>>2]|0;
 $213 = $212 >> 31;
 $214 = $213 & $212;
 $215 = $214 >> 26;
 $216 = Math_imul($215, -67108864)|0;
 $217 = (($216) + ($212))|0;
 HEAP32[$2>>2] = $217;
 $218 = ((($2)) + 4|0);
 $219 = HEAP32[$218>>2]|0;
 $220 = (($215) + ($219))|0;
 HEAP32[$218>>2] = $220;
 $221 = ((($2)) + 36|0);
 $222 = HEAP32[$2>>2]|0;
 $223 = $222 >> 26;
 $224 = $222 & 67108863;
 HEAP32[$2>>2] = $224;
 $225 = (($220) + ($223))|0;
 $226 = ((($2)) + 4|0);
 $227 = ((($2)) + 8|0);
 $228 = HEAP32[$227>>2]|0;
 $229 = $225 >> 25;
 $230 = $225 & 33554431;
 HEAP32[$226>>2] = $230;
 $231 = (($228) + ($229))|0;
 $232 = ((($2)) + 8|0);
 $233 = ((($2)) + 12|0);
 $234 = HEAP32[$233>>2]|0;
 $235 = $231 >> 26;
 $236 = $231 & 67108863;
 HEAP32[$232>>2] = $236;
 $237 = (($234) + ($235))|0;
 $238 = ((($2)) + 12|0);
 $239 = ((($2)) + 16|0);
 $240 = HEAP32[$239>>2]|0;
 $241 = $237 >> 25;
 $242 = $237 & 33554431;
 HEAP32[$238>>2] = $242;
 $243 = (($240) + ($241))|0;
 $244 = ((($2)) + 16|0);
 $245 = ((($2)) + 20|0);
 $246 = HEAP32[$245>>2]|0;
 $247 = $243 >> 26;
 $248 = $243 & 67108863;
 HEAP32[$244>>2] = $248;
 $249 = (($246) + ($247))|0;
 $250 = ((($2)) + 20|0);
 $251 = ((($2)) + 24|0);
 $252 = HEAP32[$251>>2]|0;
 $253 = $249 >> 25;
 $254 = $249 & 33554431;
 HEAP32[$250>>2] = $254;
 $255 = (($252) + ($253))|0;
 $256 = ((($2)) + 24|0);
 $257 = ((($2)) + 28|0);
 $258 = HEAP32[$257>>2]|0;
 $259 = $255 >> 26;
 $260 = $255 & 67108863;
 HEAP32[$256>>2] = $260;
 $261 = (($258) + ($259))|0;
 $262 = ((($2)) + 28|0);
 $263 = ((($2)) + 32|0);
 $264 = HEAP32[$263>>2]|0;
 $265 = $261 >> 25;
 $266 = $261 & 33554431;
 HEAP32[$262>>2] = $266;
 $267 = (($264) + ($265))|0;
 $268 = ((($2)) + 32|0);
 $269 = ((($2)) + 36|0);
 $270 = HEAP32[$269>>2]|0;
 $271 = $267 >> 26;
 $272 = $267 & 67108863;
 HEAP32[$268>>2] = $272;
 $273 = (($270) + ($271))|0;
 $274 = $273 >> 25;
 $275 = $273 & 33554431;
 HEAP32[$221>>2] = $275;
 $276 = ($274*19)|0;
 $277 = HEAP32[$2>>2]|0;
 $278 = (($277) + ($276))|0;
 HEAP32[$2>>2] = $278;
 $279 = ((($2)) + 4|0);
 $280 = HEAP32[$279>>2]|0;
 $281 = $278 >> 26;
 $282 = $278 & 67108863;
 HEAP32[$2>>2] = $282;
 $283 = (($280) + ($281))|0;
 $284 = ((($2)) + 4|0);
 $285 = ((($2)) + 8|0);
 $286 = HEAP32[$285>>2]|0;
 $287 = $283 >> 25;
 $288 = $283 & 33554431;
 HEAP32[$284>>2] = $288;
 $289 = (($286) + ($287))|0;
 $290 = ((($2)) + 8|0);
 $291 = ((($2)) + 12|0);
 $292 = HEAP32[$291>>2]|0;
 $293 = $289 >> 26;
 $294 = $289 & 67108863;
 HEAP32[$290>>2] = $294;
 $295 = (($292) + ($293))|0;
 $296 = ((($2)) + 12|0);
 $297 = ((($2)) + 16|0);
 $298 = HEAP32[$297>>2]|0;
 $299 = $295 >> 25;
 $300 = $295 & 33554431;
 HEAP32[$296>>2] = $300;
 $301 = (($298) + ($299))|0;
 $302 = ((($2)) + 16|0);
 $303 = ((($2)) + 20|0);
 $304 = HEAP32[$303>>2]|0;
 $305 = $301 >> 26;
 $306 = $301 & 67108863;
 HEAP32[$302>>2] = $306;
 $307 = (($304) + ($305))|0;
 $308 = ((($2)) + 20|0);
 $309 = ((($2)) + 24|0);
 $310 = HEAP32[$309>>2]|0;
 $311 = $307 >> 25;
 $312 = $307 & 33554431;
 HEAP32[$308>>2] = $312;
 $313 = (($310) + ($311))|0;
 $314 = ((($2)) + 24|0);
 $315 = ((($2)) + 28|0);
 $316 = HEAP32[$315>>2]|0;
 $317 = $313 >> 26;
 $318 = $313 & 67108863;
 HEAP32[$314>>2] = $318;
 $319 = (($316) + ($317))|0;
 $320 = ((($2)) + 28|0);
 $321 = ((($2)) + 32|0);
 $322 = HEAP32[$321>>2]|0;
 $323 = $319 >> 25;
 $324 = $319 & 33554431;
 HEAP32[$320>>2] = $324;
 $325 = (($322) + ($323))|0;
 $326 = ((($2)) + 32|0);
 $327 = ((($2)) + 36|0);
 $328 = HEAP32[$327>>2]|0;
 $329 = $325 >> 26;
 $330 = $325 & 67108863;
 HEAP32[$326>>2] = $330;
 $331 = (($328) + ($329))|0;
 $332 = $331 >> 25;
 $333 = $331 & 33554431;
 HEAP32[$221>>2] = $333;
 $334 = ($332*19)|0;
 $335 = HEAP32[$2>>2]|0;
 $336 = (($335) + ($334))|0;
 HEAP32[$2>>2] = $336;
 $337 = (_s32_gte($336)|0);
 $$0135149 = $337;$$3150 = 1;
 while(1) {
  $338 = (($2) + ($$3150<<2)|0);
  $339 = HEAP32[$338>>2]|0;
  $340 = $$3150 << 25;
  $341 = $340 & 33554432;
  $342 = $341 ^ 67108863;
  $343 = (_s32_eq($339,$342)|0);
  $$1136 = $343 & $$0135149;
  $344 = (($$3150) + 1)|0;
  $exitcond = ($344|0)==(10);
  if ($exitcond) {
   break;
  } else {
   $$0135149 = $$1136;$$3150 = $344;
  }
 }
 $345 = $$1136 & 67108845;
 $346 = HEAP32[$2>>2]|0;
 $347 = (($346) - ($345))|0;
 HEAP32[$2>>2] = $347;
 $$sink3 = $$1136 & 33554431;
 $348 = ((($2)) + 4|0);
 $349 = HEAP32[$348>>2]|0;
 $350 = (($349) - ($$sink3))|0;
 HEAP32[$348>>2] = $350;
 $$sink3$1 = $$1136 & 67108863;
 $351 = ((($2)) + 8|0);
 $352 = HEAP32[$351>>2]|0;
 $353 = (($352) - ($$sink3$1))|0;
 HEAP32[$351>>2] = $353;
 $$sink3$2 = $$1136 & 33554431;
 $354 = ((($2)) + 12|0);
 $355 = HEAP32[$354>>2]|0;
 $356 = (($355) - ($$sink3$2))|0;
 HEAP32[$354>>2] = $356;
 $$sink3$3 = $$1136 & 67108863;
 $357 = ((($2)) + 16|0);
 $358 = HEAP32[$357>>2]|0;
 $359 = (($358) - ($$sink3$3))|0;
 HEAP32[$357>>2] = $359;
 $$sink3$4 = $$1136 & 33554431;
 $360 = ((($2)) + 20|0);
 $361 = HEAP32[$360>>2]|0;
 $362 = (($361) - ($$sink3$4))|0;
 HEAP32[$360>>2] = $362;
 $$sink3$5 = $$1136 & 67108863;
 $363 = ((($2)) + 24|0);
 $364 = HEAP32[$363>>2]|0;
 $365 = (($364) - ($$sink3$5))|0;
 HEAP32[$363>>2] = $365;
 $$sink3$6 = $$1136 & 33554431;
 $366 = ((($2)) + 28|0);
 $367 = HEAP32[$366>>2]|0;
 $368 = (($367) - ($$sink3$6))|0;
 HEAP32[$366>>2] = $368;
 $$sink3$7 = $$1136 & 67108863;
 $369 = ((($2)) + 32|0);
 $370 = HEAP32[$369>>2]|0;
 $371 = (($370) - ($$sink3$7))|0;
 HEAP32[$369>>2] = $371;
 $$sink3$8 = $$1136 & 33554431;
 $372 = ((($2)) + 36|0);
 $373 = HEAP32[$372>>2]|0;
 $374 = (($373) - ($$sink3$8))|0;
 HEAP32[$372>>2] = $374;
 $375 = HEAP32[$218>>2]|0;
 $376 = $375 << 2;
 HEAP32[$218>>2] = $376;
 $377 = ((($2)) + 8|0);
 $378 = HEAP32[$377>>2]|0;
 $379 = $378 << 3;
 HEAP32[$377>>2] = $379;
 $380 = ((($2)) + 12|0);
 $381 = HEAP32[$380>>2]|0;
 $382 = $381 << 5;
 HEAP32[$380>>2] = $382;
 $383 = ((($2)) + 16|0);
 $384 = HEAP32[$383>>2]|0;
 $385 = $384 << 6;
 HEAP32[$383>>2] = $385;
 $386 = ((($2)) + 24|0);
 $387 = HEAP32[$386>>2]|0;
 $388 = $387 << 1;
 HEAP32[$386>>2] = $388;
 $389 = ((($2)) + 28|0);
 $390 = HEAP32[$389>>2]|0;
 $391 = $390 << 3;
 HEAP32[$389>>2] = $391;
 $392 = ((($2)) + 32|0);
 $393 = HEAP32[$392>>2]|0;
 $394 = $393 << 4;
 HEAP32[$392>>2] = $394;
 $395 = ((($2)) + 36|0);
 $396 = HEAP32[$395>>2]|0;
 $397 = $396 << 6;
 HEAP32[$395>>2] = $397;
 $398 = ((($0)) + 16|0);
 HEAP8[$398>>0] = 0;
 $399 = HEAP32[$2>>2]|0;
 $400 = $399&255;
 HEAP8[$0>>0] = $400;
 $401 = $399 >>> 8;
 $402 = $401&255;
 $403 = ((($0)) + 1|0);
 HEAP8[$403>>0] = $402;
 $404 = $399 >>> 16;
 $405 = $404&255;
 $406 = ((($0)) + 2|0);
 HEAP8[$406>>0] = $405;
 $407 = $399 >>> 24;
 $408 = ((($0)) + 3|0);
 $409 = HEAP32[$218>>2]|0;
 $410 = $409 | $407;
 $411 = $410&255;
 HEAP8[$408>>0] = $411;
 $412 = $409 >>> 8;
 $413 = $412&255;
 $414 = ((($0)) + 4|0);
 HEAP8[$414>>0] = $413;
 $415 = $409 >>> 16;
 $416 = $415&255;
 $417 = ((($0)) + 5|0);
 HEAP8[$417>>0] = $416;
 $418 = $409 >>> 24;
 $419 = ((($0)) + 6|0);
 $420 = HEAP32[$377>>2]|0;
 $421 = $420 | $418;
 $422 = $421&255;
 HEAP8[$419>>0] = $422;
 $423 = $420 >>> 8;
 $424 = $423&255;
 $425 = ((($0)) + 7|0);
 HEAP8[$425>>0] = $424;
 $426 = $420 >>> 16;
 $427 = $426&255;
 $428 = ((($0)) + 8|0);
 HEAP8[$428>>0] = $427;
 $429 = $420 >>> 24;
 $430 = ((($0)) + 9|0);
 $431 = HEAP32[$380>>2]|0;
 $432 = $431 | $429;
 $433 = $432&255;
 HEAP8[$430>>0] = $433;
 $434 = $431 >>> 8;
 $435 = $434&255;
 $436 = ((($0)) + 10|0);
 HEAP8[$436>>0] = $435;
 $437 = HEAP32[$380>>2]|0;
 $438 = $437 >>> 16;
 $439 = $438&255;
 $440 = ((($0)) + 11|0);
 HEAP8[$440>>0] = $439;
 $441 = $437 >>> 24;
 $442 = ((($0)) + 12|0);
 $443 = HEAP32[$383>>2]|0;
 $444 = $443 | $441;
 $445 = $444&255;
 HEAP8[$442>>0] = $445;
 $446 = $443 >>> 8;
 $447 = $446&255;
 $448 = ((($0)) + 13|0);
 HEAP8[$448>>0] = $447;
 $449 = HEAP32[$383>>2]|0;
 $450 = $449 >>> 16;
 $451 = $450&255;
 $452 = ((($0)) + 14|0);
 HEAP8[$452>>0] = $451;
 $453 = $449 >>> 24;
 $454 = $453&255;
 $455 = ((($0)) + 15|0);
 HEAP8[$455>>0] = $454;
 $456 = ((($2)) + 20|0);
 $457 = HEAP32[$456>>2]|0;
 $458 = HEAP8[$398>>0]|0;
 $459 = $458&255;
 $460 = $459 | $457;
 $461 = $460&255;
 HEAP8[$398>>0] = $461;
 $462 = $457 >>> 8;
 $463 = $462&255;
 $464 = ((($0)) + 17|0);
 HEAP8[$464>>0] = $463;
 $465 = HEAP32[$456>>2]|0;
 $466 = $465 >>> 16;
 $467 = $466&255;
 $468 = ((($0)) + 18|0);
 HEAP8[$468>>0] = $467;
 $469 = $465 >>> 24;
 $470 = ((($0)) + 19|0);
 $471 = HEAP32[$386>>2]|0;
 $472 = $471 | $469;
 $473 = $472&255;
 HEAP8[$470>>0] = $473;
 $474 = $471 >>> 8;
 $475 = $474&255;
 $476 = ((($0)) + 20|0);
 HEAP8[$476>>0] = $475;
 $477 = HEAP32[$386>>2]|0;
 $478 = $477 >>> 16;
 $479 = $478&255;
 $480 = ((($0)) + 21|0);
 HEAP8[$480>>0] = $479;
 $481 = $477 >>> 24;
 $482 = ((($0)) + 22|0);
 $483 = HEAP32[$389>>2]|0;
 $484 = $483 | $481;
 $485 = $484&255;
 HEAP8[$482>>0] = $485;
 $486 = $483 >>> 8;
 $487 = $486&255;
 $488 = ((($0)) + 23|0);
 HEAP8[$488>>0] = $487;
 $489 = HEAP32[$389>>2]|0;
 $490 = $489 >>> 16;
 $491 = $490&255;
 $492 = ((($0)) + 24|0);
 HEAP8[$492>>0] = $491;
 $493 = $489 >>> 24;
 $494 = ((($0)) + 25|0);
 $495 = HEAP32[$392>>2]|0;
 $496 = $495 | $493;
 $497 = $496&255;
 HEAP8[$494>>0] = $497;
 $498 = $495 >>> 8;
 $499 = $498&255;
 $500 = ((($0)) + 26|0);
 HEAP8[$500>>0] = $499;
 $501 = HEAP32[$392>>2]|0;
 $502 = $501 >>> 16;
 $503 = $502&255;
 $504 = ((($0)) + 27|0);
 HEAP8[$504>>0] = $503;
 $505 = $501 >>> 24;
 $506 = ((($0)) + 28|0);
 $507 = HEAP32[$395>>2]|0;
 $508 = $507 | $505;
 $509 = $508&255;
 HEAP8[$506>>0] = $509;
 $510 = $507 >>> 8;
 $511 = $510&255;
 $512 = ((($0)) + 29|0);
 HEAP8[$512>>0] = $511;
 $513 = HEAP32[$395>>2]|0;
 $514 = $513 >>> 16;
 $515 = $514&255;
 $516 = ((($0)) + 30|0);
 HEAP8[$516>>0] = $515;
 $517 = $513 >>> 24;
 $518 = $517&255;
 $519 = ((($0)) + 31|0);
 HEAP8[$519>>0] = $518;
 STACKTOP = sp;return;
}
function _s32_gte($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -67108845)|0;
 $2 = $1 >> 31;
 $3 = $2 ^ -1;
 return ($3|0);
}
function _s32_eq($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $0 ^ -1;
 $3 = $2 ^ $1;
 $4 = $3 << 16;
 $5 = $4 & $3;
 $6 = $5 << 8;
 $7 = $6 & $5;
 $8 = $7 << 4;
 $9 = $8 & $7;
 $10 = $9 << 2;
 $11 = $10 & $9;
 $12 = $11 << 1;
 $13 = $12 & $11;
 $14 = $13 >> 31;
 return ($14|0);
}
function _fproduct($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0;
 var $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0;
 var $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0;
 var $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0;
 var $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0;
 var $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0;
 var $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0;
 var $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0;
 var $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0, $1213 = 0, $1214 = 0;
 var $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0;
 var $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0;
 var $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0;
 var $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0, $1287 = 0;
 var $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0;
 var $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0, $1322 = 0;
 var $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0;
 var $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0;
 var $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0;
 var $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0, $1395 = 0;
 var $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0;
 var $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0;
 var $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0;
 var $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0;
 var $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0;
 var $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0;
 var $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0, $1520 = 0;
 var $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0, $1539 = 0;
 var $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0, $1557 = 0;
 var $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0, $1575 = 0;
 var $1576 = 0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0, $1593 = 0;
 var $1594 = 0, $1595 = 0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0, $1610 = 0;
 var $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0, $1629 = 0;
 var $163 = 0, $1630 = 0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0, $1647 = 0;
 var $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0, $1665 = 0;
 var $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0, $1683 = 0;
 var $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0, $1700 = 0;
 var $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0, $1719 = 0;
 var $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0, $1737 = 0;
 var $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0, $1755 = 0;
 var $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0, $1773 = 0;
 var $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0, $1791 = 0;
 var $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0, $1809 = 0;
 var $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0, $1827 = 0;
 var $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0, $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0, $1845 = 0;
 var $1846 = 0, $1847 = 0, $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0, $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0, $1863 = 0;
 var $1864 = 0, $1865 = 0, $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0, $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0, $1881 = 0;
 var $1882 = 0, $1883 = 0, $1884 = 0, $1885 = 0, $1886 = 0, $1887 = 0, $1888 = 0, $1889 = 0, $189 = 0, $1890 = 0, $1891 = 0, $1892 = 0, $1893 = 0, $1894 = 0, $1895 = 0, $1896 = 0, $1897 = 0, $1898 = 0, $1899 = 0, $19 = 0;
 var $190 = 0, $1900 = 0, $1901 = 0, $1902 = 0, $1903 = 0, $1904 = 0, $1905 = 0, $1906 = 0, $1907 = 0, $1908 = 0, $1909 = 0, $191 = 0, $1910 = 0, $1911 = 0, $1912 = 0, $1913 = 0, $1914 = 0, $1915 = 0, $1916 = 0, $1917 = 0;
 var $1918 = 0, $1919 = 0, $192 = 0, $1920 = 0, $1921 = 0, $1922 = 0, $1923 = 0, $1924 = 0, $1925 = 0, $1926 = 0, $1927 = 0, $1928 = 0, $1929 = 0, $193 = 0, $1930 = 0, $1931 = 0, $1932 = 0, $1933 = 0, $1934 = 0, $1935 = 0;
 var $1936 = 0, $1937 = 0, $1938 = 0, $1939 = 0, $194 = 0, $1940 = 0, $1941 = 0, $1942 = 0, $1943 = 0, $1944 = 0, $1945 = 0, $1946 = 0, $1947 = 0, $1948 = 0, $1949 = 0, $195 = 0, $1950 = 0, $1951 = 0, $1952 = 0, $1953 = 0;
 var $1954 = 0, $1955 = 0, $1956 = 0, $1957 = 0, $1958 = 0, $1959 = 0, $196 = 0, $1960 = 0, $1961 = 0, $1962 = 0, $1963 = 0, $1964 = 0, $1965 = 0, $1966 = 0, $1967 = 0, $1968 = 0, $1969 = 0, $197 = 0, $1970 = 0, $1971 = 0;
 var $1972 = 0, $1973 = 0, $1974 = 0, $1975 = 0, $1976 = 0, $1977 = 0, $1978 = 0, $1979 = 0, $198 = 0, $1980 = 0, $1981 = 0, $1982 = 0, $1983 = 0, $1984 = 0, $1985 = 0, $1986 = 0, $1987 = 0, $1988 = 0, $1989 = 0, $199 = 0;
 var $1990 = 0, $1991 = 0, $1992 = 0, $1993 = 0, $1994 = 0, $1995 = 0, $1996 = 0, $1997 = 0, $1998 = 0, $1999 = 0, $20 = 0, $200 = 0, $2000 = 0, $2001 = 0, $2002 = 0, $2003 = 0, $2004 = 0, $2005 = 0, $2006 = 0, $2007 = 0;
 var $2008 = 0, $2009 = 0, $201 = 0, $2010 = 0, $2011 = 0, $2012 = 0, $2013 = 0, $2014 = 0, $2015 = 0, $2016 = 0, $2017 = 0, $2018 = 0, $2019 = 0, $202 = 0, $2020 = 0, $2021 = 0, $2022 = 0, $2023 = 0, $2024 = 0, $2025 = 0;
 var $2026 = 0, $2027 = 0, $2028 = 0, $2029 = 0, $203 = 0, $2030 = 0, $2031 = 0, $2032 = 0, $2033 = 0, $2034 = 0, $2035 = 0, $2036 = 0, $2037 = 0, $2038 = 0, $2039 = 0, $204 = 0, $2040 = 0, $2041 = 0, $2042 = 0, $2043 = 0;
 var $2044 = 0, $2045 = 0, $2046 = 0, $2047 = 0, $2048 = 0, $2049 = 0, $205 = 0, $2050 = 0, $2051 = 0, $2052 = 0, $2053 = 0, $2054 = 0, $2055 = 0, $2056 = 0, $2057 = 0, $2058 = 0, $2059 = 0, $206 = 0, $2060 = 0, $2061 = 0;
 var $2062 = 0, $2063 = 0, $2064 = 0, $2065 = 0, $2066 = 0, $2067 = 0, $2068 = 0, $2069 = 0, $207 = 0, $2070 = 0, $2071 = 0, $2072 = 0, $2073 = 0, $2074 = 0, $2075 = 0, $2076 = 0, $2077 = 0, $2078 = 0, $2079 = 0, $208 = 0;
 var $2080 = 0, $2081 = 0, $2082 = 0, $2083 = 0, $2084 = 0, $2085 = 0, $2086 = 0, $2087 = 0, $2088 = 0, $2089 = 0, $209 = 0, $2090 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0;
 var $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0;
 var $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0;
 var $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0;
 var $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0;
 var $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0;
 var $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0;
 var $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0;
 var $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0;
 var $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0;
 var $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0;
 var $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0;
 var $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0;
 var $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0;
 var $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0;
 var $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0;
 var $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0;
 var $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0;
 var $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0;
 var $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0;
 var $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0;
 var $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0;
 var $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0;
 var $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0;
 var $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0;
 var $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0;
 var $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0;
 var $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0;
 var $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0;
 var $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0;
 var $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0;
 var $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0;
 var $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0;
 var $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0;
 var $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0;
 var $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0;
 var $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0;
 var $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0;
 var $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0;
 var $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0;
 var $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0;
 var $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0;
 var $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0;
 var $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0;
 var $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1;
 $4 = $3;
 $5 = HEAP32[$4>>2]|0;
 $6 = (($3) + 4)|0;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $9 = (_bitshift64Ashr(0,($5|0),32)|0);
 $10 = tempRet0;
 $11 = $2;
 $12 = $11;
 $13 = HEAP32[$12>>2]|0;
 $14 = (($11) + 4)|0;
 $15 = $14;
 $16 = HEAP32[$15>>2]|0;
 $17 = (_bitshift64Ashr(0,($13|0),32)|0);
 $18 = tempRet0;
 $19 = (___muldi3(($17|0),($18|0),($9|0),($10|0))|0);
 $20 = tempRet0;
 $21 = $0;
 $22 = $21;
 HEAP32[$22>>2] = $19;
 $23 = (($21) + 4)|0;
 $24 = $23;
 HEAP32[$24>>2] = $20;
 $25 = $1;
 $26 = $25;
 $27 = HEAP32[$26>>2]|0;
 $28 = (($25) + 4)|0;
 $29 = $28;
 $30 = HEAP32[$29>>2]|0;
 $31 = (_bitshift64Ashr(0,($27|0),32)|0);
 $32 = tempRet0;
 $33 = ((($2)) + 8|0);
 $34 = $33;
 $35 = $34;
 $36 = HEAP32[$35>>2]|0;
 $37 = (($34) + 4)|0;
 $38 = $37;
 $39 = HEAP32[$38>>2]|0;
 $40 = (_bitshift64Ashr(0,($36|0),32)|0);
 $41 = tempRet0;
 $42 = (___muldi3(($40|0),($41|0),($31|0),($32|0))|0);
 $43 = tempRet0;
 $44 = ((($1)) + 8|0);
 $45 = $44;
 $46 = $45;
 $47 = HEAP32[$46>>2]|0;
 $48 = (($45) + 4)|0;
 $49 = $48;
 $50 = HEAP32[$49>>2]|0;
 $51 = (_bitshift64Ashr(0,($47|0),32)|0);
 $52 = tempRet0;
 $53 = $2;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = (($53) + 4)|0;
 $57 = $56;
 $58 = HEAP32[$57>>2]|0;
 $59 = (_bitshift64Ashr(0,($55|0),32)|0);
 $60 = tempRet0;
 $61 = (___muldi3(($59|0),($60|0),($51|0),($52|0))|0);
 $62 = tempRet0;
 $63 = (_i64Add(($61|0),($62|0),($42|0),($43|0))|0);
 $64 = tempRet0;
 $65 = ((($0)) + 8|0);
 $66 = $65;
 $67 = $66;
 HEAP32[$67>>2] = $63;
 $68 = (($66) + 4)|0;
 $69 = $68;
 HEAP32[$69>>2] = $64;
 $70 = $44;
 $71 = $70;
 $72 = HEAP32[$71>>2]|0;
 $73 = (($70) + 4)|0;
 $74 = $73;
 $75 = HEAP32[$74>>2]|0;
 $76 = (_bitshift64Ashr(0,($72|0),31)|0);
 $77 = tempRet0;
 $78 = $33;
 $79 = $78;
 $80 = HEAP32[$79>>2]|0;
 $81 = (($78) + 4)|0;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (_bitshift64Ashr(0,($80|0),32)|0);
 $85 = tempRet0;
 $86 = (___muldi3(($84|0),($85|0),($76|0),($77|0))|0);
 $87 = tempRet0;
 $88 = $1;
 $89 = $88;
 $90 = HEAP32[$89>>2]|0;
 $91 = (($88) + 4)|0;
 $92 = $91;
 $93 = HEAP32[$92>>2]|0;
 $94 = (_bitshift64Ashr(0,($90|0),32)|0);
 $95 = tempRet0;
 $96 = ((($2)) + 16|0);
 $97 = $96;
 $98 = $97;
 $99 = HEAP32[$98>>2]|0;
 $100 = (($97) + 4)|0;
 $101 = $100;
 $102 = HEAP32[$101>>2]|0;
 $103 = (_bitshift64Ashr(0,($99|0),32)|0);
 $104 = tempRet0;
 $105 = (___muldi3(($103|0),($104|0),($94|0),($95|0))|0);
 $106 = tempRet0;
 $107 = (_i64Add(($105|0),($106|0),($86|0),($87|0))|0);
 $108 = tempRet0;
 $109 = ((($1)) + 16|0);
 $110 = $109;
 $111 = $110;
 $112 = HEAP32[$111>>2]|0;
 $113 = (($110) + 4)|0;
 $114 = $113;
 $115 = HEAP32[$114>>2]|0;
 $116 = (_bitshift64Ashr(0,($112|0),32)|0);
 $117 = tempRet0;
 $118 = $2;
 $119 = $118;
 $120 = HEAP32[$119>>2]|0;
 $121 = (($118) + 4)|0;
 $122 = $121;
 $123 = HEAP32[$122>>2]|0;
 $124 = (_bitshift64Ashr(0,($120|0),32)|0);
 $125 = tempRet0;
 $126 = (___muldi3(($124|0),($125|0),($116|0),($117|0))|0);
 $127 = tempRet0;
 $128 = (_i64Add(($107|0),($108|0),($126|0),($127|0))|0);
 $129 = tempRet0;
 $130 = ((($0)) + 16|0);
 $131 = $130;
 $132 = $131;
 HEAP32[$132>>2] = $128;
 $133 = (($131) + 4)|0;
 $134 = $133;
 HEAP32[$134>>2] = $129;
 $135 = $44;
 $136 = $135;
 $137 = HEAP32[$136>>2]|0;
 $138 = (($135) + 4)|0;
 $139 = $138;
 $140 = HEAP32[$139>>2]|0;
 $141 = (_bitshift64Ashr(0,($137|0),32)|0);
 $142 = tempRet0;
 $143 = $96;
 $144 = $143;
 $145 = HEAP32[$144>>2]|0;
 $146 = (($143) + 4)|0;
 $147 = $146;
 $148 = HEAP32[$147>>2]|0;
 $149 = (_bitshift64Ashr(0,($145|0),32)|0);
 $150 = tempRet0;
 $151 = (___muldi3(($149|0),($150|0),($141|0),($142|0))|0);
 $152 = tempRet0;
 $153 = $109;
 $154 = $153;
 $155 = HEAP32[$154>>2]|0;
 $156 = (($153) + 4)|0;
 $157 = $156;
 $158 = HEAP32[$157>>2]|0;
 $159 = (_bitshift64Ashr(0,($155|0),32)|0);
 $160 = tempRet0;
 $161 = $33;
 $162 = $161;
 $163 = HEAP32[$162>>2]|0;
 $164 = (($161) + 4)|0;
 $165 = $164;
 $166 = HEAP32[$165>>2]|0;
 $167 = (_bitshift64Ashr(0,($163|0),32)|0);
 $168 = tempRet0;
 $169 = (___muldi3(($167|0),($168|0),($159|0),($160|0))|0);
 $170 = tempRet0;
 $171 = (_i64Add(($169|0),($170|0),($151|0),($152|0))|0);
 $172 = tempRet0;
 $173 = $1;
 $174 = $173;
 $175 = HEAP32[$174>>2]|0;
 $176 = (($173) + 4)|0;
 $177 = $176;
 $178 = HEAP32[$177>>2]|0;
 $179 = (_bitshift64Ashr(0,($175|0),32)|0);
 $180 = tempRet0;
 $181 = ((($2)) + 24|0);
 $182 = $181;
 $183 = $182;
 $184 = HEAP32[$183>>2]|0;
 $185 = (($182) + 4)|0;
 $186 = $185;
 $187 = HEAP32[$186>>2]|0;
 $188 = (_bitshift64Ashr(0,($184|0),32)|0);
 $189 = tempRet0;
 $190 = (___muldi3(($188|0),($189|0),($179|0),($180|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($171|0),($172|0),($190|0),($191|0))|0);
 $193 = tempRet0;
 $194 = ((($1)) + 24|0);
 $195 = $194;
 $196 = $195;
 $197 = HEAP32[$196>>2]|0;
 $198 = (($195) + 4)|0;
 $199 = $198;
 $200 = HEAP32[$199>>2]|0;
 $201 = (_bitshift64Ashr(0,($197|0),32)|0);
 $202 = tempRet0;
 $203 = $2;
 $204 = $203;
 $205 = HEAP32[$204>>2]|0;
 $206 = (($203) + 4)|0;
 $207 = $206;
 $208 = HEAP32[$207>>2]|0;
 $209 = (_bitshift64Ashr(0,($205|0),32)|0);
 $210 = tempRet0;
 $211 = (___muldi3(($209|0),($210|0),($201|0),($202|0))|0);
 $212 = tempRet0;
 $213 = (_i64Add(($192|0),($193|0),($211|0),($212|0))|0);
 $214 = tempRet0;
 $215 = ((($0)) + 24|0);
 $216 = $215;
 $217 = $216;
 HEAP32[$217>>2] = $213;
 $218 = (($216) + 4)|0;
 $219 = $218;
 HEAP32[$219>>2] = $214;
 $220 = $109;
 $221 = $220;
 $222 = HEAP32[$221>>2]|0;
 $223 = (($220) + 4)|0;
 $224 = $223;
 $225 = HEAP32[$224>>2]|0;
 $226 = (_bitshift64Ashr(0,($222|0),32)|0);
 $227 = tempRet0;
 $228 = $96;
 $229 = $228;
 $230 = HEAP32[$229>>2]|0;
 $231 = (($228) + 4)|0;
 $232 = $231;
 $233 = HEAP32[$232>>2]|0;
 $234 = (_bitshift64Ashr(0,($230|0),32)|0);
 $235 = tempRet0;
 $236 = (___muldi3(($234|0),($235|0),($226|0),($227|0))|0);
 $237 = tempRet0;
 $238 = $44;
 $239 = $238;
 $240 = HEAP32[$239>>2]|0;
 $241 = (($238) + 4)|0;
 $242 = $241;
 $243 = HEAP32[$242>>2]|0;
 $244 = (_bitshift64Ashr(0,($240|0),32)|0);
 $245 = tempRet0;
 $246 = $181;
 $247 = $246;
 $248 = HEAP32[$247>>2]|0;
 $249 = (($246) + 4)|0;
 $250 = $249;
 $251 = HEAP32[$250>>2]|0;
 $252 = (_bitshift64Ashr(0,($248|0),32)|0);
 $253 = tempRet0;
 $254 = (___muldi3(($252|0),($253|0),($244|0),($245|0))|0);
 $255 = tempRet0;
 $256 = $194;
 $257 = $256;
 $258 = HEAP32[$257>>2]|0;
 $259 = (($256) + 4)|0;
 $260 = $259;
 $261 = HEAP32[$260>>2]|0;
 $262 = (_bitshift64Ashr(0,($258|0),32)|0);
 $263 = tempRet0;
 $264 = $33;
 $265 = $264;
 $266 = HEAP32[$265>>2]|0;
 $267 = (($264) + 4)|0;
 $268 = $267;
 $269 = HEAP32[$268>>2]|0;
 $270 = (_bitshift64Ashr(0,($266|0),32)|0);
 $271 = tempRet0;
 $272 = (___muldi3(($270|0),($271|0),($262|0),($263|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($254|0),($255|0))|0);
 $275 = tempRet0;
 $276 = (_bitshift64Shl(($274|0),($275|0),1)|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($236|0),($237|0))|0);
 $279 = tempRet0;
 $280 = $1;
 $281 = $280;
 $282 = HEAP32[$281>>2]|0;
 $283 = (($280) + 4)|0;
 $284 = $283;
 $285 = HEAP32[$284>>2]|0;
 $286 = (_bitshift64Ashr(0,($282|0),32)|0);
 $287 = tempRet0;
 $288 = ((($2)) + 32|0);
 $289 = $288;
 $290 = $289;
 $291 = HEAP32[$290>>2]|0;
 $292 = (($289) + 4)|0;
 $293 = $292;
 $294 = HEAP32[$293>>2]|0;
 $295 = (_bitshift64Ashr(0,($291|0),32)|0);
 $296 = tempRet0;
 $297 = (___muldi3(($295|0),($296|0),($286|0),($287|0))|0);
 $298 = tempRet0;
 $299 = (_i64Add(($278|0),($279|0),($297|0),($298|0))|0);
 $300 = tempRet0;
 $301 = ((($1)) + 32|0);
 $302 = $301;
 $303 = $302;
 $304 = HEAP32[$303>>2]|0;
 $305 = (($302) + 4)|0;
 $306 = $305;
 $307 = HEAP32[$306>>2]|0;
 $308 = (_bitshift64Ashr(0,($304|0),32)|0);
 $309 = tempRet0;
 $310 = $2;
 $311 = $310;
 $312 = HEAP32[$311>>2]|0;
 $313 = (($310) + 4)|0;
 $314 = $313;
 $315 = HEAP32[$314>>2]|0;
 $316 = (_bitshift64Ashr(0,($312|0),32)|0);
 $317 = tempRet0;
 $318 = (___muldi3(($316|0),($317|0),($308|0),($309|0))|0);
 $319 = tempRet0;
 $320 = (_i64Add(($299|0),($300|0),($318|0),($319|0))|0);
 $321 = tempRet0;
 $322 = ((($0)) + 32|0);
 $323 = $322;
 $324 = $323;
 HEAP32[$324>>2] = $320;
 $325 = (($323) + 4)|0;
 $326 = $325;
 HEAP32[$326>>2] = $321;
 $327 = $109;
 $328 = $327;
 $329 = HEAP32[$328>>2]|0;
 $330 = (($327) + 4)|0;
 $331 = $330;
 $332 = HEAP32[$331>>2]|0;
 $333 = (_bitshift64Ashr(0,($329|0),32)|0);
 $334 = tempRet0;
 $335 = $181;
 $336 = $335;
 $337 = HEAP32[$336>>2]|0;
 $338 = (($335) + 4)|0;
 $339 = $338;
 $340 = HEAP32[$339>>2]|0;
 $341 = (_bitshift64Ashr(0,($337|0),32)|0);
 $342 = tempRet0;
 $343 = (___muldi3(($341|0),($342|0),($333|0),($334|0))|0);
 $344 = tempRet0;
 $345 = $194;
 $346 = $345;
 $347 = HEAP32[$346>>2]|0;
 $348 = (($345) + 4)|0;
 $349 = $348;
 $350 = HEAP32[$349>>2]|0;
 $351 = (_bitshift64Ashr(0,($347|0),32)|0);
 $352 = tempRet0;
 $353 = $96;
 $354 = $353;
 $355 = HEAP32[$354>>2]|0;
 $356 = (($353) + 4)|0;
 $357 = $356;
 $358 = HEAP32[$357>>2]|0;
 $359 = (_bitshift64Ashr(0,($355|0),32)|0);
 $360 = tempRet0;
 $361 = (___muldi3(($359|0),($360|0),($351|0),($352|0))|0);
 $362 = tempRet0;
 $363 = (_i64Add(($361|0),($362|0),($343|0),($344|0))|0);
 $364 = tempRet0;
 $365 = $44;
 $366 = $365;
 $367 = HEAP32[$366>>2]|0;
 $368 = (($365) + 4)|0;
 $369 = $368;
 $370 = HEAP32[$369>>2]|0;
 $371 = (_bitshift64Ashr(0,($367|0),32)|0);
 $372 = tempRet0;
 $373 = $288;
 $374 = $373;
 $375 = HEAP32[$374>>2]|0;
 $376 = (($373) + 4)|0;
 $377 = $376;
 $378 = HEAP32[$377>>2]|0;
 $379 = (_bitshift64Ashr(0,($375|0),32)|0);
 $380 = tempRet0;
 $381 = (___muldi3(($379|0),($380|0),($371|0),($372|0))|0);
 $382 = tempRet0;
 $383 = (_i64Add(($363|0),($364|0),($381|0),($382|0))|0);
 $384 = tempRet0;
 $385 = $301;
 $386 = $385;
 $387 = HEAP32[$386>>2]|0;
 $388 = (($385) + 4)|0;
 $389 = $388;
 $390 = HEAP32[$389>>2]|0;
 $391 = (_bitshift64Ashr(0,($387|0),32)|0);
 $392 = tempRet0;
 $393 = $33;
 $394 = $393;
 $395 = HEAP32[$394>>2]|0;
 $396 = (($393) + 4)|0;
 $397 = $396;
 $398 = HEAP32[$397>>2]|0;
 $399 = (_bitshift64Ashr(0,($395|0),32)|0);
 $400 = tempRet0;
 $401 = (___muldi3(($399|0),($400|0),($391|0),($392|0))|0);
 $402 = tempRet0;
 $403 = (_i64Add(($383|0),($384|0),($401|0),($402|0))|0);
 $404 = tempRet0;
 $405 = $1;
 $406 = $405;
 $407 = HEAP32[$406>>2]|0;
 $408 = (($405) + 4)|0;
 $409 = $408;
 $410 = HEAP32[$409>>2]|0;
 $411 = (_bitshift64Ashr(0,($407|0),32)|0);
 $412 = tempRet0;
 $413 = ((($2)) + 40|0);
 $414 = $413;
 $415 = $414;
 $416 = HEAP32[$415>>2]|0;
 $417 = (($414) + 4)|0;
 $418 = $417;
 $419 = HEAP32[$418>>2]|0;
 $420 = (_bitshift64Ashr(0,($416|0),32)|0);
 $421 = tempRet0;
 $422 = (___muldi3(($420|0),($421|0),($411|0),($412|0))|0);
 $423 = tempRet0;
 $424 = (_i64Add(($403|0),($404|0),($422|0),($423|0))|0);
 $425 = tempRet0;
 $426 = ((($1)) + 40|0);
 $427 = $426;
 $428 = $427;
 $429 = HEAP32[$428>>2]|0;
 $430 = (($427) + 4)|0;
 $431 = $430;
 $432 = HEAP32[$431>>2]|0;
 $433 = (_bitshift64Ashr(0,($429|0),32)|0);
 $434 = tempRet0;
 $435 = $2;
 $436 = $435;
 $437 = HEAP32[$436>>2]|0;
 $438 = (($435) + 4)|0;
 $439 = $438;
 $440 = HEAP32[$439>>2]|0;
 $441 = (_bitshift64Ashr(0,($437|0),32)|0);
 $442 = tempRet0;
 $443 = (___muldi3(($441|0),($442|0),($433|0),($434|0))|0);
 $444 = tempRet0;
 $445 = (_i64Add(($424|0),($425|0),($443|0),($444|0))|0);
 $446 = tempRet0;
 $447 = ((($0)) + 40|0);
 $448 = $447;
 $449 = $448;
 HEAP32[$449>>2] = $445;
 $450 = (($448) + 4)|0;
 $451 = $450;
 HEAP32[$451>>2] = $446;
 $452 = $194;
 $453 = $452;
 $454 = HEAP32[$453>>2]|0;
 $455 = (($452) + 4)|0;
 $456 = $455;
 $457 = HEAP32[$456>>2]|0;
 $458 = (_bitshift64Ashr(0,($454|0),32)|0);
 $459 = tempRet0;
 $460 = $181;
 $461 = $460;
 $462 = HEAP32[$461>>2]|0;
 $463 = (($460) + 4)|0;
 $464 = $463;
 $465 = HEAP32[$464>>2]|0;
 $466 = (_bitshift64Ashr(0,($462|0),32)|0);
 $467 = tempRet0;
 $468 = (___muldi3(($466|0),($467|0),($458|0),($459|0))|0);
 $469 = tempRet0;
 $470 = $44;
 $471 = $470;
 $472 = HEAP32[$471>>2]|0;
 $473 = (($470) + 4)|0;
 $474 = $473;
 $475 = HEAP32[$474>>2]|0;
 $476 = (_bitshift64Ashr(0,($472|0),32)|0);
 $477 = tempRet0;
 $478 = $413;
 $479 = $478;
 $480 = HEAP32[$479>>2]|0;
 $481 = (($478) + 4)|0;
 $482 = $481;
 $483 = HEAP32[$482>>2]|0;
 $484 = (_bitshift64Ashr(0,($480|0),32)|0);
 $485 = tempRet0;
 $486 = (___muldi3(($484|0),($485|0),($476|0),($477|0))|0);
 $487 = tempRet0;
 $488 = (_i64Add(($486|0),($487|0),($468|0),($469|0))|0);
 $489 = tempRet0;
 $490 = $426;
 $491 = $490;
 $492 = HEAP32[$491>>2]|0;
 $493 = (($490) + 4)|0;
 $494 = $493;
 $495 = HEAP32[$494>>2]|0;
 $496 = (_bitshift64Ashr(0,($492|0),32)|0);
 $497 = tempRet0;
 $498 = $33;
 $499 = $498;
 $500 = HEAP32[$499>>2]|0;
 $501 = (($498) + 4)|0;
 $502 = $501;
 $503 = HEAP32[$502>>2]|0;
 $504 = (_bitshift64Ashr(0,($500|0),32)|0);
 $505 = tempRet0;
 $506 = (___muldi3(($504|0),($505|0),($496|0),($497|0))|0);
 $507 = tempRet0;
 $508 = (_i64Add(($488|0),($489|0),($506|0),($507|0))|0);
 $509 = tempRet0;
 $510 = (_bitshift64Shl(($508|0),($509|0),1)|0);
 $511 = tempRet0;
 $512 = $109;
 $513 = $512;
 $514 = HEAP32[$513>>2]|0;
 $515 = (($512) + 4)|0;
 $516 = $515;
 $517 = HEAP32[$516>>2]|0;
 $518 = (_bitshift64Ashr(0,($514|0),32)|0);
 $519 = tempRet0;
 $520 = $288;
 $521 = $520;
 $522 = HEAP32[$521>>2]|0;
 $523 = (($520) + 4)|0;
 $524 = $523;
 $525 = HEAP32[$524>>2]|0;
 $526 = (_bitshift64Ashr(0,($522|0),32)|0);
 $527 = tempRet0;
 $528 = (___muldi3(($526|0),($527|0),($518|0),($519|0))|0);
 $529 = tempRet0;
 $530 = (_i64Add(($510|0),($511|0),($528|0),($529|0))|0);
 $531 = tempRet0;
 $532 = $301;
 $533 = $532;
 $534 = HEAP32[$533>>2]|0;
 $535 = (($532) + 4)|0;
 $536 = $535;
 $537 = HEAP32[$536>>2]|0;
 $538 = (_bitshift64Ashr(0,($534|0),32)|0);
 $539 = tempRet0;
 $540 = $96;
 $541 = $540;
 $542 = HEAP32[$541>>2]|0;
 $543 = (($540) + 4)|0;
 $544 = $543;
 $545 = HEAP32[$544>>2]|0;
 $546 = (_bitshift64Ashr(0,($542|0),32)|0);
 $547 = tempRet0;
 $548 = (___muldi3(($546|0),($547|0),($538|0),($539|0))|0);
 $549 = tempRet0;
 $550 = (_i64Add(($530|0),($531|0),($548|0),($549|0))|0);
 $551 = tempRet0;
 $552 = $1;
 $553 = $552;
 $554 = HEAP32[$553>>2]|0;
 $555 = (($552) + 4)|0;
 $556 = $555;
 $557 = HEAP32[$556>>2]|0;
 $558 = (_bitshift64Ashr(0,($554|0),32)|0);
 $559 = tempRet0;
 $560 = ((($2)) + 48|0);
 $561 = $560;
 $562 = $561;
 $563 = HEAP32[$562>>2]|0;
 $564 = (($561) + 4)|0;
 $565 = $564;
 $566 = HEAP32[$565>>2]|0;
 $567 = (_bitshift64Ashr(0,($563|0),32)|0);
 $568 = tempRet0;
 $569 = (___muldi3(($567|0),($568|0),($558|0),($559|0))|0);
 $570 = tempRet0;
 $571 = (_i64Add(($550|0),($551|0),($569|0),($570|0))|0);
 $572 = tempRet0;
 $573 = ((($1)) + 48|0);
 $574 = $573;
 $575 = $574;
 $576 = HEAP32[$575>>2]|0;
 $577 = (($574) + 4)|0;
 $578 = $577;
 $579 = HEAP32[$578>>2]|0;
 $580 = (_bitshift64Ashr(0,($576|0),32)|0);
 $581 = tempRet0;
 $582 = $2;
 $583 = $582;
 $584 = HEAP32[$583>>2]|0;
 $585 = (($582) + 4)|0;
 $586 = $585;
 $587 = HEAP32[$586>>2]|0;
 $588 = (_bitshift64Ashr(0,($584|0),32)|0);
 $589 = tempRet0;
 $590 = (___muldi3(($588|0),($589|0),($580|0),($581|0))|0);
 $591 = tempRet0;
 $592 = (_i64Add(($571|0),($572|0),($590|0),($591|0))|0);
 $593 = tempRet0;
 $594 = ((($0)) + 48|0);
 $595 = $594;
 $596 = $595;
 HEAP32[$596>>2] = $592;
 $597 = (($595) + 4)|0;
 $598 = $597;
 HEAP32[$598>>2] = $593;
 $599 = $194;
 $600 = $599;
 $601 = HEAP32[$600>>2]|0;
 $602 = (($599) + 4)|0;
 $603 = $602;
 $604 = HEAP32[$603>>2]|0;
 $605 = (_bitshift64Ashr(0,($601|0),32)|0);
 $606 = tempRet0;
 $607 = $288;
 $608 = $607;
 $609 = HEAP32[$608>>2]|0;
 $610 = (($607) + 4)|0;
 $611 = $610;
 $612 = HEAP32[$611>>2]|0;
 $613 = (_bitshift64Ashr(0,($609|0),32)|0);
 $614 = tempRet0;
 $615 = (___muldi3(($613|0),($614|0),($605|0),($606|0))|0);
 $616 = tempRet0;
 $617 = $301;
 $618 = $617;
 $619 = HEAP32[$618>>2]|0;
 $620 = (($617) + 4)|0;
 $621 = $620;
 $622 = HEAP32[$621>>2]|0;
 $623 = (_bitshift64Ashr(0,($619|0),32)|0);
 $624 = tempRet0;
 $625 = $181;
 $626 = $625;
 $627 = HEAP32[$626>>2]|0;
 $628 = (($625) + 4)|0;
 $629 = $628;
 $630 = HEAP32[$629>>2]|0;
 $631 = (_bitshift64Ashr(0,($627|0),32)|0);
 $632 = tempRet0;
 $633 = (___muldi3(($631|0),($632|0),($623|0),($624|0))|0);
 $634 = tempRet0;
 $635 = (_i64Add(($633|0),($634|0),($615|0),($616|0))|0);
 $636 = tempRet0;
 $637 = $109;
 $638 = $637;
 $639 = HEAP32[$638>>2]|0;
 $640 = (($637) + 4)|0;
 $641 = $640;
 $642 = HEAP32[$641>>2]|0;
 $643 = (_bitshift64Ashr(0,($639|0),32)|0);
 $644 = tempRet0;
 $645 = $413;
 $646 = $645;
 $647 = HEAP32[$646>>2]|0;
 $648 = (($645) + 4)|0;
 $649 = $648;
 $650 = HEAP32[$649>>2]|0;
 $651 = (_bitshift64Ashr(0,($647|0),32)|0);
 $652 = tempRet0;
 $653 = (___muldi3(($651|0),($652|0),($643|0),($644|0))|0);
 $654 = tempRet0;
 $655 = (_i64Add(($635|0),($636|0),($653|0),($654|0))|0);
 $656 = tempRet0;
 $657 = $426;
 $658 = $657;
 $659 = HEAP32[$658>>2]|0;
 $660 = (($657) + 4)|0;
 $661 = $660;
 $662 = HEAP32[$661>>2]|0;
 $663 = (_bitshift64Ashr(0,($659|0),32)|0);
 $664 = tempRet0;
 $665 = $96;
 $666 = $665;
 $667 = HEAP32[$666>>2]|0;
 $668 = (($665) + 4)|0;
 $669 = $668;
 $670 = HEAP32[$669>>2]|0;
 $671 = (_bitshift64Ashr(0,($667|0),32)|0);
 $672 = tempRet0;
 $673 = (___muldi3(($671|0),($672|0),($663|0),($664|0))|0);
 $674 = tempRet0;
 $675 = (_i64Add(($655|0),($656|0),($673|0),($674|0))|0);
 $676 = tempRet0;
 $677 = $44;
 $678 = $677;
 $679 = HEAP32[$678>>2]|0;
 $680 = (($677) + 4)|0;
 $681 = $680;
 $682 = HEAP32[$681>>2]|0;
 $683 = (_bitshift64Ashr(0,($679|0),32)|0);
 $684 = tempRet0;
 $685 = $560;
 $686 = $685;
 $687 = HEAP32[$686>>2]|0;
 $688 = (($685) + 4)|0;
 $689 = $688;
 $690 = HEAP32[$689>>2]|0;
 $691 = (_bitshift64Ashr(0,($687|0),32)|0);
 $692 = tempRet0;
 $693 = (___muldi3(($691|0),($692|0),($683|0),($684|0))|0);
 $694 = tempRet0;
 $695 = (_i64Add(($675|0),($676|0),($693|0),($694|0))|0);
 $696 = tempRet0;
 $697 = $573;
 $698 = $697;
 $699 = HEAP32[$698>>2]|0;
 $700 = (($697) + 4)|0;
 $701 = $700;
 $702 = HEAP32[$701>>2]|0;
 $703 = (_bitshift64Ashr(0,($699|0),32)|0);
 $704 = tempRet0;
 $705 = $33;
 $706 = $705;
 $707 = HEAP32[$706>>2]|0;
 $708 = (($705) + 4)|0;
 $709 = $708;
 $710 = HEAP32[$709>>2]|0;
 $711 = (_bitshift64Ashr(0,($707|0),32)|0);
 $712 = tempRet0;
 $713 = (___muldi3(($711|0),($712|0),($703|0),($704|0))|0);
 $714 = tempRet0;
 $715 = (_i64Add(($695|0),($696|0),($713|0),($714|0))|0);
 $716 = tempRet0;
 $717 = $1;
 $718 = $717;
 $719 = HEAP32[$718>>2]|0;
 $720 = (($717) + 4)|0;
 $721 = $720;
 $722 = HEAP32[$721>>2]|0;
 $723 = (_bitshift64Ashr(0,($719|0),32)|0);
 $724 = tempRet0;
 $725 = ((($2)) + 56|0);
 $726 = $725;
 $727 = $726;
 $728 = HEAP32[$727>>2]|0;
 $729 = (($726) + 4)|0;
 $730 = $729;
 $731 = HEAP32[$730>>2]|0;
 $732 = (_bitshift64Ashr(0,($728|0),32)|0);
 $733 = tempRet0;
 $734 = (___muldi3(($732|0),($733|0),($723|0),($724|0))|0);
 $735 = tempRet0;
 $736 = (_i64Add(($715|0),($716|0),($734|0),($735|0))|0);
 $737 = tempRet0;
 $738 = ((($1)) + 56|0);
 $739 = $738;
 $740 = $739;
 $741 = HEAP32[$740>>2]|0;
 $742 = (($739) + 4)|0;
 $743 = $742;
 $744 = HEAP32[$743>>2]|0;
 $745 = (_bitshift64Ashr(0,($741|0),32)|0);
 $746 = tempRet0;
 $747 = $2;
 $748 = $747;
 $749 = HEAP32[$748>>2]|0;
 $750 = (($747) + 4)|0;
 $751 = $750;
 $752 = HEAP32[$751>>2]|0;
 $753 = (_bitshift64Ashr(0,($749|0),32)|0);
 $754 = tempRet0;
 $755 = (___muldi3(($753|0),($754|0),($745|0),($746|0))|0);
 $756 = tempRet0;
 $757 = (_i64Add(($736|0),($737|0),($755|0),($756|0))|0);
 $758 = tempRet0;
 $759 = ((($0)) + 56|0);
 $760 = $759;
 $761 = $760;
 HEAP32[$761>>2] = $757;
 $762 = (($760) + 4)|0;
 $763 = $762;
 HEAP32[$763>>2] = $758;
 $764 = $301;
 $765 = $764;
 $766 = HEAP32[$765>>2]|0;
 $767 = (($764) + 4)|0;
 $768 = $767;
 $769 = HEAP32[$768>>2]|0;
 $770 = (_bitshift64Ashr(0,($766|0),32)|0);
 $771 = tempRet0;
 $772 = $288;
 $773 = $772;
 $774 = HEAP32[$773>>2]|0;
 $775 = (($772) + 4)|0;
 $776 = $775;
 $777 = HEAP32[$776>>2]|0;
 $778 = (_bitshift64Ashr(0,($774|0),32)|0);
 $779 = tempRet0;
 $780 = (___muldi3(($778|0),($779|0),($770|0),($771|0))|0);
 $781 = tempRet0;
 $782 = $194;
 $783 = $782;
 $784 = HEAP32[$783>>2]|0;
 $785 = (($782) + 4)|0;
 $786 = $785;
 $787 = HEAP32[$786>>2]|0;
 $788 = (_bitshift64Ashr(0,($784|0),32)|0);
 $789 = tempRet0;
 $790 = $413;
 $791 = $790;
 $792 = HEAP32[$791>>2]|0;
 $793 = (($790) + 4)|0;
 $794 = $793;
 $795 = HEAP32[$794>>2]|0;
 $796 = (_bitshift64Ashr(0,($792|0),32)|0);
 $797 = tempRet0;
 $798 = (___muldi3(($796|0),($797|0),($788|0),($789|0))|0);
 $799 = tempRet0;
 $800 = $426;
 $801 = $800;
 $802 = HEAP32[$801>>2]|0;
 $803 = (($800) + 4)|0;
 $804 = $803;
 $805 = HEAP32[$804>>2]|0;
 $806 = (_bitshift64Ashr(0,($802|0),32)|0);
 $807 = tempRet0;
 $808 = $181;
 $809 = $808;
 $810 = HEAP32[$809>>2]|0;
 $811 = (($808) + 4)|0;
 $812 = $811;
 $813 = HEAP32[$812>>2]|0;
 $814 = (_bitshift64Ashr(0,($810|0),32)|0);
 $815 = tempRet0;
 $816 = (___muldi3(($814|0),($815|0),($806|0),($807|0))|0);
 $817 = tempRet0;
 $818 = (_i64Add(($816|0),($817|0),($798|0),($799|0))|0);
 $819 = tempRet0;
 $820 = $44;
 $821 = $820;
 $822 = HEAP32[$821>>2]|0;
 $823 = (($820) + 4)|0;
 $824 = $823;
 $825 = HEAP32[$824>>2]|0;
 $826 = (_bitshift64Ashr(0,($822|0),32)|0);
 $827 = tempRet0;
 $828 = $725;
 $829 = $828;
 $830 = HEAP32[$829>>2]|0;
 $831 = (($828) + 4)|0;
 $832 = $831;
 $833 = HEAP32[$832>>2]|0;
 $834 = (_bitshift64Ashr(0,($830|0),32)|0);
 $835 = tempRet0;
 $836 = (___muldi3(($834|0),($835|0),($826|0),($827|0))|0);
 $837 = tempRet0;
 $838 = (_i64Add(($818|0),($819|0),($836|0),($837|0))|0);
 $839 = tempRet0;
 $840 = $738;
 $841 = $840;
 $842 = HEAP32[$841>>2]|0;
 $843 = (($840) + 4)|0;
 $844 = $843;
 $845 = HEAP32[$844>>2]|0;
 $846 = (_bitshift64Ashr(0,($842|0),32)|0);
 $847 = tempRet0;
 $848 = $33;
 $849 = $848;
 $850 = HEAP32[$849>>2]|0;
 $851 = (($848) + 4)|0;
 $852 = $851;
 $853 = HEAP32[$852>>2]|0;
 $854 = (_bitshift64Ashr(0,($850|0),32)|0);
 $855 = tempRet0;
 $856 = (___muldi3(($854|0),($855|0),($846|0),($847|0))|0);
 $857 = tempRet0;
 $858 = (_i64Add(($838|0),($839|0),($856|0),($857|0))|0);
 $859 = tempRet0;
 $860 = (_bitshift64Shl(($858|0),($859|0),1)|0);
 $861 = tempRet0;
 $862 = (_i64Add(($860|0),($861|0),($780|0),($781|0))|0);
 $863 = tempRet0;
 $864 = $109;
 $865 = $864;
 $866 = HEAP32[$865>>2]|0;
 $867 = (($864) + 4)|0;
 $868 = $867;
 $869 = HEAP32[$868>>2]|0;
 $870 = (_bitshift64Ashr(0,($866|0),32)|0);
 $871 = tempRet0;
 $872 = $560;
 $873 = $872;
 $874 = HEAP32[$873>>2]|0;
 $875 = (($872) + 4)|0;
 $876 = $875;
 $877 = HEAP32[$876>>2]|0;
 $878 = (_bitshift64Ashr(0,($874|0),32)|0);
 $879 = tempRet0;
 $880 = (___muldi3(($878|0),($879|0),($870|0),($871|0))|0);
 $881 = tempRet0;
 $882 = (_i64Add(($862|0),($863|0),($880|0),($881|0))|0);
 $883 = tempRet0;
 $884 = $573;
 $885 = $884;
 $886 = HEAP32[$885>>2]|0;
 $887 = (($884) + 4)|0;
 $888 = $887;
 $889 = HEAP32[$888>>2]|0;
 $890 = (_bitshift64Ashr(0,($886|0),32)|0);
 $891 = tempRet0;
 $892 = $96;
 $893 = $892;
 $894 = HEAP32[$893>>2]|0;
 $895 = (($892) + 4)|0;
 $896 = $895;
 $897 = HEAP32[$896>>2]|0;
 $898 = (_bitshift64Ashr(0,($894|0),32)|0);
 $899 = tempRet0;
 $900 = (___muldi3(($898|0),($899|0),($890|0),($891|0))|0);
 $901 = tempRet0;
 $902 = (_i64Add(($882|0),($883|0),($900|0),($901|0))|0);
 $903 = tempRet0;
 $904 = $1;
 $905 = $904;
 $906 = HEAP32[$905>>2]|0;
 $907 = (($904) + 4)|0;
 $908 = $907;
 $909 = HEAP32[$908>>2]|0;
 $910 = (_bitshift64Ashr(0,($906|0),32)|0);
 $911 = tempRet0;
 $912 = ((($2)) + 64|0);
 $913 = $912;
 $914 = $913;
 $915 = HEAP32[$914>>2]|0;
 $916 = (($913) + 4)|0;
 $917 = $916;
 $918 = HEAP32[$917>>2]|0;
 $919 = (_bitshift64Ashr(0,($915|0),32)|0);
 $920 = tempRet0;
 $921 = (___muldi3(($919|0),($920|0),($910|0),($911|0))|0);
 $922 = tempRet0;
 $923 = (_i64Add(($902|0),($903|0),($921|0),($922|0))|0);
 $924 = tempRet0;
 $925 = ((($1)) + 64|0);
 $926 = $925;
 $927 = $926;
 $928 = HEAP32[$927>>2]|0;
 $929 = (($926) + 4)|0;
 $930 = $929;
 $931 = HEAP32[$930>>2]|0;
 $932 = (_bitshift64Ashr(0,($928|0),32)|0);
 $933 = tempRet0;
 $934 = $2;
 $935 = $934;
 $936 = HEAP32[$935>>2]|0;
 $937 = (($934) + 4)|0;
 $938 = $937;
 $939 = HEAP32[$938>>2]|0;
 $940 = (_bitshift64Ashr(0,($936|0),32)|0);
 $941 = tempRet0;
 $942 = (___muldi3(($940|0),($941|0),($932|0),($933|0))|0);
 $943 = tempRet0;
 $944 = (_i64Add(($923|0),($924|0),($942|0),($943|0))|0);
 $945 = tempRet0;
 $946 = ((($0)) + 64|0);
 $947 = $946;
 $948 = $947;
 HEAP32[$948>>2] = $944;
 $949 = (($947) + 4)|0;
 $950 = $949;
 HEAP32[$950>>2] = $945;
 $951 = $301;
 $952 = $951;
 $953 = HEAP32[$952>>2]|0;
 $954 = (($951) + 4)|0;
 $955 = $954;
 $956 = HEAP32[$955>>2]|0;
 $957 = (_bitshift64Ashr(0,($953|0),32)|0);
 $958 = tempRet0;
 $959 = $413;
 $960 = $959;
 $961 = HEAP32[$960>>2]|0;
 $962 = (($959) + 4)|0;
 $963 = $962;
 $964 = HEAP32[$963>>2]|0;
 $965 = (_bitshift64Ashr(0,($961|0),32)|0);
 $966 = tempRet0;
 $967 = (___muldi3(($965|0),($966|0),($957|0),($958|0))|0);
 $968 = tempRet0;
 $969 = $426;
 $970 = $969;
 $971 = HEAP32[$970>>2]|0;
 $972 = (($969) + 4)|0;
 $973 = $972;
 $974 = HEAP32[$973>>2]|0;
 $975 = (_bitshift64Ashr(0,($971|0),32)|0);
 $976 = tempRet0;
 $977 = $288;
 $978 = $977;
 $979 = HEAP32[$978>>2]|0;
 $980 = (($977) + 4)|0;
 $981 = $980;
 $982 = HEAP32[$981>>2]|0;
 $983 = (_bitshift64Ashr(0,($979|0),32)|0);
 $984 = tempRet0;
 $985 = (___muldi3(($983|0),($984|0),($975|0),($976|0))|0);
 $986 = tempRet0;
 $987 = (_i64Add(($985|0),($986|0),($967|0),($968|0))|0);
 $988 = tempRet0;
 $989 = $194;
 $990 = $989;
 $991 = HEAP32[$990>>2]|0;
 $992 = (($989) + 4)|0;
 $993 = $992;
 $994 = HEAP32[$993>>2]|0;
 $995 = (_bitshift64Ashr(0,($991|0),32)|0);
 $996 = tempRet0;
 $997 = $560;
 $998 = $997;
 $999 = HEAP32[$998>>2]|0;
 $1000 = (($997) + 4)|0;
 $1001 = $1000;
 $1002 = HEAP32[$1001>>2]|0;
 $1003 = (_bitshift64Ashr(0,($999|0),32)|0);
 $1004 = tempRet0;
 $1005 = (___muldi3(($1003|0),($1004|0),($995|0),($996|0))|0);
 $1006 = tempRet0;
 $1007 = (_i64Add(($987|0),($988|0),($1005|0),($1006|0))|0);
 $1008 = tempRet0;
 $1009 = $573;
 $1010 = $1009;
 $1011 = HEAP32[$1010>>2]|0;
 $1012 = (($1009) + 4)|0;
 $1013 = $1012;
 $1014 = HEAP32[$1013>>2]|0;
 $1015 = (_bitshift64Ashr(0,($1011|0),32)|0);
 $1016 = tempRet0;
 $1017 = $181;
 $1018 = $1017;
 $1019 = HEAP32[$1018>>2]|0;
 $1020 = (($1017) + 4)|0;
 $1021 = $1020;
 $1022 = HEAP32[$1021>>2]|0;
 $1023 = (_bitshift64Ashr(0,($1019|0),32)|0);
 $1024 = tempRet0;
 $1025 = (___muldi3(($1023|0),($1024|0),($1015|0),($1016|0))|0);
 $1026 = tempRet0;
 $1027 = (_i64Add(($1007|0),($1008|0),($1025|0),($1026|0))|0);
 $1028 = tempRet0;
 $1029 = $109;
 $1030 = $1029;
 $1031 = HEAP32[$1030>>2]|0;
 $1032 = (($1029) + 4)|0;
 $1033 = $1032;
 $1034 = HEAP32[$1033>>2]|0;
 $1035 = (_bitshift64Ashr(0,($1031|0),32)|0);
 $1036 = tempRet0;
 $1037 = $725;
 $1038 = $1037;
 $1039 = HEAP32[$1038>>2]|0;
 $1040 = (($1037) + 4)|0;
 $1041 = $1040;
 $1042 = HEAP32[$1041>>2]|0;
 $1043 = (_bitshift64Ashr(0,($1039|0),32)|0);
 $1044 = tempRet0;
 $1045 = (___muldi3(($1043|0),($1044|0),($1035|0),($1036|0))|0);
 $1046 = tempRet0;
 $1047 = (_i64Add(($1027|0),($1028|0),($1045|0),($1046|0))|0);
 $1048 = tempRet0;
 $1049 = $738;
 $1050 = $1049;
 $1051 = HEAP32[$1050>>2]|0;
 $1052 = (($1049) + 4)|0;
 $1053 = $1052;
 $1054 = HEAP32[$1053>>2]|0;
 $1055 = (_bitshift64Ashr(0,($1051|0),32)|0);
 $1056 = tempRet0;
 $1057 = $96;
 $1058 = $1057;
 $1059 = HEAP32[$1058>>2]|0;
 $1060 = (($1057) + 4)|0;
 $1061 = $1060;
 $1062 = HEAP32[$1061>>2]|0;
 $1063 = (_bitshift64Ashr(0,($1059|0),32)|0);
 $1064 = tempRet0;
 $1065 = (___muldi3(($1063|0),($1064|0),($1055|0),($1056|0))|0);
 $1066 = tempRet0;
 $1067 = (_i64Add(($1047|0),($1048|0),($1065|0),($1066|0))|0);
 $1068 = tempRet0;
 $1069 = $44;
 $1070 = $1069;
 $1071 = HEAP32[$1070>>2]|0;
 $1072 = (($1069) + 4)|0;
 $1073 = $1072;
 $1074 = HEAP32[$1073>>2]|0;
 $1075 = (_bitshift64Ashr(0,($1071|0),32)|0);
 $1076 = tempRet0;
 $1077 = $912;
 $1078 = $1077;
 $1079 = HEAP32[$1078>>2]|0;
 $1080 = (($1077) + 4)|0;
 $1081 = $1080;
 $1082 = HEAP32[$1081>>2]|0;
 $1083 = (_bitshift64Ashr(0,($1079|0),32)|0);
 $1084 = tempRet0;
 $1085 = (___muldi3(($1083|0),($1084|0),($1075|0),($1076|0))|0);
 $1086 = tempRet0;
 $1087 = (_i64Add(($1067|0),($1068|0),($1085|0),($1086|0))|0);
 $1088 = tempRet0;
 $1089 = $925;
 $1090 = $1089;
 $1091 = HEAP32[$1090>>2]|0;
 $1092 = (($1089) + 4)|0;
 $1093 = $1092;
 $1094 = HEAP32[$1093>>2]|0;
 $1095 = (_bitshift64Ashr(0,($1091|0),32)|0);
 $1096 = tempRet0;
 $1097 = $33;
 $1098 = $1097;
 $1099 = HEAP32[$1098>>2]|0;
 $1100 = (($1097) + 4)|0;
 $1101 = $1100;
 $1102 = HEAP32[$1101>>2]|0;
 $1103 = (_bitshift64Ashr(0,($1099|0),32)|0);
 $1104 = tempRet0;
 $1105 = (___muldi3(($1103|0),($1104|0),($1095|0),($1096|0))|0);
 $1106 = tempRet0;
 $1107 = (_i64Add(($1087|0),($1088|0),($1105|0),($1106|0))|0);
 $1108 = tempRet0;
 $1109 = $1;
 $1110 = $1109;
 $1111 = HEAP32[$1110>>2]|0;
 $1112 = (($1109) + 4)|0;
 $1113 = $1112;
 $1114 = HEAP32[$1113>>2]|0;
 $1115 = (_bitshift64Ashr(0,($1111|0),32)|0);
 $1116 = tempRet0;
 $1117 = ((($2)) + 72|0);
 $1118 = $1117;
 $1119 = $1118;
 $1120 = HEAP32[$1119>>2]|0;
 $1121 = (($1118) + 4)|0;
 $1122 = $1121;
 $1123 = HEAP32[$1122>>2]|0;
 $1124 = (_bitshift64Ashr(0,($1120|0),32)|0);
 $1125 = tempRet0;
 $1126 = (___muldi3(($1124|0),($1125|0),($1115|0),($1116|0))|0);
 $1127 = tempRet0;
 $1128 = (_i64Add(($1107|0),($1108|0),($1126|0),($1127|0))|0);
 $1129 = tempRet0;
 $1130 = ((($1)) + 72|0);
 $1131 = $1130;
 $1132 = $1131;
 $1133 = HEAP32[$1132>>2]|0;
 $1134 = (($1131) + 4)|0;
 $1135 = $1134;
 $1136 = HEAP32[$1135>>2]|0;
 $1137 = (_bitshift64Ashr(0,($1133|0),32)|0);
 $1138 = tempRet0;
 $1139 = $2;
 $1140 = $1139;
 $1141 = HEAP32[$1140>>2]|0;
 $1142 = (($1139) + 4)|0;
 $1143 = $1142;
 $1144 = HEAP32[$1143>>2]|0;
 $1145 = (_bitshift64Ashr(0,($1141|0),32)|0);
 $1146 = tempRet0;
 $1147 = (___muldi3(($1145|0),($1146|0),($1137|0),($1138|0))|0);
 $1148 = tempRet0;
 $1149 = (_i64Add(($1128|0),($1129|0),($1147|0),($1148|0))|0);
 $1150 = tempRet0;
 $1151 = ((($0)) + 72|0);
 $1152 = $1151;
 $1153 = $1152;
 HEAP32[$1153>>2] = $1149;
 $1154 = (($1152) + 4)|0;
 $1155 = $1154;
 HEAP32[$1155>>2] = $1150;
 $1156 = $426;
 $1157 = $1156;
 $1158 = HEAP32[$1157>>2]|0;
 $1159 = (($1156) + 4)|0;
 $1160 = $1159;
 $1161 = HEAP32[$1160>>2]|0;
 $1162 = (_bitshift64Ashr(0,($1158|0),32)|0);
 $1163 = tempRet0;
 $1164 = $413;
 $1165 = $1164;
 $1166 = HEAP32[$1165>>2]|0;
 $1167 = (($1164) + 4)|0;
 $1168 = $1167;
 $1169 = HEAP32[$1168>>2]|0;
 $1170 = (_bitshift64Ashr(0,($1166|0),32)|0);
 $1171 = tempRet0;
 $1172 = (___muldi3(($1170|0),($1171|0),($1162|0),($1163|0))|0);
 $1173 = tempRet0;
 $1174 = $194;
 $1175 = $1174;
 $1176 = HEAP32[$1175>>2]|0;
 $1177 = (($1174) + 4)|0;
 $1178 = $1177;
 $1179 = HEAP32[$1178>>2]|0;
 $1180 = (_bitshift64Ashr(0,($1176|0),32)|0);
 $1181 = tempRet0;
 $1182 = $725;
 $1183 = $1182;
 $1184 = HEAP32[$1183>>2]|0;
 $1185 = (($1182) + 4)|0;
 $1186 = $1185;
 $1187 = HEAP32[$1186>>2]|0;
 $1188 = (_bitshift64Ashr(0,($1184|0),32)|0);
 $1189 = tempRet0;
 $1190 = (___muldi3(($1188|0),($1189|0),($1180|0),($1181|0))|0);
 $1191 = tempRet0;
 $1192 = (_i64Add(($1190|0),($1191|0),($1172|0),($1173|0))|0);
 $1193 = tempRet0;
 $1194 = $738;
 $1195 = $1194;
 $1196 = HEAP32[$1195>>2]|0;
 $1197 = (($1194) + 4)|0;
 $1198 = $1197;
 $1199 = HEAP32[$1198>>2]|0;
 $1200 = (_bitshift64Ashr(0,($1196|0),32)|0);
 $1201 = tempRet0;
 $1202 = $181;
 $1203 = $1202;
 $1204 = HEAP32[$1203>>2]|0;
 $1205 = (($1202) + 4)|0;
 $1206 = $1205;
 $1207 = HEAP32[$1206>>2]|0;
 $1208 = (_bitshift64Ashr(0,($1204|0),32)|0);
 $1209 = tempRet0;
 $1210 = (___muldi3(($1208|0),($1209|0),($1200|0),($1201|0))|0);
 $1211 = tempRet0;
 $1212 = (_i64Add(($1192|0),($1193|0),($1210|0),($1211|0))|0);
 $1213 = tempRet0;
 $1214 = $44;
 $1215 = $1214;
 $1216 = HEAP32[$1215>>2]|0;
 $1217 = (($1214) + 4)|0;
 $1218 = $1217;
 $1219 = HEAP32[$1218>>2]|0;
 $1220 = (_bitshift64Ashr(0,($1216|0),32)|0);
 $1221 = tempRet0;
 $1222 = $1117;
 $1223 = $1222;
 $1224 = HEAP32[$1223>>2]|0;
 $1225 = (($1222) + 4)|0;
 $1226 = $1225;
 $1227 = HEAP32[$1226>>2]|0;
 $1228 = (_bitshift64Ashr(0,($1224|0),32)|0);
 $1229 = tempRet0;
 $1230 = (___muldi3(($1228|0),($1229|0),($1220|0),($1221|0))|0);
 $1231 = tempRet0;
 $1232 = (_i64Add(($1212|0),($1213|0),($1230|0),($1231|0))|0);
 $1233 = tempRet0;
 $1234 = $1130;
 $1235 = $1234;
 $1236 = HEAP32[$1235>>2]|0;
 $1237 = (($1234) + 4)|0;
 $1238 = $1237;
 $1239 = HEAP32[$1238>>2]|0;
 $1240 = (_bitshift64Ashr(0,($1236|0),32)|0);
 $1241 = tempRet0;
 $1242 = $33;
 $1243 = $1242;
 $1244 = HEAP32[$1243>>2]|0;
 $1245 = (($1242) + 4)|0;
 $1246 = $1245;
 $1247 = HEAP32[$1246>>2]|0;
 $1248 = (_bitshift64Ashr(0,($1244|0),32)|0);
 $1249 = tempRet0;
 $1250 = (___muldi3(($1248|0),($1249|0),($1240|0),($1241|0))|0);
 $1251 = tempRet0;
 $1252 = (_i64Add(($1232|0),($1233|0),($1250|0),($1251|0))|0);
 $1253 = tempRet0;
 $1254 = (_bitshift64Shl(($1252|0),($1253|0),1)|0);
 $1255 = tempRet0;
 $1256 = $301;
 $1257 = $1256;
 $1258 = HEAP32[$1257>>2]|0;
 $1259 = (($1256) + 4)|0;
 $1260 = $1259;
 $1261 = HEAP32[$1260>>2]|0;
 $1262 = (_bitshift64Ashr(0,($1258|0),32)|0);
 $1263 = tempRet0;
 $1264 = $560;
 $1265 = $1264;
 $1266 = HEAP32[$1265>>2]|0;
 $1267 = (($1264) + 4)|0;
 $1268 = $1267;
 $1269 = HEAP32[$1268>>2]|0;
 $1270 = (_bitshift64Ashr(0,($1266|0),32)|0);
 $1271 = tempRet0;
 $1272 = (___muldi3(($1270|0),($1271|0),($1262|0),($1263|0))|0);
 $1273 = tempRet0;
 $1274 = (_i64Add(($1254|0),($1255|0),($1272|0),($1273|0))|0);
 $1275 = tempRet0;
 $1276 = $573;
 $1277 = $1276;
 $1278 = HEAP32[$1277>>2]|0;
 $1279 = (($1276) + 4)|0;
 $1280 = $1279;
 $1281 = HEAP32[$1280>>2]|0;
 $1282 = (_bitshift64Ashr(0,($1278|0),32)|0);
 $1283 = tempRet0;
 $1284 = $288;
 $1285 = $1284;
 $1286 = HEAP32[$1285>>2]|0;
 $1287 = (($1284) + 4)|0;
 $1288 = $1287;
 $1289 = HEAP32[$1288>>2]|0;
 $1290 = (_bitshift64Ashr(0,($1286|0),32)|0);
 $1291 = tempRet0;
 $1292 = (___muldi3(($1290|0),($1291|0),($1282|0),($1283|0))|0);
 $1293 = tempRet0;
 $1294 = (_i64Add(($1274|0),($1275|0),($1292|0),($1293|0))|0);
 $1295 = tempRet0;
 $1296 = $109;
 $1297 = $1296;
 $1298 = HEAP32[$1297>>2]|0;
 $1299 = (($1296) + 4)|0;
 $1300 = $1299;
 $1301 = HEAP32[$1300>>2]|0;
 $1302 = (_bitshift64Ashr(0,($1298|0),32)|0);
 $1303 = tempRet0;
 $1304 = $912;
 $1305 = $1304;
 $1306 = HEAP32[$1305>>2]|0;
 $1307 = (($1304) + 4)|0;
 $1308 = $1307;
 $1309 = HEAP32[$1308>>2]|0;
 $1310 = (_bitshift64Ashr(0,($1306|0),32)|0);
 $1311 = tempRet0;
 $1312 = (___muldi3(($1310|0),($1311|0),($1302|0),($1303|0))|0);
 $1313 = tempRet0;
 $1314 = (_i64Add(($1294|0),($1295|0),($1312|0),($1313|0))|0);
 $1315 = tempRet0;
 $1316 = $925;
 $1317 = $1316;
 $1318 = HEAP32[$1317>>2]|0;
 $1319 = (($1316) + 4)|0;
 $1320 = $1319;
 $1321 = HEAP32[$1320>>2]|0;
 $1322 = (_bitshift64Ashr(0,($1318|0),32)|0);
 $1323 = tempRet0;
 $1324 = $96;
 $1325 = $1324;
 $1326 = HEAP32[$1325>>2]|0;
 $1327 = (($1324) + 4)|0;
 $1328 = $1327;
 $1329 = HEAP32[$1328>>2]|0;
 $1330 = (_bitshift64Ashr(0,($1326|0),32)|0);
 $1331 = tempRet0;
 $1332 = (___muldi3(($1330|0),($1331|0),($1322|0),($1323|0))|0);
 $1333 = tempRet0;
 $1334 = (_i64Add(($1314|0),($1315|0),($1332|0),($1333|0))|0);
 $1335 = tempRet0;
 $1336 = ((($0)) + 80|0);
 $1337 = $1336;
 $1338 = $1337;
 HEAP32[$1338>>2] = $1334;
 $1339 = (($1337) + 4)|0;
 $1340 = $1339;
 HEAP32[$1340>>2] = $1335;
 $1341 = $426;
 $1342 = $1341;
 $1343 = HEAP32[$1342>>2]|0;
 $1344 = (($1341) + 4)|0;
 $1345 = $1344;
 $1346 = HEAP32[$1345>>2]|0;
 $1347 = (_bitshift64Ashr(0,($1343|0),32)|0);
 $1348 = tempRet0;
 $1349 = $560;
 $1350 = $1349;
 $1351 = HEAP32[$1350>>2]|0;
 $1352 = (($1349) + 4)|0;
 $1353 = $1352;
 $1354 = HEAP32[$1353>>2]|0;
 $1355 = (_bitshift64Ashr(0,($1351|0),32)|0);
 $1356 = tempRet0;
 $1357 = (___muldi3(($1355|0),($1356|0),($1347|0),($1348|0))|0);
 $1358 = tempRet0;
 $1359 = $573;
 $1360 = $1359;
 $1361 = HEAP32[$1360>>2]|0;
 $1362 = (($1359) + 4)|0;
 $1363 = $1362;
 $1364 = HEAP32[$1363>>2]|0;
 $1365 = (_bitshift64Ashr(0,($1361|0),32)|0);
 $1366 = tempRet0;
 $1367 = $413;
 $1368 = $1367;
 $1369 = HEAP32[$1368>>2]|0;
 $1370 = (($1367) + 4)|0;
 $1371 = $1370;
 $1372 = HEAP32[$1371>>2]|0;
 $1373 = (_bitshift64Ashr(0,($1369|0),32)|0);
 $1374 = tempRet0;
 $1375 = (___muldi3(($1373|0),($1374|0),($1365|0),($1366|0))|0);
 $1376 = tempRet0;
 $1377 = (_i64Add(($1375|0),($1376|0),($1357|0),($1358|0))|0);
 $1378 = tempRet0;
 $1379 = $301;
 $1380 = $1379;
 $1381 = HEAP32[$1380>>2]|0;
 $1382 = (($1379) + 4)|0;
 $1383 = $1382;
 $1384 = HEAP32[$1383>>2]|0;
 $1385 = (_bitshift64Ashr(0,($1381|0),32)|0);
 $1386 = tempRet0;
 $1387 = $725;
 $1388 = $1387;
 $1389 = HEAP32[$1388>>2]|0;
 $1390 = (($1387) + 4)|0;
 $1391 = $1390;
 $1392 = HEAP32[$1391>>2]|0;
 $1393 = (_bitshift64Ashr(0,($1389|0),32)|0);
 $1394 = tempRet0;
 $1395 = (___muldi3(($1393|0),($1394|0),($1385|0),($1386|0))|0);
 $1396 = tempRet0;
 $1397 = (_i64Add(($1377|0),($1378|0),($1395|0),($1396|0))|0);
 $1398 = tempRet0;
 $1399 = $738;
 $1400 = $1399;
 $1401 = HEAP32[$1400>>2]|0;
 $1402 = (($1399) + 4)|0;
 $1403 = $1402;
 $1404 = HEAP32[$1403>>2]|0;
 $1405 = (_bitshift64Ashr(0,($1401|0),32)|0);
 $1406 = tempRet0;
 $1407 = $288;
 $1408 = $1407;
 $1409 = HEAP32[$1408>>2]|0;
 $1410 = (($1407) + 4)|0;
 $1411 = $1410;
 $1412 = HEAP32[$1411>>2]|0;
 $1413 = (_bitshift64Ashr(0,($1409|0),32)|0);
 $1414 = tempRet0;
 $1415 = (___muldi3(($1413|0),($1414|0),($1405|0),($1406|0))|0);
 $1416 = tempRet0;
 $1417 = (_i64Add(($1397|0),($1398|0),($1415|0),($1416|0))|0);
 $1418 = tempRet0;
 $1419 = $194;
 $1420 = $1419;
 $1421 = HEAP32[$1420>>2]|0;
 $1422 = (($1419) + 4)|0;
 $1423 = $1422;
 $1424 = HEAP32[$1423>>2]|0;
 $1425 = (_bitshift64Ashr(0,($1421|0),32)|0);
 $1426 = tempRet0;
 $1427 = $912;
 $1428 = $1427;
 $1429 = HEAP32[$1428>>2]|0;
 $1430 = (($1427) + 4)|0;
 $1431 = $1430;
 $1432 = HEAP32[$1431>>2]|0;
 $1433 = (_bitshift64Ashr(0,($1429|0),32)|0);
 $1434 = tempRet0;
 $1435 = (___muldi3(($1433|0),($1434|0),($1425|0),($1426|0))|0);
 $1436 = tempRet0;
 $1437 = (_i64Add(($1417|0),($1418|0),($1435|0),($1436|0))|0);
 $1438 = tempRet0;
 $1439 = $925;
 $1440 = $1439;
 $1441 = HEAP32[$1440>>2]|0;
 $1442 = (($1439) + 4)|0;
 $1443 = $1442;
 $1444 = HEAP32[$1443>>2]|0;
 $1445 = (_bitshift64Ashr(0,($1441|0),32)|0);
 $1446 = tempRet0;
 $1447 = $181;
 $1448 = $1447;
 $1449 = HEAP32[$1448>>2]|0;
 $1450 = (($1447) + 4)|0;
 $1451 = $1450;
 $1452 = HEAP32[$1451>>2]|0;
 $1453 = (_bitshift64Ashr(0,($1449|0),32)|0);
 $1454 = tempRet0;
 $1455 = (___muldi3(($1453|0),($1454|0),($1445|0),($1446|0))|0);
 $1456 = tempRet0;
 $1457 = (_i64Add(($1437|0),($1438|0),($1455|0),($1456|0))|0);
 $1458 = tempRet0;
 $1459 = $109;
 $1460 = $1459;
 $1461 = HEAP32[$1460>>2]|0;
 $1462 = (($1459) + 4)|0;
 $1463 = $1462;
 $1464 = HEAP32[$1463>>2]|0;
 $1465 = (_bitshift64Ashr(0,($1461|0),32)|0);
 $1466 = tempRet0;
 $1467 = $1117;
 $1468 = $1467;
 $1469 = HEAP32[$1468>>2]|0;
 $1470 = (($1467) + 4)|0;
 $1471 = $1470;
 $1472 = HEAP32[$1471>>2]|0;
 $1473 = (_bitshift64Ashr(0,($1469|0),32)|0);
 $1474 = tempRet0;
 $1475 = (___muldi3(($1473|0),($1474|0),($1465|0),($1466|0))|0);
 $1476 = tempRet0;
 $1477 = (_i64Add(($1457|0),($1458|0),($1475|0),($1476|0))|0);
 $1478 = tempRet0;
 $1479 = $1130;
 $1480 = $1479;
 $1481 = HEAP32[$1480>>2]|0;
 $1482 = (($1479) + 4)|0;
 $1483 = $1482;
 $1484 = HEAP32[$1483>>2]|0;
 $1485 = (_bitshift64Ashr(0,($1481|0),32)|0);
 $1486 = tempRet0;
 $1487 = $96;
 $1488 = $1487;
 $1489 = HEAP32[$1488>>2]|0;
 $1490 = (($1487) + 4)|0;
 $1491 = $1490;
 $1492 = HEAP32[$1491>>2]|0;
 $1493 = (_bitshift64Ashr(0,($1489|0),32)|0);
 $1494 = tempRet0;
 $1495 = (___muldi3(($1493|0),($1494|0),($1485|0),($1486|0))|0);
 $1496 = tempRet0;
 $1497 = (_i64Add(($1477|0),($1478|0),($1495|0),($1496|0))|0);
 $1498 = tempRet0;
 $1499 = ((($0)) + 88|0);
 $1500 = $1499;
 $1501 = $1500;
 HEAP32[$1501>>2] = $1497;
 $1502 = (($1500) + 4)|0;
 $1503 = $1502;
 HEAP32[$1503>>2] = $1498;
 $1504 = $573;
 $1505 = $1504;
 $1506 = HEAP32[$1505>>2]|0;
 $1507 = (($1504) + 4)|0;
 $1508 = $1507;
 $1509 = HEAP32[$1508>>2]|0;
 $1510 = (_bitshift64Ashr(0,($1506|0),32)|0);
 $1511 = tempRet0;
 $1512 = $560;
 $1513 = $1512;
 $1514 = HEAP32[$1513>>2]|0;
 $1515 = (($1512) + 4)|0;
 $1516 = $1515;
 $1517 = HEAP32[$1516>>2]|0;
 $1518 = (_bitshift64Ashr(0,($1514|0),32)|0);
 $1519 = tempRet0;
 $1520 = (___muldi3(($1518|0),($1519|0),($1510|0),($1511|0))|0);
 $1521 = tempRet0;
 $1522 = $426;
 $1523 = $1522;
 $1524 = HEAP32[$1523>>2]|0;
 $1525 = (($1522) + 4)|0;
 $1526 = $1525;
 $1527 = HEAP32[$1526>>2]|0;
 $1528 = (_bitshift64Ashr(0,($1524|0),32)|0);
 $1529 = tempRet0;
 $1530 = $725;
 $1531 = $1530;
 $1532 = HEAP32[$1531>>2]|0;
 $1533 = (($1530) + 4)|0;
 $1534 = $1533;
 $1535 = HEAP32[$1534>>2]|0;
 $1536 = (_bitshift64Ashr(0,($1532|0),32)|0);
 $1537 = tempRet0;
 $1538 = (___muldi3(($1536|0),($1537|0),($1528|0),($1529|0))|0);
 $1539 = tempRet0;
 $1540 = $738;
 $1541 = $1540;
 $1542 = HEAP32[$1541>>2]|0;
 $1543 = (($1540) + 4)|0;
 $1544 = $1543;
 $1545 = HEAP32[$1544>>2]|0;
 $1546 = (_bitshift64Ashr(0,($1542|0),32)|0);
 $1547 = tempRet0;
 $1548 = $413;
 $1549 = $1548;
 $1550 = HEAP32[$1549>>2]|0;
 $1551 = (($1548) + 4)|0;
 $1552 = $1551;
 $1553 = HEAP32[$1552>>2]|0;
 $1554 = (_bitshift64Ashr(0,($1550|0),32)|0);
 $1555 = tempRet0;
 $1556 = (___muldi3(($1554|0),($1555|0),($1546|0),($1547|0))|0);
 $1557 = tempRet0;
 $1558 = (_i64Add(($1556|0),($1557|0),($1538|0),($1539|0))|0);
 $1559 = tempRet0;
 $1560 = $194;
 $1561 = $1560;
 $1562 = HEAP32[$1561>>2]|0;
 $1563 = (($1560) + 4)|0;
 $1564 = $1563;
 $1565 = HEAP32[$1564>>2]|0;
 $1566 = (_bitshift64Ashr(0,($1562|0),32)|0);
 $1567 = tempRet0;
 $1568 = $1117;
 $1569 = $1568;
 $1570 = HEAP32[$1569>>2]|0;
 $1571 = (($1568) + 4)|0;
 $1572 = $1571;
 $1573 = HEAP32[$1572>>2]|0;
 $1574 = (_bitshift64Ashr(0,($1570|0),32)|0);
 $1575 = tempRet0;
 $1576 = (___muldi3(($1574|0),($1575|0),($1566|0),($1567|0))|0);
 $1577 = tempRet0;
 $1578 = (_i64Add(($1558|0),($1559|0),($1576|0),($1577|0))|0);
 $1579 = tempRet0;
 $1580 = $1130;
 $1581 = $1580;
 $1582 = HEAP32[$1581>>2]|0;
 $1583 = (($1580) + 4)|0;
 $1584 = $1583;
 $1585 = HEAP32[$1584>>2]|0;
 $1586 = (_bitshift64Ashr(0,($1582|0),32)|0);
 $1587 = tempRet0;
 $1588 = $181;
 $1589 = $1588;
 $1590 = HEAP32[$1589>>2]|0;
 $1591 = (($1588) + 4)|0;
 $1592 = $1591;
 $1593 = HEAP32[$1592>>2]|0;
 $1594 = (_bitshift64Ashr(0,($1590|0),32)|0);
 $1595 = tempRet0;
 $1596 = (___muldi3(($1594|0),($1595|0),($1586|0),($1587|0))|0);
 $1597 = tempRet0;
 $1598 = (_i64Add(($1578|0),($1579|0),($1596|0),($1597|0))|0);
 $1599 = tempRet0;
 $1600 = (_bitshift64Shl(($1598|0),($1599|0),1)|0);
 $1601 = tempRet0;
 $1602 = (_i64Add(($1600|0),($1601|0),($1520|0),($1521|0))|0);
 $1603 = tempRet0;
 $1604 = $301;
 $1605 = $1604;
 $1606 = HEAP32[$1605>>2]|0;
 $1607 = (($1604) + 4)|0;
 $1608 = $1607;
 $1609 = HEAP32[$1608>>2]|0;
 $1610 = (_bitshift64Ashr(0,($1606|0),32)|0);
 $1611 = tempRet0;
 $1612 = $912;
 $1613 = $1612;
 $1614 = HEAP32[$1613>>2]|0;
 $1615 = (($1612) + 4)|0;
 $1616 = $1615;
 $1617 = HEAP32[$1616>>2]|0;
 $1618 = (_bitshift64Ashr(0,($1614|0),32)|0);
 $1619 = tempRet0;
 $1620 = (___muldi3(($1618|0),($1619|0),($1610|0),($1611|0))|0);
 $1621 = tempRet0;
 $1622 = (_i64Add(($1602|0),($1603|0),($1620|0),($1621|0))|0);
 $1623 = tempRet0;
 $1624 = $925;
 $1625 = $1624;
 $1626 = HEAP32[$1625>>2]|0;
 $1627 = (($1624) + 4)|0;
 $1628 = $1627;
 $1629 = HEAP32[$1628>>2]|0;
 $1630 = (_bitshift64Ashr(0,($1626|0),32)|0);
 $1631 = tempRet0;
 $1632 = $288;
 $1633 = $1632;
 $1634 = HEAP32[$1633>>2]|0;
 $1635 = (($1632) + 4)|0;
 $1636 = $1635;
 $1637 = HEAP32[$1636>>2]|0;
 $1638 = (_bitshift64Ashr(0,($1634|0),32)|0);
 $1639 = tempRet0;
 $1640 = (___muldi3(($1638|0),($1639|0),($1630|0),($1631|0))|0);
 $1641 = tempRet0;
 $1642 = (_i64Add(($1622|0),($1623|0),($1640|0),($1641|0))|0);
 $1643 = tempRet0;
 $1644 = ((($0)) + 96|0);
 $1645 = $1644;
 $1646 = $1645;
 HEAP32[$1646>>2] = $1642;
 $1647 = (($1645) + 4)|0;
 $1648 = $1647;
 HEAP32[$1648>>2] = $1643;
 $1649 = $573;
 $1650 = $1649;
 $1651 = HEAP32[$1650>>2]|0;
 $1652 = (($1649) + 4)|0;
 $1653 = $1652;
 $1654 = HEAP32[$1653>>2]|0;
 $1655 = (_bitshift64Ashr(0,($1651|0),32)|0);
 $1656 = tempRet0;
 $1657 = $725;
 $1658 = $1657;
 $1659 = HEAP32[$1658>>2]|0;
 $1660 = (($1657) + 4)|0;
 $1661 = $1660;
 $1662 = HEAP32[$1661>>2]|0;
 $1663 = (_bitshift64Ashr(0,($1659|0),32)|0);
 $1664 = tempRet0;
 $1665 = (___muldi3(($1663|0),($1664|0),($1655|0),($1656|0))|0);
 $1666 = tempRet0;
 $1667 = $738;
 $1668 = $1667;
 $1669 = HEAP32[$1668>>2]|0;
 $1670 = (($1667) + 4)|0;
 $1671 = $1670;
 $1672 = HEAP32[$1671>>2]|0;
 $1673 = (_bitshift64Ashr(0,($1669|0),32)|0);
 $1674 = tempRet0;
 $1675 = $560;
 $1676 = $1675;
 $1677 = HEAP32[$1676>>2]|0;
 $1678 = (($1675) + 4)|0;
 $1679 = $1678;
 $1680 = HEAP32[$1679>>2]|0;
 $1681 = (_bitshift64Ashr(0,($1677|0),32)|0);
 $1682 = tempRet0;
 $1683 = (___muldi3(($1681|0),($1682|0),($1673|0),($1674|0))|0);
 $1684 = tempRet0;
 $1685 = (_i64Add(($1683|0),($1684|0),($1665|0),($1666|0))|0);
 $1686 = tempRet0;
 $1687 = $426;
 $1688 = $1687;
 $1689 = HEAP32[$1688>>2]|0;
 $1690 = (($1687) + 4)|0;
 $1691 = $1690;
 $1692 = HEAP32[$1691>>2]|0;
 $1693 = (_bitshift64Ashr(0,($1689|0),32)|0);
 $1694 = tempRet0;
 $1695 = $912;
 $1696 = $1695;
 $1697 = HEAP32[$1696>>2]|0;
 $1698 = (($1695) + 4)|0;
 $1699 = $1698;
 $1700 = HEAP32[$1699>>2]|0;
 $1701 = (_bitshift64Ashr(0,($1697|0),32)|0);
 $1702 = tempRet0;
 $1703 = (___muldi3(($1701|0),($1702|0),($1693|0),($1694|0))|0);
 $1704 = tempRet0;
 $1705 = (_i64Add(($1685|0),($1686|0),($1703|0),($1704|0))|0);
 $1706 = tempRet0;
 $1707 = $925;
 $1708 = $1707;
 $1709 = HEAP32[$1708>>2]|0;
 $1710 = (($1707) + 4)|0;
 $1711 = $1710;
 $1712 = HEAP32[$1711>>2]|0;
 $1713 = (_bitshift64Ashr(0,($1709|0),32)|0);
 $1714 = tempRet0;
 $1715 = $413;
 $1716 = $1715;
 $1717 = HEAP32[$1716>>2]|0;
 $1718 = (($1715) + 4)|0;
 $1719 = $1718;
 $1720 = HEAP32[$1719>>2]|0;
 $1721 = (_bitshift64Ashr(0,($1717|0),32)|0);
 $1722 = tempRet0;
 $1723 = (___muldi3(($1721|0),($1722|0),($1713|0),($1714|0))|0);
 $1724 = tempRet0;
 $1725 = (_i64Add(($1705|0),($1706|0),($1723|0),($1724|0))|0);
 $1726 = tempRet0;
 $1727 = $301;
 $1728 = $1727;
 $1729 = HEAP32[$1728>>2]|0;
 $1730 = (($1727) + 4)|0;
 $1731 = $1730;
 $1732 = HEAP32[$1731>>2]|0;
 $1733 = (_bitshift64Ashr(0,($1729|0),32)|0);
 $1734 = tempRet0;
 $1735 = $1117;
 $1736 = $1735;
 $1737 = HEAP32[$1736>>2]|0;
 $1738 = (($1735) + 4)|0;
 $1739 = $1738;
 $1740 = HEAP32[$1739>>2]|0;
 $1741 = (_bitshift64Ashr(0,($1737|0),32)|0);
 $1742 = tempRet0;
 $1743 = (___muldi3(($1741|0),($1742|0),($1733|0),($1734|0))|0);
 $1744 = tempRet0;
 $1745 = (_i64Add(($1725|0),($1726|0),($1743|0),($1744|0))|0);
 $1746 = tempRet0;
 $1747 = $1130;
 $1748 = $1747;
 $1749 = HEAP32[$1748>>2]|0;
 $1750 = (($1747) + 4)|0;
 $1751 = $1750;
 $1752 = HEAP32[$1751>>2]|0;
 $1753 = (_bitshift64Ashr(0,($1749|0),32)|0);
 $1754 = tempRet0;
 $1755 = $288;
 $1756 = $1755;
 $1757 = HEAP32[$1756>>2]|0;
 $1758 = (($1755) + 4)|0;
 $1759 = $1758;
 $1760 = HEAP32[$1759>>2]|0;
 $1761 = (_bitshift64Ashr(0,($1757|0),32)|0);
 $1762 = tempRet0;
 $1763 = (___muldi3(($1761|0),($1762|0),($1753|0),($1754|0))|0);
 $1764 = tempRet0;
 $1765 = (_i64Add(($1745|0),($1746|0),($1763|0),($1764|0))|0);
 $1766 = tempRet0;
 $1767 = ((($0)) + 104|0);
 $1768 = $1767;
 $1769 = $1768;
 HEAP32[$1769>>2] = $1765;
 $1770 = (($1768) + 4)|0;
 $1771 = $1770;
 HEAP32[$1771>>2] = $1766;
 $1772 = $738;
 $1773 = $1772;
 $1774 = HEAP32[$1773>>2]|0;
 $1775 = (($1772) + 4)|0;
 $1776 = $1775;
 $1777 = HEAP32[$1776>>2]|0;
 $1778 = (_bitshift64Ashr(0,($1774|0),32)|0);
 $1779 = tempRet0;
 $1780 = $725;
 $1781 = $1780;
 $1782 = HEAP32[$1781>>2]|0;
 $1783 = (($1780) + 4)|0;
 $1784 = $1783;
 $1785 = HEAP32[$1784>>2]|0;
 $1786 = (_bitshift64Ashr(0,($1782|0),32)|0);
 $1787 = tempRet0;
 $1788 = (___muldi3(($1786|0),($1787|0),($1778|0),($1779|0))|0);
 $1789 = tempRet0;
 $1790 = $426;
 $1791 = $1790;
 $1792 = HEAP32[$1791>>2]|0;
 $1793 = (($1790) + 4)|0;
 $1794 = $1793;
 $1795 = HEAP32[$1794>>2]|0;
 $1796 = (_bitshift64Ashr(0,($1792|0),32)|0);
 $1797 = tempRet0;
 $1798 = $1117;
 $1799 = $1798;
 $1800 = HEAP32[$1799>>2]|0;
 $1801 = (($1798) + 4)|0;
 $1802 = $1801;
 $1803 = HEAP32[$1802>>2]|0;
 $1804 = (_bitshift64Ashr(0,($1800|0),32)|0);
 $1805 = tempRet0;
 $1806 = (___muldi3(($1804|0),($1805|0),($1796|0),($1797|0))|0);
 $1807 = tempRet0;
 $1808 = (_i64Add(($1806|0),($1807|0),($1788|0),($1789|0))|0);
 $1809 = tempRet0;
 $1810 = $1130;
 $1811 = $1810;
 $1812 = HEAP32[$1811>>2]|0;
 $1813 = (($1810) + 4)|0;
 $1814 = $1813;
 $1815 = HEAP32[$1814>>2]|0;
 $1816 = (_bitshift64Ashr(0,($1812|0),32)|0);
 $1817 = tempRet0;
 $1818 = $413;
 $1819 = $1818;
 $1820 = HEAP32[$1819>>2]|0;
 $1821 = (($1818) + 4)|0;
 $1822 = $1821;
 $1823 = HEAP32[$1822>>2]|0;
 $1824 = (_bitshift64Ashr(0,($1820|0),32)|0);
 $1825 = tempRet0;
 $1826 = (___muldi3(($1824|0),($1825|0),($1816|0),($1817|0))|0);
 $1827 = tempRet0;
 $1828 = (_i64Add(($1808|0),($1809|0),($1826|0),($1827|0))|0);
 $1829 = tempRet0;
 $1830 = (_bitshift64Shl(($1828|0),($1829|0),1)|0);
 $1831 = tempRet0;
 $1832 = $573;
 $1833 = $1832;
 $1834 = HEAP32[$1833>>2]|0;
 $1835 = (($1832) + 4)|0;
 $1836 = $1835;
 $1837 = HEAP32[$1836>>2]|0;
 $1838 = (_bitshift64Ashr(0,($1834|0),32)|0);
 $1839 = tempRet0;
 $1840 = $912;
 $1841 = $1840;
 $1842 = HEAP32[$1841>>2]|0;
 $1843 = (($1840) + 4)|0;
 $1844 = $1843;
 $1845 = HEAP32[$1844>>2]|0;
 $1846 = (_bitshift64Ashr(0,($1842|0),32)|0);
 $1847 = tempRet0;
 $1848 = (___muldi3(($1846|0),($1847|0),($1838|0),($1839|0))|0);
 $1849 = tempRet0;
 $1850 = (_i64Add(($1830|0),($1831|0),($1848|0),($1849|0))|0);
 $1851 = tempRet0;
 $1852 = $925;
 $1853 = $1852;
 $1854 = HEAP32[$1853>>2]|0;
 $1855 = (($1852) + 4)|0;
 $1856 = $1855;
 $1857 = HEAP32[$1856>>2]|0;
 $1858 = (_bitshift64Ashr(0,($1854|0),32)|0);
 $1859 = tempRet0;
 $1860 = $560;
 $1861 = $1860;
 $1862 = HEAP32[$1861>>2]|0;
 $1863 = (($1860) + 4)|0;
 $1864 = $1863;
 $1865 = HEAP32[$1864>>2]|0;
 $1866 = (_bitshift64Ashr(0,($1862|0),32)|0);
 $1867 = tempRet0;
 $1868 = (___muldi3(($1866|0),($1867|0),($1858|0),($1859|0))|0);
 $1869 = tempRet0;
 $1870 = (_i64Add(($1850|0),($1851|0),($1868|0),($1869|0))|0);
 $1871 = tempRet0;
 $1872 = ((($0)) + 112|0);
 $1873 = $1872;
 $1874 = $1873;
 HEAP32[$1874>>2] = $1870;
 $1875 = (($1873) + 4)|0;
 $1876 = $1875;
 HEAP32[$1876>>2] = $1871;
 $1877 = $738;
 $1878 = $1877;
 $1879 = HEAP32[$1878>>2]|0;
 $1880 = (($1877) + 4)|0;
 $1881 = $1880;
 $1882 = HEAP32[$1881>>2]|0;
 $1883 = (_bitshift64Ashr(0,($1879|0),32)|0);
 $1884 = tempRet0;
 $1885 = $912;
 $1886 = $1885;
 $1887 = HEAP32[$1886>>2]|0;
 $1888 = (($1885) + 4)|0;
 $1889 = $1888;
 $1890 = HEAP32[$1889>>2]|0;
 $1891 = (_bitshift64Ashr(0,($1887|0),32)|0);
 $1892 = tempRet0;
 $1893 = (___muldi3(($1891|0),($1892|0),($1883|0),($1884|0))|0);
 $1894 = tempRet0;
 $1895 = $925;
 $1896 = $1895;
 $1897 = HEAP32[$1896>>2]|0;
 $1898 = (($1895) + 4)|0;
 $1899 = $1898;
 $1900 = HEAP32[$1899>>2]|0;
 $1901 = (_bitshift64Ashr(0,($1897|0),32)|0);
 $1902 = tempRet0;
 $1903 = $725;
 $1904 = $1903;
 $1905 = HEAP32[$1904>>2]|0;
 $1906 = (($1903) + 4)|0;
 $1907 = $1906;
 $1908 = HEAP32[$1907>>2]|0;
 $1909 = (_bitshift64Ashr(0,($1905|0),32)|0);
 $1910 = tempRet0;
 $1911 = (___muldi3(($1909|0),($1910|0),($1901|0),($1902|0))|0);
 $1912 = tempRet0;
 $1913 = (_i64Add(($1911|0),($1912|0),($1893|0),($1894|0))|0);
 $1914 = tempRet0;
 $1915 = $573;
 $1916 = $1915;
 $1917 = HEAP32[$1916>>2]|0;
 $1918 = (($1915) + 4)|0;
 $1919 = $1918;
 $1920 = HEAP32[$1919>>2]|0;
 $1921 = (_bitshift64Ashr(0,($1917|0),32)|0);
 $1922 = tempRet0;
 $1923 = $1117;
 $1924 = $1923;
 $1925 = HEAP32[$1924>>2]|0;
 $1926 = (($1923) + 4)|0;
 $1927 = $1926;
 $1928 = HEAP32[$1927>>2]|0;
 $1929 = (_bitshift64Ashr(0,($1925|0),32)|0);
 $1930 = tempRet0;
 $1931 = (___muldi3(($1929|0),($1930|0),($1921|0),($1922|0))|0);
 $1932 = tempRet0;
 $1933 = (_i64Add(($1913|0),($1914|0),($1931|0),($1932|0))|0);
 $1934 = tempRet0;
 $1935 = $1130;
 $1936 = $1935;
 $1937 = HEAP32[$1936>>2]|0;
 $1938 = (($1935) + 4)|0;
 $1939 = $1938;
 $1940 = HEAP32[$1939>>2]|0;
 $1941 = (_bitshift64Ashr(0,($1937|0),32)|0);
 $1942 = tempRet0;
 $1943 = $560;
 $1944 = $1943;
 $1945 = HEAP32[$1944>>2]|0;
 $1946 = (($1943) + 4)|0;
 $1947 = $1946;
 $1948 = HEAP32[$1947>>2]|0;
 $1949 = (_bitshift64Ashr(0,($1945|0),32)|0);
 $1950 = tempRet0;
 $1951 = (___muldi3(($1949|0),($1950|0),($1941|0),($1942|0))|0);
 $1952 = tempRet0;
 $1953 = (_i64Add(($1933|0),($1934|0),($1951|0),($1952|0))|0);
 $1954 = tempRet0;
 $1955 = ((($0)) + 120|0);
 $1956 = $1955;
 $1957 = $1956;
 HEAP32[$1957>>2] = $1953;
 $1958 = (($1956) + 4)|0;
 $1959 = $1958;
 HEAP32[$1959>>2] = $1954;
 $1960 = $925;
 $1961 = $1960;
 $1962 = HEAP32[$1961>>2]|0;
 $1963 = (($1960) + 4)|0;
 $1964 = $1963;
 $1965 = HEAP32[$1964>>2]|0;
 $1966 = (_bitshift64Ashr(0,($1962|0),32)|0);
 $1967 = tempRet0;
 $1968 = $912;
 $1969 = $1968;
 $1970 = HEAP32[$1969>>2]|0;
 $1971 = (($1968) + 4)|0;
 $1972 = $1971;
 $1973 = HEAP32[$1972>>2]|0;
 $1974 = (_bitshift64Ashr(0,($1970|0),32)|0);
 $1975 = tempRet0;
 $1976 = (___muldi3(($1974|0),($1975|0),($1966|0),($1967|0))|0);
 $1977 = tempRet0;
 $1978 = $738;
 $1979 = $1978;
 $1980 = HEAP32[$1979>>2]|0;
 $1981 = (($1978) + 4)|0;
 $1982 = $1981;
 $1983 = HEAP32[$1982>>2]|0;
 $1984 = (_bitshift64Ashr(0,($1980|0),32)|0);
 $1985 = tempRet0;
 $1986 = $1117;
 $1987 = $1986;
 $1988 = HEAP32[$1987>>2]|0;
 $1989 = (($1986) + 4)|0;
 $1990 = $1989;
 $1991 = HEAP32[$1990>>2]|0;
 $1992 = (_bitshift64Ashr(0,($1988|0),32)|0);
 $1993 = tempRet0;
 $1994 = (___muldi3(($1992|0),($1993|0),($1984|0),($1985|0))|0);
 $1995 = tempRet0;
 $1996 = $1130;
 $1997 = $1996;
 $1998 = HEAP32[$1997>>2]|0;
 $1999 = (($1996) + 4)|0;
 $2000 = $1999;
 $2001 = HEAP32[$2000>>2]|0;
 $2002 = (_bitshift64Ashr(0,($1998|0),32)|0);
 $2003 = tempRet0;
 $2004 = $725;
 $2005 = $2004;
 $2006 = HEAP32[$2005>>2]|0;
 $2007 = (($2004) + 4)|0;
 $2008 = $2007;
 $2009 = HEAP32[$2008>>2]|0;
 $2010 = (_bitshift64Ashr(0,($2006|0),32)|0);
 $2011 = tempRet0;
 $2012 = (___muldi3(($2010|0),($2011|0),($2002|0),($2003|0))|0);
 $2013 = tempRet0;
 $2014 = (_i64Add(($2012|0),($2013|0),($1994|0),($1995|0))|0);
 $2015 = tempRet0;
 $2016 = (_bitshift64Shl(($2014|0),($2015|0),1)|0);
 $2017 = tempRet0;
 $2018 = (_i64Add(($2016|0),($2017|0),($1976|0),($1977|0))|0);
 $2019 = tempRet0;
 $2020 = ((($0)) + 128|0);
 $2021 = $2020;
 $2022 = $2021;
 HEAP32[$2022>>2] = $2018;
 $2023 = (($2021) + 4)|0;
 $2024 = $2023;
 HEAP32[$2024>>2] = $2019;
 $2025 = $925;
 $2026 = $2025;
 $2027 = HEAP32[$2026>>2]|0;
 $2028 = (($2025) + 4)|0;
 $2029 = $2028;
 $2030 = HEAP32[$2029>>2]|0;
 $2031 = (_bitshift64Ashr(0,($2027|0),32)|0);
 $2032 = tempRet0;
 $2033 = $1117;
 $2034 = $2033;
 $2035 = HEAP32[$2034>>2]|0;
 $2036 = (($2033) + 4)|0;
 $2037 = $2036;
 $2038 = HEAP32[$2037>>2]|0;
 $2039 = (_bitshift64Ashr(0,($2035|0),32)|0);
 $2040 = tempRet0;
 $2041 = (___muldi3(($2039|0),($2040|0),($2031|0),($2032|0))|0);
 $2042 = tempRet0;
 $2043 = $1130;
 $2044 = $2043;
 $2045 = HEAP32[$2044>>2]|0;
 $2046 = (($2043) + 4)|0;
 $2047 = $2046;
 $2048 = HEAP32[$2047>>2]|0;
 $2049 = (_bitshift64Ashr(0,($2045|0),32)|0);
 $2050 = tempRet0;
 $2051 = $912;
 $2052 = $2051;
 $2053 = HEAP32[$2052>>2]|0;
 $2054 = (($2051) + 4)|0;
 $2055 = $2054;
 $2056 = HEAP32[$2055>>2]|0;
 $2057 = (_bitshift64Ashr(0,($2053|0),32)|0);
 $2058 = tempRet0;
 $2059 = (___muldi3(($2057|0),($2058|0),($2049|0),($2050|0))|0);
 $2060 = tempRet0;
 $2061 = (_i64Add(($2059|0),($2060|0),($2041|0),($2042|0))|0);
 $2062 = tempRet0;
 $2063 = ((($0)) + 136|0);
 $2064 = $2063;
 $2065 = $2064;
 HEAP32[$2065>>2] = $2061;
 $2066 = (($2064) + 4)|0;
 $2067 = $2066;
 HEAP32[$2067>>2] = $2062;
 $2068 = $1130;
 $2069 = $2068;
 $2070 = HEAP32[$2069>>2]|0;
 $2071 = (($2068) + 4)|0;
 $2072 = $2071;
 $2073 = HEAP32[$2072>>2]|0;
 $2074 = (_bitshift64Ashr(0,($2070|0),31)|0);
 $2075 = tempRet0;
 $2076 = $1117;
 $2077 = $2076;
 $2078 = HEAP32[$2077>>2]|0;
 $2079 = (($2076) + 4)|0;
 $2080 = $2079;
 $2081 = HEAP32[$2080>>2]|0;
 $2082 = (_bitshift64Ashr(0,($2078|0),32)|0);
 $2083 = tempRet0;
 $2084 = (___muldi3(($2082|0),($2083|0),($2074|0),($2075|0))|0);
 $2085 = tempRet0;
 $2086 = ((($0)) + 144|0);
 $2087 = $2086;
 $2088 = $2087;
 HEAP32[$2088>>2] = $2084;
 $2089 = (($2087) + 4)|0;
 $2090 = $2089;
 HEAP32[$2090>>2] = $2085;
 return;
}
function _freduce_degree($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 144|0);
 $2 = $1;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 64|0);
 $9 = $8;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = (($9) + 4)|0;
 $13 = $12;
 $14 = HEAP32[$13>>2]|0;
 $15 = (___muldi3(($4|0),($7|0),18,0)|0);
 $16 = tempRet0;
 $17 = (_i64Add(($11|0),($14|0),($4|0),($7|0))|0);
 $18 = tempRet0;
 $19 = (_i64Add(($17|0),($18|0),($15|0),($16|0))|0);
 $20 = tempRet0;
 $21 = $8;
 $22 = $21;
 HEAP32[$22>>2] = $19;
 $23 = (($21) + 4)|0;
 $24 = $23;
 HEAP32[$24>>2] = $20;
 $25 = ((($0)) + 136|0);
 $26 = $25;
 $27 = $26;
 $28 = HEAP32[$27>>2]|0;
 $29 = (($26) + 4)|0;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = ((($0)) + 56|0);
 $33 = $32;
 $34 = $33;
 $35 = HEAP32[$34>>2]|0;
 $36 = (($33) + 4)|0;
 $37 = $36;
 $38 = HEAP32[$37>>2]|0;
 $39 = (___muldi3(($28|0),($31|0),18,0)|0);
 $40 = tempRet0;
 $41 = (_i64Add(($35|0),($38|0),($28|0),($31|0))|0);
 $42 = tempRet0;
 $43 = (_i64Add(($41|0),($42|0),($39|0),($40|0))|0);
 $44 = tempRet0;
 $45 = $32;
 $46 = $45;
 HEAP32[$46>>2] = $43;
 $47 = (($45) + 4)|0;
 $48 = $47;
 HEAP32[$48>>2] = $44;
 $49 = ((($0)) + 128|0);
 $50 = $49;
 $51 = $50;
 $52 = HEAP32[$51>>2]|0;
 $53 = (($50) + 4)|0;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = ((($0)) + 48|0);
 $57 = $56;
 $58 = $57;
 $59 = HEAP32[$58>>2]|0;
 $60 = (($57) + 4)|0;
 $61 = $60;
 $62 = HEAP32[$61>>2]|0;
 $63 = (___muldi3(($52|0),($55|0),18,0)|0);
 $64 = tempRet0;
 $65 = (_i64Add(($59|0),($62|0),($52|0),($55|0))|0);
 $66 = tempRet0;
 $67 = (_i64Add(($65|0),($66|0),($63|0),($64|0))|0);
 $68 = tempRet0;
 $69 = $56;
 $70 = $69;
 HEAP32[$70>>2] = $67;
 $71 = (($69) + 4)|0;
 $72 = $71;
 HEAP32[$72>>2] = $68;
 $73 = ((($0)) + 120|0);
 $74 = $73;
 $75 = $74;
 $76 = HEAP32[$75>>2]|0;
 $77 = (($74) + 4)|0;
 $78 = $77;
 $79 = HEAP32[$78>>2]|0;
 $80 = ((($0)) + 40|0);
 $81 = $80;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = (___muldi3(($76|0),($79|0),18,0)|0);
 $88 = tempRet0;
 $89 = (_i64Add(($83|0),($86|0),($76|0),($79|0))|0);
 $90 = tempRet0;
 $91 = (_i64Add(($89|0),($90|0),($87|0),($88|0))|0);
 $92 = tempRet0;
 $93 = $80;
 $94 = $93;
 HEAP32[$94>>2] = $91;
 $95 = (($93) + 4)|0;
 $96 = $95;
 HEAP32[$96>>2] = $92;
 $97 = ((($0)) + 112|0);
 $98 = $97;
 $99 = $98;
 $100 = HEAP32[$99>>2]|0;
 $101 = (($98) + 4)|0;
 $102 = $101;
 $103 = HEAP32[$102>>2]|0;
 $104 = ((($0)) + 32|0);
 $105 = $104;
 $106 = $105;
 $107 = HEAP32[$106>>2]|0;
 $108 = (($105) + 4)|0;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (___muldi3(($100|0),($103|0),18,0)|0);
 $112 = tempRet0;
 $113 = (_i64Add(($107|0),($110|0),($100|0),($103|0))|0);
 $114 = tempRet0;
 $115 = (_i64Add(($113|0),($114|0),($111|0),($112|0))|0);
 $116 = tempRet0;
 $117 = $104;
 $118 = $117;
 HEAP32[$118>>2] = $115;
 $119 = (($117) + 4)|0;
 $120 = $119;
 HEAP32[$120>>2] = $116;
 $121 = ((($0)) + 104|0);
 $122 = $121;
 $123 = $122;
 $124 = HEAP32[$123>>2]|0;
 $125 = (($122) + 4)|0;
 $126 = $125;
 $127 = HEAP32[$126>>2]|0;
 $128 = ((($0)) + 24|0);
 $129 = $128;
 $130 = $129;
 $131 = HEAP32[$130>>2]|0;
 $132 = (($129) + 4)|0;
 $133 = $132;
 $134 = HEAP32[$133>>2]|0;
 $135 = (___muldi3(($124|0),($127|0),18,0)|0);
 $136 = tempRet0;
 $137 = (_i64Add(($131|0),($134|0),($124|0),($127|0))|0);
 $138 = tempRet0;
 $139 = (_i64Add(($137|0),($138|0),($135|0),($136|0))|0);
 $140 = tempRet0;
 $141 = $128;
 $142 = $141;
 HEAP32[$142>>2] = $139;
 $143 = (($141) + 4)|0;
 $144 = $143;
 HEAP32[$144>>2] = $140;
 $145 = ((($0)) + 96|0);
 $146 = $145;
 $147 = $146;
 $148 = HEAP32[$147>>2]|0;
 $149 = (($146) + 4)|0;
 $150 = $149;
 $151 = HEAP32[$150>>2]|0;
 $152 = ((($0)) + 16|0);
 $153 = $152;
 $154 = $153;
 $155 = HEAP32[$154>>2]|0;
 $156 = (($153) + 4)|0;
 $157 = $156;
 $158 = HEAP32[$157>>2]|0;
 $159 = (___muldi3(($148|0),($151|0),18,0)|0);
 $160 = tempRet0;
 $161 = (_i64Add(($155|0),($158|0),($148|0),($151|0))|0);
 $162 = tempRet0;
 $163 = (_i64Add(($161|0),($162|0),($159|0),($160|0))|0);
 $164 = tempRet0;
 $165 = $152;
 $166 = $165;
 HEAP32[$166>>2] = $163;
 $167 = (($165) + 4)|0;
 $168 = $167;
 HEAP32[$168>>2] = $164;
 $169 = ((($0)) + 88|0);
 $170 = $169;
 $171 = $170;
 $172 = HEAP32[$171>>2]|0;
 $173 = (($170) + 4)|0;
 $174 = $173;
 $175 = HEAP32[$174>>2]|0;
 $176 = ((($0)) + 8|0);
 $177 = $176;
 $178 = $177;
 $179 = HEAP32[$178>>2]|0;
 $180 = (($177) + 4)|0;
 $181 = $180;
 $182 = HEAP32[$181>>2]|0;
 $183 = (___muldi3(($172|0),($175|0),18,0)|0);
 $184 = tempRet0;
 $185 = (_i64Add(($179|0),($182|0),($172|0),($175|0))|0);
 $186 = tempRet0;
 $187 = (_i64Add(($185|0),($186|0),($183|0),($184|0))|0);
 $188 = tempRet0;
 $189 = $176;
 $190 = $189;
 HEAP32[$190>>2] = $187;
 $191 = (($189) + 4)|0;
 $192 = $191;
 HEAP32[$192>>2] = $188;
 $193 = ((($0)) + 80|0);
 $194 = $193;
 $195 = $194;
 $196 = HEAP32[$195>>2]|0;
 $197 = (($194) + 4)|0;
 $198 = $197;
 $199 = HEAP32[$198>>2]|0;
 $200 = (_bitshift64Shl(($196|0),($199|0),4)|0);
 $201 = tempRet0;
 $202 = $0;
 $203 = $202;
 $204 = HEAP32[$203>>2]|0;
 $205 = (($202) + 4)|0;
 $206 = $205;
 $207 = HEAP32[$206>>2]|0;
 $208 = (_i64Add(($204|0),($207|0),($200|0),($201|0))|0);
 $209 = tempRet0;
 $210 = (_bitshift64Shl(($196|0),($199|0),1)|0);
 $211 = tempRet0;
 $212 = (_i64Add(($208|0),($209|0),($210|0),($211|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($212|0),($213|0),($196|0),($199|0))|0);
 $215 = tempRet0;
 $216 = $0;
 $217 = $216;
 HEAP32[$217>>2] = $214;
 $218 = (($216) + 4)|0;
 $219 = $218;
 HEAP32[$219>>2] = $215;
 return;
}
function _freduce_coefficients($0) {
 $0 = $0|0;
 var $$036 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 80|0);
 $2 = $1;
 $3 = $2;
 HEAP32[$3>>2] = 0;
 $4 = (($2) + 4)|0;
 $5 = $4;
 HEAP32[$5>>2] = 0;
 $$036 = 0;
 while(1) {
  $6 = (($0) + ($$036<<3)|0);
  $7 = $6;
  $8 = $7;
  $9 = HEAP32[$8>>2]|0;
  $10 = (($7) + 4)|0;
  $11 = $10;
  $12 = HEAP32[$11>>2]|0;
  $13 = (_div_by_2_26($9,$12)|0);
  $14 = tempRet0;
  $15 = (_bitshift64Shl(($13|0),($14|0),26)|0);
  $16 = tempRet0;
  $17 = (_i64Subtract(($9|0),($12|0),($15|0),($16|0))|0);
  $18 = tempRet0;
  $19 = $6;
  $20 = $19;
  HEAP32[$20>>2] = $17;
  $21 = (($19) + 4)|0;
  $22 = $21;
  HEAP32[$22>>2] = $18;
  $23 = $$036 | 1;
  $24 = (($0) + ($23<<3)|0);
  $25 = $24;
  $26 = $25;
  $27 = HEAP32[$26>>2]|0;
  $28 = (($25) + 4)|0;
  $29 = $28;
  $30 = HEAP32[$29>>2]|0;
  $31 = (_i64Add(($27|0),($30|0),($13|0),($14|0))|0);
  $32 = tempRet0;
  $33 = (_div_by_2_25($31,$32)|0);
  $34 = tempRet0;
  $35 = (_bitshift64Shl(($33|0),($34|0),25)|0);
  $36 = tempRet0;
  $37 = (_i64Subtract(($31|0),($32|0),($35|0),($36|0))|0);
  $38 = tempRet0;
  $39 = $24;
  $40 = $39;
  HEAP32[$40>>2] = $37;
  $41 = (($39) + 4)|0;
  $42 = $41;
  HEAP32[$42>>2] = $38;
  $43 = (($$036) + 2)|0;
  $44 = (($0) + ($43<<3)|0);
  $45 = $44;
  $46 = $45;
  $47 = HEAP32[$46>>2]|0;
  $48 = (($45) + 4)|0;
  $49 = $48;
  $50 = HEAP32[$49>>2]|0;
  $51 = (_i64Add(($47|0),($50|0),($33|0),($34|0))|0);
  $52 = tempRet0;
  $53 = $44;
  $54 = $53;
  HEAP32[$54>>2] = $51;
  $55 = (($53) + 4)|0;
  $56 = $55;
  HEAP32[$56>>2] = $52;
  $57 = ($43>>>0)<(10);
  if ($57) {
   $$036 = $43;
  } else {
   break;
  }
 }
 $58 = $1;
 $59 = $58;
 $60 = HEAP32[$59>>2]|0;
 $61 = (($58) + 4)|0;
 $62 = $61;
 $63 = HEAP32[$62>>2]|0;
 $64 = $0;
 $65 = $64;
 $66 = HEAP32[$65>>2]|0;
 $67 = (($64) + 4)|0;
 $68 = $67;
 $69 = HEAP32[$68>>2]|0;
 $70 = (___muldi3(($60|0),($63|0),18,0)|0);
 $71 = tempRet0;
 $72 = (_i64Add(($66|0),($69|0),($60|0),($63|0))|0);
 $73 = tempRet0;
 $74 = (_i64Add(($72|0),($73|0),($70|0),($71|0))|0);
 $75 = tempRet0;
 $76 = $1;
 $77 = $76;
 HEAP32[$77>>2] = 0;
 $78 = (($76) + 4)|0;
 $79 = $78;
 HEAP32[$79>>2] = 0;
 $80 = (_div_by_2_26($74,$75)|0);
 $81 = tempRet0;
 $82 = (_bitshift64Shl(($80|0),($81|0),26)|0);
 $83 = tempRet0;
 $84 = (_i64Subtract(($74|0),($75|0),($82|0),($83|0))|0);
 $85 = tempRet0;
 $86 = $0;
 $87 = $86;
 HEAP32[$87>>2] = $84;
 $88 = (($86) + 4)|0;
 $89 = $88;
 HEAP32[$89>>2] = $85;
 $90 = ((($0)) + 8|0);
 $91 = $90;
 $92 = $91;
 $93 = HEAP32[$92>>2]|0;
 $94 = (($91) + 4)|0;
 $95 = $94;
 $96 = HEAP32[$95>>2]|0;
 $97 = (_i64Add(($93|0),($96|0),($80|0),($81|0))|0);
 $98 = tempRet0;
 $99 = $90;
 $100 = $99;
 HEAP32[$100>>2] = $97;
 $101 = (($99) + 4)|0;
 $102 = $101;
 HEAP32[$102>>2] = $98;
 return;
}
function _div_by_2_26($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 >> 31;
 $3 = $2 >>> 6;
 $4 = (_i64Add(($3|0),0,($0|0),($1|0))|0);
 $5 = tempRet0;
 $6 = (_bitshift64Ashr(($4|0),($5|0),26)|0);
 $7 = tempRet0;
 tempRet0 = ($7);
 return ($6|0);
}
function _div_by_2_25($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 >> 31;
 $3 = $2 >>> 7;
 $4 = (_i64Add(($3|0),0,($0|0),($1|0))|0);
 $5 = tempRet0;
 $6 = (_bitshift64Ashr(($4|0),($5|0),25)|0);
 $7 = tempRet0;
 tempRet0 = ($7);
 return ($6|0);
}
function _fsquare($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $2 = sp;
 _fsquare_inner($2,$1);
 _freduce_degree($2);
 _freduce_coefficients($2);
 dest=$0; src=$2; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _fsquare_inner($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0;
 var $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0;
 var $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0;
 var $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0;
 var $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0;
 var $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0;
 var $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0;
 var $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0;
 var $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0;
 var $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0;
 var $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0;
 var $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0;
 var $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0;
 var $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0;
 var $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0;
 var $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0;
 var $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0;
 var $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0;
 var $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0;
 var $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0;
 var $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = (_bitshift64Ashr(0,($4|0),32)|0);
 $9 = tempRet0;
 $10 = (___muldi3(($8|0),($9|0),($8|0),($9|0))|0);
 $11 = tempRet0;
 $12 = $0;
 $13 = $12;
 HEAP32[$13>>2] = $10;
 $14 = (($12) + 4)|0;
 $15 = $14;
 HEAP32[$15>>2] = $11;
 $16 = $1;
 $17 = $16;
 $18 = HEAP32[$17>>2]|0;
 $19 = (($16) + 4)|0;
 $20 = $19;
 $21 = HEAP32[$20>>2]|0;
 $22 = (_bitshift64Ashr(0,($18|0),31)|0);
 $23 = tempRet0;
 $24 = ((($1)) + 8|0);
 $25 = $24;
 $26 = $25;
 $27 = HEAP32[$26>>2]|0;
 $28 = (($25) + 4)|0;
 $29 = $28;
 $30 = HEAP32[$29>>2]|0;
 $31 = (_bitshift64Ashr(0,($27|0),32)|0);
 $32 = tempRet0;
 $33 = (___muldi3(($31|0),($32|0),($22|0),($23|0))|0);
 $34 = tempRet0;
 $35 = ((($0)) + 8|0);
 $36 = $35;
 $37 = $36;
 HEAP32[$37>>2] = $33;
 $38 = (($36) + 4)|0;
 $39 = $38;
 HEAP32[$39>>2] = $34;
 $40 = $24;
 $41 = $40;
 $42 = HEAP32[$41>>2]|0;
 $43 = (($40) + 4)|0;
 $44 = $43;
 $45 = HEAP32[$44>>2]|0;
 $46 = (_bitshift64Ashr(0,($42|0),32)|0);
 $47 = tempRet0;
 $48 = (___muldi3(($46|0),($47|0),($46|0),($47|0))|0);
 $49 = tempRet0;
 $50 = $1;
 $51 = $50;
 $52 = HEAP32[$51>>2]|0;
 $53 = (($50) + 4)|0;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = (_bitshift64Ashr(0,($52|0),32)|0);
 $57 = tempRet0;
 $58 = ((($1)) + 16|0);
 $59 = $58;
 $60 = $59;
 $61 = HEAP32[$60>>2]|0;
 $62 = (($59) + 4)|0;
 $63 = $62;
 $64 = HEAP32[$63>>2]|0;
 $65 = (_bitshift64Ashr(0,($61|0),32)|0);
 $66 = tempRet0;
 $67 = (___muldi3(($65|0),($66|0),($56|0),($57|0))|0);
 $68 = tempRet0;
 $69 = (_i64Add(($67|0),($68|0),($48|0),($49|0))|0);
 $70 = tempRet0;
 $71 = (_bitshift64Shl(($69|0),($70|0),1)|0);
 $72 = tempRet0;
 $73 = ((($0)) + 16|0);
 $74 = $73;
 $75 = $74;
 HEAP32[$75>>2] = $71;
 $76 = (($74) + 4)|0;
 $77 = $76;
 HEAP32[$77>>2] = $72;
 $78 = $24;
 $79 = $78;
 $80 = HEAP32[$79>>2]|0;
 $81 = (($78) + 4)|0;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (_bitshift64Ashr(0,($80|0),32)|0);
 $85 = tempRet0;
 $86 = $58;
 $87 = $86;
 $88 = HEAP32[$87>>2]|0;
 $89 = (($86) + 4)|0;
 $90 = $89;
 $91 = HEAP32[$90>>2]|0;
 $92 = (_bitshift64Ashr(0,($88|0),32)|0);
 $93 = tempRet0;
 $94 = (___muldi3(($92|0),($93|0),($84|0),($85|0))|0);
 $95 = tempRet0;
 $96 = $1;
 $97 = $96;
 $98 = HEAP32[$97>>2]|0;
 $99 = (($96) + 4)|0;
 $100 = $99;
 $101 = HEAP32[$100>>2]|0;
 $102 = (_bitshift64Ashr(0,($98|0),32)|0);
 $103 = tempRet0;
 $104 = ((($1)) + 24|0);
 $105 = $104;
 $106 = $105;
 $107 = HEAP32[$106>>2]|0;
 $108 = (($105) + 4)|0;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (_bitshift64Ashr(0,($107|0),32)|0);
 $112 = tempRet0;
 $113 = (___muldi3(($111|0),($112|0),($102|0),($103|0))|0);
 $114 = tempRet0;
 $115 = (_i64Add(($113|0),($114|0),($94|0),($95|0))|0);
 $116 = tempRet0;
 $117 = (_bitshift64Shl(($115|0),($116|0),1)|0);
 $118 = tempRet0;
 $119 = ((($0)) + 24|0);
 $120 = $119;
 $121 = $120;
 HEAP32[$121>>2] = $117;
 $122 = (($120) + 4)|0;
 $123 = $122;
 HEAP32[$123>>2] = $118;
 $124 = $58;
 $125 = $124;
 $126 = HEAP32[$125>>2]|0;
 $127 = (($124) + 4)|0;
 $128 = $127;
 $129 = HEAP32[$128>>2]|0;
 $130 = (_bitshift64Ashr(0,($126|0),32)|0);
 $131 = tempRet0;
 $132 = (___muldi3(($130|0),($131|0),($130|0),($131|0))|0);
 $133 = tempRet0;
 $134 = $24;
 $135 = $134;
 $136 = HEAP32[$135>>2]|0;
 $137 = (($134) + 4)|0;
 $138 = $137;
 $139 = HEAP32[$138>>2]|0;
 $140 = (_bitshift64Ashr(0,($136|0),30)|0);
 $141 = tempRet0;
 $142 = $104;
 $143 = $142;
 $144 = HEAP32[$143>>2]|0;
 $145 = (($142) + 4)|0;
 $146 = $145;
 $147 = HEAP32[$146>>2]|0;
 $148 = (_bitshift64Ashr(0,($144|0),32)|0);
 $149 = tempRet0;
 $150 = (___muldi3(($148|0),($149|0),($140|0),($141|0))|0);
 $151 = tempRet0;
 $152 = (_i64Add(($150|0),($151|0),($132|0),($133|0))|0);
 $153 = tempRet0;
 $154 = $1;
 $155 = $154;
 $156 = HEAP32[$155>>2]|0;
 $157 = (($154) + 4)|0;
 $158 = $157;
 $159 = HEAP32[$158>>2]|0;
 $160 = (_bitshift64Ashr(0,($156|0),31)|0);
 $161 = tempRet0;
 $162 = ((($1)) + 32|0);
 $163 = $162;
 $164 = $163;
 $165 = HEAP32[$164>>2]|0;
 $166 = (($163) + 4)|0;
 $167 = $166;
 $168 = HEAP32[$167>>2]|0;
 $169 = (_bitshift64Ashr(0,($165|0),32)|0);
 $170 = tempRet0;
 $171 = (___muldi3(($169|0),($170|0),($160|0),($161|0))|0);
 $172 = tempRet0;
 $173 = (_i64Add(($152|0),($153|0),($171|0),($172|0))|0);
 $174 = tempRet0;
 $175 = ((($0)) + 32|0);
 $176 = $175;
 $177 = $176;
 HEAP32[$177>>2] = $173;
 $178 = (($176) + 4)|0;
 $179 = $178;
 HEAP32[$179>>2] = $174;
 $180 = $58;
 $181 = $180;
 $182 = HEAP32[$181>>2]|0;
 $183 = (($180) + 4)|0;
 $184 = $183;
 $185 = HEAP32[$184>>2]|0;
 $186 = (_bitshift64Ashr(0,($182|0),32)|0);
 $187 = tempRet0;
 $188 = $104;
 $189 = $188;
 $190 = HEAP32[$189>>2]|0;
 $191 = (($188) + 4)|0;
 $192 = $191;
 $193 = HEAP32[$192>>2]|0;
 $194 = (_bitshift64Ashr(0,($190|0),32)|0);
 $195 = tempRet0;
 $196 = (___muldi3(($194|0),($195|0),($186|0),($187|0))|0);
 $197 = tempRet0;
 $198 = $24;
 $199 = $198;
 $200 = HEAP32[$199>>2]|0;
 $201 = (($198) + 4)|0;
 $202 = $201;
 $203 = HEAP32[$202>>2]|0;
 $204 = (_bitshift64Ashr(0,($200|0),32)|0);
 $205 = tempRet0;
 $206 = $162;
 $207 = $206;
 $208 = HEAP32[$207>>2]|0;
 $209 = (($206) + 4)|0;
 $210 = $209;
 $211 = HEAP32[$210>>2]|0;
 $212 = (_bitshift64Ashr(0,($208|0),32)|0);
 $213 = tempRet0;
 $214 = (___muldi3(($212|0),($213|0),($204|0),($205|0))|0);
 $215 = tempRet0;
 $216 = (_i64Add(($214|0),($215|0),($196|0),($197|0))|0);
 $217 = tempRet0;
 $218 = $1;
 $219 = $218;
 $220 = HEAP32[$219>>2]|0;
 $221 = (($218) + 4)|0;
 $222 = $221;
 $223 = HEAP32[$222>>2]|0;
 $224 = (_bitshift64Ashr(0,($220|0),32)|0);
 $225 = tempRet0;
 $226 = ((($1)) + 40|0);
 $227 = $226;
 $228 = $227;
 $229 = HEAP32[$228>>2]|0;
 $230 = (($227) + 4)|0;
 $231 = $230;
 $232 = HEAP32[$231>>2]|0;
 $233 = (_bitshift64Ashr(0,($229|0),32)|0);
 $234 = tempRet0;
 $235 = (___muldi3(($233|0),($234|0),($224|0),($225|0))|0);
 $236 = tempRet0;
 $237 = (_i64Add(($216|0),($217|0),($235|0),($236|0))|0);
 $238 = tempRet0;
 $239 = (_bitshift64Shl(($237|0),($238|0),1)|0);
 $240 = tempRet0;
 $241 = ((($0)) + 40|0);
 $242 = $241;
 $243 = $242;
 HEAP32[$243>>2] = $239;
 $244 = (($242) + 4)|0;
 $245 = $244;
 HEAP32[$245>>2] = $240;
 $246 = $104;
 $247 = $246;
 $248 = HEAP32[$247>>2]|0;
 $249 = (($246) + 4)|0;
 $250 = $249;
 $251 = HEAP32[$250>>2]|0;
 $252 = (_bitshift64Ashr(0,($248|0),32)|0);
 $253 = tempRet0;
 $254 = (___muldi3(($252|0),($253|0),($252|0),($253|0))|0);
 $255 = tempRet0;
 $256 = $58;
 $257 = $256;
 $258 = HEAP32[$257>>2]|0;
 $259 = (($256) + 4)|0;
 $260 = $259;
 $261 = HEAP32[$260>>2]|0;
 $262 = (_bitshift64Ashr(0,($258|0),32)|0);
 $263 = tempRet0;
 $264 = $162;
 $265 = $264;
 $266 = HEAP32[$265>>2]|0;
 $267 = (($264) + 4)|0;
 $268 = $267;
 $269 = HEAP32[$268>>2]|0;
 $270 = (_bitshift64Ashr(0,($266|0),32)|0);
 $271 = tempRet0;
 $272 = (___muldi3(($270|0),($271|0),($262|0),($263|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($254|0),($255|0))|0);
 $275 = tempRet0;
 $276 = $1;
 $277 = $276;
 $278 = HEAP32[$277>>2]|0;
 $279 = (($276) + 4)|0;
 $280 = $279;
 $281 = HEAP32[$280>>2]|0;
 $282 = (_bitshift64Ashr(0,($278|0),32)|0);
 $283 = tempRet0;
 $284 = ((($1)) + 48|0);
 $285 = $284;
 $286 = $285;
 $287 = HEAP32[$286>>2]|0;
 $288 = (($285) + 4)|0;
 $289 = $288;
 $290 = HEAP32[$289>>2]|0;
 $291 = (_bitshift64Ashr(0,($287|0),32)|0);
 $292 = tempRet0;
 $293 = (___muldi3(($291|0),($292|0),($282|0),($283|0))|0);
 $294 = tempRet0;
 $295 = (_i64Add(($274|0),($275|0),($293|0),($294|0))|0);
 $296 = tempRet0;
 $297 = $24;
 $298 = $297;
 $299 = HEAP32[$298>>2]|0;
 $300 = (($297) + 4)|0;
 $301 = $300;
 $302 = HEAP32[$301>>2]|0;
 $303 = (_bitshift64Ashr(0,($299|0),31)|0);
 $304 = tempRet0;
 $305 = $226;
 $306 = $305;
 $307 = HEAP32[$306>>2]|0;
 $308 = (($305) + 4)|0;
 $309 = $308;
 $310 = HEAP32[$309>>2]|0;
 $311 = (_bitshift64Ashr(0,($307|0),32)|0);
 $312 = tempRet0;
 $313 = (___muldi3(($311|0),($312|0),($303|0),($304|0))|0);
 $314 = tempRet0;
 $315 = (_i64Add(($295|0),($296|0),($313|0),($314|0))|0);
 $316 = tempRet0;
 $317 = (_bitshift64Shl(($315|0),($316|0),1)|0);
 $318 = tempRet0;
 $319 = ((($0)) + 48|0);
 $320 = $319;
 $321 = $320;
 HEAP32[$321>>2] = $317;
 $322 = (($320) + 4)|0;
 $323 = $322;
 HEAP32[$323>>2] = $318;
 $324 = $104;
 $325 = $324;
 $326 = HEAP32[$325>>2]|0;
 $327 = (($324) + 4)|0;
 $328 = $327;
 $329 = HEAP32[$328>>2]|0;
 $330 = (_bitshift64Ashr(0,($326|0),32)|0);
 $331 = tempRet0;
 $332 = $162;
 $333 = $332;
 $334 = HEAP32[$333>>2]|0;
 $335 = (($332) + 4)|0;
 $336 = $335;
 $337 = HEAP32[$336>>2]|0;
 $338 = (_bitshift64Ashr(0,($334|0),32)|0);
 $339 = tempRet0;
 $340 = (___muldi3(($338|0),($339|0),($330|0),($331|0))|0);
 $341 = tempRet0;
 $342 = $58;
 $343 = $342;
 $344 = HEAP32[$343>>2]|0;
 $345 = (($342) + 4)|0;
 $346 = $345;
 $347 = HEAP32[$346>>2]|0;
 $348 = (_bitshift64Ashr(0,($344|0),32)|0);
 $349 = tempRet0;
 $350 = $226;
 $351 = $350;
 $352 = HEAP32[$351>>2]|0;
 $353 = (($350) + 4)|0;
 $354 = $353;
 $355 = HEAP32[$354>>2]|0;
 $356 = (_bitshift64Ashr(0,($352|0),32)|0);
 $357 = tempRet0;
 $358 = (___muldi3(($356|0),($357|0),($348|0),($349|0))|0);
 $359 = tempRet0;
 $360 = (_i64Add(($358|0),($359|0),($340|0),($341|0))|0);
 $361 = tempRet0;
 $362 = $24;
 $363 = $362;
 $364 = HEAP32[$363>>2]|0;
 $365 = (($362) + 4)|0;
 $366 = $365;
 $367 = HEAP32[$366>>2]|0;
 $368 = (_bitshift64Ashr(0,($364|0),32)|0);
 $369 = tempRet0;
 $370 = $284;
 $371 = $370;
 $372 = HEAP32[$371>>2]|0;
 $373 = (($370) + 4)|0;
 $374 = $373;
 $375 = HEAP32[$374>>2]|0;
 $376 = (_bitshift64Ashr(0,($372|0),32)|0);
 $377 = tempRet0;
 $378 = (___muldi3(($376|0),($377|0),($368|0),($369|0))|0);
 $379 = tempRet0;
 $380 = (_i64Add(($360|0),($361|0),($378|0),($379|0))|0);
 $381 = tempRet0;
 $382 = $1;
 $383 = $382;
 $384 = HEAP32[$383>>2]|0;
 $385 = (($382) + 4)|0;
 $386 = $385;
 $387 = HEAP32[$386>>2]|0;
 $388 = (_bitshift64Ashr(0,($384|0),32)|0);
 $389 = tempRet0;
 $390 = ((($1)) + 56|0);
 $391 = $390;
 $392 = $391;
 $393 = HEAP32[$392>>2]|0;
 $394 = (($391) + 4)|0;
 $395 = $394;
 $396 = HEAP32[$395>>2]|0;
 $397 = (_bitshift64Ashr(0,($393|0),32)|0);
 $398 = tempRet0;
 $399 = (___muldi3(($397|0),($398|0),($388|0),($389|0))|0);
 $400 = tempRet0;
 $401 = (_i64Add(($380|0),($381|0),($399|0),($400|0))|0);
 $402 = tempRet0;
 $403 = (_bitshift64Shl(($401|0),($402|0),1)|0);
 $404 = tempRet0;
 $405 = ((($0)) + 56|0);
 $406 = $405;
 $407 = $406;
 HEAP32[$407>>2] = $403;
 $408 = (($406) + 4)|0;
 $409 = $408;
 HEAP32[$409>>2] = $404;
 $410 = $162;
 $411 = $410;
 $412 = HEAP32[$411>>2]|0;
 $413 = (($410) + 4)|0;
 $414 = $413;
 $415 = HEAP32[$414>>2]|0;
 $416 = (_bitshift64Ashr(0,($412|0),32)|0);
 $417 = tempRet0;
 $418 = (___muldi3(($416|0),($417|0),($416|0),($417|0))|0);
 $419 = tempRet0;
 $420 = $58;
 $421 = $420;
 $422 = HEAP32[$421>>2]|0;
 $423 = (($420) + 4)|0;
 $424 = $423;
 $425 = HEAP32[$424>>2]|0;
 $426 = (_bitshift64Ashr(0,($422|0),32)|0);
 $427 = tempRet0;
 $428 = $284;
 $429 = $428;
 $430 = HEAP32[$429>>2]|0;
 $431 = (($428) + 4)|0;
 $432 = $431;
 $433 = HEAP32[$432>>2]|0;
 $434 = (_bitshift64Ashr(0,($430|0),32)|0);
 $435 = tempRet0;
 $436 = (___muldi3(($434|0),($435|0),($426|0),($427|0))|0);
 $437 = tempRet0;
 $438 = $1;
 $439 = $438;
 $440 = HEAP32[$439>>2]|0;
 $441 = (($438) + 4)|0;
 $442 = $441;
 $443 = HEAP32[$442>>2]|0;
 $444 = (_bitshift64Ashr(0,($440|0),32)|0);
 $445 = tempRet0;
 $446 = ((($1)) + 64|0);
 $447 = $446;
 $448 = $447;
 $449 = HEAP32[$448>>2]|0;
 $450 = (($447) + 4)|0;
 $451 = $450;
 $452 = HEAP32[$451>>2]|0;
 $453 = (_bitshift64Ashr(0,($449|0),32)|0);
 $454 = tempRet0;
 $455 = (___muldi3(($453|0),($454|0),($444|0),($445|0))|0);
 $456 = tempRet0;
 $457 = (_i64Add(($455|0),($456|0),($436|0),($437|0))|0);
 $458 = tempRet0;
 $459 = $24;
 $460 = $459;
 $461 = HEAP32[$460>>2]|0;
 $462 = (($459) + 4)|0;
 $463 = $462;
 $464 = HEAP32[$463>>2]|0;
 $465 = (_bitshift64Ashr(0,($461|0),32)|0);
 $466 = tempRet0;
 $467 = $390;
 $468 = $467;
 $469 = HEAP32[$468>>2]|0;
 $470 = (($467) + 4)|0;
 $471 = $470;
 $472 = HEAP32[$471>>2]|0;
 $473 = (_bitshift64Ashr(0,($469|0),32)|0);
 $474 = tempRet0;
 $475 = (___muldi3(($473|0),($474|0),($465|0),($466|0))|0);
 $476 = tempRet0;
 $477 = $104;
 $478 = $477;
 $479 = HEAP32[$478>>2]|0;
 $480 = (($477) + 4)|0;
 $481 = $480;
 $482 = HEAP32[$481>>2]|0;
 $483 = (_bitshift64Ashr(0,($479|0),32)|0);
 $484 = tempRet0;
 $485 = $226;
 $486 = $485;
 $487 = HEAP32[$486>>2]|0;
 $488 = (($485) + 4)|0;
 $489 = $488;
 $490 = HEAP32[$489>>2]|0;
 $491 = (_bitshift64Ashr(0,($487|0),32)|0);
 $492 = tempRet0;
 $493 = (___muldi3(($491|0),($492|0),($483|0),($484|0))|0);
 $494 = tempRet0;
 $495 = (_i64Add(($493|0),($494|0),($475|0),($476|0))|0);
 $496 = tempRet0;
 $497 = (_bitshift64Shl(($495|0),($496|0),1)|0);
 $498 = tempRet0;
 $499 = (_i64Add(($457|0),($458|0),($497|0),($498|0))|0);
 $500 = tempRet0;
 $501 = (_bitshift64Shl(($499|0),($500|0),1)|0);
 $502 = tempRet0;
 $503 = (_i64Add(($501|0),($502|0),($418|0),($419|0))|0);
 $504 = tempRet0;
 $505 = ((($0)) + 64|0);
 $506 = $505;
 $507 = $506;
 HEAP32[$507>>2] = $503;
 $508 = (($506) + 4)|0;
 $509 = $508;
 HEAP32[$509>>2] = $504;
 $510 = $162;
 $511 = $510;
 $512 = HEAP32[$511>>2]|0;
 $513 = (($510) + 4)|0;
 $514 = $513;
 $515 = HEAP32[$514>>2]|0;
 $516 = (_bitshift64Ashr(0,($512|0),32)|0);
 $517 = tempRet0;
 $518 = $226;
 $519 = $518;
 $520 = HEAP32[$519>>2]|0;
 $521 = (($518) + 4)|0;
 $522 = $521;
 $523 = HEAP32[$522>>2]|0;
 $524 = (_bitshift64Ashr(0,($520|0),32)|0);
 $525 = tempRet0;
 $526 = (___muldi3(($524|0),($525|0),($516|0),($517|0))|0);
 $527 = tempRet0;
 $528 = $104;
 $529 = $528;
 $530 = HEAP32[$529>>2]|0;
 $531 = (($528) + 4)|0;
 $532 = $531;
 $533 = HEAP32[$532>>2]|0;
 $534 = (_bitshift64Ashr(0,($530|0),32)|0);
 $535 = tempRet0;
 $536 = $284;
 $537 = $536;
 $538 = HEAP32[$537>>2]|0;
 $539 = (($536) + 4)|0;
 $540 = $539;
 $541 = HEAP32[$540>>2]|0;
 $542 = (_bitshift64Ashr(0,($538|0),32)|0);
 $543 = tempRet0;
 $544 = (___muldi3(($542|0),($543|0),($534|0),($535|0))|0);
 $545 = tempRet0;
 $546 = (_i64Add(($544|0),($545|0),($526|0),($527|0))|0);
 $547 = tempRet0;
 $548 = $58;
 $549 = $548;
 $550 = HEAP32[$549>>2]|0;
 $551 = (($548) + 4)|0;
 $552 = $551;
 $553 = HEAP32[$552>>2]|0;
 $554 = (_bitshift64Ashr(0,($550|0),32)|0);
 $555 = tempRet0;
 $556 = $390;
 $557 = $556;
 $558 = HEAP32[$557>>2]|0;
 $559 = (($556) + 4)|0;
 $560 = $559;
 $561 = HEAP32[$560>>2]|0;
 $562 = (_bitshift64Ashr(0,($558|0),32)|0);
 $563 = tempRet0;
 $564 = (___muldi3(($562|0),($563|0),($554|0),($555|0))|0);
 $565 = tempRet0;
 $566 = (_i64Add(($546|0),($547|0),($564|0),($565|0))|0);
 $567 = tempRet0;
 $568 = $24;
 $569 = $568;
 $570 = HEAP32[$569>>2]|0;
 $571 = (($568) + 4)|0;
 $572 = $571;
 $573 = HEAP32[$572>>2]|0;
 $574 = (_bitshift64Ashr(0,($570|0),32)|0);
 $575 = tempRet0;
 $576 = $446;
 $577 = $576;
 $578 = HEAP32[$577>>2]|0;
 $579 = (($576) + 4)|0;
 $580 = $579;
 $581 = HEAP32[$580>>2]|0;
 $582 = (_bitshift64Ashr(0,($578|0),32)|0);
 $583 = tempRet0;
 $584 = (___muldi3(($582|0),($583|0),($574|0),($575|0))|0);
 $585 = tempRet0;
 $586 = (_i64Add(($566|0),($567|0),($584|0),($585|0))|0);
 $587 = tempRet0;
 $588 = $1;
 $589 = $588;
 $590 = HEAP32[$589>>2]|0;
 $591 = (($588) + 4)|0;
 $592 = $591;
 $593 = HEAP32[$592>>2]|0;
 $594 = (_bitshift64Ashr(0,($590|0),32)|0);
 $595 = tempRet0;
 $596 = ((($1)) + 72|0);
 $597 = $596;
 $598 = $597;
 $599 = HEAP32[$598>>2]|0;
 $600 = (($597) + 4)|0;
 $601 = $600;
 $602 = HEAP32[$601>>2]|0;
 $603 = (_bitshift64Ashr(0,($599|0),32)|0);
 $604 = tempRet0;
 $605 = (___muldi3(($603|0),($604|0),($594|0),($595|0))|0);
 $606 = tempRet0;
 $607 = (_i64Add(($586|0),($587|0),($605|0),($606|0))|0);
 $608 = tempRet0;
 $609 = (_bitshift64Shl(($607|0),($608|0),1)|0);
 $610 = tempRet0;
 $611 = ((($0)) + 72|0);
 $612 = $611;
 $613 = $612;
 HEAP32[$613>>2] = $609;
 $614 = (($612) + 4)|0;
 $615 = $614;
 HEAP32[$615>>2] = $610;
 $616 = $226;
 $617 = $616;
 $618 = HEAP32[$617>>2]|0;
 $619 = (($616) + 4)|0;
 $620 = $619;
 $621 = HEAP32[$620>>2]|0;
 $622 = (_bitshift64Ashr(0,($618|0),32)|0);
 $623 = tempRet0;
 $624 = (___muldi3(($622|0),($623|0),($622|0),($623|0))|0);
 $625 = tempRet0;
 $626 = $162;
 $627 = $626;
 $628 = HEAP32[$627>>2]|0;
 $629 = (($626) + 4)|0;
 $630 = $629;
 $631 = HEAP32[$630>>2]|0;
 $632 = (_bitshift64Ashr(0,($628|0),32)|0);
 $633 = tempRet0;
 $634 = $284;
 $635 = $634;
 $636 = HEAP32[$635>>2]|0;
 $637 = (($634) + 4)|0;
 $638 = $637;
 $639 = HEAP32[$638>>2]|0;
 $640 = (_bitshift64Ashr(0,($636|0),32)|0);
 $641 = tempRet0;
 $642 = (___muldi3(($640|0),($641|0),($632|0),($633|0))|0);
 $643 = tempRet0;
 $644 = (_i64Add(($642|0),($643|0),($624|0),($625|0))|0);
 $645 = tempRet0;
 $646 = $58;
 $647 = $646;
 $648 = HEAP32[$647>>2]|0;
 $649 = (($646) + 4)|0;
 $650 = $649;
 $651 = HEAP32[$650>>2]|0;
 $652 = (_bitshift64Ashr(0,($648|0),32)|0);
 $653 = tempRet0;
 $654 = $446;
 $655 = $654;
 $656 = HEAP32[$655>>2]|0;
 $657 = (($654) + 4)|0;
 $658 = $657;
 $659 = HEAP32[$658>>2]|0;
 $660 = (_bitshift64Ashr(0,($656|0),32)|0);
 $661 = tempRet0;
 $662 = (___muldi3(($660|0),($661|0),($652|0),($653|0))|0);
 $663 = tempRet0;
 $664 = (_i64Add(($644|0),($645|0),($662|0),($663|0))|0);
 $665 = tempRet0;
 $666 = $104;
 $667 = $666;
 $668 = HEAP32[$667>>2]|0;
 $669 = (($666) + 4)|0;
 $670 = $669;
 $671 = HEAP32[$670>>2]|0;
 $672 = (_bitshift64Ashr(0,($668|0),32)|0);
 $673 = tempRet0;
 $674 = $390;
 $675 = $674;
 $676 = HEAP32[$675>>2]|0;
 $677 = (($674) + 4)|0;
 $678 = $677;
 $679 = HEAP32[$678>>2]|0;
 $680 = (_bitshift64Ashr(0,($676|0),32)|0);
 $681 = tempRet0;
 $682 = (___muldi3(($680|0),($681|0),($672|0),($673|0))|0);
 $683 = tempRet0;
 $684 = $24;
 $685 = $684;
 $686 = HEAP32[$685>>2]|0;
 $687 = (($684) + 4)|0;
 $688 = $687;
 $689 = HEAP32[$688>>2]|0;
 $690 = (_bitshift64Ashr(0,($686|0),32)|0);
 $691 = tempRet0;
 $692 = $596;
 $693 = $692;
 $694 = HEAP32[$693>>2]|0;
 $695 = (($692) + 4)|0;
 $696 = $695;
 $697 = HEAP32[$696>>2]|0;
 $698 = (_bitshift64Ashr(0,($694|0),32)|0);
 $699 = tempRet0;
 $700 = (___muldi3(($698|0),($699|0),($690|0),($691|0))|0);
 $701 = tempRet0;
 $702 = (_i64Add(($700|0),($701|0),($682|0),($683|0))|0);
 $703 = tempRet0;
 $704 = (_bitshift64Shl(($702|0),($703|0),1)|0);
 $705 = tempRet0;
 $706 = (_i64Add(($664|0),($665|0),($704|0),($705|0))|0);
 $707 = tempRet0;
 $708 = (_bitshift64Shl(($706|0),($707|0),1)|0);
 $709 = tempRet0;
 $710 = ((($0)) + 80|0);
 $711 = $710;
 $712 = $711;
 HEAP32[$712>>2] = $708;
 $713 = (($711) + 4)|0;
 $714 = $713;
 HEAP32[$714>>2] = $709;
 $715 = $226;
 $716 = $715;
 $717 = HEAP32[$716>>2]|0;
 $718 = (($715) + 4)|0;
 $719 = $718;
 $720 = HEAP32[$719>>2]|0;
 $721 = (_bitshift64Ashr(0,($717|0),32)|0);
 $722 = tempRet0;
 $723 = $284;
 $724 = $723;
 $725 = HEAP32[$724>>2]|0;
 $726 = (($723) + 4)|0;
 $727 = $726;
 $728 = HEAP32[$727>>2]|0;
 $729 = (_bitshift64Ashr(0,($725|0),32)|0);
 $730 = tempRet0;
 $731 = (___muldi3(($729|0),($730|0),($721|0),($722|0))|0);
 $732 = tempRet0;
 $733 = $162;
 $734 = $733;
 $735 = HEAP32[$734>>2]|0;
 $736 = (($733) + 4)|0;
 $737 = $736;
 $738 = HEAP32[$737>>2]|0;
 $739 = (_bitshift64Ashr(0,($735|0),32)|0);
 $740 = tempRet0;
 $741 = $390;
 $742 = $741;
 $743 = HEAP32[$742>>2]|0;
 $744 = (($741) + 4)|0;
 $745 = $744;
 $746 = HEAP32[$745>>2]|0;
 $747 = (_bitshift64Ashr(0,($743|0),32)|0);
 $748 = tempRet0;
 $749 = (___muldi3(($747|0),($748|0),($739|0),($740|0))|0);
 $750 = tempRet0;
 $751 = (_i64Add(($749|0),($750|0),($731|0),($732|0))|0);
 $752 = tempRet0;
 $753 = $104;
 $754 = $753;
 $755 = HEAP32[$754>>2]|0;
 $756 = (($753) + 4)|0;
 $757 = $756;
 $758 = HEAP32[$757>>2]|0;
 $759 = (_bitshift64Ashr(0,($755|0),32)|0);
 $760 = tempRet0;
 $761 = $446;
 $762 = $761;
 $763 = HEAP32[$762>>2]|0;
 $764 = (($761) + 4)|0;
 $765 = $764;
 $766 = HEAP32[$765>>2]|0;
 $767 = (_bitshift64Ashr(0,($763|0),32)|0);
 $768 = tempRet0;
 $769 = (___muldi3(($767|0),($768|0),($759|0),($760|0))|0);
 $770 = tempRet0;
 $771 = (_i64Add(($751|0),($752|0),($769|0),($770|0))|0);
 $772 = tempRet0;
 $773 = $58;
 $774 = $773;
 $775 = HEAP32[$774>>2]|0;
 $776 = (($773) + 4)|0;
 $777 = $776;
 $778 = HEAP32[$777>>2]|0;
 $779 = (_bitshift64Ashr(0,($775|0),32)|0);
 $780 = tempRet0;
 $781 = $596;
 $782 = $781;
 $783 = HEAP32[$782>>2]|0;
 $784 = (($781) + 4)|0;
 $785 = $784;
 $786 = HEAP32[$785>>2]|0;
 $787 = (_bitshift64Ashr(0,($783|0),32)|0);
 $788 = tempRet0;
 $789 = (___muldi3(($787|0),($788|0),($779|0),($780|0))|0);
 $790 = tempRet0;
 $791 = (_i64Add(($771|0),($772|0),($789|0),($790|0))|0);
 $792 = tempRet0;
 $793 = (_bitshift64Shl(($791|0),($792|0),1)|0);
 $794 = tempRet0;
 $795 = ((($0)) + 88|0);
 $796 = $795;
 $797 = $796;
 HEAP32[$797>>2] = $793;
 $798 = (($796) + 4)|0;
 $799 = $798;
 HEAP32[$799>>2] = $794;
 $800 = $284;
 $801 = $800;
 $802 = HEAP32[$801>>2]|0;
 $803 = (($800) + 4)|0;
 $804 = $803;
 $805 = HEAP32[$804>>2]|0;
 $806 = (_bitshift64Ashr(0,($802|0),32)|0);
 $807 = tempRet0;
 $808 = (___muldi3(($806|0),($807|0),($806|0),($807|0))|0);
 $809 = tempRet0;
 $810 = $162;
 $811 = $810;
 $812 = HEAP32[$811>>2]|0;
 $813 = (($810) + 4)|0;
 $814 = $813;
 $815 = HEAP32[$814>>2]|0;
 $816 = (_bitshift64Ashr(0,($812|0),32)|0);
 $817 = tempRet0;
 $818 = $446;
 $819 = $818;
 $820 = HEAP32[$819>>2]|0;
 $821 = (($818) + 4)|0;
 $822 = $821;
 $823 = HEAP32[$822>>2]|0;
 $824 = (_bitshift64Ashr(0,($820|0),32)|0);
 $825 = tempRet0;
 $826 = (___muldi3(($824|0),($825|0),($816|0),($817|0))|0);
 $827 = tempRet0;
 $828 = $226;
 $829 = $828;
 $830 = HEAP32[$829>>2]|0;
 $831 = (($828) + 4)|0;
 $832 = $831;
 $833 = HEAP32[$832>>2]|0;
 $834 = (_bitshift64Ashr(0,($830|0),32)|0);
 $835 = tempRet0;
 $836 = $390;
 $837 = $836;
 $838 = HEAP32[$837>>2]|0;
 $839 = (($836) + 4)|0;
 $840 = $839;
 $841 = HEAP32[$840>>2]|0;
 $842 = (_bitshift64Ashr(0,($838|0),32)|0);
 $843 = tempRet0;
 $844 = (___muldi3(($842|0),($843|0),($834|0),($835|0))|0);
 $845 = tempRet0;
 $846 = $104;
 $847 = $846;
 $848 = HEAP32[$847>>2]|0;
 $849 = (($846) + 4)|0;
 $850 = $849;
 $851 = HEAP32[$850>>2]|0;
 $852 = (_bitshift64Ashr(0,($848|0),32)|0);
 $853 = tempRet0;
 $854 = $596;
 $855 = $854;
 $856 = HEAP32[$855>>2]|0;
 $857 = (($854) + 4)|0;
 $858 = $857;
 $859 = HEAP32[$858>>2]|0;
 $860 = (_bitshift64Ashr(0,($856|0),32)|0);
 $861 = tempRet0;
 $862 = (___muldi3(($860|0),($861|0),($852|0),($853|0))|0);
 $863 = tempRet0;
 $864 = (_i64Add(($862|0),($863|0),($844|0),($845|0))|0);
 $865 = tempRet0;
 $866 = (_bitshift64Shl(($864|0),($865|0),1)|0);
 $867 = tempRet0;
 $868 = (_i64Add(($866|0),($867|0),($826|0),($827|0))|0);
 $869 = tempRet0;
 $870 = (_bitshift64Shl(($868|0),($869|0),1)|0);
 $871 = tempRet0;
 $872 = (_i64Add(($870|0),($871|0),($808|0),($809|0))|0);
 $873 = tempRet0;
 $874 = ((($0)) + 96|0);
 $875 = $874;
 $876 = $875;
 HEAP32[$876>>2] = $872;
 $877 = (($875) + 4)|0;
 $878 = $877;
 HEAP32[$878>>2] = $873;
 $879 = $284;
 $880 = $879;
 $881 = HEAP32[$880>>2]|0;
 $882 = (($879) + 4)|0;
 $883 = $882;
 $884 = HEAP32[$883>>2]|0;
 $885 = (_bitshift64Ashr(0,($881|0),32)|0);
 $886 = tempRet0;
 $887 = $390;
 $888 = $887;
 $889 = HEAP32[$888>>2]|0;
 $890 = (($887) + 4)|0;
 $891 = $890;
 $892 = HEAP32[$891>>2]|0;
 $893 = (_bitshift64Ashr(0,($889|0),32)|0);
 $894 = tempRet0;
 $895 = (___muldi3(($893|0),($894|0),($885|0),($886|0))|0);
 $896 = tempRet0;
 $897 = $226;
 $898 = $897;
 $899 = HEAP32[$898>>2]|0;
 $900 = (($897) + 4)|0;
 $901 = $900;
 $902 = HEAP32[$901>>2]|0;
 $903 = (_bitshift64Ashr(0,($899|0),32)|0);
 $904 = tempRet0;
 $905 = $446;
 $906 = $905;
 $907 = HEAP32[$906>>2]|0;
 $908 = (($905) + 4)|0;
 $909 = $908;
 $910 = HEAP32[$909>>2]|0;
 $911 = (_bitshift64Ashr(0,($907|0),32)|0);
 $912 = tempRet0;
 $913 = (___muldi3(($911|0),($912|0),($903|0),($904|0))|0);
 $914 = tempRet0;
 $915 = (_i64Add(($913|0),($914|0),($895|0),($896|0))|0);
 $916 = tempRet0;
 $917 = $162;
 $918 = $917;
 $919 = HEAP32[$918>>2]|0;
 $920 = (($917) + 4)|0;
 $921 = $920;
 $922 = HEAP32[$921>>2]|0;
 $923 = (_bitshift64Ashr(0,($919|0),32)|0);
 $924 = tempRet0;
 $925 = $596;
 $926 = $925;
 $927 = HEAP32[$926>>2]|0;
 $928 = (($925) + 4)|0;
 $929 = $928;
 $930 = HEAP32[$929>>2]|0;
 $931 = (_bitshift64Ashr(0,($927|0),32)|0);
 $932 = tempRet0;
 $933 = (___muldi3(($931|0),($932|0),($923|0),($924|0))|0);
 $934 = tempRet0;
 $935 = (_i64Add(($915|0),($916|0),($933|0),($934|0))|0);
 $936 = tempRet0;
 $937 = (_bitshift64Shl(($935|0),($936|0),1)|0);
 $938 = tempRet0;
 $939 = ((($0)) + 104|0);
 $940 = $939;
 $941 = $940;
 HEAP32[$941>>2] = $937;
 $942 = (($940) + 4)|0;
 $943 = $942;
 HEAP32[$943>>2] = $938;
 $944 = $390;
 $945 = $944;
 $946 = HEAP32[$945>>2]|0;
 $947 = (($944) + 4)|0;
 $948 = $947;
 $949 = HEAP32[$948>>2]|0;
 $950 = (_bitshift64Ashr(0,($946|0),32)|0);
 $951 = tempRet0;
 $952 = (___muldi3(($950|0),($951|0),($950|0),($951|0))|0);
 $953 = tempRet0;
 $954 = $284;
 $955 = $954;
 $956 = HEAP32[$955>>2]|0;
 $957 = (($954) + 4)|0;
 $958 = $957;
 $959 = HEAP32[$958>>2]|0;
 $960 = (_bitshift64Ashr(0,($956|0),32)|0);
 $961 = tempRet0;
 $962 = $446;
 $963 = $962;
 $964 = HEAP32[$963>>2]|0;
 $965 = (($962) + 4)|0;
 $966 = $965;
 $967 = HEAP32[$966>>2]|0;
 $968 = (_bitshift64Ashr(0,($964|0),32)|0);
 $969 = tempRet0;
 $970 = (___muldi3(($968|0),($969|0),($960|0),($961|0))|0);
 $971 = tempRet0;
 $972 = (_i64Add(($970|0),($971|0),($952|0),($953|0))|0);
 $973 = tempRet0;
 $974 = $226;
 $975 = $974;
 $976 = HEAP32[$975>>2]|0;
 $977 = (($974) + 4)|0;
 $978 = $977;
 $979 = HEAP32[$978>>2]|0;
 $980 = (_bitshift64Ashr(0,($976|0),31)|0);
 $981 = tempRet0;
 $982 = $596;
 $983 = $982;
 $984 = HEAP32[$983>>2]|0;
 $985 = (($982) + 4)|0;
 $986 = $985;
 $987 = HEAP32[$986>>2]|0;
 $988 = (_bitshift64Ashr(0,($984|0),32)|0);
 $989 = tempRet0;
 $990 = (___muldi3(($988|0),($989|0),($980|0),($981|0))|0);
 $991 = tempRet0;
 $992 = (_i64Add(($972|0),($973|0),($990|0),($991|0))|0);
 $993 = tempRet0;
 $994 = (_bitshift64Shl(($992|0),($993|0),1)|0);
 $995 = tempRet0;
 $996 = ((($0)) + 112|0);
 $997 = $996;
 $998 = $997;
 HEAP32[$998>>2] = $994;
 $999 = (($997) + 4)|0;
 $1000 = $999;
 HEAP32[$1000>>2] = $995;
 $1001 = $390;
 $1002 = $1001;
 $1003 = HEAP32[$1002>>2]|0;
 $1004 = (($1001) + 4)|0;
 $1005 = $1004;
 $1006 = HEAP32[$1005>>2]|0;
 $1007 = (_bitshift64Ashr(0,($1003|0),32)|0);
 $1008 = tempRet0;
 $1009 = $446;
 $1010 = $1009;
 $1011 = HEAP32[$1010>>2]|0;
 $1012 = (($1009) + 4)|0;
 $1013 = $1012;
 $1014 = HEAP32[$1013>>2]|0;
 $1015 = (_bitshift64Ashr(0,($1011|0),32)|0);
 $1016 = tempRet0;
 $1017 = (___muldi3(($1015|0),($1016|0),($1007|0),($1008|0))|0);
 $1018 = tempRet0;
 $1019 = $284;
 $1020 = $1019;
 $1021 = HEAP32[$1020>>2]|0;
 $1022 = (($1019) + 4)|0;
 $1023 = $1022;
 $1024 = HEAP32[$1023>>2]|0;
 $1025 = (_bitshift64Ashr(0,($1021|0),32)|0);
 $1026 = tempRet0;
 $1027 = $596;
 $1028 = $1027;
 $1029 = HEAP32[$1028>>2]|0;
 $1030 = (($1027) + 4)|0;
 $1031 = $1030;
 $1032 = HEAP32[$1031>>2]|0;
 $1033 = (_bitshift64Ashr(0,($1029|0),32)|0);
 $1034 = tempRet0;
 $1035 = (___muldi3(($1033|0),($1034|0),($1025|0),($1026|0))|0);
 $1036 = tempRet0;
 $1037 = (_i64Add(($1035|0),($1036|0),($1017|0),($1018|0))|0);
 $1038 = tempRet0;
 $1039 = (_bitshift64Shl(($1037|0),($1038|0),1)|0);
 $1040 = tempRet0;
 $1041 = ((($0)) + 120|0);
 $1042 = $1041;
 $1043 = $1042;
 HEAP32[$1043>>2] = $1039;
 $1044 = (($1042) + 4)|0;
 $1045 = $1044;
 HEAP32[$1045>>2] = $1040;
 $1046 = $446;
 $1047 = $1046;
 $1048 = HEAP32[$1047>>2]|0;
 $1049 = (($1046) + 4)|0;
 $1050 = $1049;
 $1051 = HEAP32[$1050>>2]|0;
 $1052 = (_bitshift64Ashr(0,($1048|0),32)|0);
 $1053 = tempRet0;
 $1054 = (___muldi3(($1052|0),($1053|0),($1052|0),($1053|0))|0);
 $1055 = tempRet0;
 $1056 = $390;
 $1057 = $1056;
 $1058 = HEAP32[$1057>>2]|0;
 $1059 = (($1056) + 4)|0;
 $1060 = $1059;
 $1061 = HEAP32[$1060>>2]|0;
 $1062 = (_bitshift64Ashr(0,($1058|0),30)|0);
 $1063 = tempRet0;
 $1064 = $596;
 $1065 = $1064;
 $1066 = HEAP32[$1065>>2]|0;
 $1067 = (($1064) + 4)|0;
 $1068 = $1067;
 $1069 = HEAP32[$1068>>2]|0;
 $1070 = (_bitshift64Ashr(0,($1066|0),32)|0);
 $1071 = tempRet0;
 $1072 = (___muldi3(($1070|0),($1071|0),($1062|0),($1063|0))|0);
 $1073 = tempRet0;
 $1074 = (_i64Add(($1072|0),($1073|0),($1054|0),($1055|0))|0);
 $1075 = tempRet0;
 $1076 = ((($0)) + 128|0);
 $1077 = $1076;
 $1078 = $1077;
 HEAP32[$1078>>2] = $1074;
 $1079 = (($1077) + 4)|0;
 $1080 = $1079;
 HEAP32[$1080>>2] = $1075;
 $1081 = $446;
 $1082 = $1081;
 $1083 = HEAP32[$1082>>2]|0;
 $1084 = (($1081) + 4)|0;
 $1085 = $1084;
 $1086 = HEAP32[$1085>>2]|0;
 $1087 = (_bitshift64Ashr(0,($1083|0),31)|0);
 $1088 = tempRet0;
 $1089 = $596;
 $1090 = $1089;
 $1091 = HEAP32[$1090>>2]|0;
 $1092 = (($1089) + 4)|0;
 $1093 = $1092;
 $1094 = HEAP32[$1093>>2]|0;
 $1095 = (_bitshift64Ashr(0,($1091|0),32)|0);
 $1096 = tempRet0;
 $1097 = (___muldi3(($1095|0),($1096|0),($1087|0),($1088|0))|0);
 $1098 = tempRet0;
 $1099 = ((($0)) + 136|0);
 $1100 = $1099;
 $1101 = $1100;
 HEAP32[$1101>>2] = $1097;
 $1102 = (($1100) + 4)|0;
 $1103 = $1102;
 HEAP32[$1103>>2] = $1098;
 $1104 = $596;
 $1105 = $1104;
 $1106 = HEAP32[$1105>>2]|0;
 $1107 = (($1104) + 4)|0;
 $1108 = $1107;
 $1109 = HEAP32[$1108>>2]|0;
 $1110 = (_bitshift64Ashr(0,($1106|0),32)|0);
 $1111 = tempRet0;
 $1112 = (_bitshift64Ashr(0,($1106|0),31)|0);
 $1113 = tempRet0;
 $1114 = (___muldi3(($1112|0),($1113|0),($1110|0),($1111|0))|0);
 $1115 = tempRet0;
 $1116 = ((($0)) + 144|0);
 $1117 = $1116;
 $1118 = $1117;
 HEAP32[$1118>>2] = $1114;
 $1119 = (($1117) + 4)|0;
 $1120 = $1119;
 HEAP32[$1120>>2] = $1115;
 return;
}
function _swap_conditional($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (_i64Subtract(0,0,($2|0),($3|0))|0);
 $5 = tempRet0;
 $6 = $0;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $9 = (($6) + 4)|0;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = $1;
 $13 = $12;
 $14 = HEAP32[$13>>2]|0;
 $15 = (($12) + 4)|0;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = $14 ^ $8;
 $19 = $17 ^ $11;
 $20 = $18 & $4;
 $21 = $19 & $5;
 $22 = $20 ^ $8;
 $21 ^ $11;
 $23 = (_bitshift64Ashr(0,($22|0),32)|0);
 $24 = tempRet0;
 $25 = $0;
 $26 = $25;
 HEAP32[$26>>2] = $23;
 $27 = (($25) + 4)|0;
 $28 = $27;
 HEAP32[$28>>2] = $24;
 $29 = $1;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = (($29) + 4)|0;
 $33 = $32;
 $34 = HEAP32[$33>>2]|0;
 $35 = $31 ^ $20;
 $34 ^ $21;
 $36 = (_bitshift64Ashr(0,($35|0),32)|0);
 $37 = tempRet0;
 $38 = $1;
 $39 = $38;
 HEAP32[$39>>2] = $36;
 $40 = (($38) + 4)|0;
 $41 = $40;
 HEAP32[$41>>2] = $37;
 $42 = ((($0)) + 8|0);
 $43 = $42;
 $44 = $43;
 $45 = HEAP32[$44>>2]|0;
 $46 = (($43) + 4)|0;
 $47 = $46;
 $48 = HEAP32[$47>>2]|0;
 $49 = ((($1)) + 8|0);
 $50 = $49;
 $51 = $50;
 $52 = HEAP32[$51>>2]|0;
 $53 = (($50) + 4)|0;
 $54 = $53;
 $55 = HEAP32[$54>>2]|0;
 $56 = $52 ^ $45;
 $57 = $55 ^ $48;
 $58 = $56 & $4;
 $59 = $57 & $5;
 $60 = $58 ^ $45;
 $59 ^ $48;
 $61 = (_bitshift64Ashr(0,($60|0),32)|0);
 $62 = tempRet0;
 $63 = $42;
 $64 = $63;
 HEAP32[$64>>2] = $61;
 $65 = (($63) + 4)|0;
 $66 = $65;
 HEAP32[$66>>2] = $62;
 $67 = $49;
 $68 = $67;
 $69 = HEAP32[$68>>2]|0;
 $70 = (($67) + 4)|0;
 $71 = $70;
 $72 = HEAP32[$71>>2]|0;
 $73 = $69 ^ $58;
 $72 ^ $59;
 $74 = (_bitshift64Ashr(0,($73|0),32)|0);
 $75 = tempRet0;
 $76 = $49;
 $77 = $76;
 HEAP32[$77>>2] = $74;
 $78 = (($76) + 4)|0;
 $79 = $78;
 HEAP32[$79>>2] = $75;
 $80 = ((($0)) + 16|0);
 $81 = $80;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = ((($1)) + 16|0);
 $88 = $87;
 $89 = $88;
 $90 = HEAP32[$89>>2]|0;
 $91 = (($88) + 4)|0;
 $92 = $91;
 $93 = HEAP32[$92>>2]|0;
 $94 = $90 ^ $83;
 $95 = $93 ^ $86;
 $96 = $94 & $4;
 $97 = $95 & $5;
 $98 = $96 ^ $83;
 $97 ^ $86;
 $99 = (_bitshift64Ashr(0,($98|0),32)|0);
 $100 = tempRet0;
 $101 = $80;
 $102 = $101;
 HEAP32[$102>>2] = $99;
 $103 = (($101) + 4)|0;
 $104 = $103;
 HEAP32[$104>>2] = $100;
 $105 = $87;
 $106 = $105;
 $107 = HEAP32[$106>>2]|0;
 $108 = (($105) + 4)|0;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = $107 ^ $96;
 $110 ^ $97;
 $112 = (_bitshift64Ashr(0,($111|0),32)|0);
 $113 = tempRet0;
 $114 = $87;
 $115 = $114;
 HEAP32[$115>>2] = $112;
 $116 = (($114) + 4)|0;
 $117 = $116;
 HEAP32[$117>>2] = $113;
 $118 = ((($0)) + 24|0);
 $119 = $118;
 $120 = $119;
 $121 = HEAP32[$120>>2]|0;
 $122 = (($119) + 4)|0;
 $123 = $122;
 $124 = HEAP32[$123>>2]|0;
 $125 = ((($1)) + 24|0);
 $126 = $125;
 $127 = $126;
 $128 = HEAP32[$127>>2]|0;
 $129 = (($126) + 4)|0;
 $130 = $129;
 $131 = HEAP32[$130>>2]|0;
 $132 = $128 ^ $121;
 $133 = $131 ^ $124;
 $134 = $132 & $4;
 $135 = $133 & $5;
 $136 = $134 ^ $121;
 $135 ^ $124;
 $137 = (_bitshift64Ashr(0,($136|0),32)|0);
 $138 = tempRet0;
 $139 = $118;
 $140 = $139;
 HEAP32[$140>>2] = $137;
 $141 = (($139) + 4)|0;
 $142 = $141;
 HEAP32[$142>>2] = $138;
 $143 = $125;
 $144 = $143;
 $145 = HEAP32[$144>>2]|0;
 $146 = (($143) + 4)|0;
 $147 = $146;
 $148 = HEAP32[$147>>2]|0;
 $149 = $145 ^ $134;
 $148 ^ $135;
 $150 = (_bitshift64Ashr(0,($149|0),32)|0);
 $151 = tempRet0;
 $152 = $125;
 $153 = $152;
 HEAP32[$153>>2] = $150;
 $154 = (($152) + 4)|0;
 $155 = $154;
 HEAP32[$155>>2] = $151;
 $156 = ((($0)) + 32|0);
 $157 = $156;
 $158 = $157;
 $159 = HEAP32[$158>>2]|0;
 $160 = (($157) + 4)|0;
 $161 = $160;
 $162 = HEAP32[$161>>2]|0;
 $163 = ((($1)) + 32|0);
 $164 = $163;
 $165 = $164;
 $166 = HEAP32[$165>>2]|0;
 $167 = (($164) + 4)|0;
 $168 = $167;
 $169 = HEAP32[$168>>2]|0;
 $170 = $166 ^ $159;
 $171 = $169 ^ $162;
 $172 = $170 & $4;
 $173 = $171 & $5;
 $174 = $172 ^ $159;
 $173 ^ $162;
 $175 = (_bitshift64Ashr(0,($174|0),32)|0);
 $176 = tempRet0;
 $177 = $156;
 $178 = $177;
 HEAP32[$178>>2] = $175;
 $179 = (($177) + 4)|0;
 $180 = $179;
 HEAP32[$180>>2] = $176;
 $181 = $163;
 $182 = $181;
 $183 = HEAP32[$182>>2]|0;
 $184 = (($181) + 4)|0;
 $185 = $184;
 $186 = HEAP32[$185>>2]|0;
 $187 = $183 ^ $172;
 $186 ^ $173;
 $188 = (_bitshift64Ashr(0,($187|0),32)|0);
 $189 = tempRet0;
 $190 = $163;
 $191 = $190;
 HEAP32[$191>>2] = $188;
 $192 = (($190) + 4)|0;
 $193 = $192;
 HEAP32[$193>>2] = $189;
 $194 = ((($0)) + 40|0);
 $195 = $194;
 $196 = $195;
 $197 = HEAP32[$196>>2]|0;
 $198 = (($195) + 4)|0;
 $199 = $198;
 $200 = HEAP32[$199>>2]|0;
 $201 = ((($1)) + 40|0);
 $202 = $201;
 $203 = $202;
 $204 = HEAP32[$203>>2]|0;
 $205 = (($202) + 4)|0;
 $206 = $205;
 $207 = HEAP32[$206>>2]|0;
 $208 = $204 ^ $197;
 $209 = $207 ^ $200;
 $210 = $208 & $4;
 $211 = $209 & $5;
 $212 = $210 ^ $197;
 $211 ^ $200;
 $213 = (_bitshift64Ashr(0,($212|0),32)|0);
 $214 = tempRet0;
 $215 = $194;
 $216 = $215;
 HEAP32[$216>>2] = $213;
 $217 = (($215) + 4)|0;
 $218 = $217;
 HEAP32[$218>>2] = $214;
 $219 = $201;
 $220 = $219;
 $221 = HEAP32[$220>>2]|0;
 $222 = (($219) + 4)|0;
 $223 = $222;
 $224 = HEAP32[$223>>2]|0;
 $225 = $221 ^ $210;
 $224 ^ $211;
 $226 = (_bitshift64Ashr(0,($225|0),32)|0);
 $227 = tempRet0;
 $228 = $201;
 $229 = $228;
 HEAP32[$229>>2] = $226;
 $230 = (($228) + 4)|0;
 $231 = $230;
 HEAP32[$231>>2] = $227;
 $232 = ((($0)) + 48|0);
 $233 = $232;
 $234 = $233;
 $235 = HEAP32[$234>>2]|0;
 $236 = (($233) + 4)|0;
 $237 = $236;
 $238 = HEAP32[$237>>2]|0;
 $239 = ((($1)) + 48|0);
 $240 = $239;
 $241 = $240;
 $242 = HEAP32[$241>>2]|0;
 $243 = (($240) + 4)|0;
 $244 = $243;
 $245 = HEAP32[$244>>2]|0;
 $246 = $242 ^ $235;
 $247 = $245 ^ $238;
 $248 = $246 & $4;
 $249 = $247 & $5;
 $250 = $248 ^ $235;
 $249 ^ $238;
 $251 = (_bitshift64Ashr(0,($250|0),32)|0);
 $252 = tempRet0;
 $253 = $232;
 $254 = $253;
 HEAP32[$254>>2] = $251;
 $255 = (($253) + 4)|0;
 $256 = $255;
 HEAP32[$256>>2] = $252;
 $257 = $239;
 $258 = $257;
 $259 = HEAP32[$258>>2]|0;
 $260 = (($257) + 4)|0;
 $261 = $260;
 $262 = HEAP32[$261>>2]|0;
 $263 = $259 ^ $248;
 $262 ^ $249;
 $264 = (_bitshift64Ashr(0,($263|0),32)|0);
 $265 = tempRet0;
 $266 = $239;
 $267 = $266;
 HEAP32[$267>>2] = $264;
 $268 = (($266) + 4)|0;
 $269 = $268;
 HEAP32[$269>>2] = $265;
 $270 = ((($0)) + 56|0);
 $271 = $270;
 $272 = $271;
 $273 = HEAP32[$272>>2]|0;
 $274 = (($271) + 4)|0;
 $275 = $274;
 $276 = HEAP32[$275>>2]|0;
 $277 = ((($1)) + 56|0);
 $278 = $277;
 $279 = $278;
 $280 = HEAP32[$279>>2]|0;
 $281 = (($278) + 4)|0;
 $282 = $281;
 $283 = HEAP32[$282>>2]|0;
 $284 = $280 ^ $273;
 $285 = $283 ^ $276;
 $286 = $284 & $4;
 $287 = $285 & $5;
 $288 = $286 ^ $273;
 $287 ^ $276;
 $289 = (_bitshift64Ashr(0,($288|0),32)|0);
 $290 = tempRet0;
 $291 = $270;
 $292 = $291;
 HEAP32[$292>>2] = $289;
 $293 = (($291) + 4)|0;
 $294 = $293;
 HEAP32[$294>>2] = $290;
 $295 = $277;
 $296 = $295;
 $297 = HEAP32[$296>>2]|0;
 $298 = (($295) + 4)|0;
 $299 = $298;
 $300 = HEAP32[$299>>2]|0;
 $301 = $297 ^ $286;
 $300 ^ $287;
 $302 = (_bitshift64Ashr(0,($301|0),32)|0);
 $303 = tempRet0;
 $304 = $277;
 $305 = $304;
 HEAP32[$305>>2] = $302;
 $306 = (($304) + 4)|0;
 $307 = $306;
 HEAP32[$307>>2] = $303;
 $308 = ((($0)) + 64|0);
 $309 = $308;
 $310 = $309;
 $311 = HEAP32[$310>>2]|0;
 $312 = (($309) + 4)|0;
 $313 = $312;
 $314 = HEAP32[$313>>2]|0;
 $315 = ((($1)) + 64|0);
 $316 = $315;
 $317 = $316;
 $318 = HEAP32[$317>>2]|0;
 $319 = (($316) + 4)|0;
 $320 = $319;
 $321 = HEAP32[$320>>2]|0;
 $322 = $318 ^ $311;
 $323 = $321 ^ $314;
 $324 = $322 & $4;
 $325 = $323 & $5;
 $326 = $324 ^ $311;
 $325 ^ $314;
 $327 = (_bitshift64Ashr(0,($326|0),32)|0);
 $328 = tempRet0;
 $329 = $308;
 $330 = $329;
 HEAP32[$330>>2] = $327;
 $331 = (($329) + 4)|0;
 $332 = $331;
 HEAP32[$332>>2] = $328;
 $333 = $315;
 $334 = $333;
 $335 = HEAP32[$334>>2]|0;
 $336 = (($333) + 4)|0;
 $337 = $336;
 $338 = HEAP32[$337>>2]|0;
 $339 = $335 ^ $324;
 $338 ^ $325;
 $340 = (_bitshift64Ashr(0,($339|0),32)|0);
 $341 = tempRet0;
 $342 = $315;
 $343 = $342;
 HEAP32[$343>>2] = $340;
 $344 = (($342) + 4)|0;
 $345 = $344;
 HEAP32[$345>>2] = $341;
 $346 = ((($0)) + 72|0);
 $347 = $346;
 $348 = $347;
 $349 = HEAP32[$348>>2]|0;
 $350 = (($347) + 4)|0;
 $351 = $350;
 $352 = HEAP32[$351>>2]|0;
 $353 = ((($1)) + 72|0);
 $354 = $353;
 $355 = $354;
 $356 = HEAP32[$355>>2]|0;
 $357 = (($354) + 4)|0;
 $358 = $357;
 $359 = HEAP32[$358>>2]|0;
 $360 = $356 ^ $349;
 $361 = $359 ^ $352;
 $362 = $360 & $4;
 $363 = $361 & $5;
 $364 = $362 ^ $349;
 $363 ^ $352;
 $365 = (_bitshift64Ashr(0,($364|0),32)|0);
 $366 = tempRet0;
 $367 = $346;
 $368 = $367;
 HEAP32[$368>>2] = $365;
 $369 = (($367) + 4)|0;
 $370 = $369;
 HEAP32[$370>>2] = $366;
 $371 = $353;
 $372 = $371;
 $373 = HEAP32[$372>>2]|0;
 $374 = (($371) + 4)|0;
 $375 = $374;
 $376 = HEAP32[$375>>2]|0;
 $377 = $373 ^ $362;
 $376 ^ $363;
 $378 = (_bitshift64Ashr(0,($377|0),32)|0);
 $379 = tempRet0;
 $380 = $353;
 $381 = $380;
 HEAP32[$381>>2] = $378;
 $382 = (($380) + 4)|0;
 $383 = $382;
 HEAP32[$383>>2] = $379;
 return;
}
function _fmonty($0,$1,$2,$3,$4,$5,$6,$7,$8) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 $8 = $8|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 1232|0;
 $9 = sp + 1144|0;
 $10 = sp + 1064|0;
 $11 = sp + 912|0;
 $12 = sp + 760|0;
 $13 = sp + 608|0;
 $14 = sp + 456|0;
 $15 = sp + 304|0;
 $16 = sp + 152|0;
 $17 = sp;
 dest=$9; src=$4; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _fsum($4,$5);
 _fdifference($5,$9);
 dest=$10; src=$6; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _fsum($6,$7);
 _fdifference($7,$10);
 _fproduct($14,$6,$5);
 _fproduct($15,$4,$7);
 _freduce_degree($14);
 _freduce_coefficients($14);
 _freduce_degree($15);
 _freduce_coefficients($15);
 dest=$10; src=$14; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _fsum($14,$15);
 _fdifference($15,$10);
 _fsquare($17,$14);
 _fsquare($16,$15);
 _fproduct($15,$16,$8);
 _freduce_degree($15);
 _freduce_coefficients($15);
 dest=$2; src=$17; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 dest=$3; src=$15; stop=dest+80|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _fsquare($12,$4);
 _fsquare($13,$5);
 _fproduct($0,$12,$13);
 _freduce_degree($0);
 _freduce_coefficients($0);
 _fdifference($13,$12);
 $18 = ((($11)) + 80|0);
 dest=$18; stop=dest+72|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 _fscalar_product($11,$13);
 _freduce_coefficients($11);
 _fsum($11,$12);
 _fproduct($1,$13,$11);
 _freduce_degree($1);
 _freduce_coefficients($1);
 STACKTOP = sp;return;
}
function _fsum($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $0;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = $1;
 $9 = $8;
 $10 = HEAP32[$9>>2]|0;
 $11 = (($8) + 4)|0;
 $12 = $11;
 $13 = HEAP32[$12>>2]|0;
 $14 = (_i64Add(($10|0),($13|0),($4|0),($7|0))|0);
 $15 = tempRet0;
 $16 = $0;
 $17 = $16;
 HEAP32[$17>>2] = $14;
 $18 = (($16) + 4)|0;
 $19 = $18;
 HEAP32[$19>>2] = $15;
 $20 = ((($0)) + 8|0);
 $21 = $20;
 $22 = $21;
 $23 = HEAP32[$22>>2]|0;
 $24 = (($21) + 4)|0;
 $25 = $24;
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($1)) + 8|0);
 $28 = $27;
 $29 = $28;
 $30 = HEAP32[$29>>2]|0;
 $31 = (($28) + 4)|0;
 $32 = $31;
 $33 = HEAP32[$32>>2]|0;
 $34 = (_i64Add(($30|0),($33|0),($23|0),($26|0))|0);
 $35 = tempRet0;
 $36 = $20;
 $37 = $36;
 HEAP32[$37>>2] = $34;
 $38 = (($36) + 4)|0;
 $39 = $38;
 HEAP32[$39>>2] = $35;
 $40 = ((($0)) + 16|0);
 $41 = $40;
 $42 = $41;
 $43 = HEAP32[$42>>2]|0;
 $44 = (($41) + 4)|0;
 $45 = $44;
 $46 = HEAP32[$45>>2]|0;
 $47 = ((($1)) + 16|0);
 $48 = $47;
 $49 = $48;
 $50 = HEAP32[$49>>2]|0;
 $51 = (($48) + 4)|0;
 $52 = $51;
 $53 = HEAP32[$52>>2]|0;
 $54 = (_i64Add(($50|0),($53|0),($43|0),($46|0))|0);
 $55 = tempRet0;
 $56 = $40;
 $57 = $56;
 HEAP32[$57>>2] = $54;
 $58 = (($56) + 4)|0;
 $59 = $58;
 HEAP32[$59>>2] = $55;
 $60 = ((($0)) + 24|0);
 $61 = $60;
 $62 = $61;
 $63 = HEAP32[$62>>2]|0;
 $64 = (($61) + 4)|0;
 $65 = $64;
 $66 = HEAP32[$65>>2]|0;
 $67 = ((($1)) + 24|0);
 $68 = $67;
 $69 = $68;
 $70 = HEAP32[$69>>2]|0;
 $71 = (($68) + 4)|0;
 $72 = $71;
 $73 = HEAP32[$72>>2]|0;
 $74 = (_i64Add(($70|0),($73|0),($63|0),($66|0))|0);
 $75 = tempRet0;
 $76 = $60;
 $77 = $76;
 HEAP32[$77>>2] = $74;
 $78 = (($76) + 4)|0;
 $79 = $78;
 HEAP32[$79>>2] = $75;
 $80 = ((($0)) + 32|0);
 $81 = $80;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = ((($1)) + 32|0);
 $88 = $87;
 $89 = $88;
 $90 = HEAP32[$89>>2]|0;
 $91 = (($88) + 4)|0;
 $92 = $91;
 $93 = HEAP32[$92>>2]|0;
 $94 = (_i64Add(($90|0),($93|0),($83|0),($86|0))|0);
 $95 = tempRet0;
 $96 = $80;
 $97 = $96;
 HEAP32[$97>>2] = $94;
 $98 = (($96) + 4)|0;
 $99 = $98;
 HEAP32[$99>>2] = $95;
 $100 = ((($0)) + 40|0);
 $101 = $100;
 $102 = $101;
 $103 = HEAP32[$102>>2]|0;
 $104 = (($101) + 4)|0;
 $105 = $104;
 $106 = HEAP32[$105>>2]|0;
 $107 = ((($1)) + 40|0);
 $108 = $107;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (($108) + 4)|0;
 $112 = $111;
 $113 = HEAP32[$112>>2]|0;
 $114 = (_i64Add(($110|0),($113|0),($103|0),($106|0))|0);
 $115 = tempRet0;
 $116 = $100;
 $117 = $116;
 HEAP32[$117>>2] = $114;
 $118 = (($116) + 4)|0;
 $119 = $118;
 HEAP32[$119>>2] = $115;
 $120 = ((($0)) + 48|0);
 $121 = $120;
 $122 = $121;
 $123 = HEAP32[$122>>2]|0;
 $124 = (($121) + 4)|0;
 $125 = $124;
 $126 = HEAP32[$125>>2]|0;
 $127 = ((($1)) + 48|0);
 $128 = $127;
 $129 = $128;
 $130 = HEAP32[$129>>2]|0;
 $131 = (($128) + 4)|0;
 $132 = $131;
 $133 = HEAP32[$132>>2]|0;
 $134 = (_i64Add(($130|0),($133|0),($123|0),($126|0))|0);
 $135 = tempRet0;
 $136 = $120;
 $137 = $136;
 HEAP32[$137>>2] = $134;
 $138 = (($136) + 4)|0;
 $139 = $138;
 HEAP32[$139>>2] = $135;
 $140 = ((($0)) + 56|0);
 $141 = $140;
 $142 = $141;
 $143 = HEAP32[$142>>2]|0;
 $144 = (($141) + 4)|0;
 $145 = $144;
 $146 = HEAP32[$145>>2]|0;
 $147 = ((($1)) + 56|0);
 $148 = $147;
 $149 = $148;
 $150 = HEAP32[$149>>2]|0;
 $151 = (($148) + 4)|0;
 $152 = $151;
 $153 = HEAP32[$152>>2]|0;
 $154 = (_i64Add(($150|0),($153|0),($143|0),($146|0))|0);
 $155 = tempRet0;
 $156 = $140;
 $157 = $156;
 HEAP32[$157>>2] = $154;
 $158 = (($156) + 4)|0;
 $159 = $158;
 HEAP32[$159>>2] = $155;
 $160 = ((($0)) + 64|0);
 $161 = $160;
 $162 = $161;
 $163 = HEAP32[$162>>2]|0;
 $164 = (($161) + 4)|0;
 $165 = $164;
 $166 = HEAP32[$165>>2]|0;
 $167 = ((($1)) + 64|0);
 $168 = $167;
 $169 = $168;
 $170 = HEAP32[$169>>2]|0;
 $171 = (($168) + 4)|0;
 $172 = $171;
 $173 = HEAP32[$172>>2]|0;
 $174 = (_i64Add(($170|0),($173|0),($163|0),($166|0))|0);
 $175 = tempRet0;
 $176 = $160;
 $177 = $176;
 HEAP32[$177>>2] = $174;
 $178 = (($176) + 4)|0;
 $179 = $178;
 HEAP32[$179>>2] = $175;
 $180 = ((($0)) + 72|0);
 $181 = $180;
 $182 = $181;
 $183 = HEAP32[$182>>2]|0;
 $184 = (($181) + 4)|0;
 $185 = $184;
 $186 = HEAP32[$185>>2]|0;
 $187 = ((($1)) + 72|0);
 $188 = $187;
 $189 = $188;
 $190 = HEAP32[$189>>2]|0;
 $191 = (($188) + 4)|0;
 $192 = $191;
 $193 = HEAP32[$192>>2]|0;
 $194 = (_i64Add(($190|0),($193|0),($183|0),($186|0))|0);
 $195 = tempRet0;
 $196 = $180;
 $197 = $196;
 HEAP32[$197>>2] = $194;
 $198 = (($196) + 4)|0;
 $199 = $198;
 HEAP32[$199>>2] = $195;
 return;
}
function _fdifference($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = $0;
 $9 = $8;
 $10 = HEAP32[$9>>2]|0;
 $11 = (($8) + 4)|0;
 $12 = $11;
 $13 = HEAP32[$12>>2]|0;
 $14 = (_i64Subtract(($4|0),($7|0),($10|0),($13|0))|0);
 $15 = tempRet0;
 $16 = $0;
 $17 = $16;
 HEAP32[$17>>2] = $14;
 $18 = (($16) + 4)|0;
 $19 = $18;
 HEAP32[$19>>2] = $15;
 $20 = ((($1)) + 8|0);
 $21 = $20;
 $22 = $21;
 $23 = HEAP32[$22>>2]|0;
 $24 = (($21) + 4)|0;
 $25 = $24;
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($0)) + 8|0);
 $28 = $27;
 $29 = $28;
 $30 = HEAP32[$29>>2]|0;
 $31 = (($28) + 4)|0;
 $32 = $31;
 $33 = HEAP32[$32>>2]|0;
 $34 = (_i64Subtract(($23|0),($26|0),($30|0),($33|0))|0);
 $35 = tempRet0;
 $36 = $27;
 $37 = $36;
 HEAP32[$37>>2] = $34;
 $38 = (($36) + 4)|0;
 $39 = $38;
 HEAP32[$39>>2] = $35;
 $40 = ((($1)) + 16|0);
 $41 = $40;
 $42 = $41;
 $43 = HEAP32[$42>>2]|0;
 $44 = (($41) + 4)|0;
 $45 = $44;
 $46 = HEAP32[$45>>2]|0;
 $47 = ((($0)) + 16|0);
 $48 = $47;
 $49 = $48;
 $50 = HEAP32[$49>>2]|0;
 $51 = (($48) + 4)|0;
 $52 = $51;
 $53 = HEAP32[$52>>2]|0;
 $54 = (_i64Subtract(($43|0),($46|0),($50|0),($53|0))|0);
 $55 = tempRet0;
 $56 = $47;
 $57 = $56;
 HEAP32[$57>>2] = $54;
 $58 = (($56) + 4)|0;
 $59 = $58;
 HEAP32[$59>>2] = $55;
 $60 = ((($1)) + 24|0);
 $61 = $60;
 $62 = $61;
 $63 = HEAP32[$62>>2]|0;
 $64 = (($61) + 4)|0;
 $65 = $64;
 $66 = HEAP32[$65>>2]|0;
 $67 = ((($0)) + 24|0);
 $68 = $67;
 $69 = $68;
 $70 = HEAP32[$69>>2]|0;
 $71 = (($68) + 4)|0;
 $72 = $71;
 $73 = HEAP32[$72>>2]|0;
 $74 = (_i64Subtract(($63|0),($66|0),($70|0),($73|0))|0);
 $75 = tempRet0;
 $76 = $67;
 $77 = $76;
 HEAP32[$77>>2] = $74;
 $78 = (($76) + 4)|0;
 $79 = $78;
 HEAP32[$79>>2] = $75;
 $80 = ((($1)) + 32|0);
 $81 = $80;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $87 = ((($0)) + 32|0);
 $88 = $87;
 $89 = $88;
 $90 = HEAP32[$89>>2]|0;
 $91 = (($88) + 4)|0;
 $92 = $91;
 $93 = HEAP32[$92>>2]|0;
 $94 = (_i64Subtract(($83|0),($86|0),($90|0),($93|0))|0);
 $95 = tempRet0;
 $96 = $87;
 $97 = $96;
 HEAP32[$97>>2] = $94;
 $98 = (($96) + 4)|0;
 $99 = $98;
 HEAP32[$99>>2] = $95;
 $100 = ((($1)) + 40|0);
 $101 = $100;
 $102 = $101;
 $103 = HEAP32[$102>>2]|0;
 $104 = (($101) + 4)|0;
 $105 = $104;
 $106 = HEAP32[$105>>2]|0;
 $107 = ((($0)) + 40|0);
 $108 = $107;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (($108) + 4)|0;
 $112 = $111;
 $113 = HEAP32[$112>>2]|0;
 $114 = (_i64Subtract(($103|0),($106|0),($110|0),($113|0))|0);
 $115 = tempRet0;
 $116 = $107;
 $117 = $116;
 HEAP32[$117>>2] = $114;
 $118 = (($116) + 4)|0;
 $119 = $118;
 HEAP32[$119>>2] = $115;
 $120 = ((($1)) + 48|0);
 $121 = $120;
 $122 = $121;
 $123 = HEAP32[$122>>2]|0;
 $124 = (($121) + 4)|0;
 $125 = $124;
 $126 = HEAP32[$125>>2]|0;
 $127 = ((($0)) + 48|0);
 $128 = $127;
 $129 = $128;
 $130 = HEAP32[$129>>2]|0;
 $131 = (($128) + 4)|0;
 $132 = $131;
 $133 = HEAP32[$132>>2]|0;
 $134 = (_i64Subtract(($123|0),($126|0),($130|0),($133|0))|0);
 $135 = tempRet0;
 $136 = $127;
 $137 = $136;
 HEAP32[$137>>2] = $134;
 $138 = (($136) + 4)|0;
 $139 = $138;
 HEAP32[$139>>2] = $135;
 $140 = ((($1)) + 56|0);
 $141 = $140;
 $142 = $141;
 $143 = HEAP32[$142>>2]|0;
 $144 = (($141) + 4)|0;
 $145 = $144;
 $146 = HEAP32[$145>>2]|0;
 $147 = ((($0)) + 56|0);
 $148 = $147;
 $149 = $148;
 $150 = HEAP32[$149>>2]|0;
 $151 = (($148) + 4)|0;
 $152 = $151;
 $153 = HEAP32[$152>>2]|0;
 $154 = (_i64Subtract(($143|0),($146|0),($150|0),($153|0))|0);
 $155 = tempRet0;
 $156 = $147;
 $157 = $156;
 HEAP32[$157>>2] = $154;
 $158 = (($156) + 4)|0;
 $159 = $158;
 HEAP32[$159>>2] = $155;
 $160 = ((($1)) + 64|0);
 $161 = $160;
 $162 = $161;
 $163 = HEAP32[$162>>2]|0;
 $164 = (($161) + 4)|0;
 $165 = $164;
 $166 = HEAP32[$165>>2]|0;
 $167 = ((($0)) + 64|0);
 $168 = $167;
 $169 = $168;
 $170 = HEAP32[$169>>2]|0;
 $171 = (($168) + 4)|0;
 $172 = $171;
 $173 = HEAP32[$172>>2]|0;
 $174 = (_i64Subtract(($163|0),($166|0),($170|0),($173|0))|0);
 $175 = tempRet0;
 $176 = $167;
 $177 = $176;
 HEAP32[$177>>2] = $174;
 $178 = (($176) + 4)|0;
 $179 = $178;
 HEAP32[$179>>2] = $175;
 $180 = ((($1)) + 72|0);
 $181 = $180;
 $182 = $181;
 $183 = HEAP32[$182>>2]|0;
 $184 = (($181) + 4)|0;
 $185 = $184;
 $186 = HEAP32[$185>>2]|0;
 $187 = ((($0)) + 72|0);
 $188 = $187;
 $189 = $188;
 $190 = HEAP32[$189>>2]|0;
 $191 = (($188) + 4)|0;
 $192 = $191;
 $193 = HEAP32[$192>>2]|0;
 $194 = (_i64Subtract(($183|0),($186|0),($190|0),($193|0))|0);
 $195 = tempRet0;
 $196 = $187;
 $197 = $196;
 HEAP32[$197>>2] = $194;
 $198 = (($196) + 4)|0;
 $199 = $198;
 HEAP32[$199>>2] = $195;
 return;
}
function _fscalar_product($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = (___muldi3(($4|0),($7|0),121665,0)|0);
 $9 = tempRet0;
 $10 = $0;
 $11 = $10;
 HEAP32[$11>>2] = $8;
 $12 = (($10) + 4)|0;
 $13 = $12;
 HEAP32[$13>>2] = $9;
 $14 = ((($1)) + 8|0);
 $15 = $14;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = (($15) + 4)|0;
 $19 = $18;
 $20 = HEAP32[$19>>2]|0;
 $21 = (___muldi3(($17|0),($20|0),121665,0)|0);
 $22 = tempRet0;
 $23 = ((($0)) + 8|0);
 $24 = $23;
 $25 = $24;
 HEAP32[$25>>2] = $21;
 $26 = (($24) + 4)|0;
 $27 = $26;
 HEAP32[$27>>2] = $22;
 $28 = ((($1)) + 16|0);
 $29 = $28;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = (($29) + 4)|0;
 $33 = $32;
 $34 = HEAP32[$33>>2]|0;
 $35 = (___muldi3(($31|0),($34|0),121665,0)|0);
 $36 = tempRet0;
 $37 = ((($0)) + 16|0);
 $38 = $37;
 $39 = $38;
 HEAP32[$39>>2] = $35;
 $40 = (($38) + 4)|0;
 $41 = $40;
 HEAP32[$41>>2] = $36;
 $42 = ((($1)) + 24|0);
 $43 = $42;
 $44 = $43;
 $45 = HEAP32[$44>>2]|0;
 $46 = (($43) + 4)|0;
 $47 = $46;
 $48 = HEAP32[$47>>2]|0;
 $49 = (___muldi3(($45|0),($48|0),121665,0)|0);
 $50 = tempRet0;
 $51 = ((($0)) + 24|0);
 $52 = $51;
 $53 = $52;
 HEAP32[$53>>2] = $49;
 $54 = (($52) + 4)|0;
 $55 = $54;
 HEAP32[$55>>2] = $50;
 $56 = ((($1)) + 32|0);
 $57 = $56;
 $58 = $57;
 $59 = HEAP32[$58>>2]|0;
 $60 = (($57) + 4)|0;
 $61 = $60;
 $62 = HEAP32[$61>>2]|0;
 $63 = (___muldi3(($59|0),($62|0),121665,0)|0);
 $64 = tempRet0;
 $65 = ((($0)) + 32|0);
 $66 = $65;
 $67 = $66;
 HEAP32[$67>>2] = $63;
 $68 = (($66) + 4)|0;
 $69 = $68;
 HEAP32[$69>>2] = $64;
 $70 = ((($1)) + 40|0);
 $71 = $70;
 $72 = $71;
 $73 = HEAP32[$72>>2]|0;
 $74 = (($71) + 4)|0;
 $75 = $74;
 $76 = HEAP32[$75>>2]|0;
 $77 = (___muldi3(($73|0),($76|0),121665,0)|0);
 $78 = tempRet0;
 $79 = ((($0)) + 40|0);
 $80 = $79;
 $81 = $80;
 HEAP32[$81>>2] = $77;
 $82 = (($80) + 4)|0;
 $83 = $82;
 HEAP32[$83>>2] = $78;
 $84 = ((($1)) + 48|0);
 $85 = $84;
 $86 = $85;
 $87 = HEAP32[$86>>2]|0;
 $88 = (($85) + 4)|0;
 $89 = $88;
 $90 = HEAP32[$89>>2]|0;
 $91 = (___muldi3(($87|0),($90|0),121665,0)|0);
 $92 = tempRet0;
 $93 = ((($0)) + 48|0);
 $94 = $93;
 $95 = $94;
 HEAP32[$95>>2] = $91;
 $96 = (($94) + 4)|0;
 $97 = $96;
 HEAP32[$97>>2] = $92;
 $98 = ((($1)) + 56|0);
 $99 = $98;
 $100 = $99;
 $101 = HEAP32[$100>>2]|0;
 $102 = (($99) + 4)|0;
 $103 = $102;
 $104 = HEAP32[$103>>2]|0;
 $105 = (___muldi3(($101|0),($104|0),121665,0)|0);
 $106 = tempRet0;
 $107 = ((($0)) + 56|0);
 $108 = $107;
 $109 = $108;
 HEAP32[$109>>2] = $105;
 $110 = (($108) + 4)|0;
 $111 = $110;
 HEAP32[$111>>2] = $106;
 $112 = ((($1)) + 64|0);
 $113 = $112;
 $114 = $113;
 $115 = HEAP32[$114>>2]|0;
 $116 = (($113) + 4)|0;
 $117 = $116;
 $118 = HEAP32[$117>>2]|0;
 $119 = (___muldi3(($115|0),($118|0),121665,0)|0);
 $120 = tempRet0;
 $121 = ((($0)) + 64|0);
 $122 = $121;
 $123 = $122;
 HEAP32[$123>>2] = $119;
 $124 = (($122) + 4)|0;
 $125 = $124;
 HEAP32[$125>>2] = $120;
 $126 = ((($1)) + 72|0);
 $127 = $126;
 $128 = $127;
 $129 = HEAP32[$128>>2]|0;
 $130 = (($127) + 4)|0;
 $131 = $130;
 $132 = HEAP32[$131>>2]|0;
 $133 = (___muldi3(($129|0),($132|0),121665,0)|0);
 $134 = tempRet0;
 $135 = ((($0)) + 72|0);
 $136 = $135;
 $137 = $136;
 HEAP32[$137>>2] = $133;
 $138 = (($136) + 4)|0;
 $139 = $138;
 HEAP32[$139>>2] = $134;
 return;
}
function _crypto_sign_ed25519_ref10_fe_0($0) {
 $0 = $0|0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 dest=$0; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _crypto_sign_ed25519_ref10_fe_1($0) {
 $0 = $0|0;
 var $1 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 1;
 $1 = ((($0)) + 4|0);
 dest=$1; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _crypto_sign_ed25519_ref10_fe_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($22) + ($3))|0;
 $42 = (($24) + ($5))|0;
 $43 = (($26) + ($7))|0;
 $44 = (($28) + ($9))|0;
 $45 = (($30) + ($11))|0;
 $46 = (($32) + ($13))|0;
 $47 = (($34) + ($15))|0;
 $48 = (($36) + ($17))|0;
 $49 = (($38) + ($19))|0;
 $50 = (($40) + ($21))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _crypto_sign_ed25519_ref10_fe_cmov($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($0)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($0)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($0)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($0)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($0)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($0)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$1>>2]|0;
 $23 = ((($1)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($1)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($1)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($1)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($1)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($1)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($1)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($1)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($1)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = $22 ^ $3;
 $42 = $24 ^ $5;
 $43 = $26 ^ $7;
 $44 = $28 ^ $9;
 $45 = $30 ^ $11;
 $46 = $32 ^ $13;
 $47 = $34 ^ $15;
 $48 = $36 ^ $17;
 $49 = $38 ^ $19;
 $50 = $40 ^ $21;
 $51 = (0 - ($2))|0;
 $52 = $41 & $51;
 $53 = $42 & $51;
 $54 = $43 & $51;
 $55 = $44 & $51;
 $56 = $45 & $51;
 $57 = $46 & $51;
 $58 = $47 & $51;
 $59 = $48 & $51;
 $60 = $49 & $51;
 $61 = $50 & $51;
 $62 = $52 ^ $3;
 HEAP32[$0>>2] = $62;
 $63 = $53 ^ $5;
 HEAP32[$4>>2] = $63;
 $64 = $54 ^ $7;
 HEAP32[$6>>2] = $64;
 $65 = $55 ^ $9;
 HEAP32[$8>>2] = $65;
 $66 = $56 ^ $11;
 HEAP32[$10>>2] = $66;
 $67 = $57 ^ $13;
 HEAP32[$12>>2] = $67;
 $68 = $58 ^ $15;
 HEAP32[$14>>2] = $68;
 $69 = $59 ^ $17;
 HEAP32[$16>>2] = $69;
 $70 = $60 ^ $19;
 HEAP32[$18>>2] = $70;
 $71 = $61 ^ $21;
 HEAP32[$20>>2] = $71;
 return;
}
function _crypto_sign_ed25519_ref10_fe_copy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 HEAP32[$0>>2] = $2;
 $21 = ((($0)) + 4|0);
 HEAP32[$21>>2] = $4;
 $22 = ((($0)) + 8|0);
 HEAP32[$22>>2] = $6;
 $23 = ((($0)) + 12|0);
 HEAP32[$23>>2] = $8;
 $24 = ((($0)) + 16|0);
 HEAP32[$24>>2] = $10;
 $25 = ((($0)) + 20|0);
 HEAP32[$25>>2] = $12;
 $26 = ((($0)) + 24|0);
 HEAP32[$26>>2] = $14;
 $27 = ((($0)) + 28|0);
 HEAP32[$27>>2] = $16;
 $28 = ((($0)) + 32|0);
 HEAP32[$28>>2] = $18;
 $29 = ((($0)) + 36|0);
 HEAP32[$29>>2] = $20;
 return;
}
function _crypto_sign_ed25519_ref10_fe_frombytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_load_4($1)|0);
 $3 = tempRet0;
 $4 = ((($1)) + 4|0);
 $5 = (_load_3($4)|0);
 $6 = tempRet0;
 $7 = (_bitshift64Shl(($5|0),($6|0),6)|0);
 $8 = tempRet0;
 $9 = ((($1)) + 7|0);
 $10 = (_load_3($9)|0);
 $11 = tempRet0;
 $12 = (_bitshift64Shl(($10|0),($11|0),5)|0);
 $13 = tempRet0;
 $14 = ((($1)) + 10|0);
 $15 = (_load_3($14)|0);
 $16 = tempRet0;
 $17 = (_bitshift64Shl(($15|0),($16|0),3)|0);
 $18 = tempRet0;
 $19 = ((($1)) + 13|0);
 $20 = (_load_3($19)|0);
 $21 = tempRet0;
 $22 = (_bitshift64Shl(($20|0),($21|0),2)|0);
 $23 = tempRet0;
 $24 = ((($1)) + 16|0);
 $25 = (_load_4($24)|0);
 $26 = tempRet0;
 $27 = ((($1)) + 20|0);
 $28 = (_load_3($27)|0);
 $29 = tempRet0;
 $30 = (_bitshift64Shl(($28|0),($29|0),7)|0);
 $31 = tempRet0;
 $32 = ((($1)) + 23|0);
 $33 = (_load_3($32)|0);
 $34 = tempRet0;
 $35 = (_bitshift64Shl(($33|0),($34|0),5)|0);
 $36 = tempRet0;
 $37 = ((($1)) + 26|0);
 $38 = (_load_3($37)|0);
 $39 = tempRet0;
 $40 = (_bitshift64Shl(($38|0),($39|0),4)|0);
 $41 = tempRet0;
 $42 = ((($1)) + 29|0);
 $43 = (_load_3($42)|0);
 $44 = tempRet0;
 $45 = (_bitshift64Shl(($43|0),($44|0),2)|0);
 $46 = tempRet0;
 $47 = $45 & 33554428;
 $48 = (_i64Add(($47|0),0,16777216,0)|0);
 $49 = tempRet0;
 $50 = (_bitshift64Lshr(($48|0),($49|0),25)|0);
 $51 = tempRet0;
 $52 = (_i64Subtract(0,0,($50|0),($51|0))|0);
 $53 = tempRet0;
 $54 = $52 & 19;
 $55 = (_i64Add(($54|0),0,($2|0),($3|0))|0);
 $56 = tempRet0;
 $57 = (_bitshift64Shl(($50|0),($51|0),25)|0);
 $58 = tempRet0;
 $59 = (_i64Add(($7|0),($8|0),16777216,0)|0);
 $60 = tempRet0;
 $61 = (_bitshift64Ashr(($59|0),($60|0),25)|0);
 $62 = tempRet0;
 $63 = (_i64Add(($61|0),($62|0),($12|0),($13|0))|0);
 $64 = tempRet0;
 $65 = (_bitshift64Shl(($61|0),($62|0),25)|0);
 $66 = tempRet0;
 $67 = (_i64Subtract(($7|0),($8|0),($65|0),($66|0))|0);
 $68 = tempRet0;
 $69 = (_i64Add(($17|0),($18|0),16777216,0)|0);
 $70 = tempRet0;
 $71 = (_bitshift64Ashr(($69|0),($70|0),25)|0);
 $72 = tempRet0;
 $73 = (_i64Add(($71|0),($72|0),($22|0),($23|0))|0);
 $74 = tempRet0;
 $75 = (_bitshift64Shl(($71|0),($72|0),25)|0);
 $76 = tempRet0;
 $77 = (_i64Subtract(($17|0),($18|0),($75|0),($76|0))|0);
 $78 = tempRet0;
 $79 = (_i64Add(($25|0),($26|0),16777216,0)|0);
 $80 = tempRet0;
 $81 = (_bitshift64Ashr(($79|0),($80|0),25)|0);
 $82 = tempRet0;
 $83 = (_i64Add(($30|0),($31|0),($81|0),($82|0))|0);
 $84 = tempRet0;
 $85 = (_bitshift64Shl(($81|0),($82|0),25)|0);
 $86 = tempRet0;
 $87 = (_i64Subtract(($25|0),($26|0),($85|0),($86|0))|0);
 $88 = tempRet0;
 $89 = (_i64Add(($35|0),($36|0),16777216,0)|0);
 $90 = tempRet0;
 $91 = (_bitshift64Ashr(($89|0),($90|0),25)|0);
 $92 = tempRet0;
 $93 = (_i64Add(($91|0),($92|0),($40|0),($41|0))|0);
 $94 = tempRet0;
 $95 = (_bitshift64Shl(($91|0),($92|0),25)|0);
 $96 = tempRet0;
 $97 = (_i64Add(($55|0),($56|0),33554432,0)|0);
 $98 = tempRet0;
 $99 = (_bitshift64Ashr(($97|0),($98|0),26)|0);
 $100 = tempRet0;
 $101 = (_i64Add(($67|0),($68|0),($99|0),($100|0))|0);
 $102 = tempRet0;
 $103 = (_bitshift64Shl(($99|0),($100|0),26)|0);
 $104 = tempRet0;
 $105 = (_i64Subtract(($55|0),($56|0),($103|0),($104|0))|0);
 $106 = tempRet0;
 $107 = (_i64Add(($63|0),($64|0),33554432,0)|0);
 $108 = tempRet0;
 $109 = (_bitshift64Ashr(($107|0),($108|0),26)|0);
 $110 = tempRet0;
 $111 = (_i64Add(($77|0),($78|0),($109|0),($110|0))|0);
 $112 = tempRet0;
 $113 = (_bitshift64Shl(($109|0),($110|0),26)|0);
 $114 = tempRet0;
 $115 = (_i64Subtract(($63|0),($64|0),($113|0),($114|0))|0);
 $116 = tempRet0;
 $117 = (_i64Add(($73|0),($74|0),33554432,0)|0);
 $118 = tempRet0;
 $119 = (_bitshift64Ashr(($117|0),($118|0),26)|0);
 $120 = tempRet0;
 $121 = (_i64Add(($87|0),($88|0),($119|0),($120|0))|0);
 $122 = tempRet0;
 $123 = (_bitshift64Shl(($119|0),($120|0),26)|0);
 $124 = tempRet0;
 $125 = (_i64Subtract(($73|0),($74|0),($123|0),($124|0))|0);
 $126 = tempRet0;
 $127 = (_i64Add(($83|0),($84|0),33554432,0)|0);
 $128 = tempRet0;
 $129 = (_bitshift64Ashr(($127|0),($128|0),26)|0);
 $130 = tempRet0;
 $131 = (_i64Add(($129|0),($130|0),($35|0),($36|0))|0);
 $132 = tempRet0;
 $133 = (_i64Subtract(($131|0),($132|0),($95|0),($96|0))|0);
 $134 = tempRet0;
 $135 = (_bitshift64Shl(($129|0),($130|0),26)|0);
 $136 = tempRet0;
 $137 = (_i64Subtract(($83|0),($84|0),($135|0),($136|0))|0);
 $138 = tempRet0;
 $139 = (_i64Add(($93|0),($94|0),33554432,0)|0);
 $140 = tempRet0;
 $141 = (_bitshift64Ashr(($139|0),($140|0),26)|0);
 $142 = tempRet0;
 $143 = (_i64Add(($141|0),($142|0),($47|0),0)|0);
 $144 = tempRet0;
 $145 = (_i64Subtract(($143|0),($144|0),($57|0),($58|0))|0);
 $146 = tempRet0;
 $147 = (_bitshift64Shl(($141|0),($142|0),26)|0);
 $148 = tempRet0;
 $149 = (_i64Subtract(($93|0),($94|0),($147|0),($148|0))|0);
 $150 = tempRet0;
 HEAP32[$0>>2] = $105;
 $151 = ((($0)) + 4|0);
 HEAP32[$151>>2] = $101;
 $152 = ((($0)) + 8|0);
 HEAP32[$152>>2] = $115;
 $153 = ((($0)) + 12|0);
 HEAP32[$153>>2] = $111;
 $154 = ((($0)) + 16|0);
 HEAP32[$154>>2] = $125;
 $155 = ((($0)) + 20|0);
 HEAP32[$155>>2] = $121;
 $156 = ((($0)) + 24|0);
 HEAP32[$156>>2] = $137;
 $157 = ((($0)) + 28|0);
 HEAP32[$157>>2] = $133;
 $158 = ((($0)) + 32|0);
 HEAP32[$158>>2] = $149;
 $159 = ((($0)) + 36|0);
 HEAP32[$159>>2] = $145;
 return;
}
function _load_4($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 $16 = ((($0)) + 3|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17&255;
 $19 = (_bitshift64Shl(($18|0),0,24)|0);
 $20 = tempRet0;
 $21 = $14 | $19;
 $22 = $15 | $20;
 tempRet0 = ($22);
 return ($21|0);
}
function _load_3($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 tempRet0 = ($15);
 return ($14|0);
}
function _crypto_sign_ed25519_ref10_fe_invert($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$728 = 0, $$827 = 0, $$926 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $exitcond = 0, $exitcond34 = 0, $exitcond35 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $2 = sp + 120|0;
 $3 = sp + 80|0;
 $4 = sp + 40|0;
 $5 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($2,$1);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$2,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$2);
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_mul($4,$5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 $$728 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($4,$4);
  $6 = (($$728) + 1)|0;
  $exitcond35 = ($6|0)==(50);
  if ($exitcond35) {
   break;
  } else {
   $$728 = $6;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($5,$4);
 $$827 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($5,$5);
  $7 = (($$827) + 1)|0;
  $exitcond34 = ($7|0)==(100);
  if ($exitcond34) {
   break;
  } else {
   $$827 = $7;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($4,$5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 $$926 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($4,$4);
  $8 = (($$926) + 1)|0;
  $exitcond = ($8|0)==(50);
  if ($exitcond) {
   break;
  } else {
   $$926 = $8;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($0,$3,$2);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_fe_isnegative($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 _crypto_sign_ed25519_ref10_fe_tobytes($1,$0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 & 1;
 $4 = $3&255;
 STACKTOP = sp;return ($4|0);
}
function _crypto_sign_ed25519_ref10_fe_isnonzero($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 _crypto_sign_ed25519_ref10_fe_tobytes($1,$0);
 $2 = (_crypto_verify_32_ref($1,33460)|0);
 STACKTOP = sp;return ($2|0);
}
function _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0;
 var $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0;
 var $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0;
 var $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0;
 var $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0;
 var $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0;
 var $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0;
 var $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0;
 var $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0;
 var $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0;
 var $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0;
 var $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0;
 var $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0;
 var $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0;
 var $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0;
 var $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0;
 var $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0;
 var $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0;
 var $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = ($24*19)|0;
 $42 = ($26*19)|0;
 $43 = ($28*19)|0;
 $44 = ($30*19)|0;
 $45 = ($32*19)|0;
 $46 = ($34*19)|0;
 $47 = ($36*19)|0;
 $48 = ($38*19)|0;
 $49 = ($40*19)|0;
 $50 = $5 << 1;
 $51 = $9 << 1;
 $52 = $13 << 1;
 $53 = $17 << 1;
 $54 = $21 << 1;
 $55 = ($3|0)<(0);
 $56 = $55 << 31 >> 31;
 $57 = ($22|0)<(0);
 $58 = $57 << 31 >> 31;
 $59 = (___muldi3(($22|0),($58|0),($3|0),($56|0))|0);
 $60 = tempRet0;
 $61 = ($24|0)<(0);
 $62 = $61 << 31 >> 31;
 $63 = (___muldi3(($24|0),($62|0),($3|0),($56|0))|0);
 $64 = tempRet0;
 $65 = ($26|0)<(0);
 $66 = $65 << 31 >> 31;
 $67 = (___muldi3(($26|0),($66|0),($3|0),($56|0))|0);
 $68 = tempRet0;
 $69 = ($28|0)<(0);
 $70 = $69 << 31 >> 31;
 $71 = (___muldi3(($28|0),($70|0),($3|0),($56|0))|0);
 $72 = tempRet0;
 $73 = ($30|0)<(0);
 $74 = $73 << 31 >> 31;
 $75 = (___muldi3(($30|0),($74|0),($3|0),($56|0))|0);
 $76 = tempRet0;
 $77 = ($32|0)<(0);
 $78 = $77 << 31 >> 31;
 $79 = (___muldi3(($32|0),($78|0),($3|0),($56|0))|0);
 $80 = tempRet0;
 $81 = ($34|0)<(0);
 $82 = $81 << 31 >> 31;
 $83 = (___muldi3(($34|0),($82|0),($3|0),($56|0))|0);
 $84 = tempRet0;
 $85 = ($36|0)<(0);
 $86 = $85 << 31 >> 31;
 $87 = (___muldi3(($36|0),($86|0),($3|0),($56|0))|0);
 $88 = tempRet0;
 $89 = ($38|0)<(0);
 $90 = $89 << 31 >> 31;
 $91 = (___muldi3(($38|0),($90|0),($3|0),($56|0))|0);
 $92 = tempRet0;
 $93 = ($40|0)<(0);
 $94 = $93 << 31 >> 31;
 $95 = (___muldi3(($40|0),($94|0),($3|0),($56|0))|0);
 $96 = tempRet0;
 $97 = ($5|0)<(0);
 $98 = $97 << 31 >> 31;
 $99 = (___muldi3(($22|0),($58|0),($5|0),($98|0))|0);
 $100 = tempRet0;
 $101 = ($50|0)<(0);
 $102 = $101 << 31 >> 31;
 $103 = (___muldi3(($24|0),($62|0),($50|0),($102|0))|0);
 $104 = tempRet0;
 $105 = (___muldi3(($26|0),($66|0),($5|0),($98|0))|0);
 $106 = tempRet0;
 $107 = (___muldi3(($28|0),($70|0),($50|0),($102|0))|0);
 $108 = tempRet0;
 $109 = (___muldi3(($30|0),($74|0),($5|0),($98|0))|0);
 $110 = tempRet0;
 $111 = (___muldi3(($32|0),($78|0),($50|0),($102|0))|0);
 $112 = tempRet0;
 $113 = (___muldi3(($34|0),($82|0),($5|0),($98|0))|0);
 $114 = tempRet0;
 $115 = (___muldi3(($36|0),($86|0),($50|0),($102|0))|0);
 $116 = tempRet0;
 $117 = (___muldi3(($38|0),($90|0),($5|0),($98|0))|0);
 $118 = tempRet0;
 $119 = ($49|0)<(0);
 $120 = $119 << 31 >> 31;
 $121 = (___muldi3(($49|0),($120|0),($50|0),($102|0))|0);
 $122 = tempRet0;
 $123 = ($7|0)<(0);
 $124 = $123 << 31 >> 31;
 $125 = (___muldi3(($22|0),($58|0),($7|0),($124|0))|0);
 $126 = tempRet0;
 $127 = (___muldi3(($24|0),($62|0),($7|0),($124|0))|0);
 $128 = tempRet0;
 $129 = (___muldi3(($26|0),($66|0),($7|0),($124|0))|0);
 $130 = tempRet0;
 $131 = (___muldi3(($28|0),($70|0),($7|0),($124|0))|0);
 $132 = tempRet0;
 $133 = (___muldi3(($30|0),($74|0),($7|0),($124|0))|0);
 $134 = tempRet0;
 $135 = (___muldi3(($32|0),($78|0),($7|0),($124|0))|0);
 $136 = tempRet0;
 $137 = (___muldi3(($34|0),($82|0),($7|0),($124|0))|0);
 $138 = tempRet0;
 $139 = (___muldi3(($36|0),($86|0),($7|0),($124|0))|0);
 $140 = tempRet0;
 $141 = ($48|0)<(0);
 $142 = $141 << 31 >> 31;
 $143 = (___muldi3(($48|0),($142|0),($7|0),($124|0))|0);
 $144 = tempRet0;
 $145 = (___muldi3(($49|0),($120|0),($7|0),($124|0))|0);
 $146 = tempRet0;
 $147 = ($9|0)<(0);
 $148 = $147 << 31 >> 31;
 $149 = (___muldi3(($22|0),($58|0),($9|0),($148|0))|0);
 $150 = tempRet0;
 $151 = ($51|0)<(0);
 $152 = $151 << 31 >> 31;
 $153 = (___muldi3(($24|0),($62|0),($51|0),($152|0))|0);
 $154 = tempRet0;
 $155 = (___muldi3(($26|0),($66|0),($9|0),($148|0))|0);
 $156 = tempRet0;
 $157 = (___muldi3(($28|0),($70|0),($51|0),($152|0))|0);
 $158 = tempRet0;
 $159 = (___muldi3(($30|0),($74|0),($9|0),($148|0))|0);
 $160 = tempRet0;
 $161 = (___muldi3(($32|0),($78|0),($51|0),($152|0))|0);
 $162 = tempRet0;
 $163 = (___muldi3(($34|0),($82|0),($9|0),($148|0))|0);
 $164 = tempRet0;
 $165 = ($47|0)<(0);
 $166 = $165 << 31 >> 31;
 $167 = (___muldi3(($47|0),($166|0),($51|0),($152|0))|0);
 $168 = tempRet0;
 $169 = (___muldi3(($48|0),($142|0),($9|0),($148|0))|0);
 $170 = tempRet0;
 $171 = (___muldi3(($49|0),($120|0),($51|0),($152|0))|0);
 $172 = tempRet0;
 $173 = ($11|0)<(0);
 $174 = $173 << 31 >> 31;
 $175 = (___muldi3(($22|0),($58|0),($11|0),($174|0))|0);
 $176 = tempRet0;
 $177 = (___muldi3(($24|0),($62|0),($11|0),($174|0))|0);
 $178 = tempRet0;
 $179 = (___muldi3(($26|0),($66|0),($11|0),($174|0))|0);
 $180 = tempRet0;
 $181 = (___muldi3(($28|0),($70|0),($11|0),($174|0))|0);
 $182 = tempRet0;
 $183 = (___muldi3(($30|0),($74|0),($11|0),($174|0))|0);
 $184 = tempRet0;
 $185 = (___muldi3(($32|0),($78|0),($11|0),($174|0))|0);
 $186 = tempRet0;
 $187 = ($46|0)<(0);
 $188 = $187 << 31 >> 31;
 $189 = (___muldi3(($46|0),($188|0),($11|0),($174|0))|0);
 $190 = tempRet0;
 $191 = (___muldi3(($47|0),($166|0),($11|0),($174|0))|0);
 $192 = tempRet0;
 $193 = (___muldi3(($48|0),($142|0),($11|0),($174|0))|0);
 $194 = tempRet0;
 $195 = (___muldi3(($49|0),($120|0),($11|0),($174|0))|0);
 $196 = tempRet0;
 $197 = ($13|0)<(0);
 $198 = $197 << 31 >> 31;
 $199 = (___muldi3(($22|0),($58|0),($13|0),($198|0))|0);
 $200 = tempRet0;
 $201 = ($52|0)<(0);
 $202 = $201 << 31 >> 31;
 $203 = (___muldi3(($24|0),($62|0),($52|0),($202|0))|0);
 $204 = tempRet0;
 $205 = (___muldi3(($26|0),($66|0),($13|0),($198|0))|0);
 $206 = tempRet0;
 $207 = (___muldi3(($28|0),($70|0),($52|0),($202|0))|0);
 $208 = tempRet0;
 $209 = (___muldi3(($30|0),($74|0),($13|0),($198|0))|0);
 $210 = tempRet0;
 $211 = ($45|0)<(0);
 $212 = $211 << 31 >> 31;
 $213 = (___muldi3(($45|0),($212|0),($52|0),($202|0))|0);
 $214 = tempRet0;
 $215 = (___muldi3(($46|0),($188|0),($13|0),($198|0))|0);
 $216 = tempRet0;
 $217 = (___muldi3(($47|0),($166|0),($52|0),($202|0))|0);
 $218 = tempRet0;
 $219 = (___muldi3(($48|0),($142|0),($13|0),($198|0))|0);
 $220 = tempRet0;
 $221 = (___muldi3(($49|0),($120|0),($52|0),($202|0))|0);
 $222 = tempRet0;
 $223 = ($15|0)<(0);
 $224 = $223 << 31 >> 31;
 $225 = (___muldi3(($22|0),($58|0),($15|0),($224|0))|0);
 $226 = tempRet0;
 $227 = (___muldi3(($24|0),($62|0),($15|0),($224|0))|0);
 $228 = tempRet0;
 $229 = (___muldi3(($26|0),($66|0),($15|0),($224|0))|0);
 $230 = tempRet0;
 $231 = (___muldi3(($28|0),($70|0),($15|0),($224|0))|0);
 $232 = tempRet0;
 $233 = ($44|0)<(0);
 $234 = $233 << 31 >> 31;
 $235 = (___muldi3(($44|0),($234|0),($15|0),($224|0))|0);
 $236 = tempRet0;
 $237 = (___muldi3(($45|0),($212|0),($15|0),($224|0))|0);
 $238 = tempRet0;
 $239 = (___muldi3(($46|0),($188|0),($15|0),($224|0))|0);
 $240 = tempRet0;
 $241 = (___muldi3(($47|0),($166|0),($15|0),($224|0))|0);
 $242 = tempRet0;
 $243 = (___muldi3(($48|0),($142|0),($15|0),($224|0))|0);
 $244 = tempRet0;
 $245 = (___muldi3(($49|0),($120|0),($15|0),($224|0))|0);
 $246 = tempRet0;
 $247 = ($17|0)<(0);
 $248 = $247 << 31 >> 31;
 $249 = (___muldi3(($22|0),($58|0),($17|0),($248|0))|0);
 $250 = tempRet0;
 $251 = ($53|0)<(0);
 $252 = $251 << 31 >> 31;
 $253 = (___muldi3(($24|0),($62|0),($53|0),($252|0))|0);
 $254 = tempRet0;
 $255 = (___muldi3(($26|0),($66|0),($17|0),($248|0))|0);
 $256 = tempRet0;
 $257 = ($43|0)<(0);
 $258 = $257 << 31 >> 31;
 $259 = (___muldi3(($43|0),($258|0),($53|0),($252|0))|0);
 $260 = tempRet0;
 $261 = (___muldi3(($44|0),($234|0),($17|0),($248|0))|0);
 $262 = tempRet0;
 $263 = (___muldi3(($45|0),($212|0),($53|0),($252|0))|0);
 $264 = tempRet0;
 $265 = (___muldi3(($46|0),($188|0),($17|0),($248|0))|0);
 $266 = tempRet0;
 $267 = (___muldi3(($47|0),($166|0),($53|0),($252|0))|0);
 $268 = tempRet0;
 $269 = (___muldi3(($48|0),($142|0),($17|0),($248|0))|0);
 $270 = tempRet0;
 $271 = (___muldi3(($49|0),($120|0),($53|0),($252|0))|0);
 $272 = tempRet0;
 $273 = ($19|0)<(0);
 $274 = $273 << 31 >> 31;
 $275 = (___muldi3(($22|0),($58|0),($19|0),($274|0))|0);
 $276 = tempRet0;
 $277 = (___muldi3(($24|0),($62|0),($19|0),($274|0))|0);
 $278 = tempRet0;
 $279 = ($42|0)<(0);
 $280 = $279 << 31 >> 31;
 $281 = (___muldi3(($42|0),($280|0),($19|0),($274|0))|0);
 $282 = tempRet0;
 $283 = (___muldi3(($43|0),($258|0),($19|0),($274|0))|0);
 $284 = tempRet0;
 $285 = (___muldi3(($44|0),($234|0),($19|0),($274|0))|0);
 $286 = tempRet0;
 $287 = (___muldi3(($45|0),($212|0),($19|0),($274|0))|0);
 $288 = tempRet0;
 $289 = (___muldi3(($46|0),($188|0),($19|0),($274|0))|0);
 $290 = tempRet0;
 $291 = (___muldi3(($47|0),($166|0),($19|0),($274|0))|0);
 $292 = tempRet0;
 $293 = (___muldi3(($48|0),($142|0),($19|0),($274|0))|0);
 $294 = tempRet0;
 $295 = (___muldi3(($49|0),($120|0),($19|0),($274|0))|0);
 $296 = tempRet0;
 $297 = ($21|0)<(0);
 $298 = $297 << 31 >> 31;
 $299 = (___muldi3(($22|0),($58|0),($21|0),($298|0))|0);
 $300 = tempRet0;
 $301 = ($54|0)<(0);
 $302 = $301 << 31 >> 31;
 $303 = ($41|0)<(0);
 $304 = $303 << 31 >> 31;
 $305 = (___muldi3(($41|0),($304|0),($54|0),($302|0))|0);
 $306 = tempRet0;
 $307 = (___muldi3(($42|0),($280|0),($21|0),($298|0))|0);
 $308 = tempRet0;
 $309 = (___muldi3(($43|0),($258|0),($54|0),($302|0))|0);
 $310 = tempRet0;
 $311 = (___muldi3(($44|0),($234|0),($21|0),($298|0))|0);
 $312 = tempRet0;
 $313 = (___muldi3(($45|0),($212|0),($54|0),($302|0))|0);
 $314 = tempRet0;
 $315 = (___muldi3(($46|0),($188|0),($21|0),($298|0))|0);
 $316 = tempRet0;
 $317 = (___muldi3(($47|0),($166|0),($54|0),($302|0))|0);
 $318 = tempRet0;
 $319 = (___muldi3(($48|0),($142|0),($21|0),($298|0))|0);
 $320 = tempRet0;
 $321 = (___muldi3(($49|0),($120|0),($54|0),($302|0))|0);
 $322 = tempRet0;
 $323 = (_i64Add(($305|0),($306|0),($59|0),($60|0))|0);
 $324 = tempRet0;
 $325 = (_i64Add(($323|0),($324|0),($281|0),($282|0))|0);
 $326 = tempRet0;
 $327 = (_i64Add(($325|0),($326|0),($259|0),($260|0))|0);
 $328 = tempRet0;
 $329 = (_i64Add(($327|0),($328|0),($235|0),($236|0))|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($213|0),($214|0))|0);
 $332 = tempRet0;
 $333 = (_i64Add(($331|0),($332|0),($189|0),($190|0))|0);
 $334 = tempRet0;
 $335 = (_i64Add(($333|0),($334|0),($167|0),($168|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($335|0),($336|0),($143|0),($144|0))|0);
 $338 = tempRet0;
 $339 = (_i64Add(($337|0),($338|0),($121|0),($122|0))|0);
 $340 = tempRet0;
 $341 = (_i64Add(($63|0),($64|0),($99|0),($100|0))|0);
 $342 = tempRet0;
 $343 = (_i64Add(($153|0),($154|0),($175|0),($176|0))|0);
 $344 = tempRet0;
 $345 = (_i64Add(($343|0),($344|0),($129|0),($130|0))|0);
 $346 = tempRet0;
 $347 = (_i64Add(($345|0),($346|0),($107|0),($108|0))|0);
 $348 = tempRet0;
 $349 = (_i64Add(($347|0),($348|0),($75|0),($76|0))|0);
 $350 = tempRet0;
 $351 = (_i64Add(($349|0),($350|0),($313|0),($314|0))|0);
 $352 = tempRet0;
 $353 = (_i64Add(($351|0),($352|0),($289|0),($290|0))|0);
 $354 = tempRet0;
 $355 = (_i64Add(($353|0),($354|0),($267|0),($268|0))|0);
 $356 = tempRet0;
 $357 = (_i64Add(($355|0),($356|0),($243|0),($244|0))|0);
 $358 = tempRet0;
 $359 = (_i64Add(($357|0),($358|0),($221|0),($222|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($339|0),($340|0),33554432,0)|0);
 $362 = tempRet0;
 $363 = (_bitshift64Ashr(($361|0),($362|0),26)|0);
 $364 = tempRet0;
 $365 = (_i64Add(($341|0),($342|0),($307|0),($308|0))|0);
 $366 = tempRet0;
 $367 = (_i64Add(($365|0),($366|0),($283|0),($284|0))|0);
 $368 = tempRet0;
 $369 = (_i64Add(($367|0),($368|0),($261|0),($262|0))|0);
 $370 = tempRet0;
 $371 = (_i64Add(($369|0),($370|0),($237|0),($238|0))|0);
 $372 = tempRet0;
 $373 = (_i64Add(($371|0),($372|0),($215|0),($216|0))|0);
 $374 = tempRet0;
 $375 = (_i64Add(($373|0),($374|0),($191|0),($192|0))|0);
 $376 = tempRet0;
 $377 = (_i64Add(($375|0),($376|0),($169|0),($170|0))|0);
 $378 = tempRet0;
 $379 = (_i64Add(($377|0),($378|0),($145|0),($146|0))|0);
 $380 = tempRet0;
 $381 = (_i64Add(($379|0),($380|0),($363|0),($364|0))|0);
 $382 = tempRet0;
 $383 = (_bitshift64Shl(($363|0),($364|0),26)|0);
 $384 = tempRet0;
 $385 = (_i64Subtract(($339|0),($340|0),($383|0),($384|0))|0);
 $386 = tempRet0;
 $387 = (_i64Add(($359|0),($360|0),33554432,0)|0);
 $388 = tempRet0;
 $389 = (_bitshift64Ashr(($387|0),($388|0),26)|0);
 $390 = tempRet0;
 $391 = (_i64Add(($177|0),($178|0),($199|0),($200|0))|0);
 $392 = tempRet0;
 $393 = (_i64Add(($391|0),($392|0),($155|0),($156|0))|0);
 $394 = tempRet0;
 $395 = (_i64Add(($393|0),($394|0),($131|0),($132|0))|0);
 $396 = tempRet0;
 $397 = (_i64Add(($395|0),($396|0),($109|0),($110|0))|0);
 $398 = tempRet0;
 $399 = (_i64Add(($397|0),($398|0),($79|0),($80|0))|0);
 $400 = tempRet0;
 $401 = (_i64Add(($399|0),($400|0),($315|0),($316|0))|0);
 $402 = tempRet0;
 $403 = (_i64Add(($401|0),($402|0),($291|0),($292|0))|0);
 $404 = tempRet0;
 $405 = (_i64Add(($403|0),($404|0),($269|0),($270|0))|0);
 $406 = tempRet0;
 $407 = (_i64Add(($405|0),($406|0),($245|0),($246|0))|0);
 $408 = tempRet0;
 $409 = (_i64Add(($407|0),($408|0),($389|0),($390|0))|0);
 $410 = tempRet0;
 $411 = (_bitshift64Shl(($389|0),($390|0),26)|0);
 $412 = tempRet0;
 $413 = (_i64Subtract(($359|0),($360|0),($411|0),($412|0))|0);
 $414 = tempRet0;
 $415 = (_i64Add(($381|0),($382|0),16777216,0)|0);
 $416 = tempRet0;
 $417 = (_bitshift64Ashr(($415|0),($416|0),25)|0);
 $418 = tempRet0;
 $419 = (_i64Add(($103|0),($104|0),($125|0),($126|0))|0);
 $420 = tempRet0;
 $421 = (_i64Add(($419|0),($420|0),($67|0),($68|0))|0);
 $422 = tempRet0;
 $423 = (_i64Add(($421|0),($422|0),($309|0),($310|0))|0);
 $424 = tempRet0;
 $425 = (_i64Add(($423|0),($424|0),($285|0),($286|0))|0);
 $426 = tempRet0;
 $427 = (_i64Add(($425|0),($426|0),($263|0),($264|0))|0);
 $428 = tempRet0;
 $429 = (_i64Add(($427|0),($428|0),($239|0),($240|0))|0);
 $430 = tempRet0;
 $431 = (_i64Add(($429|0),($430|0),($217|0),($218|0))|0);
 $432 = tempRet0;
 $433 = (_i64Add(($431|0),($432|0),($193|0),($194|0))|0);
 $434 = tempRet0;
 $435 = (_i64Add(($433|0),($434|0),($171|0),($172|0))|0);
 $436 = tempRet0;
 $437 = (_i64Add(($435|0),($436|0),($417|0),($418|0))|0);
 $438 = tempRet0;
 $439 = (_bitshift64Shl(($417|0),($418|0),25)|0);
 $440 = tempRet0;
 $441 = (_i64Subtract(($381|0),($382|0),($439|0),($440|0))|0);
 $442 = tempRet0;
 $443 = (_i64Add(($409|0),($410|0),16777216,0)|0);
 $444 = tempRet0;
 $445 = (_bitshift64Ashr(($443|0),($444|0),25)|0);
 $446 = tempRet0;
 $447 = (_i64Add(($203|0),($204|0),($225|0),($226|0))|0);
 $448 = tempRet0;
 $449 = (_i64Add(($447|0),($448|0),($179|0),($180|0))|0);
 $450 = tempRet0;
 $451 = (_i64Add(($449|0),($450|0),($157|0),($158|0))|0);
 $452 = tempRet0;
 $453 = (_i64Add(($451|0),($452|0),($133|0),($134|0))|0);
 $454 = tempRet0;
 $455 = (_i64Add(($453|0),($454|0),($111|0),($112|0))|0);
 $456 = tempRet0;
 $457 = (_i64Add(($455|0),($456|0),($83|0),($84|0))|0);
 $458 = tempRet0;
 $459 = (_i64Add(($457|0),($458|0),($317|0),($318|0))|0);
 $460 = tempRet0;
 $461 = (_i64Add(($459|0),($460|0),($293|0),($294|0))|0);
 $462 = tempRet0;
 $463 = (_i64Add(($461|0),($462|0),($271|0),($272|0))|0);
 $464 = tempRet0;
 $465 = (_i64Add(($463|0),($464|0),($445|0),($446|0))|0);
 $466 = tempRet0;
 $467 = (_bitshift64Shl(($445|0),($446|0),25)|0);
 $468 = tempRet0;
 $469 = (_i64Subtract(($409|0),($410|0),($467|0),($468|0))|0);
 $470 = tempRet0;
 $471 = (_i64Add(($437|0),($438|0),33554432,0)|0);
 $472 = tempRet0;
 $473 = (_bitshift64Ashr(($471|0),($472|0),26)|0);
 $474 = tempRet0;
 $475 = (_i64Add(($127|0),($128|0),($149|0),($150|0))|0);
 $476 = tempRet0;
 $477 = (_i64Add(($475|0),($476|0),($105|0),($106|0))|0);
 $478 = tempRet0;
 $479 = (_i64Add(($477|0),($478|0),($71|0),($72|0))|0);
 $480 = tempRet0;
 $481 = (_i64Add(($479|0),($480|0),($311|0),($312|0))|0);
 $482 = tempRet0;
 $483 = (_i64Add(($481|0),($482|0),($287|0),($288|0))|0);
 $484 = tempRet0;
 $485 = (_i64Add(($483|0),($484|0),($265|0),($266|0))|0);
 $486 = tempRet0;
 $487 = (_i64Add(($485|0),($486|0),($241|0),($242|0))|0);
 $488 = tempRet0;
 $489 = (_i64Add(($487|0),($488|0),($219|0),($220|0))|0);
 $490 = tempRet0;
 $491 = (_i64Add(($489|0),($490|0),($195|0),($196|0))|0);
 $492 = tempRet0;
 $493 = (_i64Add(($491|0),($492|0),($473|0),($474|0))|0);
 $494 = tempRet0;
 $495 = (_bitshift64Shl(($473|0),($474|0),26)|0);
 $496 = tempRet0;
 $497 = (_i64Subtract(($437|0),($438|0),($495|0),($496|0))|0);
 $498 = tempRet0;
 $499 = (_i64Add(($465|0),($466|0),33554432,0)|0);
 $500 = tempRet0;
 $501 = (_bitshift64Ashr(($499|0),($500|0),26)|0);
 $502 = tempRet0;
 $503 = (_i64Add(($227|0),($228|0),($249|0),($250|0))|0);
 $504 = tempRet0;
 $505 = (_i64Add(($503|0),($504|0),($205|0),($206|0))|0);
 $506 = tempRet0;
 $507 = (_i64Add(($505|0),($506|0),($181|0),($182|0))|0);
 $508 = tempRet0;
 $509 = (_i64Add(($507|0),($508|0),($159|0),($160|0))|0);
 $510 = tempRet0;
 $511 = (_i64Add(($509|0),($510|0),($135|0),($136|0))|0);
 $512 = tempRet0;
 $513 = (_i64Add(($511|0),($512|0),($113|0),($114|0))|0);
 $514 = tempRet0;
 $515 = (_i64Add(($513|0),($514|0),($87|0),($88|0))|0);
 $516 = tempRet0;
 $517 = (_i64Add(($515|0),($516|0),($319|0),($320|0))|0);
 $518 = tempRet0;
 $519 = (_i64Add(($517|0),($518|0),($295|0),($296|0))|0);
 $520 = tempRet0;
 $521 = (_i64Add(($519|0),($520|0),($501|0),($502|0))|0);
 $522 = tempRet0;
 $523 = (_bitshift64Shl(($501|0),($502|0),26)|0);
 $524 = tempRet0;
 $525 = (_i64Subtract(($465|0),($466|0),($523|0),($524|0))|0);
 $526 = tempRet0;
 $527 = (_i64Add(($493|0),($494|0),16777216,0)|0);
 $528 = tempRet0;
 $529 = (_bitshift64Ashr(($527|0),($528|0),25)|0);
 $530 = tempRet0;
 $531 = (_i64Add(($529|0),($530|0),($413|0),($414|0))|0);
 $532 = tempRet0;
 $533 = (_bitshift64Shl(($529|0),($530|0),25)|0);
 $534 = tempRet0;
 $535 = (_i64Subtract(($493|0),($494|0),($533|0),($534|0))|0);
 $536 = tempRet0;
 $537 = (_i64Add(($521|0),($522|0),16777216,0)|0);
 $538 = tempRet0;
 $539 = (_bitshift64Ashr(($537|0),($538|0),25)|0);
 $540 = tempRet0;
 $541 = (_i64Add(($253|0),($254|0),($275|0),($276|0))|0);
 $542 = tempRet0;
 $543 = (_i64Add(($541|0),($542|0),($229|0),($230|0))|0);
 $544 = tempRet0;
 $545 = (_i64Add(($543|0),($544|0),($207|0),($208|0))|0);
 $546 = tempRet0;
 $547 = (_i64Add(($545|0),($546|0),($183|0),($184|0))|0);
 $548 = tempRet0;
 $549 = (_i64Add(($547|0),($548|0),($161|0),($162|0))|0);
 $550 = tempRet0;
 $551 = (_i64Add(($549|0),($550|0),($137|0),($138|0))|0);
 $552 = tempRet0;
 $553 = (_i64Add(($551|0),($552|0),($115|0),($116|0))|0);
 $554 = tempRet0;
 $555 = (_i64Add(($553|0),($554|0),($91|0),($92|0))|0);
 $556 = tempRet0;
 $557 = (_i64Add(($555|0),($556|0),($321|0),($322|0))|0);
 $558 = tempRet0;
 $559 = (_i64Add(($557|0),($558|0),($539|0),($540|0))|0);
 $560 = tempRet0;
 $561 = (_bitshift64Shl(($539|0),($540|0),25)|0);
 $562 = tempRet0;
 $563 = (_i64Subtract(($521|0),($522|0),($561|0),($562|0))|0);
 $564 = tempRet0;
 $565 = (_i64Add(($531|0),($532|0),33554432,0)|0);
 $566 = tempRet0;
 $567 = (_bitshift64Ashr(($565|0),($566|0),26)|0);
 $568 = tempRet0;
 $569 = (_i64Add(($469|0),($470|0),($567|0),($568|0))|0);
 $570 = tempRet0;
 $571 = (_bitshift64Shl(($567|0),($568|0),26)|0);
 $572 = tempRet0;
 $573 = (_i64Subtract(($531|0),($532|0),($571|0),($572|0))|0);
 $574 = tempRet0;
 $575 = (_i64Add(($559|0),($560|0),33554432,0)|0);
 $576 = tempRet0;
 $577 = (_bitshift64Ashr(($575|0),($576|0),26)|0);
 $578 = tempRet0;
 $579 = (_i64Add(($277|0),($278|0),($299|0),($300|0))|0);
 $580 = tempRet0;
 $581 = (_i64Add(($579|0),($580|0),($255|0),($256|0))|0);
 $582 = tempRet0;
 $583 = (_i64Add(($581|0),($582|0),($231|0),($232|0))|0);
 $584 = tempRet0;
 $585 = (_i64Add(($583|0),($584|0),($209|0),($210|0))|0);
 $586 = tempRet0;
 $587 = (_i64Add(($585|0),($586|0),($185|0),($186|0))|0);
 $588 = tempRet0;
 $589 = (_i64Add(($587|0),($588|0),($163|0),($164|0))|0);
 $590 = tempRet0;
 $591 = (_i64Add(($589|0),($590|0),($139|0),($140|0))|0);
 $592 = tempRet0;
 $593 = (_i64Add(($591|0),($592|0),($117|0),($118|0))|0);
 $594 = tempRet0;
 $595 = (_i64Add(($593|0),($594|0),($95|0),($96|0))|0);
 $596 = tempRet0;
 $597 = (_i64Add(($595|0),($596|0),($577|0),($578|0))|0);
 $598 = tempRet0;
 $599 = (_bitshift64Shl(($577|0),($578|0),26)|0);
 $600 = tempRet0;
 $601 = (_i64Subtract(($559|0),($560|0),($599|0),($600|0))|0);
 $602 = tempRet0;
 $603 = (_i64Add(($597|0),($598|0),16777216,0)|0);
 $604 = tempRet0;
 $605 = (_bitshift64Ashr(($603|0),($604|0),25)|0);
 $606 = tempRet0;
 $607 = (___muldi3(($605|0),($606|0),19,0)|0);
 $608 = tempRet0;
 $609 = (_i64Add(($607|0),($608|0),($385|0),($386|0))|0);
 $610 = tempRet0;
 $611 = (_bitshift64Shl(($605|0),($606|0),25)|0);
 $612 = tempRet0;
 $613 = (_i64Subtract(($597|0),($598|0),($611|0),($612|0))|0);
 $614 = tempRet0;
 $615 = (_i64Add(($609|0),($610|0),33554432,0)|0);
 $616 = tempRet0;
 $617 = (_bitshift64Ashr(($615|0),($616|0),26)|0);
 $618 = tempRet0;
 $619 = (_i64Add(($441|0),($442|0),($617|0),($618|0))|0);
 $620 = tempRet0;
 $621 = (_bitshift64Shl(($617|0),($618|0),26)|0);
 $622 = tempRet0;
 $623 = (_i64Subtract(($609|0),($610|0),($621|0),($622|0))|0);
 $624 = tempRet0;
 HEAP32[$0>>2] = $623;
 $625 = ((($0)) + 4|0);
 HEAP32[$625>>2] = $619;
 $626 = ((($0)) + 8|0);
 HEAP32[$626>>2] = $497;
 $627 = ((($0)) + 12|0);
 HEAP32[$627>>2] = $535;
 $628 = ((($0)) + 16|0);
 HEAP32[$628>>2] = $573;
 $629 = ((($0)) + 20|0);
 HEAP32[$629>>2] = $569;
 $630 = ((($0)) + 24|0);
 HEAP32[$630>>2] = $525;
 $631 = ((($0)) + 28|0);
 HEAP32[$631>>2] = $563;
 $632 = ((($0)) + 32|0);
 HEAP32[$632>>2] = $601;
 $633 = ((($0)) + 36|0);
 HEAP32[$633>>2] = $613;
 return;
}
function _crypto_sign_ed25519_ref10_fe_neg($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (0 - ($2))|0;
 $22 = (0 - ($4))|0;
 $23 = (0 - ($6))|0;
 $24 = (0 - ($8))|0;
 $25 = (0 - ($10))|0;
 $26 = (0 - ($12))|0;
 $27 = (0 - ($14))|0;
 $28 = (0 - ($16))|0;
 $29 = (0 - ($18))|0;
 $30 = (0 - ($20))|0;
 HEAP32[$0>>2] = $21;
 $31 = ((($0)) + 4|0);
 HEAP32[$31>>2] = $22;
 $32 = ((($0)) + 8|0);
 HEAP32[$32>>2] = $23;
 $33 = ((($0)) + 12|0);
 HEAP32[$33>>2] = $24;
 $34 = ((($0)) + 16|0);
 HEAP32[$34>>2] = $25;
 $35 = ((($0)) + 20|0);
 HEAP32[$35>>2] = $26;
 $36 = ((($0)) + 24|0);
 HEAP32[$36>>2] = $27;
 $37 = ((($0)) + 28|0);
 HEAP32[$37>>2] = $28;
 $38 = ((($0)) + 32|0);
 HEAP32[$38>>2] = $29;
 $39 = ((($0)) + 36|0);
 HEAP32[$39>>2] = $30;
 return;
}
function _crypto_sign_ed25519_ref10_fe_pow22523($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$729 = 0, $$828 = 0, $$927 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $exitcond = 0, $exitcond35 = 0, $exitcond36 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($2,$1);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$2,$3);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 $$729 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($3,$3);
  $5 = (($$729) + 1)|0;
  $exitcond36 = ($5|0)==(50);
  if ($exitcond36) {
   break;
  } else {
   $$729 = $5;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 $$828 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($4,$4);
  $6 = (($$828) + 1)|0;
  $exitcond35 = ($6|0)==(100);
  if ($exitcond35) {
   break;
  } else {
   $$828 = $6;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 $$927 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($3,$3);
  $7 = (($$927) + 1)|0;
  $exitcond = ($7|0)==(50);
  if ($exitcond) {
   break;
  } else {
   $$927 = $7;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_mul($0,$2,$1);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_fe_sq($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0;
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($54|0),($55|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($206|0),($207|0),($178|0),($179|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($174|0),($175|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($166|0),($167|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($198|0),($199|0),33554432,0)|0);
 $215 = tempRet0;
 $216 = (_bitshift64Ashr(($214|0),($215|0),26)|0);
 $217 = tempRet0;
 $218 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($150|0),($151|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($136|0),($137|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($122|0),($123|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($224|0),($225|0),($216|0),($217|0))|0);
 $227 = tempRet0;
 $228 = (_bitshift64Shl(($216|0),($217|0),26)|0);
 $229 = tempRet0;
 $230 = (_i64Subtract(($198|0),($199|0),($228|0),($229|0))|0);
 $231 = tempRet0;
 $232 = (_i64Add(($212|0),($213|0),33554432,0)|0);
 $233 = tempRet0;
 $234 = (_bitshift64Ashr(($232|0),($233|0),26)|0);
 $235 = tempRet0;
 $236 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $237 = tempRet0;
 $238 = (_i64Add(($236|0),($237|0),($58|0),($59|0))|0);
 $239 = tempRet0;
 $240 = (_i64Add(($238|0),($239|0),($180|0),($181|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($176|0),($177|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($242|0),($243|0),($234|0),($235|0))|0);
 $245 = tempRet0;
 $246 = (_bitshift64Shl(($234|0),($235|0),26)|0);
 $247 = tempRet0;
 $248 = (_i64Subtract(($212|0),($213|0),($246|0),($247|0))|0);
 $249 = tempRet0;
 $250 = (_i64Add(($226|0),($227|0),16777216,0)|0);
 $251 = tempRet0;
 $252 = (_bitshift64Ashr(($250|0),($251|0),25)|0);
 $253 = tempRet0;
 $254 = (_i64Add(($200|0),($201|0),($168|0),($169|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($162|0),($163|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($152|0),($153|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($138|0),($139|0))|0);
 $261 = tempRet0;
 $262 = (_i64Add(($260|0),($261|0),($252|0),($253|0))|0);
 $263 = tempRet0;
 $264 = (_bitshift64Shl(($252|0),($253|0),25)|0);
 $265 = tempRet0;
 $266 = (_i64Subtract(($226|0),($227|0),($264|0),($265|0))|0);
 $267 = tempRet0;
 $268 = (_i64Add(($244|0),($245|0),16777216,0)|0);
 $269 = tempRet0;
 $270 = (_bitshift64Ashr(($268|0),($269|0),25)|0);
 $271 = tempRet0;
 $272 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($90|0),($91|0))|0);
 $275 = tempRet0;
 $276 = (_i64Add(($274|0),($275|0),($62|0),($63|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($184|0),($185|0))|0);
 $279 = tempRet0;
 $280 = (_i64Add(($278|0),($279|0),($182|0),($183|0))|0);
 $281 = tempRet0;
 $282 = (_i64Add(($280|0),($281|0),($270|0),($271|0))|0);
 $283 = tempRet0;
 $284 = (_bitshift64Shl(($270|0),($271|0),25)|0);
 $285 = tempRet0;
 $286 = (_i64Subtract(($244|0),($245|0),($284|0),($285|0))|0);
 $287 = tempRet0;
 $288 = (_i64Add(($262|0),($263|0),33554432,0)|0);
 $289 = tempRet0;
 $290 = (_bitshift64Ashr(($288|0),($289|0),26)|0);
 $291 = tempRet0;
 $292 = (_i64Add(($202|0),($203|0),($170|0),($171|0))|0);
 $293 = tempRet0;
 $294 = (_i64Add(($292|0),($293|0),($164|0),($165|0))|0);
 $295 = tempRet0;
 $296 = (_i64Add(($294|0),($295|0),($154|0),($155|0))|0);
 $297 = tempRet0;
 $298 = (_i64Add(($296|0),($297|0),($290|0),($291|0))|0);
 $299 = tempRet0;
 $300 = (_bitshift64Shl(($290|0),($291|0),26)|0);
 $301 = tempRet0;
 $302 = (_i64Subtract(($262|0),($263|0),($300|0),($301|0))|0);
 $303 = tempRet0;
 $304 = (_i64Add(($282|0),($283|0),33554432,0)|0);
 $305 = tempRet0;
 $306 = (_bitshift64Ashr(($304|0),($305|0),26)|0);
 $307 = tempRet0;
 $308 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $309 = tempRet0;
 $310 = (_i64Add(($308|0),($309|0),($92|0),($93|0))|0);
 $311 = tempRet0;
 $312 = (_i64Add(($310|0),($311|0),($66|0),($67|0))|0);
 $313 = tempRet0;
 $314 = (_i64Add(($312|0),($313|0),($186|0),($187|0))|0);
 $315 = tempRet0;
 $316 = (_i64Add(($314|0),($315|0),($306|0),($307|0))|0);
 $317 = tempRet0;
 $318 = (_bitshift64Shl(($306|0),($307|0),26)|0);
 $319 = tempRet0;
 $320 = (_i64Subtract(($282|0),($283|0),($318|0),($319|0))|0);
 $321 = tempRet0;
 $322 = (_i64Add(($298|0),($299|0),16777216,0)|0);
 $323 = tempRet0;
 $324 = (_bitshift64Ashr(($322|0),($323|0),25)|0);
 $325 = tempRet0;
 $326 = (_i64Add(($324|0),($325|0),($248|0),($249|0))|0);
 $327 = tempRet0;
 $328 = (_bitshift64Shl(($324|0),($325|0),25)|0);
 $329 = tempRet0;
 $330 = (_i64Subtract(($298|0),($299|0),($328|0),($329|0))|0);
 $331 = tempRet0;
 $332 = (_i64Add(($316|0),($317|0),16777216,0)|0);
 $333 = tempRet0;
 $334 = (_bitshift64Ashr(($332|0),($333|0),25)|0);
 $335 = tempRet0;
 $336 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $337 = tempRet0;
 $338 = (_i64Add(($336|0),($337|0),($128|0),($129|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($338|0),($339|0),($96|0),($97|0))|0);
 $341 = tempRet0;
 $342 = (_i64Add(($340|0),($341|0),($70|0),($71|0))|0);
 $343 = tempRet0;
 $344 = (_i64Add(($342|0),($343|0),($188|0),($189|0))|0);
 $345 = tempRet0;
 $346 = (_i64Add(($344|0),($345|0),($334|0),($335|0))|0);
 $347 = tempRet0;
 $348 = (_bitshift64Shl(($334|0),($335|0),25)|0);
 $349 = tempRet0;
 $350 = (_i64Subtract(($316|0),($317|0),($348|0),($349|0))|0);
 $351 = tempRet0;
 $352 = (_i64Add(($326|0),($327|0),33554432,0)|0);
 $353 = tempRet0;
 $354 = (_bitshift64Ashr(($352|0),($353|0),26)|0);
 $355 = tempRet0;
 $356 = (_i64Add(($286|0),($287|0),($354|0),($355|0))|0);
 $357 = tempRet0;
 $358 = (_bitshift64Shl(($354|0),($355|0),26)|0);
 $359 = tempRet0;
 $360 = (_i64Subtract(($326|0),($327|0),($358|0),($359|0))|0);
 $361 = tempRet0;
 $362 = (_i64Add(($346|0),($347|0),33554432,0)|0);
 $363 = tempRet0;
 $364 = (_bitshift64Ashr(($362|0),($363|0),26)|0);
 $365 = tempRet0;
 $366 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $367 = tempRet0;
 $368 = (_i64Add(($366|0),($367|0),($116|0),($117|0))|0);
 $369 = tempRet0;
 $370 = (_i64Add(($368|0),($369|0),($98|0),($99|0))|0);
 $371 = tempRet0;
 $372 = (_i64Add(($370|0),($371|0),($74|0),($75|0))|0);
 $373 = tempRet0;
 $374 = (_i64Add(($372|0),($373|0),($364|0),($365|0))|0);
 $375 = tempRet0;
 $376 = (_bitshift64Shl(($364|0),($365|0),26)|0);
 $377 = tempRet0;
 $378 = (_i64Subtract(($346|0),($347|0),($376|0),($377|0))|0);
 $379 = tempRet0;
 $380 = (_i64Add(($374|0),($375|0),16777216,0)|0);
 $381 = tempRet0;
 $382 = (_bitshift64Ashr(($380|0),($381|0),25)|0);
 $383 = tempRet0;
 $384 = (___muldi3(($382|0),($383|0),19,0)|0);
 $385 = tempRet0;
 $386 = (_i64Add(($384|0),($385|0),($230|0),($231|0))|0);
 $387 = tempRet0;
 $388 = (_bitshift64Shl(($382|0),($383|0),25)|0);
 $389 = tempRet0;
 $390 = (_i64Subtract(($374|0),($375|0),($388|0),($389|0))|0);
 $391 = tempRet0;
 $392 = (_i64Add(($386|0),($387|0),33554432,0)|0);
 $393 = tempRet0;
 $394 = (_bitshift64Ashr(($392|0),($393|0),26)|0);
 $395 = tempRet0;
 $396 = (_i64Add(($266|0),($267|0),($394|0),($395|0))|0);
 $397 = tempRet0;
 $398 = (_bitshift64Shl(($394|0),($395|0),26)|0);
 $399 = tempRet0;
 $400 = (_i64Subtract(($386|0),($387|0),($398|0),($399|0))|0);
 $401 = tempRet0;
 HEAP32[$0>>2] = $400;
 $402 = ((($0)) + 4|0);
 HEAP32[$402>>2] = $396;
 $403 = ((($0)) + 8|0);
 HEAP32[$403>>2] = $302;
 $404 = ((($0)) + 12|0);
 HEAP32[$404>>2] = $330;
 $405 = ((($0)) + 16|0);
 HEAP32[$405>>2] = $360;
 $406 = ((($0)) + 20|0);
 HEAP32[$406>>2] = $356;
 $407 = ((($0)) + 24|0);
 HEAP32[$407>>2] = $320;
 $408 = ((($0)) + 28|0);
 HEAP32[$408>>2] = $350;
 $409 = ((($0)) + 32|0);
 HEAP32[$409>>2] = $378;
 $410 = ((($0)) + 36|0);
 HEAP32[$410>>2] = $390;
 return;
}
function _crypto_sign_ed25519_ref10_fe_sq2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0;
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($200|0),($201|0),($150|0),($151|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($202|0),($203|0),($136|0),($137|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($122|0),($123|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($168|0),($169|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($162|0),($163|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($212|0),($213|0),($152|0),($153|0))|0);
 $215 = tempRet0;
 $216 = (_i64Add(($214|0),($215|0),($138|0),($139|0))|0);
 $217 = tempRet0;
 $218 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($170|0),($171|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($164|0),($165|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($154|0),($155|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $227 = tempRet0;
 $228 = (_i64Add(($226|0),($227|0),($54|0),($55|0))|0);
 $229 = tempRet0;
 $230 = (_i64Add(($228|0),($229|0),($178|0),($179|0))|0);
 $231 = tempRet0;
 $232 = (_i64Add(($230|0),($231|0),($174|0),($175|0))|0);
 $233 = tempRet0;
 $234 = (_i64Add(($232|0),($233|0),($166|0),($167|0))|0);
 $235 = tempRet0;
 $236 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $237 = tempRet0;
 $238 = (_i64Add(($236|0),($237|0),($58|0),($59|0))|0);
 $239 = tempRet0;
 $240 = (_i64Add(($238|0),($239|0),($180|0),($181|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($176|0),($177|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $245 = tempRet0;
 $246 = (_i64Add(($244|0),($245|0),($90|0),($91|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($246|0),($247|0),($62|0),($63|0))|0);
 $249 = tempRet0;
 $250 = (_i64Add(($248|0),($249|0),($184|0),($185|0))|0);
 $251 = tempRet0;
 $252 = (_i64Add(($250|0),($251|0),($182|0),($183|0))|0);
 $253 = tempRet0;
 $254 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($92|0),($93|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($66|0),($67|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($186|0),($187|0))|0);
 $261 = tempRet0;
 $262 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $263 = tempRet0;
 $264 = (_i64Add(($262|0),($263|0),($128|0),($129|0))|0);
 $265 = tempRet0;
 $266 = (_i64Add(($264|0),($265|0),($96|0),($97|0))|0);
 $267 = tempRet0;
 $268 = (_i64Add(($266|0),($267|0),($70|0),($71|0))|0);
 $269 = tempRet0;
 $270 = (_i64Add(($268|0),($269|0),($188|0),($189|0))|0);
 $271 = tempRet0;
 $272 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($116|0),($117|0))|0);
 $275 = tempRet0;
 $276 = (_i64Add(($274|0),($275|0),($98|0),($99|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($74|0),($75|0))|0);
 $279 = tempRet0;
 $280 = (_bitshift64Shl(($198|0),($199|0),1)|0);
 $281 = tempRet0;
 $282 = (_bitshift64Shl(($206|0),($207|0),1)|0);
 $283 = tempRet0;
 $284 = (_bitshift64Shl(($216|0),($217|0),1)|0);
 $285 = tempRet0;
 $286 = (_bitshift64Shl(($224|0),($225|0),1)|0);
 $287 = tempRet0;
 $288 = (_bitshift64Shl(($234|0),($235|0),1)|0);
 $289 = tempRet0;
 $290 = (_bitshift64Shl(($242|0),($243|0),1)|0);
 $291 = tempRet0;
 $292 = (_bitshift64Shl(($252|0),($253|0),1)|0);
 $293 = tempRet0;
 $294 = (_bitshift64Shl(($260|0),($261|0),1)|0);
 $295 = tempRet0;
 $296 = (_bitshift64Shl(($270|0),($271|0),1)|0);
 $297 = tempRet0;
 $298 = (_bitshift64Shl(($278|0),($279|0),1)|0);
 $299 = tempRet0;
 $300 = (_i64Add(($280|0),($281|0),33554432,0)|0);
 $301 = tempRet0;
 $302 = (_bitshift64Ashr(($300|0),($301|0),26)|0);
 $303 = tempRet0;
 $304 = (_i64Add(($302|0),($303|0),($282|0),($283|0))|0);
 $305 = tempRet0;
 $306 = (_bitshift64Shl(($302|0),($303|0),26)|0);
 $307 = tempRet0;
 $308 = (_i64Subtract(($280|0),($281|0),($306|0),($307|0))|0);
 $309 = tempRet0;
 $310 = (_i64Add(($288|0),($289|0),33554432,0)|0);
 $311 = tempRet0;
 $312 = (_bitshift64Ashr(($310|0),($311|0),26)|0);
 $313 = tempRet0;
 $314 = (_i64Add(($312|0),($313|0),($290|0),($291|0))|0);
 $315 = tempRet0;
 $316 = (_bitshift64Shl(($312|0),($313|0),26)|0);
 $317 = tempRet0;
 $318 = (_i64Subtract(($288|0),($289|0),($316|0),($317|0))|0);
 $319 = tempRet0;
 $320 = (_i64Add(($304|0),($305|0),16777216,0)|0);
 $321 = tempRet0;
 $322 = (_bitshift64Ashr(($320|0),($321|0),25)|0);
 $323 = tempRet0;
 $324 = (_i64Add(($322|0),($323|0),($284|0),($285|0))|0);
 $325 = tempRet0;
 $326 = (_bitshift64Shl(($322|0),($323|0),25)|0);
 $327 = tempRet0;
 $328 = (_i64Subtract(($304|0),($305|0),($326|0),($327|0))|0);
 $329 = tempRet0;
 $330 = (_i64Add(($314|0),($315|0),16777216,0)|0);
 $331 = tempRet0;
 $332 = (_bitshift64Ashr(($330|0),($331|0),25)|0);
 $333 = tempRet0;
 $334 = (_i64Add(($332|0),($333|0),($292|0),($293|0))|0);
 $335 = tempRet0;
 $336 = (_bitshift64Shl(($332|0),($333|0),25)|0);
 $337 = tempRet0;
 $338 = (_i64Subtract(($314|0),($315|0),($336|0),($337|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($324|0),($325|0),33554432,0)|0);
 $341 = tempRet0;
 $342 = (_bitshift64Ashr(($340|0),($341|0),26)|0);
 $343 = tempRet0;
 $344 = (_i64Add(($342|0),($343|0),($286|0),($287|0))|0);
 $345 = tempRet0;
 $346 = (_bitshift64Shl(($342|0),($343|0),26)|0);
 $347 = tempRet0;
 $348 = (_i64Subtract(($324|0),($325|0),($346|0),($347|0))|0);
 $349 = tempRet0;
 $350 = (_i64Add(($334|0),($335|0),33554432,0)|0);
 $351 = tempRet0;
 $352 = (_bitshift64Ashr(($350|0),($351|0),26)|0);
 $353 = tempRet0;
 $354 = (_i64Add(($352|0),($353|0),($294|0),($295|0))|0);
 $355 = tempRet0;
 $356 = (_bitshift64Shl(($352|0),($353|0),26)|0);
 $357 = tempRet0;
 $358 = (_i64Subtract(($334|0),($335|0),($356|0),($357|0))|0);
 $359 = tempRet0;
 $360 = (_i64Add(($344|0),($345|0),16777216,0)|0);
 $361 = tempRet0;
 $362 = (_bitshift64Ashr(($360|0),($361|0),25)|0);
 $363 = tempRet0;
 $364 = (_i64Add(($362|0),($363|0),($318|0),($319|0))|0);
 $365 = tempRet0;
 $366 = (_bitshift64Shl(($362|0),($363|0),25)|0);
 $367 = tempRet0;
 $368 = (_i64Subtract(($344|0),($345|0),($366|0),($367|0))|0);
 $369 = tempRet0;
 $370 = (_i64Add(($354|0),($355|0),16777216,0)|0);
 $371 = tempRet0;
 $372 = (_bitshift64Ashr(($370|0),($371|0),25)|0);
 $373 = tempRet0;
 $374 = (_i64Add(($372|0),($373|0),($296|0),($297|0))|0);
 $375 = tempRet0;
 $376 = (_bitshift64Shl(($372|0),($373|0),25)|0);
 $377 = tempRet0;
 $378 = (_i64Subtract(($354|0),($355|0),($376|0),($377|0))|0);
 $379 = tempRet0;
 $380 = (_i64Add(($364|0),($365|0),33554432,0)|0);
 $381 = tempRet0;
 $382 = (_bitshift64Ashr(($380|0),($381|0),26)|0);
 $383 = tempRet0;
 $384 = (_i64Add(($338|0),($339|0),($382|0),($383|0))|0);
 $385 = tempRet0;
 $386 = (_bitshift64Shl(($382|0),($383|0),26)|0);
 $387 = tempRet0;
 $388 = (_i64Subtract(($364|0),($365|0),($386|0),($387|0))|0);
 $389 = tempRet0;
 $390 = (_i64Add(($374|0),($375|0),33554432,0)|0);
 $391 = tempRet0;
 $392 = (_bitshift64Ashr(($390|0),($391|0),26)|0);
 $393 = tempRet0;
 $394 = (_i64Add(($392|0),($393|0),($298|0),($299|0))|0);
 $395 = tempRet0;
 $396 = (_bitshift64Shl(($392|0),($393|0),26)|0);
 $397 = tempRet0;
 $398 = (_i64Subtract(($374|0),($375|0),($396|0),($397|0))|0);
 $399 = tempRet0;
 $400 = (_i64Add(($394|0),($395|0),16777216,0)|0);
 $401 = tempRet0;
 $402 = (_bitshift64Ashr(($400|0),($401|0),25)|0);
 $403 = tempRet0;
 $404 = (___muldi3(($402|0),($403|0),19,0)|0);
 $405 = tempRet0;
 $406 = (_i64Add(($404|0),($405|0),($308|0),($309|0))|0);
 $407 = tempRet0;
 $408 = (_bitshift64Shl(($402|0),($403|0),25)|0);
 $409 = tempRet0;
 $410 = (_i64Subtract(($394|0),($395|0),($408|0),($409|0))|0);
 $411 = tempRet0;
 $412 = (_i64Add(($406|0),($407|0),33554432,0)|0);
 $413 = tempRet0;
 $414 = (_bitshift64Ashr(($412|0),($413|0),26)|0);
 $415 = tempRet0;
 $416 = (_i64Add(($328|0),($329|0),($414|0),($415|0))|0);
 $417 = tempRet0;
 $418 = (_bitshift64Shl(($414|0),($415|0),26)|0);
 $419 = tempRet0;
 $420 = (_i64Subtract(($406|0),($407|0),($418|0),($419|0))|0);
 $421 = tempRet0;
 HEAP32[$0>>2] = $420;
 $422 = ((($0)) + 4|0);
 HEAP32[$422>>2] = $416;
 $423 = ((($0)) + 8|0);
 HEAP32[$423>>2] = $348;
 $424 = ((($0)) + 12|0);
 HEAP32[$424>>2] = $368;
 $425 = ((($0)) + 16|0);
 HEAP32[$425>>2] = $388;
 $426 = ((($0)) + 20|0);
 HEAP32[$426>>2] = $384;
 $427 = ((($0)) + 24|0);
 HEAP32[$427>>2] = $358;
 $428 = ((($0)) + 28|0);
 HEAP32[$428>>2] = $378;
 $429 = ((($0)) + 32|0);
 HEAP32[$429>>2] = $398;
 $430 = ((($0)) + 36|0);
 HEAP32[$430>>2] = $410;
 return;
}
function _crypto_sign_ed25519_ref10_fe_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($3) - ($22))|0;
 $42 = (($5) - ($24))|0;
 $43 = (($7) - ($26))|0;
 $44 = (($9) - ($28))|0;
 $45 = (($11) - ($30))|0;
 $46 = (($13) - ($32))|0;
 $47 = (($15) - ($34))|0;
 $48 = (($17) - ($36))|0;
 $49 = (($19) - ($38))|0;
 $50 = (($21) - ($40))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _crypto_sign_ed25519_ref10_fe_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20*19)|0;
 $22 = (($21) + 16777216)|0;
 $23 = $22 >> 25;
 $24 = (($23) + ($2))|0;
 $25 = $24 >> 26;
 $26 = (($25) + ($4))|0;
 $27 = $26 >> 25;
 $28 = (($27) + ($6))|0;
 $29 = $28 >> 26;
 $30 = (($29) + ($8))|0;
 $31 = $30 >> 25;
 $32 = (($31) + ($10))|0;
 $33 = $32 >> 26;
 $34 = (($33) + ($12))|0;
 $35 = $34 >> 25;
 $36 = (($35) + ($14))|0;
 $37 = $36 >> 26;
 $38 = (($37) + ($16))|0;
 $39 = $38 >> 25;
 $40 = (($39) + ($18))|0;
 $41 = $40 >> 26;
 $42 = (($41) + ($20))|0;
 $43 = $42 >> 25;
 $44 = ($43*19)|0;
 $45 = (($44) + ($2))|0;
 $46 = $45 >> 26;
 $47 = (($46) + ($4))|0;
 $48 = $46 << 26;
 $49 = (($45) - ($48))|0;
 $50 = $47 >> 25;
 $51 = (($50) + ($6))|0;
 $52 = $50 << 25;
 $53 = (($47) - ($52))|0;
 $54 = $51 >> 26;
 $55 = (($54) + ($8))|0;
 $56 = $54 << 26;
 $57 = (($51) - ($56))|0;
 $58 = $55 >> 25;
 $59 = (($58) + ($10))|0;
 $60 = $58 << 25;
 $61 = (($55) - ($60))|0;
 $62 = $59 >> 26;
 $63 = (($62) + ($12))|0;
 $64 = $62 << 26;
 $65 = (($59) - ($64))|0;
 $66 = $63 >> 25;
 $67 = (($66) + ($14))|0;
 $68 = $66 << 25;
 $69 = (($63) - ($68))|0;
 $70 = $67 >> 26;
 $71 = (($70) + ($16))|0;
 $72 = $70 << 26;
 $73 = (($67) - ($72))|0;
 $74 = $71 >> 25;
 $75 = (($74) + ($18))|0;
 $76 = $74 << 25;
 $77 = (($71) - ($76))|0;
 $78 = $75 >> 26;
 $79 = (($78) + ($20))|0;
 $80 = $78 << 26;
 $81 = (($75) - ($80))|0;
 $82 = $79 & 33554431;
 $83 = $49&255;
 HEAP8[$0>>0] = $83;
 $84 = $49 >>> 8;
 $85 = $84&255;
 $86 = ((($0)) + 1|0);
 HEAP8[$86>>0] = $85;
 $87 = $49 >>> 16;
 $88 = $87&255;
 $89 = ((($0)) + 2|0);
 HEAP8[$89>>0] = $88;
 $90 = $49 >>> 24;
 $91 = $53 << 2;
 $92 = $91 | $90;
 $93 = $92&255;
 $94 = ((($0)) + 3|0);
 HEAP8[$94>>0] = $93;
 $95 = $53 >>> 6;
 $96 = $95&255;
 $97 = ((($0)) + 4|0);
 HEAP8[$97>>0] = $96;
 $98 = $53 >>> 14;
 $99 = $98&255;
 $100 = ((($0)) + 5|0);
 HEAP8[$100>>0] = $99;
 $101 = $53 >>> 22;
 $102 = $57 << 3;
 $103 = $102 | $101;
 $104 = $103&255;
 $105 = ((($0)) + 6|0);
 HEAP8[$105>>0] = $104;
 $106 = $57 >>> 5;
 $107 = $106&255;
 $108 = ((($0)) + 7|0);
 HEAP8[$108>>0] = $107;
 $109 = $57 >>> 13;
 $110 = $109&255;
 $111 = ((($0)) + 8|0);
 HEAP8[$111>>0] = $110;
 $112 = $57 >>> 21;
 $113 = $61 << 5;
 $114 = $113 | $112;
 $115 = $114&255;
 $116 = ((($0)) + 9|0);
 HEAP8[$116>>0] = $115;
 $117 = $61 >>> 3;
 $118 = $117&255;
 $119 = ((($0)) + 10|0);
 HEAP8[$119>>0] = $118;
 $120 = $61 >>> 11;
 $121 = $120&255;
 $122 = ((($0)) + 11|0);
 HEAP8[$122>>0] = $121;
 $123 = $61 >>> 19;
 $124 = $65 << 6;
 $125 = $124 | $123;
 $126 = $125&255;
 $127 = ((($0)) + 12|0);
 HEAP8[$127>>0] = $126;
 $128 = $65 >>> 2;
 $129 = $128&255;
 $130 = ((($0)) + 13|0);
 HEAP8[$130>>0] = $129;
 $131 = $65 >>> 10;
 $132 = $131&255;
 $133 = ((($0)) + 14|0);
 HEAP8[$133>>0] = $132;
 $134 = $65 >>> 18;
 $135 = $134&255;
 $136 = ((($0)) + 15|0);
 HEAP8[$136>>0] = $135;
 $137 = $69&255;
 $138 = ((($0)) + 16|0);
 HEAP8[$138>>0] = $137;
 $139 = $69 >>> 8;
 $140 = $139&255;
 $141 = ((($0)) + 17|0);
 HEAP8[$141>>0] = $140;
 $142 = $69 >>> 16;
 $143 = $142&255;
 $144 = ((($0)) + 18|0);
 HEAP8[$144>>0] = $143;
 $145 = $69 >>> 24;
 $146 = $73 << 1;
 $147 = $146 | $145;
 $148 = $147&255;
 $149 = ((($0)) + 19|0);
 HEAP8[$149>>0] = $148;
 $150 = $73 >>> 7;
 $151 = $150&255;
 $152 = ((($0)) + 20|0);
 HEAP8[$152>>0] = $151;
 $153 = $73 >>> 15;
 $154 = $153&255;
 $155 = ((($0)) + 21|0);
 HEAP8[$155>>0] = $154;
 $156 = $73 >>> 23;
 $157 = $77 << 3;
 $158 = $157 | $156;
 $159 = $158&255;
 $160 = ((($0)) + 22|0);
 HEAP8[$160>>0] = $159;
 $161 = $77 >>> 5;
 $162 = $161&255;
 $163 = ((($0)) + 23|0);
 HEAP8[$163>>0] = $162;
 $164 = $77 >>> 13;
 $165 = $164&255;
 $166 = ((($0)) + 24|0);
 HEAP8[$166>>0] = $165;
 $167 = $77 >>> 21;
 $168 = $81 << 4;
 $169 = $168 | $167;
 $170 = $169&255;
 $171 = ((($0)) + 25|0);
 HEAP8[$171>>0] = $170;
 $172 = $81 >>> 4;
 $173 = $172&255;
 $174 = ((($0)) + 26|0);
 HEAP8[$174>>0] = $173;
 $175 = $81 >>> 12;
 $176 = $175&255;
 $177 = ((($0)) + 27|0);
 HEAP8[$177>>0] = $176;
 $178 = $81 >>> 20;
 $179 = $82 << 6;
 $180 = $178 | $179;
 $181 = $180&255;
 $182 = ((($0)) + 28|0);
 HEAP8[$182>>0] = $181;
 $183 = $79 >>> 2;
 $184 = $183&255;
 $185 = ((($0)) + 29|0);
 HEAP8[$185>>0] = $184;
 $186 = $79 >>> 10;
 $187 = $186&255;
 $188 = ((($0)) + 30|0);
 HEAP8[$188>>0] = $187;
 $189 = $82 >>> 18;
 $190 = $189&255;
 $191 = ((($0)) + 31|0);
 HEAP8[$191>>0] = $190;
 return;
}
function _crypto_sign_ed25519_ref10_ge_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$11,$12);
 _crypto_sign_ed25519_ref10_fe_add($3,$0,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_double_scalarmult_vartime($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0$lcssa = 0, $$022 = 0, $$121 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2272|0;
 $4 = sp + 2016|0;
 $5 = sp + 1760|0;
 $6 = sp + 480|0;
 $7 = sp + 320|0;
 $8 = sp + 160|0;
 $9 = sp;
 _slide($4,$1);
 _slide($5,$3);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($6,$2);
 _crypto_sign_ed25519_ref10_ge_p3_dbl($7,$2);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($9,$7);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$6);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $10 = ((($6)) + 160|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($10,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$10);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $11 = ((($6)) + 320|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($11,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$11);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $12 = ((($6)) + 480|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($12,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$12);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $13 = ((($6)) + 640|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($13,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$13);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $14 = ((($6)) + 800|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($14,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$14);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $15 = ((($6)) + 960|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($15,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$15);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $16 = ((($6)) + 1120|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($16,$8);
 _crypto_sign_ed25519_ref10_ge_p2_0($0);
 $$022 = 255;
 while(1) {
  $17 = (($4) + ($$022)|0);
  $18 = HEAP8[$17>>0]|0;
  $19 = ($18<<24>>24)==(0);
  if (!($19)) {
   $$0$lcssa = $$022;
   break;
  }
  $20 = (($5) + ($$022)|0);
  $21 = HEAP8[$20>>0]|0;
  $22 = ($21<<24>>24)==(0);
  if (!($22)) {
   $$0$lcssa = $$022;
   break;
  }
  $24 = (($$022) + -1)|0;
  $25 = ($$022|0)>(0);
  if ($25) {
   $$022 = $24;
  } else {
   $$0$lcssa = $24;
   break;
  }
 }
 $23 = ($$0$lcssa|0)>(-1);
 if ($23) {
  $$121 = $$0$lcssa;
 } else {
  STACKTOP = sp;return;
 }
 while(1) {
  _crypto_sign_ed25519_ref10_ge_p2_dbl($7,$0);
  $26 = (($4) + ($$121)|0);
  $27 = HEAP8[$26>>0]|0;
  $28 = ($27<<24>>24)>(0);
  if ($28) {
   _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
   $29 = HEAP8[$26>>0]|0;
   $30 = (($29<<24>>24) / 2)&-1;
   $31 = $30 << 24 >> 24;
   $32 = (($6) + (($31*160)|0)|0);
   _crypto_sign_ed25519_ref10_ge_add($7,$8,$32);
  } else {
   $33 = ($27<<24>>24)<(0);
   if ($33) {
    _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
    $34 = HEAP8[$26>>0]|0;
    $35 = (($34<<24>>24) / -2)&-1;
    $36 = $35 << 24 >> 24;
    $37 = (($6) + (($36*160)|0)|0);
    _crypto_sign_ed25519_ref10_ge_sub($7,$8,$37);
   }
  }
  $38 = (($5) + ($$121)|0);
  $39 = HEAP8[$38>>0]|0;
  $40 = ($39<<24>>24)>(0);
  if ($40) {
   _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
   $41 = HEAP8[$38>>0]|0;
   $42 = (($41<<24>>24) / 2)&-1;
   $43 = $42 << 24 >> 24;
   $44 = (712 + (($43*120)|0)|0);
   _crypto_sign_ed25519_ref10_ge_madd($7,$8,$44);
  } else {
   $45 = ($39<<24>>24)<(0);
   if ($45) {
    _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
    $46 = HEAP8[$38>>0]|0;
    $47 = (($46<<24>>24) / -2)&-1;
    $48 = $47 << 24 >> 24;
    $49 = (712 + (($48*120)|0)|0);
    _crypto_sign_ed25519_ref10_ge_msub($7,$8,$49);
   }
  }
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($0,$7);
  $50 = (($$121) + -1)|0;
  $51 = ($$121|0)>(0);
  if ($51) {
   $$121 = $50;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _slide($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$05559 = 0, $$05663 = 0, $$058 = 0, $$160 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $exitcond = 0, $exitcond65 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$05663 = 0;
 while(1) {
  $2 = $$05663 >> 3;
  $3 = (($1) + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = $$05663 & 7;
  $7 = $5 >>> $6;
  $8 = $7 & 1;
  $9 = $8&255;
  $10 = (($0) + ($$05663)|0);
  HEAP8[$10>>0] = $9;
  $11 = (($$05663) + 1)|0;
  $exitcond65 = ($11|0)==(256);
  if ($exitcond65) {
   $$160 = 0;
   break;
  } else {
   $$05663 = $11;
  }
 }
 while(1) {
  $12 = (($0) + ($$160)|0);
  $13 = HEAP8[$12>>0]|0;
  $14 = ($13<<24>>24)==(0);
  L5: do {
   if (!($14)) {
    $$05559 = 1;
    while(1) {
     $15 = (($$05559) + ($$160))|0;
     $16 = ($15|0)<(256);
     if (!($16)) {
      break L5;
     }
     $17 = (($0) + ($15)|0);
     $18 = HEAP8[$17>>0]|0;
     $19 = ($18<<24>>24)==(0);
     L9: do {
      if (!($19)) {
       $20 = HEAP8[$12>>0]|0;
       $21 = $20 << 24 >> 24;
       $22 = $18 << 24 >> 24;
       $23 = $22 << $$05559;
       $24 = (($21) + ($23))|0;
       $25 = ($24|0)<(16);
       if ($25) {
        $26 = $24&255;
        HEAP8[$12>>0] = $26;
        HEAP8[$17>>0] = 0;
        break;
       }
       $27 = (($21) - ($23))|0;
       $28 = ($27|0)>(-16);
       if (!($28)) {
        break L5;
       }
       $29 = $27&255;
       HEAP8[$12>>0] = $29;
       $$058 = $15;
       while(1) {
        $30 = (($0) + ($$058)|0);
        $31 = HEAP8[$30>>0]|0;
        $32 = ($31<<24>>24)==(0);
        if ($32) {
         break;
        }
        HEAP8[$30>>0] = 0;
        $33 = (($$058) + 1)|0;
        $34 = ($33|0)<(256);
        if ($34) {
         $$058 = $33;
        } else {
         break L9;
        }
       }
       HEAP8[$30>>0] = 1;
      }
     } while(0);
     $35 = (($$05559) + 1)|0;
     $36 = ($35|0)<(7);
     if ($36) {
      $$05559 = $35;
     } else {
      break;
     }
    }
   }
  } while(0);
  $37 = (($$160) + 1)|0;
  $exitcond = ($37|0)==(256);
  if ($exitcond) {
   break;
  } else {
   $$160 = $37;
  }
 }
 return;
}
function _crypto_sign_ed25519_ref10_ge_frombytes_negate_vartime($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0;
 $2 = sp + 160|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp + 40|0;
 $6 = sp;
 $7 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_frombytes($7,$1);
 $8 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($8);
 _crypto_sign_ed25519_ref10_fe_sq($2,$7);
 _crypto_sign_ed25519_ref10_fe_mul($3,$2,1672);
 _crypto_sign_ed25519_ref10_fe_sub($2,$2,$8);
 _crypto_sign_ed25519_ref10_fe_add($3,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($0,$4);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$3);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$2);
 _crypto_sign_ed25519_ref10_fe_pow22523($0,$0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$4);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$2);
 _crypto_sign_ed25519_ref10_fe_sq($5,$0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$3);
 _crypto_sign_ed25519_ref10_fe_sub($6,$5,$2);
 $9 = (_crypto_sign_ed25519_ref10_fe_isnonzero($6)|0);
 $10 = ($9|0)==(0);
 do {
  if (!($10)) {
   _crypto_sign_ed25519_ref10_fe_add($6,$5,$2);
   $11 = (_crypto_sign_ed25519_ref10_fe_isnonzero($6)|0);
   $12 = ($11|0)==(0);
   if ($12) {
    _crypto_sign_ed25519_ref10_fe_mul($0,$0,1712);
    break;
   } else {
    $$0 = -1;
    STACKTOP = sp;return ($$0|0);
   }
  }
 } while(0);
 $13 = (_crypto_sign_ed25519_ref10_fe_isnegative($0)|0);
 $14 = ((($1)) + 31|0);
 $15 = HEAP8[$14>>0]|0;
 $16 = $15&255;
 $17 = $16 >>> 7;
 $18 = ($13|0)==($17|0);
 if ($18) {
  _crypto_sign_ed25519_ref10_fe_neg($0,$0);
 }
 $19 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($19,$0,$7);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _crypto_sign_ed25519_ref10_ge_madd($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_add($3,$11,$11);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_msub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$7);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_add($3,$11,$11);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_sub($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$5,$2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$5,$2);
 $7 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($7,$1,$4);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p2_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_0($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p2_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $2 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($0,$1);
 $3 = ((($0)) + 80|0);
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sq($3,$4);
 $5 = ((($0)) + 120|0);
 $6 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_sq2($5,$6);
 $7 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($7,$1,$4);
 _crypto_sign_ed25519_ref10_fe_sq($2,$7);
 _crypto_sign_ed25519_ref10_fe_add($7,$3,$0);
 _crypto_sign_ed25519_ref10_fe_sub($3,$3,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$2,$7);
 _crypto_sign_ed25519_ref10_fe_sub($5,$5,$3);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p3_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_0($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($2);
 $3 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_0($3);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp;
 _crypto_sign_ed25519_ref10_ge_p3_to_p2($2,$1);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($0,$2);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p3_to_cached($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$2,$1);
 $3 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($3,$2,$1);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_copy($4,$5);
 $6 = ((($0)) + 120|0);
 $7 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$7,1752);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_copy($0,$1);
 $2 = ((($0)) + 40|0);
 $3 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_copy($2,$3);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_copy($4,$5);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_invert($2,$5);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($4,$6,$2);
 _crypto_sign_ed25519_ref10_fe_tobytes($0,$4);
 $7 = (_crypto_sign_ed25519_ref10_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $11 ^ $8;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_precomp_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_1($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_0($2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_scalarmult_base($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$03135 = 0, $$037 = 0, $$136 = 0, $$234 = 0, $$333 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $exitcond = 0, $exitcond38 = 0, $sext = 0, $sext32 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 464|0;
 $2 = sp + 400|0;
 $3 = sp + 240|0;
 $4 = sp + 120|0;
 $5 = sp;
 $$037 = 0;
 while(1) {
  $6 = (($1) + ($$037)|0);
  $7 = HEAP8[$6>>0]|0;
  $8 = $7 & 15;
  $9 = $$037 << 1;
  $10 = (($2) + ($9)|0);
  HEAP8[$10>>0] = $8;
  $11 = ($7&255) >>> 4;
  $12 = $9 | 1;
  $13 = (($2) + ($12)|0);
  HEAP8[$13>>0] = $11;
  $14 = (($$037) + 1)|0;
  $exitcond38 = ($14|0)==(32);
  if ($exitcond38) {
   $$03135 = 0;$$136 = 0;
   break;
  } else {
   $$037 = $14;
  }
 }
 while(1) {
  $15 = (($2) + ($$136)|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = $16&255;
  $18 = (($17) + ($$03135))|0;
  $sext = $18 << 24;
  $sext32 = (($sext) + 134217728)|0;
  $19 = $sext32 >> 28;
  $20 = $19 << 4;
  $21 = (($18) - ($20))|0;
  $22 = $21&255;
  HEAP8[$15>>0] = $22;
  $23 = (($$136) + 1)|0;
  $exitcond = ($23|0)==(63);
  if ($exitcond) {
   break;
  } else {
   $$03135 = $19;$$136 = $23;
  }
 }
 $24 = ((($2)) + 63|0);
 $25 = HEAP8[$24>>0]|0;
 $26 = $25&255;
 $27 = (($26) + ($19))|0;
 $28 = $27&255;
 HEAP8[$24>>0] = $28;
 _crypto_sign_ed25519_ref10_ge_p3_0($0);
 $$234 = 1;
 while(1) {
  $29 = (($$234|0) / 2)&-1;
  $30 = (($2) + ($$234)|0);
  $31 = HEAP8[$30>>0]|0;
  _select_60($5,$29,$31);
  _crypto_sign_ed25519_ref10_ge_madd($3,$0,$5);
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
  $32 = (($$234) + 2)|0;
  $33 = ($32|0)<(64);
  if ($33) {
   $$234 = $32;
  } else {
   break;
  }
 }
 _crypto_sign_ed25519_ref10_ge_p3_dbl($3,$0);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
 $$333 = 0;
 while(1) {
  $34 = (($$333|0) / 2)&-1;
  $35 = (($2) + ($$333)|0);
  $36 = HEAP8[$35>>0]|0;
  _select_60($5,$34,$36);
  _crypto_sign_ed25519_ref10_ge_madd($3,$0,$5);
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
  $37 = (($$333) + 2)|0;
  $38 = ($37|0)<(64);
  if ($38) {
   $$333 = $37;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _select_60($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $3 = sp;
 $4 = (_negative($2)|0);
 $5 = $2 << 24 >> 24;
 $6 = $4&255;
 $7 = (0 - ($6))|0;
 $8 = $5 & $7;
 $9 = $8 << 1;
 $10 = (($5) - ($9))|0;
 $11 = $10&255;
 _crypto_sign_ed25519_ref10_ge_precomp_0($0);
 $12 = (1792 + (($1*960)|0)|0);
 $13 = (_equal($11,1)|0);
 _cmov($0,$12,$13);
 $14 = (((1792 + (($1*960)|0)|0)) + 120|0);
 $15 = (_equal($11,2)|0);
 _cmov($0,$14,$15);
 $16 = (((1792 + (($1*960)|0)|0)) + 240|0);
 $17 = (_equal($11,3)|0);
 _cmov($0,$16,$17);
 $18 = (((1792 + (($1*960)|0)|0)) + 360|0);
 $19 = (_equal($11,4)|0);
 _cmov($0,$18,$19);
 $20 = (((1792 + (($1*960)|0)|0)) + 480|0);
 $21 = (_equal($11,5)|0);
 _cmov($0,$20,$21);
 $22 = (((1792 + (($1*960)|0)|0)) + 600|0);
 $23 = (_equal($11,6)|0);
 _cmov($0,$22,$23);
 $24 = (((1792 + (($1*960)|0)|0)) + 720|0);
 $25 = (_equal($11,7)|0);
 _cmov($0,$24,$25);
 $26 = (((1792 + (($1*960)|0)|0)) + 840|0);
 $27 = (_equal($11,8)|0);
 _cmov($0,$26,$27);
 $28 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_copy($3,$28);
 $29 = ((($3)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_copy($29,$0);
 $30 = ((($3)) + 80|0);
 $31 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_neg($30,$31);
 _cmov($0,$3,$4);
 STACKTOP = sp;return;
}
function _negative($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 << 24 >> 24;
 $2 = ($1|0)<(0);
 $3 = $2 << 31 >> 31;
 $4 = (_bitshift64Lshr(($1|0),($3|0),63)|0);
 $5 = tempRet0;
 $6 = $4&255;
 return ($6|0);
}
function _equal($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 ^ $0;
 $3 = $2&255;
 $4 = (($3) + -1)|0;
 $5 = $4 >>> 31;
 $6 = $5&255;
 return ($6|0);
}
function _cmov($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $2&255;
 _crypto_sign_ed25519_ref10_fe_cmov($0,$1,$3);
 $4 = ((($0)) + 40|0);
 $5 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_cmov($4,$5,$3);
 $6 = ((($0)) + 80|0);
 $7 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_cmov($6,$7,$3);
 return;
}
function _crypto_sign_ed25519_ref10_ge_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$7);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$11,$12);
 _crypto_sign_ed25519_ref10_fe_add($3,$0,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_sub($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_invert($2,$5);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($4,$6,$2);
 _crypto_sign_ed25519_ref10_fe_tobytes($0,$4);
 $7 = (_crypto_sign_ed25519_ref10_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $11 ^ $8;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _crypto_sign_edwards25519sha512batch_ref10_open($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 480|0;
 $6 = sp + 440|0;
 $7 = sp + 408|0;
 $8 = sp + 376|0;
 $9 = sp + 312|0;
 $10 = sp + 280|0;
 $11 = sp + 120|0;
 $12 = sp;
 $13 = ($4>>>0)<(0);
 $14 = ($3>>>0)<(64);
 $15 = ($4|0)==(0);
 $16 = $15 & $14;
 $17 = $13 | $16;
 if (!($17)) {
  $18 = ((($2)) + 63|0);
  $19 = HEAP8[$18>>0]|0;
  $20 = ($19&255)>(31);
  if (!($20)) {
   $21 = (_crypto_sign_ed25519_ref10_ge_frombytes_negate_vartime($11,$5)|0);
   $22 = ($21|0)==(0);
   if ($22) {
    dest=$6; src=$5; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
    dest=$7; src=$2; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
    $23 = ((($2)) + 32|0);
    dest=$8; src=$23; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
    _memmove(($0|0),($2|0),($3|0))|0;
    $24 = ((($0)) + 32|0);
    dest=$24; src=$6; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
    (_crypto_hash_sha512_ref($9,$0,$3,$4)|0);
    _crypto_sign_ed25519_ref10_sc_reduce($9);
    _crypto_sign_ed25519_ref10_ge_double_scalarmult_vartime($12,$9,$11,$8);
    _crypto_sign_ed25519_ref10_ge_tobytes($10,$12);
    $25 = (_crypto_verify_32_ref($10,$7)|0);
    $26 = ($25|0)==(0);
    if ($26) {
     $27 = ((($0)) + 64|0);
     $28 = (_i64Add(($3|0),($4|0),-64,-1)|0);
     $29 = tempRet0;
     _memmove(($0|0),($27|0),($28|0))|0;
     $30 = (($0) + ($3)|0);
     $31 = ((($30)) + -64|0);
     dest=$31; stop=dest+64|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0));
     $32 = $1;
     $33 = $32;
     HEAP32[$33>>2] = $28;
     $34 = (($32) + 4)|0;
     $35 = $34;
     HEAP32[$35>>2] = $29;
     $$0 = 0;
     STACKTOP = sp;return ($$0|0);
    }
   }
  }
 }
 $36 = $1;
 $37 = $36;
 HEAP32[$37>>2] = -1;
 $38 = (($36) + 4)|0;
 $39 = $38;
 HEAP32[$39>>2] = -1;
 _memset(($0|0),0,($3|0))|0;
 $$0 = -1;
 STACKTOP = sp;return ($$0|0);
}
function _crypto_sign_ed25519_ref10_sc_muladd($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0;
 var $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0;
 var $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0;
 var $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0;
 var $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0;
 var $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0;
 var $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0;
 var $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0;
 var $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0, $1213 = 0, $1214 = 0;
 var $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0;
 var $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0;
 var $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0;
 var $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0, $1287 = 0;
 var $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0;
 var $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0, $1322 = 0;
 var $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0;
 var $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0;
 var $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0;
 var $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0, $1395 = 0;
 var $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0;
 var $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0;
 var $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0;
 var $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0;
 var $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0;
 var $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0;
 var $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0, $1520 = 0;
 var $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0, $1539 = 0;
 var $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0, $1557 = 0;
 var $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0, $1575 = 0;
 var $1576 = 0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0, $1593 = 0;
 var $1594 = 0, $1595 = 0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0, $1610 = 0;
 var $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0, $1629 = 0;
 var $163 = 0, $1630 = 0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0, $1647 = 0;
 var $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0, $1665 = 0;
 var $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0, $1683 = 0;
 var $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0, $1700 = 0;
 var $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0, $1719 = 0;
 var $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0, $1737 = 0;
 var $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0, $1755 = 0;
 var $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0, $1773 = 0;
 var $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0, $1791 = 0;
 var $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0, $1809 = 0;
 var $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0, $1827 = 0;
 var $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0, $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0, $1845 = 0;
 var $1846 = 0, $1847 = 0, $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0, $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0, $1863 = 0;
 var $1864 = 0, $1865 = 0, $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0, $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0, $1881 = 0;
 var $1882 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0;
 var $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0;
 var $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0;
 var $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0;
 var $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0;
 var $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0;
 var $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0;
 var $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0;
 var $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0;
 var $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0;
 var $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0;
 var $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0;
 var $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0;
 var $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0;
 var $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0;
 var $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0;
 var $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = (_load_3_47($1)|0);
 $5 = tempRet0;
 $6 = $4 & 2097151;
 $7 = ((($1)) + 2|0);
 $8 = (_load_4_48($7)|0);
 $9 = tempRet0;
 $10 = (_bitshift64Lshr(($8|0),($9|0),5)|0);
 $11 = tempRet0;
 $12 = $10 & 2097151;
 $13 = ((($1)) + 5|0);
 $14 = (_load_3_47($13)|0);
 $15 = tempRet0;
 $16 = (_bitshift64Lshr(($14|0),($15|0),2)|0);
 $17 = tempRet0;
 $18 = $16 & 2097151;
 $19 = ((($1)) + 7|0);
 $20 = (_load_4_48($19)|0);
 $21 = tempRet0;
 $22 = (_bitshift64Lshr(($20|0),($21|0),7)|0);
 $23 = tempRet0;
 $24 = $22 & 2097151;
 $25 = ((($1)) + 10|0);
 $26 = (_load_4_48($25)|0);
 $27 = tempRet0;
 $28 = (_bitshift64Lshr(($26|0),($27|0),4)|0);
 $29 = tempRet0;
 $30 = $28 & 2097151;
 $31 = ((($1)) + 13|0);
 $32 = (_load_3_47($31)|0);
 $33 = tempRet0;
 $34 = (_bitshift64Lshr(($32|0),($33|0),1)|0);
 $35 = tempRet0;
 $36 = $34 & 2097151;
 $37 = ((($1)) + 15|0);
 $38 = (_load_4_48($37)|0);
 $39 = tempRet0;
 $40 = (_bitshift64Lshr(($38|0),($39|0),6)|0);
 $41 = tempRet0;
 $42 = $40 & 2097151;
 $43 = ((($1)) + 18|0);
 $44 = (_load_3_47($43)|0);
 $45 = tempRet0;
 $46 = (_bitshift64Lshr(($44|0),($45|0),3)|0);
 $47 = tempRet0;
 $48 = $46 & 2097151;
 $49 = ((($1)) + 21|0);
 $50 = (_load_3_47($49)|0);
 $51 = tempRet0;
 $52 = $50 & 2097151;
 $53 = ((($1)) + 23|0);
 $54 = (_load_4_48($53)|0);
 $55 = tempRet0;
 $56 = (_bitshift64Lshr(($54|0),($55|0),5)|0);
 $57 = tempRet0;
 $58 = $56 & 2097151;
 $59 = ((($1)) + 26|0);
 $60 = (_load_3_47($59)|0);
 $61 = tempRet0;
 $62 = (_bitshift64Lshr(($60|0),($61|0),2)|0);
 $63 = tempRet0;
 $64 = $62 & 2097151;
 $65 = ((($1)) + 28|0);
 $66 = (_load_4_48($65)|0);
 $67 = tempRet0;
 $68 = (_bitshift64Lshr(($66|0),($67|0),7)|0);
 $69 = tempRet0;
 $70 = (_load_3_47($2)|0);
 $71 = tempRet0;
 $72 = $70 & 2097151;
 $73 = ((($2)) + 2|0);
 $74 = (_load_4_48($73)|0);
 $75 = tempRet0;
 $76 = (_bitshift64Lshr(($74|0),($75|0),5)|0);
 $77 = tempRet0;
 $78 = $76 & 2097151;
 $79 = ((($2)) + 5|0);
 $80 = (_load_3_47($79)|0);
 $81 = tempRet0;
 $82 = (_bitshift64Lshr(($80|0),($81|0),2)|0);
 $83 = tempRet0;
 $84 = $82 & 2097151;
 $85 = ((($2)) + 7|0);
 $86 = (_load_4_48($85)|0);
 $87 = tempRet0;
 $88 = (_bitshift64Lshr(($86|0),($87|0),7)|0);
 $89 = tempRet0;
 $90 = $88 & 2097151;
 $91 = ((($2)) + 10|0);
 $92 = (_load_4_48($91)|0);
 $93 = tempRet0;
 $94 = (_bitshift64Lshr(($92|0),($93|0),4)|0);
 $95 = tempRet0;
 $96 = $94 & 2097151;
 $97 = ((($2)) + 13|0);
 $98 = (_load_3_47($97)|0);
 $99 = tempRet0;
 $100 = (_bitshift64Lshr(($98|0),($99|0),1)|0);
 $101 = tempRet0;
 $102 = $100 & 2097151;
 $103 = ((($2)) + 15|0);
 $104 = (_load_4_48($103)|0);
 $105 = tempRet0;
 $106 = (_bitshift64Lshr(($104|0),($105|0),6)|0);
 $107 = tempRet0;
 $108 = $106 & 2097151;
 $109 = ((($2)) + 18|0);
 $110 = (_load_3_47($109)|0);
 $111 = tempRet0;
 $112 = (_bitshift64Lshr(($110|0),($111|0),3)|0);
 $113 = tempRet0;
 $114 = $112 & 2097151;
 $115 = ((($2)) + 21|0);
 $116 = (_load_3_47($115)|0);
 $117 = tempRet0;
 $118 = $116 & 2097151;
 $119 = ((($2)) + 23|0);
 $120 = (_load_4_48($119)|0);
 $121 = tempRet0;
 $122 = (_bitshift64Lshr(($120|0),($121|0),5)|0);
 $123 = tempRet0;
 $124 = $122 & 2097151;
 $125 = ((($2)) + 26|0);
 $126 = (_load_3_47($125)|0);
 $127 = tempRet0;
 $128 = (_bitshift64Lshr(($126|0),($127|0),2)|0);
 $129 = tempRet0;
 $130 = $128 & 2097151;
 $131 = ((($2)) + 28|0);
 $132 = (_load_4_48($131)|0);
 $133 = tempRet0;
 $134 = (_bitshift64Lshr(($132|0),($133|0),7)|0);
 $135 = tempRet0;
 $136 = (_load_3_47($3)|0);
 $137 = tempRet0;
 $138 = $136 & 2097151;
 $139 = ((($3)) + 2|0);
 $140 = (_load_4_48($139)|0);
 $141 = tempRet0;
 $142 = (_bitshift64Lshr(($140|0),($141|0),5)|0);
 $143 = tempRet0;
 $144 = $142 & 2097151;
 $145 = ((($3)) + 5|0);
 $146 = (_load_3_47($145)|0);
 $147 = tempRet0;
 $148 = (_bitshift64Lshr(($146|0),($147|0),2)|0);
 $149 = tempRet0;
 $150 = $148 & 2097151;
 $151 = ((($3)) + 7|0);
 $152 = (_load_4_48($151)|0);
 $153 = tempRet0;
 $154 = (_bitshift64Lshr(($152|0),($153|0),7)|0);
 $155 = tempRet0;
 $156 = $154 & 2097151;
 $157 = ((($3)) + 10|0);
 $158 = (_load_4_48($157)|0);
 $159 = tempRet0;
 $160 = (_bitshift64Lshr(($158|0),($159|0),4)|0);
 $161 = tempRet0;
 $162 = $160 & 2097151;
 $163 = ((($3)) + 13|0);
 $164 = (_load_3_47($163)|0);
 $165 = tempRet0;
 $166 = (_bitshift64Lshr(($164|0),($165|0),1)|0);
 $167 = tempRet0;
 $168 = $166 & 2097151;
 $169 = ((($3)) + 15|0);
 $170 = (_load_4_48($169)|0);
 $171 = tempRet0;
 $172 = (_bitshift64Lshr(($170|0),($171|0),6)|0);
 $173 = tempRet0;
 $174 = $172 & 2097151;
 $175 = ((($3)) + 18|0);
 $176 = (_load_3_47($175)|0);
 $177 = tempRet0;
 $178 = (_bitshift64Lshr(($176|0),($177|0),3)|0);
 $179 = tempRet0;
 $180 = $178 & 2097151;
 $181 = ((($3)) + 21|0);
 $182 = (_load_3_47($181)|0);
 $183 = tempRet0;
 $184 = $182 & 2097151;
 $185 = ((($3)) + 23|0);
 $186 = (_load_4_48($185)|0);
 $187 = tempRet0;
 $188 = (_bitshift64Lshr(($186|0),($187|0),5)|0);
 $189 = tempRet0;
 $190 = $188 & 2097151;
 $191 = ((($3)) + 26|0);
 $192 = (_load_3_47($191)|0);
 $193 = tempRet0;
 $194 = (_bitshift64Lshr(($192|0),($193|0),2)|0);
 $195 = tempRet0;
 $196 = $194 & 2097151;
 $197 = ((($3)) + 28|0);
 $198 = (_load_4_48($197)|0);
 $199 = tempRet0;
 $200 = (_bitshift64Lshr(($198|0),($199|0),7)|0);
 $201 = tempRet0;
 $202 = (___muldi3(($72|0),0,($6|0),0)|0);
 $203 = tempRet0;
 $204 = (_i64Add(($138|0),0,($202|0),($203|0))|0);
 $205 = tempRet0;
 $206 = (___muldi3(($78|0),0,($6|0),0)|0);
 $207 = tempRet0;
 $208 = (___muldi3(($72|0),0,($12|0),0)|0);
 $209 = tempRet0;
 $210 = (___muldi3(($84|0),0,($6|0),0)|0);
 $211 = tempRet0;
 $212 = (___muldi3(($78|0),0,($12|0),0)|0);
 $213 = tempRet0;
 $214 = (___muldi3(($72|0),0,($18|0),0)|0);
 $215 = tempRet0;
 $216 = (_i64Add(($212|0),($213|0),($214|0),($215|0))|0);
 $217 = tempRet0;
 $218 = (_i64Add(($216|0),($217|0),($210|0),($211|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($150|0),0)|0);
 $221 = tempRet0;
 $222 = (___muldi3(($90|0),0,($6|0),0)|0);
 $223 = tempRet0;
 $224 = (___muldi3(($84|0),0,($12|0),0)|0);
 $225 = tempRet0;
 $226 = (___muldi3(($78|0),0,($18|0),0)|0);
 $227 = tempRet0;
 $228 = (___muldi3(($72|0),0,($24|0),0)|0);
 $229 = tempRet0;
 $230 = (___muldi3(($96|0),0,($6|0),0)|0);
 $231 = tempRet0;
 $232 = (___muldi3(($90|0),0,($12|0),0)|0);
 $233 = tempRet0;
 $234 = (___muldi3(($84|0),0,($18|0),0)|0);
 $235 = tempRet0;
 $236 = (___muldi3(($78|0),0,($24|0),0)|0);
 $237 = tempRet0;
 $238 = (___muldi3(($72|0),0,($30|0),0)|0);
 $239 = tempRet0;
 $240 = (_i64Add(($236|0),($237|0),($238|0),($239|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($234|0),($235|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($242|0),($243|0),($232|0),($233|0))|0);
 $245 = tempRet0;
 $246 = (_i64Add(($244|0),($245|0),($230|0),($231|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($246|0),($247|0),($162|0),0)|0);
 $249 = tempRet0;
 $250 = (___muldi3(($102|0),0,($6|0),0)|0);
 $251 = tempRet0;
 $252 = (___muldi3(($96|0),0,($12|0),0)|0);
 $253 = tempRet0;
 $254 = (___muldi3(($90|0),0,($18|0),0)|0);
 $255 = tempRet0;
 $256 = (___muldi3(($84|0),0,($24|0),0)|0);
 $257 = tempRet0;
 $258 = (___muldi3(($78|0),0,($30|0),0)|0);
 $259 = tempRet0;
 $260 = (___muldi3(($72|0),0,($36|0),0)|0);
 $261 = tempRet0;
 $262 = (___muldi3(($108|0),0,($6|0),0)|0);
 $263 = tempRet0;
 $264 = (___muldi3(($102|0),0,($12|0),0)|0);
 $265 = tempRet0;
 $266 = (___muldi3(($96|0),0,($18|0),0)|0);
 $267 = tempRet0;
 $268 = (___muldi3(($90|0),0,($24|0),0)|0);
 $269 = tempRet0;
 $270 = (___muldi3(($84|0),0,($30|0),0)|0);
 $271 = tempRet0;
 $272 = (___muldi3(($78|0),0,($36|0),0)|0);
 $273 = tempRet0;
 $274 = (___muldi3(($72|0),0,($42|0),0)|0);
 $275 = tempRet0;
 $276 = (_i64Add(($272|0),($273|0),($274|0),($275|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($270|0),($271|0))|0);
 $279 = tempRet0;
 $280 = (_i64Add(($278|0),($279|0),($268|0),($269|0))|0);
 $281 = tempRet0;
 $282 = (_i64Add(($280|0),($281|0),($266|0),($267|0))|0);
 $283 = tempRet0;
 $284 = (_i64Add(($282|0),($283|0),($264|0),($265|0))|0);
 $285 = tempRet0;
 $286 = (_i64Add(($284|0),($285|0),($262|0),($263|0))|0);
 $287 = tempRet0;
 $288 = (_i64Add(($286|0),($287|0),($174|0),0)|0);
 $289 = tempRet0;
 $290 = (___muldi3(($114|0),0,($6|0),0)|0);
 $291 = tempRet0;
 $292 = (___muldi3(($108|0),0,($12|0),0)|0);
 $293 = tempRet0;
 $294 = (___muldi3(($102|0),0,($18|0),0)|0);
 $295 = tempRet0;
 $296 = (___muldi3(($96|0),0,($24|0),0)|0);
 $297 = tempRet0;
 $298 = (___muldi3(($90|0),0,($30|0),0)|0);
 $299 = tempRet0;
 $300 = (___muldi3(($84|0),0,($36|0),0)|0);
 $301 = tempRet0;
 $302 = (___muldi3(($78|0),0,($42|0),0)|0);
 $303 = tempRet0;
 $304 = (___muldi3(($72|0),0,($48|0),0)|0);
 $305 = tempRet0;
 $306 = (___muldi3(($118|0),0,($6|0),0)|0);
 $307 = tempRet0;
 $308 = (___muldi3(($114|0),0,($12|0),0)|0);
 $309 = tempRet0;
 $310 = (___muldi3(($108|0),0,($18|0),0)|0);
 $311 = tempRet0;
 $312 = (___muldi3(($102|0),0,($24|0),0)|0);
 $313 = tempRet0;
 $314 = (___muldi3(($96|0),0,($30|0),0)|0);
 $315 = tempRet0;
 $316 = (___muldi3(($90|0),0,($36|0),0)|0);
 $317 = tempRet0;
 $318 = (___muldi3(($84|0),0,($42|0),0)|0);
 $319 = tempRet0;
 $320 = (___muldi3(($78|0),0,($48|0),0)|0);
 $321 = tempRet0;
 $322 = (___muldi3(($72|0),0,($52|0),0)|0);
 $323 = tempRet0;
 $324 = (_i64Add(($320|0),($321|0),($322|0),($323|0))|0);
 $325 = tempRet0;
 $326 = (_i64Add(($324|0),($325|0),($318|0),($319|0))|0);
 $327 = tempRet0;
 $328 = (_i64Add(($326|0),($327|0),($316|0),($317|0))|0);
 $329 = tempRet0;
 $330 = (_i64Add(($328|0),($329|0),($314|0),($315|0))|0);
 $331 = tempRet0;
 $332 = (_i64Add(($330|0),($331|0),($312|0),($313|0))|0);
 $333 = tempRet0;
 $334 = (_i64Add(($332|0),($333|0),($310|0),($311|0))|0);
 $335 = tempRet0;
 $336 = (_i64Add(($334|0),($335|0),($306|0),($307|0))|0);
 $337 = tempRet0;
 $338 = (_i64Add(($336|0),($337|0),($308|0),($309|0))|0);
 $339 = tempRet0;
 $340 = (_i64Add(($338|0),($339|0),($184|0),0)|0);
 $341 = tempRet0;
 $342 = (___muldi3(($124|0),0,($6|0),0)|0);
 $343 = tempRet0;
 $344 = (___muldi3(($118|0),0,($12|0),0)|0);
 $345 = tempRet0;
 $346 = (___muldi3(($114|0),0,($18|0),0)|0);
 $347 = tempRet0;
 $348 = (___muldi3(($108|0),0,($24|0),0)|0);
 $349 = tempRet0;
 $350 = (___muldi3(($102|0),0,($30|0),0)|0);
 $351 = tempRet0;
 $352 = (___muldi3(($96|0),0,($36|0),0)|0);
 $353 = tempRet0;
 $354 = (___muldi3(($90|0),0,($42|0),0)|0);
 $355 = tempRet0;
 $356 = (___muldi3(($84|0),0,($48|0),0)|0);
 $357 = tempRet0;
 $358 = (___muldi3(($78|0),0,($52|0),0)|0);
 $359 = tempRet0;
 $360 = (___muldi3(($72|0),0,($58|0),0)|0);
 $361 = tempRet0;
 $362 = (___muldi3(($130|0),0,($6|0),0)|0);
 $363 = tempRet0;
 $364 = (___muldi3(($124|0),0,($12|0),0)|0);
 $365 = tempRet0;
 $366 = (___muldi3(($118|0),0,($18|0),0)|0);
 $367 = tempRet0;
 $368 = (___muldi3(($114|0),0,($24|0),0)|0);
 $369 = tempRet0;
 $370 = (___muldi3(($108|0),0,($30|0),0)|0);
 $371 = tempRet0;
 $372 = (___muldi3(($102|0),0,($36|0),0)|0);
 $373 = tempRet0;
 $374 = (___muldi3(($96|0),0,($42|0),0)|0);
 $375 = tempRet0;
 $376 = (___muldi3(($90|0),0,($48|0),0)|0);
 $377 = tempRet0;
 $378 = (___muldi3(($84|0),0,($52|0),0)|0);
 $379 = tempRet0;
 $380 = (___muldi3(($78|0),0,($58|0),0)|0);
 $381 = tempRet0;
 $382 = (___muldi3(($72|0),0,($64|0),0)|0);
 $383 = tempRet0;
 $384 = (_i64Add(($380|0),($381|0),($382|0),($383|0))|0);
 $385 = tempRet0;
 $386 = (_i64Add(($384|0),($385|0),($378|0),($379|0))|0);
 $387 = tempRet0;
 $388 = (_i64Add(($386|0),($387|0),($376|0),($377|0))|0);
 $389 = tempRet0;
 $390 = (_i64Add(($388|0),($389|0),($374|0),($375|0))|0);
 $391 = tempRet0;
 $392 = (_i64Add(($390|0),($391|0),($372|0),($373|0))|0);
 $393 = tempRet0;
 $394 = (_i64Add(($392|0),($393|0),($370|0),($371|0))|0);
 $395 = tempRet0;
 $396 = (_i64Add(($394|0),($395|0),($366|0),($367|0))|0);
 $397 = tempRet0;
 $398 = (_i64Add(($396|0),($397|0),($368|0),($369|0))|0);
 $399 = tempRet0;
 $400 = (_i64Add(($398|0),($399|0),($364|0),($365|0))|0);
 $401 = tempRet0;
 $402 = (_i64Add(($400|0),($401|0),($362|0),($363|0))|0);
 $403 = tempRet0;
 $404 = (_i64Add(($402|0),($403|0),($196|0),0)|0);
 $405 = tempRet0;
 $406 = (___muldi3(($134|0),($135|0),($6|0),0)|0);
 $407 = tempRet0;
 $408 = (___muldi3(($130|0),0,($12|0),0)|0);
 $409 = tempRet0;
 $410 = (___muldi3(($124|0),0,($18|0),0)|0);
 $411 = tempRet0;
 $412 = (___muldi3(($118|0),0,($24|0),0)|0);
 $413 = tempRet0;
 $414 = (___muldi3(($114|0),0,($30|0),0)|0);
 $415 = tempRet0;
 $416 = (___muldi3(($108|0),0,($36|0),0)|0);
 $417 = tempRet0;
 $418 = (___muldi3(($102|0),0,($42|0),0)|0);
 $419 = tempRet0;
 $420 = (___muldi3(($96|0),0,($48|0),0)|0);
 $421 = tempRet0;
 $422 = (___muldi3(($90|0),0,($52|0),0)|0);
 $423 = tempRet0;
 $424 = (___muldi3(($84|0),0,($58|0),0)|0);
 $425 = tempRet0;
 $426 = (___muldi3(($78|0),0,($64|0),0)|0);
 $427 = tempRet0;
 $428 = (___muldi3(($72|0),0,($68|0),($69|0))|0);
 $429 = tempRet0;
 $430 = (___muldi3(($134|0),($135|0),($12|0),0)|0);
 $431 = tempRet0;
 $432 = (___muldi3(($130|0),0,($18|0),0)|0);
 $433 = tempRet0;
 $434 = (___muldi3(($124|0),0,($24|0),0)|0);
 $435 = tempRet0;
 $436 = (___muldi3(($118|0),0,($30|0),0)|0);
 $437 = tempRet0;
 $438 = (___muldi3(($114|0),0,($36|0),0)|0);
 $439 = tempRet0;
 $440 = (___muldi3(($108|0),0,($42|0),0)|0);
 $441 = tempRet0;
 $442 = (___muldi3(($102|0),0,($48|0),0)|0);
 $443 = tempRet0;
 $444 = (___muldi3(($96|0),0,($52|0),0)|0);
 $445 = tempRet0;
 $446 = (___muldi3(($90|0),0,($58|0),0)|0);
 $447 = tempRet0;
 $448 = (___muldi3(($84|0),0,($64|0),0)|0);
 $449 = tempRet0;
 $450 = (___muldi3(($78|0),0,($68|0),($69|0))|0);
 $451 = tempRet0;
 $452 = (_i64Add(($448|0),($449|0),($450|0),($451|0))|0);
 $453 = tempRet0;
 $454 = (_i64Add(($452|0),($453|0),($446|0),($447|0))|0);
 $455 = tempRet0;
 $456 = (_i64Add(($454|0),($455|0),($444|0),($445|0))|0);
 $457 = tempRet0;
 $458 = (_i64Add(($456|0),($457|0),($442|0),($443|0))|0);
 $459 = tempRet0;
 $460 = (_i64Add(($458|0),($459|0),($440|0),($441|0))|0);
 $461 = tempRet0;
 $462 = (_i64Add(($460|0),($461|0),($436|0),($437|0))|0);
 $463 = tempRet0;
 $464 = (_i64Add(($462|0),($463|0),($438|0),($439|0))|0);
 $465 = tempRet0;
 $466 = (_i64Add(($464|0),($465|0),($434|0),($435|0))|0);
 $467 = tempRet0;
 $468 = (_i64Add(($466|0),($467|0),($432|0),($433|0))|0);
 $469 = tempRet0;
 $470 = (_i64Add(($468|0),($469|0),($430|0),($431|0))|0);
 $471 = tempRet0;
 $472 = (___muldi3(($134|0),($135|0),($18|0),0)|0);
 $473 = tempRet0;
 $474 = (___muldi3(($130|0),0,($24|0),0)|0);
 $475 = tempRet0;
 $476 = (___muldi3(($124|0),0,($30|0),0)|0);
 $477 = tempRet0;
 $478 = (___muldi3(($118|0),0,($36|0),0)|0);
 $479 = tempRet0;
 $480 = (___muldi3(($114|0),0,($42|0),0)|0);
 $481 = tempRet0;
 $482 = (___muldi3(($108|0),0,($48|0),0)|0);
 $483 = tempRet0;
 $484 = (___muldi3(($102|0),0,($52|0),0)|0);
 $485 = tempRet0;
 $486 = (___muldi3(($96|0),0,($58|0),0)|0);
 $487 = tempRet0;
 $488 = (___muldi3(($90|0),0,($64|0),0)|0);
 $489 = tempRet0;
 $490 = (___muldi3(($84|0),0,($68|0),($69|0))|0);
 $491 = tempRet0;
 $492 = (___muldi3(($134|0),($135|0),($24|0),0)|0);
 $493 = tempRet0;
 $494 = (___muldi3(($130|0),0,($30|0),0)|0);
 $495 = tempRet0;
 $496 = (___muldi3(($124|0),0,($36|0),0)|0);
 $497 = tempRet0;
 $498 = (___muldi3(($118|0),0,($42|0),0)|0);
 $499 = tempRet0;
 $500 = (___muldi3(($114|0),0,($48|0),0)|0);
 $501 = tempRet0;
 $502 = (___muldi3(($108|0),0,($52|0),0)|0);
 $503 = tempRet0;
 $504 = (___muldi3(($102|0),0,($58|0),0)|0);
 $505 = tempRet0;
 $506 = (___muldi3(($96|0),0,($64|0),0)|0);
 $507 = tempRet0;
 $508 = (___muldi3(($90|0),0,($68|0),($69|0))|0);
 $509 = tempRet0;
 $510 = (_i64Add(($506|0),($507|0),($508|0),($509|0))|0);
 $511 = tempRet0;
 $512 = (_i64Add(($510|0),($511|0),($504|0),($505|0))|0);
 $513 = tempRet0;
 $514 = (_i64Add(($512|0),($513|0),($502|0),($503|0))|0);
 $515 = tempRet0;
 $516 = (_i64Add(($514|0),($515|0),($498|0),($499|0))|0);
 $517 = tempRet0;
 $518 = (_i64Add(($516|0),($517|0),($500|0),($501|0))|0);
 $519 = tempRet0;
 $520 = (_i64Add(($518|0),($519|0),($496|0),($497|0))|0);
 $521 = tempRet0;
 $522 = (_i64Add(($520|0),($521|0),($494|0),($495|0))|0);
 $523 = tempRet0;
 $524 = (_i64Add(($522|0),($523|0),($492|0),($493|0))|0);
 $525 = tempRet0;
 $526 = (___muldi3(($134|0),($135|0),($30|0),0)|0);
 $527 = tempRet0;
 $528 = (___muldi3(($130|0),0,($36|0),0)|0);
 $529 = tempRet0;
 $530 = (___muldi3(($124|0),0,($42|0),0)|0);
 $531 = tempRet0;
 $532 = (___muldi3(($118|0),0,($48|0),0)|0);
 $533 = tempRet0;
 $534 = (___muldi3(($114|0),0,($52|0),0)|0);
 $535 = tempRet0;
 $536 = (___muldi3(($108|0),0,($58|0),0)|0);
 $537 = tempRet0;
 $538 = (___muldi3(($102|0),0,($64|0),0)|0);
 $539 = tempRet0;
 $540 = (___muldi3(($96|0),0,($68|0),($69|0))|0);
 $541 = tempRet0;
 $542 = (___muldi3(($134|0),($135|0),($36|0),0)|0);
 $543 = tempRet0;
 $544 = (___muldi3(($130|0),0,($42|0),0)|0);
 $545 = tempRet0;
 $546 = (___muldi3(($124|0),0,($48|0),0)|0);
 $547 = tempRet0;
 $548 = (___muldi3(($118|0),0,($52|0),0)|0);
 $549 = tempRet0;
 $550 = (___muldi3(($114|0),0,($58|0),0)|0);
 $551 = tempRet0;
 $552 = (___muldi3(($108|0),0,($64|0),0)|0);
 $553 = tempRet0;
 $554 = (___muldi3(($102|0),0,($68|0),($69|0))|0);
 $555 = tempRet0;
 $556 = (_i64Add(($552|0),($553|0),($554|0),($555|0))|0);
 $557 = tempRet0;
 $558 = (_i64Add(($556|0),($557|0),($548|0),($549|0))|0);
 $559 = tempRet0;
 $560 = (_i64Add(($558|0),($559|0),($550|0),($551|0))|0);
 $561 = tempRet0;
 $562 = (_i64Add(($560|0),($561|0),($546|0),($547|0))|0);
 $563 = tempRet0;
 $564 = (_i64Add(($562|0),($563|0),($544|0),($545|0))|0);
 $565 = tempRet0;
 $566 = (_i64Add(($564|0),($565|0),($542|0),($543|0))|0);
 $567 = tempRet0;
 $568 = (___muldi3(($134|0),($135|0),($42|0),0)|0);
 $569 = tempRet0;
 $570 = (___muldi3(($130|0),0,($48|0),0)|0);
 $571 = tempRet0;
 $572 = (___muldi3(($124|0),0,($52|0),0)|0);
 $573 = tempRet0;
 $574 = (___muldi3(($118|0),0,($58|0),0)|0);
 $575 = tempRet0;
 $576 = (___muldi3(($114|0),0,($64|0),0)|0);
 $577 = tempRet0;
 $578 = (___muldi3(($108|0),0,($68|0),($69|0))|0);
 $579 = tempRet0;
 $580 = (___muldi3(($134|0),($135|0),($48|0),0)|0);
 $581 = tempRet0;
 $582 = (___muldi3(($130|0),0,($52|0),0)|0);
 $583 = tempRet0;
 $584 = (___muldi3(($124|0),0,($58|0),0)|0);
 $585 = tempRet0;
 $586 = (___muldi3(($118|0),0,($64|0),0)|0);
 $587 = tempRet0;
 $588 = (___muldi3(($114|0),0,($68|0),($69|0))|0);
 $589 = tempRet0;
 $590 = (_i64Add(($588|0),($589|0),($586|0),($587|0))|0);
 $591 = tempRet0;
 $592 = (_i64Add(($590|0),($591|0),($584|0),($585|0))|0);
 $593 = tempRet0;
 $594 = (_i64Add(($592|0),($593|0),($582|0),($583|0))|0);
 $595 = tempRet0;
 $596 = (_i64Add(($594|0),($595|0),($580|0),($581|0))|0);
 $597 = tempRet0;
 $598 = (___muldi3(($134|0),($135|0),($52|0),0)|0);
 $599 = tempRet0;
 $600 = (___muldi3(($130|0),0,($58|0),0)|0);
 $601 = tempRet0;
 $602 = (___muldi3(($124|0),0,($64|0),0)|0);
 $603 = tempRet0;
 $604 = (___muldi3(($118|0),0,($68|0),($69|0))|0);
 $605 = tempRet0;
 $606 = (___muldi3(($134|0),($135|0),($58|0),0)|0);
 $607 = tempRet0;
 $608 = (___muldi3(($130|0),0,($64|0),0)|0);
 $609 = tempRet0;
 $610 = (___muldi3(($124|0),0,($68|0),($69|0))|0);
 $611 = tempRet0;
 $612 = (_i64Add(($608|0),($609|0),($610|0),($611|0))|0);
 $613 = tempRet0;
 $614 = (_i64Add(($612|0),($613|0),($606|0),($607|0))|0);
 $615 = tempRet0;
 $616 = (___muldi3(($134|0),($135|0),($64|0),0)|0);
 $617 = tempRet0;
 $618 = (___muldi3(($130|0),0,($68|0),($69|0))|0);
 $619 = tempRet0;
 $620 = (_i64Add(($616|0),($617|0),($618|0),($619|0))|0);
 $621 = tempRet0;
 $622 = (___muldi3(($134|0),($135|0),($68|0),($69|0))|0);
 $623 = tempRet0;
 $624 = (_i64Add(($204|0),($205|0),1048576,0)|0);
 $625 = tempRet0;
 $626 = (_bitshift64Lshr(($624|0),($625|0),21)|0);
 $627 = tempRet0;
 $628 = (_i64Add(($206|0),($207|0),($208|0),($209|0))|0);
 $629 = tempRet0;
 $630 = (_i64Add(($628|0),($629|0),($144|0),0)|0);
 $631 = tempRet0;
 $632 = (_i64Add(($630|0),($631|0),($626|0),($627|0))|0);
 $633 = tempRet0;
 $634 = (_bitshift64Shl(($626|0),($627|0),21)|0);
 $635 = tempRet0;
 $636 = (_i64Subtract(($204|0),($205|0),($634|0),($635|0))|0);
 $637 = tempRet0;
 $638 = (_i64Add(($220|0),($221|0),1048576,0)|0);
 $639 = tempRet0;
 $640 = (_bitshift64Lshr(($638|0),($639|0),21)|0);
 $641 = tempRet0;
 $642 = (_i64Add(($226|0),($227|0),($228|0),($229|0))|0);
 $643 = tempRet0;
 $644 = (_i64Add(($642|0),($643|0),($224|0),($225|0))|0);
 $645 = tempRet0;
 $646 = (_i64Add(($644|0),($645|0),($222|0),($223|0))|0);
 $647 = tempRet0;
 $648 = (_i64Add(($646|0),($647|0),($156|0),0)|0);
 $649 = tempRet0;
 $650 = (_i64Add(($648|0),($649|0),($640|0),($641|0))|0);
 $651 = tempRet0;
 $652 = (_bitshift64Shl(($640|0),($641|0),21)|0);
 $653 = tempRet0;
 $654 = (_i64Add(($248|0),($249|0),1048576,0)|0);
 $655 = tempRet0;
 $656 = (_bitshift64Ashr(($654|0),($655|0),21)|0);
 $657 = tempRet0;
 $658 = (_i64Add(($258|0),($259|0),($260|0),($261|0))|0);
 $659 = tempRet0;
 $660 = (_i64Add(($658|0),($659|0),($256|0),($257|0))|0);
 $661 = tempRet0;
 $662 = (_i64Add(($660|0),($661|0),($254|0),($255|0))|0);
 $663 = tempRet0;
 $664 = (_i64Add(($662|0),($663|0),($252|0),($253|0))|0);
 $665 = tempRet0;
 $666 = (_i64Add(($664|0),($665|0),($250|0),($251|0))|0);
 $667 = tempRet0;
 $668 = (_i64Add(($666|0),($667|0),($168|0),0)|0);
 $669 = tempRet0;
 $670 = (_i64Add(($668|0),($669|0),($656|0),($657|0))|0);
 $671 = tempRet0;
 $672 = (_bitshift64Shl(($656|0),($657|0),21)|0);
 $673 = tempRet0;
 $674 = (_i64Add(($288|0),($289|0),1048576,0)|0);
 $675 = tempRet0;
 $676 = (_bitshift64Ashr(($674|0),($675|0),21)|0);
 $677 = tempRet0;
 $678 = (_i64Add(($302|0),($303|0),($304|0),($305|0))|0);
 $679 = tempRet0;
 $680 = (_i64Add(($678|0),($679|0),($300|0),($301|0))|0);
 $681 = tempRet0;
 $682 = (_i64Add(($680|0),($681|0),($298|0),($299|0))|0);
 $683 = tempRet0;
 $684 = (_i64Add(($682|0),($683|0),($296|0),($297|0))|0);
 $685 = tempRet0;
 $686 = (_i64Add(($684|0),($685|0),($294|0),($295|0))|0);
 $687 = tempRet0;
 $688 = (_i64Add(($686|0),($687|0),($292|0),($293|0))|0);
 $689 = tempRet0;
 $690 = (_i64Add(($688|0),($689|0),($290|0),($291|0))|0);
 $691 = tempRet0;
 $692 = (_i64Add(($690|0),($691|0),($180|0),0)|0);
 $693 = tempRet0;
 $694 = (_i64Add(($692|0),($693|0),($676|0),($677|0))|0);
 $695 = tempRet0;
 $696 = (_bitshift64Shl(($676|0),($677|0),21)|0);
 $697 = tempRet0;
 $698 = (_i64Add(($340|0),($341|0),1048576,0)|0);
 $699 = tempRet0;
 $700 = (_bitshift64Ashr(($698|0),($699|0),21)|0);
 $701 = tempRet0;
 $702 = (_i64Add(($358|0),($359|0),($360|0),($361|0))|0);
 $703 = tempRet0;
 $704 = (_i64Add(($702|0),($703|0),($356|0),($357|0))|0);
 $705 = tempRet0;
 $706 = (_i64Add(($704|0),($705|0),($354|0),($355|0))|0);
 $707 = tempRet0;
 $708 = (_i64Add(($706|0),($707|0),($352|0),($353|0))|0);
 $709 = tempRet0;
 $710 = (_i64Add(($708|0),($709|0),($350|0),($351|0))|0);
 $711 = tempRet0;
 $712 = (_i64Add(($710|0),($711|0),($348|0),($349|0))|0);
 $713 = tempRet0;
 $714 = (_i64Add(($712|0),($713|0),($344|0),($345|0))|0);
 $715 = tempRet0;
 $716 = (_i64Add(($714|0),($715|0),($346|0),($347|0))|0);
 $717 = tempRet0;
 $718 = (_i64Add(($716|0),($717|0),($342|0),($343|0))|0);
 $719 = tempRet0;
 $720 = (_i64Add(($718|0),($719|0),($190|0),0)|0);
 $721 = tempRet0;
 $722 = (_i64Add(($720|0),($721|0),($700|0),($701|0))|0);
 $723 = tempRet0;
 $724 = (_bitshift64Shl(($700|0),($701|0),21)|0);
 $725 = tempRet0;
 $726 = (_i64Add(($404|0),($405|0),1048576,0)|0);
 $727 = tempRet0;
 $728 = (_bitshift64Ashr(($726|0),($727|0),21)|0);
 $729 = tempRet0;
 $730 = (_i64Add(($426|0),($427|0),($428|0),($429|0))|0);
 $731 = tempRet0;
 $732 = (_i64Add(($730|0),($731|0),($424|0),($425|0))|0);
 $733 = tempRet0;
 $734 = (_i64Add(($732|0),($733|0),($422|0),($423|0))|0);
 $735 = tempRet0;
 $736 = (_i64Add(($734|0),($735|0),($420|0),($421|0))|0);
 $737 = tempRet0;
 $738 = (_i64Add(($736|0),($737|0),($418|0),($419|0))|0);
 $739 = tempRet0;
 $740 = (_i64Add(($738|0),($739|0),($416|0),($417|0))|0);
 $741 = tempRet0;
 $742 = (_i64Add(($740|0),($741|0),($412|0),($413|0))|0);
 $743 = tempRet0;
 $744 = (_i64Add(($742|0),($743|0),($414|0),($415|0))|0);
 $745 = tempRet0;
 $746 = (_i64Add(($744|0),($745|0),($410|0),($411|0))|0);
 $747 = tempRet0;
 $748 = (_i64Add(($746|0),($747|0),($406|0),($407|0))|0);
 $749 = tempRet0;
 $750 = (_i64Add(($748|0),($749|0),($408|0),($409|0))|0);
 $751 = tempRet0;
 $752 = (_i64Add(($750|0),($751|0),($200|0),($201|0))|0);
 $753 = tempRet0;
 $754 = (_i64Add(($752|0),($753|0),($728|0),($729|0))|0);
 $755 = tempRet0;
 $756 = (_bitshift64Shl(($728|0),($729|0),21)|0);
 $757 = tempRet0;
 $758 = (_i64Add(($470|0),($471|0),1048576,0)|0);
 $759 = tempRet0;
 $760 = (_bitshift64Ashr(($758|0),($759|0),21)|0);
 $761 = tempRet0;
 $762 = (_i64Add(($488|0),($489|0),($490|0),($491|0))|0);
 $763 = tempRet0;
 $764 = (_i64Add(($762|0),($763|0),($486|0),($487|0))|0);
 $765 = tempRet0;
 $766 = (_i64Add(($764|0),($765|0),($484|0),($485|0))|0);
 $767 = tempRet0;
 $768 = (_i64Add(($766|0),($767|0),($482|0),($483|0))|0);
 $769 = tempRet0;
 $770 = (_i64Add(($768|0),($769|0),($478|0),($479|0))|0);
 $771 = tempRet0;
 $772 = (_i64Add(($770|0),($771|0),($480|0),($481|0))|0);
 $773 = tempRet0;
 $774 = (_i64Add(($772|0),($773|0),($476|0),($477|0))|0);
 $775 = tempRet0;
 $776 = (_i64Add(($774|0),($775|0),($474|0),($475|0))|0);
 $777 = tempRet0;
 $778 = (_i64Add(($776|0),($777|0),($472|0),($473|0))|0);
 $779 = tempRet0;
 $780 = (_i64Add(($778|0),($779|0),($760|0),($761|0))|0);
 $781 = tempRet0;
 $782 = (_bitshift64Shl(($760|0),($761|0),21)|0);
 $783 = tempRet0;
 $784 = (_i64Add(($524|0),($525|0),1048576,0)|0);
 $785 = tempRet0;
 $786 = (_bitshift64Ashr(($784|0),($785|0),21)|0);
 $787 = tempRet0;
 $788 = (_i64Add(($538|0),($539|0),($540|0),($541|0))|0);
 $789 = tempRet0;
 $790 = (_i64Add(($788|0),($789|0),($536|0),($537|0))|0);
 $791 = tempRet0;
 $792 = (_i64Add(($790|0),($791|0),($532|0),($533|0))|0);
 $793 = tempRet0;
 $794 = (_i64Add(($792|0),($793|0),($534|0),($535|0))|0);
 $795 = tempRet0;
 $796 = (_i64Add(($794|0),($795|0),($530|0),($531|0))|0);
 $797 = tempRet0;
 $798 = (_i64Add(($796|0),($797|0),($528|0),($529|0))|0);
 $799 = tempRet0;
 $800 = (_i64Add(($798|0),($799|0),($526|0),($527|0))|0);
 $801 = tempRet0;
 $802 = (_i64Add(($800|0),($801|0),($786|0),($787|0))|0);
 $803 = tempRet0;
 $804 = (_bitshift64Shl(($786|0),($787|0),21)|0);
 $805 = tempRet0;
 $806 = (_i64Add(($566|0),($567|0),1048576,0)|0);
 $807 = tempRet0;
 $808 = (_bitshift64Ashr(($806|0),($807|0),21)|0);
 $809 = tempRet0;
 $810 = (_i64Add(($574|0),($575|0),($578|0),($579|0))|0);
 $811 = tempRet0;
 $812 = (_i64Add(($810|0),($811|0),($576|0),($577|0))|0);
 $813 = tempRet0;
 $814 = (_i64Add(($812|0),($813|0),($572|0),($573|0))|0);
 $815 = tempRet0;
 $816 = (_i64Add(($814|0),($815|0),($570|0),($571|0))|0);
 $817 = tempRet0;
 $818 = (_i64Add(($816|0),($817|0),($568|0),($569|0))|0);
 $819 = tempRet0;
 $820 = (_i64Add(($818|0),($819|0),($808|0),($809|0))|0);
 $821 = tempRet0;
 $822 = (_bitshift64Shl(($808|0),($809|0),21)|0);
 $823 = tempRet0;
 $824 = (_i64Add(($596|0),($597|0),1048576,0)|0);
 $825 = tempRet0;
 $826 = (_bitshift64Ashr(($824|0),($825|0),21)|0);
 $827 = tempRet0;
 $828 = (_i64Add(($602|0),($603|0),($604|0),($605|0))|0);
 $829 = tempRet0;
 $830 = (_i64Add(($828|0),($829|0),($600|0),($601|0))|0);
 $831 = tempRet0;
 $832 = (_i64Add(($830|0),($831|0),($598|0),($599|0))|0);
 $833 = tempRet0;
 $834 = (_i64Add(($832|0),($833|0),($826|0),($827|0))|0);
 $835 = tempRet0;
 $836 = (_bitshift64Shl(($826|0),($827|0),21)|0);
 $837 = tempRet0;
 $838 = (_i64Subtract(($596|0),($597|0),($836|0),($837|0))|0);
 $839 = tempRet0;
 $840 = (_i64Add(($614|0),($615|0),1048576,0)|0);
 $841 = tempRet0;
 $842 = (_bitshift64Lshr(($840|0),($841|0),21)|0);
 $843 = tempRet0;
 $844 = (_i64Add(($620|0),($621|0),($842|0),($843|0))|0);
 $845 = tempRet0;
 $846 = (_bitshift64Shl(($842|0),($843|0),21)|0);
 $847 = tempRet0;
 $848 = (_i64Subtract(($614|0),($615|0),($846|0),($847|0))|0);
 $849 = tempRet0;
 $850 = (_i64Add(($622|0),($623|0),1048576,0)|0);
 $851 = tempRet0;
 $852 = (_bitshift64Lshr(($850|0),($851|0),21)|0);
 $853 = tempRet0;
 $854 = (_bitshift64Shl(($852|0),($853|0),21)|0);
 $855 = tempRet0;
 $856 = (_i64Subtract(($622|0),($623|0),($854|0),($855|0))|0);
 $857 = tempRet0;
 $858 = (_i64Add(($632|0),($633|0),1048576,0)|0);
 $859 = tempRet0;
 $860 = (_bitshift64Lshr(($858|0),($859|0),21)|0);
 $861 = tempRet0;
 $862 = (_bitshift64Shl(($860|0),($861|0),21)|0);
 $863 = tempRet0;
 $864 = (_i64Subtract(($632|0),($633|0),($862|0),($863|0))|0);
 $865 = tempRet0;
 $866 = (_i64Add(($650|0),($651|0),1048576,0)|0);
 $867 = tempRet0;
 $868 = (_bitshift64Ashr(($866|0),($867|0),21)|0);
 $869 = tempRet0;
 $870 = (_bitshift64Shl(($868|0),($869|0),21)|0);
 $871 = tempRet0;
 $872 = (_i64Subtract(($650|0),($651|0),($870|0),($871|0))|0);
 $873 = tempRet0;
 $874 = (_i64Add(($670|0),($671|0),1048576,0)|0);
 $875 = tempRet0;
 $876 = (_bitshift64Ashr(($874|0),($875|0),21)|0);
 $877 = tempRet0;
 $878 = (_bitshift64Shl(($876|0),($877|0),21)|0);
 $879 = tempRet0;
 $880 = (_i64Subtract(($670|0),($671|0),($878|0),($879|0))|0);
 $881 = tempRet0;
 $882 = (_i64Add(($694|0),($695|0),1048576,0)|0);
 $883 = tempRet0;
 $884 = (_bitshift64Ashr(($882|0),($883|0),21)|0);
 $885 = tempRet0;
 $886 = (_bitshift64Shl(($884|0),($885|0),21)|0);
 $887 = tempRet0;
 $888 = (_i64Add(($722|0),($723|0),1048576,0)|0);
 $889 = tempRet0;
 $890 = (_bitshift64Ashr(($888|0),($889|0),21)|0);
 $891 = tempRet0;
 $892 = (_bitshift64Shl(($890|0),($891|0),21)|0);
 $893 = tempRet0;
 $894 = (_i64Add(($754|0),($755|0),1048576,0)|0);
 $895 = tempRet0;
 $896 = (_bitshift64Ashr(($894|0),($895|0),21)|0);
 $897 = tempRet0;
 $898 = (_bitshift64Shl(($896|0),($897|0),21)|0);
 $899 = tempRet0;
 $900 = (_i64Add(($780|0),($781|0),1048576,0)|0);
 $901 = tempRet0;
 $902 = (_bitshift64Ashr(($900|0),($901|0),21)|0);
 $903 = tempRet0;
 $904 = (_bitshift64Shl(($902|0),($903|0),21)|0);
 $905 = tempRet0;
 $906 = (_i64Add(($802|0),($803|0),1048576,0)|0);
 $907 = tempRet0;
 $908 = (_bitshift64Ashr(($906|0),($907|0),21)|0);
 $909 = tempRet0;
 $910 = (_bitshift64Shl(($908|0),($909|0),21)|0);
 $911 = tempRet0;
 $912 = (_i64Add(($820|0),($821|0),1048576,0)|0);
 $913 = tempRet0;
 $914 = (_bitshift64Ashr(($912|0),($913|0),21)|0);
 $915 = tempRet0;
 $916 = (_i64Add(($914|0),($915|0),($838|0),($839|0))|0);
 $917 = tempRet0;
 $918 = (_bitshift64Shl(($914|0),($915|0),21)|0);
 $919 = tempRet0;
 $920 = (_i64Subtract(($820|0),($821|0),($918|0),($919|0))|0);
 $921 = tempRet0;
 $922 = (_i64Add(($834|0),($835|0),1048576,0)|0);
 $923 = tempRet0;
 $924 = (_bitshift64Ashr(($922|0),($923|0),21)|0);
 $925 = tempRet0;
 $926 = (_i64Add(($924|0),($925|0),($848|0),($849|0))|0);
 $927 = tempRet0;
 $928 = (_bitshift64Shl(($924|0),($925|0),21)|0);
 $929 = tempRet0;
 $930 = (_i64Subtract(($834|0),($835|0),($928|0),($929|0))|0);
 $931 = tempRet0;
 $932 = (_i64Add(($844|0),($845|0),1048576,0)|0);
 $933 = tempRet0;
 $934 = (_bitshift64Lshr(($932|0),($933|0),21)|0);
 $935 = tempRet0;
 $936 = (_i64Add(($934|0),($935|0),($856|0),($857|0))|0);
 $937 = tempRet0;
 $938 = (_bitshift64Shl(($934|0),($935|0),21)|0);
 $939 = tempRet0;
 $940 = (_i64Subtract(($844|0),($845|0),($938|0),($939|0))|0);
 $941 = tempRet0;
 $942 = (___muldi3(($852|0),($853|0),666643,0)|0);
 $943 = tempRet0;
 $944 = (___muldi3(($852|0),($853|0),470296,0)|0);
 $945 = tempRet0;
 $946 = (___muldi3(($852|0),($853|0),654183,0)|0);
 $947 = tempRet0;
 $948 = (___muldi3(($852|0),($853|0),-997805,-1)|0);
 $949 = tempRet0;
 $950 = (___muldi3(($852|0),($853|0),136657,0)|0);
 $951 = tempRet0;
 $952 = (___muldi3(($852|0),($853|0),-683901,-1)|0);
 $953 = tempRet0;
 $954 = (_i64Add(($566|0),($567|0),($952|0),($953|0))|0);
 $955 = tempRet0;
 $956 = (_i64Subtract(($954|0),($955|0),($822|0),($823|0))|0);
 $957 = tempRet0;
 $958 = (_i64Add(($956|0),($957|0),($908|0),($909|0))|0);
 $959 = tempRet0;
 $960 = (___muldi3(($936|0),($937|0),666643,0)|0);
 $961 = tempRet0;
 $962 = (___muldi3(($936|0),($937|0),470296,0)|0);
 $963 = tempRet0;
 $964 = (___muldi3(($936|0),($937|0),654183,0)|0);
 $965 = tempRet0;
 $966 = (___muldi3(($936|0),($937|0),-997805,-1)|0);
 $967 = tempRet0;
 $968 = (___muldi3(($936|0),($937|0),136657,0)|0);
 $969 = tempRet0;
 $970 = (___muldi3(($936|0),($937|0),-683901,-1)|0);
 $971 = tempRet0;
 $972 = (___muldi3(($940|0),($941|0),666643,0)|0);
 $973 = tempRet0;
 $974 = (___muldi3(($940|0),($941|0),470296,0)|0);
 $975 = tempRet0;
 $976 = (___muldi3(($940|0),($941|0),654183,0)|0);
 $977 = tempRet0;
 $978 = (___muldi3(($940|0),($941|0),-997805,-1)|0);
 $979 = tempRet0;
 $980 = (___muldi3(($940|0),($941|0),136657,0)|0);
 $981 = tempRet0;
 $982 = (___muldi3(($940|0),($941|0),-683901,-1)|0);
 $983 = tempRet0;
 $984 = (_i64Add(($524|0),($525|0),($948|0),($949|0))|0);
 $985 = tempRet0;
 $986 = (_i64Add(($984|0),($985|0),($968|0),($969|0))|0);
 $987 = tempRet0;
 $988 = (_i64Add(($986|0),($987|0),($982|0),($983|0))|0);
 $989 = tempRet0;
 $990 = (_i64Subtract(($988|0),($989|0),($804|0),($805|0))|0);
 $991 = tempRet0;
 $992 = (_i64Add(($990|0),($991|0),($902|0),($903|0))|0);
 $993 = tempRet0;
 $994 = (___muldi3(($926|0),($927|0),666643,0)|0);
 $995 = tempRet0;
 $996 = (___muldi3(($926|0),($927|0),470296,0)|0);
 $997 = tempRet0;
 $998 = (___muldi3(($926|0),($927|0),654183,0)|0);
 $999 = tempRet0;
 $1000 = (___muldi3(($926|0),($927|0),-997805,-1)|0);
 $1001 = tempRet0;
 $1002 = (___muldi3(($926|0),($927|0),136657,0)|0);
 $1003 = tempRet0;
 $1004 = (___muldi3(($926|0),($927|0),-683901,-1)|0);
 $1005 = tempRet0;
 $1006 = (___muldi3(($930|0),($931|0),666643,0)|0);
 $1007 = tempRet0;
 $1008 = (___muldi3(($930|0),($931|0),470296,0)|0);
 $1009 = tempRet0;
 $1010 = (___muldi3(($930|0),($931|0),654183,0)|0);
 $1011 = tempRet0;
 $1012 = (___muldi3(($930|0),($931|0),-997805,-1)|0);
 $1013 = tempRet0;
 $1014 = (___muldi3(($930|0),($931|0),136657,0)|0);
 $1015 = tempRet0;
 $1016 = (___muldi3(($930|0),($931|0),-683901,-1)|0);
 $1017 = tempRet0;
 $1018 = (_i64Add(($964|0),($965|0),($944|0),($945|0))|0);
 $1019 = tempRet0;
 $1020 = (_i64Add(($1018|0),($1019|0),($470|0),($471|0))|0);
 $1021 = tempRet0;
 $1022 = (_i64Add(($1020|0),($1021|0),($978|0),($979|0))|0);
 $1023 = tempRet0;
 $1024 = (_i64Add(($1022|0),($1023|0),($1002|0),($1003|0))|0);
 $1025 = tempRet0;
 $1026 = (_i64Add(($1024|0),($1025|0),($1016|0),($1017|0))|0);
 $1027 = tempRet0;
 $1028 = (_i64Subtract(($1026|0),($1027|0),($782|0),($783|0))|0);
 $1029 = tempRet0;
 $1030 = (_i64Add(($1028|0),($1029|0),($896|0),($897|0))|0);
 $1031 = tempRet0;
 $1032 = (___muldi3(($916|0),($917|0),666643,0)|0);
 $1033 = tempRet0;
 $1034 = (_i64Add(($288|0),($289|0),($1032|0),($1033|0))|0);
 $1035 = tempRet0;
 $1036 = (_i64Add(($1034|0),($1035|0),($876|0),($877|0))|0);
 $1037 = tempRet0;
 $1038 = (_i64Subtract(($1036|0),($1037|0),($696|0),($697|0))|0);
 $1039 = tempRet0;
 $1040 = (___muldi3(($916|0),($917|0),470296,0)|0);
 $1041 = tempRet0;
 $1042 = (___muldi3(($916|0),($917|0),654183,0)|0);
 $1043 = tempRet0;
 $1044 = (_i64Add(($1008|0),($1009|0),($994|0),($995|0))|0);
 $1045 = tempRet0;
 $1046 = (_i64Add(($1044|0),($1045|0),($1042|0),($1043|0))|0);
 $1047 = tempRet0;
 $1048 = (_i64Add(($1046|0),($1047|0),($340|0),($341|0))|0);
 $1049 = tempRet0;
 $1050 = (_i64Add(($1048|0),($1049|0),($884|0),($885|0))|0);
 $1051 = tempRet0;
 $1052 = (_i64Subtract(($1050|0),($1051|0),($724|0),($725|0))|0);
 $1053 = tempRet0;
 $1054 = (___muldi3(($916|0),($917|0),-997805,-1)|0);
 $1055 = tempRet0;
 $1056 = (___muldi3(($916|0),($917|0),136657,0)|0);
 $1057 = tempRet0;
 $1058 = (_i64Add(($974|0),($975|0),($960|0),($961|0))|0);
 $1059 = tempRet0;
 $1060 = (_i64Add(($1058|0),($1059|0),($998|0),($999|0))|0);
 $1061 = tempRet0;
 $1062 = (_i64Add(($1060|0),($1061|0),($1012|0),($1013|0))|0);
 $1063 = tempRet0;
 $1064 = (_i64Add(($1062|0),($1063|0),($1056|0),($1057|0))|0);
 $1065 = tempRet0;
 $1066 = (_i64Add(($1064|0),($1065|0),($404|0),($405|0))|0);
 $1067 = tempRet0;
 $1068 = (_i64Add(($1066|0),($1067|0),($890|0),($891|0))|0);
 $1069 = tempRet0;
 $1070 = (_i64Subtract(($1068|0),($1069|0),($756|0),($757|0))|0);
 $1071 = tempRet0;
 $1072 = (___muldi3(($916|0),($917|0),-683901,-1)|0);
 $1073 = tempRet0;
 $1074 = (_i64Add(($1038|0),($1039|0),1048576,0)|0);
 $1075 = tempRet0;
 $1076 = (_bitshift64Ashr(($1074|0),($1075|0),21)|0);
 $1077 = tempRet0;
 $1078 = (_i64Add(($1040|0),($1041|0),($1006|0),($1007|0))|0);
 $1079 = tempRet0;
 $1080 = (_i64Add(($1078|0),($1079|0),($694|0),($695|0))|0);
 $1081 = tempRet0;
 $1082 = (_i64Subtract(($1080|0),($1081|0),($886|0),($887|0))|0);
 $1083 = tempRet0;
 $1084 = (_i64Add(($1082|0),($1083|0),($1076|0),($1077|0))|0);
 $1085 = tempRet0;
 $1086 = (_bitshift64Shl(($1076|0),($1077|0),21)|0);
 $1087 = tempRet0;
 $1088 = (_i64Add(($1052|0),($1053|0),1048576,0)|0);
 $1089 = tempRet0;
 $1090 = (_bitshift64Ashr(($1088|0),($1089|0),21)|0);
 $1091 = tempRet0;
 $1092 = (_i64Add(($996|0),($997|0),($972|0),($973|0))|0);
 $1093 = tempRet0;
 $1094 = (_i64Add(($1092|0),($1093|0),($1010|0),($1011|0))|0);
 $1095 = tempRet0;
 $1096 = (_i64Add(($1094|0),($1095|0),($1054|0),($1055|0))|0);
 $1097 = tempRet0;
 $1098 = (_i64Add(($1096|0),($1097|0),($722|0),($723|0))|0);
 $1099 = tempRet0;
 $1100 = (_i64Subtract(($1098|0),($1099|0),($892|0),($893|0))|0);
 $1101 = tempRet0;
 $1102 = (_i64Add(($1100|0),($1101|0),($1090|0),($1091|0))|0);
 $1103 = tempRet0;
 $1104 = (_bitshift64Shl(($1090|0),($1091|0),21)|0);
 $1105 = tempRet0;
 $1106 = (_i64Add(($1070|0),($1071|0),1048576,0)|0);
 $1107 = tempRet0;
 $1108 = (_bitshift64Ashr(($1106|0),($1107|0),21)|0);
 $1109 = tempRet0;
 $1110 = (_i64Add(($962|0),($963|0),($942|0),($943|0))|0);
 $1111 = tempRet0;
 $1112 = (_i64Add(($1110|0),($1111|0),($976|0),($977|0))|0);
 $1113 = tempRet0;
 $1114 = (_i64Add(($1112|0),($1113|0),($1000|0),($1001|0))|0);
 $1115 = tempRet0;
 $1116 = (_i64Add(($1114|0),($1115|0),($1014|0),($1015|0))|0);
 $1117 = tempRet0;
 $1118 = (_i64Add(($1116|0),($1117|0),($1072|0),($1073|0))|0);
 $1119 = tempRet0;
 $1120 = (_i64Add(($1118|0),($1119|0),($754|0),($755|0))|0);
 $1121 = tempRet0;
 $1122 = (_i64Subtract(($1120|0),($1121|0),($898|0),($899|0))|0);
 $1123 = tempRet0;
 $1124 = (_i64Add(($1122|0),($1123|0),($1108|0),($1109|0))|0);
 $1125 = tempRet0;
 $1126 = (_bitshift64Shl(($1108|0),($1109|0),21)|0);
 $1127 = tempRet0;
 $1128 = (_i64Add(($1030|0),($1031|0),1048576,0)|0);
 $1129 = tempRet0;
 $1130 = (_bitshift64Ashr(($1128|0),($1129|0),21)|0);
 $1131 = tempRet0;
 $1132 = (_i64Add(($966|0),($967|0),($946|0),($947|0))|0);
 $1133 = tempRet0;
 $1134 = (_i64Add(($1132|0),($1133|0),($980|0),($981|0))|0);
 $1135 = tempRet0;
 $1136 = (_i64Add(($1134|0),($1135|0),($1004|0),($1005|0))|0);
 $1137 = tempRet0;
 $1138 = (_i64Add(($1136|0),($1137|0),($780|0),($781|0))|0);
 $1139 = tempRet0;
 $1140 = (_i64Subtract(($1138|0),($1139|0),($904|0),($905|0))|0);
 $1141 = tempRet0;
 $1142 = (_i64Add(($1140|0),($1141|0),($1130|0),($1131|0))|0);
 $1143 = tempRet0;
 $1144 = (_bitshift64Shl(($1130|0),($1131|0),21)|0);
 $1145 = tempRet0;
 $1146 = (_i64Subtract(($1030|0),($1031|0),($1144|0),($1145|0))|0);
 $1147 = tempRet0;
 $1148 = (_i64Add(($992|0),($993|0),1048576,0)|0);
 $1149 = tempRet0;
 $1150 = (_bitshift64Ashr(($1148|0),($1149|0),21)|0);
 $1151 = tempRet0;
 $1152 = (_i64Add(($970|0),($971|0),($950|0),($951|0))|0);
 $1153 = tempRet0;
 $1154 = (_i64Add(($1152|0),($1153|0),($802|0),($803|0))|0);
 $1155 = tempRet0;
 $1156 = (_i64Subtract(($1154|0),($1155|0),($910|0),($911|0))|0);
 $1157 = tempRet0;
 $1158 = (_i64Add(($1156|0),($1157|0),($1150|0),($1151|0))|0);
 $1159 = tempRet0;
 $1160 = (_bitshift64Shl(($1150|0),($1151|0),21)|0);
 $1161 = tempRet0;
 $1162 = (_i64Subtract(($992|0),($993|0),($1160|0),($1161|0))|0);
 $1163 = tempRet0;
 $1164 = (_i64Add(($958|0),($959|0),1048576,0)|0);
 $1165 = tempRet0;
 $1166 = (_bitshift64Ashr(($1164|0),($1165|0),21)|0);
 $1167 = tempRet0;
 $1168 = (_i64Add(($1166|0),($1167|0),($920|0),($921|0))|0);
 $1169 = tempRet0;
 $1170 = (_bitshift64Shl(($1166|0),($1167|0),21)|0);
 $1171 = tempRet0;
 $1172 = (_i64Subtract(($958|0),($959|0),($1170|0),($1171|0))|0);
 $1173 = tempRet0;
 $1174 = (_i64Add(($1084|0),($1085|0),1048576,0)|0);
 $1175 = tempRet0;
 $1176 = (_bitshift64Ashr(($1174|0),($1175|0),21)|0);
 $1177 = tempRet0;
 $1178 = (_bitshift64Shl(($1176|0),($1177|0),21)|0);
 $1179 = tempRet0;
 $1180 = (_i64Add(($1102|0),($1103|0),1048576,0)|0);
 $1181 = tempRet0;
 $1182 = (_bitshift64Ashr(($1180|0),($1181|0),21)|0);
 $1183 = tempRet0;
 $1184 = (_bitshift64Shl(($1182|0),($1183|0),21)|0);
 $1185 = tempRet0;
 $1186 = (_i64Add(($1124|0),($1125|0),1048576,0)|0);
 $1187 = tempRet0;
 $1188 = (_bitshift64Ashr(($1186|0),($1187|0),21)|0);
 $1189 = tempRet0;
 $1190 = (_i64Add(($1188|0),($1189|0),($1146|0),($1147|0))|0);
 $1191 = tempRet0;
 $1192 = (_bitshift64Shl(($1188|0),($1189|0),21)|0);
 $1193 = tempRet0;
 $1194 = (_i64Subtract(($1124|0),($1125|0),($1192|0),($1193|0))|0);
 $1195 = tempRet0;
 $1196 = (_i64Add(($1142|0),($1143|0),1048576,0)|0);
 $1197 = tempRet0;
 $1198 = (_bitshift64Ashr(($1196|0),($1197|0),21)|0);
 $1199 = tempRet0;
 $1200 = (_i64Add(($1198|0),($1199|0),($1162|0),($1163|0))|0);
 $1201 = tempRet0;
 $1202 = (_bitshift64Shl(($1198|0),($1199|0),21)|0);
 $1203 = tempRet0;
 $1204 = (_i64Subtract(($1142|0),($1143|0),($1202|0),($1203|0))|0);
 $1205 = tempRet0;
 $1206 = (_i64Add(($1158|0),($1159|0),1048576,0)|0);
 $1207 = tempRet0;
 $1208 = (_bitshift64Ashr(($1206|0),($1207|0),21)|0);
 $1209 = tempRet0;
 $1210 = (_i64Add(($1208|0),($1209|0),($1172|0),($1173|0))|0);
 $1211 = tempRet0;
 $1212 = (_bitshift64Shl(($1208|0),($1209|0),21)|0);
 $1213 = tempRet0;
 $1214 = (_i64Subtract(($1158|0),($1159|0),($1212|0),($1213|0))|0);
 $1215 = tempRet0;
 $1216 = (___muldi3(($1168|0),($1169|0),666643,0)|0);
 $1217 = tempRet0;
 $1218 = (_i64Add(($880|0),($881|0),($1216|0),($1217|0))|0);
 $1219 = tempRet0;
 $1220 = (___muldi3(($1168|0),($1169|0),470296,0)|0);
 $1221 = tempRet0;
 $1222 = (___muldi3(($1168|0),($1169|0),654183,0)|0);
 $1223 = tempRet0;
 $1224 = (___muldi3(($1168|0),($1169|0),-997805,-1)|0);
 $1225 = tempRet0;
 $1226 = (___muldi3(($1168|0),($1169|0),136657,0)|0);
 $1227 = tempRet0;
 $1228 = (___muldi3(($1168|0),($1169|0),-683901,-1)|0);
 $1229 = tempRet0;
 $1230 = (_i64Add(($1070|0),($1071|0),($1228|0),($1229|0))|0);
 $1231 = tempRet0;
 $1232 = (_i64Add(($1230|0),($1231|0),($1182|0),($1183|0))|0);
 $1233 = tempRet0;
 $1234 = (_i64Subtract(($1232|0),($1233|0),($1126|0),($1127|0))|0);
 $1235 = tempRet0;
 $1236 = (___muldi3(($1210|0),($1211|0),666643,0)|0);
 $1237 = tempRet0;
 $1238 = (___muldi3(($1210|0),($1211|0),470296,0)|0);
 $1239 = tempRet0;
 $1240 = (_i64Add(($1218|0),($1219|0),($1238|0),($1239|0))|0);
 $1241 = tempRet0;
 $1242 = (___muldi3(($1210|0),($1211|0),654183,0)|0);
 $1243 = tempRet0;
 $1244 = (___muldi3(($1210|0),($1211|0),-997805,-1)|0);
 $1245 = tempRet0;
 $1246 = (___muldi3(($1210|0),($1211|0),136657,0)|0);
 $1247 = tempRet0;
 $1248 = (___muldi3(($1210|0),($1211|0),-683901,-1)|0);
 $1249 = tempRet0;
 $1250 = (___muldi3(($1214|0),($1215|0),666643,0)|0);
 $1251 = tempRet0;
 $1252 = (_i64Add(($872|0),($873|0),($1250|0),($1251|0))|0);
 $1253 = tempRet0;
 $1254 = (___muldi3(($1214|0),($1215|0),470296,0)|0);
 $1255 = tempRet0;
 $1256 = (___muldi3(($1214|0),($1215|0),654183,0)|0);
 $1257 = tempRet0;
 $1258 = (_i64Add(($1240|0),($1241|0),($1256|0),($1257|0))|0);
 $1259 = tempRet0;
 $1260 = (___muldi3(($1214|0),($1215|0),-997805,-1)|0);
 $1261 = tempRet0;
 $1262 = (___muldi3(($1214|0),($1215|0),136657,0)|0);
 $1263 = tempRet0;
 $1264 = (___muldi3(($1214|0),($1215|0),-683901,-1)|0);
 $1265 = tempRet0;
 $1266 = (_i64Add(($1052|0),($1053|0),($1224|0),($1225|0))|0);
 $1267 = tempRet0;
 $1268 = (_i64Add(($1266|0),($1267|0),($1176|0),($1177|0))|0);
 $1269 = tempRet0;
 $1270 = (_i64Add(($1268|0),($1269|0),($1246|0),($1247|0))|0);
 $1271 = tempRet0;
 $1272 = (_i64Add(($1270|0),($1271|0),($1264|0),($1265|0))|0);
 $1273 = tempRet0;
 $1274 = (_i64Subtract(($1272|0),($1273|0),($1104|0),($1105|0))|0);
 $1275 = tempRet0;
 $1276 = (___muldi3(($1200|0),($1201|0),666643,0)|0);
 $1277 = tempRet0;
 $1278 = (___muldi3(($1200|0),($1201|0),470296,0)|0);
 $1279 = tempRet0;
 $1280 = (_i64Add(($1252|0),($1253|0),($1278|0),($1279|0))|0);
 $1281 = tempRet0;
 $1282 = (___muldi3(($1200|0),($1201|0),654183,0)|0);
 $1283 = tempRet0;
 $1284 = (___muldi3(($1200|0),($1201|0),-997805,-1)|0);
 $1285 = tempRet0;
 $1286 = (_i64Add(($1258|0),($1259|0),($1284|0),($1285|0))|0);
 $1287 = tempRet0;
 $1288 = (___muldi3(($1200|0),($1201|0),136657,0)|0);
 $1289 = tempRet0;
 $1290 = (___muldi3(($1200|0),($1201|0),-683901,-1)|0);
 $1291 = tempRet0;
 $1292 = (___muldi3(($1204|0),($1205|0),666643,0)|0);
 $1293 = tempRet0;
 $1294 = (___muldi3(($1204|0),($1205|0),470296,0)|0);
 $1295 = tempRet0;
 $1296 = (___muldi3(($1204|0),($1205|0),654183,0)|0);
 $1297 = tempRet0;
 $1298 = (___muldi3(($1204|0),($1205|0),-997805,-1)|0);
 $1299 = tempRet0;
 $1300 = (___muldi3(($1204|0),($1205|0),136657,0)|0);
 $1301 = tempRet0;
 $1302 = (___muldi3(($1204|0),($1205|0),-683901,-1)|0);
 $1303 = tempRet0;
 $1304 = (_i64Add(($1038|0),($1039|0),($1220|0),($1221|0))|0);
 $1305 = tempRet0;
 $1306 = (_i64Subtract(($1304|0),($1305|0),($1086|0),($1087|0))|0);
 $1307 = tempRet0;
 $1308 = (_i64Add(($1306|0),($1307|0),($1242|0),($1243|0))|0);
 $1309 = tempRet0;
 $1310 = (_i64Add(($1308|0),($1309|0),($1260|0),($1261|0))|0);
 $1311 = tempRet0;
 $1312 = (_i64Add(($1310|0),($1311|0),($1288|0),($1289|0))|0);
 $1313 = tempRet0;
 $1314 = (_i64Add(($1312|0),($1313|0),($1302|0),($1303|0))|0);
 $1315 = tempRet0;
 $1316 = (___muldi3(($1190|0),($1191|0),666643,0)|0);
 $1317 = tempRet0;
 $1318 = (_i64Add(($1316|0),($1317|0),($636|0),($637|0))|0);
 $1319 = tempRet0;
 $1320 = (___muldi3(($1190|0),($1191|0),470296,0)|0);
 $1321 = tempRet0;
 $1322 = (___muldi3(($1190|0),($1191|0),654183,0)|0);
 $1323 = tempRet0;
 $1324 = (_i64Add(($860|0),($861|0),($220|0),($221|0))|0);
 $1325 = tempRet0;
 $1326 = (_i64Subtract(($1324|0),($1325|0),($652|0),($653|0))|0);
 $1327 = tempRet0;
 $1328 = (_i64Add(($1326|0),($1327|0),($1276|0),($1277|0))|0);
 $1329 = tempRet0;
 $1330 = (_i64Add(($1328|0),($1329|0),($1322|0),($1323|0))|0);
 $1331 = tempRet0;
 $1332 = (_i64Add(($1330|0),($1331|0),($1294|0),($1295|0))|0);
 $1333 = tempRet0;
 $1334 = (___muldi3(($1190|0),($1191|0),-997805,-1)|0);
 $1335 = tempRet0;
 $1336 = (___muldi3(($1190|0),($1191|0),136657,0)|0);
 $1337 = tempRet0;
 $1338 = (_i64Add(($868|0),($869|0),($248|0),($249|0))|0);
 $1339 = tempRet0;
 $1340 = (_i64Subtract(($1338|0),($1339|0),($672|0),($673|0))|0);
 $1341 = tempRet0;
 $1342 = (_i64Add(($1340|0),($1341|0),($1236|0),($1237|0))|0);
 $1343 = tempRet0;
 $1344 = (_i64Add(($1342|0),($1343|0),($1254|0),($1255|0))|0);
 $1345 = tempRet0;
 $1346 = (_i64Add(($1344|0),($1345|0),($1282|0),($1283|0))|0);
 $1347 = tempRet0;
 $1348 = (_i64Add(($1346|0),($1347|0),($1336|0),($1337|0))|0);
 $1349 = tempRet0;
 $1350 = (_i64Add(($1348|0),($1349|0),($1298|0),($1299|0))|0);
 $1351 = tempRet0;
 $1352 = (___muldi3(($1190|0),($1191|0),-683901,-1)|0);
 $1353 = tempRet0;
 $1354 = (_i64Add(($1318|0),($1319|0),1048576,0)|0);
 $1355 = tempRet0;
 $1356 = (_bitshift64Ashr(($1354|0),($1355|0),21)|0);
 $1357 = tempRet0;
 $1358 = (_i64Add(($864|0),($865|0),($1320|0),($1321|0))|0);
 $1359 = tempRet0;
 $1360 = (_i64Add(($1358|0),($1359|0),($1292|0),($1293|0))|0);
 $1361 = tempRet0;
 $1362 = (_i64Add(($1360|0),($1361|0),($1356|0),($1357|0))|0);
 $1363 = tempRet0;
 $1364 = (_bitshift64Shl(($1356|0),($1357|0),21)|0);
 $1365 = tempRet0;
 $1366 = (_i64Subtract(($1318|0),($1319|0),($1364|0),($1365|0))|0);
 $1367 = tempRet0;
 $1368 = (_i64Add(($1332|0),($1333|0),1048576,0)|0);
 $1369 = tempRet0;
 $1370 = (_bitshift64Ashr(($1368|0),($1369|0),21)|0);
 $1371 = tempRet0;
 $1372 = (_i64Add(($1280|0),($1281|0),($1334|0),($1335|0))|0);
 $1373 = tempRet0;
 $1374 = (_i64Add(($1372|0),($1373|0),($1296|0),($1297|0))|0);
 $1375 = tempRet0;
 $1376 = (_i64Add(($1374|0),($1375|0),($1370|0),($1371|0))|0);
 $1377 = tempRet0;
 $1378 = (_bitshift64Shl(($1370|0),($1371|0),21)|0);
 $1379 = tempRet0;
 $1380 = (_i64Add(($1350|0),($1351|0),1048576,0)|0);
 $1381 = tempRet0;
 $1382 = (_bitshift64Ashr(($1380|0),($1381|0),21)|0);
 $1383 = tempRet0;
 $1384 = (_i64Add(($1286|0),($1287|0),($1352|0),($1353|0))|0);
 $1385 = tempRet0;
 $1386 = (_i64Add(($1384|0),($1385|0),($1300|0),($1301|0))|0);
 $1387 = tempRet0;
 $1388 = (_i64Add(($1386|0),($1387|0),($1382|0),($1383|0))|0);
 $1389 = tempRet0;
 $1390 = (_bitshift64Shl(($1382|0),($1383|0),21)|0);
 $1391 = tempRet0;
 $1392 = (_i64Add(($1314|0),($1315|0),1048576,0)|0);
 $1393 = tempRet0;
 $1394 = (_bitshift64Ashr(($1392|0),($1393|0),21)|0);
 $1395 = tempRet0;
 $1396 = (_i64Add(($1084|0),($1085|0),($1222|0),($1223|0))|0);
 $1397 = tempRet0;
 $1398 = (_i64Add(($1396|0),($1397|0),($1244|0),($1245|0))|0);
 $1399 = tempRet0;
 $1400 = (_i64Subtract(($1398|0),($1399|0),($1178|0),($1179|0))|0);
 $1401 = tempRet0;
 $1402 = (_i64Add(($1400|0),($1401|0),($1262|0),($1263|0))|0);
 $1403 = tempRet0;
 $1404 = (_i64Add(($1402|0),($1403|0),($1290|0),($1291|0))|0);
 $1405 = tempRet0;
 $1406 = (_i64Add(($1404|0),($1405|0),($1394|0),($1395|0))|0);
 $1407 = tempRet0;
 $1408 = (_bitshift64Shl(($1394|0),($1395|0),21)|0);
 $1409 = tempRet0;
 $1410 = (_i64Subtract(($1314|0),($1315|0),($1408|0),($1409|0))|0);
 $1411 = tempRet0;
 $1412 = (_i64Add(($1274|0),($1275|0),1048576,0)|0);
 $1413 = tempRet0;
 $1414 = (_bitshift64Ashr(($1412|0),($1413|0),21)|0);
 $1415 = tempRet0;
 $1416 = (_i64Add(($1248|0),($1249|0),($1226|0),($1227|0))|0);
 $1417 = tempRet0;
 $1418 = (_i64Add(($1416|0),($1417|0),($1102|0),($1103|0))|0);
 $1419 = tempRet0;
 $1420 = (_i64Subtract(($1418|0),($1419|0),($1184|0),($1185|0))|0);
 $1421 = tempRet0;
 $1422 = (_i64Add(($1420|0),($1421|0),($1414|0),($1415|0))|0);
 $1423 = tempRet0;
 $1424 = (_bitshift64Shl(($1414|0),($1415|0),21)|0);
 $1425 = tempRet0;
 $1426 = (_i64Subtract(($1274|0),($1275|0),($1424|0),($1425|0))|0);
 $1427 = tempRet0;
 $1428 = (_i64Add(($1234|0),($1235|0),1048576,0)|0);
 $1429 = tempRet0;
 $1430 = (_bitshift64Ashr(($1428|0),($1429|0),21)|0);
 $1431 = tempRet0;
 $1432 = (_i64Add(($1194|0),($1195|0),($1430|0),($1431|0))|0);
 $1433 = tempRet0;
 $1434 = (_bitshift64Shl(($1430|0),($1431|0),21)|0);
 $1435 = tempRet0;
 $1436 = (_i64Add(($1362|0),($1363|0),1048576,0)|0);
 $1437 = tempRet0;
 $1438 = (_bitshift64Ashr(($1436|0),($1437|0),21)|0);
 $1439 = tempRet0;
 $1440 = (_bitshift64Shl(($1438|0),($1439|0),21)|0);
 $1441 = tempRet0;
 $1442 = (_i64Add(($1376|0),($1377|0),1048576,0)|0);
 $1443 = tempRet0;
 $1444 = (_bitshift64Ashr(($1442|0),($1443|0),21)|0);
 $1445 = tempRet0;
 $1446 = (_bitshift64Shl(($1444|0),($1445|0),21)|0);
 $1447 = tempRet0;
 $1448 = (_i64Add(($1388|0),($1389|0),1048576,0)|0);
 $1449 = tempRet0;
 $1450 = (_bitshift64Ashr(($1448|0),($1449|0),21)|0);
 $1451 = tempRet0;
 $1452 = (_i64Add(($1410|0),($1411|0),($1450|0),($1451|0))|0);
 $1453 = tempRet0;
 $1454 = (_bitshift64Shl(($1450|0),($1451|0),21)|0);
 $1455 = tempRet0;
 $1456 = (_i64Add(($1406|0),($1407|0),1048576,0)|0);
 $1457 = tempRet0;
 $1458 = (_bitshift64Ashr(($1456|0),($1457|0),21)|0);
 $1459 = tempRet0;
 $1460 = (_i64Add(($1426|0),($1427|0),($1458|0),($1459|0))|0);
 $1461 = tempRet0;
 $1462 = (_bitshift64Shl(($1458|0),($1459|0),21)|0);
 $1463 = tempRet0;
 $1464 = (_i64Subtract(($1406|0),($1407|0),($1462|0),($1463|0))|0);
 $1465 = tempRet0;
 $1466 = (_i64Add(($1422|0),($1423|0),1048576,0)|0);
 $1467 = tempRet0;
 $1468 = (_bitshift64Ashr(($1466|0),($1467|0),21)|0);
 $1469 = tempRet0;
 $1470 = (_bitshift64Shl(($1468|0),($1469|0),21)|0);
 $1471 = tempRet0;
 $1472 = (_i64Subtract(($1422|0),($1423|0),($1470|0),($1471|0))|0);
 $1473 = tempRet0;
 $1474 = (_i64Add(($1432|0),($1433|0),1048576,0)|0);
 $1475 = tempRet0;
 $1476 = (_bitshift64Ashr(($1474|0),($1475|0),21)|0);
 $1477 = tempRet0;
 $1478 = (_bitshift64Shl(($1476|0),($1477|0),21)|0);
 $1479 = tempRet0;
 $1480 = (_i64Subtract(($1432|0),($1433|0),($1478|0),($1479|0))|0);
 $1481 = tempRet0;
 $1482 = (___muldi3(($1476|0),($1477|0),666643,0)|0);
 $1483 = tempRet0;
 $1484 = (_i64Add(($1366|0),($1367|0),($1482|0),($1483|0))|0);
 $1485 = tempRet0;
 $1486 = (___muldi3(($1476|0),($1477|0),470296,0)|0);
 $1487 = tempRet0;
 $1488 = (___muldi3(($1476|0),($1477|0),654183,0)|0);
 $1489 = tempRet0;
 $1490 = (___muldi3(($1476|0),($1477|0),-997805,-1)|0);
 $1491 = tempRet0;
 $1492 = (___muldi3(($1476|0),($1477|0),136657,0)|0);
 $1493 = tempRet0;
 $1494 = (___muldi3(($1476|0),($1477|0),-683901,-1)|0);
 $1495 = tempRet0;
 $1496 = (_bitshift64Ashr(($1484|0),($1485|0),21)|0);
 $1497 = tempRet0;
 $1498 = (_i64Add(($1486|0),($1487|0),($1362|0),($1363|0))|0);
 $1499 = tempRet0;
 $1500 = (_i64Subtract(($1498|0),($1499|0),($1440|0),($1441|0))|0);
 $1501 = tempRet0;
 $1502 = (_i64Add(($1500|0),($1501|0),($1496|0),($1497|0))|0);
 $1503 = tempRet0;
 $1504 = (_bitshift64Shl(($1496|0),($1497|0),21)|0);
 $1505 = tempRet0;
 $1506 = (_i64Subtract(($1484|0),($1485|0),($1504|0),($1505|0))|0);
 $1507 = tempRet0;
 $1508 = (_bitshift64Ashr(($1502|0),($1503|0),21)|0);
 $1509 = tempRet0;
 $1510 = (_i64Add(($1488|0),($1489|0),($1332|0),($1333|0))|0);
 $1511 = tempRet0;
 $1512 = (_i64Subtract(($1510|0),($1511|0),($1378|0),($1379|0))|0);
 $1513 = tempRet0;
 $1514 = (_i64Add(($1512|0),($1513|0),($1438|0),($1439|0))|0);
 $1515 = tempRet0;
 $1516 = (_i64Add(($1514|0),($1515|0),($1508|0),($1509|0))|0);
 $1517 = tempRet0;
 $1518 = (_bitshift64Shl(($1508|0),($1509|0),21)|0);
 $1519 = tempRet0;
 $1520 = (_i64Subtract(($1502|0),($1503|0),($1518|0),($1519|0))|0);
 $1521 = tempRet0;
 $1522 = (_bitshift64Ashr(($1516|0),($1517|0),21)|0);
 $1523 = tempRet0;
 $1524 = (_i64Add(($1376|0),($1377|0),($1490|0),($1491|0))|0);
 $1525 = tempRet0;
 $1526 = (_i64Subtract(($1524|0),($1525|0),($1446|0),($1447|0))|0);
 $1527 = tempRet0;
 $1528 = (_i64Add(($1526|0),($1527|0),($1522|0),($1523|0))|0);
 $1529 = tempRet0;
 $1530 = (_bitshift64Shl(($1522|0),($1523|0),21)|0);
 $1531 = tempRet0;
 $1532 = (_i64Subtract(($1516|0),($1517|0),($1530|0),($1531|0))|0);
 $1533 = tempRet0;
 $1534 = (_bitshift64Ashr(($1528|0),($1529|0),21)|0);
 $1535 = tempRet0;
 $1536 = (_i64Add(($1492|0),($1493|0),($1350|0),($1351|0))|0);
 $1537 = tempRet0;
 $1538 = (_i64Subtract(($1536|0),($1537|0),($1390|0),($1391|0))|0);
 $1539 = tempRet0;
 $1540 = (_i64Add(($1538|0),($1539|0),($1444|0),($1445|0))|0);
 $1541 = tempRet0;
 $1542 = (_i64Add(($1540|0),($1541|0),($1534|0),($1535|0))|0);
 $1543 = tempRet0;
 $1544 = (_bitshift64Shl(($1534|0),($1535|0),21)|0);
 $1545 = tempRet0;
 $1546 = (_i64Subtract(($1528|0),($1529|0),($1544|0),($1545|0))|0);
 $1547 = tempRet0;
 $1548 = (_bitshift64Ashr(($1542|0),($1543|0),21)|0);
 $1549 = tempRet0;
 $1550 = (_i64Add(($1388|0),($1389|0),($1494|0),($1495|0))|0);
 $1551 = tempRet0;
 $1552 = (_i64Subtract(($1550|0),($1551|0),($1454|0),($1455|0))|0);
 $1553 = tempRet0;
 $1554 = (_i64Add(($1552|0),($1553|0),($1548|0),($1549|0))|0);
 $1555 = tempRet0;
 $1556 = (_bitshift64Shl(($1548|0),($1549|0),21)|0);
 $1557 = tempRet0;
 $1558 = (_i64Subtract(($1542|0),($1543|0),($1556|0),($1557|0))|0);
 $1559 = tempRet0;
 $1560 = (_bitshift64Ashr(($1554|0),($1555|0),21)|0);
 $1561 = tempRet0;
 $1562 = (_i64Add(($1452|0),($1453|0),($1560|0),($1561|0))|0);
 $1563 = tempRet0;
 $1564 = (_bitshift64Shl(($1560|0),($1561|0),21)|0);
 $1565 = tempRet0;
 $1566 = (_i64Subtract(($1554|0),($1555|0),($1564|0),($1565|0))|0);
 $1567 = tempRet0;
 $1568 = (_bitshift64Ashr(($1562|0),($1563|0),21)|0);
 $1569 = tempRet0;
 $1570 = (_i64Add(($1568|0),($1569|0),($1464|0),($1465|0))|0);
 $1571 = tempRet0;
 $1572 = (_bitshift64Shl(($1568|0),($1569|0),21)|0);
 $1573 = tempRet0;
 $1574 = (_i64Subtract(($1562|0),($1563|0),($1572|0),($1573|0))|0);
 $1575 = tempRet0;
 $1576 = (_bitshift64Ashr(($1570|0),($1571|0),21)|0);
 $1577 = tempRet0;
 $1578 = (_i64Add(($1460|0),($1461|0),($1576|0),($1577|0))|0);
 $1579 = tempRet0;
 $1580 = (_bitshift64Shl(($1576|0),($1577|0),21)|0);
 $1581 = tempRet0;
 $1582 = (_i64Subtract(($1570|0),($1571|0),($1580|0),($1581|0))|0);
 $1583 = tempRet0;
 $1584 = (_bitshift64Ashr(($1578|0),($1579|0),21)|0);
 $1585 = tempRet0;
 $1586 = (_i64Add(($1584|0),($1585|0),($1472|0),($1473|0))|0);
 $1587 = tempRet0;
 $1588 = (_bitshift64Shl(($1584|0),($1585|0),21)|0);
 $1589 = tempRet0;
 $1590 = (_i64Subtract(($1578|0),($1579|0),($1588|0),($1589|0))|0);
 $1591 = tempRet0;
 $1592 = (_bitshift64Ashr(($1586|0),($1587|0),21)|0);
 $1593 = tempRet0;
 $1594 = (_i64Add(($1468|0),($1469|0),($1234|0),($1235|0))|0);
 $1595 = tempRet0;
 $1596 = (_i64Subtract(($1594|0),($1595|0),($1434|0),($1435|0))|0);
 $1597 = tempRet0;
 $1598 = (_i64Add(($1596|0),($1597|0),($1592|0),($1593|0))|0);
 $1599 = tempRet0;
 $1600 = (_bitshift64Shl(($1592|0),($1593|0),21)|0);
 $1601 = tempRet0;
 $1602 = (_i64Subtract(($1586|0),($1587|0),($1600|0),($1601|0))|0);
 $1603 = tempRet0;
 $1604 = (_bitshift64Ashr(($1598|0),($1599|0),21)|0);
 $1605 = tempRet0;
 $1606 = (_i64Add(($1604|0),($1605|0),($1480|0),($1481|0))|0);
 $1607 = tempRet0;
 $1608 = (_bitshift64Shl(($1604|0),($1605|0),21)|0);
 $1609 = tempRet0;
 $1610 = (_i64Subtract(($1598|0),($1599|0),($1608|0),($1609|0))|0);
 $1611 = tempRet0;
 $1612 = (_bitshift64Ashr(($1606|0),($1607|0),21)|0);
 $1613 = tempRet0;
 $1614 = (_bitshift64Shl(($1612|0),($1613|0),21)|0);
 $1615 = tempRet0;
 $1616 = (_i64Subtract(($1606|0),($1607|0),($1614|0),($1615|0))|0);
 $1617 = tempRet0;
 $1618 = (___muldi3(($1612|0),($1613|0),666643,0)|0);
 $1619 = tempRet0;
 $1620 = (_i64Add(($1618|0),($1619|0),($1506|0),($1507|0))|0);
 $1621 = tempRet0;
 $1622 = (___muldi3(($1612|0),($1613|0),470296,0)|0);
 $1623 = tempRet0;
 $1624 = (_i64Add(($1520|0),($1521|0),($1622|0),($1623|0))|0);
 $1625 = tempRet0;
 $1626 = (___muldi3(($1612|0),($1613|0),654183,0)|0);
 $1627 = tempRet0;
 $1628 = (_i64Add(($1532|0),($1533|0),($1626|0),($1627|0))|0);
 $1629 = tempRet0;
 $1630 = (___muldi3(($1612|0),($1613|0),-997805,-1)|0);
 $1631 = tempRet0;
 $1632 = (_i64Add(($1546|0),($1547|0),($1630|0),($1631|0))|0);
 $1633 = tempRet0;
 $1634 = (___muldi3(($1612|0),($1613|0),136657,0)|0);
 $1635 = tempRet0;
 $1636 = (_i64Add(($1558|0),($1559|0),($1634|0),($1635|0))|0);
 $1637 = tempRet0;
 $1638 = (___muldi3(($1612|0),($1613|0),-683901,-1)|0);
 $1639 = tempRet0;
 $1640 = (_i64Add(($1566|0),($1567|0),($1638|0),($1639|0))|0);
 $1641 = tempRet0;
 $1642 = (_bitshift64Ashr(($1620|0),($1621|0),21)|0);
 $1643 = tempRet0;
 $1644 = (_i64Add(($1624|0),($1625|0),($1642|0),($1643|0))|0);
 $1645 = tempRet0;
 $1646 = (_bitshift64Shl(($1642|0),($1643|0),21)|0);
 $1647 = tempRet0;
 $1648 = (_i64Subtract(($1620|0),($1621|0),($1646|0),($1647|0))|0);
 $1649 = tempRet0;
 $1650 = (_bitshift64Ashr(($1644|0),($1645|0),21)|0);
 $1651 = tempRet0;
 $1652 = (_i64Add(($1628|0),($1629|0),($1650|0),($1651|0))|0);
 $1653 = tempRet0;
 $1654 = (_bitshift64Shl(($1650|0),($1651|0),21)|0);
 $1655 = tempRet0;
 $1656 = (_i64Subtract(($1644|0),($1645|0),($1654|0),($1655|0))|0);
 $1657 = tempRet0;
 $1658 = (_bitshift64Ashr(($1652|0),($1653|0),21)|0);
 $1659 = tempRet0;
 $1660 = (_i64Add(($1632|0),($1633|0),($1658|0),($1659|0))|0);
 $1661 = tempRet0;
 $1662 = (_bitshift64Shl(($1658|0),($1659|0),21)|0);
 $1663 = tempRet0;
 $1664 = (_i64Subtract(($1652|0),($1653|0),($1662|0),($1663|0))|0);
 $1665 = tempRet0;
 $1666 = (_bitshift64Ashr(($1660|0),($1661|0),21)|0);
 $1667 = tempRet0;
 $1668 = (_i64Add(($1636|0),($1637|0),($1666|0),($1667|0))|0);
 $1669 = tempRet0;
 $1670 = (_bitshift64Shl(($1666|0),($1667|0),21)|0);
 $1671 = tempRet0;
 $1672 = (_i64Subtract(($1660|0),($1661|0),($1670|0),($1671|0))|0);
 $1673 = tempRet0;
 $1674 = (_bitshift64Ashr(($1668|0),($1669|0),21)|0);
 $1675 = tempRet0;
 $1676 = (_i64Add(($1640|0),($1641|0),($1674|0),($1675|0))|0);
 $1677 = tempRet0;
 $1678 = (_bitshift64Shl(($1674|0),($1675|0),21)|0);
 $1679 = tempRet0;
 $1680 = (_i64Subtract(($1668|0),($1669|0),($1678|0),($1679|0))|0);
 $1681 = tempRet0;
 $1682 = (_bitshift64Ashr(($1676|0),($1677|0),21)|0);
 $1683 = tempRet0;
 $1684 = (_i64Add(($1682|0),($1683|0),($1574|0),($1575|0))|0);
 $1685 = tempRet0;
 $1686 = (_bitshift64Shl(($1682|0),($1683|0),21)|0);
 $1687 = tempRet0;
 $1688 = (_i64Subtract(($1676|0),($1677|0),($1686|0),($1687|0))|0);
 $1689 = tempRet0;
 $1690 = (_bitshift64Ashr(($1684|0),($1685|0),21)|0);
 $1691 = tempRet0;
 $1692 = (_i64Add(($1690|0),($1691|0),($1582|0),($1583|0))|0);
 $1693 = tempRet0;
 $1694 = (_bitshift64Shl(($1690|0),($1691|0),21)|0);
 $1695 = tempRet0;
 $1696 = (_i64Subtract(($1684|0),($1685|0),($1694|0),($1695|0))|0);
 $1697 = tempRet0;
 $1698 = (_bitshift64Ashr(($1692|0),($1693|0),21)|0);
 $1699 = tempRet0;
 $1700 = (_i64Add(($1698|0),($1699|0),($1590|0),($1591|0))|0);
 $1701 = tempRet0;
 $1702 = (_bitshift64Shl(($1698|0),($1699|0),21)|0);
 $1703 = tempRet0;
 $1704 = (_i64Subtract(($1692|0),($1693|0),($1702|0),($1703|0))|0);
 $1705 = tempRet0;
 $1706 = (_bitshift64Ashr(($1700|0),($1701|0),21)|0);
 $1707 = tempRet0;
 $1708 = (_i64Add(($1706|0),($1707|0),($1602|0),($1603|0))|0);
 $1709 = tempRet0;
 $1710 = (_bitshift64Shl(($1706|0),($1707|0),21)|0);
 $1711 = tempRet0;
 $1712 = (_i64Subtract(($1700|0),($1701|0),($1710|0),($1711|0))|0);
 $1713 = tempRet0;
 $1714 = (_bitshift64Ashr(($1708|0),($1709|0),21)|0);
 $1715 = tempRet0;
 $1716 = (_i64Add(($1714|0),($1715|0),($1610|0),($1611|0))|0);
 $1717 = tempRet0;
 $1718 = (_bitshift64Shl(($1714|0),($1715|0),21)|0);
 $1719 = tempRet0;
 $1720 = (_i64Subtract(($1708|0),($1709|0),($1718|0),($1719|0))|0);
 $1721 = tempRet0;
 $1722 = (_bitshift64Ashr(($1716|0),($1717|0),21)|0);
 $1723 = tempRet0;
 $1724 = (_i64Add(($1722|0),($1723|0),($1616|0),($1617|0))|0);
 $1725 = tempRet0;
 $1726 = (_bitshift64Shl(($1722|0),($1723|0),21)|0);
 $1727 = tempRet0;
 $1728 = (_i64Subtract(($1716|0),($1717|0),($1726|0),($1727|0))|0);
 $1729 = tempRet0;
 $1730 = $1648&255;
 HEAP8[$0>>0] = $1730;
 $1731 = (_bitshift64Lshr(($1648|0),($1649|0),8)|0);
 $1732 = tempRet0;
 $1733 = $1731&255;
 $1734 = ((($0)) + 1|0);
 HEAP8[$1734>>0] = $1733;
 $1735 = (_bitshift64Lshr(($1648|0),($1649|0),16)|0);
 $1736 = tempRet0;
 $1737 = (_bitshift64Shl(($1656|0),($1657|0),5)|0);
 $1738 = tempRet0;
 $1739 = $1737 | $1735;
 $1738 | $1736;
 $1740 = $1739&255;
 $1741 = ((($0)) + 2|0);
 HEAP8[$1741>>0] = $1740;
 $1742 = (_bitshift64Lshr(($1656|0),($1657|0),3)|0);
 $1743 = tempRet0;
 $1744 = $1742&255;
 $1745 = ((($0)) + 3|0);
 HEAP8[$1745>>0] = $1744;
 $1746 = (_bitshift64Lshr(($1656|0),($1657|0),11)|0);
 $1747 = tempRet0;
 $1748 = $1746&255;
 $1749 = ((($0)) + 4|0);
 HEAP8[$1749>>0] = $1748;
 $1750 = (_bitshift64Lshr(($1656|0),($1657|0),19)|0);
 $1751 = tempRet0;
 $1752 = (_bitshift64Shl(($1664|0),($1665|0),2)|0);
 $1753 = tempRet0;
 $1754 = $1752 | $1750;
 $1753 | $1751;
 $1755 = $1754&255;
 $1756 = ((($0)) + 5|0);
 HEAP8[$1756>>0] = $1755;
 $1757 = (_bitshift64Lshr(($1664|0),($1665|0),6)|0);
 $1758 = tempRet0;
 $1759 = $1757&255;
 $1760 = ((($0)) + 6|0);
 HEAP8[$1760>>0] = $1759;
 $1761 = (_bitshift64Lshr(($1664|0),($1665|0),14)|0);
 $1762 = tempRet0;
 $1763 = (_bitshift64Shl(($1672|0),($1673|0),7)|0);
 $1764 = tempRet0;
 $1765 = $1763 | $1761;
 $1764 | $1762;
 $1766 = $1765&255;
 $1767 = ((($0)) + 7|0);
 HEAP8[$1767>>0] = $1766;
 $1768 = (_bitshift64Lshr(($1672|0),($1673|0),1)|0);
 $1769 = tempRet0;
 $1770 = $1768&255;
 $1771 = ((($0)) + 8|0);
 HEAP8[$1771>>0] = $1770;
 $1772 = (_bitshift64Lshr(($1672|0),($1673|0),9)|0);
 $1773 = tempRet0;
 $1774 = $1772&255;
 $1775 = ((($0)) + 9|0);
 HEAP8[$1775>>0] = $1774;
 $1776 = (_bitshift64Lshr(($1672|0),($1673|0),17)|0);
 $1777 = tempRet0;
 $1778 = (_bitshift64Shl(($1680|0),($1681|0),4)|0);
 $1779 = tempRet0;
 $1780 = $1778 | $1776;
 $1779 | $1777;
 $1781 = $1780&255;
 $1782 = ((($0)) + 10|0);
 HEAP8[$1782>>0] = $1781;
 $1783 = (_bitshift64Lshr(($1680|0),($1681|0),4)|0);
 $1784 = tempRet0;
 $1785 = $1783&255;
 $1786 = ((($0)) + 11|0);
 HEAP8[$1786>>0] = $1785;
 $1787 = (_bitshift64Lshr(($1680|0),($1681|0),12)|0);
 $1788 = tempRet0;
 $1789 = $1787&255;
 $1790 = ((($0)) + 12|0);
 HEAP8[$1790>>0] = $1789;
 $1791 = (_bitshift64Lshr(($1680|0),($1681|0),20)|0);
 $1792 = tempRet0;
 $1793 = (_bitshift64Shl(($1688|0),($1689|0),1)|0);
 $1794 = tempRet0;
 $1795 = $1793 | $1791;
 $1794 | $1792;
 $1796 = $1795&255;
 $1797 = ((($0)) + 13|0);
 HEAP8[$1797>>0] = $1796;
 $1798 = (_bitshift64Lshr(($1688|0),($1689|0),7)|0);
 $1799 = tempRet0;
 $1800 = $1798&255;
 $1801 = ((($0)) + 14|0);
 HEAP8[$1801>>0] = $1800;
 $1802 = (_bitshift64Lshr(($1688|0),($1689|0),15)|0);
 $1803 = tempRet0;
 $1804 = (_bitshift64Shl(($1696|0),($1697|0),6)|0);
 $1805 = tempRet0;
 $1806 = $1804 | $1802;
 $1805 | $1803;
 $1807 = $1806&255;
 $1808 = ((($0)) + 15|0);
 HEAP8[$1808>>0] = $1807;
 $1809 = (_bitshift64Lshr(($1696|0),($1697|0),2)|0);
 $1810 = tempRet0;
 $1811 = $1809&255;
 $1812 = ((($0)) + 16|0);
 HEAP8[$1812>>0] = $1811;
 $1813 = (_bitshift64Lshr(($1696|0),($1697|0),10)|0);
 $1814 = tempRet0;
 $1815 = $1813&255;
 $1816 = ((($0)) + 17|0);
 HEAP8[$1816>>0] = $1815;
 $1817 = (_bitshift64Lshr(($1696|0),($1697|0),18)|0);
 $1818 = tempRet0;
 $1819 = (_bitshift64Shl(($1704|0),($1705|0),3)|0);
 $1820 = tempRet0;
 $1821 = $1819 | $1817;
 $1820 | $1818;
 $1822 = $1821&255;
 $1823 = ((($0)) + 18|0);
 HEAP8[$1823>>0] = $1822;
 $1824 = (_bitshift64Lshr(($1704|0),($1705|0),5)|0);
 $1825 = tempRet0;
 $1826 = $1824&255;
 $1827 = ((($0)) + 19|0);
 HEAP8[$1827>>0] = $1826;
 $1828 = (_bitshift64Lshr(($1704|0),($1705|0),13)|0);
 $1829 = tempRet0;
 $1830 = $1828&255;
 $1831 = ((($0)) + 20|0);
 HEAP8[$1831>>0] = $1830;
 $1832 = $1712&255;
 $1833 = ((($0)) + 21|0);
 HEAP8[$1833>>0] = $1832;
 $1834 = (_bitshift64Lshr(($1712|0),($1713|0),8)|0);
 $1835 = tempRet0;
 $1836 = $1834&255;
 $1837 = ((($0)) + 22|0);
 HEAP8[$1837>>0] = $1836;
 $1838 = (_bitshift64Lshr(($1712|0),($1713|0),16)|0);
 $1839 = tempRet0;
 $1840 = (_bitshift64Shl(($1720|0),($1721|0),5)|0);
 $1841 = tempRet0;
 $1842 = $1840 | $1838;
 $1841 | $1839;
 $1843 = $1842&255;
 $1844 = ((($0)) + 23|0);
 HEAP8[$1844>>0] = $1843;
 $1845 = (_bitshift64Lshr(($1720|0),($1721|0),3)|0);
 $1846 = tempRet0;
 $1847 = $1845&255;
 $1848 = ((($0)) + 24|0);
 HEAP8[$1848>>0] = $1847;
 $1849 = (_bitshift64Lshr(($1720|0),($1721|0),11)|0);
 $1850 = tempRet0;
 $1851 = $1849&255;
 $1852 = ((($0)) + 25|0);
 HEAP8[$1852>>0] = $1851;
 $1853 = (_bitshift64Lshr(($1720|0),($1721|0),19)|0);
 $1854 = tempRet0;
 $1855 = (_bitshift64Shl(($1728|0),($1729|0),2)|0);
 $1856 = tempRet0;
 $1857 = $1855 | $1853;
 $1856 | $1854;
 $1858 = $1857&255;
 $1859 = ((($0)) + 26|0);
 HEAP8[$1859>>0] = $1858;
 $1860 = (_bitshift64Lshr(($1728|0),($1729|0),6)|0);
 $1861 = tempRet0;
 $1862 = $1860&255;
 $1863 = ((($0)) + 27|0);
 HEAP8[$1863>>0] = $1862;
 $1864 = (_bitshift64Lshr(($1728|0),($1729|0),14)|0);
 $1865 = tempRet0;
 $1866 = (_bitshift64Shl(($1724|0),($1725|0),7)|0);
 $1867 = tempRet0;
 $1868 = $1864 | $1866;
 $1865 | $1867;
 $1869 = $1868&255;
 $1870 = ((($0)) + 28|0);
 HEAP8[$1870>>0] = $1869;
 $1871 = (_bitshift64Lshr(($1724|0),($1725|0),1)|0);
 $1872 = tempRet0;
 $1873 = $1871&255;
 $1874 = ((($0)) + 29|0);
 HEAP8[$1874>>0] = $1873;
 $1875 = (_bitshift64Lshr(($1724|0),($1725|0),9)|0);
 $1876 = tempRet0;
 $1877 = $1875&255;
 $1878 = ((($0)) + 30|0);
 HEAP8[$1878>>0] = $1877;
 $1879 = (_bitshift64Lshr(($1724|0),($1725|0),17)|0);
 $1880 = tempRet0;
 $1881 = $1879&255;
 $1882 = ((($0)) + 31|0);
 HEAP8[$1882>>0] = $1881;
 return;
}
function _load_3_47($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 tempRet0 = ($15);
 return ($14|0);
}
function _load_4_48($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 $16 = ((($0)) + 3|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17&255;
 $19 = (_bitshift64Shl(($18|0),0,24)|0);
 $20 = tempRet0;
 $21 = $14 | $19;
 $22 = $15 | $20;
 tempRet0 = ($22);
 return ($21|0);
}
function _crypto_sign_ed25519_ref10_sc_reduce($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0;
 var $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
 var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
 var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
 var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
 var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
 var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
 var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
 var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
 var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
 var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0;
 var $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0;
 var $997 = 0, $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_load_3_51($0)|0);
 $2 = tempRet0;
 $3 = $1 & 2097151;
 $4 = ((($0)) + 2|0);
 $5 = (_load_4_52($4)|0);
 $6 = tempRet0;
 $7 = (_bitshift64Lshr(($5|0),($6|0),5)|0);
 $8 = tempRet0;
 $9 = $7 & 2097151;
 $10 = ((($0)) + 5|0);
 $11 = (_load_3_51($10)|0);
 $12 = tempRet0;
 $13 = (_bitshift64Lshr(($11|0),($12|0),2)|0);
 $14 = tempRet0;
 $15 = $13 & 2097151;
 $16 = ((($0)) + 7|0);
 $17 = (_load_4_52($16)|0);
 $18 = tempRet0;
 $19 = (_bitshift64Lshr(($17|0),($18|0),7)|0);
 $20 = tempRet0;
 $21 = $19 & 2097151;
 $22 = ((($0)) + 10|0);
 $23 = (_load_4_52($22)|0);
 $24 = tempRet0;
 $25 = (_bitshift64Lshr(($23|0),($24|0),4)|0);
 $26 = tempRet0;
 $27 = $25 & 2097151;
 $28 = ((($0)) + 13|0);
 $29 = (_load_3_51($28)|0);
 $30 = tempRet0;
 $31 = (_bitshift64Lshr(($29|0),($30|0),1)|0);
 $32 = tempRet0;
 $33 = $31 & 2097151;
 $34 = ((($0)) + 15|0);
 $35 = (_load_4_52($34)|0);
 $36 = tempRet0;
 $37 = (_bitshift64Lshr(($35|0),($36|0),6)|0);
 $38 = tempRet0;
 $39 = $37 & 2097151;
 $40 = ((($0)) + 18|0);
 $41 = (_load_3_51($40)|0);
 $42 = tempRet0;
 $43 = (_bitshift64Lshr(($41|0),($42|0),3)|0);
 $44 = tempRet0;
 $45 = $43 & 2097151;
 $46 = ((($0)) + 21|0);
 $47 = (_load_3_51($46)|0);
 $48 = tempRet0;
 $49 = $47 & 2097151;
 $50 = ((($0)) + 23|0);
 $51 = (_load_4_52($50)|0);
 $52 = tempRet0;
 $53 = (_bitshift64Lshr(($51|0),($52|0),5)|0);
 $54 = tempRet0;
 $55 = $53 & 2097151;
 $56 = ((($0)) + 26|0);
 $57 = (_load_3_51($56)|0);
 $58 = tempRet0;
 $59 = (_bitshift64Lshr(($57|0),($58|0),2)|0);
 $60 = tempRet0;
 $61 = $59 & 2097151;
 $62 = ((($0)) + 28|0);
 $63 = (_load_4_52($62)|0);
 $64 = tempRet0;
 $65 = (_bitshift64Lshr(($63|0),($64|0),7)|0);
 $66 = tempRet0;
 $67 = $65 & 2097151;
 $68 = ((($0)) + 31|0);
 $69 = (_load_4_52($68)|0);
 $70 = tempRet0;
 $71 = (_bitshift64Lshr(($69|0),($70|0),4)|0);
 $72 = tempRet0;
 $73 = $71 & 2097151;
 $74 = ((($0)) + 34|0);
 $75 = (_load_3_51($74)|0);
 $76 = tempRet0;
 $77 = (_bitshift64Lshr(($75|0),($76|0),1)|0);
 $78 = tempRet0;
 $79 = $77 & 2097151;
 $80 = ((($0)) + 36|0);
 $81 = (_load_4_52($80)|0);
 $82 = tempRet0;
 $83 = (_bitshift64Lshr(($81|0),($82|0),6)|0);
 $84 = tempRet0;
 $85 = $83 & 2097151;
 $86 = ((($0)) + 39|0);
 $87 = (_load_3_51($86)|0);
 $88 = tempRet0;
 $89 = (_bitshift64Lshr(($87|0),($88|0),3)|0);
 $90 = tempRet0;
 $91 = $89 & 2097151;
 $92 = ((($0)) + 42|0);
 $93 = (_load_3_51($92)|0);
 $94 = tempRet0;
 $95 = $93 & 2097151;
 $96 = ((($0)) + 44|0);
 $97 = (_load_4_52($96)|0);
 $98 = tempRet0;
 $99 = (_bitshift64Lshr(($97|0),($98|0),5)|0);
 $100 = tempRet0;
 $101 = $99 & 2097151;
 $102 = ((($0)) + 47|0);
 $103 = (_load_3_51($102)|0);
 $104 = tempRet0;
 $105 = (_bitshift64Lshr(($103|0),($104|0),2)|0);
 $106 = tempRet0;
 $107 = $105 & 2097151;
 $108 = ((($0)) + 49|0);
 $109 = (_load_4_52($108)|0);
 $110 = tempRet0;
 $111 = (_bitshift64Lshr(($109|0),($110|0),7)|0);
 $112 = tempRet0;
 $113 = $111 & 2097151;
 $114 = ((($0)) + 52|0);
 $115 = (_load_4_52($114)|0);
 $116 = tempRet0;
 $117 = (_bitshift64Lshr(($115|0),($116|0),4)|0);
 $118 = tempRet0;
 $119 = $117 & 2097151;
 $120 = ((($0)) + 55|0);
 $121 = (_load_3_51($120)|0);
 $122 = tempRet0;
 $123 = (_bitshift64Lshr(($121|0),($122|0),1)|0);
 $124 = tempRet0;
 $125 = $123 & 2097151;
 $126 = ((($0)) + 57|0);
 $127 = (_load_4_52($126)|0);
 $128 = tempRet0;
 $129 = (_bitshift64Lshr(($127|0),($128|0),6)|0);
 $130 = tempRet0;
 $131 = $129 & 2097151;
 $132 = ((($0)) + 60|0);
 $133 = (_load_4_52($132)|0);
 $134 = tempRet0;
 $135 = (_bitshift64Lshr(($133|0),($134|0),3)|0);
 $136 = tempRet0;
 $137 = (___muldi3(($135|0),($136|0),666643,0)|0);
 $138 = tempRet0;
 $139 = (___muldi3(($135|0),($136|0),470296,0)|0);
 $140 = tempRet0;
 $141 = (___muldi3(($135|0),($136|0),654183,0)|0);
 $142 = tempRet0;
 $143 = (___muldi3(($135|0),($136|0),-997805,-1)|0);
 $144 = tempRet0;
 $145 = (___muldi3(($135|0),($136|0),136657,0)|0);
 $146 = tempRet0;
 $147 = (_i64Add(($145|0),($146|0),($91|0),0)|0);
 $148 = tempRet0;
 $149 = (___muldi3(($135|0),($136|0),-683901,-1)|0);
 $150 = tempRet0;
 $151 = (_i64Add(($149|0),($150|0),($95|0),0)|0);
 $152 = tempRet0;
 $153 = (___muldi3(($131|0),0,666643,0)|0);
 $154 = tempRet0;
 $155 = (___muldi3(($131|0),0,470296,0)|0);
 $156 = tempRet0;
 $157 = (___muldi3(($131|0),0,654183,0)|0);
 $158 = tempRet0;
 $159 = (___muldi3(($131|0),0,-997805,-1)|0);
 $160 = tempRet0;
 $161 = (___muldi3(($131|0),0,136657,0)|0);
 $162 = tempRet0;
 $163 = (___muldi3(($131|0),0,-683901,-1)|0);
 $164 = tempRet0;
 $165 = (_i64Add(($147|0),($148|0),($163|0),($164|0))|0);
 $166 = tempRet0;
 $167 = (___muldi3(($125|0),0,666643,0)|0);
 $168 = tempRet0;
 $169 = (___muldi3(($125|0),0,470296,0)|0);
 $170 = tempRet0;
 $171 = (___muldi3(($125|0),0,654183,0)|0);
 $172 = tempRet0;
 $173 = (___muldi3(($125|0),0,-997805,-1)|0);
 $174 = tempRet0;
 $175 = (___muldi3(($125|0),0,136657,0)|0);
 $176 = tempRet0;
 $177 = (___muldi3(($125|0),0,-683901,-1)|0);
 $178 = tempRet0;
 $179 = (_i64Add(($177|0),($178|0),($85|0),0)|0);
 $180 = tempRet0;
 $181 = (_i64Add(($179|0),($180|0),($143|0),($144|0))|0);
 $182 = tempRet0;
 $183 = (_i64Add(($181|0),($182|0),($161|0),($162|0))|0);
 $184 = tempRet0;
 $185 = (___muldi3(($119|0),0,666643,0)|0);
 $186 = tempRet0;
 $187 = (___muldi3(($119|0),0,470296,0)|0);
 $188 = tempRet0;
 $189 = (___muldi3(($119|0),0,654183,0)|0);
 $190 = tempRet0;
 $191 = (___muldi3(($119|0),0,-997805,-1)|0);
 $192 = tempRet0;
 $193 = (___muldi3(($119|0),0,136657,0)|0);
 $194 = tempRet0;
 $195 = (___muldi3(($119|0),0,-683901,-1)|0);
 $196 = tempRet0;
 $197 = (___muldi3(($113|0),0,666643,0)|0);
 $198 = tempRet0;
 $199 = (___muldi3(($113|0),0,470296,0)|0);
 $200 = tempRet0;
 $201 = (___muldi3(($113|0),0,654183,0)|0);
 $202 = tempRet0;
 $203 = (___muldi3(($113|0),0,-997805,-1)|0);
 $204 = tempRet0;
 $205 = (___muldi3(($113|0),0,136657,0)|0);
 $206 = tempRet0;
 $207 = (___muldi3(($113|0),0,-683901,-1)|0);
 $208 = tempRet0;
 $209 = (_i64Add(($207|0),($208|0),($73|0),0)|0);
 $210 = tempRet0;
 $211 = (_i64Add(($209|0),($210|0),($193|0),($194|0))|0);
 $212 = tempRet0;
 $213 = (_i64Add(($211|0),($212|0),($173|0),($174|0))|0);
 $214 = tempRet0;
 $215 = (_i64Add(($213|0),($214|0),($139|0),($140|0))|0);
 $216 = tempRet0;
 $217 = (_i64Add(($215|0),($216|0),($157|0),($158|0))|0);
 $218 = tempRet0;
 $219 = (___muldi3(($107|0),0,666643,0)|0);
 $220 = tempRet0;
 $221 = (_i64Add(($219|0),($220|0),($39|0),0)|0);
 $222 = tempRet0;
 $223 = (___muldi3(($107|0),0,470296,0)|0);
 $224 = tempRet0;
 $225 = (___muldi3(($107|0),0,654183,0)|0);
 $226 = tempRet0;
 $227 = (_i64Add(($225|0),($226|0),($49|0),0)|0);
 $228 = tempRet0;
 $229 = (_i64Add(($227|0),($228|0),($199|0),($200|0))|0);
 $230 = tempRet0;
 $231 = (_i64Add(($229|0),($230|0),($185|0),($186|0))|0);
 $232 = tempRet0;
 $233 = (___muldi3(($107|0),0,-997805,-1)|0);
 $234 = tempRet0;
 $235 = (___muldi3(($107|0),0,136657,0)|0);
 $236 = tempRet0;
 $237 = (_i64Add(($235|0),($236|0),($61|0),0)|0);
 $238 = tempRet0;
 $239 = (_i64Add(($237|0),($238|0),($203|0),($204|0))|0);
 $240 = tempRet0;
 $241 = (_i64Add(($239|0),($240|0),($189|0),($190|0))|0);
 $242 = tempRet0;
 $243 = (_i64Add(($241|0),($242|0),($169|0),($170|0))|0);
 $244 = tempRet0;
 $245 = (_i64Add(($243|0),($244|0),($153|0),($154|0))|0);
 $246 = tempRet0;
 $247 = (___muldi3(($107|0),0,-683901,-1)|0);
 $248 = tempRet0;
 $249 = (_i64Add(($221|0),($222|0),1048576,0)|0);
 $250 = tempRet0;
 $251 = (_bitshift64Lshr(($249|0),($250|0),21)|0);
 $252 = tempRet0;
 $253 = (_i64Add(($223|0),($224|0),($45|0),0)|0);
 $254 = tempRet0;
 $255 = (_i64Add(($253|0),($254|0),($197|0),($198|0))|0);
 $256 = tempRet0;
 $257 = (_i64Add(($255|0),($256|0),($251|0),($252|0))|0);
 $258 = tempRet0;
 $259 = (_bitshift64Shl(($251|0),($252|0),21)|0);
 $260 = tempRet0;
 $261 = (_i64Subtract(($221|0),($222|0),($259|0),($260|0))|0);
 $262 = tempRet0;
 $263 = (_i64Add(($231|0),($232|0),1048576,0)|0);
 $264 = tempRet0;
 $265 = (_bitshift64Lshr(($263|0),($264|0),21)|0);
 $266 = tempRet0;
 $267 = (_i64Add(($233|0),($234|0),($55|0),0)|0);
 $268 = tempRet0;
 $269 = (_i64Add(($267|0),($268|0),($201|0),($202|0))|0);
 $270 = tempRet0;
 $271 = (_i64Add(($269|0),($270|0),($187|0),($188|0))|0);
 $272 = tempRet0;
 $273 = (_i64Add(($271|0),($272|0),($167|0),($168|0))|0);
 $274 = tempRet0;
 $275 = (_i64Add(($273|0),($274|0),($265|0),($266|0))|0);
 $276 = tempRet0;
 $277 = (_bitshift64Shl(($265|0),($266|0),21)|0);
 $278 = tempRet0;
 $279 = (_i64Add(($245|0),($246|0),1048576,0)|0);
 $280 = tempRet0;
 $281 = (_bitshift64Ashr(($279|0),($280|0),21)|0);
 $282 = tempRet0;
 $283 = (_i64Add(($247|0),($248|0),($67|0),0)|0);
 $284 = tempRet0;
 $285 = (_i64Add(($283|0),($284|0),($205|0),($206|0))|0);
 $286 = tempRet0;
 $287 = (_i64Add(($285|0),($286|0),($191|0),($192|0))|0);
 $288 = tempRet0;
 $289 = (_i64Add(($287|0),($288|0),($171|0),($172|0))|0);
 $290 = tempRet0;
 $291 = (_i64Add(($289|0),($290|0),($137|0),($138|0))|0);
 $292 = tempRet0;
 $293 = (_i64Add(($291|0),($292|0),($155|0),($156|0))|0);
 $294 = tempRet0;
 $295 = (_i64Add(($293|0),($294|0),($281|0),($282|0))|0);
 $296 = tempRet0;
 $297 = (_bitshift64Shl(($281|0),($282|0),21)|0);
 $298 = tempRet0;
 $299 = (_i64Add(($217|0),($218|0),1048576,0)|0);
 $300 = tempRet0;
 $301 = (_bitshift64Ashr(($299|0),($300|0),21)|0);
 $302 = tempRet0;
 $303 = (_i64Add(($195|0),($196|0),($79|0),0)|0);
 $304 = tempRet0;
 $305 = (_i64Add(($303|0),($304|0),($175|0),($176|0))|0);
 $306 = tempRet0;
 $307 = (_i64Add(($305|0),($306|0),($141|0),($142|0))|0);
 $308 = tempRet0;
 $309 = (_i64Add(($307|0),($308|0),($159|0),($160|0))|0);
 $310 = tempRet0;
 $311 = (_i64Add(($309|0),($310|0),($301|0),($302|0))|0);
 $312 = tempRet0;
 $313 = (_bitshift64Shl(($301|0),($302|0),21)|0);
 $314 = tempRet0;
 $315 = (_i64Subtract(($217|0),($218|0),($313|0),($314|0))|0);
 $316 = tempRet0;
 $317 = (_i64Add(($183|0),($184|0),1048576,0)|0);
 $318 = tempRet0;
 $319 = (_bitshift64Ashr(($317|0),($318|0),21)|0);
 $320 = tempRet0;
 $321 = (_i64Add(($165|0),($166|0),($319|0),($320|0))|0);
 $322 = tempRet0;
 $323 = (_bitshift64Shl(($319|0),($320|0),21)|0);
 $324 = tempRet0;
 $325 = (_i64Subtract(($183|0),($184|0),($323|0),($324|0))|0);
 $326 = tempRet0;
 $327 = (_i64Add(($151|0),($152|0),1048576,0)|0);
 $328 = tempRet0;
 $329 = (_bitshift64Ashr(($327|0),($328|0),21)|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($101|0),0)|0);
 $332 = tempRet0;
 $333 = (_bitshift64Shl(($329|0),($330|0),21)|0);
 $334 = tempRet0;
 $335 = (_i64Subtract(($151|0),($152|0),($333|0),($334|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($257|0),($258|0),1048576,0)|0);
 $338 = tempRet0;
 $339 = (_bitshift64Lshr(($337|0),($338|0),21)|0);
 $340 = tempRet0;
 $341 = (_bitshift64Shl(($339|0),($340|0),21)|0);
 $342 = tempRet0;
 $343 = (_i64Subtract(($257|0),($258|0),($341|0),($342|0))|0);
 $344 = tempRet0;
 $345 = (_i64Add(($275|0),($276|0),1048576,0)|0);
 $346 = tempRet0;
 $347 = (_bitshift64Ashr(($345|0),($346|0),21)|0);
 $348 = tempRet0;
 $349 = (_bitshift64Shl(($347|0),($348|0),21)|0);
 $350 = tempRet0;
 $351 = (_i64Add(($295|0),($296|0),1048576,0)|0);
 $352 = tempRet0;
 $353 = (_bitshift64Ashr(($351|0),($352|0),21)|0);
 $354 = tempRet0;
 $355 = (_i64Add(($353|0),($354|0),($315|0),($316|0))|0);
 $356 = tempRet0;
 $357 = (_bitshift64Shl(($353|0),($354|0),21)|0);
 $358 = tempRet0;
 $359 = (_i64Subtract(($295|0),($296|0),($357|0),($358|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($311|0),($312|0),1048576,0)|0);
 $362 = tempRet0;
 $363 = (_bitshift64Ashr(($361|0),($362|0),21)|0);
 $364 = tempRet0;
 $365 = (_i64Add(($363|0),($364|0),($325|0),($326|0))|0);
 $366 = tempRet0;
 $367 = (_bitshift64Shl(($363|0),($364|0),21)|0);
 $368 = tempRet0;
 $369 = (_i64Subtract(($311|0),($312|0),($367|0),($368|0))|0);
 $370 = tempRet0;
 $371 = (_i64Add(($321|0),($322|0),1048576,0)|0);
 $372 = tempRet0;
 $373 = (_bitshift64Ashr(($371|0),($372|0),21)|0);
 $374 = tempRet0;
 $375 = (_i64Add(($373|0),($374|0),($335|0),($336|0))|0);
 $376 = tempRet0;
 $377 = (_bitshift64Shl(($373|0),($374|0),21)|0);
 $378 = tempRet0;
 $379 = (_i64Subtract(($321|0),($322|0),($377|0),($378|0))|0);
 $380 = tempRet0;
 $381 = (___muldi3(($331|0),($332|0),666643,0)|0);
 $382 = tempRet0;
 $383 = (_i64Add(($381|0),($382|0),($33|0),0)|0);
 $384 = tempRet0;
 $385 = (___muldi3(($331|0),($332|0),470296,0)|0);
 $386 = tempRet0;
 $387 = (_i64Add(($261|0),($262|0),($385|0),($386|0))|0);
 $388 = tempRet0;
 $389 = (___muldi3(($331|0),($332|0),654183,0)|0);
 $390 = tempRet0;
 $391 = (_i64Add(($343|0),($344|0),($389|0),($390|0))|0);
 $392 = tempRet0;
 $393 = (___muldi3(($331|0),($332|0),-997805,-1)|0);
 $394 = tempRet0;
 $395 = (___muldi3(($331|0),($332|0),136657,0)|0);
 $396 = tempRet0;
 $397 = (___muldi3(($331|0),($332|0),-683901,-1)|0);
 $398 = tempRet0;
 $399 = (_i64Add(($397|0),($398|0),($245|0),($246|0))|0);
 $400 = tempRet0;
 $401 = (_i64Add(($399|0),($400|0),($347|0),($348|0))|0);
 $402 = tempRet0;
 $403 = (_i64Subtract(($401|0),($402|0),($297|0),($298|0))|0);
 $404 = tempRet0;
 $405 = (___muldi3(($375|0),($376|0),666643,0)|0);
 $406 = tempRet0;
 $407 = (_i64Add(($405|0),($406|0),($27|0),0)|0);
 $408 = tempRet0;
 $409 = (___muldi3(($375|0),($376|0),470296,0)|0);
 $410 = tempRet0;
 $411 = (_i64Add(($383|0),($384|0),($409|0),($410|0))|0);
 $412 = tempRet0;
 $413 = (___muldi3(($375|0),($376|0),654183,0)|0);
 $414 = tempRet0;
 $415 = (_i64Add(($387|0),($388|0),($413|0),($414|0))|0);
 $416 = tempRet0;
 $417 = (___muldi3(($375|0),($376|0),-997805,-1)|0);
 $418 = tempRet0;
 $419 = (_i64Add(($391|0),($392|0),($417|0),($418|0))|0);
 $420 = tempRet0;
 $421 = (___muldi3(($375|0),($376|0),136657,0)|0);
 $422 = tempRet0;
 $423 = (___muldi3(($375|0),($376|0),-683901,-1)|0);
 $424 = tempRet0;
 $425 = (___muldi3(($379|0),($380|0),666643,0)|0);
 $426 = tempRet0;
 $427 = (_i64Add(($425|0),($426|0),($21|0),0)|0);
 $428 = tempRet0;
 $429 = (___muldi3(($379|0),($380|0),470296,0)|0);
 $430 = tempRet0;
 $431 = (_i64Add(($407|0),($408|0),($429|0),($430|0))|0);
 $432 = tempRet0;
 $433 = (___muldi3(($379|0),($380|0),654183,0)|0);
 $434 = tempRet0;
 $435 = (_i64Add(($411|0),($412|0),($433|0),($434|0))|0);
 $436 = tempRet0;
 $437 = (___muldi3(($379|0),($380|0),-997805,-1)|0);
 $438 = tempRet0;
 $439 = (_i64Add(($415|0),($416|0),($437|0),($438|0))|0);
 $440 = tempRet0;
 $441 = (___muldi3(($379|0),($380|0),136657,0)|0);
 $442 = tempRet0;
 $443 = (_i64Add(($419|0),($420|0),($441|0),($442|0))|0);
 $444 = tempRet0;
 $445 = (___muldi3(($379|0),($380|0),-683901,-1)|0);
 $446 = tempRet0;
 $447 = (_i64Add(($339|0),($340|0),($231|0),($232|0))|0);
 $448 = tempRet0;
 $449 = (_i64Subtract(($447|0),($448|0),($277|0),($278|0))|0);
 $450 = tempRet0;
 $451 = (_i64Add(($449|0),($450|0),($393|0),($394|0))|0);
 $452 = tempRet0;
 $453 = (_i64Add(($451|0),($452|0),($421|0),($422|0))|0);
 $454 = tempRet0;
 $455 = (_i64Add(($453|0),($454|0),($445|0),($446|0))|0);
 $456 = tempRet0;
 $457 = (___muldi3(($365|0),($366|0),666643,0)|0);
 $458 = tempRet0;
 $459 = (_i64Add(($457|0),($458|0),($15|0),0)|0);
 $460 = tempRet0;
 $461 = (___muldi3(($365|0),($366|0),470296,0)|0);
 $462 = tempRet0;
 $463 = (_i64Add(($427|0),($428|0),($461|0),($462|0))|0);
 $464 = tempRet0;
 $465 = (___muldi3(($365|0),($366|0),654183,0)|0);
 $466 = tempRet0;
 $467 = (_i64Add(($431|0),($432|0),($465|0),($466|0))|0);
 $468 = tempRet0;
 $469 = (___muldi3(($365|0),($366|0),-997805,-1)|0);
 $470 = tempRet0;
 $471 = (_i64Add(($435|0),($436|0),($469|0),($470|0))|0);
 $472 = tempRet0;
 $473 = (___muldi3(($365|0),($366|0),136657,0)|0);
 $474 = tempRet0;
 $475 = (_i64Add(($439|0),($440|0),($473|0),($474|0))|0);
 $476 = tempRet0;
 $477 = (___muldi3(($365|0),($366|0),-683901,-1)|0);
 $478 = tempRet0;
 $479 = (_i64Add(($443|0),($444|0),($477|0),($478|0))|0);
 $480 = tempRet0;
 $481 = (___muldi3(($369|0),($370|0),666643,0)|0);
 $482 = tempRet0;
 $483 = (___muldi3(($369|0),($370|0),470296,0)|0);
 $484 = tempRet0;
 $485 = (___muldi3(($369|0),($370|0),654183,0)|0);
 $486 = tempRet0;
 $487 = (___muldi3(($369|0),($370|0),-997805,-1)|0);
 $488 = tempRet0;
 $489 = (___muldi3(($369|0),($370|0),136657,0)|0);
 $490 = tempRet0;
 $491 = (___muldi3(($369|0),($370|0),-683901,-1)|0);
 $492 = tempRet0;
 $493 = (_i64Add(($475|0),($476|0),($491|0),($492|0))|0);
 $494 = tempRet0;
 $495 = (___muldi3(($355|0),($356|0),666643,0)|0);
 $496 = tempRet0;
 $497 = (_i64Add(($495|0),($496|0),($3|0),0)|0);
 $498 = tempRet0;
 $499 = (___muldi3(($355|0),($356|0),470296,0)|0);
 $500 = tempRet0;
 $501 = (___muldi3(($355|0),($356|0),654183,0)|0);
 $502 = tempRet0;
 $503 = (_i64Add(($459|0),($460|0),($501|0),($502|0))|0);
 $504 = tempRet0;
 $505 = (_i64Add(($503|0),($504|0),($483|0),($484|0))|0);
 $506 = tempRet0;
 $507 = (___muldi3(($355|0),($356|0),-997805,-1)|0);
 $508 = tempRet0;
 $509 = (___muldi3(($355|0),($356|0),136657,0)|0);
 $510 = tempRet0;
 $511 = (_i64Add(($467|0),($468|0),($509|0),($510|0))|0);
 $512 = tempRet0;
 $513 = (_i64Add(($511|0),($512|0),($487|0),($488|0))|0);
 $514 = tempRet0;
 $515 = (___muldi3(($355|0),($356|0),-683901,-1)|0);
 $516 = tempRet0;
 $517 = (_i64Add(($497|0),($498|0),1048576,0)|0);
 $518 = tempRet0;
 $519 = (_bitshift64Ashr(($517|0),($518|0),21)|0);
 $520 = tempRet0;
 $521 = (_i64Add(($499|0),($500|0),($9|0),0)|0);
 $522 = tempRet0;
 $523 = (_i64Add(($521|0),($522|0),($481|0),($482|0))|0);
 $524 = tempRet0;
 $525 = (_i64Add(($523|0),($524|0),($519|0),($520|0))|0);
 $526 = tempRet0;
 $527 = (_bitshift64Shl(($519|0),($520|0),21)|0);
 $528 = tempRet0;
 $529 = (_i64Subtract(($497|0),($498|0),($527|0),($528|0))|0);
 $530 = tempRet0;
 $531 = (_i64Add(($505|0),($506|0),1048576,0)|0);
 $532 = tempRet0;
 $533 = (_bitshift64Ashr(($531|0),($532|0),21)|0);
 $534 = tempRet0;
 $535 = (_i64Add(($463|0),($464|0),($507|0),($508|0))|0);
 $536 = tempRet0;
 $537 = (_i64Add(($535|0),($536|0),($485|0),($486|0))|0);
 $538 = tempRet0;
 $539 = (_i64Add(($537|0),($538|0),($533|0),($534|0))|0);
 $540 = tempRet0;
 $541 = (_bitshift64Shl(($533|0),($534|0),21)|0);
 $542 = tempRet0;
 $543 = (_i64Add(($513|0),($514|0),1048576,0)|0);
 $544 = tempRet0;
 $545 = (_bitshift64Ashr(($543|0),($544|0),21)|0);
 $546 = tempRet0;
 $547 = (_i64Add(($471|0),($472|0),($515|0),($516|0))|0);
 $548 = tempRet0;
 $549 = (_i64Add(($547|0),($548|0),($489|0),($490|0))|0);
 $550 = tempRet0;
 $551 = (_i64Add(($549|0),($550|0),($545|0),($546|0))|0);
 $552 = tempRet0;
 $553 = (_bitshift64Shl(($545|0),($546|0),21)|0);
 $554 = tempRet0;
 $555 = (_i64Add(($493|0),($494|0),1048576,0)|0);
 $556 = tempRet0;
 $557 = (_bitshift64Ashr(($555|0),($556|0),21)|0);
 $558 = tempRet0;
 $559 = (_i64Add(($479|0),($480|0),($557|0),($558|0))|0);
 $560 = tempRet0;
 $561 = (_bitshift64Shl(($557|0),($558|0),21)|0);
 $562 = tempRet0;
 $563 = (_i64Subtract(($493|0),($494|0),($561|0),($562|0))|0);
 $564 = tempRet0;
 $565 = (_i64Add(($455|0),($456|0),1048576,0)|0);
 $566 = tempRet0;
 $567 = (_bitshift64Ashr(($565|0),($566|0),21)|0);
 $568 = tempRet0;
 $569 = (_i64Add(($395|0),($396|0),($275|0),($276|0))|0);
 $570 = tempRet0;
 $571 = (_i64Subtract(($569|0),($570|0),($349|0),($350|0))|0);
 $572 = tempRet0;
 $573 = (_i64Add(($571|0),($572|0),($423|0),($424|0))|0);
 $574 = tempRet0;
 $575 = (_i64Add(($573|0),($574|0),($567|0),($568|0))|0);
 $576 = tempRet0;
 $577 = (_bitshift64Shl(($567|0),($568|0),21)|0);
 $578 = tempRet0;
 $579 = (_i64Subtract(($455|0),($456|0),($577|0),($578|0))|0);
 $580 = tempRet0;
 $581 = (_i64Add(($403|0),($404|0),1048576,0)|0);
 $582 = tempRet0;
 $583 = (_bitshift64Ashr(($581|0),($582|0),21)|0);
 $584 = tempRet0;
 $585 = (_i64Add(($583|0),($584|0),($359|0),($360|0))|0);
 $586 = tempRet0;
 $587 = (_bitshift64Shl(($583|0),($584|0),21)|0);
 $588 = tempRet0;
 $589 = (_i64Subtract(($403|0),($404|0),($587|0),($588|0))|0);
 $590 = tempRet0;
 $591 = (_i64Add(($525|0),($526|0),1048576,0)|0);
 $592 = tempRet0;
 $593 = (_bitshift64Ashr(($591|0),($592|0),21)|0);
 $594 = tempRet0;
 $595 = (_bitshift64Shl(($593|0),($594|0),21)|0);
 $596 = tempRet0;
 $597 = (_i64Add(($539|0),($540|0),1048576,0)|0);
 $598 = tempRet0;
 $599 = (_bitshift64Ashr(($597|0),($598|0),21)|0);
 $600 = tempRet0;
 $601 = (_bitshift64Shl(($599|0),($600|0),21)|0);
 $602 = tempRet0;
 $603 = (_i64Add(($551|0),($552|0),1048576,0)|0);
 $604 = tempRet0;
 $605 = (_bitshift64Ashr(($603|0),($604|0),21)|0);
 $606 = tempRet0;
 $607 = (_i64Add(($563|0),($564|0),($605|0),($606|0))|0);
 $608 = tempRet0;
 $609 = (_bitshift64Shl(($605|0),($606|0),21)|0);
 $610 = tempRet0;
 $611 = (_i64Add(($559|0),($560|0),1048576,0)|0);
 $612 = tempRet0;
 $613 = (_bitshift64Ashr(($611|0),($612|0),21)|0);
 $614 = tempRet0;
 $615 = (_i64Add(($579|0),($580|0),($613|0),($614|0))|0);
 $616 = tempRet0;
 $617 = (_bitshift64Shl(($613|0),($614|0),21)|0);
 $618 = tempRet0;
 $619 = (_i64Subtract(($559|0),($560|0),($617|0),($618|0))|0);
 $620 = tempRet0;
 $621 = (_i64Add(($575|0),($576|0),1048576,0)|0);
 $622 = tempRet0;
 $623 = (_bitshift64Ashr(($621|0),($622|0),21)|0);
 $624 = tempRet0;
 $625 = (_i64Add(($589|0),($590|0),($623|0),($624|0))|0);
 $626 = tempRet0;
 $627 = (_bitshift64Shl(($623|0),($624|0),21)|0);
 $628 = tempRet0;
 $629 = (_i64Subtract(($575|0),($576|0),($627|0),($628|0))|0);
 $630 = tempRet0;
 $631 = (_i64Add(($585|0),($586|0),1048576,0)|0);
 $632 = tempRet0;
 $633 = (_bitshift64Ashr(($631|0),($632|0),21)|0);
 $634 = tempRet0;
 $635 = (_bitshift64Shl(($633|0),($634|0),21)|0);
 $636 = tempRet0;
 $637 = (_i64Subtract(($585|0),($586|0),($635|0),($636|0))|0);
 $638 = tempRet0;
 $639 = (___muldi3(($633|0),($634|0),666643,0)|0);
 $640 = tempRet0;
 $641 = (_i64Add(($529|0),($530|0),($639|0),($640|0))|0);
 $642 = tempRet0;
 $643 = (___muldi3(($633|0),($634|0),470296,0)|0);
 $644 = tempRet0;
 $645 = (___muldi3(($633|0),($634|0),654183,0)|0);
 $646 = tempRet0;
 $647 = (___muldi3(($633|0),($634|0),-997805,-1)|0);
 $648 = tempRet0;
 $649 = (___muldi3(($633|0),($634|0),136657,0)|0);
 $650 = tempRet0;
 $651 = (___muldi3(($633|0),($634|0),-683901,-1)|0);
 $652 = tempRet0;
 $653 = (_bitshift64Ashr(($641|0),($642|0),21)|0);
 $654 = tempRet0;
 $655 = (_i64Add(($643|0),($644|0),($525|0),($526|0))|0);
 $656 = tempRet0;
 $657 = (_i64Subtract(($655|0),($656|0),($595|0),($596|0))|0);
 $658 = tempRet0;
 $659 = (_i64Add(($657|0),($658|0),($653|0),($654|0))|0);
 $660 = tempRet0;
 $661 = (_bitshift64Shl(($653|0),($654|0),21)|0);
 $662 = tempRet0;
 $663 = (_i64Subtract(($641|0),($642|0),($661|0),($662|0))|0);
 $664 = tempRet0;
 $665 = (_bitshift64Ashr(($659|0),($660|0),21)|0);
 $666 = tempRet0;
 $667 = (_i64Add(($645|0),($646|0),($505|0),($506|0))|0);
 $668 = tempRet0;
 $669 = (_i64Subtract(($667|0),($668|0),($541|0),($542|0))|0);
 $670 = tempRet0;
 $671 = (_i64Add(($669|0),($670|0),($593|0),($594|0))|0);
 $672 = tempRet0;
 $673 = (_i64Add(($671|0),($672|0),($665|0),($666|0))|0);
 $674 = tempRet0;
 $675 = (_bitshift64Shl(($665|0),($666|0),21)|0);
 $676 = tempRet0;
 $677 = (_i64Subtract(($659|0),($660|0),($675|0),($676|0))|0);
 $678 = tempRet0;
 $679 = (_bitshift64Ashr(($673|0),($674|0),21)|0);
 $680 = tempRet0;
 $681 = (_i64Add(($539|0),($540|0),($647|0),($648|0))|0);
 $682 = tempRet0;
 $683 = (_i64Subtract(($681|0),($682|0),($601|0),($602|0))|0);
 $684 = tempRet0;
 $685 = (_i64Add(($683|0),($684|0),($679|0),($680|0))|0);
 $686 = tempRet0;
 $687 = (_bitshift64Shl(($679|0),($680|0),21)|0);
 $688 = tempRet0;
 $689 = (_i64Subtract(($673|0),($674|0),($687|0),($688|0))|0);
 $690 = tempRet0;
 $691 = (_bitshift64Ashr(($685|0),($686|0),21)|0);
 $692 = tempRet0;
 $693 = (_i64Add(($649|0),($650|0),($513|0),($514|0))|0);
 $694 = tempRet0;
 $695 = (_i64Subtract(($693|0),($694|0),($553|0),($554|0))|0);
 $696 = tempRet0;
 $697 = (_i64Add(($695|0),($696|0),($599|0),($600|0))|0);
 $698 = tempRet0;
 $699 = (_i64Add(($697|0),($698|0),($691|0),($692|0))|0);
 $700 = tempRet0;
 $701 = (_bitshift64Shl(($691|0),($692|0),21)|0);
 $702 = tempRet0;
 $703 = (_i64Subtract(($685|0),($686|0),($701|0),($702|0))|0);
 $704 = tempRet0;
 $705 = (_bitshift64Ashr(($699|0),($700|0),21)|0);
 $706 = tempRet0;
 $707 = (_i64Add(($551|0),($552|0),($651|0),($652|0))|0);
 $708 = tempRet0;
 $709 = (_i64Subtract(($707|0),($708|0),($609|0),($610|0))|0);
 $710 = tempRet0;
 $711 = (_i64Add(($709|0),($710|0),($705|0),($706|0))|0);
 $712 = tempRet0;
 $713 = (_bitshift64Shl(($705|0),($706|0),21)|0);
 $714 = tempRet0;
 $715 = (_i64Subtract(($699|0),($700|0),($713|0),($714|0))|0);
 $716 = tempRet0;
 $717 = (_bitshift64Ashr(($711|0),($712|0),21)|0);
 $718 = tempRet0;
 $719 = (_i64Add(($607|0),($608|0),($717|0),($718|0))|0);
 $720 = tempRet0;
 $721 = (_bitshift64Shl(($717|0),($718|0),21)|0);
 $722 = tempRet0;
 $723 = (_i64Subtract(($711|0),($712|0),($721|0),($722|0))|0);
 $724 = tempRet0;
 $725 = (_bitshift64Ashr(($719|0),($720|0),21)|0);
 $726 = tempRet0;
 $727 = (_i64Add(($725|0),($726|0),($619|0),($620|0))|0);
 $728 = tempRet0;
 $729 = (_bitshift64Shl(($725|0),($726|0),21)|0);
 $730 = tempRet0;
 $731 = (_i64Subtract(($719|0),($720|0),($729|0),($730|0))|0);
 $732 = tempRet0;
 $733 = (_bitshift64Ashr(($727|0),($728|0),21)|0);
 $734 = tempRet0;
 $735 = (_i64Add(($615|0),($616|0),($733|0),($734|0))|0);
 $736 = tempRet0;
 $737 = (_bitshift64Shl(($733|0),($734|0),21)|0);
 $738 = tempRet0;
 $739 = (_i64Subtract(($727|0),($728|0),($737|0),($738|0))|0);
 $740 = tempRet0;
 $741 = (_bitshift64Ashr(($735|0),($736|0),21)|0);
 $742 = tempRet0;
 $743 = (_i64Add(($741|0),($742|0),($629|0),($630|0))|0);
 $744 = tempRet0;
 $745 = (_bitshift64Shl(($741|0),($742|0),21)|0);
 $746 = tempRet0;
 $747 = (_i64Subtract(($735|0),($736|0),($745|0),($746|0))|0);
 $748 = tempRet0;
 $749 = (_bitshift64Ashr(($743|0),($744|0),21)|0);
 $750 = tempRet0;
 $751 = (_i64Add(($625|0),($626|0),($749|0),($750|0))|0);
 $752 = tempRet0;
 $753 = (_bitshift64Shl(($749|0),($750|0),21)|0);
 $754 = tempRet0;
 $755 = (_i64Subtract(($743|0),($744|0),($753|0),($754|0))|0);
 $756 = tempRet0;
 $757 = (_bitshift64Ashr(($751|0),($752|0),21)|0);
 $758 = tempRet0;
 $759 = (_i64Add(($757|0),($758|0),($637|0),($638|0))|0);
 $760 = tempRet0;
 $761 = (_bitshift64Shl(($757|0),($758|0),21)|0);
 $762 = tempRet0;
 $763 = (_i64Subtract(($751|0),($752|0),($761|0),($762|0))|0);
 $764 = tempRet0;
 $765 = (_bitshift64Ashr(($759|0),($760|0),21)|0);
 $766 = tempRet0;
 $767 = (_bitshift64Shl(($765|0),($766|0),21)|0);
 $768 = tempRet0;
 $769 = (_i64Subtract(($759|0),($760|0),($767|0),($768|0))|0);
 $770 = tempRet0;
 $771 = (___muldi3(($765|0),($766|0),666643,0)|0);
 $772 = tempRet0;
 $773 = (_i64Add(($771|0),($772|0),($663|0),($664|0))|0);
 $774 = tempRet0;
 $775 = (___muldi3(($765|0),($766|0),470296,0)|0);
 $776 = tempRet0;
 $777 = (_i64Add(($677|0),($678|0),($775|0),($776|0))|0);
 $778 = tempRet0;
 $779 = (___muldi3(($765|0),($766|0),654183,0)|0);
 $780 = tempRet0;
 $781 = (_i64Add(($689|0),($690|0),($779|0),($780|0))|0);
 $782 = tempRet0;
 $783 = (___muldi3(($765|0),($766|0),-997805,-1)|0);
 $784 = tempRet0;
 $785 = (_i64Add(($703|0),($704|0),($783|0),($784|0))|0);
 $786 = tempRet0;
 $787 = (___muldi3(($765|0),($766|0),136657,0)|0);
 $788 = tempRet0;
 $789 = (_i64Add(($715|0),($716|0),($787|0),($788|0))|0);
 $790 = tempRet0;
 $791 = (___muldi3(($765|0),($766|0),-683901,-1)|0);
 $792 = tempRet0;
 $793 = (_i64Add(($723|0),($724|0),($791|0),($792|0))|0);
 $794 = tempRet0;
 $795 = (_bitshift64Ashr(($773|0),($774|0),21)|0);
 $796 = tempRet0;
 $797 = (_i64Add(($777|0),($778|0),($795|0),($796|0))|0);
 $798 = tempRet0;
 $799 = (_bitshift64Shl(($795|0),($796|0),21)|0);
 $800 = tempRet0;
 $801 = (_i64Subtract(($773|0),($774|0),($799|0),($800|0))|0);
 $802 = tempRet0;
 $803 = (_bitshift64Ashr(($797|0),($798|0),21)|0);
 $804 = tempRet0;
 $805 = (_i64Add(($781|0),($782|0),($803|0),($804|0))|0);
 $806 = tempRet0;
 $807 = (_bitshift64Shl(($803|0),($804|0),21)|0);
 $808 = tempRet0;
 $809 = (_i64Subtract(($797|0),($798|0),($807|0),($808|0))|0);
 $810 = tempRet0;
 $811 = (_bitshift64Ashr(($805|0),($806|0),21)|0);
 $812 = tempRet0;
 $813 = (_i64Add(($785|0),($786|0),($811|0),($812|0))|0);
 $814 = tempRet0;
 $815 = (_bitshift64Shl(($811|0),($812|0),21)|0);
 $816 = tempRet0;
 $817 = (_i64Subtract(($805|0),($806|0),($815|0),($816|0))|0);
 $818 = tempRet0;
 $819 = (_bitshift64Ashr(($813|0),($814|0),21)|0);
 $820 = tempRet0;
 $821 = (_i64Add(($789|0),($790|0),($819|0),($820|0))|0);
 $822 = tempRet0;
 $823 = (_bitshift64Shl(($819|0),($820|0),21)|0);
 $824 = tempRet0;
 $825 = (_i64Subtract(($813|0),($814|0),($823|0),($824|0))|0);
 $826 = tempRet0;
 $827 = (_bitshift64Ashr(($821|0),($822|0),21)|0);
 $828 = tempRet0;
 $829 = (_i64Add(($793|0),($794|0),($827|0),($828|0))|0);
 $830 = tempRet0;
 $831 = (_bitshift64Shl(($827|0),($828|0),21)|0);
 $832 = tempRet0;
 $833 = (_i64Subtract(($821|0),($822|0),($831|0),($832|0))|0);
 $834 = tempRet0;
 $835 = (_bitshift64Ashr(($829|0),($830|0),21)|0);
 $836 = tempRet0;
 $837 = (_i64Add(($835|0),($836|0),($731|0),($732|0))|0);
 $838 = tempRet0;
 $839 = (_bitshift64Shl(($835|0),($836|0),21)|0);
 $840 = tempRet0;
 $841 = (_i64Subtract(($829|0),($830|0),($839|0),($840|0))|0);
 $842 = tempRet0;
 $843 = (_bitshift64Ashr(($837|0),($838|0),21)|0);
 $844 = tempRet0;
 $845 = (_i64Add(($843|0),($844|0),($739|0),($740|0))|0);
 $846 = tempRet0;
 $847 = (_bitshift64Shl(($843|0),($844|0),21)|0);
 $848 = tempRet0;
 $849 = (_i64Subtract(($837|0),($838|0),($847|0),($848|0))|0);
 $850 = tempRet0;
 $851 = (_bitshift64Ashr(($845|0),($846|0),21)|0);
 $852 = tempRet0;
 $853 = (_i64Add(($851|0),($852|0),($747|0),($748|0))|0);
 $854 = tempRet0;
 $855 = (_bitshift64Shl(($851|0),($852|0),21)|0);
 $856 = tempRet0;
 $857 = (_i64Subtract(($845|0),($846|0),($855|0),($856|0))|0);
 $858 = tempRet0;
 $859 = (_bitshift64Ashr(($853|0),($854|0),21)|0);
 $860 = tempRet0;
 $861 = (_i64Add(($859|0),($860|0),($755|0),($756|0))|0);
 $862 = tempRet0;
 $863 = (_bitshift64Shl(($859|0),($860|0),21)|0);
 $864 = tempRet0;
 $865 = (_i64Subtract(($853|0),($854|0),($863|0),($864|0))|0);
 $866 = tempRet0;
 $867 = (_bitshift64Ashr(($861|0),($862|0),21)|0);
 $868 = tempRet0;
 $869 = (_i64Add(($867|0),($868|0),($763|0),($764|0))|0);
 $870 = tempRet0;
 $871 = (_bitshift64Shl(($867|0),($868|0),21)|0);
 $872 = tempRet0;
 $873 = (_i64Subtract(($861|0),($862|0),($871|0),($872|0))|0);
 $874 = tempRet0;
 $875 = (_bitshift64Ashr(($869|0),($870|0),21)|0);
 $876 = tempRet0;
 $877 = (_i64Add(($875|0),($876|0),($769|0),($770|0))|0);
 $878 = tempRet0;
 $879 = (_bitshift64Shl(($875|0),($876|0),21)|0);
 $880 = tempRet0;
 $881 = (_i64Subtract(($869|0),($870|0),($879|0),($880|0))|0);
 $882 = tempRet0;
 $883 = $801&255;
 HEAP8[$0>>0] = $883;
 $884 = (_bitshift64Lshr(($801|0),($802|0),8)|0);
 $885 = tempRet0;
 $886 = $884&255;
 $887 = ((($0)) + 1|0);
 HEAP8[$887>>0] = $886;
 $888 = (_bitshift64Lshr(($801|0),($802|0),16)|0);
 $889 = tempRet0;
 $890 = (_bitshift64Shl(($809|0),($810|0),5)|0);
 $891 = tempRet0;
 $892 = $890 | $888;
 $891 | $889;
 $893 = $892&255;
 HEAP8[$4>>0] = $893;
 $894 = (_bitshift64Lshr(($809|0),($810|0),3)|0);
 $895 = tempRet0;
 $896 = $894&255;
 $897 = ((($0)) + 3|0);
 HEAP8[$897>>0] = $896;
 $898 = (_bitshift64Lshr(($809|0),($810|0),11)|0);
 $899 = tempRet0;
 $900 = $898&255;
 $901 = ((($0)) + 4|0);
 HEAP8[$901>>0] = $900;
 $902 = (_bitshift64Lshr(($809|0),($810|0),19)|0);
 $903 = tempRet0;
 $904 = (_bitshift64Shl(($817|0),($818|0),2)|0);
 $905 = tempRet0;
 $906 = $904 | $902;
 $905 | $903;
 $907 = $906&255;
 HEAP8[$10>>0] = $907;
 $908 = (_bitshift64Lshr(($817|0),($818|0),6)|0);
 $909 = tempRet0;
 $910 = $908&255;
 $911 = ((($0)) + 6|0);
 HEAP8[$911>>0] = $910;
 $912 = (_bitshift64Lshr(($817|0),($818|0),14)|0);
 $913 = tempRet0;
 $914 = (_bitshift64Shl(($825|0),($826|0),7)|0);
 $915 = tempRet0;
 $916 = $914 | $912;
 $915 | $913;
 $917 = $916&255;
 HEAP8[$16>>0] = $917;
 $918 = (_bitshift64Lshr(($825|0),($826|0),1)|0);
 $919 = tempRet0;
 $920 = $918&255;
 $921 = ((($0)) + 8|0);
 HEAP8[$921>>0] = $920;
 $922 = (_bitshift64Lshr(($825|0),($826|0),9)|0);
 $923 = tempRet0;
 $924 = $922&255;
 $925 = ((($0)) + 9|0);
 HEAP8[$925>>0] = $924;
 $926 = (_bitshift64Lshr(($825|0),($826|0),17)|0);
 $927 = tempRet0;
 $928 = (_bitshift64Shl(($833|0),($834|0),4)|0);
 $929 = tempRet0;
 $930 = $928 | $926;
 $929 | $927;
 $931 = $930&255;
 HEAP8[$22>>0] = $931;
 $932 = (_bitshift64Lshr(($833|0),($834|0),4)|0);
 $933 = tempRet0;
 $934 = $932&255;
 $935 = ((($0)) + 11|0);
 HEAP8[$935>>0] = $934;
 $936 = (_bitshift64Lshr(($833|0),($834|0),12)|0);
 $937 = tempRet0;
 $938 = $936&255;
 $939 = ((($0)) + 12|0);
 HEAP8[$939>>0] = $938;
 $940 = (_bitshift64Lshr(($833|0),($834|0),20)|0);
 $941 = tempRet0;
 $942 = (_bitshift64Shl(($841|0),($842|0),1)|0);
 $943 = tempRet0;
 $944 = $942 | $940;
 $943 | $941;
 $945 = $944&255;
 HEAP8[$28>>0] = $945;
 $946 = (_bitshift64Lshr(($841|0),($842|0),7)|0);
 $947 = tempRet0;
 $948 = $946&255;
 $949 = ((($0)) + 14|0);
 HEAP8[$949>>0] = $948;
 $950 = (_bitshift64Lshr(($841|0),($842|0),15)|0);
 $951 = tempRet0;
 $952 = (_bitshift64Shl(($849|0),($850|0),6)|0);
 $953 = tempRet0;
 $954 = $952 | $950;
 $953 | $951;
 $955 = $954&255;
 HEAP8[$34>>0] = $955;
 $956 = (_bitshift64Lshr(($849|0),($850|0),2)|0);
 $957 = tempRet0;
 $958 = $956&255;
 $959 = ((($0)) + 16|0);
 HEAP8[$959>>0] = $958;
 $960 = (_bitshift64Lshr(($849|0),($850|0),10)|0);
 $961 = tempRet0;
 $962 = $960&255;
 $963 = ((($0)) + 17|0);
 HEAP8[$963>>0] = $962;
 $964 = (_bitshift64Lshr(($849|0),($850|0),18)|0);
 $965 = tempRet0;
 $966 = (_bitshift64Shl(($857|0),($858|0),3)|0);
 $967 = tempRet0;
 $968 = $966 | $964;
 $967 | $965;
 $969 = $968&255;
 HEAP8[$40>>0] = $969;
 $970 = (_bitshift64Lshr(($857|0),($858|0),5)|0);
 $971 = tempRet0;
 $972 = $970&255;
 $973 = ((($0)) + 19|0);
 HEAP8[$973>>0] = $972;
 $974 = (_bitshift64Lshr(($857|0),($858|0),13)|0);
 $975 = tempRet0;
 $976 = $974&255;
 $977 = ((($0)) + 20|0);
 HEAP8[$977>>0] = $976;
 $978 = $865&255;
 HEAP8[$46>>0] = $978;
 $979 = (_bitshift64Lshr(($865|0),($866|0),8)|0);
 $980 = tempRet0;
 $981 = $979&255;
 $982 = ((($0)) + 22|0);
 HEAP8[$982>>0] = $981;
 $983 = (_bitshift64Lshr(($865|0),($866|0),16)|0);
 $984 = tempRet0;
 $985 = (_bitshift64Shl(($873|0),($874|0),5)|0);
 $986 = tempRet0;
 $987 = $985 | $983;
 $986 | $984;
 $988 = $987&255;
 HEAP8[$50>>0] = $988;
 $989 = (_bitshift64Lshr(($873|0),($874|0),3)|0);
 $990 = tempRet0;
 $991 = $989&255;
 $992 = ((($0)) + 24|0);
 HEAP8[$992>>0] = $991;
 $993 = (_bitshift64Lshr(($873|0),($874|0),11)|0);
 $994 = tempRet0;
 $995 = $993&255;
 $996 = ((($0)) + 25|0);
 HEAP8[$996>>0] = $995;
 $997 = (_bitshift64Lshr(($873|0),($874|0),19)|0);
 $998 = tempRet0;
 $999 = (_bitshift64Shl(($881|0),($882|0),2)|0);
 $1000 = tempRet0;
 $1001 = $999 | $997;
 $1000 | $998;
 $1002 = $1001&255;
 HEAP8[$56>>0] = $1002;
 $1003 = (_bitshift64Lshr(($881|0),($882|0),6)|0);
 $1004 = tempRet0;
 $1005 = $1003&255;
 $1006 = ((($0)) + 27|0);
 HEAP8[$1006>>0] = $1005;
 $1007 = (_bitshift64Lshr(($881|0),($882|0),14)|0);
 $1008 = tempRet0;
 $1009 = (_bitshift64Shl(($877|0),($878|0),7)|0);
 $1010 = tempRet0;
 $1011 = $1007 | $1009;
 $1008 | $1010;
 $1012 = $1011&255;
 HEAP8[$62>>0] = $1012;
 $1013 = (_bitshift64Lshr(($877|0),($878|0),1)|0);
 $1014 = tempRet0;
 $1015 = $1013&255;
 $1016 = ((($0)) + 29|0);
 HEAP8[$1016>>0] = $1015;
 $1017 = (_bitshift64Lshr(($877|0),($878|0),9)|0);
 $1018 = tempRet0;
 $1019 = $1017&255;
 $1020 = ((($0)) + 30|0);
 HEAP8[$1020>>0] = $1019;
 $1021 = (_bitshift64Lshr(($877|0),($878|0),17)|0);
 $1022 = tempRet0;
 $1023 = $1021&255;
 HEAP8[$68>>0] = $1023;
 return;
}
function _load_3_51($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 tempRet0 = ($15);
 return ($14|0);
}
function _load_4_52($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = ((($0)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $2;
 $9 = ((($0)) + 2|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = (_bitshift64Shl(($11|0),0,16)|0);
 $13 = tempRet0;
 $14 = $8 | $12;
 $15 = $7 | $13;
 $16 = ((($0)) + 3|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17&255;
 $19 = (_bitshift64Shl(($18|0),0,24)|0);
 $20 = tempRet0;
 $21 = $14 | $19;
 $22 = $15 | $20;
 tempRet0 = ($22);
 return ($21|0);
}
function _sph_sha512_init($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 128|0);
 dest=$1; src=8; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $2 = ((($0)) + 192|0);
 $3 = $2;
 $4 = $3;
 HEAP32[$4>>2] = 0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = 0;
 return;
}
function _sph_sha384($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$02631 = 0, $$02730 = 0, $$028$ = 0, $$02829 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 192|0);
 $4 = ($2|0)==(0);
 if ($4) {
  return;
 }
 $5 = $3;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = (($5) + 4)|0;
 $9 = $8;
 $10 = HEAP32[$9>>2]|0;
 $11 = $7 & 127;
 $12 = ((($0)) + 128|0);
 $$02631 = $11;$$02730 = $1;$$02829 = $2;
 while(1) {
  $13 = (128 - ($$02631))|0;
  $14 = ($13>>>0)>($$02829>>>0);
  $$028$ = $14 ? $$02829 : $13;
  $15 = (($0) + ($$02631)|0);
  _memcpy(($15|0),($$02730|0),($$028$|0))|0;
  $16 = (($$02730) + ($$028$)|0);
  $17 = (($$028$) + ($$02631))|0;
  $18 = (($$02829) - ($$028$))|0;
  $19 = ($17|0)==(128);
  if ($19) {
   _sha3_round($0,$12);
   $$1 = 0;
  } else {
   $$1 = $17;
  }
  $20 = $3;
  $21 = $20;
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + 4)|0;
  $24 = $23;
  $25 = HEAP32[$24>>2]|0;
  $26 = (_i64Add(($22|0),($25|0),($$028$|0),0)|0);
  $27 = tempRet0;
  $28 = $3;
  $29 = $28;
  HEAP32[$29>>2] = $26;
  $30 = (($28) + 4)|0;
  $31 = $30;
  HEAP32[$31>>2] = $27;
  $32 = ($18|0)==(0);
  if ($32) {
   break;
  } else {
   $$02631 = $$1;$$02730 = $16;$$02829 = $18;
  }
 }
 return;
}
function _sha3_round($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0344 = 0, $$1343 = 0, $$2342 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0;
 var $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0;
 var $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0;
 var $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0;
 var $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0;
 var $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0;
 var $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0;
 var $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0;
 var $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0;
 var $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0;
 var $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0;
 var $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0;
 var $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0;
 var $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0;
 var $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0;
 var $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0;
 var $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0;
 var $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0;
 var $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0;
 var $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0;
 var $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0;
 var $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0;
 var $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0;
 var $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0;
 var $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0;
 var $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0;
 var $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0;
 var $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0;
 var $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0;
 var $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0;
 var $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0;
 var $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0;
 var $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0;
 var $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0;
 var $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0;
 var $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0;
 var $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0;
 var $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0;
 var $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0;
 var $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0;
 var $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0;
 var $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0;
 var $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0;
 var $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0;
 var $908 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0, $exitcond352 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 640|0;
 $2 = sp;
 $$0344 = 0;
 while(1) {
  $3 = $$0344 << 3;
  $4 = (($0) + ($3)|0);
  $5 = (_sph_dec64be_aligned($4)|0);
  $6 = tempRet0;
  $7 = (($2) + ($$0344<<3)|0);
  $8 = $7;
  $9 = $8;
  HEAP32[$9>>2] = $5;
  $10 = (($8) + 4)|0;
  $11 = $10;
  HEAP32[$11>>2] = $6;
  $12 = (($$0344) + 1)|0;
  $exitcond352 = ($12|0)==(16);
  if ($exitcond352) {
   $$1343 = 16;
   break;
  } else {
   $$0344 = $12;
  }
 }
 while(1) {
  $13 = (($$1343) + -2)|0;
  $14 = (($2) + ($13<<3)|0);
  $15 = $14;
  $16 = $15;
  $17 = HEAP32[$16>>2]|0;
  $18 = (($15) + 4)|0;
  $19 = $18;
  $20 = HEAP32[$19>>2]|0;
  $21 = (_bitshift64Shl(($17|0),($20|0),45)|0);
  $22 = tempRet0;
  $23 = (_bitshift64Lshr(($17|0),($20|0),19)|0);
  $24 = tempRet0;
  $25 = $21 | $23;
  $26 = $22 | $24;
  $27 = (_bitshift64Shl(($17|0),($20|0),3)|0);
  $28 = tempRet0;
  $29 = (_bitshift64Lshr(($17|0),($20|0),61)|0);
  $30 = tempRet0;
  $31 = $27 | $29;
  $32 = $28 | $30;
  $33 = (_bitshift64Lshr(($17|0),($20|0),6)|0);
  $34 = tempRet0;
  $35 = $31 ^ $33;
  $36 = $32 ^ $34;
  $37 = $35 ^ $25;
  $38 = $36 ^ $26;
  $39 = (($$1343) + -7)|0;
  $40 = (($2) + ($39<<3)|0);
  $41 = $40;
  $42 = $41;
  $43 = HEAP32[$42>>2]|0;
  $44 = (($41) + 4)|0;
  $45 = $44;
  $46 = HEAP32[$45>>2]|0;
  $47 = (($$1343) + -15)|0;
  $48 = (($2) + ($47<<3)|0);
  $49 = $48;
  $50 = $49;
  $51 = HEAP32[$50>>2]|0;
  $52 = (($49) + 4)|0;
  $53 = $52;
  $54 = HEAP32[$53>>2]|0;
  $55 = (_bitshift64Shl(($51|0),($54|0),63)|0);
  $56 = tempRet0;
  $57 = (_bitshift64Lshr(($51|0),($54|0),1)|0);
  $58 = tempRet0;
  $59 = $55 | $57;
  $60 = $56 | $58;
  $61 = (_bitshift64Shl(($51|0),($54|0),56)|0);
  $62 = tempRet0;
  $63 = (_bitshift64Lshr(($51|0),($54|0),8)|0);
  $64 = tempRet0;
  $65 = $61 | $63;
  $66 = $62 | $64;
  $67 = (_bitshift64Lshr(($51|0),($54|0),7)|0);
  $68 = tempRet0;
  $69 = $65 ^ $67;
  $70 = $66 ^ $68;
  $71 = $69 ^ $59;
  $72 = $70 ^ $60;
  $73 = (($$1343) + -16)|0;
  $74 = (($2) + ($73<<3)|0);
  $75 = $74;
  $76 = $75;
  $77 = HEAP32[$76>>2]|0;
  $78 = (($75) + 4)|0;
  $79 = $78;
  $80 = HEAP32[$79>>2]|0;
  $81 = (_i64Add(($77|0),($80|0),($43|0),($46|0))|0);
  $82 = tempRet0;
  $83 = (_i64Add(($81|0),($82|0),($37|0),($38|0))|0);
  $84 = tempRet0;
  $85 = (_i64Add(($83|0),($84|0),($71|0),($72|0))|0);
  $86 = tempRet0;
  $87 = (($2) + ($$1343<<3)|0);
  $88 = $87;
  $89 = $88;
  HEAP32[$89>>2] = $85;
  $90 = (($88) + 4)|0;
  $91 = $90;
  HEAP32[$91>>2] = $86;
  $92 = (($$1343) + 1)|0;
  $exitcond = ($92|0)==(80);
  if ($exitcond) {
   break;
  } else {
   $$1343 = $92;
  }
 }
 $93 = $1;
 $94 = $93;
 $95 = HEAP32[$94>>2]|0;
 $96 = (($93) + 4)|0;
 $97 = $96;
 $98 = HEAP32[$97>>2]|0;
 $99 = ((($1)) + 8|0);
 $100 = $99;
 $101 = $100;
 $102 = HEAP32[$101>>2]|0;
 $103 = (($100) + 4)|0;
 $104 = $103;
 $105 = HEAP32[$104>>2]|0;
 $106 = ((($1)) + 16|0);
 $107 = $106;
 $108 = $107;
 $109 = HEAP32[$108>>2]|0;
 $110 = (($107) + 4)|0;
 $111 = $110;
 $112 = HEAP32[$111>>2]|0;
 $113 = ((($1)) + 24|0);
 $114 = $113;
 $115 = $114;
 $116 = HEAP32[$115>>2]|0;
 $117 = (($114) + 4)|0;
 $118 = $117;
 $119 = HEAP32[$118>>2]|0;
 $120 = ((($1)) + 32|0);
 $121 = $120;
 $122 = $121;
 $123 = HEAP32[$122>>2]|0;
 $124 = (($121) + 4)|0;
 $125 = $124;
 $126 = HEAP32[$125>>2]|0;
 $127 = ((($1)) + 40|0);
 $128 = $127;
 $129 = $128;
 $130 = HEAP32[$129>>2]|0;
 $131 = (($128) + 4)|0;
 $132 = $131;
 $133 = HEAP32[$132>>2]|0;
 $134 = ((($1)) + 48|0);
 $135 = $134;
 $136 = $135;
 $137 = HEAP32[$136>>2]|0;
 $138 = (($135) + 4)|0;
 $139 = $138;
 $140 = HEAP32[$139>>2]|0;
 $141 = ((($1)) + 56|0);
 $142 = $141;
 $143 = $142;
 $144 = HEAP32[$143>>2]|0;
 $145 = (($142) + 4)|0;
 $146 = $145;
 $147 = HEAP32[$146>>2]|0;
 $$2342 = 0;$148 = $123;$149 = $126;$173 = $130;$174 = $137;$176 = $133;$177 = $140;$196 = $144;$197 = $147;$206 = $95;$207 = $98;$231 = $102;$233 = $105;$237 = $109;$239 = $112;$244 = $116;$245 = $119;
 while(1) {
  $150 = (_bitshift64Shl(($148|0),($149|0),50)|0);
  $151 = tempRet0;
  $152 = (_bitshift64Lshr(($148|0),($149|0),14)|0);
  $153 = tempRet0;
  $154 = $150 | $152;
  $155 = $151 | $153;
  $156 = (_bitshift64Shl(($148|0),($149|0),46)|0);
  $157 = tempRet0;
  $158 = (_bitshift64Lshr(($148|0),($149|0),18)|0);
  $159 = tempRet0;
  $160 = $156 | $158;
  $161 = $157 | $159;
  $162 = $154 ^ $160;
  $163 = $155 ^ $161;
  $164 = (_bitshift64Shl(($148|0),($149|0),23)|0);
  $165 = tempRet0;
  $166 = (_bitshift64Lshr(($148|0),($149|0),41)|0);
  $167 = tempRet0;
  $168 = $164 | $166;
  $169 = $165 | $167;
  $170 = $162 ^ $168;
  $171 = $163 ^ $169;
  $172 = $173 ^ $174;
  $175 = $176 ^ $177;
  $178 = $172 & $148;
  $179 = $175 & $149;
  $180 = $178 ^ $174;
  $181 = $179 ^ $177;
  $182 = (72 + ($$2342<<3)|0);
  $183 = $182;
  $184 = $183;
  $185 = HEAP32[$184>>2]|0;
  $186 = (($183) + 4)|0;
  $187 = $186;
  $188 = HEAP32[$187>>2]|0;
  $189 = (($2) + ($$2342<<3)|0);
  $190 = $189;
  $191 = $190;
  $192 = HEAP32[$191>>2]|0;
  $193 = (($190) + 4)|0;
  $194 = $193;
  $195 = HEAP32[$194>>2]|0;
  $198 = (_i64Add(($180|0),($181|0),($196|0),($197|0))|0);
  $199 = tempRet0;
  $200 = (_i64Add(($198|0),($199|0),($170|0),($171|0))|0);
  $201 = tempRet0;
  $202 = (_i64Add(($200|0),($201|0),($185|0),($188|0))|0);
  $203 = tempRet0;
  $204 = (_i64Add(($202|0),($203|0),($192|0),($195|0))|0);
  $205 = tempRet0;
  $208 = (_bitshift64Shl(($206|0),($207|0),36)|0);
  $209 = tempRet0;
  $210 = (_bitshift64Lshr(($206|0),($207|0),28)|0);
  $211 = tempRet0;
  $212 = $208 | $210;
  $213 = $209 | $211;
  $214 = (_bitshift64Shl(($206|0),($207|0),30)|0);
  $215 = tempRet0;
  $216 = (_bitshift64Lshr(($206|0),($207|0),34)|0);
  $217 = tempRet0;
  $218 = $214 | $216;
  $219 = $215 | $217;
  $220 = $212 ^ $218;
  $221 = $213 ^ $219;
  $222 = (_bitshift64Shl(($206|0),($207|0),25)|0);
  $223 = tempRet0;
  $224 = (_bitshift64Lshr(($206|0),($207|0),39)|0);
  $225 = tempRet0;
  $226 = $222 | $224;
  $227 = $223 | $225;
  $228 = $220 ^ $226;
  $229 = $221 ^ $227;
  $230 = $206 & $231;
  $232 = $207 & $233;
  $234 = $206 | $231;
  $235 = $207 | $233;
  $236 = $234 & $237;
  $238 = $235 & $239;
  $240 = $236 | $230;
  $241 = $238 | $232;
  $242 = (_i64Add(($228|0),($229|0),($240|0),($241|0))|0);
  $243 = tempRet0;
  $246 = (_i64Add(($204|0),($205|0),($244|0),($245|0))|0);
  $247 = tempRet0;
  $248 = (_i64Add(($242|0),($243|0),($204|0),($205|0))|0);
  $249 = tempRet0;
  $250 = (_bitshift64Shl(($246|0),($247|0),50)|0);
  $251 = tempRet0;
  $252 = (_bitshift64Lshr(($246|0),($247|0),14)|0);
  $253 = tempRet0;
  $254 = $250 | $252;
  $255 = $251 | $253;
  $256 = (_bitshift64Shl(($246|0),($247|0),46)|0);
  $257 = tempRet0;
  $258 = (_bitshift64Lshr(($246|0),($247|0),18)|0);
  $259 = tempRet0;
  $260 = $256 | $258;
  $261 = $257 | $259;
  $262 = $254 ^ $260;
  $263 = $255 ^ $261;
  $264 = (_bitshift64Shl(($246|0),($247|0),23)|0);
  $265 = tempRet0;
  $266 = (_bitshift64Lshr(($246|0),($247|0),41)|0);
  $267 = tempRet0;
  $268 = $264 | $266;
  $269 = $265 | $267;
  $270 = $262 ^ $268;
  $271 = $263 ^ $269;
  $272 = $148 ^ $173;
  $273 = $149 ^ $176;
  $274 = $246 & $272;
  $275 = $247 & $273;
  $276 = $274 ^ $173;
  $277 = $275 ^ $176;
  $278 = $$2342 | 1;
  $279 = (72 + ($278<<3)|0);
  $280 = $279;
  $281 = $280;
  $282 = HEAP32[$281>>2]|0;
  $283 = (($280) + 4)|0;
  $284 = $283;
  $285 = HEAP32[$284>>2]|0;
  $286 = (($2) + ($278<<3)|0);
  $287 = $286;
  $288 = $287;
  $289 = HEAP32[$288>>2]|0;
  $290 = (($287) + 4)|0;
  $291 = $290;
  $292 = HEAP32[$291>>2]|0;
  $293 = (_i64Add(($282|0),($285|0),($174|0),($177|0))|0);
  $294 = tempRet0;
  $295 = (_i64Add(($293|0),($294|0),($289|0),($292|0))|0);
  $296 = tempRet0;
  $297 = (_i64Add(($295|0),($296|0),($276|0),($277|0))|0);
  $298 = tempRet0;
  $299 = (_i64Add(($297|0),($298|0),($270|0),($271|0))|0);
  $300 = tempRet0;
  $301 = (_bitshift64Shl(($248|0),($249|0),36)|0);
  $302 = tempRet0;
  $303 = (_bitshift64Lshr(($248|0),($249|0),28)|0);
  $304 = tempRet0;
  $305 = $301 | $303;
  $306 = $302 | $304;
  $307 = (_bitshift64Shl(($248|0),($249|0),30)|0);
  $308 = tempRet0;
  $309 = (_bitshift64Lshr(($248|0),($249|0),34)|0);
  $310 = tempRet0;
  $311 = $307 | $309;
  $312 = $308 | $310;
  $313 = $305 ^ $311;
  $314 = $306 ^ $312;
  $315 = (_bitshift64Shl(($248|0),($249|0),25)|0);
  $316 = tempRet0;
  $317 = (_bitshift64Lshr(($248|0),($249|0),39)|0);
  $318 = tempRet0;
  $319 = $315 | $317;
  $320 = $316 | $318;
  $321 = $313 ^ $319;
  $322 = $314 ^ $320;
  $323 = $248 & $206;
  $324 = $249 & $207;
  $325 = $248 | $206;
  $326 = $249 | $207;
  $327 = $325 & $231;
  $328 = $326 & $233;
  $329 = $327 | $323;
  $330 = $328 | $324;
  $331 = (_i64Add(($321|0),($322|0),($329|0),($330|0))|0);
  $332 = tempRet0;
  $333 = (_i64Add(($299|0),($300|0),($237|0),($239|0))|0);
  $334 = tempRet0;
  $335 = (_i64Add(($331|0),($332|0),($299|0),($300|0))|0);
  $336 = tempRet0;
  $337 = (_bitshift64Shl(($333|0),($334|0),50)|0);
  $338 = tempRet0;
  $339 = (_bitshift64Lshr(($333|0),($334|0),14)|0);
  $340 = tempRet0;
  $341 = $337 | $339;
  $342 = $338 | $340;
  $343 = (_bitshift64Shl(($333|0),($334|0),46)|0);
  $344 = tempRet0;
  $345 = (_bitshift64Lshr(($333|0),($334|0),18)|0);
  $346 = tempRet0;
  $347 = $343 | $345;
  $348 = $344 | $346;
  $349 = $341 ^ $347;
  $350 = $342 ^ $348;
  $351 = (_bitshift64Shl(($333|0),($334|0),23)|0);
  $352 = tempRet0;
  $353 = (_bitshift64Lshr(($333|0),($334|0),41)|0);
  $354 = tempRet0;
  $355 = $351 | $353;
  $356 = $352 | $354;
  $357 = $349 ^ $355;
  $358 = $350 ^ $356;
  $359 = $246 ^ $148;
  $360 = $247 ^ $149;
  $361 = $333 & $359;
  $362 = $334 & $360;
  $363 = $361 ^ $148;
  $364 = $362 ^ $149;
  $365 = $$2342 | 2;
  $366 = (72 + ($365<<3)|0);
  $367 = $366;
  $368 = $367;
  $369 = HEAP32[$368>>2]|0;
  $370 = (($367) + 4)|0;
  $371 = $370;
  $372 = HEAP32[$371>>2]|0;
  $373 = (($2) + ($365<<3)|0);
  $374 = $373;
  $375 = $374;
  $376 = HEAP32[$375>>2]|0;
  $377 = (($374) + 4)|0;
  $378 = $377;
  $379 = HEAP32[$378>>2]|0;
  $380 = (_i64Add(($369|0),($372|0),($173|0),($176|0))|0);
  $381 = tempRet0;
  $382 = (_i64Add(($380|0),($381|0),($376|0),($379|0))|0);
  $383 = tempRet0;
  $384 = (_i64Add(($382|0),($383|0),($363|0),($364|0))|0);
  $385 = tempRet0;
  $386 = (_i64Add(($384|0),($385|0),($357|0),($358|0))|0);
  $387 = tempRet0;
  $388 = (_bitshift64Shl(($335|0),($336|0),36)|0);
  $389 = tempRet0;
  $390 = (_bitshift64Lshr(($335|0),($336|0),28)|0);
  $391 = tempRet0;
  $392 = $388 | $390;
  $393 = $389 | $391;
  $394 = (_bitshift64Shl(($335|0),($336|0),30)|0);
  $395 = tempRet0;
  $396 = (_bitshift64Lshr(($335|0),($336|0),34)|0);
  $397 = tempRet0;
  $398 = $394 | $396;
  $399 = $395 | $397;
  $400 = $392 ^ $398;
  $401 = $393 ^ $399;
  $402 = (_bitshift64Shl(($335|0),($336|0),25)|0);
  $403 = tempRet0;
  $404 = (_bitshift64Lshr(($335|0),($336|0),39)|0);
  $405 = tempRet0;
  $406 = $402 | $404;
  $407 = $403 | $405;
  $408 = $400 ^ $406;
  $409 = $401 ^ $407;
  $410 = $335 & $248;
  $411 = $336 & $249;
  $412 = $335 | $248;
  $413 = $336 | $249;
  $414 = $412 & $206;
  $415 = $413 & $207;
  $416 = $414 | $410;
  $417 = $415 | $411;
  $418 = (_i64Add(($408|0),($409|0),($416|0),($417|0))|0);
  $419 = tempRet0;
  $420 = (_i64Add(($386|0),($387|0),($231|0),($233|0))|0);
  $421 = tempRet0;
  $422 = (_i64Add(($418|0),($419|0),($386|0),($387|0))|0);
  $423 = tempRet0;
  $424 = (_bitshift64Shl(($420|0),($421|0),50)|0);
  $425 = tempRet0;
  $426 = (_bitshift64Lshr(($420|0),($421|0),14)|0);
  $427 = tempRet0;
  $428 = $424 | $426;
  $429 = $425 | $427;
  $430 = (_bitshift64Shl(($420|0),($421|0),46)|0);
  $431 = tempRet0;
  $432 = (_bitshift64Lshr(($420|0),($421|0),18)|0);
  $433 = tempRet0;
  $434 = $430 | $432;
  $435 = $431 | $433;
  $436 = $428 ^ $434;
  $437 = $429 ^ $435;
  $438 = (_bitshift64Shl(($420|0),($421|0),23)|0);
  $439 = tempRet0;
  $440 = (_bitshift64Lshr(($420|0),($421|0),41)|0);
  $441 = tempRet0;
  $442 = $438 | $440;
  $443 = $439 | $441;
  $444 = $436 ^ $442;
  $445 = $437 ^ $443;
  $446 = $333 ^ $246;
  $447 = $334 ^ $247;
  $448 = $420 & $446;
  $449 = $421 & $447;
  $450 = $448 ^ $246;
  $451 = $449 ^ $247;
  $452 = $$2342 | 3;
  $453 = (72 + ($452<<3)|0);
  $454 = $453;
  $455 = $454;
  $456 = HEAP32[$455>>2]|0;
  $457 = (($454) + 4)|0;
  $458 = $457;
  $459 = HEAP32[$458>>2]|0;
  $460 = (($2) + ($452<<3)|0);
  $461 = $460;
  $462 = $461;
  $463 = HEAP32[$462>>2]|0;
  $464 = (($461) + 4)|0;
  $465 = $464;
  $466 = HEAP32[$465>>2]|0;
  $467 = (_i64Add(($456|0),($459|0),($148|0),($149|0))|0);
  $468 = tempRet0;
  $469 = (_i64Add(($467|0),($468|0),($463|0),($466|0))|0);
  $470 = tempRet0;
  $471 = (_i64Add(($469|0),($470|0),($450|0),($451|0))|0);
  $472 = tempRet0;
  $473 = (_i64Add(($471|0),($472|0),($444|0),($445|0))|0);
  $474 = tempRet0;
  $475 = (_bitshift64Shl(($422|0),($423|0),36)|0);
  $476 = tempRet0;
  $477 = (_bitshift64Lshr(($422|0),($423|0),28)|0);
  $478 = tempRet0;
  $479 = $475 | $477;
  $480 = $476 | $478;
  $481 = (_bitshift64Shl(($422|0),($423|0),30)|0);
  $482 = tempRet0;
  $483 = (_bitshift64Lshr(($422|0),($423|0),34)|0);
  $484 = tempRet0;
  $485 = $481 | $483;
  $486 = $482 | $484;
  $487 = $479 ^ $485;
  $488 = $480 ^ $486;
  $489 = (_bitshift64Shl(($422|0),($423|0),25)|0);
  $490 = tempRet0;
  $491 = (_bitshift64Lshr(($422|0),($423|0),39)|0);
  $492 = tempRet0;
  $493 = $489 | $491;
  $494 = $490 | $492;
  $495 = $487 ^ $493;
  $496 = $488 ^ $494;
  $497 = $422 & $335;
  $498 = $423 & $336;
  $499 = $422 | $335;
  $500 = $423 | $336;
  $501 = $499 & $248;
  $502 = $500 & $249;
  $503 = $501 | $497;
  $504 = $502 | $498;
  $505 = (_i64Add(($495|0),($496|0),($503|0),($504|0))|0);
  $506 = tempRet0;
  $507 = (_i64Add(($473|0),($474|0),($206|0),($207|0))|0);
  $508 = tempRet0;
  $509 = (_i64Add(($505|0),($506|0),($473|0),($474|0))|0);
  $510 = tempRet0;
  $511 = (_bitshift64Shl(($507|0),($508|0),50)|0);
  $512 = tempRet0;
  $513 = (_bitshift64Lshr(($507|0),($508|0),14)|0);
  $514 = tempRet0;
  $515 = $511 | $513;
  $516 = $512 | $514;
  $517 = (_bitshift64Shl(($507|0),($508|0),46)|0);
  $518 = tempRet0;
  $519 = (_bitshift64Lshr(($507|0),($508|0),18)|0);
  $520 = tempRet0;
  $521 = $517 | $519;
  $522 = $518 | $520;
  $523 = $515 ^ $521;
  $524 = $516 ^ $522;
  $525 = (_bitshift64Shl(($507|0),($508|0),23)|0);
  $526 = tempRet0;
  $527 = (_bitshift64Lshr(($507|0),($508|0),41)|0);
  $528 = tempRet0;
  $529 = $525 | $527;
  $530 = $526 | $528;
  $531 = $523 ^ $529;
  $532 = $524 ^ $530;
  $533 = $420 ^ $333;
  $534 = $421 ^ $334;
  $535 = $507 & $533;
  $536 = $508 & $534;
  $537 = $535 ^ $333;
  $538 = $536 ^ $334;
  $539 = $$2342 | 4;
  $540 = (72 + ($539<<3)|0);
  $541 = $540;
  $542 = $541;
  $543 = HEAP32[$542>>2]|0;
  $544 = (($541) + 4)|0;
  $545 = $544;
  $546 = HEAP32[$545>>2]|0;
  $547 = (($2) + ($539<<3)|0);
  $548 = $547;
  $549 = $548;
  $550 = HEAP32[$549>>2]|0;
  $551 = (($548) + 4)|0;
  $552 = $551;
  $553 = HEAP32[$552>>2]|0;
  $554 = (_i64Add(($543|0),($546|0),($246|0),($247|0))|0);
  $555 = tempRet0;
  $556 = (_i64Add(($554|0),($555|0),($550|0),($553|0))|0);
  $557 = tempRet0;
  $558 = (_i64Add(($556|0),($557|0),($537|0),($538|0))|0);
  $559 = tempRet0;
  $560 = (_i64Add(($558|0),($559|0),($531|0),($532|0))|0);
  $561 = tempRet0;
  $562 = (_bitshift64Shl(($509|0),($510|0),36)|0);
  $563 = tempRet0;
  $564 = (_bitshift64Lshr(($509|0),($510|0),28)|0);
  $565 = tempRet0;
  $566 = $562 | $564;
  $567 = $563 | $565;
  $568 = (_bitshift64Shl(($509|0),($510|0),30)|0);
  $569 = tempRet0;
  $570 = (_bitshift64Lshr(($509|0),($510|0),34)|0);
  $571 = tempRet0;
  $572 = $568 | $570;
  $573 = $569 | $571;
  $574 = $566 ^ $572;
  $575 = $567 ^ $573;
  $576 = (_bitshift64Shl(($509|0),($510|0),25)|0);
  $577 = tempRet0;
  $578 = (_bitshift64Lshr(($509|0),($510|0),39)|0);
  $579 = tempRet0;
  $580 = $576 | $578;
  $581 = $577 | $579;
  $582 = $574 ^ $580;
  $583 = $575 ^ $581;
  $584 = $509 & $422;
  $585 = $510 & $423;
  $586 = $509 | $422;
  $587 = $510 | $423;
  $588 = $586 & $335;
  $589 = $587 & $336;
  $590 = $588 | $584;
  $591 = $589 | $585;
  $592 = (_i64Add(($582|0),($583|0),($590|0),($591|0))|0);
  $593 = tempRet0;
  $594 = (_i64Add(($560|0),($561|0),($248|0),($249|0))|0);
  $595 = tempRet0;
  $596 = (_i64Add(($592|0),($593|0),($560|0),($561|0))|0);
  $597 = tempRet0;
  $598 = (_bitshift64Shl(($594|0),($595|0),50)|0);
  $599 = tempRet0;
  $600 = (_bitshift64Lshr(($594|0),($595|0),14)|0);
  $601 = tempRet0;
  $602 = $598 | $600;
  $603 = $599 | $601;
  $604 = (_bitshift64Shl(($594|0),($595|0),46)|0);
  $605 = tempRet0;
  $606 = (_bitshift64Lshr(($594|0),($595|0),18)|0);
  $607 = tempRet0;
  $608 = $604 | $606;
  $609 = $605 | $607;
  $610 = $602 ^ $608;
  $611 = $603 ^ $609;
  $612 = (_bitshift64Shl(($594|0),($595|0),23)|0);
  $613 = tempRet0;
  $614 = (_bitshift64Lshr(($594|0),($595|0),41)|0);
  $615 = tempRet0;
  $616 = $612 | $614;
  $617 = $613 | $615;
  $618 = $610 ^ $616;
  $619 = $611 ^ $617;
  $620 = $507 ^ $420;
  $621 = $508 ^ $421;
  $622 = $594 & $620;
  $623 = $595 & $621;
  $624 = $622 ^ $420;
  $625 = $623 ^ $421;
  $626 = $$2342 | 5;
  $627 = (72 + ($626<<3)|0);
  $628 = $627;
  $629 = $628;
  $630 = HEAP32[$629>>2]|0;
  $631 = (($628) + 4)|0;
  $632 = $631;
  $633 = HEAP32[$632>>2]|0;
  $634 = (($2) + ($626<<3)|0);
  $635 = $634;
  $636 = $635;
  $637 = HEAP32[$636>>2]|0;
  $638 = (($635) + 4)|0;
  $639 = $638;
  $640 = HEAP32[$639>>2]|0;
  $641 = (_i64Add(($637|0),($640|0),($630|0),($633|0))|0);
  $642 = tempRet0;
  $643 = (_i64Add(($641|0),($642|0),($333|0),($334|0))|0);
  $644 = tempRet0;
  $645 = (_i64Add(($643|0),($644|0),($624|0),($625|0))|0);
  $646 = tempRet0;
  $647 = (_i64Add(($645|0),($646|0),($618|0),($619|0))|0);
  $648 = tempRet0;
  $649 = (_bitshift64Shl(($596|0),($597|0),36)|0);
  $650 = tempRet0;
  $651 = (_bitshift64Lshr(($596|0),($597|0),28)|0);
  $652 = tempRet0;
  $653 = $649 | $651;
  $654 = $650 | $652;
  $655 = (_bitshift64Shl(($596|0),($597|0),30)|0);
  $656 = tempRet0;
  $657 = (_bitshift64Lshr(($596|0),($597|0),34)|0);
  $658 = tempRet0;
  $659 = $655 | $657;
  $660 = $656 | $658;
  $661 = $653 ^ $659;
  $662 = $654 ^ $660;
  $663 = (_bitshift64Shl(($596|0),($597|0),25)|0);
  $664 = tempRet0;
  $665 = (_bitshift64Lshr(($596|0),($597|0),39)|0);
  $666 = tempRet0;
  $667 = $663 | $665;
  $668 = $664 | $666;
  $669 = $661 ^ $667;
  $670 = $662 ^ $668;
  $671 = $596 & $509;
  $672 = $597 & $510;
  $673 = $596 | $509;
  $674 = $597 | $510;
  $675 = $673 & $422;
  $676 = $674 & $423;
  $677 = $675 | $671;
  $678 = $676 | $672;
  $679 = (_i64Add(($669|0),($670|0),($677|0),($678|0))|0);
  $680 = tempRet0;
  $681 = (_i64Add(($647|0),($648|0),($335|0),($336|0))|0);
  $682 = tempRet0;
  $683 = (_i64Add(($679|0),($680|0),($647|0),($648|0))|0);
  $684 = tempRet0;
  $685 = (_bitshift64Shl(($681|0),($682|0),50)|0);
  $686 = tempRet0;
  $687 = (_bitshift64Lshr(($681|0),($682|0),14)|0);
  $688 = tempRet0;
  $689 = $685 | $687;
  $690 = $686 | $688;
  $691 = (_bitshift64Shl(($681|0),($682|0),46)|0);
  $692 = tempRet0;
  $693 = (_bitshift64Lshr(($681|0),($682|0),18)|0);
  $694 = tempRet0;
  $695 = $691 | $693;
  $696 = $692 | $694;
  $697 = $689 ^ $695;
  $698 = $690 ^ $696;
  $699 = (_bitshift64Shl(($681|0),($682|0),23)|0);
  $700 = tempRet0;
  $701 = (_bitshift64Lshr(($681|0),($682|0),41)|0);
  $702 = tempRet0;
  $703 = $699 | $701;
  $704 = $700 | $702;
  $705 = $697 ^ $703;
  $706 = $698 ^ $704;
  $707 = $594 ^ $507;
  $708 = $595 ^ $508;
  $709 = $681 & $707;
  $710 = $682 & $708;
  $711 = $709 ^ $507;
  $712 = $710 ^ $508;
  $713 = $$2342 | 6;
  $714 = (72 + ($713<<3)|0);
  $715 = $714;
  $716 = $715;
  $717 = HEAP32[$716>>2]|0;
  $718 = (($715) + 4)|0;
  $719 = $718;
  $720 = HEAP32[$719>>2]|0;
  $721 = (($2) + ($713<<3)|0);
  $722 = $721;
  $723 = $722;
  $724 = HEAP32[$723>>2]|0;
  $725 = (($722) + 4)|0;
  $726 = $725;
  $727 = HEAP32[$726>>2]|0;
  $728 = (_i64Add(($724|0),($727|0),($717|0),($720|0))|0);
  $729 = tempRet0;
  $730 = (_i64Add(($728|0),($729|0),($420|0),($421|0))|0);
  $731 = tempRet0;
  $732 = (_i64Add(($730|0),($731|0),($711|0),($712|0))|0);
  $733 = tempRet0;
  $734 = (_i64Add(($732|0),($733|0),($705|0),($706|0))|0);
  $735 = tempRet0;
  $736 = (_bitshift64Shl(($683|0),($684|0),36)|0);
  $737 = tempRet0;
  $738 = (_bitshift64Lshr(($683|0),($684|0),28)|0);
  $739 = tempRet0;
  $740 = $736 | $738;
  $741 = $737 | $739;
  $742 = (_bitshift64Shl(($683|0),($684|0),30)|0);
  $743 = tempRet0;
  $744 = (_bitshift64Lshr(($683|0),($684|0),34)|0);
  $745 = tempRet0;
  $746 = $742 | $744;
  $747 = $743 | $745;
  $748 = $740 ^ $746;
  $749 = $741 ^ $747;
  $750 = (_bitshift64Shl(($683|0),($684|0),25)|0);
  $751 = tempRet0;
  $752 = (_bitshift64Lshr(($683|0),($684|0),39)|0);
  $753 = tempRet0;
  $754 = $750 | $752;
  $755 = $751 | $753;
  $756 = $748 ^ $754;
  $757 = $749 ^ $755;
  $758 = $683 & $596;
  $759 = $684 & $597;
  $760 = $683 | $596;
  $761 = $684 | $597;
  $762 = $760 & $509;
  $763 = $761 & $510;
  $764 = $762 | $758;
  $765 = $763 | $759;
  $766 = (_i64Add(($756|0),($757|0),($764|0),($765|0))|0);
  $767 = tempRet0;
  $768 = (_i64Add(($734|0),($735|0),($422|0),($423|0))|0);
  $769 = tempRet0;
  $770 = (_i64Add(($766|0),($767|0),($734|0),($735|0))|0);
  $771 = tempRet0;
  $772 = (_bitshift64Shl(($768|0),($769|0),50)|0);
  $773 = tempRet0;
  $774 = (_bitshift64Lshr(($768|0),($769|0),14)|0);
  $775 = tempRet0;
  $776 = $772 | $774;
  $777 = $773 | $775;
  $778 = (_bitshift64Shl(($768|0),($769|0),46)|0);
  $779 = tempRet0;
  $780 = (_bitshift64Lshr(($768|0),($769|0),18)|0);
  $781 = tempRet0;
  $782 = $778 | $780;
  $783 = $779 | $781;
  $784 = $776 ^ $782;
  $785 = $777 ^ $783;
  $786 = (_bitshift64Shl(($768|0),($769|0),23)|0);
  $787 = tempRet0;
  $788 = (_bitshift64Lshr(($768|0),($769|0),41)|0);
  $789 = tempRet0;
  $790 = $786 | $788;
  $791 = $787 | $789;
  $792 = $784 ^ $790;
  $793 = $785 ^ $791;
  $794 = $681 ^ $594;
  $795 = $682 ^ $595;
  $796 = $768 & $794;
  $797 = $769 & $795;
  $798 = $796 ^ $594;
  $799 = $797 ^ $595;
  $800 = $$2342 | 7;
  $801 = (72 + ($800<<3)|0);
  $802 = $801;
  $803 = $802;
  $804 = HEAP32[$803>>2]|0;
  $805 = (($802) + 4)|0;
  $806 = $805;
  $807 = HEAP32[$806>>2]|0;
  $808 = (($2) + ($800<<3)|0);
  $809 = $808;
  $810 = $809;
  $811 = HEAP32[$810>>2]|0;
  $812 = (($809) + 4)|0;
  $813 = $812;
  $814 = HEAP32[$813>>2]|0;
  $815 = (_i64Add(($811|0),($814|0),($804|0),($807|0))|0);
  $816 = tempRet0;
  $817 = (_i64Add(($815|0),($816|0),($507|0),($508|0))|0);
  $818 = tempRet0;
  $819 = (_i64Add(($817|0),($818|0),($798|0),($799|0))|0);
  $820 = tempRet0;
  $821 = (_i64Add(($819|0),($820|0),($792|0),($793|0))|0);
  $822 = tempRet0;
  $823 = (_bitshift64Shl(($770|0),($771|0),36)|0);
  $824 = tempRet0;
  $825 = (_bitshift64Lshr(($770|0),($771|0),28)|0);
  $826 = tempRet0;
  $827 = $823 | $825;
  $828 = $824 | $826;
  $829 = (_bitshift64Shl(($770|0),($771|0),30)|0);
  $830 = tempRet0;
  $831 = (_bitshift64Lshr(($770|0),($771|0),34)|0);
  $832 = tempRet0;
  $833 = $829 | $831;
  $834 = $830 | $832;
  $835 = $827 ^ $833;
  $836 = $828 ^ $834;
  $837 = (_bitshift64Shl(($770|0),($771|0),25)|0);
  $838 = tempRet0;
  $839 = (_bitshift64Lshr(($770|0),($771|0),39)|0);
  $840 = tempRet0;
  $841 = $837 | $839;
  $842 = $838 | $840;
  $843 = $835 ^ $841;
  $844 = $836 ^ $842;
  $845 = $770 & $683;
  $846 = $771 & $684;
  $847 = $770 | $683;
  $848 = $771 | $684;
  $849 = $847 & $596;
  $850 = $848 & $597;
  $851 = $849 | $845;
  $852 = $850 | $846;
  $853 = (_i64Add(($843|0),($844|0),($851|0),($852|0))|0);
  $854 = tempRet0;
  $855 = (_i64Add(($821|0),($822|0),($509|0),($510|0))|0);
  $856 = tempRet0;
  $857 = (_i64Add(($853|0),($854|0),($821|0),($822|0))|0);
  $858 = tempRet0;
  $859 = (($$2342) + 8)|0;
  $860 = ($859|0)<(80);
  if ($860) {
   $$2342 = $859;$148 = $855;$149 = $856;$173 = $768;$174 = $681;$176 = $769;$177 = $682;$196 = $594;$197 = $595;$206 = $857;$207 = $858;$231 = $770;$233 = $771;$237 = $683;$239 = $684;$244 = $596;$245 = $597;
  } else {
   break;
  }
 }
 $861 = (_i64Add(($857|0),($858|0),($95|0),($98|0))|0);
 $862 = tempRet0;
 $863 = $1;
 $864 = $863;
 HEAP32[$864>>2] = $861;
 $865 = (($863) + 4)|0;
 $866 = $865;
 HEAP32[$866>>2] = $862;
 $867 = (_i64Add(($770|0),($771|0),($102|0),($105|0))|0);
 $868 = tempRet0;
 $869 = $99;
 $870 = $869;
 HEAP32[$870>>2] = $867;
 $871 = (($869) + 4)|0;
 $872 = $871;
 HEAP32[$872>>2] = $868;
 $873 = (_i64Add(($683|0),($684|0),($109|0),($112|0))|0);
 $874 = tempRet0;
 $875 = $106;
 $876 = $875;
 HEAP32[$876>>2] = $873;
 $877 = (($875) + 4)|0;
 $878 = $877;
 HEAP32[$878>>2] = $874;
 $879 = (_i64Add(($596|0),($597|0),($116|0),($119|0))|0);
 $880 = tempRet0;
 $881 = $113;
 $882 = $881;
 HEAP32[$882>>2] = $879;
 $883 = (($881) + 4)|0;
 $884 = $883;
 HEAP32[$884>>2] = $880;
 $885 = (_i64Add(($855|0),($856|0),($123|0),($126|0))|0);
 $886 = tempRet0;
 $887 = $120;
 $888 = $887;
 HEAP32[$888>>2] = $885;
 $889 = (($887) + 4)|0;
 $890 = $889;
 HEAP32[$890>>2] = $886;
 $891 = (_i64Add(($768|0),($769|0),($130|0),($133|0))|0);
 $892 = tempRet0;
 $893 = $127;
 $894 = $893;
 HEAP32[$894>>2] = $891;
 $895 = (($893) + 4)|0;
 $896 = $895;
 HEAP32[$896>>2] = $892;
 $897 = (_i64Add(($681|0),($682|0),($137|0),($140|0))|0);
 $898 = tempRet0;
 $899 = $134;
 $900 = $899;
 HEAP32[$900>>2] = $897;
 $901 = (($899) + 4)|0;
 $902 = $901;
 HEAP32[$902>>2] = $898;
 $903 = (_i64Add(($594|0),($595|0),($144|0),($147|0))|0);
 $904 = tempRet0;
 $905 = $141;
 $906 = $905;
 HEAP32[$906>>2] = $903;
 $907 = (($905) + 4)|0;
 $908 = $907;
 HEAP32[$908>>2] = $904;
 STACKTOP = sp;return;
}
function _sph_dec64be_aligned($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = $1&255;
 $3 = (_bitshift64Shl(($2|0),0,56)|0);
 $4 = tempRet0;
 $5 = ((($0)) + 1|0);
 $6 = HEAP8[$5>>0]|0;
 $7 = $6&255;
 $8 = (_bitshift64Shl(($7|0),0,48)|0);
 $9 = tempRet0;
 $10 = $8 | $3;
 $11 = $9 | $4;
 $12 = ((($0)) + 2|0);
 $13 = HEAP8[$12>>0]|0;
 $14 = $13&255;
 $15 = (_bitshift64Shl(($14|0),0,40)|0);
 $16 = tempRet0;
 $17 = $10 | $15;
 $18 = $11 | $16;
 $19 = ((($0)) + 3|0);
 $20 = HEAP8[$19>>0]|0;
 $21 = $20&255;
 $22 = $18 | $21;
 $23 = ((($0)) + 4|0);
 $24 = HEAP8[$23>>0]|0;
 $25 = $24&255;
 $26 = (_bitshift64Shl(($25|0),0,24)|0);
 $27 = tempRet0;
 $28 = $17 | $26;
 $29 = $22 | $27;
 $30 = ((($0)) + 5|0);
 $31 = HEAP8[$30>>0]|0;
 $32 = $31&255;
 $33 = (_bitshift64Shl(($32|0),0,16)|0);
 $34 = tempRet0;
 $35 = $28 | $33;
 $36 = $29 | $34;
 $37 = ((($0)) + 6|0);
 $38 = HEAP8[$37>>0]|0;
 $39 = $38&255;
 $40 = (_bitshift64Shl(($39|0),0,8)|0);
 $41 = tempRet0;
 $42 = $35 | $40;
 $43 = $36 | $41;
 $44 = ((($0)) + 7|0);
 $45 = HEAP8[$44>>0]|0;
 $46 = $45&255;
 $47 = $42 | $46;
 tempRet0 = ($43);
 return ($47|0);
}
function _sha384_close($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _sha384_addbits_and_close($0,0,0,$1,$2);
 return;
}
function _sha384_addbits_and_close($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$035 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 $5 = ((($0)) + 192|0);
 $6 = $5;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $9 = (($6) + 4)|0;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = $8 & 127;
 $13 = 128 >>> $2;
 $14 = (0 - ($13))|0;
 $15 = $14 & $1;
 $16 = $15 | $13;
 $17 = $16&255;
 $18 = (($12) + 1)|0;
 $19 = (($0) + ($12)|0);
 HEAP8[$19>>0] = $17;
 $20 = ($18>>>0)>(112);
 $21 = (($0) + ($18)|0);
 if ($20) {
  $22 = $12 ^ 127;
  _memset(($21|0),0,($22|0))|0;
  $23 = ((($0)) + 128|0);
  _sha3_round($0,$23);
  dest=$0; stop=dest+112|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 } else {
  $24 = (111 - ($12))|0;
  _memset(($21|0),0,($24|0))|0;
 }
 $25 = ((($0)) + 112|0);
 $26 = $5;
 $27 = $26;
 $28 = HEAP32[$27>>2]|0;
 $29 = (($26) + 4)|0;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = (_bitshift64Lshr(($28|0),($31|0),61)|0);
 $33 = tempRet0;
 _sph_enc64be_aligned($25,$32,$33);
 $34 = ((($0)) + 120|0);
 $35 = $5;
 $36 = $35;
 $37 = HEAP32[$36>>2]|0;
 $38 = (($35) + 4)|0;
 $39 = $38;
 $40 = HEAP32[$39>>2]|0;
 $41 = (_bitshift64Shl(($37|0),($40|0),3)|0);
 $42 = tempRet0;
 $43 = (_i64Add(($41|0),($42|0),($2|0),0)|0);
 $44 = tempRet0;
 _sph_enc64be_aligned($34,$43,$44);
 $45 = ((($0)) + 128|0);
 _sha3_round($0,$45);
 $46 = ($4|0)==(0);
 if ($46) {
  return;
 } else {
  $$035 = 0;
 }
 while(1) {
  $47 = $$035 << 3;
  $48 = (($3) + ($47)|0);
  $49 = (($45) + ($$035<<3)|0);
  $50 = $49;
  $51 = $50;
  $52 = HEAP32[$51>>2]|0;
  $53 = (($50) + 4)|0;
  $54 = $53;
  $55 = HEAP32[$54>>2]|0;
  _sph_enc64be($48,$52,$55);
  $56 = (($$035) + 1)|0;
  $exitcond = ($56|0)==($4|0);
  if ($exitcond) {
   break;
  } else {
   $$035 = $56;
  }
 }
 return;
}
function _sph_enc64be_aligned($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Lshr(($1|0),($2|0),56)|0);
 $4 = tempRet0;
 $5 = $3&255;
 HEAP8[$0>>0] = $5;
 $6 = (_bitshift64Lshr(($1|0),($2|0),48)|0);
 $7 = tempRet0;
 $8 = $6&255;
 $9 = ((($0)) + 1|0);
 HEAP8[$9>>0] = $8;
 $10 = (_bitshift64Lshr(($1|0),($2|0),40)|0);
 $11 = tempRet0;
 $12 = $10&255;
 $13 = ((($0)) + 2|0);
 HEAP8[$13>>0] = $12;
 $14 = $2&255;
 $15 = ((($0)) + 3|0);
 HEAP8[$15>>0] = $14;
 $16 = (_bitshift64Lshr(($1|0),($2|0),24)|0);
 $17 = tempRet0;
 $18 = $16&255;
 $19 = ((($0)) + 4|0);
 HEAP8[$19>>0] = $18;
 $20 = (_bitshift64Lshr(($1|0),($2|0),16)|0);
 $21 = tempRet0;
 $22 = $20&255;
 $23 = ((($0)) + 5|0);
 HEAP8[$23>>0] = $22;
 $24 = (_bitshift64Lshr(($1|0),($2|0),8)|0);
 $25 = tempRet0;
 $26 = $24&255;
 $27 = ((($0)) + 6|0);
 HEAP8[$27>>0] = $26;
 $28 = $1&255;
 $29 = ((($0)) + 7|0);
 HEAP8[$29>>0] = $28;
 return;
}
function _sph_enc64be($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Lshr(($1|0),($2|0),56)|0);
 $4 = tempRet0;
 $5 = $3&255;
 HEAP8[$0>>0] = $5;
 $6 = (_bitshift64Lshr(($1|0),($2|0),48)|0);
 $7 = tempRet0;
 $8 = $6&255;
 $9 = ((($0)) + 1|0);
 HEAP8[$9>>0] = $8;
 $10 = (_bitshift64Lshr(($1|0),($2|0),40)|0);
 $11 = tempRet0;
 $12 = $10&255;
 $13 = ((($0)) + 2|0);
 HEAP8[$13>>0] = $12;
 $14 = $2&255;
 $15 = ((($0)) + 3|0);
 HEAP8[$15>>0] = $14;
 $16 = (_bitshift64Lshr(($1|0),($2|0),24)|0);
 $17 = tempRet0;
 $18 = $16&255;
 $19 = ((($0)) + 4|0);
 HEAP8[$19>>0] = $18;
 $20 = (_bitshift64Lshr(($1|0),($2|0),16)|0);
 $21 = tempRet0;
 $22 = $20&255;
 $23 = ((($0)) + 5|0);
 HEAP8[$23>>0] = $22;
 $24 = (_bitshift64Lshr(($1|0),($2|0),8)|0);
 $25 = tempRet0;
 $26 = $24&255;
 $27 = ((($0)) + 6|0);
 HEAP8[$27>>0] = $26;
 $28 = $1&255;
 $29 = ((($0)) + 7|0);
 HEAP8[$29>>0] = $28;
 return;
}
function _sph_sha512_close($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _sha384_close($0,$1,8);
 _sph_sha512_init($0);
 return;
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32888|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_570($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0;
 var $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$26 = $17;
   while(1) {
    $25 = ($26|0)<(0);
    if ($25) {
     break;
    }
    $34 = (($$04855) - ($26))|0;
    $35 = ((($$04954)) + 4|0);
    $36 = HEAP32[$35>>2]|0;
    $37 = ($26>>>0)>($36>>>0);
    $38 = ((($$04954)) + 8|0);
    $$150 = $37 ? $38 : $$04954;
    $39 = $37 << 31 >> 31;
    $$1 = (($39) + ($$04756))|0;
    $40 = $37 ? $36 : 0;
    $$0 = (($26) - ($40))|0;
    $41 = HEAP32[$$150>>2]|0;
    $42 = (($41) + ($$0)|0);
    HEAP32[$$150>>2] = $42;
    $43 = ((($$150)) + 4|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = (($44) - ($$0))|0;
    HEAP32[$43>>2] = $45;
    $46 = HEAP32[$13>>2]|0;
    $47 = $$150;
    HEAP32[$vararg_buffer3>>2] = $46;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $47;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $48 = (___syscall146(146,($vararg_buffer3|0))|0);
    $49 = (___syscall_ret($48)|0);
    $50 = ($34|0)==($49|0);
    if ($50) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $34;$$04954 = $$150;$26 = $49;
    }
   }
   $27 = ((($0)) + 16|0);
   HEAP32[$27>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $28 = HEAP32[$0>>2]|0;
   $29 = $28 | 32;
   HEAP32[$0>>2] = $29;
   $30 = ($$04756|0)==(2);
   if ($30) {
    $$051 = 0;
   } else {
    $31 = ((($$04954)) + 4|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($2) - ($32))|0;
    $$051 = $33;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  HEAP32[$4>>2] = $20;
  HEAP32[$7>>2] = $20;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___pthread_self_103()|0);
 $1 = ((($0)) + 64|0);
 return ($1|0);
}
function ___pthread_self_103() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32512|0);
}
function _dummy_570($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 3;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((32952|0));
 return (32960|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((32952|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[8220]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[8220]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $26 = $17;
     } else {
      $26 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $25 = ($26|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 3]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 3]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0192$i = 0, $$$0193$i = 0, $$$4236$i = 0, $$$4351$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0189$i = 0, $$0192$lcssa$i = 0, $$01928$i = 0, $$0193$lcssa$i = 0, $$01937$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0;
 var $$0212$i$i = 0, $$024371$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0289$i$i = 0, $$0295$i$i = 0, $$0296$i$i = 0, $$0342$i = 0, $$0344$i = 0, $$0345$i = 0, $$0347$i = 0, $$0353$i = 0, $$0358$i = 0, $$0359$$i = 0, $$0359$i = 0, $$0361$i = 0, $$0362$i = 0, $$0368$i = 0, $$1196$i = 0, $$1198$i = 0;
 var $$124470$i = 0, $$1291$i$i = 0, $$1293$i$i = 0, $$1343$i = 0, $$1348$i = 0, $$1363$i = 0, $$1370$i = 0, $$1374$i = 0, $$2234253237$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2355$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3350$i = 0, $$3372$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$415$i = 0;
 var $$4236$i = 0, $$4351$lcssa$i = 0, $$435114$i = 0, $$4357$$4$i = 0, $$4357$ph$i = 0, $$435713$i = 0, $$723948$i = 0, $$749$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i19$i = 0, $$pre$i210 = 0, $$pre$i212 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi11$i$iZ2D = 0, $$pre$phiZ2D = 0;
 var $$pre10$i$i = 0, $$sink1$i = 0, $$sink1$i$i = 0, $$sink16$i = 0, $$sink2$i = 0, $$sink2$i204 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0;
 var $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0;
 var $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0;
 var $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0;
 var $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0;
 var $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0;
 var $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0;
 var $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0;
 var $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0;
 var $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0;
 var $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0;
 var $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0;
 var $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0;
 var $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0;
 var $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0;
 var $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0;
 var $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0;
 var $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0;
 var $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0;
 var $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0;
 var $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0;
 var $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0;
 var $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0;
 var $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0;
 var $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0;
 var $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0;
 var $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0;
 var $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0;
 var $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0;
 var $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0;
 var $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0;
 var $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0;
 var $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0;
 var $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0;
 var $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0;
 var $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0;
 var $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0;
 var $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0;
 var $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0;
 var $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0;
 var $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0;
 var $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0;
 var $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0;
 var $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0;
 var $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0;
 var $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0;
 var $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0;
 var $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0;
 var $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0;
 var $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0;
 var $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0;
 var $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0;
 var $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0;
 var $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i208 = 0, $exitcond$i$i = 0, $not$$i = 0, $not$$i$i = 0, $not$$i17$i = 0, $not$$i209 = 0, $not$$i216 = 0, $not$1$i = 0, $not$1$i203 = 0, $not$5$i = 0, $not$7$i$i = 0, $not$8$i = 0, $not$9$i = 0;
 var $or$cond$i = 0, $or$cond$i214 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond2$i215 = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[8241]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (33004 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[8241] = $24;
     } else {
      $25 = HEAP32[(32980)>>2]|0;
      $26 = ($20>>>0)<($25>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(32972)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (33004 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($69|0)==($73|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[8241] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(32980)>>2]|0;
       $79 = ($73>>>0)<($78>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($87) + ($84)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(32984)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (33004 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[8241] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(32980)>>2]|0;
       $104 = ($102>>>0)<($103>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(32972)>>2] = $84;
     HEAP32[(32984)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(32968)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (33268 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $139 = ((($134)) + 16|0);
     $140 = HEAP32[$139>>2]|0;
     $not$5$i = ($140|0)==(0|0);
     $$sink16$i = $not$5$i&1;
     $141 = (((($134)) + 16|0) + ($$sink16$i<<2)|0);
     $142 = HEAP32[$141>>2]|0;
     $143 = ($142|0)==(0|0);
     if ($143) {
      $$0192$lcssa$i = $134;$$0193$lcssa$i = $138;
     } else {
      $$01928$i = $134;$$01937$i = $138;$145 = $142;
      while(1) {
       $144 = ((($145)) + 4|0);
       $146 = HEAP32[$144>>2]|0;
       $147 = $146 & -8;
       $148 = (($147) - ($6))|0;
       $149 = ($148>>>0)<($$01937$i>>>0);
       $$$0193$i = $149 ? $148 : $$01937$i;
       $$$0192$i = $149 ? $145 : $$01928$i;
       $150 = ((($145)) + 16|0);
       $151 = HEAP32[$150>>2]|0;
       $not$$i = ($151|0)==(0|0);
       $$sink1$i = $not$$i&1;
       $152 = (((($145)) + 16|0) + ($$sink1$i<<2)|0);
       $153 = HEAP32[$152>>2]|0;
       $154 = ($153|0)==(0|0);
       if ($154) {
        $$0192$lcssa$i = $$$0192$i;$$0193$lcssa$i = $$$0193$i;
        break;
       } else {
        $$01928$i = $$$0192$i;$$01937$i = $$$0193$i;$145 = $153;
       }
      }
     }
     $155 = HEAP32[(32980)>>2]|0;
     $156 = ($$0192$lcssa$i>>>0)<($155>>>0);
     if ($156) {
      _abort();
      // unreachable;
     }
     $157 = (($$0192$lcssa$i) + ($6)|0);
     $158 = ($$0192$lcssa$i>>>0)<($157>>>0);
     if (!($158)) {
      _abort();
      // unreachable;
     }
     $159 = ((($$0192$lcssa$i)) + 24|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ((($$0192$lcssa$i)) + 12|0);
     $162 = HEAP32[$161>>2]|0;
     $163 = ($162|0)==($$0192$lcssa$i|0);
     do {
      if ($163) {
       $173 = ((($$0192$lcssa$i)) + 20|0);
       $174 = HEAP32[$173>>2]|0;
       $175 = ($174|0)==(0|0);
       if ($175) {
        $176 = ((($$0192$lcssa$i)) + 16|0);
        $177 = HEAP32[$176>>2]|0;
        $178 = ($177|0)==(0|0);
        if ($178) {
         $$3$i = 0;
         break;
        } else {
         $$1196$i = $177;$$1198$i = $176;
        }
       } else {
        $$1196$i = $174;$$1198$i = $173;
       }
       while(1) {
        $179 = ((($$1196$i)) + 20|0);
        $180 = HEAP32[$179>>2]|0;
        $181 = ($180|0)==(0|0);
        if (!($181)) {
         $$1196$i = $180;$$1198$i = $179;
         continue;
        }
        $182 = ((($$1196$i)) + 16|0);
        $183 = HEAP32[$182>>2]|0;
        $184 = ($183|0)==(0|0);
        if ($184) {
         break;
        } else {
         $$1196$i = $183;$$1198$i = $182;
        }
       }
       $185 = ($$1198$i>>>0)<($155>>>0);
       if ($185) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1198$i>>2] = 0;
        $$3$i = $$1196$i;
        break;
       }
      } else {
       $164 = ((($$0192$lcssa$i)) + 8|0);
       $165 = HEAP32[$164>>2]|0;
       $166 = ($165>>>0)<($155>>>0);
       if ($166) {
        _abort();
        // unreachable;
       }
       $167 = ((($165)) + 12|0);
       $168 = HEAP32[$167>>2]|0;
       $169 = ($168|0)==($$0192$lcssa$i|0);
       if (!($169)) {
        _abort();
        // unreachable;
       }
       $170 = ((($162)) + 8|0);
       $171 = HEAP32[$170>>2]|0;
       $172 = ($171|0)==($$0192$lcssa$i|0);
       if ($172) {
        HEAP32[$167>>2] = $162;
        HEAP32[$170>>2] = $165;
        $$3$i = $162;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $186 = ($160|0)==(0|0);
     L73: do {
      if (!($186)) {
       $187 = ((($$0192$lcssa$i)) + 28|0);
       $188 = HEAP32[$187>>2]|0;
       $189 = (33268 + ($188<<2)|0);
       $190 = HEAP32[$189>>2]|0;
       $191 = ($$0192$lcssa$i|0)==($190|0);
       do {
        if ($191) {
         HEAP32[$189>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $192 = 1 << $188;
          $193 = $192 ^ -1;
          $194 = $108 & $193;
          HEAP32[(32968)>>2] = $194;
          break L73;
         }
        } else {
         $195 = HEAP32[(32980)>>2]|0;
         $196 = ($160>>>0)<($195>>>0);
         if ($196) {
          _abort();
          // unreachable;
         } else {
          $197 = ((($160)) + 16|0);
          $198 = HEAP32[$197>>2]|0;
          $not$1$i = ($198|0)!=($$0192$lcssa$i|0);
          $$sink2$i = $not$1$i&1;
          $199 = (((($160)) + 16|0) + ($$sink2$i<<2)|0);
          HEAP32[$199>>2] = $$3$i;
          $200 = ($$3$i|0)==(0|0);
          if ($200) {
           break L73;
          } else {
           break;
          }
         }
        }
       } while(0);
       $201 = HEAP32[(32980)>>2]|0;
       $202 = ($$3$i>>>0)<($201>>>0);
       if ($202) {
        _abort();
        // unreachable;
       }
       $203 = ((($$3$i)) + 24|0);
       HEAP32[$203>>2] = $160;
       $204 = ((($$0192$lcssa$i)) + 16|0);
       $205 = HEAP32[$204>>2]|0;
       $206 = ($205|0)==(0|0);
       do {
        if (!($206)) {
         $207 = ($205>>>0)<($201>>>0);
         if ($207) {
          _abort();
          // unreachable;
         } else {
          $208 = ((($$3$i)) + 16|0);
          HEAP32[$208>>2] = $205;
          $209 = ((($205)) + 24|0);
          HEAP32[$209>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $210 = ((($$0192$lcssa$i)) + 20|0);
       $211 = HEAP32[$210>>2]|0;
       $212 = ($211|0)==(0|0);
       if (!($212)) {
        $213 = HEAP32[(32980)>>2]|0;
        $214 = ($211>>>0)<($213>>>0);
        if ($214) {
         _abort();
         // unreachable;
        } else {
         $215 = ((($$3$i)) + 20|0);
         HEAP32[$215>>2] = $211;
         $216 = ((($211)) + 24|0);
         HEAP32[$216>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $217 = ($$0193$lcssa$i>>>0)<(16);
     if ($217) {
      $218 = (($$0193$lcssa$i) + ($6))|0;
      $219 = $218 | 3;
      $220 = ((($$0192$lcssa$i)) + 4|0);
      HEAP32[$220>>2] = $219;
      $221 = (($$0192$lcssa$i) + ($218)|0);
      $222 = ((($221)) + 4|0);
      $223 = HEAP32[$222>>2]|0;
      $224 = $223 | 1;
      HEAP32[$222>>2] = $224;
     } else {
      $225 = $6 | 3;
      $226 = ((($$0192$lcssa$i)) + 4|0);
      HEAP32[$226>>2] = $225;
      $227 = $$0193$lcssa$i | 1;
      $228 = ((($157)) + 4|0);
      HEAP32[$228>>2] = $227;
      $229 = (($157) + ($$0193$lcssa$i)|0);
      HEAP32[$229>>2] = $$0193$lcssa$i;
      $230 = ($37|0)==(0);
      if (!($230)) {
       $231 = HEAP32[(32984)>>2]|0;
       $232 = $37 >>> 3;
       $233 = $232 << 1;
       $234 = (33004 + ($233<<2)|0);
       $235 = 1 << $232;
       $236 = $8 & $235;
       $237 = ($236|0)==(0);
       if ($237) {
        $238 = $8 | $235;
        HEAP32[8241] = $238;
        $$pre$i = ((($234)) + 8|0);
        $$0189$i = $234;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $239 = ((($234)) + 8|0);
        $240 = HEAP32[$239>>2]|0;
        $241 = HEAP32[(32980)>>2]|0;
        $242 = ($240>>>0)<($241>>>0);
        if ($242) {
         _abort();
         // unreachable;
        } else {
         $$0189$i = $240;$$pre$phi$iZ2D = $239;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $231;
       $243 = ((($$0189$i)) + 12|0);
       HEAP32[$243>>2] = $231;
       $244 = ((($231)) + 8|0);
       HEAP32[$244>>2] = $$0189$i;
       $245 = ((($231)) + 12|0);
       HEAP32[$245>>2] = $234;
      }
      HEAP32[(32972)>>2] = $$0193$lcssa$i;
      HEAP32[(32984)>>2] = $157;
     }
     $246 = ((($$0192$lcssa$i)) + 8|0);
     $$0 = $246;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $247 = ($0>>>0)>(4294967231);
   if ($247) {
    $$0197 = -1;
   } else {
    $248 = (($0) + 11)|0;
    $249 = $248 & -8;
    $250 = HEAP32[(32968)>>2]|0;
    $251 = ($250|0)==(0);
    if ($251) {
     $$0197 = $249;
    } else {
     $252 = (0 - ($249))|0;
     $253 = $248 >>> 8;
     $254 = ($253|0)==(0);
     if ($254) {
      $$0358$i = 0;
     } else {
      $255 = ($249>>>0)>(16777215);
      if ($255) {
       $$0358$i = 31;
      } else {
       $256 = (($253) + 1048320)|0;
       $257 = $256 >>> 16;
       $258 = $257 & 8;
       $259 = $253 << $258;
       $260 = (($259) + 520192)|0;
       $261 = $260 >>> 16;
       $262 = $261 & 4;
       $263 = $262 | $258;
       $264 = $259 << $262;
       $265 = (($264) + 245760)|0;
       $266 = $265 >>> 16;
       $267 = $266 & 2;
       $268 = $263 | $267;
       $269 = (14 - ($268))|0;
       $270 = $264 << $267;
       $271 = $270 >>> 15;
       $272 = (($269) + ($271))|0;
       $273 = $272 << 1;
       $274 = (($272) + 7)|0;
       $275 = $249 >>> $274;
       $276 = $275 & 1;
       $277 = $276 | $273;
       $$0358$i = $277;
      }
     }
     $278 = (33268 + ($$0358$i<<2)|0);
     $279 = HEAP32[$278>>2]|0;
     $280 = ($279|0)==(0|0);
     L117: do {
      if ($280) {
       $$2355$i = 0;$$3$i201 = 0;$$3350$i = $252;
       label = 81;
      } else {
       $281 = ($$0358$i|0)==(31);
       $282 = $$0358$i >>> 1;
       $283 = (25 - ($282))|0;
       $284 = $281 ? 0 : $283;
       $285 = $249 << $284;
       $$0342$i = 0;$$0347$i = $252;$$0353$i = $279;$$0359$i = $285;$$0362$i = 0;
       while(1) {
        $286 = ((($$0353$i)) + 4|0);
        $287 = HEAP32[$286>>2]|0;
        $288 = $287 & -8;
        $289 = (($288) - ($249))|0;
        $290 = ($289>>>0)<($$0347$i>>>0);
        if ($290) {
         $291 = ($289|0)==(0);
         if ($291) {
          $$415$i = $$0353$i;$$435114$i = 0;$$435713$i = $$0353$i;
          label = 85;
          break L117;
         } else {
          $$1343$i = $$0353$i;$$1348$i = $289;
         }
        } else {
         $$1343$i = $$0342$i;$$1348$i = $$0347$i;
        }
        $292 = ((($$0353$i)) + 20|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = $$0359$i >>> 31;
        $295 = (((($$0353$i)) + 16|0) + ($294<<2)|0);
        $296 = HEAP32[$295>>2]|0;
        $297 = ($293|0)==(0|0);
        $298 = ($293|0)==($296|0);
        $or$cond2$i = $297 | $298;
        $$1363$i = $or$cond2$i ? $$0362$i : $293;
        $299 = ($296|0)==(0|0);
        $not$8$i = $299 ^ 1;
        $300 = $not$8$i&1;
        $$0359$$i = $$0359$i << $300;
        if ($299) {
         $$2355$i = $$1363$i;$$3$i201 = $$1343$i;$$3350$i = $$1348$i;
         label = 81;
         break;
        } else {
         $$0342$i = $$1343$i;$$0347$i = $$1348$i;$$0353$i = $296;$$0359$i = $$0359$$i;$$0362$i = $$1363$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 81) {
      $301 = ($$2355$i|0)==(0|0);
      $302 = ($$3$i201|0)==(0|0);
      $or$cond$i = $301 & $302;
      if ($or$cond$i) {
       $303 = 2 << $$0358$i;
       $304 = (0 - ($303))|0;
       $305 = $303 | $304;
       $306 = $250 & $305;
       $307 = ($306|0)==(0);
       if ($307) {
        $$0197 = $249;
        break;
       }
       $308 = (0 - ($306))|0;
       $309 = $306 & $308;
       $310 = (($309) + -1)|0;
       $311 = $310 >>> 12;
       $312 = $311 & 16;
       $313 = $310 >>> $312;
       $314 = $313 >>> 5;
       $315 = $314 & 8;
       $316 = $315 | $312;
       $317 = $313 >>> $315;
       $318 = $317 >>> 2;
       $319 = $318 & 4;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 2;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = $325 >>> 1;
       $327 = $326 & 1;
       $328 = $324 | $327;
       $329 = $325 >>> $327;
       $330 = (($328) + ($329))|0;
       $331 = (33268 + ($330<<2)|0);
       $332 = HEAP32[$331>>2]|0;
       $$4$ph$i = 0;$$4357$ph$i = $332;
      } else {
       $$4$ph$i = $$3$i201;$$4357$ph$i = $$2355$i;
      }
      $333 = ($$4357$ph$i|0)==(0|0);
      if ($333) {
       $$4$lcssa$i = $$4$ph$i;$$4351$lcssa$i = $$3350$i;
      } else {
       $$415$i = $$4$ph$i;$$435114$i = $$3350$i;$$435713$i = $$4357$ph$i;
       label = 85;
      }
     }
     if ((label|0) == 85) {
      while(1) {
       label = 0;
       $334 = ((($$435713$i)) + 4|0);
       $335 = HEAP32[$334>>2]|0;
       $336 = $335 & -8;
       $337 = (($336) - ($249))|0;
       $338 = ($337>>>0)<($$435114$i>>>0);
       $$$4351$i = $338 ? $337 : $$435114$i;
       $$4357$$4$i = $338 ? $$435713$i : $$415$i;
       $339 = ((($$435713$i)) + 16|0);
       $340 = HEAP32[$339>>2]|0;
       $not$1$i203 = ($340|0)==(0|0);
       $$sink2$i204 = $not$1$i203&1;
       $341 = (((($$435713$i)) + 16|0) + ($$sink2$i204<<2)|0);
       $342 = HEAP32[$341>>2]|0;
       $343 = ($342|0)==(0|0);
       if ($343) {
        $$4$lcssa$i = $$4357$$4$i;$$4351$lcssa$i = $$$4351$i;
        break;
       } else {
        $$415$i = $$4357$$4$i;$$435114$i = $$$4351$i;$$435713$i = $342;
        label = 85;
       }
      }
     }
     $344 = ($$4$lcssa$i|0)==(0|0);
     if ($344) {
      $$0197 = $249;
     } else {
      $345 = HEAP32[(32972)>>2]|0;
      $346 = (($345) - ($249))|0;
      $347 = ($$4351$lcssa$i>>>0)<($346>>>0);
      if ($347) {
       $348 = HEAP32[(32980)>>2]|0;
       $349 = ($$4$lcssa$i>>>0)<($348>>>0);
       if ($349) {
        _abort();
        // unreachable;
       }
       $350 = (($$4$lcssa$i) + ($249)|0);
       $351 = ($$4$lcssa$i>>>0)<($350>>>0);
       if (!($351)) {
        _abort();
        // unreachable;
       }
       $352 = ((($$4$lcssa$i)) + 24|0);
       $353 = HEAP32[$352>>2]|0;
       $354 = ((($$4$lcssa$i)) + 12|0);
       $355 = HEAP32[$354>>2]|0;
       $356 = ($355|0)==($$4$lcssa$i|0);
       do {
        if ($356) {
         $366 = ((($$4$lcssa$i)) + 20|0);
         $367 = HEAP32[$366>>2]|0;
         $368 = ($367|0)==(0|0);
         if ($368) {
          $369 = ((($$4$lcssa$i)) + 16|0);
          $370 = HEAP32[$369>>2]|0;
          $371 = ($370|0)==(0|0);
          if ($371) {
           $$3372$i = 0;
           break;
          } else {
           $$1370$i = $370;$$1374$i = $369;
          }
         } else {
          $$1370$i = $367;$$1374$i = $366;
         }
         while(1) {
          $372 = ((($$1370$i)) + 20|0);
          $373 = HEAP32[$372>>2]|0;
          $374 = ($373|0)==(0|0);
          if (!($374)) {
           $$1370$i = $373;$$1374$i = $372;
           continue;
          }
          $375 = ((($$1370$i)) + 16|0);
          $376 = HEAP32[$375>>2]|0;
          $377 = ($376|0)==(0|0);
          if ($377) {
           break;
          } else {
           $$1370$i = $376;$$1374$i = $375;
          }
         }
         $378 = ($$1374$i>>>0)<($348>>>0);
         if ($378) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1374$i>>2] = 0;
          $$3372$i = $$1370$i;
          break;
         }
        } else {
         $357 = ((($$4$lcssa$i)) + 8|0);
         $358 = HEAP32[$357>>2]|0;
         $359 = ($358>>>0)<($348>>>0);
         if ($359) {
          _abort();
          // unreachable;
         }
         $360 = ((($358)) + 12|0);
         $361 = HEAP32[$360>>2]|0;
         $362 = ($361|0)==($$4$lcssa$i|0);
         if (!($362)) {
          _abort();
          // unreachable;
         }
         $363 = ((($355)) + 8|0);
         $364 = HEAP32[$363>>2]|0;
         $365 = ($364|0)==($$4$lcssa$i|0);
         if ($365) {
          HEAP32[$360>>2] = $355;
          HEAP32[$363>>2] = $358;
          $$3372$i = $355;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $379 = ($353|0)==(0|0);
       L164: do {
        if ($379) {
         $470 = $250;
        } else {
         $380 = ((($$4$lcssa$i)) + 28|0);
         $381 = HEAP32[$380>>2]|0;
         $382 = (33268 + ($381<<2)|0);
         $383 = HEAP32[$382>>2]|0;
         $384 = ($$4$lcssa$i|0)==($383|0);
         do {
          if ($384) {
           HEAP32[$382>>2] = $$3372$i;
           $cond$i208 = ($$3372$i|0)==(0|0);
           if ($cond$i208) {
            $385 = 1 << $381;
            $386 = $385 ^ -1;
            $387 = $250 & $386;
            HEAP32[(32968)>>2] = $387;
            $470 = $387;
            break L164;
           }
          } else {
           $388 = HEAP32[(32980)>>2]|0;
           $389 = ($353>>>0)<($388>>>0);
           if ($389) {
            _abort();
            // unreachable;
           } else {
            $390 = ((($353)) + 16|0);
            $391 = HEAP32[$390>>2]|0;
            $not$$i209 = ($391|0)!=($$4$lcssa$i|0);
            $$sink3$i = $not$$i209&1;
            $392 = (((($353)) + 16|0) + ($$sink3$i<<2)|0);
            HEAP32[$392>>2] = $$3372$i;
            $393 = ($$3372$i|0)==(0|0);
            if ($393) {
             $470 = $250;
             break L164;
            } else {
             break;
            }
           }
          }
         } while(0);
         $394 = HEAP32[(32980)>>2]|0;
         $395 = ($$3372$i>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($$3372$i)) + 24|0);
         HEAP32[$396>>2] = $353;
         $397 = ((($$4$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($$3372$i)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $$3372$i;
            break;
           }
          }
         } while(0);
         $403 = ((($$4$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if ($405) {
          $470 = $250;
         } else {
          $406 = HEAP32[(32980)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($$3372$i)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $$3372$i;
           $470 = $250;
           break;
          }
         }
        }
       } while(0);
       $410 = ($$4351$lcssa$i>>>0)<(16);
       do {
        if ($410) {
         $411 = (($$4351$lcssa$i) + ($249))|0;
         $412 = $411 | 3;
         $413 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $414 = (($$4$lcssa$i) + ($411)|0);
         $415 = ((($414)) + 4|0);
         $416 = HEAP32[$415>>2]|0;
         $417 = $416 | 1;
         HEAP32[$415>>2] = $417;
        } else {
         $418 = $249 | 3;
         $419 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$419>>2] = $418;
         $420 = $$4351$lcssa$i | 1;
         $421 = ((($350)) + 4|0);
         HEAP32[$421>>2] = $420;
         $422 = (($350) + ($$4351$lcssa$i)|0);
         HEAP32[$422>>2] = $$4351$lcssa$i;
         $423 = $$4351$lcssa$i >>> 3;
         $424 = ($$4351$lcssa$i>>>0)<(256);
         if ($424) {
          $425 = $423 << 1;
          $426 = (33004 + ($425<<2)|0);
          $427 = HEAP32[8241]|0;
          $428 = 1 << $423;
          $429 = $427 & $428;
          $430 = ($429|0)==(0);
          if ($430) {
           $431 = $427 | $428;
           HEAP32[8241] = $431;
           $$pre$i210 = ((($426)) + 8|0);
           $$0368$i = $426;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $432 = ((($426)) + 8|0);
           $433 = HEAP32[$432>>2]|0;
           $434 = HEAP32[(32980)>>2]|0;
           $435 = ($433>>>0)<($434>>>0);
           if ($435) {
            _abort();
            // unreachable;
           } else {
            $$0368$i = $433;$$pre$phi$i211Z2D = $432;
           }
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $350;
          $436 = ((($$0368$i)) + 12|0);
          HEAP32[$436>>2] = $350;
          $437 = ((($350)) + 8|0);
          HEAP32[$437>>2] = $$0368$i;
          $438 = ((($350)) + 12|0);
          HEAP32[$438>>2] = $426;
          break;
         }
         $439 = $$4351$lcssa$i >>> 8;
         $440 = ($439|0)==(0);
         if ($440) {
          $$0361$i = 0;
         } else {
          $441 = ($$4351$lcssa$i>>>0)>(16777215);
          if ($441) {
           $$0361$i = 31;
          } else {
           $442 = (($439) + 1048320)|0;
           $443 = $442 >>> 16;
           $444 = $443 & 8;
           $445 = $439 << $444;
           $446 = (($445) + 520192)|0;
           $447 = $446 >>> 16;
           $448 = $447 & 4;
           $449 = $448 | $444;
           $450 = $445 << $448;
           $451 = (($450) + 245760)|0;
           $452 = $451 >>> 16;
           $453 = $452 & 2;
           $454 = $449 | $453;
           $455 = (14 - ($454))|0;
           $456 = $450 << $453;
           $457 = $456 >>> 15;
           $458 = (($455) + ($457))|0;
           $459 = $458 << 1;
           $460 = (($458) + 7)|0;
           $461 = $$4351$lcssa$i >>> $460;
           $462 = $461 & 1;
           $463 = $462 | $459;
           $$0361$i = $463;
          }
         }
         $464 = (33268 + ($$0361$i<<2)|0);
         $465 = ((($350)) + 28|0);
         HEAP32[$465>>2] = $$0361$i;
         $466 = ((($350)) + 16|0);
         $467 = ((($466)) + 4|0);
         HEAP32[$467>>2] = 0;
         HEAP32[$466>>2] = 0;
         $468 = 1 << $$0361$i;
         $469 = $470 & $468;
         $471 = ($469|0)==(0);
         if ($471) {
          $472 = $470 | $468;
          HEAP32[(32968)>>2] = $472;
          HEAP32[$464>>2] = $350;
          $473 = ((($350)) + 24|0);
          HEAP32[$473>>2] = $464;
          $474 = ((($350)) + 12|0);
          HEAP32[$474>>2] = $350;
          $475 = ((($350)) + 8|0);
          HEAP32[$475>>2] = $350;
          break;
         }
         $476 = HEAP32[$464>>2]|0;
         $477 = ($$0361$i|0)==(31);
         $478 = $$0361$i >>> 1;
         $479 = (25 - ($478))|0;
         $480 = $477 ? 0 : $479;
         $481 = $$4351$lcssa$i << $480;
         $$0344$i = $481;$$0345$i = $476;
         while(1) {
          $482 = ((($$0345$i)) + 4|0);
          $483 = HEAP32[$482>>2]|0;
          $484 = $483 & -8;
          $485 = ($484|0)==($$4351$lcssa$i|0);
          if ($485) {
           label = 139;
           break;
          }
          $486 = $$0344$i >>> 31;
          $487 = (((($$0345$i)) + 16|0) + ($486<<2)|0);
          $488 = $$0344$i << 1;
          $489 = HEAP32[$487>>2]|0;
          $490 = ($489|0)==(0|0);
          if ($490) {
           label = 136;
           break;
          } else {
           $$0344$i = $488;$$0345$i = $489;
          }
         }
         if ((label|0) == 136) {
          $491 = HEAP32[(32980)>>2]|0;
          $492 = ($487>>>0)<($491>>>0);
          if ($492) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$487>>2] = $350;
           $493 = ((($350)) + 24|0);
           HEAP32[$493>>2] = $$0345$i;
           $494 = ((($350)) + 12|0);
           HEAP32[$494>>2] = $350;
           $495 = ((($350)) + 8|0);
           HEAP32[$495>>2] = $350;
           break;
          }
         }
         else if ((label|0) == 139) {
          $496 = ((($$0345$i)) + 8|0);
          $497 = HEAP32[$496>>2]|0;
          $498 = HEAP32[(32980)>>2]|0;
          $499 = ($497>>>0)>=($498>>>0);
          $not$9$i = ($$0345$i>>>0)>=($498>>>0);
          $500 = $499 & $not$9$i;
          if ($500) {
           $501 = ((($497)) + 12|0);
           HEAP32[$501>>2] = $350;
           HEAP32[$496>>2] = $350;
           $502 = ((($350)) + 8|0);
           HEAP32[$502>>2] = $497;
           $503 = ((($350)) + 12|0);
           HEAP32[$503>>2] = $$0345$i;
           $504 = ((($350)) + 24|0);
           HEAP32[$504>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $505 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $505;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $249;
      }
     }
    }
   }
  }
 } while(0);
 $506 = HEAP32[(32972)>>2]|0;
 $507 = ($506>>>0)<($$0197>>>0);
 if (!($507)) {
  $508 = (($506) - ($$0197))|0;
  $509 = HEAP32[(32984)>>2]|0;
  $510 = ($508>>>0)>(15);
  if ($510) {
   $511 = (($509) + ($$0197)|0);
   HEAP32[(32984)>>2] = $511;
   HEAP32[(32972)>>2] = $508;
   $512 = $508 | 1;
   $513 = ((($511)) + 4|0);
   HEAP32[$513>>2] = $512;
   $514 = (($511) + ($508)|0);
   HEAP32[$514>>2] = $508;
   $515 = $$0197 | 3;
   $516 = ((($509)) + 4|0);
   HEAP32[$516>>2] = $515;
  } else {
   HEAP32[(32972)>>2] = 0;
   HEAP32[(32984)>>2] = 0;
   $517 = $506 | 3;
   $518 = ((($509)) + 4|0);
   HEAP32[$518>>2] = $517;
   $519 = (($509) + ($506)|0);
   $520 = ((($519)) + 4|0);
   $521 = HEAP32[$520>>2]|0;
   $522 = $521 | 1;
   HEAP32[$520>>2] = $522;
  }
  $523 = ((($509)) + 8|0);
  $$0 = $523;
  STACKTOP = sp;return ($$0|0);
 }
 $524 = HEAP32[(32976)>>2]|0;
 $525 = ($524>>>0)>($$0197>>>0);
 if ($525) {
  $526 = (($524) - ($$0197))|0;
  HEAP32[(32976)>>2] = $526;
  $527 = HEAP32[(32988)>>2]|0;
  $528 = (($527) + ($$0197)|0);
  HEAP32[(32988)>>2] = $528;
  $529 = $526 | 1;
  $530 = ((($528)) + 4|0);
  HEAP32[$530>>2] = $529;
  $531 = $$0197 | 3;
  $532 = ((($527)) + 4|0);
  HEAP32[$532>>2] = $531;
  $533 = ((($527)) + 8|0);
  $$0 = $533;
  STACKTOP = sp;return ($$0|0);
 }
 $534 = HEAP32[8359]|0;
 $535 = ($534|0)==(0);
 if ($535) {
  HEAP32[(33444)>>2] = 4096;
  HEAP32[(33440)>>2] = 4096;
  HEAP32[(33448)>>2] = -1;
  HEAP32[(33452)>>2] = -1;
  HEAP32[(33456)>>2] = 0;
  HEAP32[(33408)>>2] = 0;
  $536 = $1;
  $537 = $536 & -16;
  $538 = $537 ^ 1431655768;
  HEAP32[$1>>2] = $538;
  HEAP32[8359] = $538;
  $542 = 4096;
 } else {
  $$pre$i212 = HEAP32[(33444)>>2]|0;
  $542 = $$pre$i212;
 }
 $539 = (($$0197) + 48)|0;
 $540 = (($$0197) + 47)|0;
 $541 = (($542) + ($540))|0;
 $543 = (0 - ($542))|0;
 $544 = $541 & $543;
 $545 = ($544>>>0)>($$0197>>>0);
 if (!($545)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $546 = HEAP32[(33404)>>2]|0;
 $547 = ($546|0)==(0);
 if (!($547)) {
  $548 = HEAP32[(33396)>>2]|0;
  $549 = (($548) + ($544))|0;
  $550 = ($549>>>0)<=($548>>>0);
  $551 = ($549>>>0)>($546>>>0);
  $or$cond1$i = $550 | $551;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $552 = HEAP32[(33408)>>2]|0;
 $553 = $552 & 4;
 $554 = ($553|0)==(0);
 L244: do {
  if ($554) {
   $555 = HEAP32[(32988)>>2]|0;
   $556 = ($555|0)==(0|0);
   L246: do {
    if ($556) {
     label = 163;
    } else {
     $$0$i$i = (33412);
     while(1) {
      $557 = HEAP32[$$0$i$i>>2]|0;
      $558 = ($557>>>0)>($555>>>0);
      if (!($558)) {
       $559 = ((($$0$i$i)) + 4|0);
       $560 = HEAP32[$559>>2]|0;
       $561 = (($557) + ($560)|0);
       $562 = ($561>>>0)>($555>>>0);
       if ($562) {
        break;
       }
      }
      $563 = ((($$0$i$i)) + 8|0);
      $564 = HEAP32[$563>>2]|0;
      $565 = ($564|0)==(0|0);
      if ($565) {
       label = 163;
       break L246;
      } else {
       $$0$i$i = $564;
      }
     }
     $588 = (($541) - ($524))|0;
     $589 = $588 & $543;
     $590 = ($589>>>0)<(2147483647);
     if ($590) {
      $591 = (_sbrk(($589|0))|0);
      $592 = HEAP32[$$0$i$i>>2]|0;
      $593 = HEAP32[$559>>2]|0;
      $594 = (($592) + ($593)|0);
      $595 = ($591|0)==($594|0);
      if ($595) {
       $596 = ($591|0)==((-1)|0);
       if ($596) {
        $$2234253237$i = $589;
       } else {
        $$723948$i = $589;$$749$i = $591;
        label = 180;
        break L244;
       }
      } else {
       $$2247$ph$i = $591;$$2253$ph$i = $589;
       label = 171;
      }
     } else {
      $$2234253237$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 163) {
     $566 = (_sbrk(0)|0);
     $567 = ($566|0)==((-1)|0);
     if ($567) {
      $$2234253237$i = 0;
     } else {
      $568 = $566;
      $569 = HEAP32[(33440)>>2]|0;
      $570 = (($569) + -1)|0;
      $571 = $570 & $568;
      $572 = ($571|0)==(0);
      $573 = (($570) + ($568))|0;
      $574 = (0 - ($569))|0;
      $575 = $573 & $574;
      $576 = (($575) - ($568))|0;
      $577 = $572 ? 0 : $576;
      $$$i = (($577) + ($544))|0;
      $578 = HEAP32[(33396)>>2]|0;
      $579 = (($$$i) + ($578))|0;
      $580 = ($$$i>>>0)>($$0197>>>0);
      $581 = ($$$i>>>0)<(2147483647);
      $or$cond$i214 = $580 & $581;
      if ($or$cond$i214) {
       $582 = HEAP32[(33404)>>2]|0;
       $583 = ($582|0)==(0);
       if (!($583)) {
        $584 = ($579>>>0)<=($578>>>0);
        $585 = ($579>>>0)>($582>>>0);
        $or$cond2$i215 = $584 | $585;
        if ($or$cond2$i215) {
         $$2234253237$i = 0;
         break;
        }
       }
       $586 = (_sbrk(($$$i|0))|0);
       $587 = ($586|0)==($566|0);
       if ($587) {
        $$723948$i = $$$i;$$749$i = $566;
        label = 180;
        break L244;
       } else {
        $$2247$ph$i = $586;$$2253$ph$i = $$$i;
        label = 171;
       }
      } else {
       $$2234253237$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 171) {
     $597 = (0 - ($$2253$ph$i))|0;
     $598 = ($$2247$ph$i|0)!=((-1)|0);
     $599 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $599 & $598;
     $600 = ($539>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $600 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $610 = ($$2247$ph$i|0)==((-1)|0);
      if ($610) {
       $$2234253237$i = 0;
       break;
      } else {
       $$723948$i = $$2253$ph$i;$$749$i = $$2247$ph$i;
       label = 180;
       break L244;
      }
     }
     $601 = HEAP32[(33444)>>2]|0;
     $602 = (($540) - ($$2253$ph$i))|0;
     $603 = (($602) + ($601))|0;
     $604 = (0 - ($601))|0;
     $605 = $603 & $604;
     $606 = ($605>>>0)<(2147483647);
     if (!($606)) {
      $$723948$i = $$2253$ph$i;$$749$i = $$2247$ph$i;
      label = 180;
      break L244;
     }
     $607 = (_sbrk(($605|0))|0);
     $608 = ($607|0)==((-1)|0);
     if ($608) {
      (_sbrk(($597|0))|0);
      $$2234253237$i = 0;
      break;
     } else {
      $609 = (($605) + ($$2253$ph$i))|0;
      $$723948$i = $609;$$749$i = $$2247$ph$i;
      label = 180;
      break L244;
     }
    }
   } while(0);
   $611 = HEAP32[(33408)>>2]|0;
   $612 = $611 | 4;
   HEAP32[(33408)>>2] = $612;
   $$4236$i = $$2234253237$i;
   label = 178;
  } else {
   $$4236$i = 0;
   label = 178;
  }
 } while(0);
 if ((label|0) == 178) {
  $613 = ($544>>>0)<(2147483647);
  if ($613) {
   $614 = (_sbrk(($544|0))|0);
   $615 = (_sbrk(0)|0);
   $616 = ($614|0)!=((-1)|0);
   $617 = ($615|0)!=((-1)|0);
   $or$cond5$i = $616 & $617;
   $618 = ($614>>>0)<($615>>>0);
   $or$cond11$i = $618 & $or$cond5$i;
   $619 = $615;
   $620 = $614;
   $621 = (($619) - ($620))|0;
   $622 = (($$0197) + 40)|0;
   $623 = ($621>>>0)>($622>>>0);
   $$$4236$i = $623 ? $621 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $624 = ($614|0)==((-1)|0);
   $not$$i216 = $623 ^ 1;
   $625 = $624 | $not$$i216;
   $or$cond50$i = $625 | $or$cond11$not$i;
   if (!($or$cond50$i)) {
    $$723948$i = $$$4236$i;$$749$i = $614;
    label = 180;
   }
  }
 }
 if ((label|0) == 180) {
  $626 = HEAP32[(33396)>>2]|0;
  $627 = (($626) + ($$723948$i))|0;
  HEAP32[(33396)>>2] = $627;
  $628 = HEAP32[(33400)>>2]|0;
  $629 = ($627>>>0)>($628>>>0);
  if ($629) {
   HEAP32[(33400)>>2] = $627;
  }
  $630 = HEAP32[(32988)>>2]|0;
  $631 = ($630|0)==(0|0);
  do {
   if ($631) {
    $632 = HEAP32[(32980)>>2]|0;
    $633 = ($632|0)==(0|0);
    $634 = ($$749$i>>>0)<($632>>>0);
    $or$cond12$i = $633 | $634;
    if ($or$cond12$i) {
     HEAP32[(32980)>>2] = $$749$i;
    }
    HEAP32[(33412)>>2] = $$749$i;
    HEAP32[(33416)>>2] = $$723948$i;
    HEAP32[(33424)>>2] = 0;
    $635 = HEAP32[8359]|0;
    HEAP32[(33000)>>2] = $635;
    HEAP32[(32996)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $636 = $$01$i$i << 1;
     $637 = (33004 + ($636<<2)|0);
     $638 = ((($637)) + 12|0);
     HEAP32[$638>>2] = $637;
     $639 = ((($637)) + 8|0);
     HEAP32[$639>>2] = $637;
     $640 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($640|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $640;
     }
    }
    $641 = (($$723948$i) + -40)|0;
    $642 = ((($$749$i)) + 8|0);
    $643 = $642;
    $644 = $643 & 7;
    $645 = ($644|0)==(0);
    $646 = (0 - ($643))|0;
    $647 = $646 & 7;
    $648 = $645 ? 0 : $647;
    $649 = (($$749$i) + ($648)|0);
    $650 = (($641) - ($648))|0;
    HEAP32[(32988)>>2] = $649;
    HEAP32[(32976)>>2] = $650;
    $651 = $650 | 1;
    $652 = ((($649)) + 4|0);
    HEAP32[$652>>2] = $651;
    $653 = (($649) + ($650)|0);
    $654 = ((($653)) + 4|0);
    HEAP32[$654>>2] = 40;
    $655 = HEAP32[(33452)>>2]|0;
    HEAP32[(32992)>>2] = $655;
   } else {
    $$024371$i = (33412);
    while(1) {
     $656 = HEAP32[$$024371$i>>2]|0;
     $657 = ((($$024371$i)) + 4|0);
     $658 = HEAP32[$657>>2]|0;
     $659 = (($656) + ($658)|0);
     $660 = ($$749$i|0)==($659|0);
     if ($660) {
      label = 190;
      break;
     }
     $661 = ((($$024371$i)) + 8|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = ($662|0)==(0|0);
     if ($663) {
      break;
     } else {
      $$024371$i = $662;
     }
    }
    if ((label|0) == 190) {
     $664 = ((($$024371$i)) + 12|0);
     $665 = HEAP32[$664>>2]|0;
     $666 = $665 & 8;
     $667 = ($666|0)==(0);
     if ($667) {
      $668 = ($630>>>0)>=($656>>>0);
      $669 = ($630>>>0)<($$749$i>>>0);
      $or$cond51$i = $669 & $668;
      if ($or$cond51$i) {
       $670 = (($658) + ($$723948$i))|0;
       HEAP32[$657>>2] = $670;
       $671 = HEAP32[(32976)>>2]|0;
       $672 = ((($630)) + 8|0);
       $673 = $672;
       $674 = $673 & 7;
       $675 = ($674|0)==(0);
       $676 = (0 - ($673))|0;
       $677 = $676 & 7;
       $678 = $675 ? 0 : $677;
       $679 = (($630) + ($678)|0);
       $680 = (($$723948$i) - ($678))|0;
       $681 = (($671) + ($680))|0;
       HEAP32[(32988)>>2] = $679;
       HEAP32[(32976)>>2] = $681;
       $682 = $681 | 1;
       $683 = ((($679)) + 4|0);
       HEAP32[$683>>2] = $682;
       $684 = (($679) + ($681)|0);
       $685 = ((($684)) + 4|0);
       HEAP32[$685>>2] = 40;
       $686 = HEAP32[(33452)>>2]|0;
       HEAP32[(32992)>>2] = $686;
       break;
      }
     }
    }
    $687 = HEAP32[(32980)>>2]|0;
    $688 = ($$749$i>>>0)<($687>>>0);
    if ($688) {
     HEAP32[(32980)>>2] = $$749$i;
     $752 = $$749$i;
    } else {
     $752 = $687;
    }
    $689 = (($$749$i) + ($$723948$i)|0);
    $$124470$i = (33412);
    while(1) {
     $690 = HEAP32[$$124470$i>>2]|0;
     $691 = ($690|0)==($689|0);
     if ($691) {
      label = 198;
      break;
     }
     $692 = ((($$124470$i)) + 8|0);
     $693 = HEAP32[$692>>2]|0;
     $694 = ($693|0)==(0|0);
     if ($694) {
      break;
     } else {
      $$124470$i = $693;
     }
    }
    if ((label|0) == 198) {
     $695 = ((($$124470$i)) + 12|0);
     $696 = HEAP32[$695>>2]|0;
     $697 = $696 & 8;
     $698 = ($697|0)==(0);
     if ($698) {
      HEAP32[$$124470$i>>2] = $$749$i;
      $699 = ((($$124470$i)) + 4|0);
      $700 = HEAP32[$699>>2]|0;
      $701 = (($700) + ($$723948$i))|0;
      HEAP32[$699>>2] = $701;
      $702 = ((($$749$i)) + 8|0);
      $703 = $702;
      $704 = $703 & 7;
      $705 = ($704|0)==(0);
      $706 = (0 - ($703))|0;
      $707 = $706 & 7;
      $708 = $705 ? 0 : $707;
      $709 = (($$749$i) + ($708)|0);
      $710 = ((($689)) + 8|0);
      $711 = $710;
      $712 = $711 & 7;
      $713 = ($712|0)==(0);
      $714 = (0 - ($711))|0;
      $715 = $714 & 7;
      $716 = $713 ? 0 : $715;
      $717 = (($689) + ($716)|0);
      $718 = $717;
      $719 = $709;
      $720 = (($718) - ($719))|0;
      $721 = (($709) + ($$0197)|0);
      $722 = (($720) - ($$0197))|0;
      $723 = $$0197 | 3;
      $724 = ((($709)) + 4|0);
      HEAP32[$724>>2] = $723;
      $725 = ($717|0)==($630|0);
      do {
       if ($725) {
        $726 = HEAP32[(32976)>>2]|0;
        $727 = (($726) + ($722))|0;
        HEAP32[(32976)>>2] = $727;
        HEAP32[(32988)>>2] = $721;
        $728 = $727 | 1;
        $729 = ((($721)) + 4|0);
        HEAP32[$729>>2] = $728;
       } else {
        $730 = HEAP32[(32984)>>2]|0;
        $731 = ($717|0)==($730|0);
        if ($731) {
         $732 = HEAP32[(32972)>>2]|0;
         $733 = (($732) + ($722))|0;
         HEAP32[(32972)>>2] = $733;
         HEAP32[(32984)>>2] = $721;
         $734 = $733 | 1;
         $735 = ((($721)) + 4|0);
         HEAP32[$735>>2] = $734;
         $736 = (($721) + ($733)|0);
         HEAP32[$736>>2] = $733;
         break;
        }
        $737 = ((($717)) + 4|0);
        $738 = HEAP32[$737>>2]|0;
        $739 = $738 & 3;
        $740 = ($739|0)==(1);
        if ($740) {
         $741 = $738 & -8;
         $742 = $738 >>> 3;
         $743 = ($738>>>0)<(256);
         L314: do {
          if ($743) {
           $744 = ((($717)) + 8|0);
           $745 = HEAP32[$744>>2]|0;
           $746 = ((($717)) + 12|0);
           $747 = HEAP32[$746>>2]|0;
           $748 = $742 << 1;
           $749 = (33004 + ($748<<2)|0);
           $750 = ($745|0)==($749|0);
           do {
            if (!($750)) {
             $751 = ($745>>>0)<($752>>>0);
             if ($751) {
              _abort();
              // unreachable;
             }
             $753 = ((($745)) + 12|0);
             $754 = HEAP32[$753>>2]|0;
             $755 = ($754|0)==($717|0);
             if ($755) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $756 = ($747|0)==($745|0);
           if ($756) {
            $757 = 1 << $742;
            $758 = $757 ^ -1;
            $759 = HEAP32[8241]|0;
            $760 = $759 & $758;
            HEAP32[8241] = $760;
            break;
           }
           $761 = ($747|0)==($749|0);
           do {
            if ($761) {
             $$pre10$i$i = ((($747)) + 8|0);
             $$pre$phi11$i$iZ2D = $$pre10$i$i;
            } else {
             $762 = ($747>>>0)<($752>>>0);
             if ($762) {
              _abort();
              // unreachable;
             }
             $763 = ((($747)) + 8|0);
             $764 = HEAP32[$763>>2]|0;
             $765 = ($764|0)==($717|0);
             if ($765) {
              $$pre$phi11$i$iZ2D = $763;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $766 = ((($745)) + 12|0);
           HEAP32[$766>>2] = $747;
           HEAP32[$$pre$phi11$i$iZ2D>>2] = $745;
          } else {
           $767 = ((($717)) + 24|0);
           $768 = HEAP32[$767>>2]|0;
           $769 = ((($717)) + 12|0);
           $770 = HEAP32[$769>>2]|0;
           $771 = ($770|0)==($717|0);
           do {
            if ($771) {
             $781 = ((($717)) + 16|0);
             $782 = ((($781)) + 4|0);
             $783 = HEAP32[$782>>2]|0;
             $784 = ($783|0)==(0|0);
             if ($784) {
              $785 = HEAP32[$781>>2]|0;
              $786 = ($785|0)==(0|0);
              if ($786) {
               $$3$i$i = 0;
               break;
              } else {
               $$1291$i$i = $785;$$1293$i$i = $781;
              }
             } else {
              $$1291$i$i = $783;$$1293$i$i = $782;
             }
             while(1) {
              $787 = ((($$1291$i$i)) + 20|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if (!($789)) {
               $$1291$i$i = $788;$$1293$i$i = $787;
               continue;
              }
              $790 = ((($$1291$i$i)) + 16|0);
              $791 = HEAP32[$790>>2]|0;
              $792 = ($791|0)==(0|0);
              if ($792) {
               break;
              } else {
               $$1291$i$i = $791;$$1293$i$i = $790;
              }
             }
             $793 = ($$1293$i$i>>>0)<($752>>>0);
             if ($793) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1293$i$i>>2] = 0;
              $$3$i$i = $$1291$i$i;
              break;
             }
            } else {
             $772 = ((($717)) + 8|0);
             $773 = HEAP32[$772>>2]|0;
             $774 = ($773>>>0)<($752>>>0);
             if ($774) {
              _abort();
              // unreachable;
             }
             $775 = ((($773)) + 12|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776|0)==($717|0);
             if (!($777)) {
              _abort();
              // unreachable;
             }
             $778 = ((($770)) + 8|0);
             $779 = HEAP32[$778>>2]|0;
             $780 = ($779|0)==($717|0);
             if ($780) {
              HEAP32[$775>>2] = $770;
              HEAP32[$778>>2] = $773;
              $$3$i$i = $770;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $794 = ($768|0)==(0|0);
           if ($794) {
            break;
           }
           $795 = ((($717)) + 28|0);
           $796 = HEAP32[$795>>2]|0;
           $797 = (33268 + ($796<<2)|0);
           $798 = HEAP32[$797>>2]|0;
           $799 = ($717|0)==($798|0);
           do {
            if ($799) {
             HEAP32[$797>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $800 = 1 << $796;
             $801 = $800 ^ -1;
             $802 = HEAP32[(32968)>>2]|0;
             $803 = $802 & $801;
             HEAP32[(32968)>>2] = $803;
             break L314;
            } else {
             $804 = HEAP32[(32980)>>2]|0;
             $805 = ($768>>>0)<($804>>>0);
             if ($805) {
              _abort();
              // unreachable;
             } else {
              $806 = ((($768)) + 16|0);
              $807 = HEAP32[$806>>2]|0;
              $not$$i17$i = ($807|0)!=($717|0);
              $$sink1$i$i = $not$$i17$i&1;
              $808 = (((($768)) + 16|0) + ($$sink1$i$i<<2)|0);
              HEAP32[$808>>2] = $$3$i$i;
              $809 = ($$3$i$i|0)==(0|0);
              if ($809) {
               break L314;
              } else {
               break;
              }
             }
            }
           } while(0);
           $810 = HEAP32[(32980)>>2]|0;
           $811 = ($$3$i$i>>>0)<($810>>>0);
           if ($811) {
            _abort();
            // unreachable;
           }
           $812 = ((($$3$i$i)) + 24|0);
           HEAP32[$812>>2] = $768;
           $813 = ((($717)) + 16|0);
           $814 = HEAP32[$813>>2]|0;
           $815 = ($814|0)==(0|0);
           do {
            if (!($815)) {
             $816 = ($814>>>0)<($810>>>0);
             if ($816) {
              _abort();
              // unreachable;
             } else {
              $817 = ((($$3$i$i)) + 16|0);
              HEAP32[$817>>2] = $814;
              $818 = ((($814)) + 24|0);
              HEAP32[$818>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $819 = ((($813)) + 4|0);
           $820 = HEAP32[$819>>2]|0;
           $821 = ($820|0)==(0|0);
           if ($821) {
            break;
           }
           $822 = HEAP32[(32980)>>2]|0;
           $823 = ($820>>>0)<($822>>>0);
           if ($823) {
            _abort();
            // unreachable;
           } else {
            $824 = ((($$3$i$i)) + 20|0);
            HEAP32[$824>>2] = $820;
            $825 = ((($820)) + 24|0);
            HEAP32[$825>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $826 = (($717) + ($741)|0);
         $827 = (($741) + ($722))|0;
         $$0$i18$i = $826;$$0287$i$i = $827;
        } else {
         $$0$i18$i = $717;$$0287$i$i = $722;
        }
        $828 = ((($$0$i18$i)) + 4|0);
        $829 = HEAP32[$828>>2]|0;
        $830 = $829 & -2;
        HEAP32[$828>>2] = $830;
        $831 = $$0287$i$i | 1;
        $832 = ((($721)) + 4|0);
        HEAP32[$832>>2] = $831;
        $833 = (($721) + ($$0287$i$i)|0);
        HEAP32[$833>>2] = $$0287$i$i;
        $834 = $$0287$i$i >>> 3;
        $835 = ($$0287$i$i>>>0)<(256);
        if ($835) {
         $836 = $834 << 1;
         $837 = (33004 + ($836<<2)|0);
         $838 = HEAP32[8241]|0;
         $839 = 1 << $834;
         $840 = $838 & $839;
         $841 = ($840|0)==(0);
         do {
          if ($841) {
           $842 = $838 | $839;
           HEAP32[8241] = $842;
           $$pre$i19$i = ((($837)) + 8|0);
           $$0295$i$i = $837;$$pre$phi$i20$iZ2D = $$pre$i19$i;
          } else {
           $843 = ((($837)) + 8|0);
           $844 = HEAP32[$843>>2]|0;
           $845 = HEAP32[(32980)>>2]|0;
           $846 = ($844>>>0)<($845>>>0);
           if (!($846)) {
            $$0295$i$i = $844;$$pre$phi$i20$iZ2D = $843;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i20$iZ2D>>2] = $721;
         $847 = ((($$0295$i$i)) + 12|0);
         HEAP32[$847>>2] = $721;
         $848 = ((($721)) + 8|0);
         HEAP32[$848>>2] = $$0295$i$i;
         $849 = ((($721)) + 12|0);
         HEAP32[$849>>2] = $837;
         break;
        }
        $850 = $$0287$i$i >>> 8;
        $851 = ($850|0)==(0);
        do {
         if ($851) {
          $$0296$i$i = 0;
         } else {
          $852 = ($$0287$i$i>>>0)>(16777215);
          if ($852) {
           $$0296$i$i = 31;
           break;
          }
          $853 = (($850) + 1048320)|0;
          $854 = $853 >>> 16;
          $855 = $854 & 8;
          $856 = $850 << $855;
          $857 = (($856) + 520192)|0;
          $858 = $857 >>> 16;
          $859 = $858 & 4;
          $860 = $859 | $855;
          $861 = $856 << $859;
          $862 = (($861) + 245760)|0;
          $863 = $862 >>> 16;
          $864 = $863 & 2;
          $865 = $860 | $864;
          $866 = (14 - ($865))|0;
          $867 = $861 << $864;
          $868 = $867 >>> 15;
          $869 = (($866) + ($868))|0;
          $870 = $869 << 1;
          $871 = (($869) + 7)|0;
          $872 = $$0287$i$i >>> $871;
          $873 = $872 & 1;
          $874 = $873 | $870;
          $$0296$i$i = $874;
         }
        } while(0);
        $875 = (33268 + ($$0296$i$i<<2)|0);
        $876 = ((($721)) + 28|0);
        HEAP32[$876>>2] = $$0296$i$i;
        $877 = ((($721)) + 16|0);
        $878 = ((($877)) + 4|0);
        HEAP32[$878>>2] = 0;
        HEAP32[$877>>2] = 0;
        $879 = HEAP32[(32968)>>2]|0;
        $880 = 1 << $$0296$i$i;
        $881 = $879 & $880;
        $882 = ($881|0)==(0);
        if ($882) {
         $883 = $879 | $880;
         HEAP32[(32968)>>2] = $883;
         HEAP32[$875>>2] = $721;
         $884 = ((($721)) + 24|0);
         HEAP32[$884>>2] = $875;
         $885 = ((($721)) + 12|0);
         HEAP32[$885>>2] = $721;
         $886 = ((($721)) + 8|0);
         HEAP32[$886>>2] = $721;
         break;
        }
        $887 = HEAP32[$875>>2]|0;
        $888 = ($$0296$i$i|0)==(31);
        $889 = $$0296$i$i >>> 1;
        $890 = (25 - ($889))|0;
        $891 = $888 ? 0 : $890;
        $892 = $$0287$i$i << $891;
        $$0288$i$i = $892;$$0289$i$i = $887;
        while(1) {
         $893 = ((($$0289$i$i)) + 4|0);
         $894 = HEAP32[$893>>2]|0;
         $895 = $894 & -8;
         $896 = ($895|0)==($$0287$i$i|0);
         if ($896) {
          label = 265;
          break;
         }
         $897 = $$0288$i$i >>> 31;
         $898 = (((($$0289$i$i)) + 16|0) + ($897<<2)|0);
         $899 = $$0288$i$i << 1;
         $900 = HEAP32[$898>>2]|0;
         $901 = ($900|0)==(0|0);
         if ($901) {
          label = 262;
          break;
         } else {
          $$0288$i$i = $899;$$0289$i$i = $900;
         }
        }
        if ((label|0) == 262) {
         $902 = HEAP32[(32980)>>2]|0;
         $903 = ($898>>>0)<($902>>>0);
         if ($903) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$898>>2] = $721;
          $904 = ((($721)) + 24|0);
          HEAP32[$904>>2] = $$0289$i$i;
          $905 = ((($721)) + 12|0);
          HEAP32[$905>>2] = $721;
          $906 = ((($721)) + 8|0);
          HEAP32[$906>>2] = $721;
          break;
         }
        }
        else if ((label|0) == 265) {
         $907 = ((($$0289$i$i)) + 8|0);
         $908 = HEAP32[$907>>2]|0;
         $909 = HEAP32[(32980)>>2]|0;
         $910 = ($908>>>0)>=($909>>>0);
         $not$7$i$i = ($$0289$i$i>>>0)>=($909>>>0);
         $911 = $910 & $not$7$i$i;
         if ($911) {
          $912 = ((($908)) + 12|0);
          HEAP32[$912>>2] = $721;
          HEAP32[$907>>2] = $721;
          $913 = ((($721)) + 8|0);
          HEAP32[$913>>2] = $908;
          $914 = ((($721)) + 12|0);
          HEAP32[$914>>2] = $$0289$i$i;
          $915 = ((($721)) + 24|0);
          HEAP32[$915>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1047 = ((($709)) + 8|0);
      $$0 = $1047;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (33412);
    while(1) {
     $916 = HEAP32[$$0$i$i$i>>2]|0;
     $917 = ($916>>>0)>($630>>>0);
     if (!($917)) {
      $918 = ((($$0$i$i$i)) + 4|0);
      $919 = HEAP32[$918>>2]|0;
      $920 = (($916) + ($919)|0);
      $921 = ($920>>>0)>($630>>>0);
      if ($921) {
       break;
      }
     }
     $922 = ((($$0$i$i$i)) + 8|0);
     $923 = HEAP32[$922>>2]|0;
     $$0$i$i$i = $923;
    }
    $924 = ((($920)) + -47|0);
    $925 = ((($924)) + 8|0);
    $926 = $925;
    $927 = $926 & 7;
    $928 = ($927|0)==(0);
    $929 = (0 - ($926))|0;
    $930 = $929 & 7;
    $931 = $928 ? 0 : $930;
    $932 = (($924) + ($931)|0);
    $933 = ((($630)) + 16|0);
    $934 = ($932>>>0)<($933>>>0);
    $935 = $934 ? $630 : $932;
    $936 = ((($935)) + 8|0);
    $937 = ((($935)) + 24|0);
    $938 = (($$723948$i) + -40)|0;
    $939 = ((($$749$i)) + 8|0);
    $940 = $939;
    $941 = $940 & 7;
    $942 = ($941|0)==(0);
    $943 = (0 - ($940))|0;
    $944 = $943 & 7;
    $945 = $942 ? 0 : $944;
    $946 = (($$749$i) + ($945)|0);
    $947 = (($938) - ($945))|0;
    HEAP32[(32988)>>2] = $946;
    HEAP32[(32976)>>2] = $947;
    $948 = $947 | 1;
    $949 = ((($946)) + 4|0);
    HEAP32[$949>>2] = $948;
    $950 = (($946) + ($947)|0);
    $951 = ((($950)) + 4|0);
    HEAP32[$951>>2] = 40;
    $952 = HEAP32[(33452)>>2]|0;
    HEAP32[(32992)>>2] = $952;
    $953 = ((($935)) + 4|0);
    HEAP32[$953>>2] = 27;
    ;HEAP32[$936>>2]=HEAP32[(33412)>>2]|0;HEAP32[$936+4>>2]=HEAP32[(33412)+4>>2]|0;HEAP32[$936+8>>2]=HEAP32[(33412)+8>>2]|0;HEAP32[$936+12>>2]=HEAP32[(33412)+12>>2]|0;
    HEAP32[(33412)>>2] = $$749$i;
    HEAP32[(33416)>>2] = $$723948$i;
    HEAP32[(33424)>>2] = 0;
    HEAP32[(33420)>>2] = $936;
    $955 = $937;
    while(1) {
     $954 = ((($955)) + 4|0);
     HEAP32[$954>>2] = 7;
     $956 = ((($955)) + 8|0);
     $957 = ($956>>>0)<($920>>>0);
     if ($957) {
      $955 = $954;
     } else {
      break;
     }
    }
    $958 = ($935|0)==($630|0);
    if (!($958)) {
     $959 = $935;
     $960 = $630;
     $961 = (($959) - ($960))|0;
     $962 = HEAP32[$953>>2]|0;
     $963 = $962 & -2;
     HEAP32[$953>>2] = $963;
     $964 = $961 | 1;
     $965 = ((($630)) + 4|0);
     HEAP32[$965>>2] = $964;
     HEAP32[$935>>2] = $961;
     $966 = $961 >>> 3;
     $967 = ($961>>>0)<(256);
     if ($967) {
      $968 = $966 << 1;
      $969 = (33004 + ($968<<2)|0);
      $970 = HEAP32[8241]|0;
      $971 = 1 << $966;
      $972 = $970 & $971;
      $973 = ($972|0)==(0);
      if ($973) {
       $974 = $970 | $971;
       HEAP32[8241] = $974;
       $$pre$i$i = ((($969)) + 8|0);
       $$0211$i$i = $969;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $975 = ((($969)) + 8|0);
       $976 = HEAP32[$975>>2]|0;
       $977 = HEAP32[(32980)>>2]|0;
       $978 = ($976>>>0)<($977>>>0);
       if ($978) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $976;$$pre$phi$i$iZ2D = $975;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $630;
      $979 = ((($$0211$i$i)) + 12|0);
      HEAP32[$979>>2] = $630;
      $980 = ((($630)) + 8|0);
      HEAP32[$980>>2] = $$0211$i$i;
      $981 = ((($630)) + 12|0);
      HEAP32[$981>>2] = $969;
      break;
     }
     $982 = $961 >>> 8;
     $983 = ($982|0)==(0);
     if ($983) {
      $$0212$i$i = 0;
     } else {
      $984 = ($961>>>0)>(16777215);
      if ($984) {
       $$0212$i$i = 31;
      } else {
       $985 = (($982) + 1048320)|0;
       $986 = $985 >>> 16;
       $987 = $986 & 8;
       $988 = $982 << $987;
       $989 = (($988) + 520192)|0;
       $990 = $989 >>> 16;
       $991 = $990 & 4;
       $992 = $991 | $987;
       $993 = $988 << $991;
       $994 = (($993) + 245760)|0;
       $995 = $994 >>> 16;
       $996 = $995 & 2;
       $997 = $992 | $996;
       $998 = (14 - ($997))|0;
       $999 = $993 << $996;
       $1000 = $999 >>> 15;
       $1001 = (($998) + ($1000))|0;
       $1002 = $1001 << 1;
       $1003 = (($1001) + 7)|0;
       $1004 = $961 >>> $1003;
       $1005 = $1004 & 1;
       $1006 = $1005 | $1002;
       $$0212$i$i = $1006;
      }
     }
     $1007 = (33268 + ($$0212$i$i<<2)|0);
     $1008 = ((($630)) + 28|0);
     HEAP32[$1008>>2] = $$0212$i$i;
     $1009 = ((($630)) + 20|0);
     HEAP32[$1009>>2] = 0;
     HEAP32[$933>>2] = 0;
     $1010 = HEAP32[(32968)>>2]|0;
     $1011 = 1 << $$0212$i$i;
     $1012 = $1010 & $1011;
     $1013 = ($1012|0)==(0);
     if ($1013) {
      $1014 = $1010 | $1011;
      HEAP32[(32968)>>2] = $1014;
      HEAP32[$1007>>2] = $630;
      $1015 = ((($630)) + 24|0);
      HEAP32[$1015>>2] = $1007;
      $1016 = ((($630)) + 12|0);
      HEAP32[$1016>>2] = $630;
      $1017 = ((($630)) + 8|0);
      HEAP32[$1017>>2] = $630;
      break;
     }
     $1018 = HEAP32[$1007>>2]|0;
     $1019 = ($$0212$i$i|0)==(31);
     $1020 = $$0212$i$i >>> 1;
     $1021 = (25 - ($1020))|0;
     $1022 = $1019 ? 0 : $1021;
     $1023 = $961 << $1022;
     $$0206$i$i = $1023;$$0207$i$i = $1018;
     while(1) {
      $1024 = ((($$0207$i$i)) + 4|0);
      $1025 = HEAP32[$1024>>2]|0;
      $1026 = $1025 & -8;
      $1027 = ($1026|0)==($961|0);
      if ($1027) {
       label = 292;
       break;
      }
      $1028 = $$0206$i$i >>> 31;
      $1029 = (((($$0207$i$i)) + 16|0) + ($1028<<2)|0);
      $1030 = $$0206$i$i << 1;
      $1031 = HEAP32[$1029>>2]|0;
      $1032 = ($1031|0)==(0|0);
      if ($1032) {
       label = 289;
       break;
      } else {
       $$0206$i$i = $1030;$$0207$i$i = $1031;
      }
     }
     if ((label|0) == 289) {
      $1033 = HEAP32[(32980)>>2]|0;
      $1034 = ($1029>>>0)<($1033>>>0);
      if ($1034) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$1029>>2] = $630;
       $1035 = ((($630)) + 24|0);
       HEAP32[$1035>>2] = $$0207$i$i;
       $1036 = ((($630)) + 12|0);
       HEAP32[$1036>>2] = $630;
       $1037 = ((($630)) + 8|0);
       HEAP32[$1037>>2] = $630;
       break;
      }
     }
     else if ((label|0) == 292) {
      $1038 = ((($$0207$i$i)) + 8|0);
      $1039 = HEAP32[$1038>>2]|0;
      $1040 = HEAP32[(32980)>>2]|0;
      $1041 = ($1039>>>0)>=($1040>>>0);
      $not$$i$i = ($$0207$i$i>>>0)>=($1040>>>0);
      $1042 = $1041 & $not$$i$i;
      if ($1042) {
       $1043 = ((($1039)) + 12|0);
       HEAP32[$1043>>2] = $630;
       HEAP32[$1038>>2] = $630;
       $1044 = ((($630)) + 8|0);
       HEAP32[$1044>>2] = $1039;
       $1045 = ((($630)) + 12|0);
       HEAP32[$1045>>2] = $$0207$i$i;
       $1046 = ((($630)) + 24|0);
       HEAP32[$1046>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1048 = HEAP32[(32976)>>2]|0;
  $1049 = ($1048>>>0)>($$0197>>>0);
  if ($1049) {
   $1050 = (($1048) - ($$0197))|0;
   HEAP32[(32976)>>2] = $1050;
   $1051 = HEAP32[(32988)>>2]|0;
   $1052 = (($1051) + ($$0197)|0);
   HEAP32[(32988)>>2] = $1052;
   $1053 = $1050 | 1;
   $1054 = ((($1052)) + 4|0);
   HEAP32[$1054>>2] = $1053;
   $1055 = $$0197 | 3;
   $1056 = ((($1051)) + 4|0);
   HEAP32[$1056>>2] = $1055;
   $1057 = ((($1051)) + 8|0);
   $$0 = $1057;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1058 = (___errno_location()|0);
 HEAP32[$1058>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0212$i = 0, $$0212$in$i = 0, $$0383 = 0, $$0384 = 0, $$0396 = 0, $$0403 = 0, $$1 = 0, $$1382 = 0, $$1387 = 0, $$1390 = 0, $$1398 = 0, $$1402 = 0, $$2 = 0, $$3 = 0, $$3400 = 0, $$pre = 0, $$pre$phi443Z2D = 0, $$pre$phi445Z2D = 0, $$pre$phiZ2D = 0, $$pre442 = 0;
 var $$pre444 = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0;
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0;
 var $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0;
 var $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0;
 var $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0;
 var $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $cond421 = 0, $cond422 = 0, $not$ = 0, $not$405 = 0, $not$437 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(32980)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 L10: do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(32984)>>2]|0;
   $20 = ($16|0)==($19|0);
   if ($20) {
    $104 = ((($10)) + 4|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = $105 & 3;
    $107 = ($106|0)==(3);
    if (!($107)) {
     $$1 = $16;$$1382 = $17;$113 = $16;
     break;
    }
    $108 = (($16) + ($17)|0);
    $109 = ((($16)) + 4|0);
    $110 = $17 | 1;
    $111 = $105 & -2;
    HEAP32[(32972)>>2] = $17;
    HEAP32[$104>>2] = $111;
    HEAP32[$109>>2] = $110;
    HEAP32[$108>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (33004 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($24>>>0)<($3>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[8241]|0;
     $38 = $37 & $36;
     HEAP32[8241] = $38;
     $$1 = $16;$$1382 = $17;$113 = $16;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre444 = ((($26)) + 8|0);
     $$pre$phi445Z2D = $$pre444;
    } else {
     $40 = ($26>>>0)<($3>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi445Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi445Z2D>>2] = $24;
    $$1 = $16;$$1382 = $17;$113 = $16;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1387 = $63;$$1390 = $59;
      }
     } else {
      $$1387 = $61;$$1390 = $60;
     }
     while(1) {
      $65 = ((($$1387)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if (!($67)) {
       $$1387 = $66;$$1390 = $65;
       continue;
      }
      $68 = ((($$1387)) + 16|0);
      $69 = HEAP32[$68>>2]|0;
      $70 = ($69|0)==(0|0);
      if ($70) {
       break;
      } else {
       $$1387 = $69;$$1390 = $68;
      }
     }
     $71 = ($$1390>>>0)<($3>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1390>>2] = 0;
      $$3 = $$1387;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51>>>0)<($3>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1382 = $17;$113 = $16;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (33268 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($16|0)==($76|0);
    do {
     if ($77) {
      HEAP32[$75>>2] = $$3;
      $cond421 = ($$3|0)==(0|0);
      if ($cond421) {
       $78 = 1 << $74;
       $79 = $78 ^ -1;
       $80 = HEAP32[(32968)>>2]|0;
       $81 = $80 & $79;
       HEAP32[(32968)>>2] = $81;
       $$1 = $16;$$1382 = $17;$113 = $16;
       break L10;
      }
     } else {
      $82 = HEAP32[(32980)>>2]|0;
      $83 = ($46>>>0)<($82>>>0);
      if ($83) {
       _abort();
       // unreachable;
      } else {
       $84 = ((($46)) + 16|0);
       $85 = HEAP32[$84>>2]|0;
       $not$405 = ($85|0)!=($16|0);
       $$sink3 = $not$405&1;
       $86 = (((($46)) + 16|0) + ($$sink3<<2)|0);
       HEAP32[$86>>2] = $$3;
       $87 = ($$3|0)==(0|0);
       if ($87) {
        $$1 = $16;$$1382 = $17;$113 = $16;
        break L10;
       } else {
        break;
       }
      }
     }
    } while(0);
    $88 = HEAP32[(32980)>>2]|0;
    $89 = ($$3>>>0)<($88>>>0);
    if ($89) {
     _abort();
     // unreachable;
    }
    $90 = ((($$3)) + 24|0);
    HEAP32[$90>>2] = $46;
    $91 = ((($16)) + 16|0);
    $92 = HEAP32[$91>>2]|0;
    $93 = ($92|0)==(0|0);
    do {
     if (!($93)) {
      $94 = ($92>>>0)<($88>>>0);
      if ($94) {
       _abort();
       // unreachable;
      } else {
       $95 = ((($$3)) + 16|0);
       HEAP32[$95>>2] = $92;
       $96 = ((($92)) + 24|0);
       HEAP32[$96>>2] = $$3;
       break;
      }
     }
    } while(0);
    $97 = ((($91)) + 4|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = ($98|0)==(0|0);
    if ($99) {
     $$1 = $16;$$1382 = $17;$113 = $16;
    } else {
     $100 = HEAP32[(32980)>>2]|0;
     $101 = ($98>>>0)<($100>>>0);
     if ($101) {
      _abort();
      // unreachable;
     } else {
      $102 = ((($$3)) + 20|0);
      HEAP32[$102>>2] = $98;
      $103 = ((($98)) + 24|0);
      HEAP32[$103>>2] = $$3;
      $$1 = $16;$$1382 = $17;$113 = $16;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1382 = $9;$113 = $2;
  }
 } while(0);
 $112 = ($113>>>0)<($10>>>0);
 if (!($112)) {
  _abort();
  // unreachable;
 }
 $114 = ((($10)) + 4|0);
 $115 = HEAP32[$114>>2]|0;
 $116 = $115 & 1;
 $117 = ($116|0)==(0);
 if ($117) {
  _abort();
  // unreachable;
 }
 $118 = $115 & 2;
 $119 = ($118|0)==(0);
 if ($119) {
  $120 = HEAP32[(32988)>>2]|0;
  $121 = ($10|0)==($120|0);
  $122 = HEAP32[(32984)>>2]|0;
  if ($121) {
   $123 = HEAP32[(32976)>>2]|0;
   $124 = (($123) + ($$1382))|0;
   HEAP32[(32976)>>2] = $124;
   HEAP32[(32988)>>2] = $$1;
   $125 = $124 | 1;
   $126 = ((($$1)) + 4|0);
   HEAP32[$126>>2] = $125;
   $127 = ($$1|0)==($122|0);
   if (!($127)) {
    return;
   }
   HEAP32[(32984)>>2] = 0;
   HEAP32[(32972)>>2] = 0;
   return;
  }
  $128 = ($10|0)==($122|0);
  if ($128) {
   $129 = HEAP32[(32972)>>2]|0;
   $130 = (($129) + ($$1382))|0;
   HEAP32[(32972)>>2] = $130;
   HEAP32[(32984)>>2] = $113;
   $131 = $130 | 1;
   $132 = ((($$1)) + 4|0);
   HEAP32[$132>>2] = $131;
   $133 = (($113) + ($130)|0);
   HEAP32[$133>>2] = $130;
   return;
  }
  $134 = $115 & -8;
  $135 = (($134) + ($$1382))|0;
  $136 = $115 >>> 3;
  $137 = ($115>>>0)<(256);
  L108: do {
   if ($137) {
    $138 = ((($10)) + 8|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = ((($10)) + 12|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $136 << 1;
    $143 = (33004 + ($142<<2)|0);
    $144 = ($139|0)==($143|0);
    if (!($144)) {
     $145 = HEAP32[(32980)>>2]|0;
     $146 = ($139>>>0)<($145>>>0);
     if ($146) {
      _abort();
      // unreachable;
     }
     $147 = ((($139)) + 12|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($148|0)==($10|0);
     if (!($149)) {
      _abort();
      // unreachable;
     }
    }
    $150 = ($141|0)==($139|0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[8241]|0;
     $154 = $153 & $152;
     HEAP32[8241] = $154;
     break;
    }
    $155 = ($141|0)==($143|0);
    if ($155) {
     $$pre442 = ((($141)) + 8|0);
     $$pre$phi443Z2D = $$pre442;
    } else {
     $156 = HEAP32[(32980)>>2]|0;
     $157 = ($141>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     }
     $158 = ((($141)) + 8|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = ($159|0)==($10|0);
     if ($160) {
      $$pre$phi443Z2D = $158;
     } else {
      _abort();
      // unreachable;
     }
    }
    $161 = ((($139)) + 12|0);
    HEAP32[$161>>2] = $141;
    HEAP32[$$pre$phi443Z2D>>2] = $139;
   } else {
    $162 = ((($10)) + 24|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ((($10)) + 12|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ($165|0)==($10|0);
    do {
     if ($166) {
      $177 = ((($10)) + 16|0);
      $178 = ((($177)) + 4|0);
      $179 = HEAP32[$178>>2]|0;
      $180 = ($179|0)==(0|0);
      if ($180) {
       $181 = HEAP32[$177>>2]|0;
       $182 = ($181|0)==(0|0);
       if ($182) {
        $$3400 = 0;
        break;
       } else {
        $$1398 = $181;$$1402 = $177;
       }
      } else {
       $$1398 = $179;$$1402 = $178;
      }
      while(1) {
       $183 = ((($$1398)) + 20|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($184|0)==(0|0);
       if (!($185)) {
        $$1398 = $184;$$1402 = $183;
        continue;
       }
       $186 = ((($$1398)) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)==(0|0);
       if ($188) {
        break;
       } else {
        $$1398 = $187;$$1402 = $186;
       }
      }
      $189 = HEAP32[(32980)>>2]|0;
      $190 = ($$1402>>>0)<($189>>>0);
      if ($190) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1402>>2] = 0;
       $$3400 = $$1398;
       break;
      }
     } else {
      $167 = ((($10)) + 8|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = HEAP32[(32980)>>2]|0;
      $170 = ($168>>>0)<($169>>>0);
      if ($170) {
       _abort();
       // unreachable;
      }
      $171 = ((($168)) + 12|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==($10|0);
      if (!($173)) {
       _abort();
       // unreachable;
      }
      $174 = ((($165)) + 8|0);
      $175 = HEAP32[$174>>2]|0;
      $176 = ($175|0)==($10|0);
      if ($176) {
       HEAP32[$171>>2] = $165;
       HEAP32[$174>>2] = $168;
       $$3400 = $165;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $191 = ($163|0)==(0|0);
    if (!($191)) {
     $192 = ((($10)) + 28|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = (33268 + ($193<<2)|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = ($10|0)==($195|0);
     do {
      if ($196) {
       HEAP32[$194>>2] = $$3400;
       $cond422 = ($$3400|0)==(0|0);
       if ($cond422) {
        $197 = 1 << $193;
        $198 = $197 ^ -1;
        $199 = HEAP32[(32968)>>2]|0;
        $200 = $199 & $198;
        HEAP32[(32968)>>2] = $200;
        break L108;
       }
      } else {
       $201 = HEAP32[(32980)>>2]|0;
       $202 = ($163>>>0)<($201>>>0);
       if ($202) {
        _abort();
        // unreachable;
       } else {
        $203 = ((($163)) + 16|0);
        $204 = HEAP32[$203>>2]|0;
        $not$ = ($204|0)!=($10|0);
        $$sink5 = $not$&1;
        $205 = (((($163)) + 16|0) + ($$sink5<<2)|0);
        HEAP32[$205>>2] = $$3400;
        $206 = ($$3400|0)==(0|0);
        if ($206) {
         break L108;
        } else {
         break;
        }
       }
      }
     } while(0);
     $207 = HEAP32[(32980)>>2]|0;
     $208 = ($$3400>>>0)<($207>>>0);
     if ($208) {
      _abort();
      // unreachable;
     }
     $209 = ((($$3400)) + 24|0);
     HEAP32[$209>>2] = $163;
     $210 = ((($10)) + 16|0);
     $211 = HEAP32[$210>>2]|0;
     $212 = ($211|0)==(0|0);
     do {
      if (!($212)) {
       $213 = ($211>>>0)<($207>>>0);
       if ($213) {
        _abort();
        // unreachable;
       } else {
        $214 = ((($$3400)) + 16|0);
        HEAP32[$214>>2] = $211;
        $215 = ((($211)) + 24|0);
        HEAP32[$215>>2] = $$3400;
        break;
       }
      }
     } while(0);
     $216 = ((($210)) + 4|0);
     $217 = HEAP32[$216>>2]|0;
     $218 = ($217|0)==(0|0);
     if (!($218)) {
      $219 = HEAP32[(32980)>>2]|0;
      $220 = ($217>>>0)<($219>>>0);
      if ($220) {
       _abort();
       // unreachable;
      } else {
       $221 = ((($$3400)) + 20|0);
       HEAP32[$221>>2] = $217;
       $222 = ((($217)) + 24|0);
       HEAP32[$222>>2] = $$3400;
       break;
      }
     }
    }
   }
  } while(0);
  $223 = $135 | 1;
  $224 = ((($$1)) + 4|0);
  HEAP32[$224>>2] = $223;
  $225 = (($113) + ($135)|0);
  HEAP32[$225>>2] = $135;
  $226 = HEAP32[(32984)>>2]|0;
  $227 = ($$1|0)==($226|0);
  if ($227) {
   HEAP32[(32972)>>2] = $135;
   return;
  } else {
   $$2 = $135;
  }
 } else {
  $228 = $115 & -2;
  HEAP32[$114>>2] = $228;
  $229 = $$1382 | 1;
  $230 = ((($$1)) + 4|0);
  HEAP32[$230>>2] = $229;
  $231 = (($113) + ($$1382)|0);
  HEAP32[$231>>2] = $$1382;
  $$2 = $$1382;
 }
 $232 = $$2 >>> 3;
 $233 = ($$2>>>0)<(256);
 if ($233) {
  $234 = $232 << 1;
  $235 = (33004 + ($234<<2)|0);
  $236 = HEAP32[8241]|0;
  $237 = 1 << $232;
  $238 = $236 & $237;
  $239 = ($238|0)==(0);
  if ($239) {
   $240 = $236 | $237;
   HEAP32[8241] = $240;
   $$pre = ((($235)) + 8|0);
   $$0403 = $235;$$pre$phiZ2D = $$pre;
  } else {
   $241 = ((($235)) + 8|0);
   $242 = HEAP32[$241>>2]|0;
   $243 = HEAP32[(32980)>>2]|0;
   $244 = ($242>>>0)<($243>>>0);
   if ($244) {
    _abort();
    // unreachable;
   } else {
    $$0403 = $242;$$pre$phiZ2D = $241;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $245 = ((($$0403)) + 12|0);
  HEAP32[$245>>2] = $$1;
  $246 = ((($$1)) + 8|0);
  HEAP32[$246>>2] = $$0403;
  $247 = ((($$1)) + 12|0);
  HEAP32[$247>>2] = $235;
  return;
 }
 $248 = $$2 >>> 8;
 $249 = ($248|0)==(0);
 if ($249) {
  $$0396 = 0;
 } else {
  $250 = ($$2>>>0)>(16777215);
  if ($250) {
   $$0396 = 31;
  } else {
   $251 = (($248) + 1048320)|0;
   $252 = $251 >>> 16;
   $253 = $252 & 8;
   $254 = $248 << $253;
   $255 = (($254) + 520192)|0;
   $256 = $255 >>> 16;
   $257 = $256 & 4;
   $258 = $257 | $253;
   $259 = $254 << $257;
   $260 = (($259) + 245760)|0;
   $261 = $260 >>> 16;
   $262 = $261 & 2;
   $263 = $258 | $262;
   $264 = (14 - ($263))|0;
   $265 = $259 << $262;
   $266 = $265 >>> 15;
   $267 = (($264) + ($266))|0;
   $268 = $267 << 1;
   $269 = (($267) + 7)|0;
   $270 = $$2 >>> $269;
   $271 = $270 & 1;
   $272 = $271 | $268;
   $$0396 = $272;
  }
 }
 $273 = (33268 + ($$0396<<2)|0);
 $274 = ((($$1)) + 28|0);
 HEAP32[$274>>2] = $$0396;
 $275 = ((($$1)) + 16|0);
 $276 = ((($$1)) + 20|0);
 HEAP32[$276>>2] = 0;
 HEAP32[$275>>2] = 0;
 $277 = HEAP32[(32968)>>2]|0;
 $278 = 1 << $$0396;
 $279 = $277 & $278;
 $280 = ($279|0)==(0);
 do {
  if ($280) {
   $281 = $277 | $278;
   HEAP32[(32968)>>2] = $281;
   HEAP32[$273>>2] = $$1;
   $282 = ((($$1)) + 24|0);
   HEAP32[$282>>2] = $273;
   $283 = ((($$1)) + 12|0);
   HEAP32[$283>>2] = $$1;
   $284 = ((($$1)) + 8|0);
   HEAP32[$284>>2] = $$1;
  } else {
   $285 = HEAP32[$273>>2]|0;
   $286 = ($$0396|0)==(31);
   $287 = $$0396 >>> 1;
   $288 = (25 - ($287))|0;
   $289 = $286 ? 0 : $288;
   $290 = $$2 << $289;
   $$0383 = $290;$$0384 = $285;
   while(1) {
    $291 = ((($$0384)) + 4|0);
    $292 = HEAP32[$291>>2]|0;
    $293 = $292 & -8;
    $294 = ($293|0)==($$2|0);
    if ($294) {
     label = 124;
     break;
    }
    $295 = $$0383 >>> 31;
    $296 = (((($$0384)) + 16|0) + ($295<<2)|0);
    $297 = $$0383 << 1;
    $298 = HEAP32[$296>>2]|0;
    $299 = ($298|0)==(0|0);
    if ($299) {
     label = 121;
     break;
    } else {
     $$0383 = $297;$$0384 = $298;
    }
   }
   if ((label|0) == 121) {
    $300 = HEAP32[(32980)>>2]|0;
    $301 = ($296>>>0)<($300>>>0);
    if ($301) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$296>>2] = $$1;
     $302 = ((($$1)) + 24|0);
     HEAP32[$302>>2] = $$0384;
     $303 = ((($$1)) + 12|0);
     HEAP32[$303>>2] = $$1;
     $304 = ((($$1)) + 8|0);
     HEAP32[$304>>2] = $$1;
     break;
    }
   }
   else if ((label|0) == 124) {
    $305 = ((($$0384)) + 8|0);
    $306 = HEAP32[$305>>2]|0;
    $307 = HEAP32[(32980)>>2]|0;
    $308 = ($306>>>0)>=($307>>>0);
    $not$437 = ($$0384>>>0)>=($307>>>0);
    $309 = $308 & $not$437;
    if ($309) {
     $310 = ((($306)) + 12|0);
     HEAP32[$310>>2] = $$1;
     HEAP32[$305>>2] = $$1;
     $311 = ((($$1)) + 8|0);
     HEAP32[$311>>2] = $306;
     $312 = ((($$1)) + 12|0);
     HEAP32[$312>>2] = $$0384;
     $313 = ((($$1)) + 24|0);
     HEAP32[$313>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $314 = HEAP32[(32996)>>2]|0;
 $315 = (($314) + -1)|0;
 HEAP32[(32996)>>2] = $315;
 $316 = ($315|0)==(0);
 if ($316) {
  $$0212$in$i = (33420);
 } else {
  return;
 }
 while(1) {
  $$0212$i = HEAP32[$$0212$in$i>>2]|0;
  $317 = ($$0212$i|0)==(0|0);
  $318 = ((($$0212$i)) + 8|0);
  if ($317) {
   break;
  } else {
   $$0212$in$i = $318;
  }
 }
 HEAP32[(32996)>>2] = -1;
 return;
}
function runPostSets() {
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memmove(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if (((src|0) < (dest|0)) & ((dest|0) < ((src + num)|0))) {
      // Unlikely case: Copy backwards in a safe manner
      ret = dest;
      src = (src + num)|0;
      dest = (dest + num)|0;
      while ((num|0) > 0) {
        dest = (dest - 1)|0;
        src = (src - 1)|0;
        num = (num - 1)|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      }
      dest = ret;
    } else {
      _memcpy(dest, src, num) | 0;
    }
    return dest | 0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&3](a1|0,a2|0,a3|0)|0;
}

function b0(p0) {
 p0 = p0|0; abort(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(1);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdout_write,___stdio_seek,___stdio_write];

  return { stackSave: stackSave, _curve25519_sign: _curve25519_sign, getTempRet0: getTempRet0, _bitshift64Lshr: _bitshift64Lshr, _i64Subtract: _i64Subtract, _bitshift64Shl: _bitshift64Shl, _curve25519_verify: _curve25519_verify, _fflush: _fflush, _bitshift64Ashr: _bitshift64Ashr, _memset: _memset, _sbrk: _sbrk, _memcpy: _memcpy, stackAlloc: stackAlloc, ___muldi3: ___muldi3, _crypto_sign_ed25519_ref10_ge_scalarmult_base: _crypto_sign_ed25519_ref10_ge_scalarmult_base, _curve25519_donna: _curve25519_donna, setTempRet0: setTempRet0, _i64Add: _i64Add, _emscripten_get_global_libc: _emscripten_get_global_libc, ___errno_location: ___errno_location, ___muldsi3: ___muldsi3, _free: _free, runPostSets: runPostSets, setThrew: setThrew, establishStackSpace: establishStackSpace, _memmove: _memmove, _sph_sha512_init: _sph_sha512_init, stackRestore: stackRestore, _malloc: _malloc, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var stackSave = Module["stackSave"] = asm["stackSave"];
var _curve25519_sign = Module["_curve25519_sign"] = asm["_curve25519_sign"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _curve25519_verify = Module["_curve25519_verify"] = asm["_curve25519_verify"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _crypto_sign_ed25519_ref10_ge_scalarmult_base = Module["_crypto_sign_ed25519_ref10_ge_scalarmult_base"] = asm["_crypto_sign_ed25519_ref10_ge_scalarmult_base"];
var _curve25519_donna = Module["_curve25519_donna"] = asm["_curve25519_donna"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldsi3 = Module["___muldsi3"] = asm["___muldsi3"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _sph_sha512_init = Module["_sph_sha512_init"] = asm["_sph_sha512_init"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



