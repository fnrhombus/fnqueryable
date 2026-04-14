export type Expression =
  | LambdaExpression
  | BinaryExpression
  | LogicalExpression
  | UnaryExpression
  | MemberExpression
  | CallExpression
  | LiteralExpression
  | ParameterExpression
  | ObjectExpression
  | PropertyExpression
  | ConditionalExpression
  | ArrayExpression
  | TemplateLiteralExpression;

export interface LambdaExpression {
  kind: "lambda";
  parameters: string[];
  body: Expression;
}

export interface BinaryExpression {
  kind: "binary";
  operator:
    | ">"
    | "<"
    | ">="
    | "<="
    | "==="
    | "!=="
    | "=="
    | "!="
    | "+"
    | "-"
    | "*"
    | "/"
    | "%";
  left: Expression;
  right: Expression;
}

export interface LogicalExpression {
  kind: "logical";
  operator: "&&" | "||" | "??";
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  kind: "unary";
  operator: "!" | "-" | "typeof";
  operand: Expression;
}

export interface MemberExpression {
  kind: "member";
  object: Expression;
  property: string;
}

export interface CallExpression {
  kind: "call";
  object: Expression;
  method: string;
  args: Expression[];
}

export interface LiteralExpression {
  kind: "literal";
  value: string | number | boolean | null | undefined;
}

export interface ParameterExpression {
  kind: "parameter";
  name: string;
}

export interface ObjectExpression {
  kind: "object";
  properties: { key: string; value: Expression }[];
}

export interface PropertyExpression {
  kind: "property";
  key: string;
  value: Expression;
}

export interface ConditionalExpression {
  kind: "conditional";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface ArrayExpression {
  kind: "array";
  elements: Expression[];
}

export interface TemplateLiteralExpression {
  kind: "template";
  parts: Expression[];
}

export type OperationType =
  | "where"
  | "orderBy"
  | "orderByDescending"
  | "select"
  | "take"
  | "skip";

export interface Operation {
  type: OperationType;
  expression?: LambdaExpression;
  value?: number;
}
