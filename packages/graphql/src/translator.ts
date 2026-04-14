import type {
  Expression,
  LambdaExpression,
  Operation,
} from "fnqueryable";

export interface GraphQLQuery {
  query: string;
  variables: Record<string, unknown>;
}

export interface GraphQLOptions {
  style?: "hasura" | "prisma" | "generic";
}

const collectMemberPath = (expr: Expression): string[] => {
  if (expr.kind === "member") {
    return [...collectMemberPath(expr.object), expr.property];
  }
  return [];
};

type FilterObject = Record<string, unknown>;

const translateWhereExpression = (expr: Expression): FilterObject => {
  switch (expr.kind) {
    case "binary":
      return translateBinaryFilter(expr);
    case "logical":
      return translateLogicalFilter(expr);
    case "unary":
      return translateUnaryFilter(expr);
    case "member": {
      const path = collectMemberPath(expr);
      const col = path[path.length - 1];
      return { [col]: { _eq: true } };
    }
    case "call":
      return translateCallFilter(expr);
    default:
      throw new Error(`Unsupported expression kind in where: ${expr.kind}`);
  }
};

const binaryOpMap: Record<string, string> = {
  ">": "_gt",
  "<": "_lt",
  ">=": "_gte",
  "<=": "_lte",
  "===": "_eq",
  "==": "_eq",
  "!==": "_neq",
  "!=": "_neq",
};

const extractLiteralValue = (expr: Expression): unknown => {
  if (expr.kind === "literal") return expr.value;
  throw new Error(`Expected literal, got ${expr.kind}`);
};

const extractColumnName = (expr: Expression): string => {
  if (expr.kind === "member") {
    const path = collectMemberPath(expr);
    return path[path.length - 1];
  }
  throw new Error(`Expected member expression, got ${expr.kind}`);
};

const translateBinaryFilter = (
  expr: Extract<Expression, { kind: "binary" }>,
): FilterObject => {
  const col = extractColumnName(expr.left);
  const val = extractLiteralValue(expr.right);
  const op = binaryOpMap[expr.operator];
  if (!op) throw new Error(`Unsupported binary operator: ${expr.operator}`);
  return { [col]: { [op]: val } };
};

const translateLogicalFilter = (
  expr: Extract<Expression, { kind: "logical" }>,
): FilterObject => {
  const left = translateWhereExpression(expr.left);
  const right = translateWhereExpression(expr.right);

  if (expr.operator === "||") {
    return { _or: [left, right] };
  }

  // AND: merge sibling fields
  return { ...left, ...right };
};

const translateUnaryFilter = (
  expr: Extract<Expression, { kind: "unary" }>,
): FilterObject => {
  if (expr.operator === "!") {
    const inner = translateWhereExpression(expr.operand);
    return { _not: inner };
  }
  throw new Error(`Unsupported unary operator: ${expr.operator}`);
};

const translateCallFilter = (
  expr: Extract<Expression, { kind: "call" }>,
): FilterObject => {
  const col = extractColumnName(expr.object);
  const arg = expr.args[0];
  if (arg?.kind !== "literal" || typeof arg.value !== "string") {
    throw new Error(`String method ${expr.method} requires a string literal argument`);
  }
  switch (expr.method) {
    case "startsWith":
      return { [col]: { _like: `${arg.value}%` } };
    case "endsWith":
      return { [col]: { _like: `%${arg.value}` } };
    case "includes":
      return { [col]: { _like: `%${arg.value}%` } };
    default:
      throw new Error(`Unsupported method: ${expr.method}`);
  }
};

const extractSelectFields = (expr: LambdaExpression): string[] | null => {
  if (expr.body.kind === "object") {
    return expr.body.properties.map((p) => p.key);
  }
  return null;
};

const extractOrderColumn = (expr: LambdaExpression): string => {
  if (expr.body.kind === "member") {
    const path = collectMemberPath(expr.body);
    return path[path.length - 1];
  }
  throw new Error("orderBy expression must be a member access");
};

export const translateToGraphQL = (
  queryName: string,
  operations: Operation[],
  _options?: GraphQLOptions,
): GraphQLQuery => {
  const variables: Record<string, unknown> = {};
  const varDefs: string[] = [];
  const args: string[] = [];

  let whereFilter: FilterObject | undefined;
  const orderEntries: Record<string, string> = {};
  let fields: string[] | null = null;
  let limit: number | undefined;
  let offset: number | undefined;

  for (const op of operations) {
    switch (op.type) {
      case "where":
        if (op.expression) {
          const filter = translateWhereExpression(op.expression.body);
          whereFilter = whereFilter ? { ...whereFilter, ...filter } : filter;
        }
        break;
      case "orderBy":
        if (op.expression) {
          orderEntries[extractOrderColumn(op.expression)] = "asc";
        }
        break;
      case "orderByDescending":
        if (op.expression) {
          orderEntries[extractOrderColumn(op.expression)] = "desc";
        }
        break;
      case "select":
        if (op.expression) {
          fields = extractSelectFields(op.expression);
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

  if (whereFilter) {
    varDefs.push("$where: JSON");
    args.push("where: $where");
    variables.where = whereFilter;
  }

  if (Object.keys(orderEntries).length > 0) {
    varDefs.push("$order_by: JSON");
    args.push("order_by: $order_by");
    variables.order_by = orderEntries;
  }

  if (limit !== undefined) {
    varDefs.push("$limit: Int");
    args.push("limit: $limit");
    variables.limit = limit;
  }

  if (offset !== undefined) {
    varDefs.push("$offset: Int");
    args.push("offset: $offset");
    variables.offset = offset;
  }

  const fieldSelection = fields ? fields.join(" ") : "__typename";

  const varDefStr = varDefs.length > 0 ? ` (${varDefs.join(", ")})` : "";
  const argsStr = args.length > 0 ? `(${args.join(", ")})` : "";

  const query = `query${varDefStr} { ${queryName}${argsStr} { ${fieldSelection} } }`;

  return { query, variables };
};
