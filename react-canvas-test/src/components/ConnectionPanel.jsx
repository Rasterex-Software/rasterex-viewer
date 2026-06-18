import { CANVAS_URL } from "../viewer/viewerConfig.js";

export function ConnectionPanel({ info, onRefresh }) {
  const connectionRows = [
    ["Viewer state", info?.state ?? "not started"],
    [
      "Integration mode",
      info?.compatibility?.state === "degraded"
        ? "Current Canvas broker"
        : "Protocol ready"
    ],
    ["Canvas origin", info?.targetOrigin ?? CANVAS_URL],
    ["Canvas version", info?.canvasVersion ?? "not reported"]
  ];

  return (
    <section className="panelSection">
      <div className="sectionHeader">
        <span>Connection</span>
        <button type="button" className="linkButton" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="infoList">
        {connectionRows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

