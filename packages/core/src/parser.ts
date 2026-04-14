import * as acorn from "acorn";
import type {
  Expression,
  LambdaExpression,
  BinaryExpression,
  LogicalExpression,
} from "./expression.js";

type AcornNode = acorn.Node & Record<string, any>;

const parseCache = new WeakMap<Function, LambdaExpression>();

export function parseFunction(fn: Function): LambdaExpression {
  const cached = parseCache.get(fn);
  if (cached) return cached;

  const source = fn.toString();
  const result = parseSource(source);
  parseCache.set(fn, result);
  return result;
}

export function parseSource(source: string): LambdaExpression {
  // Wrap in parentheses so Acorn can parse arrow functions and function
  // expressions as expressions rather than statements.
  const wrapped = `(${source})`;
  const ast = acorn.parse(wrapped, {
    ecmaVersion: 2022,
    sourceType: "module",
  }) as AcornNode;

  const stmt = ast.body[0] as AcornNode;
  if (stmt.type !== "ExpressionStatement") {
    throw new Error(`Expected ExpressionStatement, got ${stmt.type}`);
  }

  const expr = stmt.expression as AcornNode;
  return parseLambda(expr);
}

function parseLambda(node: AcornNode): LambdaExpression {
  if (node.type === "ArrowFunctionExpression") {
    const params: string[] = (node.params as AcornNode[]).map(extractParamName);
    const body =
      node.body.type === "BlockStatement"
        ? parseBlockBody(node.body as AcornNode)
        : parseNode(node.body as AcornNode);
    return { kind: "lambda", parameters: params, body };
  }

  if (node.type === "FunctionExpression") {
    const params: string[] = (node.params as AcornNode[]).map(extractParamName);
    const body = parseBlockBody(node.body as AcornNode);
    return { kind: "lambda", parameters: params, body };
  }

  throw new Error(
    `Expected ArrowFunctionExpression or FunctionExpression, got ${node.type}`,
  );
}

function extractParamName(param: AcornNode): string {
  if (param.type === "Identifier") return param.name as string;
  throw new Error(`Unsupported parameter type: ${param.type}`);
}

function parseBlockBody(block: AcornNode): Expression {
  const statements = block.body as AcornNode[];
  if (statements.length === 0) {
    throw new Error("Empty function body");
  }
  if (statements.length === 1 && statements[0].type === "ReturnStatement") {
    return parseNode(statements[0].argument as AcornNode);
  }
  // For single expression statements (shouldn't normally happen with arrows,
  // but handle it gracefully)
  if (
    statements.length === 1 &&
    statements[0].type === "ExpressionStatement"
  ) {
    return parseNode(statements[0].expression as AcornNode);
  }
  throw new Error(
    "Only single-return function bodies are supported in expression trees",
  );
}

function parseNode(node: AcornNode): Expression {
  switch (node.type) {
    case "BinaryExpression":
      return parseBinaryOrLogical(node);
    case "LogicalExpression":
      return parseLogical(node);
    case "UnaryExpression":
      return parseUnary(node);
    case "MemberExpression":
      return parseMember(node);
    case "CallExpression":
      return parseCall(node);
    case "Literal":
      return parseLiteral(node);
    case "Identifier":
      return parseIdentifier(node);
    case "ObjectExpression":
      return parseObject(node);
    case "ConditionalExpression":
      return parseConditional(node);
    case "TemplateLiteral":
      return parseTemplateLiteral(node);
    case "ArrayExpression":
      return parseArray(node);
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return parseLambda(node);
    case "ParenthesizedExpression":
      return parseNode(node.expression as AcornNode);
    default:
      throw new Error(`Unsupported AST node type: ${node.type}`);
  }
}

function parseBinaryOrLogical(
  node: AcornNode,
): BinaryExpression | LogicalExpression {
  const op = node.operator as string;
  const left = parseNode(node.left as AcornNode);
  const right = parseNode(node.right as AcornNode);

  const logicalOps = ["&&", "||", "??"];
  if (logicalOps.includes(op)) {
    return {
      kind: "logical",
      operator: op as LogicalExpression["operator"],
      left,
      right,
    };
  }

  return {
    kind: "binary",
    operator: op as BinaryExpression["operator"],
    left,
    right,
  };
}

function parseLogical(node: AcornNode): LogicalExpression {
  return {
    kind: "logical",
    operator: node.operator as LogicalExpression["operator"],
    left: parseNode(node.left as AcornNode),
    right: parseNode(node.right as AcornNode),
  };
}

function parseUnary(node: AcornNode): Expression {
  const op = node.operator as string;

  // `void 0` is how runtimes compile `undefined`
  if (op === "void") {
    return { kind: "literal", value: undefined };
  }

  if (op === "!" || op === "-" || op === "typeof") {
    return {
      kind: "unary",
      operator: op,
      operand: parseNode(node.argument as AcornNode),
    };
  }
  throw new Error(`Unsupported unary operator: ${op}`);
}

function parseMember(node: AcornNode): Expression {
  const object = parseNode(node.object as AcornNode);

  if (node.computed) {
    // e.g. obj["key"] or obj[0] — treat computed string/number access as member
    const prop = node.property as AcornNode;
    if (prop.type === "Literal" && typeof prop.value === "string") {
      return { kind: "member", object, property: prop.value };
    }
    if (prop.type === "Literal" && typeof prop.value === "number") {
      return { kind: "member", object, property: String(prop.value) };
    }
    throw new Error("Only literal computed member access is supported");
  }

  const property = (node.property as AcornNode).name as string;
  return { kind: "member", object, property };
}

function parseCall(node: AcornNode): Expression {
  const args = (node.arguments as AcornNode[]).map(parseNode);
  const callee = node.callee as AcornNode;

  if (callee.type === "MemberExpression") {
    const object = parseNode(callee.object as AcornNode);
    const method = callee.computed
      ? String((callee.property as AcornNode).value)
      : ((callee.property as AcornNode).name as string);
    return { kind: "call", object, method, args };
  }

  // Standalone function call — model as call on a parameter
  if (callee.type === "Identifier") {
    return {
      kind: "call",
      object: { kind: "parameter", name: callee.name as string },
      method: callee.name as string,
      args,
    };
  }

  throw new Error(`Unsupported call expression callee: ${callee.type}`);
}

function parseLiteral(node: AcornNode): Expression {
  return {
    kind: "literal",
    value: node.value as string | number | boolean | null,
  };
}

function parseIdentifier(node: AcornNode): Expression {
  const name = node.name as string;
  if (name === "undefined") {
    return { kind: "literal", value: undefined };
  }
  return { kind: "parameter", name };
}

function parseObject(node: AcornNode): Expression {
  const properties = (node.properties as AcornNode[]).map((prop) => {
    const key =
      prop.key.type === "Identifier"
        ? (prop.key.name as string)
        : String(prop.key.value);
    const value = parseNode(prop.value as AcornNode);
    return { key, value };
  });
  return { kind: "object", properties };
}

function parseConditional(node: AcornNode): Expression {
  return {
    kind: "conditional",
    test: parseNode(node.test as AcornNode),
    consequent: parseNode(node.consequent as AcornNode),
    alternate: parseNode(node.alternate as AcornNode),
  };
}

function parseTemplateLiteral(node: AcornNode): Expression {
  const quasis = node.quasis as AcornNode[];
  const expressions = node.expressions as AcornNode[];
  const parts: Expression[] = [];

  for (let i = 0; i < quasis.length; i++) {
    const cooked = quasis[i].value.cooked as string;
    if (cooked !== "") {
      parts.push({ kind: "literal", value: cooked });
    }
    if (i < expressions.length) {
      parts.push(parseNode(expressions[i]));
    }
  }

  // Single part — just return it directly
  if (parts.length === 1) return parts[0];

  // Convert to chain of binary "+" expressions
  let result: Expression = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = { kind: "binary", operator: "+", left: result, right: parts[i] };
  }
  return result;
}

function parseArray(node: AcornNode): Expression {
  return {
    kind: "array",
    elements: (node.elements as AcornNode[]).map(parseNode),
  };
}
