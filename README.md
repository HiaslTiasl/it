# it

Supports iterating over array items and object properties in a functional way, with a natural way to eliminate the need of storing intermediate results.

## Why

*It* is inspired by other libraries such as [lodash](https://lodash.com/), [Ramda](http://ramdajs.com/), and the [Java 8 Stream API](https://docs.oracle.com/javase/8/docs/api/java/util/stream/package-summary.html). *It* provides the following features:
- Perform multiple operations on data.
- Build sequences of operations.
- Reuse operation sequences for multiple data collections.
- Manage stateful operations.
- Keep full control over shortcut fusion and intermediate results.
- Small and simple.

## Usage

This is a general guide about how to use *it*. For a detailled API description see [the code](it.js) itself.

You can iterate collections and perform some operations using higher order functions such as `map` and `reduce`.

```javascript
const times2 = x => 2 * x;
const add    = (a, b) => a + b;

it.map([1, 2, 3], times2);                  // returns [2, 4, 6]
it.reduce({ x: 1, y: 2 }, add);             // returns 3
it.mapReduce({ x: 1, y: 2 }, times2, add);  // returns 6
```

For specifying sequences of multiple iterations, you can construct pipes. Piped operations can filter and transform elements, and they can be reused. We refer to filtering operations as 'filters' and to transforming operations as 'mappers'. The `pipe` function accepts multiple mappers. If you want to place a filter in a pipe, wrap it in a call to `it.filter` (which transforms it to a mapper, see [Internals](#internals)).

The returned pipe is just a new callback function that, when called, executes the given callback arguments in the specified sequence. You can pass the pipe directly to functions such as `map`. If an item does not pass a filter in a pipe, the pipe is cancelled for that item, so any remaining operations in the pipe are not executed for this item.
 
```javascript
const odd         = x => x % 2 !== 0;
const times2IfOdd = it.pipe(it.filter(odd), times2);

it.map([1, 2, 3], times2IfOdd);                  // returns [2, 6]
it.mapReduce({ x: 1, y: 2 }, times2IfOdd, add);  // returns 2
```

Those who don't like the static API can create a wrapper using `it()` that provides chainable methods for constructing pipes. Note that these methods do not create a new Wrapper instance, but mutate the current wrapper and return it instead. For getting the piped function, use `.get()`.

```javascript
it.map([1, 2, 3], it().filter(odd).pipe(times2).get());  // returns [2, 6]

const notMultipleOf4 = x => x % 4 !== 0;
let wrapper = it(times2);
wrapper.filter(notMultipleOf4);    // Mutates wrapper
it.map([1, 2, 3], wrapper.get());  // returns [2, 6]
```

The wrapper also provides methods for the iterating functions like `map`, `reduce`, and `mapReduce`:

```javascript
it().filter(odd).pipe(times2).map([1, 2, 3]);            // returns [2, 6]
it(times2).pipe(times2, times2).reduce([1, 2, 3], add);  // returns 48
```

If another mapper is passed to such an iterating method, a new pipe out of the wrapped pipe and the given mapper is created. The wrapped pipe is not modified in this case.

```javascript
wrapper = it().filter(odd).pipe(times2);
wrapper.map([1, 2, 3], times2);  // returns [4, 12]
wrapper.map([1, 2, 3]);          // returns [2, 6]
```

### Stateful Operations

Once you've constructed a pipe of operations, you can reuse it for multiple data collections. But be careful with stateful operations! Consider the following example:

```javascript
const POISON_PILL = -1;
let alive = true;
function noPoisonPillYet(value) {
  if (alive && value === POISON_PILL)
    alive = false;
  return alive;
}

let pipe = it.pipe(it.filter(noPoisonPillYet), times2);
it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns [6, 4, 2, 0]
it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns []
```

In the first call to `it.map`, we process items until we get `POISON_PILL`, after which all following items are discarded. However, in the second call the result is empty. This is because the filter function is stateful, and it keeps the state of the previous call.

Note that there is a stateless function `it.takeUntilVal` equivalent to `noPoisonPillYet` in the example above, which even aborts iterating elements once the given value is encountered. However, there are cases where you need stateful functions. For using stateful mappers or reducers with *it*, you should use `it.stateful` to mark them as such, and provide callbacks for managing the state.

```javascript
alive = undefined;
const onInit     = () => alive = true;
const onComplete = () => alive = undefined;
const statefulOp = it.stateful(noPoisonPillYet, onInit, onResult);

pipe = it.pipe(it.filter(statefulOp), times2); // Equivalent to it.stateful(pipe, onInit, onResult),
                                               // with pipe as defined in previous example

it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns [6, 4, 2, 0]
it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns [6, 4, 2, 0]
```

In the example above, we construct a pipe that contains a stateful operation, which results in a stateful pipe. Whenever we use stateful operations for processing data in *it*, *it* automatically first executes the provided `onInit` callback before processing the data, and executes the `onComplete` callback when completed. You can use `it.stateful` with filters (as above), filtering mappers, mappers, pipes, and reducers. For Wrappers, use their `.stateful` method.

## Internals

### Pipes and Filters

Pipes are just functions that pass input through the callbacks given as arguments. In order to avoid storing information about whether a given callback is a mapper or a filter, we only consider mappers. To place filters in a pipe, we can create a corresponding mapper using `it.filter`. The mapper returns a special object instance if an item did not pass the filter, the item itself otherwise.

Since Pipes are just callback functions with the common signature `(value, key, object)`, technically you can also pass them to build-in Array functions such as `Array.prototype.map` or equivalent functions of third party libraries such as [lodash](https://lodash.com/). However, those do not know of the meaning of the special return values of filtering operations, so they might return wrong results. In case of `map` operations, you can fix this by passing the result to `it.map`:

```javascript
let arr = [1,2,3].map(it.pipe(it.filter(odd), times2));  // returns [2, <Object>, 6]
arr = it.map(arr);                                       // returns [2, 6]
```

In any case, it is best to avoid this kind of issues and use pipes only with *it* functions if possible.
