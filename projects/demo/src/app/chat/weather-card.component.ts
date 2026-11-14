import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { injectAuiState, type ToolUIComponent, type ToolUIProps } from 'angular-assistant-ui';

/** The `getWeather` tool input (see mastra-server/src/mastra/tools). */
interface WeatherInput {
  city?: string;
}

/** The `getWeather` tool output. */
interface WeatherOutput {
  city: string;
  temperatureC: number;
  condition: string;
}

const isWeatherOutput = (value: unknown): value is WeatherOutput =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as WeatherOutput).temperatureC === 'number';

/** What the card shows: a spinner while waiting, the result, or why there is none. */
type WeatherCardState = 'loading' | 'done' | 'error' | 'cancelled';

/** Renders a `getWeather` tool call; registered with `registerToolUI`. */
@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="weather-card"
      [attr.data-state]="state()"
      class="my-2 flex w-64 items-center gap-4 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 text-slate-800 shadow-sm"
    >
      @if (weather(); as w) {
        <div class="text-3xl font-semibold tabular-nums">{{ w.temperatureC }}°C</div>
        <div class="min-w-0">
          <div class="truncate font-medium">{{ w.city }}</div>
          <div class="text-sm capitalize text-slate-500">{{ w.condition }}</div>
        </div>
      } @else if (state() === 'error') {
        <div class="text-sm text-red-600">
          The weather lookup for <span class="font-medium">{{ city() }}</span> failed.
        </div>
      } @else if (state() === 'cancelled') {
        <div class="text-sm text-slate-500">
          Weather lookup for <span class="font-medium">{{ city() }}</span> was cancelled.
        </div>
      } @else {
        <div
          class="size-6 animate-spin rounded-full border-2 border-sky-300 border-t-transparent"
          aria-hidden="true"
        ></div>
        <div class="text-sm text-slate-500">
          Checking the weather in <span class="font-medium text-slate-700">{{ city() }}</span>…
        </div>
      }
    </div>
  `,
})
export class WeatherCardComponent implements ToolUIComponent {
  /** The tool-call part and its callbacks. */
  readonly tool = input.required<ToolUIProps>();

  /** The requested city (known before the result arrives). */
  protected readonly city = computed(
    () => (this.tool().part.args as WeatherInput | undefined)?.city ?? '…',
  );

  /** The tool result, once available. */
  protected readonly weather = computed(() => {
    const result = this.tool().part.result;
    return isWeatherOutput(result) ? result : null;
  });

  private readonly threadRunning = injectAuiState((s) => s.thread.isRunning);

  /**
   * The card state. A tool error (`isError`, or an incomplete part that was not
   * cancelled) stops the spinner, and so does the run ending (for example the
   * Stop button) before a result arrived.
   */
  protected readonly state = computed<WeatherCardState>(() => {
    const part = this.tool().part;
    if (this.weather()) return 'done';
    if (part.isError) return 'error';
    const status = part.status;
    if (status?.type === 'incomplete') {
      return status.reason === 'cancelled' ? 'cancelled' : 'error';
    }
    return this.threadRunning() ? 'loading' : 'cancelled';
  });
}
