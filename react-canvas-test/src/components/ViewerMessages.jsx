export function ViewerMessages({ error, openResult }) {
  return (
    <>
      {error ? (
        <section className="message errorMessage" aria-live="polite">
          <strong>{error.code}</strong>
          <span>{error.message}</span>
        </section>
      ) : null}

      {openResult ? (
        <section className="message successMessage">
          <strong>Document is active</strong>
          <span>{openResult.activeId ?? "The viewer reported file metadata."}</span>
        </section>
      ) : null}
    </>
  );
}

