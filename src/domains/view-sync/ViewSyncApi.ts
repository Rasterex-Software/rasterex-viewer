import { createCommandTimeoutError, createViewerNotReadyError } from "../../errors.js";
import type { CanvasMessageBroker, CanvasMessageUnsubscribe } from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createCanvasCommandError, requireReadyBroker } from "../canvas/canvasBrokerCommands.js";
import type {
  ViewSyncApiOptions, ViewSyncApplied, ViewSyncApplyOptions, ViewSyncChange,
  ViewSyncConfiguration, ViewSyncConfigured, ViewSyncEventHandler, ViewSyncEventMap,
  ViewSyncEventName, ViewSyncEventUnsubscribe, ViewSyncFailed, ViewSyncMode
} from "./types.js";
export type * from "./types.js";

const MODES: readonly ViewSyncMode[] = ["off", "pan", "zoom", "panAndZoom"];

export class ViewSyncApi {
  private readonly options: ViewSyncApiOptions;
  private readonly events = new DomainEventEmitter<ViewSyncEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private pendingConfig: { cancel: () => void } | null = null;
  private configuredIdentity: { groupId: string; instanceId: string } | null = null;

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
        if (isChange(payload) && this.configuredIdentity?.groupId === payload.groupId &&
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
    for (const cleanup of this.brokerCleanups) cleanup();
    this.brokerCleanups = [];
    this.broker = null;
    this.configuredIdentity = null;
  }

  configure(options: ViewSyncConfiguration): Promise<ViewSyncConfigured> {
    if (!options || !hasText(options.groupId) || !hasText(options.instanceId) ||
        !MODES.includes(options.mode)) {
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
    const requestId = createRequestId();
    return new Promise<ViewSyncConfigured>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof globalThis.setTimeout>;
      const unsubscribe = broker.on<ViewSyncConfigured>("viewSyncConfigured", ({ payload }) => {
        if (!payload || payload.requestId !== requestId || settled) return;
        finish();
        if (payload.success !== true) {
          reject(createCanvasCommandError(
            "configureViewSync", payload.reason ?? "Canvas rejected view sync configuration.",
            { requestId, result: payload }
          ));
        } else {
          this.configuredIdentity = options.mode === "off"
            ? null
            : { groupId: options.groupId, instanceId: options.instanceId };
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
          enabled: options.mode !== "off",
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
  if (pan && (!isRecord(pan) || !Number.isFinite(pan.sx) || !Number.isFinite(pan.sy))) return false;
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
