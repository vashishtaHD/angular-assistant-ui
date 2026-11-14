// Behavior of the re-implemented marker functions (ported from the stub-tool, external-tool,
// human-tool and provider-tool sources @ 7d7427653f6ba47b0b954510eed9c594d64e74d5).
import { describe, expect, it } from 'vitest';
import { externalTool, hitl, hitlTool, humanTool, providerTool, stubTool } from './markers';

describe('tool markers', () => {
  it('throw a message naming the marker when used outside a compiled module', () => {
    expect(() => stubTool()).toThrow(/stubTool\(\) has no runtime implementation/);
    expect(() => externalTool()).toThrow(/externalTool\(\) has no runtime implementation/);
    expect(() => humanTool()).toThrow(/humanTool\(\) has no runtime implementation/);
    expect(() => providerTool({ providerId: 'openai.web_search' } as never)).toThrow(
      /providerTool\(\) has no runtime implementation/,
    );
  });

  it('keeps the deprecated human tool aliases pointing at humanTool', () => {
    expect(hitl).toBe(humanTool);
    expect(hitlTool).toBe(humanTool);
  });
});
