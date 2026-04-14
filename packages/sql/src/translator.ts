import type {
  Expression,
  LambdaExpression,
  Operation,
} from "fnqueryable";

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

export interface SqlOptions {
  dialect?: "postgres" | "mysql" | "sqlite";
  paramStyle?: "numbered" | "named" | "positional";
  nestedAccess?: "underscore" | "jsonb";
}

interface TranslationContext {
  params: unknown[];
  dialect: "postgres" | "mysql" | "sqlite";
  paramStyle: "numbered" | "named" | "positional";
  nestedAccess: "underscore" | "jsonb";
}

const addParam = (ctx: TranslationContext, value: unknown): string => {
  ctx.params.push(value);
  return ctx.paramStyle === "numbered"
    ? `$${ctx.params.length}`
    : "?";
};

const translateExpression = (expr: Expression, ctx: TranslationContext): string => {
  switch (expr.kind) {
    case "binary":
      return translateBinary(expr, ctx);
    case "logical":
      return translateLogical(expr, ctx);
    case "unary":
      return translateUnary(expr, ctx);
    case "member":
      return translateMember(expr, ctx);
    case "call":
      return translateCall(expr, ctx);
    case "literal":
      return addParam(ctx, expr.value);
    case "parameter":
      return expr.name;
    case "conditional":
      return `CASE WHEN ${translateExpression(expr.test, ctx)} THEN ${translateExpression(expr.consequent, ctx)} ELSE ${translateExpression(expr.alternate, ctx)} END`;
    default:
      throw new Error(`Unsupported expression kind: ${expr.kind}`);
  }
};

const translateBinary = (
  expr: Extract<Expression, { kind: "binary" }>,
  ctx: TranslationContext,
): string => {
  const left = translateExpression(expr.left, ctx);
  const right = translateExpression(expr.right, ctx);
  const op = ({
    "===": "=",
    "==": "=",
    "!==": "!=",
    "!=": "!=",
    ">": ">",
    "<": "<",
    ">=": ">=",
    "<=": "<=",
    "+": "+",
    "-": "-",
    "*": "*",
    "/": "/",
    "%": "%",
  } as const)[expr.operator];
  return `${left} ${op} ${right}`;
};

const translateLogical = (
  expr: Extract<Expression, { kind: "logical" }>,
  ctx: TranslationContext,
): string => {
  const left = translateExpression(expr.left, ctx);
  const right = translateExpression(expr.right, ctx);
  const op = expr.operator === "&&" ? "AND" : "OR";
  return `${left} ${op} ${right}`;
};

const translateUnary = (
  expr: Extract<Expression, { kind: "unary" }>,
  ctx: TranslationContext,
): string => {
  const operand = translateExpression(expr.operand, ctx);
  if (expr.operator === "!") return `NOT ${operand}`;
  if (expr.operator === "-") return `-${operand}`;
  throw new Error(`Unsupported unary operator: ${expr.operator}`);
};

const collectMemberPath = (expr: Expression): string[] => {
  if (expr.kind === "member") {
    return [...collectMemberPath(expr.object), expr.property];
  }
  return [];
};

const translateMember = (
  expr: Extract<Expression, { kind: "member" }>,
  ctx: TranslationContext,
): string => {
  const path = collectMemberPath(expr);
  if (path.length === 1) return path[0];
  if (ctx.nestedAccess === "jsonb") {
    const [first, ...rest] = path;
    return `${first}->>'${rest.join(".")}'`;
  }
  return path.join("_");
};

const translateCall = (
  expr: Extract<Expression, { kind: "call" }>,
  ctx: TranslationContext,
): string => {
  const col = translateExpression(expr.object, ctx);
  const arg = expr.args[0];
  if (arg?.kind !== "literal" || typeof arg.value !== "string") {
    throw new Error(`String method ${expr.method} requires a string literal argument`);
  }
  const val = arg.value;
  switch (expr.method) {
    case "startsWith":
      return `${col} LIKE ${addParam(ctx, `${val}%`)}`;
    case "endsWith":
      return `${col} LIKE ${addParam(ctx, `%${val}`)}`;
    case "includes":
      return `${col} LIKE ${addParam(ctx, `%${val}%`)}`;
    default:
      throw new Error(`Unsupported method: ${expr.method}`);
  }
};

const extractColumns = (expr: LambdaExpression): string[] | null => {
  if (expr.body.kind === "object") {
    return expr.body.properties.map((p) => {
      if (p.value.kind === "member") {
        const path = collectMemberPath(p.value);
        return path.length === 1 ? path[0] : path.join("_");
      }
      return p.key;
    });
  }
  return null;
};

const extractOrderColumn = (expr: LambdaExpression): string => {
  if (expr.body.kind === "member") {
    const path = collectMemberPath(expr.body);
    return path.length === 1 ? path[0] : path.join("_");
  }
  throw new Error("orderBy expression must be a member access");
};

export const translateToSql = (
  table: string,
  operations: Operation[],
  options?: SqlOptions,
): SqlQuery => {
  const dialect = options?.dialect ?? "postgres";
  const paramStyle =
    options?.paramStyle ??
    (dialect === "postgres" ? "numbered" : "positional");
  const nestedAccess = options?.nestedAccess ?? "underscore";

  const ctx: TranslationContext = {
    params: [],
    dialect,
    paramStyle,
    nestedAccess,
  };

  const whereClauses: string[] = [];
  const orderClauses: string[] = [];
  let columns = "*";
  let limit: number | undefined;
  let offset: number | undefined;

  for (const op of operations) {
    switch (op.type) {
      case "where":
        if (op.expression) {
          whereClauses.push(translateExpression(op.expression.body, ctx));
        }
        break;
      case "orderBy":
        if (op.expression) {
          orderClauses.push(`${extractOrderColumn(op.expression)} ASC`);
        }
        break;
      case "orderByDescending":
        if (op.expression) {
          orderClauses.push(`${extractOrderColumn(op.expression)} DESC`);
        }
        break;
      case "select":
        if (op.expression) {
          const cols = extractColumns(op.expression);
          if (cols) columns = cols.join(", ");
        }
        break;
      case "take":
        limit = op.value;
        break;
      case "skip":
        offset = op.value;
        break;
    }
  }

  const parts = [`SELECT ${columns} FROM ${table}`];

  if (whereClauses.length > 0) {
    parts.push(`WHERE ${whereClauses.join(" AND ")}`);
  }
  if (orderClauses.length > 0) {
    parts.push(`ORDER BY ${orderClauses.join(", ")}`);
  }
  if (limit !== undefined) {
    parts.push(`LIMIT ${addParam(ctx, limit)}`);
  }
  if (offset !== undefined) {
    parts.push(`OFFSET ${addParam(ctx, offset)}`);
  }

  return { sql: parts.join(" "), params: ctx.params };
};
