import { describe, it, expect } from "vitest";
import { parseFunction, parseSource } from "fnqueryable";
import type {
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  LambdaExpression,
  LiteralExpression,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  ParameterExpression,
  UnaryExpression,
} from "fnqueryable";

describe("parseFunction", () => {
  describe("simple comparisons", () => {
    it("parses u => u.age > 25", () => {
      const expr = parseFunction((u: any) => u.age > 25);
      expect(expr.kind).toBe("lambda");
      expect(expr.parameters).toEqual(["u"]);

      const body = expr.body as BinaryExpression;
      expect(body.kind).toBe("binary");
      expect(body.operator).toBe(">");

      const left = body.left as MemberExpression;
      expect(left.kind).toBe("member");
      expect(left.property).toBe("age");
      expect((left.object as ParameterExpression).name).toBe("u");

      const right = body.right as LiteralExpression;
      expect(right.kind).toBe("literal");
      expect(right.value).toBe(25);
    });

    it("parses equality", () => {
      const expr = parseFunction((x: any) => x.name === "Alice");
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe("===");
      expect((body.right as LiteralExpression).value).toBe("Alice");
    });

    it("parses inequality", () => {
      const expr = parseFunction((x: any) => x.score !== 0);
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe("!==");
    });

    it("parses all comparison operators", () => {
      const ops = [
        { fn: (x: any) => x.a < 1, op: "<" },
        { fn: (x: any) => x.a <= 1, op: "<=" },
        { fn: (x: any) => x.a >= 1, op: ">=" },
      ];
      for (const { fn, op } of ops) {
        const body = parseFunction(fn).body as BinaryExpression;
        expect(body.operator).toBe(op);
      }
    });
  });

  describe("logical expressions", () => {
    it("parses && with two conditions", () => {
      const expr = parseFunction((u: any) => u.age > 25 && u.active);
      const body = expr.body as LogicalExpression;
      expect(body.kind).toBe("logical");
      expect(body.operator).toBe("&&");

      const left = body.left as BinaryExpression;
      expect(left.kind).toBe("binary");
      expect(left.operator).toBe(">");

      const right = body.right as MemberExpression;
      expect(right.kind).toBe("member");
      expect(right.property).toBe("active");
    });

    it("parses || operator", () => {
      const expr = parseFunction((u: any) => u.a || u.b);
      const body = expr.body as LogicalExpression;
      expect(body.operator).toBe("||");
    });

    it("parses ?? operator", () => {
      const expr = parseFunction((u: any) => u.name ?? "default");
      const body = expr.body as LogicalExpression;
      expect(body.operator).toBe("??");
    });
  });

  describe("member access", () => {
    it("parses simple member access", () => {
      const expr = parseFunction((u: any) => u.name);
      const body = expr.body as MemberExpression;
      expect(body.kind).toBe("member");
      expect(body.property).toBe("name");
      expect((body.object as ParameterExpression).name).toBe("u");
    });

    it("parses nested member access", () => {
      const expr = parseFunction((u: any) => u.address.city);
      const body = expr.body as MemberExpression;
      expect(body.kind).toBe("member");
      expect(body.property).toBe("city");

      const inner = body.object as MemberExpression;
      expect(inner.kind).toBe("member");
      expect(inner.property).toBe("address");
      expect((inner.object as ParameterExpression).name).toBe("u");
    });

    it("parses deeply nested member access", () => {
      const expr = parseFunction((u: any) => u.a.b.c.d);
      const body = expr.body as MemberExpression;
      expect(body.property).toBe("d");
      const c = body.object as MemberExpression;
      expect(c.property).toBe("c");
      const b = c.object as MemberExpression;
      expect(b.property).toBe("b");
    });
  });

  describe("method calls", () => {
    it("parses string method call", () => {
      const expr = parseFunction((u: any) => u.name.startsWith("A"));
      const body = expr.body as CallExpression;
      expect(body.kind).toBe("call");
      expect(body.method).toBe("startsWith");
      expect(body.args).toHaveLength(1);
      expect((body.args[0] as LiteralExpression).value).toBe("A");

      const obj = body.object as MemberExpression;
      expect(obj.property).toBe("name");
    });

    it("parses includes method", () => {
      const expr = parseFunction((u: any) => u.tags.includes("admin"));
      const body = expr.body as CallExpression;
      expect(body.method).toBe("includes");
      expect((body.args[0] as LiteralExpression).value).toBe("admin");
    });

    it("parses method with multiple args", () => {
      const expr = parseFunction((u: any) => u.name.substring(0, 3));
      const body = expr.body as CallExpression;
      expect(body.method).toBe("substring");
      expect(body.args).toHaveLength(2);
      expect((body.args[0] as LiteralExpression).value).toBe(0);
      expect((body.args[1] as LiteralExpression).value).toBe(3);
    });
  });

  describe("object expressions", () => {
    it("parses simple object expression", () => {
      const expr = parseFunction((u: any) => ({ name: u.name }));
      const body = expr.body as ObjectExpression;
      expect(body.kind).toBe("object");
      expect(body.properties).toHaveLength(1);
      expect(body.properties[0].key).toBe("name");
      expect((body.properties[0].value as MemberExpression).property).toBe(
        "name",
      );
    });

    it("parses multi-property object expression", () => {
      const expr = parseFunction((u: any) => ({ name: u.name, age: u.age }));
      const body = expr.body as ObjectExpression;
      expect(body.properties).toHaveLength(2);
      expect(body.properties[0].key).toBe("name");
      expect(body.properties[1].key).toBe("age");
    });
  });

  describe("conditional (ternary)", () => {
    it("parses ternary expression", () => {
      const expr = parseFunction((u: any) => (u.active ? "yes" : "no"));
      const body = expr.body as ConditionalExpression;
      expect(body.kind).toBe("conditional");

      const test = body.test as MemberExpression;
      expect(test.property).toBe("active");

      expect((body.consequent as LiteralExpression).value).toBe("yes");
      expect((body.alternate as LiteralExpression).value).toBe("no");
    });
  });

  describe("unary expressions", () => {
    it("parses logical NOT", () => {
      const expr = parseFunction((u: any) => !u.active);
      const body = expr.body as UnaryExpression;
      expect(body.kind).toBe("unary");
      expect(body.operator).toBe("!");

      const operand = body.operand as MemberExpression;
      expect(operand.property).toBe("active");
    });

    it("parses negation", () => {
      const expr = parseFunction((u: any) => -u.score);
      const body = expr.body as UnaryExpression;
      expect(body.operator).toBe("-");
    });
  });

  describe("literals", () => {
    it("parses string literal", () => {
      const expr = parseFunction((_u: any) => "hello");
      expect((expr.body as LiteralExpression).value).toBe("hello");
    });

    it("parses number literal", () => {
      const expr = parseFunction((_u: any) => 42);
      expect((expr.body as LiteralExpression).value).toBe(42);
    });

    it("parses boolean literals", () => {
      const exprTrue = parseFunction((_u: any) => true);
      expect((exprTrue.body as LiteralExpression).value).toBe(true);

      const exprFalse = parseFunction((_u: any) => false);
      expect((exprFalse.body as LiteralExpression).value).toBe(false);
    });

    it("parses null", () => {
      const expr = parseFunction((_u: any) => null);
      expect((expr.body as LiteralExpression).value).toBe(null);
    });

    it("parses undefined", () => {
      const expr = parseFunction((_u: any) => undefined);
      expect((expr.body as LiteralExpression).value).toBe(undefined);
    });
  });

  describe("arithmetic", () => {
    it("parses addition", () => {
      const expr = parseFunction((u: any) => u.a + u.b);
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe("+");
    });

    it("parses multiplication", () => {
      const expr = parseFunction((u: any) => u.a * 2);
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe("*");
    });

    it("parses modulo", () => {
      const expr = parseFunction((u: any) => u.a % 2);
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe("%");
    });
  });

  describe("template literals", () => {
    it("converts template literal to string concatenation", () => {
      const fn = (u: any) => `Hello ${u.name}`;
      const expr = parseFunction(fn);
      const body = expr.body as BinaryExpression;
      expect(body.kind).toBe("binary");
      expect(body.operator).toBe("+");
    });
  });

  describe("caching", () => {
    it("returns cached result for same function reference", () => {
      const fn = (u: any) => u.age > 25;
      const result1 = parseFunction(fn);
      const result2 = parseFunction(fn);
      expect(result1).toBe(result2); // Same reference, not just equal
    });

    it("parses different functions independently", () => {
      const fn1 = (u: any) => u.age > 25;
      const fn2 = (u: any) => u.name === "Alice";
      const result1 = parseFunction(fn1);
      const result2 = parseFunction(fn2);
      expect(result1).not.toBe(result2);
    });
  });

  describe("parseSource", () => {
    it("parses a source string directly", () => {
      const expr = parseSource("(u) => u.age > 25");
      expect(expr.kind).toBe("lambda");
      expect(expr.parameters).toEqual(["u"]);
    });
  });

  describe("function expressions", () => {
    it("parses function expression with return", () => {
      const fn = function (u: any) {
        return u.age > 25;
      };
      const expr = parseFunction(fn);
      expect(expr.kind).toBe("lambda");
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe(">");
    });
  });

  describe("arrow with block body", () => {
    it("parses arrow function with explicit return", () => {
      const fn = (u: any) => {
        return u.age > 25;
      };
      const expr = parseFunction(fn);
      expect(expr.kind).toBe("lambda");
      const body = expr.body as BinaryExpression;
      expect(body.operator).toBe(">");
    });
  });
});
