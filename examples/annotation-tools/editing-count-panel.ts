import type {
  AnnotationDataItem,
  CountConfiguration,
  CountItem,
  CountItemInfo,
  CountItemsResult,
  RasterexViewer
} from "../../dist/index.js";
import { testUser } from "./test-user.js";

interface PanelOptions {
  getViewer: () => RasterexViewer | undefined;
  getRecords: () => AnnotationDataItem[];
  getSelectedGuid: () => string;
  run: (operation: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  log: (type: string, payload: unknown) => void;
}

function annotationEntity(item: AnnotationDataItem): Record<string, unknown> {
  const raw = (item.Entity ?? item.data ?? item) as Record<string, unknown>;
  return (raw.Entity ?? raw) as Record<string, unknown>;
}

function annotationGuid(item: AnnotationDataItem): string {
  const value = annotationEntity(item).UniqueID ?? item.guid;
  return typeof value === "string" ? value : "";
}

function sameGuid(a: string, b: string): boolean {
  return a.replace(/[{}]/g, "").toUpperCase() === b.replace(/[{}]/g, "").toUpperCase();
}

export function createEditingCountPanel({
  getViewer,
  getRecords,
  getSelectedGuid,
  run,
  refresh,
  log
}: PanelOptions) {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const editControls = element<HTMLFieldSetElement>("editing-controls");
  const countControls = element<HTMLFieldSetElement>("count-workflow-controls");
  const group = element<HTMLSelectElement>("count-group");
  const marker = element<HTMLSelectElement>("count-marker");
  const metadata = element<HTMLTextAreaElement>("count-metadata");
  const result = element("editing-count-result");
  const status = element("editing-count-status");
  let items: CountItem[] = [];

  function display(label: string, payload: unknown) {
    result.textContent = JSON.stringify(payload, null, 2);
    log(label, payload);
  }

  function clearItems() {
    items = [];
    marker.replaceChildren(new Option("Choose a marker", ""));
    metadata.value = "";
  }

  function showItemInfo() {
    const item = items.find((candidate) => candidate.id === marker.value);
    metadata.value = item ? JSON.stringify(item.info, null, 2) : "";
  }

  function showItems(label: string, payload: CountItemsResult) {
    const selectedId = marker.value;
    items = payload.items;
    marker.replaceChildren(new Option("Choose a marker", ""));
    for (const item of items) {
      marker.add(
        new Option(`Marker ${item.index + 1} · ${item.id.slice(0, 8)}`, item.id)
      );
    }
    if (items.some((item) => item.id === selectedId)) {
      marker.value = selectedId;
    }
    showItemInfo();
    display(label, payload);
    status.textContent = `${items.length} markers reported by Canvas.`;
  }

  function requireGroup() {
    if (!group.value) {
      throw new Error("Refresh annotations and choose a Count group.");
    }
    return group.value;
  }

  function requireEditableRecord(guid: string) {
    const record = getRecords().find((item) => sameGuid(annotationGuid(item), guid));
    if (!record) {
      throw new Error("Refresh annotations and choose a record.");
    }
    const entity = annotationEntity(record);
    if (entity.Locked === true) {
      throw new Error("This annotation is locked in Canvas.");
    }
    if (typeof entity.Signature === "string" && entity.Signature !== testUser.username) {
      const owner = typeof entity.Name === "string" && entity.Name
        ? entity.Name
        : entity.Signature || "another user";
      throw new Error(
        `This annotation belongs to ${owner}. Canvas requires the owning user for selection and editing. Use an editable sample or an annotation you created.`
      );
    }
  }

  function selectForEditing(viewer: RasterexViewer, guid: string) {
    viewer.tools.clear();
    viewer.annotations.unselect();
    viewer.annotations.select({ guid });
  }

  function bind(id: string, action: (viewer: RasterexViewer) => Promise<void>) {
    element(id).addEventListener("click", () => {
      void run(async () => {
        const viewer = getViewer();
        if (!viewer) {
          return;
        }
        status.textContent = "Waiting for Canvas…";
        result.textContent = "";
        try {
          await action(viewer);
          if (status.textContent === "Waiting for Canvas…") {
            status.textContent = "Canvas acknowledged the command.";
          }
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : String(error);
          log("editingCount.error", { message: status.textContent });
        }
      });
    });
  }

  bind("edit-state", async (viewer) =>
    display("parentToolState", await viewer.tools.getState())
  );
  bind("edit-delete-selected", async (viewer) => {
    const guid = getSelectedGuid();
    if (!guid) {
      throw new Error("Choose a record under Stored annotation checks or select one in Canvas.");
    }
    await refresh();
    requireEditableRecord(guid);
    selectForEditing(viewer, guid);
    display("annotationEditResult", await viewer.annotations.deleteSelected());
    await refresh();
    const stillListed = getRecords().some((item) => sameGuid(annotationGuid(item), guid));
    status.textContent = stillListed
      ? "Canvas acknowledged Delete, but the selected record is still listed."
      : "Deleted. The selected record is gone from the refreshed annotation list.";
  });

  for (const action of ["undo", "redo"] as const) {
    bind("edit-" + action, async (viewer) => {
      await refresh();
      const before = new Set(getRecords().map(annotationGuid));
      display("annotationEditResult", await viewer.annotations[action]());
      // Native Undo can restore a deleted annotation asynchronously under a new GUID.
      for (const delay of [0, 250, 500, 750]) {
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        await refresh();
        const after = new Set(getRecords().map(annotationGuid));
        const added = [...after].filter((guid) => !before.has(guid)).length;
        const removed = [...before].filter((guid) => !after.has(guid)).length;
        if (added || removed) {
          status.textContent =
            "Refreshed annotation list · " + added + " added · " + removed + " removed.";
          return;
        }
      }
      status.textContent = "Canvas acknowledged the command. No record was added or removed.";
    });
  }

  bind("count-start", async (viewer) => {
    const configuration: CountConfiguration = {
      name: element<HTMLInputElement>("count-name").value,
      markerName: element<HTMLInputElement>("count-marker-name").value,
      visibility: element<HTMLSelectElement>("count-visibility")
        .value as CountConfiguration["visibility"],
      content: element<HTMLSelectElement>("count-content")
        .value as CountConfiguration["content"],
      numbered: element<HTMLInputElement>("count-numbered").checked,
      symbol: element<HTMLInputElement>("count-symbol").value
    };
    await viewer.annotations.count.configure(configuration);
    display(
      "toolControlV2Result",
      await viewer.tools.set({
        action: "COUNT",
        group: "measurement",
        enabled: true
      })
    );
    status.textContent =
      "Click in the viewer to place Count markers, then finish the group.";
  });

  bind("count-finish", async (viewer) => {
    display("countFinished", await viewer.annotations.count.finish());
    await refresh();
  });
  bind("count-refresh", async () => refresh());

  bind("count-insert", async (viewer) => {
    const guid = requireGroup();
    requireEditableRecord(guid);
    await viewer.annotations.count.setPointMode({ enabled: false });
    selectForEditing(viewer, guid);
    const receipt = await viewer.annotations.count.insertPoint();
    if (!receipt.uniqueId || !sameGuid(receipt.uniqueId, guid)) {
      viewer.tools.clear();
      throw new Error("Canvas did not confirm the selected Count. Insertion was cancelled.");
    }
    display("insertCountPointResult", receipt);
    status.textContent =
      "Click in the viewer to append a marker, then read the marker list.";
  });
  bind("count-enable-point-mode", async (viewer) => {
    const guid = requireGroup();
    requireEditableRecord(guid);
    viewer.tools.clear();
    display(
      "insertCountPointModeResult",
      await viewer.annotations.count.setPointMode({
        enabled: true,
        guid
      })
    );
    status.textContent =
      "Click in the viewer to append markers. Stop point mode when done.";
  });
  bind("count-disable-point-mode", async (viewer) => {
    display(
      "insertCountPointModeResult",
      await viewer.annotations.count.setPointMode({ enabled: false })
    );
    viewer.tools.clear();
    status.textContent = "Point mode stopped. Read markers to verify any new points.";
  });

  bind("count-read-items", async (viewer) => {
    showItems("countItems", await viewer.annotations.count.getItems(requireGroup()));
  });
  bind("count-write-item", async (viewer) => {
    if (!marker.value) {
      throw new Error("Read the markers and choose one to update.");
    }
    const info: CountItemInfo = JSON.parse(metadata.value);
    showItems(
      "countItemInfoChanged",
      await viewer.annotations.count.setItemInfo(requireGroup(), marker.value, info)
    );
  });

  group.addEventListener("change", clearItems);
  marker.addEventListener("change", showItemInfo);

  return {
    controls(disabled: boolean) {
      const caps = getViewer()?.getInfo().capabilities ?? [];
      editControls.disabled = disabled || !caps.includes("parentTools");
      countControls.disabled = disabled;
      for (const id of ["count-start", "count-finish"]) {
        element<HTMLButtonElement>(id).disabled = !caps.includes("countWorkflow");
      }
      for (const id of ["count-read-items", "count-write-item"]) {
        element<HTMLButtonElement>(id).disabled = !caps.includes("countItemInfo");
      }
    },
    reset() {
      group.replaceChildren(new Option("Choose a Count group", ""));
      clearItems();
      status.textContent = "";
      result.textContent = "";
    },
    setRecords(records: AnnotationDataItem[]) {
      const prior = group.value;
      group.replaceChildren(new Option("Choose a Count group", ""));
      for (const item of records) {
        const entity = annotationEntity(item);
        const guid = annotationGuid(item);
        if (Number(entity.Type ?? item.type) === 13 && guid) {
          group.add(new Option(`Count · ${guid.slice(0, 12)}`, guid));
        }
      }
      if (Array.from(group.options).some((option) => option.value === prior)) {
        group.value = prior;
      } else {
        clearItems();
      }
    },
    finished() {
      status.textContent =
        "Count finished in Canvas. Refresh annotations to find the group.";
      log("countFinished.native", { success: true });
    }
  };
}
