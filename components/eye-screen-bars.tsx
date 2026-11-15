import type { EyeScreen } from "@/lib/eye-screen/model";

export function EyeScreenBars({ screen }: { screen: EyeScreen }) {
  const percent = Math.round(screen.confidence * 100);
  return (
    <div className="eye-screen">
      <p>
        {screen.unclear
          ? `No clear match. Closest label: ${screen.label} (${percent}%).`
          : `Closest match: ${screen.label} (${percent}%).`}
      </p>
      <ol>
        {screen.probabilities.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <span className="screen-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(item.probability * 100)}%` }} />
            </span>
            <span>{Math.round(item.probability * 100)}%</span>
          </li>
        ))}
      </ol>
      <p className="camera-note">{screen.disclaimer}</p>
    </div>
  );
}
