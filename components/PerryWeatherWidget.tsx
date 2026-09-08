type PerryWeatherWidgetProps = {
  variant?: "operations" | "starter";
};

const PERRY_WEATHER_URL =
  "https://widget.perryweather.com/?id=b4ee4007-9210-4981-a1c3-0cf79e1af209";

export default function PerryWeatherWidget({
  variant = "operations",
}: PerryWeatherWidgetProps) {
  const isStarter =
    variant === "starter";

  return (
    <section
      className={[
        "overflow-hidden border border-[var(--golfops-border)] bg-[var(--golfops-surface)] shadow-sm",
        isStarter
          ? "flex h-full min-h-0 flex-col rounded-xl"
          : "rounded-xl",
      ].join(" ")}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--golfops-border)] px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--golfops-accent)]">
            Perry Weather
          </p>

          <h2
            className={[
              "font-bold text-[var(--golfops-text)]",
              isStarter
                ? "text-xl"
                : "text-2xl",
            ].join(" ")}
          >
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

      <div
        className={[
          "relative w-full bg-white",
          isStarter
            ? "min-h-0 flex-1"
            : "h-[460px] sm:h-[520px]",
        ].join(" ")}
      >
        <iframe
          src={PERRY_WEATHER_URL}
          title="TwinEagles Perry Weather"
          loading={isStarter ? "eager" : "lazy"}
          allow="geolocation"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </section>
  );
}