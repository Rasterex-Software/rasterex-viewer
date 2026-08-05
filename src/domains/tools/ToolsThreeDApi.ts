import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { requireReadyBroker, sendCanvasCommandWithResult } from "../canvas/canvasBrokerCommands.js";
import type {
  ThreeDPartSelectedEvent,
  ThreeDPartSelectionClearedEvent,
  ThreeDToolOptions,
  ThreeDToolResult,
  ToolsApiOptions,
  ToolsEventUnsubscribe,
  ToolsThreeDEventHandler,
  ToolsThreeDEventMap,
  ToolsThreeDEventName
} from "./types.js";

export class ToolsThreeDApi {
  private readonly options: ToolsApiOptions;
  private readonly events = new DomainEventEmitter<ToolsThreeDEventMap>();
  private partSelectedCleanup: (() => void) | null = null;
  private selectionClearedCleanup: (() => void) | null = null;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  on<TEventName extends ToolsThreeDEventName>(
    eventName: TEventName,
    handler: ToolsThreeDEventHandler<TEventName>
  ): ToolsEventUnsubscribe {
    this.ensureEventBridge(eventName);
    return this.events.on(eventName, handler);
  }

  setBirdEyeView(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("setBirdEyeView", options);
  }

  resetModel(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("reset3DModel", options);
  }

  setSelect(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DSelect", options);
  }

  setMarkupSelect(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DMarkupSelect", options);
  }

  setWalkthrough(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DWalkthrough", options);
  }

  setHidePartsMode(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DHidePartsMode", options);
  }

  setExplode(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DExplode", options);
  }

  setTransparency(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DTransparency", options);
  }

  setCrossSection(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DCrossSection", options);
  }

  private send(
    type: string,
    options: ThreeDToolOptions
  ): Promise<ThreeDToolResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type,
      resultType: `${type}Result`,
      payload: {
        requestId: options.requestId,
        enabled: options.enabled,
        emitSelectionEvents: options.emitSelectionEvents,
        distance: options.distance,
        valuePercent: options.valuePercent,
        x: options.x,
        y: options.y,
        z: options.z
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }

  private ensureEventBridge(eventName: ToolsThreeDEventName): void {
    const broker = requireReadyBroker({
      ...this.options,
      type: eventName,
      apiName: "viewer.tools"
    });

    if (eventName === "partSelected" && !this.partSelectedCleanup) {
      this.partSelectedCleanup = broker.on<ThreeDPartSelectedEvent>(
        "threeDPartSelected",
        (message) => {
          if (message.payload) {
            this.events.emit("partSelected", message.payload);
          }
        }
      );
    }

    if (eventName === "selectionCleared" && !this.selectionClearedCleanup) {
      this.selectionClearedCleanup = broker.on<ThreeDPartSelectionClearedEvent>(
        "threeDPartSelectionCleared",
        (message) => {
          if (message.payload) {
            this.events.emit("selectionCleared", message.payload);
          }
        }
      );
    }
  }
}
