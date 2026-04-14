import { describe, expect, it } from "vitest";
import { Queryable } from "fnqueryable";
import { toOData } from "@fnqueryable/odata";

const ops = (q: Queryable<any>) => q.toExpressionTree();

describe("OData provider", () => {
  describe("$filter", () => {
    it("translates simple comparison", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=age gt 25");
    });

    it("translates AND conditions", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 && u.active === true);
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=age gt 25 and active eq true");
    });

    it("translates OR conditions", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25 || u.role === "admin");
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=age gt 25 or role eq 'admin'");
    });

    it("translates NOT", () => {
      const q = Queryable.from([]).where((u: any) => !u.deleted);
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=not deleted");
    });
  });

  describe("string functions", () => {
    it("translates startsWith", () => {
      const q = Queryable.from([]).where((u: any) => u.name.startsWith("A"));
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=startswith(name,'A')");
    });

    it("translates endsWith", () => {
      const q = Queryable.from([]).where((u: any) => u.name.endsWith("son"));
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=endswith(name,'son')");
    });

    it("translates includes to contains", () => {
      const q = Queryable.from([]).where((u: any) => u.email.includes("@gmail"));
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=contains(email,'@gmail')");
    });
  });

  describe("$orderby", () => {
    it("translates orderBy", () => {
      const q = Queryable.from([]).orderBy((u: any) => u.name);
      const qs = toOData(ops(q));
      expect(qs).toBe("$orderby=name asc");
    });

    it("translates orderByDescending", () => {
      const q = Queryable.from([]).orderByDescending((u: any) => u.createdAt);
      const qs = toOData(ops(q));
      expect(qs).toBe("$orderby=createdAt desc");
    });
  });

  describe("$select", () => {
    it("translates select", () => {
      const q = Queryable.from([]).select((u: any) => ({ name: u.name, email: u.email }));
      const qs = toOData(ops(q));
      expect(qs).toBe("$select=name,email");
    });
  });

  describe("$top/$skip", () => {
    it("translates take to $top", () => {
      const q = Queryable.from([]).take(10);
      const qs = toOData(ops(q));
      expect(qs).toBe("$top=10");
    });

    it("translates skip to $skip", () => {
      const q = Queryable.from([]).skip(20);
      const qs = toOData(ops(q));
      expect(qs).toBe("$skip=20");
    });
  });

  describe("full query", () => {
    it("assembles all parts", () => {
      const q = Queryable.from([])
        .where((u: any) => u.age > 25)
        .orderBy((u: any) => u.name)
        .select((u: any) => ({ name: u.name, email: u.email }))
        .take(10);
      const qs = toOData(ops(q));
      expect(qs).toBe("$filter=age gt 25&$orderby=name asc&$select=name,email&$top=10");
    });
  });

  describe("baseUrl option", () => {
    it("prepends baseUrl", () => {
      const q = Queryable.from([]).where((u: any) => u.age > 25);
      const qs = toOData(ops(q), { baseUrl: "https://api.example.com/users" });
      expect(qs).toBe("https://api.example.com/users?$filter=age gt 25");
    });

    it("uses & if baseUrl already has query params", () => {
      const q = Queryable.from([]).take(10);
      const qs = toOData(ops(q), { baseUrl: "https://api.example.com/users?api_key=xyz" });
      expect(qs).toBe("https://api.example.com/users?api_key=xyz&$top=10");
    });
  });
});
