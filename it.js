var it = (function () {
"use strict";

var FILTERED      = {};
var FILTERED_REST = {};

function mapReduce(coll, mapper, reducer, res) {
	var m = unwrap(mapper),
		r = unwrap(reducer),
		isArr = Array.isArray(coll),
		arr = isArr ? coll : Object.keys(coll),
		len = arr.length,
		i = 0,
		resI = 0,
		skip = r && arguments.length < 4,
		resVal;
	if (m && !r)
		res = res ? isArr ? [] : {} : undefined;
	for (; !isFilteredRest(resVal) && i < len; i++) {
		var key = isArr ? i : arr[i];
		var resKey = isArr ? resI : key;
		resVal = coll[key];
		if (m)
			resVal = m(resVal, resKey, coll);
		if (!isFiltered(resVal)) {
			if (r) {
				if (!skip)
					resVal = r(res, resVal, resKey, coll);
				else if (r.innerMapper)
					resVal = r.innerMapper(resVal, key, coll);
			}
			if (!isFiltered(resVal)) {
				if (isArr)
					resI++;
				if (skip)
					skip = false;
				if (r)
					res = resVal;
				else if (res)
					res[resKey] = resVal;
			}
		}
	}
	return res;
}

function forEach(coll, f) {
	mapReduce(coll, f, null, false);
}

function map(coll, f) {
	return mapReduce(coll, f, null, true);
}

function reduce(coll, f, res) {
	return arguments.length < 3
		? mapReduce(coll, null, f)
		: mapReduce(coll, null, f, res);
}

function sum(coll, f) {
	return mapReduce(coll, f, add);
}

function uniq(coll, f) {
	var known = {};
	function filterKnown(v, k, o) {
		if (f)
			v = f(v, k, o);
		if (known[v])
			v = FILTERED;
		else
			known[v] = true;
		return v;
	}
	return mapReduce(coll, filterKnown, null, true);
}

function reducer(map, f, dontKeepMapper) {
	function r(acc, v, k, o) {
		var res = acc;
		if (!isFiltered(res)) {
			var next = map(v, k, o);
			if (!isFiltered(next))
				res = f(acc, next, k, o);
		}
		return res;
	}
	if (!dontKeepMapper)
		r.innerMapper = map;
	return r;
}

function add(a, b) {
	return a + b;
}

function mapper() {
	var args = arguments,
		len = arguments.length;
	return function (v, k, o) {
		var res = v;
		for (var i = 0; !isFiltered(res) && i < len; i++) {
			var f = args[i];
			if (typeof f === "function")
				res = f(res, k, o);
		}
		return res;
	};
}

function isFiltered(val) {
	return isFilteredVal(val) || isFilteredRest(val);
}

function isFilteredVal(val) {
	return val === FILTERED;
}

function isFilteredRest(val) {
	return val === FILTERED_REST;
}

function filterImpl(map, f, filtersRest) {
	var filteredVal = filtersRest ? FILTERED_REST : FILTERED;
	return function (v, k, o) {
		var res = map(v, k, o);
		return ((filtersRest && !isFilteredRest(res))
			|| !isFiltered(res))
			&& !f(res, k, o) ? filteredVal : res;
	};
}

function filter(map, f) {
	return filterImpl(map, f, false);
}

function takeWhile(map, f) {
	return filterImpl(map, f, true);
}

function takeUntilKey(map, key) {
	return function (v, k, o) {
		return k === key ? FILTERED_REST : map(v, k, o);
	};
}

function takeUntilVal(map, val) {
	return function (v, k, o) {
		var res = map(v, k, o);
		return res === val ? FILTERED_REST : res;
	};
}

function it(f) {
	return new Wrapper(f);
}

function Wrapper(f) {
	this.fun = f;
}

function wrapperMethod(f) {
	return function (a1, a2) {
		var map = this.fun
		this.fun = f(map, a1, a2);
		return this;
	}
}

function unwrap(f) {
	return f instanceof Wrapper ? f.fun
		: f;
}

Wrapper.prototype.map          = wrapperMethod(mapper);
Wrapper.prototype.filter       = wrapperMethod(filter);
Wrapper.prototype.reduce       = wrapperMethod(reducer);
Wrapper.prototype.takeWhile    = wrapperMethod(takeWhile);
Wrapper.prototype.takeUntilKey = wrapperMethod(takeUntilKey);
Wrapper.prototype.takeUntilVal = wrapperMethod(takeUntilVal);
Wrapper.prototype.valueOf = function () {
	return this.fun;
}


it.forEach      = forEach;
it.map          = map;
it.mapReduce    = mapReduce;
it.reduce       = reduce;
it.reducer      = reducer;
it.mapper       = mapper;
it.filter       = filter;
it.takeWhile    = takeWhile;
it.takeUntilKey = takeUntilKey;
it.takeUntilVal = takeUntilVal;

return it;

})();