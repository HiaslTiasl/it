/*
 * https://github.com/HiaslTiasl/it
 */
 
var it = (function () {
"use strict";

/** Represents a filtered value. */
function Filtered() {}

/** Returns the index of the next item to be processed. */
Filtered.prototype.nextIndex = function (index, length) {
	return index + 1;
};

/** Represents a filtered value, with all remaining items filtered as well. */
function FilteredRest() {}

FilteredRest.prototype = Object.create(Filtered.prototype);
FilteredRest.prototype.constructor = FilteredRest;

FilteredRest.prototype.nextIndex = function (index, length) {
	return length;
};

/** Represents a filtered value, where all items until the given offset are filtered. */
function FilteredUntil(offset) {
	this.offset = offset;
}

FilteredUntil.prototype = Object.create(Filtered.prototype);
FilteredUntil.prototype.constructor = FilteredUntil;

FilteredUntil.prototype.nextIndex = function (index, length) {
	return this.offset;
};

/** Returns a Filtered object that filters all items until the given offset. */
function filteredUntil(offset) {
	return FILTERED_UNTIL[offset] || (FILTERED_UNTIL[offset] = new FilteredUntil(offset));
}

var FILTERED       = new Filtered();	// Special return value for filtered items
var FILTERED_REST  = new FilteredRest;	// Special return value for filtered items with cancellation of the whole operation
var FILTERED_UNTIL = {};				// Cache for instances of FilteredUntil

/**
 * @callback Mapper
 * Maps a given combination of value, key, and collection to some other value.
 * @param {?} value The value.
 * @param {number|string} The key.
 * @param {Array|Object} The collection.
 * @return {?} A new value.
 */
 
/**
 * @callback Filter
 * Specifies a filter condition for a given combination of value, key, and collection.
 * @param {?} value The value.
 * @param {number|string} The key.
 * @param {Array|Object} The collection.
 * @return {boolean} true if the given combination passes the filter and should be further considered,
 *         false otherwise.
 */
 
/**
 * @callback Reducer
 * Specifies how to reduce items to a result. In each iteration, the reducer gets the result from the previous iteration,
 * as well as the current value and key and the collection object, and returns an intermediate result to be considered
 * in the next iteration. The last iteration returns the final result.
 * @param {?} res The previous result.
 * @param {?} value The current value.
 * @param {number|string} key The current key.
 * @param {Array|Object} coll The collection.
 * @return {?} The intermediate result for intermediate iterations, or the final result for the last iteration.
 */

/**
 * Applies the given mapper and reducer function to the given collection and returns the result.
 * @param {Array|Object} coll A collection, either an array or an object.
 * @param {Mapper} [mapper] gets passed items from the collection and transforms them in other items, or filters them out.
 *        Defaults to the identity function.
 * @param {Reducer} [reducer] gets passed the previous reducer result and the previous mapper result and returns a new result.
 *        If ommitted, the result will be a collection of the same type as coll (array or object), containing the
 *        key-value-pairs returnd from mapper.
 * @param [res] Starting point for reducer, i.e. the first argument that gets passed to it in the first iteration.
 *        If reducer is omitted, res indicates whether the return value is needed (e.g. map) or not (e.g. forEach).
 * @return The result of mapping the given collection to a new collection according to the given mapper and reducing
 *         that collection according to the given reducer.
 */
function mapReduce(coll, mapper, reducer, res) {
	var m = unwrap(mapper),
		r = unwrap(reducer),
		hasReducer = reducer !== undefined,
		isArr = Array.isArray(coll),
		arr = isArr ? coll : Object.keys(coll),
		len = arr.length,
		i = 0,
		resI = 0,
		resIsFirst = r && arguments.length < 4;
	if (!hasReducer)
		res = res ? isArr ? [] : {} : undefined;
	setupState(m);
	setupState(r);
	while (i < len) {
		var key = isArr ? i : arr[i],
			resKey = isArr ? resI : key,
			resVal = applyMap(m, coll[key], resKey, coll),
			filtered = isFiltered(resVal);
		if (!filtered && hasReducer && !resIsFirst) {
			resVal = applyReduce(r, res, resVal, resKey, coll);
			filtered = isFiltered(resVal);
		}
		if (filtered)
			i = resVal.nextIndex(i, len);
		else {
			i++;
			if (isArr)
				resI++;
			if (resIsFirst)
				resIsFirst = false;
			if (hasReducer)
				res = resVal;
			else if (res)
				res[resKey] = resVal;
		}
	}
	teardownState(m);
	teardownState(r);
	return res;
}

/**
 * Calls f for each item in collection coll.
 * @param {Array|Object} coll A collection.
 */
function forEach(coll, f) {
	mapReduce(coll, f, undefined, false);
}

/**
 * Calls mapper for each item in coll, and returns a new collection of the same type as coll
 * that contains all the values returnd by mapper.
 * @param {Array|Object} coll The collection.
 * @param {Mapper} [mapper] The mapper. Defaults to identity.
 * @return {Array|Object} A new collection of the same type as the input collection. It will containin
 *         all the non-filtered values returned by the mapper at the corresponding keys.
 */
function map(coll, mapper) {
	return mapReduce(coll, mapper, undefined, true);
}

/**
 * Reduces the given collection coll to a value using the given reducer, starting either with
 * res or with the first item if res is ommitted.
 * @param {Array|Object} coll The collection.
 * @param {Reducer} reducer The reducer.
 * @return {?} The final result of reducing the given collection with reducer.
 */
function reduce(coll, reducer, res) {
	return arguments.length < 3
		? mapReduce(coll, undefined, reducer)
		: mapReduce(coll, undefined, reducer, res);
}

/**
 * Returns the sum of all values produced by applying the given mapper to the given collection.
 * @param {Array|Object} coll The collection.
 * @param {Mapper} [mapper] The mapper. Defaults to identity.
 * @return {number} The sum of all non-filtered results of applying the mapper to each collection item.
 */
function sum(coll, mapper) {
	return mapReduce(coll, mapper, add);
}

/**
 * Returns the size of the collection that would result from mapping the given mapper
 * to the given collection.
 * @param {Array|Object} coll The collection.
 * @param {Mapper} [mapper] The mapper. Defaults to identity.
 * @return {number} The number of all non-filtered collection items.
 */
function count(coll, mapper) {
	return mapper !== undefined ? mapReduce(coll, mapper, increment, 0)
		: Array.isArray(coll) ? coll.length : Object.keys(coll).length;
}

/** Indicates whether f is a function. */
function isFn(f) {
	return typeof f === "function";
}

/** Returns f if it is a function, null otherwise. */
function toFn(f) {
	return isFn(f) ? f : undefined;
}

/** Adds a and b. */
function add(a, b) {
	return a + b;
}

/** Increments a by one. */
function increment(a) {
	return a + 1;
}

/** Executes the setup method of the given function if existing. */
function setupState(f) {
	if (f && isFn(f.setup))
		f.setup();
}

/** Executes the teardown method of the given function if existing. */
function teardownState(f) {
	if (f && isFn(f.teardown))
		f.teardown();
}

/** Executes the given function. */
function invoke(f) {
	return f();
}

/** Does nothing. */
function noop() {}

/** Returns arg. */
function identity(arg) {
	return arg;
}

/**
 * Applies map to given value, key, and collection, thus returns map(v, k, o).
 * If map is undefined, it defaults to the identity and v is returned.
 * Otherwise, if map is not a function, it is considered a constant function and map itself is returned.
 */
function applyMap(mapper, v, k, o) {
	return mapper === undefined ? v
		: isFn(mapper) ? mapper(v, k, o)
		: mapper;
}

/**
 * Applies reduce to given intermediate result, value, key, and collection, thus returns reduce(res, v, k, o).
 * If reduce is undefined, it defaults to the identity and res is returned.
 * Otherwise, if reduce is not a function, it is considered a constant function and reduce itself is returned.
 */
function applyReduce(reduce, res, v, k, o) {
	return reduce === undefined ? v
		: isFn(reduce) ? reduce(res, v, k, o)
		: reduce;
}

/**
 * Creates a mapper by creating a logical pipe through all the given mappers in their corresponding order.
 * A call of it.pipe(f1, f2, f3)(v, k, o) is equivalent to f3(f2(f1(v, k, o), k, o), k, o). However, a
 * filtering mapper aborts the pipe for the current input if the filter criterion is not met. If any stateful
 * functions with a .reset methods are given, the resulting functions is stateful itself and provides a
 * .reset method which calls the original .reset methods, i.e. it resets the state of all stateful methods
 * within the pipe.
 * @param {(...Mapper)|Array<Mapper>} mappers The mappers to be connected in a pipe.
 * @return {Mapper} A new mapper that passes the given input to all mappers in their corresponding order.
 */
function pipe(args) {
	var mappers = arguments.length === 1 && Array.isArray(args) ? args : arguments,
		len = mappers.length,
		piped;
	if (len > 0) {
		if (len === 1)
			piped = unwrap(mappers[0]);
		else {
			piped = function (v, k, o) {
				var res = v;
				for (var i = 0; !isFiltered(res) && i < len; i++)
					res = applyMap(unwrap(mappers[i]), res, k, o);
				return res;
			};
			var statefulOps = null,
				multiple = false;
			for (var i = 0; i < len; i++) {
				var op = mappers[i];
				if (isFn(op) && (isFn(op.setup) || isFn(op.teardown))) {
					if (!statefulOps)
						statefulOps = op;
					else if (multiple)
						statefulOps.push(op);
					else {
						multiple = true;
						statefulOps = [statefulOps, op];	
					}
				}
			}
			if (statefulOps) {
				piped = !multiple ? copyHooks(piped, statefulOps)
					: stateful(piped, function () {
						statefulOps.forEach(setupState);
					}, function () {
						statefulOps.forEach(teardownState);
					});
			}
		}
	}
	return piped;
}

/** Copies methods .setup and .teardown from src to dst. */
function copyHooks(dst, src) {
	return src ? stateful(dst, src.setup, src.teardown, true) : dst;
}

/**
 * Creates a new hook composed by two hooks. If one of those two is not a function,
 * the other one is directly returned.
 */
function composeHooks(oldHook, newHook) {
	return (!oldHook && newHook)
		|| (!newHook && oldHook)
		|| (oldHook && newHook && function () {
			oldHook();
			newHook();
		});
}

 /**
  * Marks the given function as stateful and attaches the given callback functions to it.
  * @param {Function} fn A stateful function (mapper or reducer).
  * @param {Function} setup Function that should be called before processing a collection.
  * @param {Function} [teardown] Function that should be called after processing a collection.
  * @param {boolean} [nowrap] True if the given function should not be wrapped for attaching the callbacks.
  * @return {Function} The given function, possibly wrapped, and with the given callbacks attached.
  */
function stateful(fn, setup, teardown, nowrap) {
	var f = unwrap(fn),
		oldSetup    = toFn(f.setup),
		oldTeardown = toFn(f.teardown),
		newSetup    = toFn(setup),
		newTeardown = toFn(teardown),
		res = nowrap || !(newSetup || newTeardown) ? f
			: function (optRes, v, k, o) {
				return o ? f(optRes, v, k, o) : f(optRes, v, k);
			};
	if (newSetup)
		res.setup = composeHooks(oldSetup, newSetup);
	if (newTeardown)
		res.teardown = composeHooks(oldTeardown, newTeardown);
	return res;
}

/**
 * Returns a stateful function with setup, teardown methods such that the given reset callback is called
 * before processing a collection, but only if something was processed previously. Useful for lazily restoring
 * the initial state.
 * @param {Function} f A stateful function (mapper or reducer).
 * @param {Function} reset Function that should be called before processing a new collection.
 * @param {boolean} [nowrap] True if the given function should not be wrapped for attaching the callbacks.
 * @return {Function} The given function, possibly wrapped, and with the given callbacks attached.
 */
function resettable(f, reset, nowrap) {
	if (isFn(reset)) {
		var toBeReset = false;
		f = stateful(f, function () {
			if (toBeReset)
				reset();
		}, function () {
			toBeReset = true;
		}, nowrap);
	}
	return f;
};

/** Indicates whether val is a placeholder for a filtered out value. */
function isFiltered(val) {
	return val instanceof Filtered;
}

/** Returns a mapper function corresponding to the given filter function f. */
function createFilterImpl(filter, onFiltered) {
	var f = unwrap(filter),
		asVal = !isFn(f);
	return copyHooks(function (v, k, o) {
		return filterImpl(f, v, k, o, asVal) ? v : onFiltered;
	}, f);
}

/** Returns whether the tuple (v, k, o) passes filter f, where f is possibly given as the desired value for v. */
function filterImpl(f, v, k, o, asVal) {
	return asVal ? v === f : applyMap(f, v, k, o);
}

/**
 * Returns a mapper function corresponding to the given filter function. If, for a given input, filter returns false, 
 * the resulting mapper returns a special value indicating that the filter condition is not met. Otherwise, it
 * returns the input value.
 * @param {Filter} filter The filter function.
 * @return {Mapper} A mapper corresponding to the filter function, which returns the input value if the filter
 *         condition is met, and a special value otherwise.
 */
function filter(filter) {
	return createFilterImpl(filter, FILTERED);
}

/**
 * Returns a mapper function that filters items until one item passes the given filter function, and lets pass all
 * following items.
 * @param {Filter|*} filter A filter. If not specified as a function, it is considered to be the value of the (first) item
 *        that passes the filter.
 * @return {Mapper} A mapper that filters items until one item passes the given filter function.
 */
function takeFrom(filter) {
	var f = unwrap(filter),
		asVal = !isFn(f),
		take;
	function takeFromMapper(v, k, o) {
		if (!take && filterImpl(f, v, k, o, asVal))
			take = true;
		return take ? v : FILTERED;
	}
	// Also keep hooks of f
	return stateful(copyHooks(takeFromMapper, f), function () {
		take = false;
	});
}

/**
 * Returns a mapper function corresponding to the given filter function f. If, for a given input, f returns false,
 * the resulting mapper returns a special value indicating that the filter condition is not met and any remaining
 * collection items, including this one, do not pass the filter. Otherwise, it returns the input value.
 * @param {Filter} filter The filter function.
 * @return {Mapper} A mapper corresponding to the filter function, which returns the input value if the filter
 *         condition is met, and a special value otherwise.
 */
function takeWhile(filter) {
	return createFilterImpl(filter, FILTERED_REST);
}

/**
 * Returns a mapper function that filters out any remaining items once it encounters an item that passes the given
 * filter. Basically equivalent to it.takeFrom((v, k, o) => !f(v, k, o)).
 * @param {Filter|*} filter A filter. If not specified as a function, it is considered to be the value of the (first) item
 *        that does not pass the filter.
 * @return {Mapper} A mapper that filters out any remaining items once it encounters an item that passes the given
 *         filter.
 */
function takeUntil(filter) {
	var f = unwrap(filter),
		asVal = !isFn(f);
	return copyHooks(function (v, k, o) {
		return filterImpl(f, v, k, o, asVal) ? FILTERED_REST : v;
	}, f);
}

/**
 * Returns a mapper function that filters out the first count items and lets pass all remaining ones.
 * @param {number} count The number of items to skip.
 * @return {Mapper} A mapper that filters out the first count items and lets pass all remaining ones.
 */
function skip(count) {
	var skipNext;
	return stateful(function (v, k, o) {
		var changeOffset = skipNext;
		skipNext = false;
		return changeOffset ? filteredUntil(count) : v;
	}, function () {
		skipNext = !!count;
	}, null, true);
}

/**
 * Returns a mapper that filters out any remaining items once it received size items.
 * @param {number} size The maximum number of items to keep.
 * @return {Mapper} A mapper that filters out any remaining items once it received size items.
 */
function limit(size) {
	var cur;
	return stateful(function (v) {
		return ++cur > size ? FILTERED_REST : v
	}, function () {
		cur = 0;
	}, null, true);
}

/**
 * Returns a mapper function that filters out any that it already received previously.
 * @param {Mapper} [mapper] A mapper to compute the identity of input values.
 * @return {Mapper} A mapper that filters out duplicated input values.
 */
function uniq(mapper) {
	var f = unwrap(mapper),
		type = typeof f,
		constant = type !== "function" && type !== "undefined",
		known = constant ? false : {};
	function deduplicatingMapper(v, k, o) {
		var val = applyMap(f, v, k, o);
		if (constant ? known : known[val])
			v = constant ? FILTERED_REST : FILTERED;
		else if (constant)
			known = true;
		else
			known[val] = true;
		return v;
	}
	// Also keep hooks of f
	return stateful(copyHooks(deduplicatingMapper, f), function () {
		known = constant ? false : {};
	}, function () {
		known = null;
	}, true);
}

// -------------------------------------------------------------------
// Wrappers
// -------------------------------------------------------------------

/**
 * Creates a new Wrapper for incrementally building a pipe callback, starting with the given mapper.
 * All Mapper-returning functions of it can be used as chainable methods on a Wrapper and append the
 * resulting mapper to the internal pipe. A .get method returns the corresponding Mapper.
 * Functions of it that accept a collection are also provided as methods of Wrappers with the same
 * argument lists. If a mapper is given to such a method, a new pipe out of the wrapped pipe and the
 * given mapper is used without modifying the current mapper.
 * By default, if such a method is called, stateful mappers are automatically reset afterwards. This
 * behavior can be changed by calling .autoReset with false. For manually resetting state at a
 * specific point in time use the .reset method.
 * @return {Wrapper} A new Wrapper, initially wrapping mapper.
 */
function it(mapper) {
	return new Wrapper(mapper);
}

/** Returns the wrapped function if f is a Wrapper, f itself otherwise. */
function unwrap(f) {
	return f instanceof Wrapper ? f.get() : f;
}

/** Wraps a piped callback function. */
function Wrapper(f) {
	this._pipe = null;
	this._wrapped = unwrap(f);
}

/**
 * Creates a Wrapper pipe method for the given function f.
 * The resulting method calls f with the wrapped function prepended to the arguments list.
 */
function pipeMethod(f) {
	return function (mapper) {
		checkNewPipe(this);
		this._pipe.push(f(mapper));
		return this;
	}
}

/**
 * Creates a Wrapper terminal method for the given function f.
 * The resulting method accepts a collection and calls f with that collection and the wrapped function.
 */
function terminalMethod(f, ignoreMapper) {
	return function (coll, mapper, reducer, res) {
		var m = this.get(),
			len = arguments.length;
		if (ignoreMapper) {
			res = reducer;
			reducer = mapper;
			len--;
		}
		else if (mapper !== undefined)
			m = pipe(m, mapper);
		var res = len >= f.length ? f(coll, m, reducer, res) : f(coll, m, reducer);
		return res;
	}
}

/**
 * If the given wrapper has no pipe, the currently wrapped function is moved to a new pipe.
 * Gets called when the pipe is extended.
 */
function checkNewPipe(wrapper) {
	if (!wrapper._pipe) {
		wrapper._pipe = [wrapper._wrapped]
		wrapper._wrapped = null;
	}
}

/** Extends the current pipe by the given functions in their corresponding order. */
Wrapper.prototype.pipe = function (args) {
	checkNewPipe(this);
	var mappers = arguments.length === 1 && Array.isArray(args) ? args : arguments;
	this._pipe.push.apply(this._pipe, mappers);
	return this;
};

/** Marks the wrapper as stateful and binds the given setup and teardown method to it for managing state. */
Wrapper.prototype.stateful = function (setup, teardown, nowrap) {
	if (nowrap === undefined)
		nowrap = !this._wrapped;
	stateful(this.get(), setup, teardown, nowrap);
	return this;
};

/** Marks the wrapper as stateful and binds setup and teardown methods to it for lazily restoring the original state. */
Wrapper.prototype.resettable = function (reset, nowrap) {
	if (nowrap === undefined)
		nowrap = !this._wrapped;
	resettable(this.get(), reset, nowrap);
	return this;
};

Wrapper.prototype.filter       = pipeMethod(filter);
Wrapper.prototype.takeFrom     = pipeMethod(takeFrom);
Wrapper.prototype.takeWhile    = pipeMethod(takeWhile);
Wrapper.prototype.takeUntil    = pipeMethod(takeUntil);
Wrapper.prototype.skip         = pipeMethod(skip);
Wrapper.prototype.limit        = pipeMethod(limit);
Wrapper.prototype.uniq         = pipeMethod(uniq);

Wrapper.prototype.forEach   = terminalMethod(forEach);
Wrapper.prototype.map       = terminalMethod(map);
Wrapper.prototype.reduce    = terminalMethod(mapReduce, true);
Wrapper.prototype.mapReduce = terminalMethod(mapReduce);
Wrapper.prototype.sum       = terminalMethod(sum);
Wrapper.prototype.count     = terminalMethod(count);

/** Lazily creates and returns the wrapped mapper. */
Wrapper.prototype.get = function () {
	if (!this._wrapped)
		this._wrapped = pipe(this._pipe);
	this._pipe = null;
	return this._wrapped;
};

it.forEach      = forEach;
it.map          = map;
it.mapReduce    = mapReduce;
it.reduce       = reduce;
it.sum          = sum;
it.count        = count;
it.pipe         = pipe;
it.stateful     = stateful;
it.resettable   = resettable;
it.filter       = filter;
it.takeFrom     = takeFrom;
it.takeWhile    = takeWhile;
it.takeUntil    = takeUntil;
it.skip         = skip;
it.limit        = limit;
it.uniq         = uniq;
it.noop         = noop;
it.identity     = identity;

return it;

})();
