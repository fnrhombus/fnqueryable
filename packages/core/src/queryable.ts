import type { LambdaExpression, Operation } from "./expression.js";
import { parseFunction } from "./parser.js";
import { executeInMemory } from "./providers/memory.js";

export class Queryable<T> {
  readonly #source: T[];
  readonly #operations: Operation[];
  readonly #originalFns: Map<Operation, Function>;

  private constructor(
    source: T[],
    operations: Operation[] = [],
    originalFns: Map<Operation, Function> = new Map(),
  ) {
    this.#source = source;
    this.#operations = operations;
    this.#originalFns = originalFns;
  }

  static from<T>(data: T[]): Queryable<T> {
    return new Queryable([...data]);
  }

  #append(op: Operation, fn?: Function): Queryable<any> {
    const ops = [...this.#operations, op];
    const fns = new Map(this.#originalFns);
    if (fn) fns.set(op, fn);
    return new Queryable(this.#source, ops, fns);
  }

  where(predicate: (item: T) => boolean): Queryable<T> {
    const expression = parseFunction(predicate);
    const op: Operation = { type: "where", expression };
    return this.#append(op, predicate);
  }

  orderBy<K>(selector: (item: T) => K): Queryable<T> {
    const expression = parseFunction(selector);
    const op: Operation = { type: "orderBy", expression };
    return this.#append(op, selector);
  }

  orderByDescending<K>(selector: (item: T) => K): Queryable<T> {
    const expression = parseFunction(selector);
    const op: Operation = { type: "orderByDescending", expression };
    return this.#append(op, selector);
  }

  select<R>(selector: (item: T) => R): Queryable<R> {
    const expression = parseFunction(selector);
    const op: Operation = { type: "select", expression };
    return this.#append(op, selector) as Queryable<R>;
  }

  take(count: number): Queryable<T> {
    const op: Operation = { type: "take", value: count };
    return this.#append(op);
  }

  skip(count: number): Queryable<T> {
    const op: Operation = { type: "skip", value: count };
    return this.#append(op);
  }

  first(predicate?: (item: T) => boolean): T {
    const items = predicate ? this.where(predicate).toArray() : this.toArray();
    if (items.length === 0) {
      throw new Error("Sequence contains no elements");
    }
    return items[0];
  }

  firstOrDefault(predicate?: (item: T) => boolean): T | undefined {
    const items = predicate ? this.where(predicate).toArray() : this.toArray();
    return items[0];
  }

  count(predicate?: (item: T) => boolean): number {
    const items = predicate ? this.where(predicate).toArray() : this.toArray();
    return items.length;
  }

  any(predicate?: (item: T) => boolean): boolean {
    const items = predicate ? this.where(predicate).toArray() : this.toArray();
    return items.length > 0;
  }

  toArray(): T[] {
    return executeInMemory(
      this.#source,
      this.#operations,
      this.#originalFns,
    ) as T[];
  }

  toExpressionTree(): Operation[] {
    return [...this.#operations];
  }
}
