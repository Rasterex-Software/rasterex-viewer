export function DocumentOpenPanel({
  documentUrl,
  isBusy,
  isReady,
  onDocumentUrlChange,
  onOpenDocument
}) {
  return (
    <section className="panelSection">
      <div className="sectionHeader">
        <span>Open document</span>
        <strong>{isReady ? "Available" : "Waiting for viewer"}</strong>
      </div>

      <label className="field" htmlFor="document-url">
        <span>Document URL or path</span>
        <input
          id="document-url"
          value={documentUrl}
          onChange={(event) => onDocumentUrlChange(event.target.value)}
          placeholder="/documents/sample.pdf"
        />
      </label>

      <button
        className="primaryButton"
        type="button"
        disabled={!isReady || !documentUrl.trim() || isBusy}
        onClick={onOpenDocument}
      >
        Open in viewer
      </button>
    </section>
  );
}

