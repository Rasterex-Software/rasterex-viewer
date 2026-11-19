import { testUser } from "./test-user.js";
import { createEditingCountPanel } from "./editing-count-panel.js";
import { createAnnotationImportPanel } from "./annotation-import-panel.js";
import { createMeasurementInspector } from "./measurement-inspector.js";
import { createViewer, SDK_VERSION } from "../../dist/index.js";
import type {
  RasterexViewer,
  ToolAction,
  ToolGroup,
  MeasurementAppearanceMode,
  AnnotationDataItem
} from "../../dist/index.js";

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const readyControls = element<HTMLFieldSetElement>("ready-controls");

const documentControls = element<HTMLFieldSetElement>("document-controls");

const appearance = element<HTMLSelectElement>("appearance");

const toolSelect = element<HTMLSelectElement>("tool");

const annotationSelect = element<HTMLSelectElement>("annotation");

const status = element("connection-status");

const docStatus = element("document-status");

const logOutput = element("log");

let viewer: RasterexViewer | undefined;

let mode: MeasurementAppearanceMode = "legacy";

let fileIndex = 0,
  pageIndex = 0,
  generation = 0;

let ready = false,
  documentReady = false,
  busy = false;

let activeTool = "";

let records: AnnotationDataItem[] = [];

let baseline: string | undefined;

const counts = { created: 0, selected: 0, deleted: 0 };

const lines: string[] = [];

const measurementInspector = createMeasurementInspector({
  context: () => ({ viewer, fileIndex, pageIndex, ready: ready && documentReady }),
  log
});

const annotationImportPanel = createAnnotationImportPanel({
  getViewer: () => viewer,
  run,
  refresh,
  log
});

const editingCountPanel = createEditingCountPanel({
  getViewer: () => viewer,
  getRecords: () => records,
  getSelectedGuid: () => annotationSelect.value,
  run,
  refresh,
  log
});
editingCountPanel.reset();

const tools: Array<[ToolAction, string, ToolGroup]> = [
  ["SHAPE_RECTANGLE", "Rectangle", "drawing"],
  ["SHAPE_ELLIPSE", "Ellipse", "drawing"],
  ["SHAPE_POLYGON", "Polygon", "drawing"],
  ["ARROW_SINGLE_END", "Arrow", "drawing"],
  ["TEXT", "Text", "annotation"],
  ["NOTE", "Note", "annotation"],
  ["MEASURE_LENGTH", "Length", "measurement"],
  ["MEASURE_AREA", "Area", "measurement"],
  ["MEASURE_PATH", "Path", "measurement"],
  ["MEASURE_RECTANGULAR_AREA", "Rectangular area", "measurement"],
  ["COUNT", "Count", "measurement"],
  ["SHAPE_RECTANGLE_ROUNDED", "Rounded rectangle", "drawing"],
  ["SHAPE_CLOUD", "Cloud", "drawing"],
  ["CALLOUT", "Callout", "annotation"],
  ["ARROW_FILLED_SINGLE_END", "Filled arrow", "drawing"],
  ["ARROW_BOTH_ENDS", "Double arrow", "drawing"],
  ["ARROW_FILLED_BOTH_ENDS", "Filled double arrow", "drawing"],
  ["PAINT_HIGHLIGHTER", "Highlighter", "drawing"],
  ["PAINT_FREEHAND", "Freehand", "drawing"],
  ["PAINT_POLYLINE", "Polyline", "drawing"],
  ["MEASURE_CONTINUOUS", "Continuous length", "measurement"],
  ["MEASURE_ARC", "Arc", "measurement"],
  ["MEASURE_ANGLE_CCLOCKWISE", "Angle", "measurement"],
  ["STAMP", "Stamp library", "annotation"],
  ["IMAGES_LIBRARY", "Image library", "annotation"],
  ["SYMBOLS_LIBRARY", "Symbol library", "annotation"],
  ["QR_CODE", "QR code", "annotation"],
  ["LINKS_LIBRARY", "Link library", "annotation"],
  ["PAINT_TEXT_HIGHLIGHTING", "PDF text highlight", "annotation"],
  ["MARKUP_LOCK", "Lock selection", "annotation"],
  ["ERASE", "Eraser", "annotation"]
];
for (const [action, label] of tools) {
  toolSelect.add(new Option(label, action));
}
for (const [action, label] of tools.slice(0, 11)) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.addEventListener("click", () => run(() => activate(action)));
  element("quick-tools").append(button);
}

function log(type: string, payload?: unknown) {
  const data = payload === undefined ? "" : JSON.stringify(payload);
  lines.push(
    `${new Date().toLocaleTimeString()} ${type} ${data.length > 1800 ? data.slice(0, 1800) + "…" : data}`
  );

  if (lines.length > 150) {
    lines.shift();
  }
  logOutput.textContent = lines.join("\n");
  logOutput.scrollTop = logOutput.scrollHeight;
}

function controls() {
  readyControls.disabled = busy || !ready;
  documentControls.disabled = busy || !documentReady;
  appearance.disabled =
    busy || !ready || !viewer?.getInfo().capabilities?.includes("measurementAppearance");
  element<HTMLButtonElement>("connect").disabled = busy;
  measurementInspector.controls(busy);
  annotationImportPanel.controls(busy || !documentReady);
  editingCountPanel.controls(busy || !documentReady);
}

async function run(operation: () => unknown | Promise<unknown>) {
  if (busy) {
    return;
  }
  busy = true;
  controls();
  status.classList.remove("error");

  try {
    await operation();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: status.textContent });
  } finally {
    busy = false;
    controls();
  }
}

function updateCounts() {
  element("counts").textContent =
    `${counts.created} created · ${counts.selected} selected · ${counts.deleted} deleted`;
}

function entity(item: AnnotationDataItem) {
  const value = (item.Entity ?? item.data ?? item) as Record<string, unknown>;

  return (value.Entity ?? value) as Record<string, unknown>;
}

function guid(item: AnnotationDataItem) {
  return String(entity(item).UniqueID ?? item.guid ?? "");
}

async function refresh() {
  if (!viewer || !documentReady) {
    return;
  }
  const selected = annotationSelect.value;
  records = (await viewer.annotations.getData({ filter: "all" })).items;
  annotationSelect.replaceChildren(new Option("Choose an annotation", ""));
  for (const item of records) {
    annotationSelect.add(
      new Option(`${item.Tool || "Annotation"} · ${guid(item).slice(0, 12)}`, guid(item))
    );
  }

  if (records.some((item) => guid(item) === selected)) {
    annotationSelect.value = selected;
  }
  editingCountPanel.setRecords(records);
  log("annotations.snapshot", { count: records.length });
}

function geometrySnapshot() {
  const fields = [
    "UniqueID",
    "Type",
    "Subtype",
    "Rect",
    "Points",
    "Line",
    "Holes",
    "Measurescale",
    "MeasureScale",
    "FixedScale",
    "FixedScaleFactor",
    "Rotation",
    "PageRotation",
    "LineColor",
    "FillColor",
    "TextColor",
    "Transparency",
    "LineWidth",
    "LineStyle",
    "Font"
  ];

  return JSON.stringify(
    records
      .map((item) =>
        Object.fromEntries(
          fields
            .filter((key) => key in entity(item))
            .map((key) => [key, entity(item)[key]])
        )
      )
      .sort((a, b) => String(a.UniqueID).localeCompare(String(b.UniqueID)))
  );
}

async function connect() {
  measurementInspector.reset();
  annotationImportPanel.resetResult();
  editingCountPanel.reset();
  const token = ++generation;
  viewer?.destroy();
  ready = false;
  documentReady = false;
  docStatus.textContent = "Open a test document after connecting.";
  baseline = undefined;
  mode = "legacy";
  appearance.value = mode;
  activeTool = "";
  records = [];
  annotationSelect.replaceChildren(new Option("None", ""));
  counts.created = counts.selected = counts.deleted = 0;
  updateCounts();
  const url = new URL(element<HTMLInputElement>("canvas-url").value);
  url.searchParams.set("parentOrigin", location.origin);
  url.searchParams.set("fileLoadTimeoutMs", "120000");
  viewer = createViewer({
    container: "#viewer",
    viewerUrl: url.href,
    readyTimeoutMs: 90000,
    commandTimeoutMs: 150000
  });
  const current = viewer;
  current.annotations.count.onFinished(() => {
    if (generation === token) {
      editingCountPanel.finished();
    }
  });
  current.documents.on("fileReady", (payload) => {
    if (generation !== token) {
      return;
    }
    measurementInspector.reset();
    fileIndex = payload.fileIndex ?? 0;
    pageIndex = 0;
    documentReady = true;
    annotationImportPanel.resetResult();
    editingCountPanel.reset();
    docStatus.textContent = `Document ready: ${payload.fileName ?? "file"} · file ${fileIndex}, page ${pageIndex + 1}`;
    log("fileReady", payload);
    controls();
  });
  current.documents.on("pageChanged", (payload) => {
    if (generation !== token) {
      return;
    }

    if (
      payload.currentPage !== pageIndex ||
      (payload.activeIndex !== undefined && payload.activeIndex !== fileIndex)
    ) {
      measurementInspector.reset();
    }

    if (payload.activeIndex !== undefined) {
      fileIndex = payload.activeIndex;
    }
    pageIndex = payload.currentPage;
    log("pageChanged", { pageIndex, pageCount: payload.pageCount });
  });
  current.documents.on("fileTabs", (payload) => {
    if (generation !== token) {
      return;
    }
    const active = payload.tabs.find((tab) => tab.id === payload.activeId);

    if (active?.index !== undefined && active.index !== fileIndex) {
      fileIndex = active.index;
      pageIndex = 0;
      baseline = undefined;
      measurementInspector.reset();
      annotationImportPanel.resetResult();
      editingCountPanel.reset();
    }
  });
  current.documents.on("fileLoadFailed", (payload) => {
    if (generation === token) {
      log("fileLoadFailed", payload);
    }
  });
  for (const name of ["created", "selected", "deleted"] as const) {
    current.annotations.on(name, (event) => {
      if (generation !== token) {
        return;
      }

      if (name === "selected") {
        measurementInspector.selectionChanged(event.guid);
      }

      if (name === "deleted") {
        measurementInspector.reset();
      }
      counts[name]++;
      updateCounts();
      log(`annotation.${name}`, event);

      if (name === "selected") {
        annotationSelect.value = event.guid;
        element("record").textContent = JSON.stringify(event, null, 2);
      }
    });
  }
  current.annotations.on("createdWithDetail", (event) => {
    if (generation === token) {
      log("annotation.createdWithDetail", event);
    }
  });
  status.textContent = "Waiting for Canvas and Foxit readiness…";
  await current.mount();
  await current.ready();

  if (generation !== token) {
    return;
  }
  ready = true;
  const user = await current.collaboration.setUser(testUser);

  if (!user.success) {
    throw new Error(user.reason || "Could not set the local test user");
  }
  status.textContent = `Ready · SDK ${SDK_VERSION} · Legacy`;
  log("viewer.ready", current.getInfo());
  log("setUserResult", user);
}

async function openFile(file: File) {
  if (!viewer) {
    return;
  }
  measurementInspector.reset();
  documentReady = false;
  baseline = undefined;
  docStatus.textContent = `Opening ${file.name}…`;
  const result = await viewer.documents.openFile(file);
  log("document.opened", result);
  await refresh();
}

async function activate(action: ToolAction) {
  if (!viewer) {
    return;
  }
  const definition = tools.find((tool) => tool[0] === action);
  const style = element<HTMLInputElement>("use-style").checked
    ? {
        strokeColor: "#e11d48",
        fillColor: "#fef08a",
        fillOpacity: 0.25,
        strokeWidth: 3
      }
    : undefined;
  const result = await viewer.tools.set({
    action,
    group: definition?.[2],
    enabled: true,
    style
  });
  activeTool = action;
  toolSelect.value = action;
  element("tool-status").textContent = `Active: ${definition?.[1] ?? action} · ${mode}`;
  for (const button of element("quick-tools").querySelectorAll<HTMLButtonElement>(
    "button"
  )) {
    button.setAttribute("aria-pressed", String(button.dataset.action === action));
  }
  log("toolControlV2Result", { action, mode, style, ...result });
}
element<HTMLFormElement>("connect-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run(connect);
});
appearance.addEventListener("change", () =>
  run(async () => {
    const requested = appearance.value as MeasurementAppearanceMode;

    try {
      const result = await viewer!.styles.setMeasurementAppearance({ mode: requested });
      mode = result.mode;
      status.textContent = `Ready · SDK ${SDK_VERSION} · ${mode}`;
      log("measurementAppearanceChanged", result);
    } finally {
      appearance.value = mode;
    }
  })
);
element("sample").addEventListener("click", () =>
  run(async () => {
    const response = await fetch("./fixture.pdf");

    if (!response.ok) {
      throw new Error(`Test PDF unavailable: ${response.status}`);
    }
    await openFile(
      new File([await response.arrayBuffer()], `sdk-annotation-test-${Date.now()}.pdf`, {
        type: "application/pdf"
      })
    );
  })
);
element<HTMLInputElement>("file").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;

  if (input.files?.[0]) {
    run(() => openFile(input.files![0]));
  }
});
element("open-url").addEventListener("click", () =>
  run(async () => {
    measurementInspector.reset();
    documentReady = false;
    baseline = undefined;
    await viewer!.documents.open({
      url: element<HTMLInputElement>("document-url").value
    });
    await refresh();
  })
);
element("activate").addEventListener("click", () =>
  run(() => activate(toolSelect.value as ToolAction))
);
element("select").addEventListener("click", () =>
  run(() => {
    viewer!.tools.clear();
    activeTool = "";
    element("tool-status").textContent = "Native selection / no creation tool";
    for (const button of element("quick-tools").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", "false");
    }
    log("toolControl.clear");
  })
);
element<HTMLInputElement>("snap").addEventListener("change", (event) =>
  run(async () => {
    const enabled = (event.target as HTMLInputElement).checked;
    const result = await viewer!.tools.set({
      action: "SNAP",
      group: "measurement",
      enabled
    });
    log("native.SNAP", { enabled, ...result });
  })
);
element("scale").addEventListener("click", () =>
  run(async () => {
    viewer!.measurements.scale.add({
      fileIndex,
      scale: {
        label: "SDK test 1:100",
        value: "1:100",
        metric: 1,
        metricUnit: "Millimeter",
        dimPrecision: 2,
        isSelected: true,
        source: "manual",
        isGlobal: false,
        pageRanges: [[pageIndex + 1, pageIndex + 1]]
      }
    });
    log("test.scale", await viewer!.measurements.scale.get({ fileIndex }));
  })
);
element("refresh").addEventListener("click", () => run(refresh));
element("select-record").addEventListener("click", () =>
  run(() => {
    if (!annotationSelect.value) {
      throw new Error("Choose a stored annotation first");
    }
    viewer!.tools.clear();
    viewer!.annotations.select({ guid: annotationSelect.value });
    log("annotation.select.requested", { guid: annotationSelect.value });
  })
);
element("inspect").addEventListener("click", () =>
  run(async () => {
    if (!annotationSelect.value) {
      throw new Error("Choose a stored annotation first");
    }
    const props = await viewer!.styles.getAnnotationProperties({
      guid: annotationSelect.value
    });
    const record = records.find((item) => guid(item) === annotationSelect.value);
    element("record").textContent = JSON.stringify(
      { properties: props, record },
      null,
      2
    );
    log("annotation.properties", props);
  })
);
element("capture").addEventListener("click", () =>
  run(async () => {
    await refresh();
    baseline = geometrySnapshot();
    element("comparison").textContent =
      `Baseline captured: ${records.length} annotations in ${mode}.`;
    log("baseline.captured", { mode, count: records.length });
  })
);
element("compare").addEventListener("click", () =>
  run(async () => {
    if (baseline === undefined) {
      throw new Error("Capture a baseline first");
    }
    await refresh();
    const unchanged = baseline === geometrySnapshot();
    element("comparison").textContent = unchanged
      ? `Unchanged: ${records.length} annotation GUIDs, geometry, scale and stored style fields.`
      : "Changed: inspect the records. Drawing/editing after the baseline also changes this result.";
    log("baseline.compared", { unchanged, mode, count: records.length });
  })
);
window.addEventListener("pagehide", () => {
  measurementInspector.reset();
  viewer?.destroy();
});
log("local.sdk.build", {
  version: SDK_VERSION,
  import: "../../dist/index.js",
  defaultMode: "legacy"
});
element("activation-check").addEventListener("click", () =>
  run(async () => {
    const originalMode = mode;
    const results: Array<{
      mode: MeasurementAppearanceMode;
      action: string;
      acknowledged: boolean;
      error?: string;
    }> = [];

    try {
      for (const testMode of ["legacy", "modern"] as const) {
        const changed = await viewer!.styles.setMeasurementAppearance({ mode: testMode });
        mode = changed.mode;
        appearance.value = mode;
        for (const [action, , group] of tools.slice(0, 11)) {
          try {
            await viewer!.tools.set({ action, group, enabled: true });
            await viewer!.tools.set({ action, group, enabled: false });
            results.push({ mode, action, acknowledged: true });
          } catch (error) {
            results.push({
              mode,
              action,
              acknowledged: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        await viewer!.tools.set({ action: "SNAP", group: "measurement", enabled: true });
        await viewer!.tools.set({ action: "SNAP", group: "measurement", enabled: false });
      }
    } finally {
      viewer!.tools.clear();
      const restored = await viewer!.styles.setMeasurementAppearance({
        mode: originalMode
      });
      mode = restored.mode;
      appearance.value = mode;
      status.textContent = `Ready · SDK ${SDK_VERSION} · ${mode}`;
      element("tool-status").textContent = "Native selection / no creation tool";
    }
    const accepted = results.filter((result) => result.acknowledged).length;
    element("activation-result").textContent =
      `${accepted}/${results.length} tool activation/deactivation pairs acknowledged. SNAP acknowledged in both modes. Native drawing still requires gesture acceptance.`;
    log("acceptance.commandCheck", results);
  })
);
