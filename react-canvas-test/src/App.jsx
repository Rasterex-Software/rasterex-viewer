import { useCallback, useState } from "react";
import { SidePanel } from "./components/SidePanel.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { ViewerCanvas } from "./components/ViewerCanvas.jsx";
import { DEFAULT_DOCUMENT_URL } from "./viewer/viewerConfig.js";
import { useRasterexViewer } from "./viewer/useRasterexViewer.js";
import { VIEWER_STATUS } from "./viewer/viewerStatus.js";
import "./App.css";

function App() {
  const [documentUrl, setDocumentUrl] = useState(DEFAULT_DOCUMENT_URL);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const {
    containerRef,
    diagnostics,
    error,
    info,
    isBusy,
    isReady,
    mountViewer,
    openDocument,
    openResult,
    refreshInfo,
    status,
    stopViewer
  } = useRasterexViewer();

  const handleOpenDocument = useCallback(() => {
    openDocument(documentUrl);
  }, [documentUrl, openDocument]);

  return (
    <main className="workspace">
      <TopBar
        status={status}
        hasError={status === VIEWER_STATUS.error}
        isBusy={isBusy}
        onReload={mountViewer}
        onStop={stopViewer}
      />

      <section className="content">
        <ViewerCanvas
          containerRef={containerRef}
          isReady={isReady}
          status={status}
        />

        <SidePanel
          diagnostics={diagnostics}
          documentUrl={documentUrl}
          error={error}
          info={info}
          isBusy={isBusy}
          isReady={isReady}
          openResult={openResult}
          showDiagnostics={showDiagnostics}
          onDocumentUrlChange={setDocumentUrl}
          onOpenDocument={handleOpenDocument}
          onRefreshInfo={refreshInfo}
          onToggleDiagnostics={() => {
            setShowDiagnostics((value) => !value);
          }}
        />
      </section>
    </main>
  );
}

export default App;
