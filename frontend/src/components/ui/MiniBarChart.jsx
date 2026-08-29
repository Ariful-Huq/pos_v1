export default function MiniBarChart({ data, height = 160 }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-ink-400 text-sm py-10">No data for this period.</div>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 20);
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={height - 20 - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              rx="1"
              className="fill-brand-500"
            />
          );
        })}
      </svg>
      <div className="flex text-xs text-ink-400 mt-1">
        {data.map((d, i) => (
          <div key={i} style={{ width: `${barWidth}%` }} className="text-center truncate">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
