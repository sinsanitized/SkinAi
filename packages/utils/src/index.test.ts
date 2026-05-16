import { describe, expect, it } from "vitest";
import * as utils from "./index";

describe("utils package exports", () => {
  it("exposes a stable empty surface until utilities are added", () => {
    expect(Object.keys(utils)).toEqual([]);
  });
});
