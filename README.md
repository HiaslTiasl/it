# it

Supports iterating over array items and object properties in a functional way, with a natural way to eliminate the need of storing intermediate results.

## Why

*It* is inspired by other libraries such as [lodash](https://lodash.com/), [Ramda](http://ramdajs.com/), and the [Java 8 Stream API](https://docs.oracle.com/javase/8/docs/api/java/util/stream/package-summary.html). The reason for ceating *it* was to try modelling sequences of operations as functions for avoiding intermediate results. *It* basically provides the following features:
- Perform multiple operations on data.
- Build sequences of operations.
- Reuse operation sequences for multiple data collections.
- **ALWAYS** use shortcut fusion, **NEVER** produce intermediate results.
- Manage stateful operations.
- Small and simple.

The main focus of *it* is on memory efficiency and laziness, but in some cases this also results in [good performance](https://jsperf.com/it-vs-underscore-vs-lodash/5).

## Usage

This is a general guide about how to use *it*. For a detailled API description see [the code](it.js) itself.

### Basics

You can iterate collections and perform some operations using higher order functions such as `map` and `reduce`.

```javascript
const times2 = x => 2 * x;
const add    = (a, b) => a + b;

it.map([1, 2, 3], times2);                  // returns [2, 4, 6]
it.reduce({ x: 1, y: 2 }, add);             // returns 3
it.mapReduce({ x: 1, y: 2 }, times2, add);  // returns 6
it.sum([1, 2, 3], times2);                  // returns 12
it.count([1, 2, 3));                        // returns 3
```

The second parameter of `map` and `mapReduce` expects a 'mapper' function that receives an item, the key (or index), and the collection, and maps it to a new item. The second parameter of `reduce` and the third parameter of `mapReduce` expects a 'reducer' function that receives the previous intermediate result, an item, the key, and the collection, and reduces them to a new intermediate result.

### Filters

Wherever a mapper is expected, we can also use 'filters'. A filter also receives item, key, and collection, and returns whether they pass the filter or not. To tell *it* that a function is a filter, use `it.filter`. If you pass a value instead of a function, it is interpreted as strict equality to that value:

```javascript
const odd = x => x % 2 !== 0;

it.map([1, 2, 3], odd);                 // returns [true, false, true]
it.map([1, 2, 3], it.filter(odd));      // returns [1, 3]
it.map([1, 2, 3, 1]), it.filter(1));    // returns [1, 1]
it.count([1, 2, 3, 1), it.filter(1));   // returns 2
```

Apart from `it.filter`, there are other, more specialized functions for specifying filters:

| Function       | Description
|----------------|------------------------------------------------------------------------------------|
| `takeFrom(f)`  | After one item passes the filter, all following items will pass too.               |
| `takeWhile(f)` | Cancels processing of all data as soon as the first item does not pass the filter. |
| `takeUntil(f)` | Lets items pass as long as they do **NOT** pass the given filter. Then, processing is cancelled. |
| `skip(count)`  | Filters out the given number of items, and lets pass all following items.          |
| `limit(count)` | Lets pass up to the given amount of items, and filters out all following items.    |
| `uniq(mapper)` | Deduplicates incoming items, i.e. filters out any items that are already known. You can specify an optional mapper for computing item identities. |

### Pipes

For specifying sequences of multiple iterations, you can construct pipes. Pipes are sequences of mappers and filters, wrapped as a new mapper function. When called, the pipe executes the given callback arguments in the specified order. You can pass the pipe directly to functions such as `map`. If an item does not pass a filter in a pipe, the pipe is cancelled for that item, so any remaining operations in the pipe are not executed.
 
```javascript
const times2IfOdd = it.pipe(it.filter(odd), times2);

it.map([1, 2, 3], times2IfOdd);                  // returns [2, 6]
it.mapReduce({ x: 1, y: 2 }, times2IfOdd, add);  // returns 2
```

### Wrappers

If you don't like the static API, you can create a wrapper using `it()` that provides chainable methods for constructing pipes. Note that these methods do not create a new wrapper instance, but mutate the current wrapper and return it instead. For getting the piped function, use `.get()`.

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

Note that we could use `it.takeWhile` or `it.takeUntil` to achieve the same effect, but in a stateless and more efficient way. However, there are cases where you need stateful functions. For using stateful mappers or reducers with *it*, you should use `it.stateful` to mark them as such, and provide callbacks for managing the state.

```javascript
alive = undefined;
const setup    = () => alive = true;
const teardown = () => alive = undefined;
const statefulOp = it.stateful(noPoisonPillYet, onInit, onResult);

pipe = it.pipe(it.filter(statefulOp), times2); // Equivalent to it.stateful(pipe, setup, teardown),
                                               // with pipe as defined in previous example

it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns [6, 4, 2, 0]
it.map([3, 2, 1, 0, -1, -2, -3], pipe);  // returns [6, 4, 2, 0]
```

In the example above, we construct a pipe that contains a stateful operation, which results in a stateful pipe. Whenever we use stateful operations for processing data in *it*, *it* automatically first executes the provided `setup` callback before processing the data, and executes the `teardown` callback when completed. You can use `it.stateful` with filters (as above), filtering mappers, mappers, pipes, and reducers. For Wrappers, use their `.stateful` method. As in the example above, you should attach the corresponding callbacks to the operation of the lowest level possible, since this allows reusing that operation later for constructing additional pipes without worrying about statefulness anymore.

If restoring state is expensive, you can use `it.resettable` and specify a `onInit` function that is called only if some processing was already done before.

```javascript
let op = it.stateful(function (value, key, obj) {
  // ... modify state
}, function () {
  console.log("restoring...");
  // ... do lot of work
});
it.map([1, 2, 3], op);  // does not log anything.
it.map([1, 2, 3], op);  // logs "restoring..."
```

## Interoperability

Since mappers and pipes are just callback functions with the common signature `(value, key, object)`, technically you can also pass them to build-in Array functions such as `Array.prototype.map` or equivalent functions of third party libraries such as [lodash](https://lodash.com/). However, those do not know of the meaning of the special return values of filtering operations, so they might return wrong results. In case of `map` operations, you can fix this by passing the result to `it.map`:

```javascript
let arr = [1,2,3].map(it.pipe(it.filter(odd), times2));  // returns [2, <Object>, 6]
arr = it.map(arr);                                       // returns [2, 6]
```

Similar issues will result from using stateful operations such as `takeFrom`, `skip`, and `uniq`, as well as custom operations using `stateful`. In any case, it is best to avoid this kind of issues and use pipes only with *it* functions if possible.
