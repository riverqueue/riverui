import {
  compactJSONText,
  formatJSONText,
  prepareJSONText,
} from "@utils/jsonText";
import { describe, expect, it } from "vitest";

describe("jsonText", () => {
  it("sorts object keys without parsing large number tokens", () => {
    const rawJSON =
      '{"z":2,"id":1970670598291982290,"nested":{"b":9223372036854775807,"a":1}}';

    expect(compactJSONText(rawJSON)).toBe(
      '{"id":1970670598291982290,"nested":{"a":1,"b":9223372036854775807},"z":2}',
    );
  });

  it("pretty-prints sorted JSON without rounding numbers", () => {
    const rawJSON = '{"z":2,"id":1970670598291982290,"a":1}';

    expect(formatJSONText(rawJSON)).toBe(`{
  "a": 1,
  "id": 1970670598291982290,
  "z": 2
}`);
  });

  it("falls back to original text when args are not valid JSON", () => {
    expect(formatJSONText("{not valid")).toBe("{not valid");
  });

  it("handles arrays, literals, strings, and every JSON number form", () => {
    const rawJSON =
      '[true,false,null,-0,-12,0.25,1.25e+30,"line\\n\\u263a",{},[]]';

    expect(compactJSONText(rawJSON)).toBe(
      '[true,false,null,-0,-12,0.25,1.25e+30,"line\\n☺",{},[]]',
    );
    expect(JSON.parse(formatJSONText(rawJSON))).toEqual(JSON.parse(rawJSON));
  });

  it("sorts nested objects and preserves escaped keys", () => {
    const rawJSON = String.raw`{"z":0,"a\"key":"value","array":[{"b":2,"a":1}]}`;

    expect(compactJSONText(rawJSON)).toBe(
      String.raw`{"a\"key":"value","array":[{"a":1,"b":2}],"z":0}`,
    );
  });

  it.each(["", "[1,]", '{"a":}', "01", '"unterminated', "true false"])(
    "returns malformed input unchanged: %j",
    (rawJSON) => {
      expect(compactJSONText(rawJSON)).toBe(rawJSON);
      expect(formatJSONText(rawJSON)).toBe(rawJSON);
      expect(prepareJSONText(rawJSON)).toBeUndefined();
    },
  );

  it("falls back safely when valid JSON exceeds the nesting limit", () => {
    const rawJSON = `${"[".repeat(5_000)}0${"]".repeat(5_000)}`;

    expect(compactJSONText(rawJSON)).toBe(rawJSON);
    expect(formatJSONText(rawJSON)).toBe(rawJSON);
    expect(prepareJSONText(rawJSON)).toBeUndefined();
  });

  it("uses compact sorted output when indentation expands excessively", () => {
    const rawJSON = `${"[".repeat(99)}{"z":2,"a":1}${"]".repeat(99)}`;
    const expected = `${"[".repeat(99)}{"a":1,"z":2}${"]".repeat(99)}`;

    expect(formatJSONText(rawJSON)).toBe(expected);
  });
});
