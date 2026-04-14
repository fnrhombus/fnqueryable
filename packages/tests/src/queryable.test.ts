import { describe, it, expect } from "vitest";
import { Queryable } from "fnqueryable";

interface User {
  name: string;
  age: number;
  active: boolean;
}

const users: User[] = [
  { name: "Alice", age: 30, active: true },
  { name: "Bob", age: 25, active: false },
  { name: "Charlie", age: 35, active: true },
  { name: "Diana", age: 28, active: true },
  { name: "Eve", age: 22, active: false },
];

describe("Queryable", () => {
  describe("where", () => {
    it("filters by predicate", () => {
      const result = Queryable.from(users)
        .where((u) => u.age > 25)
        .toArray();
      expect(result).toHaveLength(3);
      expect(result.map((u) => u.name)).toEqual(["Alice", "Charlie", "Diana"]);
    });

    it("filters by boolean property", () => {
      const result = Queryable.from(users)
        .where((u) => u.active)
        .toArray();
      expect(result).toHaveLength(3);
    });

    it("filters with logical AND", () => {
      const result = Queryable.from(users)
        .where((u) => u.age > 25 && u.active)
        .toArray();
      expect(result).toHaveLength(3);
      expect(result.map((u) => u.name)).toEqual([
        "Alice",
        "Charlie",
        "Diana",
      ]);
    });

    it("returns empty array when no matches", () => {
      const result = Queryable.from(users)
        .where((u) => u.age > 100)
        .toArray();
      expect(result).toHaveLength(0);
    });

    it("works with empty source", () => {
      const result = Queryable.from<User>([])
        .where((u) => u.active)
        .toArray();
      expect(result).toHaveLength(0);
    });
  });

  describe("orderBy", () => {
    it("sorts ascending by property", () => {
      const result = Queryable.from(users)
        .orderBy((u) => u.name)
        .toArray();
      expect(result.map((u) => u.name)).toEqual([
        "Alice",
        "Bob",
        "Charlie",
        "Diana",
        "Eve",
      ]);
    });

    it("sorts ascending by numeric property", () => {
      const result = Queryable.from(users)
        .orderBy((u) => u.age)
        .toArray();
      expect(result.map((u) => u.age)).toEqual([22, 25, 28, 30, 35]);
    });
  });

  describe("orderByDescending", () => {
    it("sorts descending by property", () => {
      const result = Queryable.from(users)
        .orderByDescending((u) => u.age)
        .toArray();
      expect(result.map((u) => u.age)).toEqual([35, 30, 28, 25, 22]);
    });
  });

  describe("select", () => {
    it("projects to new shape", () => {
      const result = Queryable.from(users)
        .select((u) => ({ name: u.name, age: u.age }))
        .toArray();
      expect(result).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
        { name: "Charlie", age: 35 },
        { name: "Diana", age: 28 },
        { name: "Eve", age: 22 },
      ]);
    });

    it("projects to single value", () => {
      const result = Queryable.from(users)
        .select((u) => u.name)
        .toArray();
      expect(result).toEqual(["Alice", "Bob", "Charlie", "Diana", "Eve"]);
    });
  });

  describe("take and skip", () => {
    it("takes first N items", () => {
      const result = Queryable.from(users).take(2).toArray();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alice");
      expect(result[1].name).toBe("Bob");
    });

    it("skips first N items", () => {
      const result = Queryable.from(users).skip(3).toArray();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Diana");
    });

    it("skip + take for pagination", () => {
      const result = Queryable.from(users).skip(1).take(2).toArray();
      expect(result).toHaveLength(2);
      expect(result.map((u) => u.name)).toEqual(["Bob", "Charlie"]);
    });
  });

  describe("first", () => {
    it("returns first element", () => {
      const result = Queryable.from(users).first();
      expect(result.name).toBe("Alice");
    });

    it("returns first matching element with predicate", () => {
      const result = Queryable.from(users).first((u) => u.age > 30);
      expect(result.name).toBe("Charlie");
    });

    it("throws on empty sequence", () => {
      expect(() => Queryable.from<User>([]).first()).toThrow(
        "Sequence contains no elements",
      );
    });

    it("throws when no match", () => {
      expect(() => Queryable.from(users).first((u) => u.age > 100)).toThrow(
        "Sequence contains no elements",
      );
    });
  });

  describe("firstOrDefault", () => {
    it("returns first element", () => {
      const result = Queryable.from(users).firstOrDefault();
      expect(result?.name).toBe("Alice");
    });

    it("returns undefined on empty sequence", () => {
      const result = Queryable.from<User>([]).firstOrDefault();
      expect(result).toBeUndefined();
    });

    it("returns undefined when no match", () => {
      const result = Queryable.from(users).firstOrDefault((u) => u.age > 100);
      expect(result).toBeUndefined();
    });
  });

  describe("count", () => {
    it("returns total count", () => {
      expect(Queryable.from(users).count()).toBe(5);
    });

    it("returns count with predicate", () => {
      expect(Queryable.from(users).count((u) => u.active)).toBe(3);
    });

    it("returns 0 for empty array", () => {
      expect(Queryable.from([]).count()).toBe(0);
    });
  });

  describe("any", () => {
    it("returns true for non-empty", () => {
      expect(Queryable.from(users).any()).toBe(true);
    });

    it("returns false for empty", () => {
      expect(Queryable.from([]).any()).toBe(false);
    });

    it("returns true when predicate matches", () => {
      expect(Queryable.from(users).any((u) => u.name === "Alice")).toBe(true);
    });

    it("returns false when predicate has no match", () => {
      expect(Queryable.from(users).any((u) => u.age > 100)).toBe(false);
    });
  });

  describe("chaining", () => {
    it("where + orderBy + select + take", () => {
      const result = Queryable.from(users)
        .where((u) => u.active)
        .orderBy((u) => u.name)
        .select((u) => ({ name: u.name, age: u.age }))
        .take(2)
        .toArray();
      expect(result).toEqual([
        { name: "Alice", age: 30 },
        { name: "Charlie", age: 35 },
      ]);
    });

    it("where + orderByDescending + take", () => {
      const result = Queryable.from(users)
        .where((u) => u.age >= 25)
        .orderByDescending((u) => u.age)
        .take(3)
        .toArray();
      expect(result.map((u) => u.name)).toEqual([
        "Charlie",
        "Alice",
        "Diana",
      ]);
    });

    it("multiple where clauses stack", () => {
      const result = Queryable.from(users)
        .where((u) => u.active)
        .where((u) => u.age > 28)
        .toArray();
      expect(result).toHaveLength(2);
      expect(result.map((u) => u.name)).toEqual(["Alice", "Charlie"]);
    });
  });

  describe("toExpressionTree", () => {
    it("returns operations with expression trees", () => {
      const ops = Queryable.from(users)
        .where((u) => u.age > 25)
        .orderBy((u) => u.name)
        .select((u) => ({ name: u.name }))
        .toExpressionTree();

      expect(ops).toHaveLength(3);
      expect(ops[0].type).toBe("where");
      expect(ops[0].expression?.kind).toBe("lambda");
      expect(ops[1].type).toBe("orderBy");
      expect(ops[2].type).toBe("select");
    });

    it("returns take/skip operations without expressions", () => {
      const ops = Queryable.from(users).skip(5).take(10).toExpressionTree();
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe("skip");
      expect(ops[0].value).toBe(5);
      expect(ops[1].type).toBe("take");
      expect(ops[1].value).toBe(10);
    });
  });

  describe("immutability", () => {
    it("does not mutate original source", () => {
      const data = [{ name: "A", age: 1, active: true }];
      const q = Queryable.from(data);
      q.where((u) => u.active).toArray();
      data.push({ name: "B", age: 2, active: false });
      // The queryable took a copy at creation time
      expect(q.toArray()).toHaveLength(1);
    });

    it("chaining creates new instances", () => {
      const q1 = Queryable.from(users);
      const q2 = q1.where((u) => u.active);
      const q3 = q1.where((u) => !u.active);

      expect(q2.toArray()).toHaveLength(3);
      expect(q3.toArray()).toHaveLength(2);
      expect(q1.toArray()).toHaveLength(5);
    });
  });
});
