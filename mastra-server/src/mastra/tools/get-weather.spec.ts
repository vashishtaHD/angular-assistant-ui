import { describe, expect, it } from "vitest";
import { getWeatherData } from "./get-weather";

describe("getWeather", () => {
  it("returns deterministic output for a city", () => {
    const a = getWeatherData("Paris");
    const b = getWeatherData("Paris");
    expect(a).toEqual(b);
    expect(a.city).toBe("Paris");
    expect(Number.isInteger(a.temperatureC)).toBe(true);
    expect(a.temperatureC).toBeGreaterThanOrEqual(-10);
    expect(a.temperatureC).toBeLessThanOrEqual(35);
    expect(["sunny", "cloudy", "rainy"]).toContain(a.condition);
  });

  it("ignores case when deriving values", () => {
    const a = getWeatherData("PARIS");
    const b = getWeatherData("paris");
    expect(a.temperatureC).toBe(b.temperatureC);
    expect(a.condition).toBe(b.condition);
  });
});
