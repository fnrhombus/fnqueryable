import type { Operation } from "../expression.js";

export function executeInMemory<T>(
  source: T[],
  operations: Operation[],
  originalFns: Map<Operation, Function>,
): unknown[] {
  let result: unknown[] = [...source];

  for (const op of operations) {
    const fn = originalFns.get(op);

    switch (op.type) {
      case "where": {
        if (!fn) throw new Error("where operation missing function reference");
        result = result.filter(fn as (item: unknown) => boolean);
        break;
      }
      case "orderBy": {
        if (!fn) throw new Error("orderBy operation missing function reference");
        const selector = fn as (item: unknown) => unknown;
        result = [...result].sort((a, b) => {
          const va = selector(a);
          const vb = selector(b);
          if (va < vb) return -1;
          if (va > vb) return 1;
          return 0;
        });
        break;
      }
      case "orderByDescending": {
        if (!fn)
          throw new Error(
            "orderByDescending operation missing function reference",
          );
        const selector = fn as (item: unknown) => unknown;
        result = [...result].sort((a, b) => {
          const va = selector(a);
          const vb = selector(b);
          if (va < vb) return 1;
          if (va > vb) return -1;
          return 0;
        });
        break;
      }
      case "select": {
        if (!fn) throw new Error("select operation missing function reference");
        result = result.map(fn as (item: unknown) => unknown);
        break;
      }
      case "take": {
        if (op.value == null)
          throw new Error("take operation missing count value");
        result = result.slice(0, op.value);
        break;
      }
      case "skip": {
        if (op.value == null)
          throw new Error("skip operation missing count value");
        result = result.slice(op.value);
        break;
      }
    }
  }

  return result;
}
