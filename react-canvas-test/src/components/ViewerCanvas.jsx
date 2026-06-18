export function ViewerCanvas({ containerRef, isReady, status }) {
  return (
    <section className="viewerFrame" aria-label="Rasterex Canvas iframe">
      <div ref={containerRef} className="viewerSurface" />
      {!isReady ? (
        <div className="viewerOverlay">
          <strong>{status}</strong>
          <span>Connecting to Rasterex Canvas</span>
        </div>
      ) : null}
    </section>
  );
}

