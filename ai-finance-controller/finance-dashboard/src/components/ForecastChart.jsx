function formatShort(n) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
    return `${sign}₹${abs.toFixed(0)}`;
  }
  
  export default function ForecastChart({ currentBalance, forecast }) {
    const points = [
      { label: "Now", value: currentBalance },
      { label: "7D", value: forecast.forecast_7_day },
      { label: "14D", value: forecast.forecast_14_day },
      { label: "30D", value: forecast.forecast_30_day },
    ];
  
    const width = 560;
    const height = 180;
    const padX = 40;
    const padY = 24;
  
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    // Pad the range a bit so the line isn't glued to the top/bottom edge
    const yMin = min - range * 0.15;
    const yMax = max + range * 0.15;
    const yRange = yMax - yMin || 1;
  
    const stepX = (width - padX * 2) / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: padX + i * stepX,
      y: height - padY - ((p.value - yMin) / yRange) * (height - padY * 2),
      ...p,
    }));
  
    const linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
  
    const areaPath =
      linePath +
      ` L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY}` +
      ` L ${coords[0].x.toFixed(1)} ${height - padY} Z`;
  
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-blue)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
  
        {/* subtle horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={width - padX}
            y1={padY + f * (height - padY * 2)}
            y2={padY + f * (height - padY * 2)}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}
  
        <path d={areaPath} fill="url(#forecastFill)" />
        <path d={linePath} fill="none" stroke="var(--color-blue)" strokeWidth="2" strokeLinejoin="round" />
  
        {coords.map((c) => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r="4" fill="var(--color-bg)" stroke="var(--color-blue)" strokeWidth="2" />
            <text
              x={c.x}
              y={c.y - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-text)"
              fontFamily="monospace"
            >
              {formatShort(c.value)}
            </text>
            <text
              x={c.x}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-text-muted)"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  