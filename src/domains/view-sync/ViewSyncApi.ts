import { createCommandTimeoutError, createViewerNotReadyError } from "../../errors.js";
import type { CanvasMessageBroker, CanvasMessageUnsubscribe } from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createCanvasCommandError, requireReadyBroker } from "../canvas/canvasBrokerCommands.js";
import { createSnapshotOperation, isSnapshot, type SnapshotOperation } from "./snapshot.js";
import type {
  ViewSyncApiOptions, ViewSyncApplied, ViewSyncApplyOptions, ViewSyncChange,
  ViewSyncConfiguration, ViewSyncConfigured, ViewSyncEventHandler, ViewSyncEventMap,
  ViewSyncEventName, ViewSyncEventUnsubscribe, ViewSyncFailed, ViewSyncMode,
  ViewSyncSnapshot, ViewSyncSnapshotApplied, ViewSyncSnapshotRequest,
  ViewSyncSnapshotApplyOptions
} from "./types.js";
export type * from "./types.js";

const MODES: readonly ViewSyncMode[] = ["off", "pan", "zoom", "panAndZoom"];

export class ViewSyncApi {
  private readonly options: ViewSyncApiOptions;
  private readonly events = new DomainEventEmitter<ViewSyncEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private pendingConfig: { cancel: () => void } | null = null;
  private readonly pendingSnapshots = new Set<SnapshotOperation<ViewSyncSnapshot>>();
  private configuredIdentity: { groupId: string; instanceId: string } | null = null;
  private configuredEnabled = false;

  constructor(options: ViewSyncApiOptions) {
    this.options = options;
  }

  on<TName extends ViewSyncEventName>(
    name: TName,
    handler: ViewSyncEventHandler<TName>
  ): ViewSyncEventUnsubscribe {
    this.connect();
    return this.events.on(name, handler);
  }

  connect(): void {
    const broker = this.options.getBroker();
    if (!broker || broker === this.broker) return;
    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<ViewSyncChange>("viewSyncChanged", ({ payload }) => {
        if (this.configuredEnabled && isChange(payload) &&
            this.configuredIdentity?.groupId === payload.groupId &&
            this.configuredIdentity.instanceId === payload.sourceInstanceId) {
          this.events.emit("changed", payload);
        }
      }),
      broker.on<ViewSyncApplied>("viewSyncApplied", ({ payload }) => {
        if (isApplied(payload)) this.events.emit("applied", payload);
      }),
      broker.on<ViewSyncFailed>("viewSyncFailed", ({ payload }) => {
        if (isFailed(payload)) this.events.emit("failed", payload);
      })
    ];
  }

  disconnect(): void {
    this.pendingConfig?.cancel();
    this.pendingConfig = null;
    for (const operation of this.pendingSnapshots) operation.cancel();
    this.pendingSnapshots.clear();
    for (const cleanup of this.brokerCleanups) cleanup();
    this.brokerCleanups = [];
    this.broker = null;
    this.configuredIdentity = null;
    this.configuredEnabled = false;
  }

  configure(options: ViewSyncConfiguration): Promise<ViewSyncConfigured> {
    if (!options || !hasText(options.groupId) || !hasText(options.instanceId) ||
        !MODES.includes(options.mode) ||
        (options.enabled !== undefined && typeof options.enabled !== "boolean")) {
      return Promise.reject(createCanvasCommandError(
        "configureViewSync", "View sync requires groupId, instanceId, and a valid mode."
      ));
    }
    if (this.pendingConfig) {
      return Promise.reject(createCanvasCommandError(
        "configureViewSync", "A view sync configuration is already pending."
      ));
    }
    const broker = requireReadyBroker({
      ...this.options, type: "configureViewSync", apiName: "viewer.viewSync"
    });
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(createCanvasCommandError(
        "configureViewSync", "timeoutMs must be a positive finite number."
      ));
    }
    this.configuredIdentity = null;
    this.configuredEnabled = false;
    const enabled = options.enabled ?? options.mode !== "off";
    const requestId = createRequestId();
    return new Promise<ViewSyncConfigured>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof globalThis.setTimeout>;
      const unsubscribe = broker.on<ViewSyncConfigured>("viewSyncConfigured", ({ payload }) => {
        if (!payload || payload.requestId !== requestId || settled) return;
        finish();
        if (payload.success !== true) {
          reject(createCanvasCommandError(
            "configureViewSync", payload.error ?? payload.reason ?? "Canvas rejected view sync configuration.",
            { requestId, result: payload }
          ));
        } else if (payload.enabled !== enabled || payload.groupId !== options.groupId ||
            payload.instanceId !== options.instanceId || payload.mode !== options.mode) {
          reject(createCanvasCommandError("configureViewSync",
            "Canvas returned a mismatched view sync configuration.", { requestId, result: payload }));
        } else {
          this.configuredIdentity = { groupId: options.groupId, instanceId: options.instanceId };
          this.configuredEnabled = enabled && options.mode !== "off";
          resolve(payload);
        }
      });
      const finish = () => {
        settled = true;
        globalThis.clearTimeout(timer);
        unsubscribe();
        this.pendingConfig = null;
      };
      timer = globalThis.setTimeout(() => {
        finish();
        reject(createCommandTimeoutError(requestId, "configureViewSync", timeoutMs));
      }, timeoutMs);
      this.pendingConfig = {
        cancel: () => {
          if (settled) return;
          finish();
          reject(createViewerNotReadyError("Viewer disconnected during view sync configuration."));
        }
      };
      try {
        broker.send("configureViewSync", {
          enabled,
          groupId: options.groupId,
          instanceId: options.instanceId,
          mode: options.mode,
          requestId
        });
      } catch (error) {
        finish();
        reject(error);
      }
    });
  }

  getSnapshot(options: ViewSyncSnapshotRequest): Promise<ViewSyncSnapshot> {
    if (!options || !hasText(options.groupId)) {
      return Promise.reject(createCanvasCommandError("getViewSyncSnapshot", "groupId is required."));
    }
    if (this.configuredIdentity?.groupId !== options.groupId) {
      return Promise.reject(createCanvasCommandError("getViewSyncSnapshot",
        "Configure this viewer in the requested group before taking a snapshot."));
    }
    return this.runSnapshot("getViewSyncSnapshot", "viewSyncSnapshot",
      { groupId: options.groupId }, options.timeoutMs,
      this.configuredIdentity.instanceId);
  }

  applySnapshot(
    snapshot: ViewSyncSnapshot,
    options: ViewSyncSnapshotApplyOptions = {}
  ): Promise<ViewSyncSnapshotApplied> {
    if (!isSnapshot(snapshot)) {
      return Promise.reject(createCanvasCommandError("applyViewSyncSnapshot",
        "A valid successful snapshot is required."));
    }
    return this.runSnapshot("applyViewSyncSnapshot", "viewSyncSnapshotApplied",
      { ...snapshot }, options.timeoutMs, snapshot.sourceInstanceId);
  }

  private runSnapshot(
    command: "getViewSyncSnapshot" | "applyViewSyncSnapshot",
    resultType: "viewSyncSnapshot" | "viewSyncSnapshotApplied",
    payload: { groupId: string; requestId?: string; [key: string]: unknown },
    timeoutOverride?: number,
    sourceId?: string
  ): Promise<ViewSyncSnapshot> {
    const timeoutMs = timeoutOverride ?? this.options.commandTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(createCanvasCommandError(command, "timeoutMs must be positive and finite."));
    }
    const broker = requireReadyBroker({ ...this.options, type: command, apiName: "viewer.viewSync" });
    const operation = createSnapshotOperation<ViewSyncSnapshot>(
      broker, command, resultType, payload, timeoutMs, sourceId
    );
    this.pendingSnapshots.add(operation);
    void operation.promise.finally(() => this.pendingSnapshots.delete(operation)).catch(() => {});
    return operation.promise;
  }

  apply(change: ViewSyncChange, options: ViewSyncApplyOptions = {}): void {
    if (!isChange(change)) {
      throw createCanvasCommandError("applyViewSync", "A valid view sync change is required.");
    }
    const pan = options.pan ?? change.state.pan !== undefined;
    const zoom = options.zoom ?? change.state.zoom !== undefined;
    if ((pan && !change.state.pan) || (zoom && !change.state.zoom) || (!pan && !zoom)) {
      throw createCanvasCommandError(
        "applyViewSync", "Apply must select at least one available pan or zoom state."
      );
    }
    requireReadyBroker({
      ...this.options, type: "applyViewSync", apiName: "viewer.viewSync"
    }).send("applyViewSync", { ...change, apply: { pan, zoom } });
  }
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isChange(value: unknown): value is ViewSyncChange {
  if (!isRecord(value) || !hasText(value.groupId) || !hasText(value.sourceInstanceId) ||
      !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0 ||
      !isRecord(value.state)) return false;
  if (value.page !== undefined && !Number.isFinite(value.page)) return false;
  if (value.fileIndex !== undefined && !Number.isFinite(value.fileIndex)) return false;
  if (value.fileId !== undefined && typeof value.fileId !== "string" &&
      !Number.isFinite(value.fileId)) return false;
  const { pan, zoom } = value.state;
  if (!pan && !zoom) return false;
  if (pan && (!isRecord(pan) || !Number.isFinite(pan.sx) || !Number.isFinite(pan.sy) ||
      (pan.coordinateMode !== undefined && pan.coordinateMode !== "delta" &&
       pan.coordinateMode !== "absolute"))) return false;
  if (zoom && (!isRecord(zoom) || !isRecord(zoom.zoomparams) ||
      !Number.isFinite(zoom.type))) return false;
  return true;
}

function isApplied(value: unknown): value is ViewSyncApplied {
  return isRecord(value) && value.success === true && hasText(value.groupId) &&
    hasText(value.sourceInstanceId) && Number.isSafeInteger(value.sequence);
}

function isFailed(value: unknown): value is ViewSyncFailed {
  return isRecord(value) && value.success === false && hasText(value.reason);
}
