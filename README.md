# it

Supports iterating over array items and object properties in a functional way, with a natural way to eliminate the need of storing intermediate results.

## Why

- Perform multiple operations on data.
- Reuse sequences of operations for multiple data collections.
- Keep full control over shortcut fusion and intermediate results.
- Small and simple.

## Usage

You can iterate collections and perform some operations using higher order functions such as `map` and `reduce`.

```javascript
// Running example callbacks
const times2 = x => 2 * x;
const add    = (a, b) => a + b;

it.map([1,2,3], times2);                    // returns [2, 4, 6]
it.reduce({ x: 1, y: 2 }, add);             // returns 3
it.mapReduce({ x: 1, y: 2 }, times2, add);  // returns 6
```

For specifying sequences of multiple iterations, you can construct pipes. Piped operations can filter and transform elements, and they can be reused. We refer to filtering operations as 'filters' and to transforming operations as 'mappers'. The `pipe` function accepts multiple mappers. If you want to place a filter in a pipe, wrap it in a call to `it.filter` (which transforms it to a mapper, see [Internals](#internals)).

The returned pipe is just a new callback function that, when called, executes the given callback arguments in the specified sequence. You can pass the pipe directly to functions such as map. If an item does not pass a filter in a pipe, the pipe is cancelled for that item, so any remaining operations in the pipe are not executed for this item.
 
```javascript
const odd         = x => x % 2 === 0;
const times2IfOdd = it.pipe(it.filter(odd), times2);

it.map([1,2,3], times2IfOdd);                    // returns [2, 6]
it.mapReduce({ x: 1, y: 2 }, times2IfOdd, add);  // returns 2
```

Those who don't like the static API can create a wrapper using `it()` that provides chainable methods for constructing pipes. Note that these methods do not create a new Wrapper instance, but mutate the current wrapper and return it instead. For getting the piped function, use `.get()`.

```javascript
it.map([1,2,3], it().filter(odd).pipe(times2).get());  // returns [2, 6]

const notMultipleOf4 = x => x % 4 !== 0;
let wrapper = it(times2);
wrapper.filter(notMultipleOf4);  // Mutates wrapper
it.map([1,2,3], wrapper.get());  // returns [2, 6]
```

The wrapper also provides methods for the iterating functions like `map`, `reduce`, and `mapReduce`:

```javascript
it().filter(odd).pipe(times2)).map([1,2,3]);           // returns [2, 6]
it(times2).pipe(times2, times2).reduce([1,2,3], add);  // returns 48
```

If another mapper is passed to such an iterating method, a new pipe out of the wrapped pipe and the given mapper is created. The wrapped pipe is not modified in this case.

```javascript
wrapper = it(times2);
wrapper.map([1,2,3], times2);  // returns [4, 12]
wrapper.map([1,2,3]);          // returns [2, 6]
```

## Internals

### Pipes and Filters

Pipes are just functions that pass input through the callbacks given as arguments. In order to avoid storing information about whether a given callback is a mapper or a filter, we only consider mappers. To place filters in a pipe, we can create a corresponding mapper using `it.filter`. The mapper returns a special object instance if an item did not pass the filter, the item itself otherwise.
