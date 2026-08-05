import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import type {
  CompareAlignPayload,
  CompareApiOptions,
  CompareEventHandler,
  CompareEventMap,
  CompareEventName,
  CompareEventUnsubscribe,
  ComparisonErrorPayload,
  ComparisonResult,
  CompareSaveOptions
} from "./types.js";
import type { ComparePendingCommand, PendingCompareCommand } from "./internalTypes.js";
export type * from "./types.js";

export class CompareApi {
  private readonly options: CompareApiOptions;
  private readonly events = new DomainEventEmitter<CompareEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private pendingCommand: PendingCompareCommand | null = null;

  constructor(options: CompareApiOptions) {
    this.options = options;
  }

  on<TEventName extends CompareEventName>(
    eventName: TEventName,
    handler: CompareEventHandler<TEventName>
  ): CompareEventUnsubscribe {
    this.connect();
    return this.events.on(eventName, handler);
  }

  connect(): void {
    const broker = this.options.getBroker();

    if (!broker || broker === this.broker) {
      return;
    }

    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<unknown>("progressStart", (message) => {
        this.events.emit("progressStart", {
          message: getProgressMessage(message.message)
        });
      }),
      broker.on("progressEnd", () => {
        this.events.emit("progressEnd", undefined);
        if (
          this.pendingCommand &&
          !this.pendingCommand.waitsForInteractiveAlignResult &&
          this.pendingCommand.completed
        ) {
          this.clearPendingCommand();
        }
      }),
      broker.on<ComparisonResult>("comparisonComplete", (message) => {
        this.events.emit("comparisonComplete", message.payload);
        if (
          this.pendingCommand?.type === "align" &&
          this.pendingCommand.waitsForInteractiveAlignResult &&
          message.payload
        ) {
          this.clearPendingCommand();
          return;
        }

        if (
          this.pendingCommand?.type === "compare" ||
          (this.pendingCommand?.type === "align" &&
            !this.pendingCommand.waitsForInteractiveAlignResult)
        ) {
          this.pendingCommand.completed = true;
        }
      }),
      broker.on<ComparisonErrorPayload>("comparisonError", (message) => {
        if (isComparisonErrorPayload(message.payload)) {
          this.events.emit("comparisonError", message.payload);
          if (
            this.pendingCommand?.type === "compare" ||
            this.pendingCommand?.type === "align"
          ) {
            this.clearPendingCommand();
          }
        }
      }),
      broker.on<string>("compareSaveComplete", (message) => {
        this.events.emit("compareSaveComplete", message.payload);
        if (this.pendingCommand?.type === "compareSave") {
          this.pendingCommand.completed = true;
        }
      }),
      broker.on<boolean>("comparisonMarkupChanged", (message) => {
        if (typeof message.payload === "boolean") {
          this.events.emit("comparisonMarkupChanged", message.payload);
        }
      })
    ];
  }

  disconnect(): void {
    for (const cleanup of this.brokerCleanups) {
      cleanup();
    }

    this.brokerCleanups = [];
    this.broker = null;
    this.clearPendingCommand();
  }

  compare(payload: CompareAlignPayload): void {
    this.validateCompareAlignPayload("compare", payload);
    this.send("compare", payload, false);
  }

  align(payload: CompareAlignPayload): void {
    this.validateCompareAlignPayload("align", payload);
    this.send("align", payload, isInteractiveAlignPayload(payload));
  }

  /**
   * @deprecated Canvas comparison-markup save is not supported for new
   * integrations. This compatibility method may be removed in a future major
   * SDK release.
   */
  save(options: CompareSaveOptions | string = {}): void {
    const payload =
      typeof options === "string"
        ? options
        : options?.outputName
          ? { outputName: options.outputName }
          : {};

    if (typeof options === "string" && options.trim().length === 0) {
      throw createCanvasCommandError(
        "compareSave",
        "Compare save outputName must not be empty when provided.",
        {
          options
        }
      );
    }

    if (
      typeof options === "object" &&
      options !== null &&
      options.outputName !== undefined &&
      options.outputName.trim().length === 0
    ) {
      throw createCanvasCommandError(
        "compareSave",
        "Compare save outputName must not be empty when provided.",
        {
          options
        }
      );
    }

    if (typeof options === "object" && options === null) {
      throw createCanvasCommandError(
        "compareSave",
        "Compare save options must be an outputName string or an options object.",
        {
          options
        }
      );
    }

    this.send("compareSave", payload, false);
  }

  private send(
    type: ComparePendingCommand,
    payload: unknown,
    waitsForInteractiveAlignResult: boolean
  ): void {
    this.requireNoPendingCommand(type);
    this.pendingCommand = {
      type,
      waitsForInteractiveAlignResult,
      completed: false
    };

    try {
      requireReadyBroker({
        ...this.options,
        type,
        apiName: "viewer.compare"
      }).send(type, payload);
    } catch (error) {
      this.clearPendingCommand();
      throw error;
    }
  }

  private requireNoPendingCommand(type: ComparePendingCommand): void {
    if (!this.pendingCommand) {
      return;
    }

    throw createCanvasCommandError(
      type,
      `Cannot send ${type} while ${this.pendingCommand.type} is still pending.`,
      {
        pendingType: this.pendingCommand.type
      }
    );
  }

  private clearPendingCommand(): void {
    this.pendingCommand = null;
  }

  private validateCompareAlignPayload(
    type: "compare" | "align",
    payload: CompareAlignPayload
  ): void {
    if (!payload || typeof payload !== "object") {
      throw createCanvasCommandError(
        type,
        "Compare and align require a payload object.",
        {
          payload
        }
      );
    }

    if (!hasText(payload.backgroundUrl) && !hasText(payload.backgroundFileName)) {
      throw createCanvasCommandError(
        type,
        "Compare and align require backgroundUrl or backgroundFileName.",
        {
          payload
        }
      );
    }

    if (!hasText(payload.overlayUrl) && !hasText(payload.overlayFileName)) {
      throw createCanvasCommandError(
        type,
        "Compare and align require overlayUrl or overlayFileName.",
        {
          payload
        }
      );
    }

    const backgroundSource = payload.backgroundUrl ?? payload.backgroundFileName;
    const overlaySource = payload.overlayUrl ?? payload.overlayFileName;
    const backgroundSourceText = hasText(backgroundSource)
      ? backgroundSource.trim()
      : null;
    const overlaySourceText = hasText(overlaySource)
      ? overlaySource.trim()
      : null;

    if (
      backgroundSourceText !== null &&
      overlaySourceText !== null &&
      backgroundSourceText === overlaySourceText
    ) {
      throw createCanvasCommandError(
        type,
        "Compare and align require different background and overlay sources.",
        {
          payload
        }
      );
    }

    if (payload.dpi !== undefined && (!Number.isFinite(payload.dpi) || payload.dpi <= 0)) {
      throw createCanvasCommandError(
        type,
        "Compare and align dpi must be a positive finite number when provided.",
        {
          payload
        }
      );
    }

    this.validateColor(type, payload.backgroundColor, "backgroundColor", payload);
    this.validateColor(type, payload.overlayColor, "overlayColor", payload);
    this.validateColor(type, payload.equalColor, "equalColor", payload);

    if (payload.outputName !== undefined && payload.outputName.trim().length === 0) {
      throw createCanvasCommandError(
        type,
        "Compare and align outputName must not be empty when provided.",
        {
          payload
        }
      );
    }

    if (payload.alignArray === undefined) {
      return;
    }

    if (
      !Array.isArray(payload.alignArray) ||
      payload.alignArray.length > 2 ||
      !payload.alignArray.every(isPlainObject)
    ) {
      throw createCanvasCommandError(
        type,
        "Align alignArray must contain no more than two point objects when provided.",
        {
          payload
        }
      );
    }
  }

  private validateColor(
    type: "compare" | "align",
    color: string | undefined,
    fieldName: "backgroundColor" | "overlayColor" | "equalColor",
    payload: CompareAlignPayload
  ): void {
    if (color === undefined) {
      return;
    }

    if (!isHexColor(color) && !isRgbColor(color)) {
      throw createCanvasCommandError(
        type,
        `Compare and align ${fieldName} must be a hex or RGB color string when provided.`,
        {
          payload
        }
      );
    }
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function isRgbColor(value: string): boolean {
  return /^rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/.test(value);
}

function isInteractiveAlignPayload(payload: CompareAlignPayload): boolean {
  return !payload.alignArray || payload.alignArray.length < 2;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isComparisonErrorPayload(
  payload: ComparisonErrorPayload | undefined
): payload is ComparisonErrorPayload {
  return !!payload && typeof payload === "object" && typeof payload.message === "string";
}

function getProgressMessage(message: string | undefined): string {
  return message ?? "";
}
