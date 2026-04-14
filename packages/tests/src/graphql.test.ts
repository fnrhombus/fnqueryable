import { describe, expect, it } from "vitest";
import { Queryable } from "fnqueryable";
import { toGraphQL } from "@fnqueryable/graphql";

const ops = (q: Queryable<any>) => q.toExpressionTree();

describe("GraphQL provider", () => {
  describe("where", () => {
    it("translates simple comparison to Hasura-style filter", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({ age: { _gt: 25 } });
    });

    it("translates AND as sibling fields", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 && u.active === true);
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({
        age: { _gt: 25 },
        active: { _eq: true },
      });
    });

    it("translates OR as _or array", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 || u.role === "admin");
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({
        _or: [
          { age: { _gt: 25 } },
          { role: { _eq: "admin" } },
        ],
      });
    });

    it("translates bare member as _eq: true", () => {
      const q = Queryable.from([]).where((u: any) => u.active);
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({ active: { _eq: true } });
    });
  });

  describe("field selection", () => {
    it("includes selected fields in query body", () => {
      const q = Queryable.from([]).select((u: any) => ({ name: u.name, email: u.email }));
      const { query } = toGraphQL("users", ops(q));
      expect(query).toContain("{ name email }");
    });

    it("uses __typename when no select", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const { query } = toGraphQL("users", ops(q));
      expect(query).toContain("{ __typename }");
    });
  });

  describe("ordering", () => {
    it("translates orderBy to order_by variable", () => {
      const q = Queryable.from([]).orderBy((u: any) => u.name);
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.order_by).toEqual({ name: "asc" });
    });

    it("translates orderByDescending", () => {
      const q = Queryable.from([]).orderByDescending((u: any) => u.createdAt);
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.order_by).toEqual({ createdAt: "desc" });
    });
  });

  describe("limit/offset", () => {
    it("translates take to limit variable", () => {
      const q = Queryable.from([]).take(10);
      const { variables, query } = toGraphQL("users", ops(q));
      expect(variables.limit).toBe(10);
      expect(query).toContain("$limit: Int");
    });

    it("translates skip to offset variable", () => {
      const q = Queryable.from([]).skip(20);
      const { variables, query } = toGraphQL("users", ops(q));
      expect(variables.offset).toBe(20);
      expect(query).toContain("$offset: Int");
    });
  });

  describe("full query", () => {
    it("generates complete query string", () => {
      const q = Queryable.from([])
        .where((u: any) => u.age > 25)
        .orderBy((u: any) => u.name)
        .select((u: any) => ({ name: u.name, email: u.email }))
        .take(10);
      const { query, variables } = toGraphQL("users", ops(q));

      expect(query).toContain("query");
      expect(query).toContain("users");
      expect(query).toContain("where: $where");
      expect(query).toContain("order_by: $order_by");
      expect(query).toContain("limit: $limit");
      expect(query).toContain("{ name email }");

      expect(variables.where).toEqual({ age: { _gt: 25 } });
      expect(variables.order_by).toEqual({ name: "asc" });
      expect(variables.limit).toBe(10);
    });
  });

  describe("string methods", () => {
    it("translates startsWith to _like", () => {
      const q = Queryable.from([]).where((u: any) => u.name.startsWith("A"));
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({ name: { _like: "A%" } });
    });

    it("translates endsWith to _like", () => {
      const q = Queryable.from([]).where((u: any) => u.name.endsWith("son"));
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({ name: { _like: "%son" } });
    });

    it("translates includes to _like", () => {
      const q = Queryable.from([]).where((u: any) => u.email.includes("@gmail"));
      const { variables } = toGraphQL("users", ops(q));
      expect(variables.where).toEqual({ email: { _like: "%@gmail%" } });
    });
  });
});
