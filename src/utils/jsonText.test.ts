import { compactJSONText, formatJSONText } from "@utils/jsonText";
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
});
