import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const conditions = ["sunny", "cloudy", "rainy"] as const;

export type WeatherData = {
  city: string;
  temperatureC: number;
  condition: (typeof conditions)[number];
};

/** FNV-1a 32-bit hash. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Deterministic fake weather derived from a hash of the lowercased city. */
export function getWeatherData(city: string): WeatherData {
  const h = hash(city.toLowerCase());
  return {
    city,
    temperatureC: (h % 46) - 10, // integer in [-10, 35]
    condition: conditions[Math.floor(h / 46) % conditions.length]!,
  };
}

export const getWeather = createTool({
  id: "getWeather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().describe("City name") }),
  outputSchema: z.object({
    city: z.string(),
    temperatureC: z.number(),
    condition: z.enum(conditions),
  }),
  execute: async ({ city }) => getWeatherData(city),
});
