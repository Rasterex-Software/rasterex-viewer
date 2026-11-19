/// <reference types="vite/client" />
import type {
  AnnotationImportScalePolicy,
  LoadAnnotationsOptions,
  RasterexViewer
} from "../../dist/index.js";
import { testUser } from "./test-user.js";
import countSampleXml from "./count-import-sample.rxml?raw";
import sampleXml from "./annotation-import-sample.rxml?raw";

const sampleJson = {
  operation: { created: true },
  Entity: {
    UniqueID: "6F339054-E593-45C0-9249-44E5E451E994",
    Type: 3,
    Subtype: 0,
    Alternative: 0,
    Layer: 5,
    Signature: testUser.username,
    Name: testUser.displayName,
    LineWidth: 3,
    Font: { Font: { facename: "Helvetica", height: 16, bold: 0, italic: 0 } },
    Scaling: 1,
    LoadScaling: 1,
    DocScale: 1,
    FileName: "annotation-import-sample.pdf",
    View: 0,
    ViewName: "Page 1",
    Rect: { x: 125, y: 160, w: 250, h: 245 },
    LineColor: "rgba(225,29,72,1)"
  }
};

async function stagePastedRxml(text: string, viewerUrl: string): Promise<string> {
  const viewerOrigin = new URL(viewerUrl);
  if (viewerOrigin.hostname !== "canvas.localhost") {
    throw new Error("Pasted RXML requires the local Canvas proxy. For other viewers, use an XML URL.");
  }
  const xml = text.trim();
  if (!xml || /<!DOCTYPE\b/i.test(xml)) {
    throw new Error("Paste a Rasterex XML export without a document type declaration.");
  }
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.documentElement.nodeName !== "RasterexMarkup" ||
      parsed.getElementsByTagName("parsererror").length ||
      !parsed.getElementsByTagName("Entity").length) {
    throw new Error("Paste valid Rasterex XML containing at least one annotation.");
  }

  const response = await fetch("/__rasterex-local/rxml", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error(`Could not prepare pasted RXML (HTTP ${response.status}). Restart the local parent if needed.`);
  }
  const { url } = await response.json();
  const localUrl = new URL(url);
  if (localUrl.origin !== viewerOrigin.origin) {
    throw new Error("Connect Canvas through the proxy started with this local parent.");
  }
  return localUrl.href;
}

interface PanelOptions {
  getViewer: () => RasterexViewer | undefined;
  run: (operation: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  log: (type: string, payload: unknown) => void;
}

export function createAnnotationImportPanel({
  getViewer,
  run,
  refresh,
  log
}: PanelOptions) {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const fieldset = element<HTMLFieldSetElement>("annotation-import-controls");
  const source = element<HTMLSelectElement>("annotation-import-source");
  const data = element<HTMLTextAreaElement>("annotation-import-data");
  const mode = element<HTMLSelectElement>("annotation-import-mode");
  const scale = element<HTMLSelectElement>("annotation-import-scale");
  const emitCreated = element<HTMLInputElement>("annotation-import-events");
  const confirm = element<HTMLInputElement>("annotation-import-confirm");
  const confirmLabel = element("annotation-import-confirm-label");
  const status = element("annotation-import-status");
  const result = element("annotation-import-result");
  const sample = element<HTMLButtonElement>("annotation-import-sample");

  function updateOptions() {
    const isJson = source.value === "json";
    mode.options[0].text = isJson
      ? "Merge (skip matching JSON GUIDs)"
      : "Merge (native XML loader)";
    mode.options[1].disabled = !isJson;
    mode.options[2].disabled = !isJson;
    if (mode.selectedOptions[0]?.disabled) {
      mode.value = "merge";
    }
    confirmLabel.hidden = mode.value !== "replaceAll";
    confirm.checked = false;
  }

  source.addEventListener("change", updateOptions);
  mode.addEventListener("change", updateOptions);

  sample.addEventListener("click", () => {
    if (source.value === "url") {
      const viewerUrl = getViewer()?.getInfo().viewerUrl;
      if (!viewerUrl || new URL(viewerUrl).hostname !== "canvas.localhost") {
        status.textContent = "Enter an XML URL reachable from the connected Canvas.";
        return;
      }
      data.value = new URL("/assets/exmaple-rxml.rxml", viewerUrl).href;
    } else {
      data.value = source.value === "xml" ? sampleXml : JSON.stringify(sampleJson, null, 2);
    }
    confirm.checked = false;
  });

  element("annotation-import-count-sample").addEventListener("click", () => {
    source.value = "xml";
    data.value = countSampleXml;
    updateOptions();
    status.textContent = "Editable Count sample loaded into the input. Choose Import annotations.";
  });

  element("annotation-import-snapshot").addEventListener("click", () => {
    void run(async () => {
      const viewer = getViewer();
      if (!viewer) {
        return;
      }
      const snapshot = await viewer.annotations.getData({ filter: "all" });
      source.value = "json";
      data.value = JSON.stringify({ items: snapshot.items }, null, 2);
      scale.value = "preserve";
      updateOptions();
      status.textContent = `Copied ${snapshot.items.length} records into the input.`;
    });
  });

  element("annotation-import-run").addEventListener("click", () => {
    void run(async () => {
      const viewer = getViewer();
      if (!viewer) {
        return;
      }
      status.textContent = "Importing…";
      result.textContent = "";
      try {
        if (mode.value === "replaceAll" && !confirm.checked) {
          throw new Error("Confirm that the existing test annotations can be cleared.");
        }
        confirm.checked = false;
        const common = {
          data: data.value,
          mode:
            mode.value === "replaceAll" ? ("replaceAll" as const) : ("merge" as const),
          measurementScalePolicy: scale.value as AnnotationImportScalePolicy,
          emitCreated: emitCreated.checked,
          timeoutMs: 20_000
        };
        let options: LoadAnnotationsOptions;
        if (source.value === "url") {
          options = { ...common, format: "xml", source: "url", mode: "merge" };
        } else if (source.value === "xml") {
          const dataUrl = await stagePastedRxml(common.data, viewer.getInfo().viewerUrl);
          options = { ...common, data: dataUrl, format: "xml", source: "url", mode: "merge" };
        } else {
          options = {
            ...common,
            format: "json",
            replacePolicy: mode.value === "replace" ? "replace" : "skip"
          };
        }

        const receipt = await viewer.annotations.load(options);
        status.textContent =
          "Canvas reported the following counts. Check the refreshed annotation list.";
        result.textContent = JSON.stringify(receipt, null, 2);
        log("annotationsLoaded", receipt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent =
          error instanceof Error && "code" in error && error.code === "COMMAND_TIMEOUT"
            ? "Canvas did not reply. Check the annotation list, then reconnect before importing again."
            : message;
        log("annotationImport.error", { message });
        return;
      }

      try {
        await refresh();
      } catch {
        status.textContent =
          "Canvas returned import counts. Use Refresh annotations to check the records.";
      }
    });
  });

  updateOptions();
  return {
    controls(disabled: boolean) {
      fieldset.disabled = disabled;
    },
    resetResult() {
      result.textContent = "";
      status.textContent = "Use sample data or provide your own annotations.";
      confirm.checked = false;
    }
  };
}
