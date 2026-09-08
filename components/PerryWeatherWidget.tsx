type PerryWeatherWidgetProps = {
  variant?: "operations" | "starter";
};

const PERRY_WEATHER_URL =
  "https://widget.perryweather.com/?id=b4ee4007-9210-4981-a1c3-0cf79e1af209";

export default function PerryWeatherWidget({
  variant = "operations",
}: PerryWeatherWidgetProps) {
  if (variant === "operations") {
    return (
      <a
        href={PERRY_WEATHER_URL}
        target="_blank"
        rel="noreferrer"
        className="group block h-full overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-card,var(--golfops-surface))] p-4 shadow-[var(--golfops-shadow)] transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--golfops-text-muted)]">
            Perry Weather
          </div>

          <span className="text-xs font-bold text-[var(--golfops-accent-text)]">
            Open ↗
          </span>
        </div>

        <div className="relative mt-2 h-[88px] overflow-hidden rounded-lg bg-white">
          <iframe
            src={PERRY_WEATHER_URL}
            title="TwinEagles Perry Weather summary"
            loading="lazy"
            allow="geolocation"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-[520px] w-[1200px] origin-top-left scale-[0.23] border-0 bg-white"
          />
        </div>
      </a>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--golfops-border)] px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent)]">
            Perry Weather
          </p>

          <h2 className="text-xl font-bold text-[var(--golfops-text)]">
            Today&apos;s Weather
          </h2>
        </div>

        <a
          href={PERRY_WEATHER_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-[var(--golfops-border)] px-3 py-2 text-xs font-semibold text-[var(--golfops-text-muted)] transition hover:bg-[var(--golfops-surface-soft)]"
        >
          Open Full Weather
        </a>
      </div>

      <div className="relative min-h-0 w-full flex-1 bg-white">
        <iframe
          src={PERRY_WEATHER_URL}
          title="TwinEagles Perry Weather"
          loading="eager"
          allow="geolocation"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </section>
  );
}
