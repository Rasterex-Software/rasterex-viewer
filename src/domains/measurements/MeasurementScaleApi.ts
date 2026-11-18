import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import {
  requireReadyBroker,
  createCanvasCommandError
} from "../canvas/canvasBrokerCommands.js";
import { createCommandTimeoutError } from "../../errors.js";
import { isMeasurementScale, isMeasurementScalesSnapshot } from "./scaleValidation.js";
import type {
  MeasurementsApiOptions,
  MeasurementScaleEventMap,
  MeasurementScaleEventName,
  MeasurementScaleEventHandler,
  MeasurementScaleEventUnsubscribe,
  MeasurementScalesSnapshot,
  RequestMeasurementScalesOptions,
  GetMeasurementScalesOptions,
  AddMeasurementScaleOptions
} from "./types.js";

export class MeasurementScaleApi {
  private readonly options: MeasurementsApiOptions;
  private readonly events = new DomainEventEmitter<MeasurementScaleEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];

  constructor(options: MeasurementsApiOptions) {
    this.options = options;
  }

  on<TEventName extends MeasurementScaleEventName>(
    eventName: TEventName,
    handler: MeasurementScaleEventHandler<TEventName>
  ): MeasurementScaleEventUnsubscribe {
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
      broker.on<MeasurementScalesSnapshot>("scalesSnapshot", (message) => {
        if (isMeasurementScalesSnapshot(message.payload)) {
          this.events.emit("snapshot", message.payload);
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
  }

  request(options: RequestMeasurementScalesOptions = {}): void {
    requireReadyBroker({
      ...this.options,
      type: "getScales",
      apiName: "viewer.measurements.scale"
    }).send("getScales", {
      fileIndex: options.fileIndex
    });
  }

  get(options: GetMeasurementScalesOptions = {}): Promise<MeasurementScalesSnapshot> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "getScales",
      apiName: "viewer.measurements.scale"
    });
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;

    return new Promise<MeasurementScalesSnapshot>((resolve, reject) => {
      const cleanup = broker.on<MeasurementScalesSnapshot>(
        "scalesSnapshot",
        (message) => {
          if (!isMeasurementScalesSnapshot(message.payload)) {
            return;
          }

          if (
            typeof options.fileIndex === "number" &&
            typeof message.payload.fileIndex === "number" &&
            message.payload.fileIndex !== options.fileIndex
          ) {
            return;
          }
          globalThis.clearTimeout(timeoutId);
          cleanup();
          resolve(message.payload);
        }
      );
      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError("scalesSnapshot", "getScales", timeoutMs));
      }, timeoutMs);
      broker.send("getScales", {
        fileIndex: options.fileIndex
      });
    });
  }

  add(options: AddMeasurementScaleOptions): void {
    if (!isMeasurementScale(options.scale)) {
      throw createCanvasCommandError(
        "addScale",
        "Measurement scale requires label, value, metric, metricUnit, dimPrecision, and isSelected.",
        {
          scale: options.scale
        }
      );
    }
    requireReadyBroker({
      ...this.options,
      type: "addScale",
      apiName: "viewer.measurements.scale"
    }).send("addScale", {
      fileIndex: options.fileIndex,
      scale: options.scale
    });
  }
}
