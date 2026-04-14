# fnqueryable

**Write lambdas. Get expression trees. Build query providers.**

[![npm version](https://img.shields.io/npm/v/fnqueryable.svg)](https://www.npmjs.com/package/fnqueryable)
[![license](https://img.shields.io/npm/l/fnqueryable.svg)](https://github.com/fnrhombus/fnqueryable/blob/main/LICENSE)

```typescript
import { Queryable } from "fnqueryable";

const users = Queryable.from([
  { name: "Alice", age: 30, active: true },
  { name: "Bob", age: 25, active: false },
  { name: "Charlie", age: 35, active: true },
]);

const result = users
  .where(u => u.age > 25 && u.active)
  .orderBy(u => u.name)
  .select(u => ({ name: u.name, age: u.age }))
  .toArray();
// => [{ name: "Alice", age: 30 }, { name: "Charlie", age: 35 }]
```

Every lambda you pass is **parsed at runtime** into an inspectable expression tree:

```typescript
const ops = users.where(u => u.age > 25).toExpressionTree();
console.log(JSON.stringify(ops[0].expression, null, 2));
// {
//   "kind": "lambda",
//   "parameters": ["u"],
//   "body": {
//     "kind": "binary",
//     "operator": ">",
//     "left": {
//       "kind": "member",
//       "object": { "kind": "parameter", "name": "u" },
//       "property": "age"
//     },
//     "right": { "kind": "literal", "value": 25 }
//   }
// }
```

## The problem

C#'s `IQueryable` is a superpower: write lambdas, and the runtime translates them to SQL, OData, or whatever your provider needs. TypeScript has nothing like it. Every ORM uses string-based or object-based query builders.

`fnqueryable` changes that. Write real lambdas. Get real expression trees. Build real query providers.

## How it works

1. You write a lambda: `u => u.age > 25`
2. `Function.toString()` extracts the source code
3. [Acorn](https://github.com/acornjs/acorn) parses it into an AST
4. The AST is converted to a clean expression tree IR
5. A query provider translates the IR to the target language

No compiler plugins. No build step. No magic strings.

## API

### `Queryable.from(data)`

Create a queryable from an array.

### `.where(predicate)`

Filter items. The predicate is parsed into an expression tree.

### `.orderBy(selector)` / `.orderByDescending(selector)`

Sort items by a key selector.

### `.select(selector)`

Project items to a new shape.

### `.take(count)` / `.skip(count)`

Pagination.

### `.first(predicate?)` / `.firstOrDefault(predicate?)`

Get the first item, optionally matching a predicate. `first` throws on empty sequences; `firstOrDefault` returns `undefined`.

### `.count(predicate?)` / `.any(predicate?)`

Aggregation methods.

### `.toArray()`

Execute the query and return results.

### `.toExpressionTree()`

Get the parsed operations without executing. This is the hook for building custom providers.

## Roadmap

- **v0.1** (current): Core parser + in-memory provider
- SQL provider (`fnqueryable-sql`)
- OData provider (`fnqueryable-odata`)
- GraphQL provider (`fnqueryable-graphql`)
- Custom provider API

## Install

```bash
npm install fnqueryable
```

## Support

- [GitHub Sponsors](https://github.com/sponsors/fnrhombus)
- [Buy Me a Coffee](https://buymeacoffee.com/fnrhombus)

## License

MIT
