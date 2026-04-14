import { describe, expect, it } from "vitest";
import { Queryable } from "fnqueryable";
import { toSql } from "@fnqueryable/sql";

const ops = (q: Queryable<any>) => q.toExpressionTree();

describe("SQL provider", () => {
  describe("where", () => {
    it("translates simple comparison", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE age > $1");
      expect(params).toEqual([25]);
    });

    it("translates AND conditions", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 && u.active === true);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE age > $1 AND active = $2");
      expect(params).toEqual([25, true]);
    });

    it("translates OR conditions", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 || u.role === "admin");
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE age > $1 OR role = $2");
      expect(params).toEqual([25, "admin"]);
    });

    it("translates NOT", () => {
      const q = Queryable.from([]).where((u: any) => !u.deleted);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE NOT deleted");
      expect(params).toEqual([]);
    });

    it("translates equality operators", () => {
      const q = Queryable.from([]).where((u: any) => u.status == "active");
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE status = $1");
      expect(params).toEqual(["active"]);
    });
  });

  describe("string methods", () => {
    it("translates startsWith to LIKE", () => {
      const q = Queryable.from([]).where((u: any) => u.name.startsWith("A"));
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE name LIKE $1");
      expect(params).toEqual(["A%"]);
    });

    it("translates endsWith to LIKE", () => {
      const q = Queryable.from([]).where((u: any) => u.name.endsWith("son"));
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE name LIKE $1");
      expect(params).toEqual(["%son"]);
    });

    it("translates includes to LIKE", () => {
      const q = Queryable.from([]).where((u: any) => u.email.includes("@gmail"));
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE email LIKE $1");
      expect(params).toEqual(["%@gmail%"]);
    });
  });

  describe("orderBy", () => {
    it("translates orderBy to ORDER BY ASC", () => {
      const q = Queryable.from([]).orderBy((u: any) => u.name);
      const { sql } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users ORDER BY name ASC");
    });

    it("translates orderByDescending to ORDER BY DESC", () => {
      const q = Queryable.from([]).orderByDescending((u: any) => u.createdAt);
      const { sql } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users ORDER BY createdAt DESC");
    });
  });

  describe("select", () => {
    it("translates select to column list", () => {
      const q = Queryable.from([]).select((u: any) => ({ name: u.name, email: u.email }));
      const { sql } = toSql("users", ops(q));
      expect(sql).toBe("SELECT name, email FROM users");
    });
  });

  describe("take/skip", () => {
    it("translates take to LIMIT", () => {
      const q = Queryable.from([]).take(10);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users LIMIT $1");
      expect(params).toEqual([10]);
    });

    it("translates skip to OFFSET", () => {
      const q = Queryable.from([]).skip(20);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users OFFSET $1");
      expect(params).toEqual([20]);
    });

    it("translates take + skip to LIMIT + OFFSET", () => {
      const q = Queryable.from([]).take(10).skip(20);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users LIMIT $1 OFFSET $2");
      expect(params).toEqual([10, 20]);
    });
  });

  describe("combined query", () => {
    it("translates a full query", () => {
      const q = Queryable.from([])
        .where((u: any) => u.age > 25)
        .orderBy((u: any) => u.name)
        .select((u: any) => ({ name: u.name, email: u.email }))
        .take(10);
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe(
        "SELECT name, email FROM users WHERE age > $1 ORDER BY name ASC LIMIT $2",
      );
      expect(params).toEqual([25, 10]);
    });
  });

  describe("dialects", () => {
    it("mysql uses ? params", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25).take(10);
      const { sql, params } = toSql("users", ops(q), { dialect: "mysql" });
      expect(sql).toBe("SELECT * FROM users WHERE age > ? LIMIT ?");
      expect(params).toEqual([25, 10]);
    });

    it("sqlite uses ? params", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const { sql, params } = toSql("users", ops(q), { dialect: "sqlite" });
      expect(sql).toBe("SELECT * FROM users WHERE age > ?");
      expect(params).toEqual([25]);
    });
  });

  describe("nested member access", () => {
    it("uses underscore by default", () => {
      const q = Queryable.from([]).where((u: any) => u.address.city === "NYC");
      const { sql, params } = toSql("users", ops(q));
      expect(sql).toBe("SELECT * FROM users WHERE address_city = $1");
      expect(params).toEqual(["NYC"]);
    });

    it("uses jsonb when configured", () => {
      const q = Queryable.from([]).where((u: any) => u.address.city === "NYC");
      const { sql, params } = toSql("users", ops(q), { nestedAccess: "jsonb" });
      expect(sql).toBe("SELECT * FROM users WHERE address->>'city' = $1");
      expect(params).toEqual(["NYC"]);
    });
  });
});
