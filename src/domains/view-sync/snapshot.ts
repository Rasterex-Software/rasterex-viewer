import { createCommandTimeoutError, createViewerNotReadyError } from "../../errors.js";
import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { createCanvasCommandError } from "../canvas/canvasBrokerCommands.js";
import type { ViewSyncSnapshot, ViewSyncSnapshotApplied } from "./types.js";

export interface SnapshotOperation<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export function isSnapshot(value: unknown): value is ViewSyncSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const offset = item.offset as Record<string, unknown> | undefined;
  return item.success === true && typeof item.groupId === "string" && !!item.groupId &&
    typeof item.sourceInstanceId === "string" && !!item.sourceInstanceId &&
    typeof item.requestId === "string" && !!item.requestId &&
    typeof item.zoomScale === "number" && Number.isFinite(item.zoomScale) && item.zoomScale > 0 &&
    !!offset && typeof offset === "object" && !Array.isArray(offset) &&
    typeof offset.x === "number" && Number.isFinite(offset.x) &&
    typeof offset.y === "number" && Number.isFinite(offset.y) &&
    Number.isSafeInteger(item.page) && (item.page as number) >= 0;
}

export function createSnapshotOperation<T extends ViewSyncSnapshot | ViewSyncSnapshotApplied>(
  broker: CanvasMessageBroker,
  command: "getViewSyncSnapshot" | "applyViewSyncSnapshot",
  resultType: "viewSyncSnapshot" | "viewSyncSnapshotApplied",
  payload: { groupId: string; requestId?: string; [key: string]: unknown },
  timeoutMs: number,
  expectedSourceId?: string
): SnapshotOperation<T> {
  const requestId = payload.requestId ?? createRequestId();
  let cancel = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout>;
    const unsubscribe = broker.on<unknown>(resultType, ({ payload: result }) => {
      if (!result || typeof result !== "object" || Array.isArray(result) ||
          (result as Record<string, unknown>).requestId !== requestId || settled) return;
      finish();
      const response = result as Record<string, unknown>;
      if (response.success === false) {
        reject(createCanvasCommandError(command,
          typeof response.error === "string" ? response.error : "Canvas snapshot command failed.",
          { requestId, result }
        ));
      } else if (!isSnapshot(result) || result.groupId !== payload.groupId ||
          (expectedSourceId !== undefined && result.sourceInstanceId !== expectedSourceId)) {
        reject(createCanvasCommandError(command, "Canvas returned an invalid snapshot result.",
          { requestId, result }));
      } else {
        resolve(result as T);
      }
    });
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
    };
    timer = globalThis.setTimeout(() => {
      finish();
      reject(createCommandTimeoutError(requestId, command, timeoutMs));
    }, timeoutMs);
    cancel = () => {
      if (settled) return;
      finish();
      reject(createViewerNotReadyError("Viewer disconnected during view alignment."));
    };
    try {
      broker.send(command, { ...payload, requestId });
    } catch (error) {
      finish();
      reject(error);
    }
  });
  return { promise, cancel };
}
