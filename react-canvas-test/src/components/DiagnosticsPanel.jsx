export function DiagnosticsPanel({ diagnostics, isOpen, onToggle }) {
  return (
    <section className="panelSection">
      <button
        className="advancedToggle"
        type="button"
        onClick={onToggle}
      >
        {isOpen ? "Hide diagnostics" : "Show diagnostics"}
      </button>

      {isOpen ? (
        <div className="diagnostics">
          {diagnostics.length > 0 ? (
            <ul>
              {diagnostics.map((item) => (
                <li key={item.id}>
                  <span>{item.time}</span>
                  <strong>{item.name}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No diagnostics yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

