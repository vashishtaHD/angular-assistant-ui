// Original angular-assistant-ui demo tool UI (no code copied). Its non-result states render the kit port of
// packages/ui/src/components/react/assistant-ui/elements/tool-fallback.aui.tsx @ 7d74276.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ToolUIComponent, ToolUIProps } from 'angular-assistant-ui';
import { AuiToolFallbackComponent } from 'angular-assistant-ui/ui';

/** The `getWeather` tool output (see mastra-server/src/mastra/tools). */
interface WeatherOutput {
  city: string;
  temperatureC: number;
  condition: string;
}

const isWeatherOutput = (value: unknown): value is WeatherOutput =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as WeatherOutput).temperatureC === 'number';

/**
 * Renders a `getWeather` tool call; registered with `registerToolUI`. Once the result arrives it
 * shows a weather card. Until then (running, failed or cancelled) it shows the kit's tool
 * fallback, which already renders those states.
 */
@Component({
  selector: 'aui-demo-weather-card',
  standalone: true,
  imports: [AuiToolFallbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (weather(); as w) {
      <div
        data-testid="weather-card"
        class="my-2 flex w-64 items-center gap-4 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 text-slate-800 shadow-sm dark:border-sky-900 dark:from-sky-950 dark:to-zinc-900 dark:text-zinc-100"
      >
        <div class="text-3xl font-semibold tabular-nums">{{ w.temperatureC }}°C</div>
        <div class="min-w-0">
          <div class="truncate font-medium">{{ w.city }}</div>
          <div class="text-sm capitalize text-slate-500 dark:text-zinc-400">{{ w.condition }}</div>
        </div>
      </div>
    } @else {
      <aui-tool-fallback />
    }
  `,
})
export class WeatherCardComponent implements ToolUIComponent {
  /** The tool-call part and its callbacks. */
  readonly tool = input.required<ToolUIProps>();

  /** The tool result, once available. */
  protected readonly weather = computed(() => {
    const result = this.tool().part.result;
    return isWeatherOutput(result) && !this.tool().part.isError ? result : null;
  });
}
