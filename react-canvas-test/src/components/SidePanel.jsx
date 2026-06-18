import { ConnectionPanel } from "./ConnectionPanel.jsx";
import { DiagnosticsPanel } from "./DiagnosticsPanel.jsx";
import { DocumentOpenPanel } from "./DocumentOpenPanel.jsx";
import { ViewerMessages } from "./ViewerMessages.jsx";

export function SidePanel({
  diagnostics,
  documentUrl,
  error,
  info,
  isBusy,
  isReady,
  openResult,
  showDiagnostics,
  onDocumentUrlChange,
  onOpenDocument,
  onRefreshInfo,
  onToggleDiagnostics
}) {
  return (
    <aside className="sidePanel" aria-label="Document controls">
      <DocumentOpenPanel
        documentUrl={documentUrl}
        isBusy={isBusy}
        isReady={isReady}
        onDocumentUrlChange={onDocumentUrlChange}
        onOpenDocument={onOpenDocument}
      />

      <ViewerMessages error={error} openResult={openResult} />

      <ConnectionPanel info={info} onRefresh={onRefreshInfo} />

      <DiagnosticsPanel
        diagnostics={diagnostics}
        isOpen={showDiagnostics}
        onToggle={onToggleDiagnostics}
      />
    </aside>
  );
}

