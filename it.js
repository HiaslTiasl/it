/*
 * https://github.com/HiaslTiasl/it
 */
 
var it = (function () {
"use strict";

var FILTERED      = {};		// Special return value for filtered items
var FILTERED_REST = {};		// Special return value for filtered items with cancellation of the whole operation

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
		skip = r && arguments.length < 4,
		resVal;
	if (!hasReducer)
		res = res ? isArr ? [] : {} : undefined;
	onInit(m);
	onInit(r);
	for (; !isFilteredRest(resVal) && i < len; i++) {
		var key = isArr ? i : arr[i];
		var resKey = isArr ? resI : key;
		resVal = applyMap(m, coll[key], resKey, coll);
		if (!isFiltered(resVal)) {
			if (hasReducer && !skip)
				resVal = applyReduce(r, res, resVal, resKey, coll);
			if (!isFiltered(resVal)) {
				if (isArr)
					resI++;
				if (skip)
					skip = false;
				if (hasReducer)
					res = resVal;
				else if (res)
					res[resKey] = resVal;
			}
		}
	}
	onComplete(m, res);
	onComplete(r, res);
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

/** Adds a and b. */
function add(a, b) {
	return a + b;
}

/** Increments a by one. */
function increment(a) {
	return a + 1;
}

/** Executes the onInit method of the given function if existing. */
function onInit(f) {
	if (f && typeof f.onInit === "function")
		f.onInit();
}

/** Executes the onComplete method of the given function if existing. */
function onComplete(f, res) {
	if (f && typeof f.onComplete === "function")
		f.onComplete(res);
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
function applyMap(map, v, k, o) {
	var type = typeof map;
	return type === "function" ? map(v, k, o)
		: type === "undefined" ? v
		: map;
}

/**
 * Applies reduce to given intermediate result, value, key, and collection, thus returns reduce(res, v, k, o).
 * If reduce is undefined, it defaults to the identity and res is returned.
 * Otherwise, if reduce is not a function, it is considered a constant function and reduce itself is returned.
 */
function applyReduce(reduce, res, v, k, o) {
	var type = typeof reduce;
	return type === "function" ? reduce(res, v, k, o)
		: type === "undefined" ? v
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
			piped = mappers[0];
		else {
			piped = function (v, k, o) {
				var res = v;
				for (var i = 0; !isFiltered(res) && i < len; i++)
					res = applyMap(mappers[i], res, k, o);
				return res;
			};
			var statefulOps = null,
				multiple = false;
			for (var i = 0; i < len; i++) {
				var op = mappers[i];
				if (typeof op === "function"
					&& (typeof op.onInit === "function" || typeof op.onComplete === "function")
				) {
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
				piped = !multiple ? copyStatefulCallbacks(piped, statefulOps)
					: stateful(piped, function () {
						resetters.forEach(onInit);
					}, function (res) {
						resetters.forEach(function (f) {
							onComplete(f, res);
						});
					});
			}
		}
	}
	return piped;
}

/** Copies methods .onInit and .onComplete from src to dst. */
function copyStatefulCallbacks(dst, src) {
	return src ? stateful(dst, src.onInit, src.onComplete) : dst;
}

 /**
  * Marks the given function as stateful and attaches the given callback functions to it.
  * @param {Function} f A stateful function (mapper or reducer).
  * @param {Function} onInit Function that should be called before processing a collection.
  * @param {Function} [onComplete] Function that should be called after processing a collection.
  * @param {boolean} [nowrap] True if the given function should not be wrapped for attaching the callbacks.
  * @return {Function} The given function, possibly wrapped, and with the given callbacks attached.
  */
function stateful(f, onInit, onComplete, nowrap) {
	var hasOnInit = typeof onInit === "function",
		hasOnComplete = typeof onComplete === "function",
		res = nowrap || !(hasOnInit || hasOnComplete) ? f
			: function (optRes, v, k, o) {
				return o ? f(optRes, v, k, o) : f(optRes, v, k);
			};
	if (hasOnInit)
		res.onInit = onInit;
	if (hasOnComplete)
		res.onComplete = onComplete;
	return res;
}

/**
 * Returns a stateful function with onInit, onComplete methods such that the given reset callback is called
 * before processing a collection, but only if something was processed previously. Useful for lazily restoring
 * the initial state.
 * @param {Function} f A stateful function (mapper or reducer).
 * @param {Function} reset Function that should be called before processing a new collection.
 * @param {boolean} [nowrap] True if the given function should not be wrapped for attaching the callbacks.
 * @return {Function} The given function, possibly wrapped, and with the given callbacks attached.
 */
function resettable(f, reset, nowrap) {
	if (typeof reset === "function") {
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
	return isFilteredVal(val) || isFilteredRest(val);
}

/** Indicates whether val is a placeholder for a single filtered out value. */
function isFilteredVal(val) {
	return val === FILTERED;
}

/** Indicates whether val is a placeholder for filtering out all the remaining collection items. */
function isFilteredRest(val) {
	return val === FILTERED_REST;
}

/** Returns a mapper function corresponding to the given filter function f. */
function filterImpl(f, filtersRest) {
	var filteredVal = filtersRest ? FILTERED_REST : FILTERED;
	return copyStatefulCallbacks(function filteringMapper(v, k, o) {
		return ((filtersRest && !isFilteredRest(v))
			|| !isFiltered(v))
			&& !applyMap(f, v, k, o) ? filteredVal : v;
	}, f);
}

/**
 * Returns a mapper function corresponding to the given filter function f. If, for a given input, f returns false, 
 * the resulting mapper returns a special value indicating that the filter condition is not met. Otherwise, it
 * returns the input value.
 * @param {Filter} f The filter function.
 * @return {Mapper} A mapper corresponding to the filter function, which returns the input value if the filter
 *         condition is met, and a special value otherwise.
 */
function filter(f) {
	return filterImpl(f, false);
}

/**
 * Returns a mapper function corresponding to the given filter function f. If, for a given input, f returns false,
 * the resulting mapper returns a special value indicating that the filter condition is not met and any remaining
 * collection items, including this one, do not pass the filter. Otherwise, it returns the input value.
 * @param {Filter} f The filter function.
 * @return {Mapper} A mapper corresponding to the filter function, which returns the input value if the filter
 *         condition is met, and a special value otherwise.
 */
function takeWhile(f) {
	return filterImpl(f, true);
}

/**
 * Returns a mapper function that filters out any remaining items once it encounters the given key. Equivalent to
 * it.takeWhile((v, k, o) => k !== key).
 * @return {Mapper} A mapper that filters out any remaining items once it encounters the given key.
 */
function takeUntilKey(key) {
	return function (v, k, o) {
		return k === key ? FILTERED_REST : v;
	};
}

/**
 * Returns a mapper function that filters out any remaining items once it encounters the given value. Equivalent to
 * it.takeWhile((v, k, o) => v !== val).
 * @return {Mapper} A mapper that filters out any remaining items once it encounters the given key.
 */
function takeUntilVal(val) {
	return function (v, k, o) {
		return v === val ? FILTERED_REST : v;
	};
}

/**
 * Returns a mapper function that filters out any that it already received previously. Note that this mapper is stateful!
 * In particular, If the resulting mapper is applied twice to the same collection, the second time it will simply filter
 * out all items, since it still knows them from the previous time. In order to deal with this issue, the resulting function
 * has a method reset that, when called, discards the internal cache to restore the initial state.
 * If a mapper is given, it will be used to compute the identity, but only the original values are returned.
 * @param {Mapper} [mapper] A mapper to compute the identity of input values.
 * @return {Mapper} A mapper that filters out duplicated input values.
 */
function uniq(mapper) {
	var type = typeof mapper,
		constant = type !== "function" && type !== "undefined",
		known = constant ? false : {};
	return stateful(function filterKnown(v, k, o) {
		var val = applyMap(mapper, v, k, o);
		if (constant ? known : known[val])
			v = constant ? FILTERED_REST : FILTERED;
		else if (constant)
			known = true;
		else
			known[val] = true;
		return v;
	}, function () {
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

/** Marks the wrapper as stateful and binds a reset method to it that restores its original state. */
Wrapper.prototype.stateful = function (onInit, onComplete, nowrap) {
	if (nowrap === undefined)
		nowrap = !this._wrapped;
	stateful(this.get(), onInit, onComplete, nowrap);
	return this;
};

Wrapper.prototype.filter       = pipeMethod(filter);
Wrapper.prototype.takeWhile    = pipeMethod(takeWhile);
Wrapper.prototype.takeUntilKey = pipeMethod(takeUntilKey);
Wrapper.prototype.takeUntilVal = pipeMethod(takeUntilVal);
Wrapper.prototype.uniq         = pipeMethod(uniq);

Wrapper.prototype.forEach   = terminalMethod(forEach);
Wrapper.prototype.map       = terminalMethod(map);
Wrapper.prototype.reduce    = terminalMethod(mapReduce, true);
Wrapper.prototype.mapReduce = terminalMethod(mapReduce);
Wrapper.prototype.sum       = terminalMethod(sum);
Wrapper.prototype.count     = terminalMethod(count);

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
it.uniq         = uniq;
it.takeWhile    = takeWhile;
it.takeUntilKey = takeUntilKey;
it.takeUntilVal = takeUntilVal;
it.noop         = noop;
it.identity     = identity;

return it;

})();
