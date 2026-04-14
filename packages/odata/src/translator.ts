import type {
  Expression,
  LambdaExpression,
  Operation,
} from "fnqueryable";

export interface ODataOptions {
  baseUrl?: string;
}

const collectMemberPath = (expr: Expression): string[] => {
  if (expr.kind === "member") {
    return [...collectMemberPath(expr.object), expr.property];
  }
  return [];
};

const formatValue = (value: unknown): string => {
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "number") return value.toString();
  if (value === null) return "null";
  return String(value);
};

const translateExpression = (expr: Expression): string => {
  switch (expr.kind) {
    case "binary":
      return translateBinary(expr);
    case "logical":
      return translateLogical(expr);
    case "unary":
      return translateUnary(expr);
    case "member":
      return translateMember(expr);
    case "call":
      return translateCall(expr);
    case "literal":
      return formatValue(expr.value);
    case "parameter":
      return expr.name;
    default:
      throw new Error(`Unsupported expression kind: ${expr.kind}`);
  }
};

const binaryOpMap: Record<string, string> = {
  ">": "gt",
  "<": "lt",
  ">=": "ge",
  "<=": "le",
  "===": "eq",
  "==": "eq",
  "!==": "ne",
  "!=": "ne",
};

const translateBinary = (
  expr: Extract<Expression, { kind: "binary" }>,
): string => {
  const left = translateExpression(expr.left);
  const right = translateExpression(expr.right);
  const op = binaryOpMap[expr.operator];
  if (!op) throw new Error(`Unsupported binary operator for OData: ${expr.operator}`);
  return `${left} ${op} ${right}`;
};

const translateLogical = (
  expr: Extract<Expression, { kind: "logical" }>,
): string => {
  const left = translateExpression(expr.left);
  const right = translateExpression(expr.right);
  const op = expr.operator === "&&" ? "and" : "or";
  return `${left} ${op} ${right}`;
};

const translateUnary = (
  expr: Extract<Expression, { kind: "unary" }>,
): string => {
  const operand = translateExpression(expr.operand);
  if (expr.operator === "!") return `not ${operand}`;
  throw new Error(`Unsupported unary operator for OData: ${expr.operator}`);
};

const translateMember = (
  expr: Extract<Expression, { kind: "member" }>,
): string => {
  const path = collectMemberPath(expr);
  return path.join("/");
};

const translateCall = (
  expr: Extract<Expression, { kind: "call" }>,
): string => {
  const col = translateExpression(expr.object);
  const arg = expr.args[0];
  if (arg?.kind !== "literal" || typeof arg.value !== "string") {
    throw new Error(`String method ${expr.method} requires a string literal argument`);
  }
  const val = `'${arg.value}'`;
  switch (expr.method) {
    case "startsWith":
      return `startswith(${col},${val})`;
    case "endsWith":
      return `endswith(${col},${val})`;
    case "includes":
      return `contains(${col},${val})`;
    default:
      throw new Error(`Unsupported method for OData: ${expr.method}`);
  }
};

const extractColumns = (expr: LambdaExpression): string[] | null => {
  if (expr.body.kind === "object") {
    return expr.body.properties.map((p) => {
      if (p.value.kind === "member") {
        const path = collectMemberPath(p.value);
        return path.join("/");
      }
      return p.key;
    });
  }
  return null;
};

const extractOrderColumn = (expr: LambdaExpression): string => {
  if (expr.body.kind === "member") {
    const path = collectMemberPath(expr.body);
    return path.join("/");
  }
  throw new Error("orderBy expression must be a member access");
};

export const translateToOData = (
  operations: Operation[],
  options?: ODataOptions,
): string => {
  const parts: string[] = [];

  const filterClauses: string[] = [];
  const orderClauses: string[] = [];
  let selectCols: string[] | null = null;
  let top: number | undefined;
  let skip: number | undefined;

  for (const op of operations) {
    switch (op.type) {
      case "where":
        if (op.expression) {
          filterClauses.push(translateExpression(op.expression.body));
        }
        break;
      case "orderBy":
        if (op.expression) {
          orderClauses.push(`${extractOrderColumn(op.expression)} asc`);
        }
        break;
      case "orderByDescending":
        if (op.expression) {
          orderClauses.push(`${extractOrderColumn(op.expression)} desc`);
        }
        break;
      case "select":
        if (op.expression) {
          selectCols = extractColumns(op.expression);
        }
        break;
      case "take":
        top = op.value;
        break;
      case "skip":
        skip = op.value;
        break;
    }
  }

  if (filterClauses.length > 0) {
    parts.push(`$filter=${filterClauses.join(" and ")}`);
  }
  if (orderClauses.length > 0) {
    parts.push(`$orderby=${orderClauses.join(",")}`);
  }
  if (selectCols) {
    parts.push(`$select=${selectCols.join(",")}`);
  }
  if (top !== undefined) {
    parts.push(`$top=${top}`);
  }
  if (skip !== undefined) {
    parts.push(`$skip=${skip}`);
  }

  const qs = parts.join("&");

  if (options?.baseUrl) {
    const separator = options.baseUrl.includes("?") ? "&" : "?";
    return `${options.baseUrl}${separator}${qs}`;
  }

  return qs;
};
