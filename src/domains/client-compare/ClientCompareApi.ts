import { createCommandTimeoutError, createViewerNotReadyError } from "../../errors.js";
import type { CanvasMessageBroker, CanvasMessageUnsubscribe } from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createCanvasCommandError, requireReadyBroker } from "../canvas/canvasBrokerCommands.js";
import type {
  ClientCompareAlignComplete, ClientCompareAlignStarted, ClientCompareApiOptions,
  ClientCompareClosed, ClientCompareCommandOptions, ClientCompareCommonLevelChanged,
  ClientCompareCreateOptions, ClientCompareEventHandler, ClientCompareEventMap,
  ClientCompareEventName, ClientCompareEventUnsubscribe, ClientCompareFailure,
  ClientCompareOpacityChanged, ClientCompareReady
} from "./types.js";

export type * from "./types.js";

type Result =
  | ClientCompareReady
  | ClientCompareOpacityChanged
  | ClientCompareCommonLevelChanged
  | ClientCompareAlignStarted
  | ClientCompareAlignComplete
  | ClientCompareClosed;
type ResultType = keyof ClientCompareEventMap;

const COLORS = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\))$/;

export class ClientCompareApi {
  private readonly options: ClientCompareApiOptions;
  private readonly events = new DomainEventEmitter<ClientCompareEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private pending = new Map<string, { cancel: () => void }>();
  private active = false;
  private alignmentInProgress = false;

  constructor(options: ClientCompareApiOptions) {
    this.options = options;
  }

  on<TName extends ClientCompareEventName>(
    name: TName,
    handler: ClientCompareEventHandler<TName>
  ): ClientCompareEventUnsubscribe {
    this.connect();
    return this.events.on(name, handler);
  }

  connect(): void {
    const broker = this.options.getBroker();
    if (!broker || broker === this.broker) return;
    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      this.listen("clientCompareReady", "ready", (payload) => this.finishReady(payload)),
      this.listen("clientCompareOpacityChanged", "opacityChanged"),
      this.listen("clientCompareCommonLevelChanged", "commonLevelChanged"),
      this.listen("clientCompareAlignStarted", "alignStarted"),
      this.listen("clientCompareAlignComplete", "alignComplete", () => {
        this.alignmentInProgress = false;
      }),
      this.listen("clientCompareClosed", "closed", () => {
        this.active = false;
        this.alignmentInProgress = false;
      }),
      broker.on<ClientCompareFailure>("clientCompareFailed", ({ payload }) => {
        if (isFailure(payload)) {
          this.alignmentInProgress = false;
          this.events.emit("failed", payload);
        }
      }),
      broker.on<ClientCompareFailure>("clientCompareAlignFailed", ({ payload }) => {
        if (isFailure(payload)) {
          this.alignmentInProgress = false;
          this.events.emit("failed", payload);
        }
      })
    ];
  }

  disconnect(): void {
    for (const operation of this.pending.values()) operation.cancel();
    this.pending.clear();
    for (const cleanup of this.brokerCleanups) cleanup();
    this.brokerCleanups = [];
    this.broker = null;
    this.active = false;
    this.alignmentInProgress = false;
  }

  create(options: ClientCompareCreateOptions): Promise<ClientCompareReady> {
    this.validateCreate(options);
    if (this.active || this.hasPending("clientCompare")) {
      return Promise.reject(this.busyError("clientCompare"));
    }
    const { timeoutMs: _timeoutMs, ...payload } = options;
    return this.command("clientCompare", "clientCompareReady", payload,
      options.timeoutMs, (result) => {
        this.active = true;
        return result as ClientCompareReady;
      });
  }

  setOpacity(value: number, options: ClientCompareCommandOptions = {}): Promise<ClientCompareOpacityChanged> {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return Promise.reject(createCanvasCommandError("clientCompareSetOpacity", "Opacity must be between 0 and 100."));
    }
    return this.activeCommand("clientCompareSetOpacity", "clientCompareOpacityChanged",
      { value, ...commandPayload(options) }, options.timeoutMs);
  }

  setCommonLevel(level: number, options: ClientCompareCommandOptions = {}): Promise<ClientCompareCommonLevelChanged> {
    if (!Number.isSafeInteger(level) || level < 1 || level > 10) {
      return Promise.reject(createCanvasCommandError("clientCompareSetCommonLevel", "Common level must be an integer from 1 to 10."));
    }
    return this.activeCommand("clientCompareSetCommonLevel", "clientCompareCommonLevelChanged",
      { level, ...commandPayload(options) }, options.timeoutMs);
  }

  startAlign(options: ClientCompareCommandOptions = {}): Promise<ClientCompareAlignStarted> {
    if (!this.active) return Promise.reject(this.notActiveError("clientCompareAlignStart"));
    if (this.alignmentInProgress) return Promise.reject(this.busyError("clientCompareAlignStart"));
    this.alignmentInProgress = true;
    return this.command("clientCompareAlignStart", "clientCompareAlignStarted", commandPayload(options),
      options.timeoutMs, (result) => result as ClientCompareAlignStarted).catch((error) => {
        this.alignmentInProgress = false;
        throw error;
      });
  }

  close(options: ClientCompareCommandOptions = {}): Promise<ClientCompareClosed> {
    return this.command("clientCompareClose", "clientCompareClosed", commandPayload(options), options.timeoutMs,
      (result) => result as ClientCompareClosed).then((result) => {
        this.active = false;
        this.alignmentInProgress = false;
        return result;
      });
  }

  private activeCommand<T extends Result>(
    command: string,
    resultType: string,
    payload: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<T> {
    if (!this.active) return Promise.reject(this.notActiveError(command));
    if (this.alignmentInProgress) return Promise.reject(this.busyError(command));
    return this.command(command, resultType, payload, timeoutMs, (result) => result as T);
  }

  private command<T extends Result>(
    command: string,
    resultType: string,
    payload: Record<string, unknown>,
    timeoutOverride: number | undefined,
    map: (result: Result) => T
  ): Promise<T> {
    const broker = requireReadyBroker({ ...this.options, type: command, apiName: "viewer.clientCompare" });
    const timeoutMs = timeoutOverride ?? this.options.commandTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(createCanvasCommandError(command, "timeoutMs must be positive and finite."));
    }
    const requestId = typeof payload.requestId === "string" && payload.requestId.trim()
      ? payload.requestId : createRequestId();
    const operation = this.createOperation<T>(broker, command, resultType, {
      ...payload, requestId
    }, timeoutMs, map, failureTypeFor(command));
    this.pending.set(requestId, operation);
    void operation.promise.finally(() => this.pending.delete(requestId)).catch(() => {});
    return operation.promise;
  }

  private createOperation<T extends Result>(
    broker: CanvasMessageBroker,
    command: string,
    resultType: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
    map: (result: Result) => T,
    failureType?: string
  ): { promise: Promise<T>; cancel: () => void } {
    let cancel = () => {};
    const promise = new Promise<T>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof globalThis.setTimeout>;
      const unsubscribe = broker.on<Result>(resultType, ({ payload: result }) => {
        if (settled || !result || result.requestId !== payload.requestId) return;
        finish();
        resolve(map(result));
      });
      const unsubscribeFailure = failureType
        ? broker.on<ClientCompareFailure>(failureType, ({ payload: result }) => {
            if (settled || !result || result.requestId !== payload.requestId) return;
            finish();
            reject(createCanvasCommandError(command, result.error ?? "Canvas client compare command failed.", {
              requestId: payload.requestId, result
            }));
          })
        : () => {};
      const finish = () => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        unsubscribe();
        unsubscribeFailure();
      };
      timer = globalThis.setTimeout(() => {
        finish();
        reject(createCommandTimeoutError(String(payload.requestId), command, timeoutMs));
      }, timeoutMs);
      cancel = () => {
        if (settled) return;
        finish();
        reject(createViewerNotReadyError("Viewer disconnected during client comparison."));
      };
      try {
        broker.send(command, payload);
      } catch (error) {
        finish();
        reject(error);
      }
    });
    return { promise, cancel };
  }

  private listen<T extends Result>(command: string, event: ResultType, after?: (payload: T) => void): CanvasMessageUnsubscribe {
    return this.broker!.on<T>(command, ({ payload }) => {
      if (!isSuccess(payload)) return;
      after?.(payload);
      this.events.emit(event, payload as ClientCompareEventMap[typeof event]);
    });
  }

  private finishReady(payload: ClientCompareReady): void {
    this.active = true;
  }

  private hasPending(command: string): boolean {
    return [...this.pending.values()].some(() => command === "clientCompare");
  }

  private validateCreate(options: ClientCompareCreateOptions): void {
    if (!options || typeof options !== "object") {
      throw createCanvasCommandError("clientCompare", "Client comparison options are required.");
    }
    const background = options.backgroundUrl ?? options.backgroundFileName;
    const overlay = options.overlayUrl ?? options.overlayFileName;
    if (!hasText(background) || !hasText(overlay)) {
      throw createCanvasCommandError("clientCompare", "Both background and overlay sources are required.");
    }
    if (background.trim() === overlay.trim()) {
      throw createCanvasCommandError("clientCompare", "Background and overlay sources must differ.");
    }
    if (options.backgroundColor !== undefined && !COLORS.test(options.backgroundColor)) {
      throw createCanvasCommandError("clientCompare", "backgroundColor must be a hex or RGB color.");
    }
    if (options.overlayColor !== undefined && !COLORS.test(options.overlayColor)) {
      throw createCanvasCommandError("clientCompare", "overlayColor must be a hex or RGB color.");
    }
  }

  private notActiveError(type: string) {
    return createCanvasCommandError(type, "Create a client comparison before using this command.");
  }

  private busyError(type: string) {
    return createCanvasCommandError(type, "Another client comparison operation is still pending.");
  }
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function commandPayload(options: { requestId?: string; timeoutMs?: number }): Record<string, unknown> {
  return options.requestId === undefined ? {} : { requestId: options.requestId };
}

function isSuccess(value: unknown): value is Result {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (value as { success?: unknown }).success === true &&
    typeof (value as { requestId?: unknown }).requestId === "string";
}

function isFailure(value: unknown): value is ClientCompareFailure {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (value as { success?: unknown }).success === false;
}

function failureTypeFor(command: string): string | undefined {
  if (command === "clientCompare") return "clientCompareFailed";
  if (command === "clientCompareAlignStart") return "clientCompareAlignFailed";
  return undefined;
}
