import type { RasterexViewer, MeasurementInfoResult } from "../../dist/index.js";

interface Context {
  viewer?: RasterexViewer;
  fileIndex: number;
  pageIndex: number;
  ready: boolean;
}

export function createMeasurementInspector(options: {
  context: () => Context;
  log: (type: string, payload?: unknown) => void;
}) {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const panel = el<HTMLDetailsElement>("measurement-panel");
  const fields = el<HTMLFieldSetElement>("measurement-controls");
  const list = el<HTMLSelectElement>("measurement-guid");
  const vertex = el<HTMLInputElement>("measurement-vertex");
  const status = el("measurement-status"),
    output = el("measurement-result");
  let epoch = 0,
    busy = false,
    externalBusy = false;
  let selectingGuid: string | undefined;
  const kinds = new Map<string, string>();
  const normalize = (guid: string) => guid.trim().replace(/[{}]/g, "").toUpperCase();
  const controls = (value = externalBusy) => {
    externalBusy = value;
    const ctx = options.context(),
      caps = ctx.viewer?.getInfo().capabilities ?? [];
    fields.disabled =
      busy || externalBusy || !ctx.ready || !caps.includes("measurementInfo");
    el<HTMLButtonElement>("measurement-select").disabled = !caps.includes(
      "nativeVertexSelection"
    );
    el<HTMLButtonElement>("measurement-clear").disabled = !caps.includes(
      "nativeVertexSelection"
    );

    if (ctx.ready && !caps.includes("measurementInfo")) {
      status.textContent = "This viewer does not advertise measurementInfo.";
    }
  };

  function invalidate() {
    epoch++;
    output.textContent = "";
  }

  function reset() {
    invalidate();
    kinds.clear();
    list.replaceChildren(new Option("Choose a measurement", ""));
    vertex.value = "";
    status.textContent = "Refresh measurements after the document is ready.";
    controls();
  }

  function selectionChanged(guid: string) {
    const id = normalize(guid);

    if (selectingGuid === id) {
      return;
    }
    invalidate();
    list.value = kinds.has(id) ? id : "";
    vertex.value = "";
    status.textContent =
      "Native selection changed. Inspect again for current information.";
  }

  async function perform(action: "refresh" | "inspect" | "select" | "clear") {
    if (busy) {
      return;
    }
    const ctx = options.context();

    if (!ctx.viewer || !ctx.ready || !panel.open) {
      return;
    }
    const token = ++epoch,
      current = ctx.viewer;
    const valid = () => {
      const now = options.context();

      return (
        token === epoch &&
        panel.open &&
        now.ready &&
        now.viewer === current &&
        now.fileIndex === ctx.fileIndex &&
        now.pageIndex === ctx.pageIndex
      );
    };
    busy = true;
    controls();

    try {
      if (action === "refresh") {
        const snapshot = await current.annotations.getData({ filter: "measurements" });

        if (!valid()) {
          return;
        }
        kinds.clear();
        list.replaceChildren(new Option("Choose a measurement", ""));
        for (const item of snapshot.items) {
          const raw = (item.Entity ?? item.data ?? item) as Record<string, unknown>;
          const entity = (raw.Entity ?? raw) as Record<string, unknown>;
          const type = entity.Type ?? item.type,
            subtype = entity.Subtype;
          const kind =
            type === 7 && subtype === 0
              ? "Distance"
              : type === 8 && subtype === 0
                ? "Area"
                : type === 1 && subtype === 3
                  ? "Path"
                  : type === 3 && subtype === 6
                    ? "Rectangular area"
                    : undefined;
          const guid = entity.UniqueID ?? item.guid;

          if (
            !kind ||
            typeof guid !== "string" ||
            (entity.View !== undefined && entity.View !== ctx.pageIndex)
          ) {
            continue;
          }
          const id = normalize(guid);

          if (kinds.has(id)) {
            continue;
          }
          kinds.set(id, kind);
          list.add(new Option(`${kind} · ${id.slice(0, 12)}`, id));
        }
        status.textContent = kinds.size
          ? `${kinds.size} native measurements. Choose one to inspect.`
          : "No native measurements yet. Draw a measurement, then refresh.";

        return;
      }
      const guid = list.value;

      if (action !== "clear" && !guid) {
        throw new Error("Choose a measurement first.");
      }
      const vertexIndex = vertex.value === "" ? undefined : Number(vertex.value) - 1;

      if (
        action !== "clear" &&
        vertexIndex !== undefined &&
        (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= 1000)
      ) {
        throw new Error("Vertex number must be an integer from 1 to 1000.");
      }

      if (action === "select" && vertexIndex === undefined) {
        throw new Error("Enter a vertex number to select.");
      }

      if (action === "select") {
        selectingGuid = guid;
      }
      const identity = {
        fileIndex: ctx.fileIndex,
        pageIndex: ctx.pageIndex,
        guid,
        vertexIndex
      };
      const result =
        action === "inspect"
          ? await current.measurements.getInfo(identity)
          : action === "select"
            ? await current.measurements.selectVertex({
                ...identity,
                vertexIndex: vertexIndex!
              })
            : await current.measurements.clearVertexSelection();
      // Native selection events can invalidate this view while the command runs.

      if (!valid()) {
        return;
      }
      output.textContent = JSON.stringify(result, null, 2);
      const info = action === "inspect" ? (result as MeasurementInfoResult) : undefined;
      status.textContent = info
        ? info.geometry.available
          ? "Inspection complete. Coordinates are nativeAnnotation."
          : `Metadata available. Additional calculations unavailable: ${info.geometry.reason}`
        : action === "select"
          ? "Native vertex selected; no vertex movement requested."
          : "Parent vertex selection cleared.";
      options.log(`measurement.${action}`, result);
    } catch (error) {
      if (valid()) {
        status.textContent = error instanceof Error ? error.message : String(error);
        output.textContent = "";
        options.log("measurement.error", { message: status.textContent });
      }
    } finally {
      selectingGuid = undefined;
      busy = false;
      controls();
    }
  }
  for (const action of ["refresh", "inspect", "select", "clear"] as const) {
    el(`measurement-${action}`).addEventListener("click", () => {
      void perform(action);
    });
  }
  list.addEventListener("change", () => {
    invalidate();
    vertex.value = "";
    status.textContent = "Ready to inspect the chosen measurement.";
  });
  vertex.addEventListener("input", invalidate);
  panel.addEventListener("toggle", () => {
    if (!panel.open) {
      invalidate();
    }
  });

  return { reset, controls, selectionChanged };
}
