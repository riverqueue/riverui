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

  private parseArray(): JSONTextNode {
    this.expect("[");
    this.skipWhitespace();

    const values: JSONTextNode[] = [];
    if (this.text[this.position] === "]") {
      this.position += 1;
      return { kind: "array", values };
    }

    while (true) {
      values.push(this.parseValue());
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

  private parseObject(): JSONTextNode {
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
      const value = this.parseValue();
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

  private parseValue(): JSONTextNode {
    this.skipWhitespace();

    const char = this.text[this.position];
    if (char === "{") return this.parseObject();
    if (char === "[") return this.parseArray();
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
  return parsed ? stringifyCompact(parsed) : text;
}

export function formatJSONText(text: string): string {
  const parsed = parseJSONText(text);
  return parsed ? stringifyPretty(parsed, 0) : text;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isDigitOneToNine(char: string | undefined): boolean {
  return char !== undefined && char >= "1" && char <= "9";
}

function parseJSONText(text: string): JSONTextNode | undefined {
  const parser = new JSONTextParser(text);
  return parser.parse();
}

function sortedEntries(entries: JSONTextObjectEntry[]): JSONTextObjectEntry[] {
  return [...entries].sort((left, right) => left.key.localeCompare(right.key));
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

function stringifyPretty(node: JSONTextNode, depth: number): string {
  const indent = "  ";
  const currentIndent = indent.repeat(depth);
  const childIndent = indent.repeat(depth + 1);

  switch (node.kind) {
    case "array":
      if (node.values.length === 0) return "[]";
      return `[\n${node.values
        .map((value) => `${childIndent}${stringifyPretty(value, depth + 1)}`)
        .join(",\n")}\n${currentIndent}]`;
    case "literal":
      return node.value;
    case "number":
      return node.raw;
    case "object":
      if (node.entries.length === 0) return "{}";
      return `{\n${sortedEntries(node.entries)
        .map(
          (entry) =>
            `${childIndent}${JSON.stringify(entry.key)}: ${stringifyPretty(
              entry.value,
              depth + 1,
            )}`,
        )
        .join(",\n")}\n${currentIndent}}`;
    case "string":
      return JSON.stringify(node.value);
  }
}
