export function TopBar({ status, hasError, isBusy, onReload, onStop }) {
  return (
    <header className="topBar">
      <div className="brandBlock">
        <span className="brandMark">R</span>
        <div>
          <h1>Rasterex Viewer</h1>
          <p>Embedded Canvas workspace</p>
        </div>
      </div>

      <div className="topActions">
        <span className={`statusBadge ${hasError ? "error" : ""}`}>
          {status}
        </span>
        <button type="button" onClick={onReload} disabled={isBusy}>
          Reload viewer
        </button>
        <button type="button" onClick={onStop}>
          Stop
        </button>
      </div>
    </header>
  );
}

