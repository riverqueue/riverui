const JSON_TEXT_NUMBER = Symbol("JSONTextNumber");
const MAX_JSON_NESTING_DEPTH = 100;
const MAX_PRETTY_PRINT_LENGTH = 1_048_576;
const MAX_PRETTY_PRINT_EXTRA_LENGTH = 16_384;
const MAX_PRETTY_PRINT_EXPANSION = 4;

export type JSONTextNumber = {
  readonly [JSON_TEXT_NUMBER]: true;
  readonly raw: string;
};

export type JSONTextValue =
  | { [key: string]: JSONTextValue }
  | boolean
  | JSONTextNumber
  | JSONTextValue[]
  | null
  | string;

export type PreparedJSONText = {
  copyText: string;
  value: JSONTextValue;
};

type JSONTextNode =
  | { entries: JSONTextObjectEntry[]; kind: "object" }
  | { kind: "array"; values: JSONTextNode[] }
  | { kind: "literal"; value: "false" | "null" | "true" }
  | { kind: "number"; raw: string }
  | { kind: "string"; value: string };

type JSONTextObjectEntry = {
  key: string;
  value: JSONTextNode;
};

class BoundedStringBuilder {
  private length = 0;
  private readonly parts: string[] = [];

  constructor(private readonly maxLength: number) {}

  append(value: string): boolean {
    if (this.length + value.length > this.maxLength) return false;

    this.length += value.length;
    this.parts.push(value);
    return true;
  }

  toString(): string {
    return this.parts.join("");
  }
}

class JSONTextParser {
  private position = 0;

  constructor(private readonly text: string) {}

  parse(): JSONTextNode | undefined {
    try {
      const value = this.parseValue();
      this.skipWhitespace();
      return this.position === this.text.length ? value : undefined;
    } catch {
      return undefined;
    }
  }

  private expect(char: string) {
    if (this.text[this.position] !== char) {
      throw new Error(`expected ${char}`);
    }
    this.position += 1;
  }

  private parseArray(depth: number): JSONTextNode {
    this.expect("[");
    this.skipWhitespace();

    const values: JSONTextNode[] = [];
    if (this.text[this.position] === "]") {
      this.position += 1;
      return { kind: "array", values };
    }

    while (true) {
      values.push(this.parseValue(depth + 1));
      this.skipWhitespace();

      if (this.text[this.position] === "]") {
        this.position += 1;
        return { kind: "array", values };
      }

      this.expect(",");
      this.skipWhitespace();
    }
  }

  private parseLiteral(literal: "false" | "null" | "true"): JSONTextNode {
    if (!this.text.startsWith(literal, this.position)) {
      throw new Error(`expected ${literal}`);
    }

    this.position += literal.length;
    return { kind: "literal", value: literal };
  }

  private parseNumber(): JSONTextNode {
    const start = this.position;

    if (this.text[this.position] === "-") {
      this.position += 1;
    }

    if (this.text[this.position] === "0") {
      this.position += 1;
    } else if (isDigitOneToNine(this.text[this.position])) {
      this.position += 1;
      while (isDigit(this.text[this.position])) {
        this.position += 1;
      }
    } else {
      throw new Error("expected number");
    }

    if (this.text[this.position] === ".") {
      this.position += 1;
      if (!isDigit(this.text[this.position])) {
        throw new Error("expected fractional digit");
      }
      while (isDigit(this.text[this.position])) {
        this.position += 1;
      }
    }

    if (this.text[this.position] === "e" || this.text[this.position] === "E") {
      this.position += 1;
      if (
        this.text[this.position] === "+" ||
        this.text[this.position] === "-"
      ) {
        this.position += 1;
      }
      if (!isDigit(this.text[this.position])) {
        throw new Error("expected exponent digit");
      }
      while (isDigit(this.text[this.position])) {
        this.position += 1;
      }
    }

    return { kind: "number", raw: this.text.slice(start, this.position) };
  }

  private parseObject(depth: number): JSONTextNode {
    this.expect("{");
    this.skipWhitespace();

    const entries: JSONTextObjectEntry[] = [];
    if (this.text[this.position] === "}") {
      this.position += 1;
      return { entries, kind: "object" };
    }

    while (true) {
      const key = this.parseStringValue();
      this.skipWhitespace();
      this.expect(":");
      const value = this.parseValue(depth + 1);
      entries.push({ key, value });
      this.skipWhitespace();

      if (this.text[this.position] === "}") {
        this.position += 1;
        return { entries, kind: "object" };
      }

      this.expect(",");
      this.skipWhitespace();
    }
  }

  private parseString(): JSONTextNode {
    return { kind: "string", value: this.parseStringValue() };
  }

  private parseStringValue(): string {
    const start = this.position;
    this.expect('"');

    while (this.position < this.text.length) {
      const char = this.text[this.position];
      if (char === '"') {
        this.position += 1;
        const parsed = JSON.parse(this.text.slice(start, this.position));
        if (typeof parsed !== "string") {
          throw new Error("expected string");
        }
        return parsed;
      }

      if (char === "\\") {
        this.position += 2;
      } else {
        this.position += 1;
      }
    }

    throw new Error("unterminated string");
  }

  private parseValue(depth = 0): JSONTextNode {
    if (depth > MAX_JSON_NESTING_DEPTH) {
      throw new Error("maximum JSON nesting depth exceeded");
    }

    this.skipWhitespace();

    const char = this.text[this.position];
    if (char === "{") return this.parseObject(depth);
    if (char === "[") return this.parseArray(depth);
    if (char === '"') return this.parseString();
    if (char === "t") return this.parseLiteral("true");
    if (char === "f") return this.parseLiteral("false");
    if (char === "n") return this.parseLiteral("null");
    return this.parseNumber();
  }

  private skipWhitespace() {
    while (/[\t\n\r ]/.test(this.text[this.position] ?? "")) {
      this.position += 1;
    }
  }
}

export function compactJSONText(text: string): string {
  const parsed = parseJSONText(text);
  if (!parsed) return text;

  try {
    return stringifyCompact(parsed);
  } catch {
    return text;
  }
}

export function formatJSONText(text: string): string {
  const parsed = parseJSONText(text);
  if (!parsed) return text;

  try {
    return stringifyForDisplay(parsed, text.length);
  } catch {
    return text;
  }
}

export function isJSONTextNumber(value: unknown): value is JSONTextNumber {
  return (
    typeof value === "object" && value !== null && JSON_TEXT_NUMBER in value
  );
}

export function prepareJSONText(text: string): PreparedJSONText | undefined {
  const parsed = parseJSONText(text);
  if (!parsed) return undefined;

  try {
    return {
      copyText: stringifyForDisplay(parsed, text.length),
      value: nodeToValue(parsed),
    };
  } catch {
    return undefined;
  }
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isDigitOneToNine(char: string | undefined): boolean {
  return char !== undefined && char >= "1" && char <= "9";
}

function nodeToValue(node: JSONTextNode): JSONTextValue {
  switch (node.kind) {
    case "array":
      return node.values.map(nodeToValue);
    case "literal":
      if (node.value === "null") return null;
      return node.value === "true";
    case "number":
      return { [JSON_TEXT_NUMBER]: true, raw: node.raw };
    case "object": {
      const value = Object.create(null) as { [key: string]: JSONTextValue };
      for (const entry of node.entries) {
        Object.defineProperty(value, entry.key, {
          configurable: true,
          enumerable: true,
          value: nodeToValue(entry.value),
          writable: true,
        });
      }
      return value;
    }
    case "string":
      return node.value;
  }
}

function parseJSONText(text: string): JSONTextNode | undefined {
  const parser = new JSONTextParser(text);
  return parser.parse();
}

function sortableArrayIndex(key: string): number | undefined {
  const index = Number(key);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 2 ** 32 - 1 ||
    String(index) !== key
  ) {
    return undefined;
  }

  return index;
}

function sortedEntries(entries: JSONTextObjectEntry[]): JSONTextObjectEntry[] {
  return [...entries].sort((left, right) => {
    const leftIndex = sortableArrayIndex(left.key);
    const rightIndex = sortableArrayIndex(right.key);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.key.localeCompare(right.key);
  });
}

function stringifyCompact(node: JSONTextNode): string {
  switch (node.kind) {
    case "array":
      return `[${node.values.map(stringifyCompact).join(",")}]`;
    case "literal":
      return node.value;
    case "number":
      return node.raw;
    case "object":
      return `{${sortedEntries(node.entries)
        .map(
          (entry) =>
            `${JSON.stringify(entry.key)}:${stringifyCompact(entry.value)}`,
        )
        .join(",")}}`;
    case "string":
      return JSON.stringify(node.value);
  }
}

function stringifyForDisplay(node: JSONTextNode, sourceLength: number): string {
  const maxLength = Math.min(
    MAX_PRETTY_PRINT_LENGTH,
    Math.max(
      sourceLength * MAX_PRETTY_PRINT_EXPANSION,
      sourceLength + MAX_PRETTY_PRINT_EXTRA_LENGTH,
    ),
  );
  const pretty = stringifyPrettyWithinLimit(node, maxLength);

  return pretty ?? stringifyCompact(node);
}

function stringifyPrettyWithinLimit(
  node: JSONTextNode,
  maxLength: number,
): string | undefined {
  const builder = new BoundedStringBuilder(maxLength);
  return writePretty(node, 0, builder) ? builder.toString() : undefined;
}

function writePretty(
  node: JSONTextNode,
  depth: number,
  builder: BoundedStringBuilder,
): boolean {
  const indent = "  ";
  const currentIndent = indent.repeat(depth);
  const childIndent = indent.repeat(depth + 1);

  switch (node.kind) {
    case "array": {
      if (node.values.length === 0) return builder.append("[]");
      if (!builder.append("[\n")) return false;
      for (const [index, value] of node.values.entries()) {
        if (index > 0 && !builder.append(",\n")) return false;
        if (!builder.append(childIndent)) return false;
        if (!writePretty(value, depth + 1, builder)) return false;
      }
      return builder.append(`\n${currentIndent}]`);
    }
    case "literal":
      return builder.append(node.value);
    case "number":
      return builder.append(node.raw);
    case "object": {
      if (node.entries.length === 0) return builder.append("{}");
      if (!builder.append("{\n")) return false;
      for (const [index, entry] of sortedEntries(node.entries).entries()) {
        if (index > 0 && !builder.append(",\n")) return false;
        if (!builder.append(childIndent)) return false;
        if (!builder.append(`${JSON.stringify(entry.key)}: `)) return false;
        if (!writePretty(entry.value, depth + 1, builder)) return false;
      }
      return builder.append(`\n${currentIndent}}`);
    }
    case "string":
      return builder.append(JSON.stringify(node.value));
  }
}
