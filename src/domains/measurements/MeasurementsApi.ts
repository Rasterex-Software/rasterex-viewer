import type {
  GetMeasurementInfoOptions,
  SelectMeasurementVertexOptions,
  MeasurementRequestOptions,
  MeasurementInfoResult,
  MeasurementVertexSelectedResult,
  MeasurementVertexSelectionClearedResult
} from "./inspectionTypes.js";
import { MeasurementScaleApi } from "./MeasurementScaleApi.js";
import { MeasurementInspectionApi } from "./MeasurementInspectionApi.js";
import { isMeasurementScale, isMeasurementScalesSnapshot } from "./scaleValidation.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import { createCommandTimeoutError } from "../../errors.js";
import { createRequestId } from "../../utils/createRequestId.js";
import type {
  CalibrationApplyOptions,
  CalibrationCancelOptions,
  CalibrationMeasurementSystem,
  CalibrationFinishedEvent,
  CalibrationScaleCalculatedEvent,
  CalibrationSetOptions,
  CalibrationStartOptions,
  MeasurementCalibrationEventHandler,
  MeasurementCalibrationEventMap,
  MeasurementCalibrationEventName,
  MeasurementCalibrationEventUnsubscribe,
  MeasurementScale,
  MeasurementScalePageRange,
  MeasurementScalesSnapshot,
  MeasurementsApiOptions
} from "./types.js";
export { MeasurementScaleApi } from "./MeasurementScaleApi.js";
export type * from "./types.js";

type CalibrationSetPayload = {
  requestId: string;
  fileIndex?: number;
  measurementSystem?: CalibrationMeasurementSystem;
  metricType?: CalibrationMeasurementSystem;
  system?: CalibrationMeasurementSystem;
  metric?: CalibrationMeasurementSystem;
  metricUnit?: string;
  unit?: string;
  displayUnit?: string;
  calibrateCorrectionMetricValue?: number | string;
  calibrateLength?: number | string;
  calibrateCorrectionFeetValue?: number | string;
  feet?: number | string;
  calibrateCorrectionInchValue?: number | string;
  inches?: number | string;
  dimPrecision?: number;
  precisionValue?: number;
  precision?: number;
  pageRanges?: MeasurementScalePageRange[];
  totalPages?: number;
};

export class MeasurementsApi {
  private readonly inspection: MeasurementInspectionApi;
  readonly scale: MeasurementScaleApi;
  readonly calibration: MeasurementCalibrationApi;

  constructor(options: MeasurementsApiOptions) {
    this.inspection = new MeasurementInspectionApi(options);
    this.scale = new MeasurementScaleApi(options);
    this.calibration = new MeasurementCalibrationApi(options);
  }

  getInfo(options: GetMeasurementInfoOptions): Promise<MeasurementInfoResult> {
    return this.inspection.getInfo(options);
  }

  selectVertex(
    options: SelectMeasurementVertexOptions
  ): Promise<MeasurementVertexSelectedResult> {
    return this.inspection.selectVertex(options);
  }

  clearVertexSelection(
    options: MeasurementRequestOptions = {}
  ): Promise<MeasurementVertexSelectionClearedResult> {
    return this.inspection.clearVertexSelection(options);
  }

  connect(): void {
    this.scale.connect();
    this.calibration.connect();
  }

  disconnect(): void {
    this.inspection.disconnect();
    this.scale.disconnect();
    this.calibration.disconnect();
  }
}

export class MeasurementCalibrationApi {
  private readonly options: MeasurementsApiOptions;
  private readonly events = new DomainEventEmitter<MeasurementCalibrationEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private activeRequestId: string | null = null;

  constructor(options: MeasurementsApiOptions) {
    this.options = options;
  }

  on<TEventName extends MeasurementCalibrationEventName>(
    eventName: TEventName,
    handler: MeasurementCalibrationEventHandler<TEventName>
  ): MeasurementCalibrationEventUnsubscribe {
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
      broker.on<CalibrationFinishedEvent>("calibrationFinished", (message) => {
        if (isCalibrationFinishedEvent(message.payload)) {
          this.events.emit("finished", message.payload);
        }
      }),
      broker.on<CalibrationScaleCalculatedEvent>(
        "calibrationScaleCalculated",
        (message) => {
          if (isCalibrationScaleCalculatedEvent(message.payload)) {
            this.events.emit("scaleCalculated", message.payload);
          }
        }
      )
    ];
  }

  disconnect(): void {
    for (const cleanup of this.brokerCleanups) {
      cleanup();
    }
    this.brokerCleanups = [];
    this.broker = null;
  }

  start(options: CalibrationStartOptions = {}): string {
    const requestId = normalizeRequestId(options.requestId);
    this.requireAvailableRequest(requestId, "calibrationStart");
    requireReadyBroker({
      ...this.options,
      type: "calibrationStart",
      apiName: "viewer.measurements.calibration"
    }).send(
      "calibrationStart",
      omitUndefined({
        requestId,
        fileIndex: options.fileIndex,
        measurementSystem: options.measurementSystem,
        metricType: options.metricType,
        system: options.system,
        metric: options.metric,
        metricUnit: options.metricUnit,
        unit: options.unit,
        displayUnit: options.displayUnit
      })
    );
    this.activeRequestId = requestId;

    return requestId;
  }

  calculate(options: CalibrationSetOptions): Promise<CalibrationScaleCalculatedEvent> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "calibrationSet",
      apiName: "viewer.measurements.calibration"
    });
    const requestId = normalizeRequestId(options.requestId);
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    this.requireAvailableRequest(requestId, "calibrationSet");
    const payload = this.createCalibrationSetPayload(options, requestId);
    this.activeRequestId = requestId;

    return new Promise<CalibrationScaleCalculatedEvent>((resolve, reject) => {
      const cleanup = broker.on<CalibrationScaleCalculatedEvent>(
        "calibrationScaleCalculated",
        (message) => {
          if (!isCalibrationScaleCalculatedEvent(message.payload)) {
            return;
          }

          if (message.payload.requestId && message.payload.requestId !== requestId) {
            return;
          }
          globalThis.clearTimeout(timeoutId);
          cleanup();
          resolve(message.payload);
        }
      );
      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.clearActiveRequest(requestId);
        reject(createCommandTimeoutError(requestId, "calibrationSet", timeoutMs));
      }, timeoutMs);
      broker.send("calibrationSet", payload);
    });
  }

  apply(options: CalibrationApplyOptions = {}): Promise<MeasurementScalesSnapshot> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "calibrationAddScale",
      apiName: "viewer.measurements.calibration"
    });
    const requestId = normalizeRequestId(options.requestId);
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    this.requireAvailableRequest(requestId, "calibrationAddScale");
    this.activeRequestId = requestId;

    return new Promise<MeasurementScalesSnapshot>((resolve, reject) => {
      const cleanup = broker.on<MeasurementScalesSnapshot>(
        "scalesSnapshot",
        (message) => {
          if (!isMeasurementScalesSnapshot(message.payload)) {
            return;
          }
          globalThis.clearTimeout(timeoutId);
          cleanup();
          this.clearActiveRequest(requestId);
          resolve(message.payload);
        }
      );
      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.clearActiveRequest(requestId);
        reject(createCommandTimeoutError(requestId, "calibrationAddScale", timeoutMs));
      }, timeoutMs);
      broker.send(
        "calibrationAddScale",
        omitUndefined({
          requestId,
          scale: options.scale
        })
      );
    });
  }

  cancel(options: CalibrationCancelOptions = {}): void {
    const requestId = options.requestId?.trim() || undefined;
    requireReadyBroker({
      ...this.options,
      type: "calibrationCancel",
      apiName: "viewer.measurements.calibration"
    }).send(
      "calibrationCancel",
      omitUndefined({
        requestId
      })
    );

    if (!requestId || requestId === this.activeRequestId) {
      this.activeRequestId = null;
    }
  }

  private createCalibrationSetPayload(
    options: CalibrationSetOptions,
    requestId: string
  ): CalibrationSetPayload {
    return omitUndefined({
      requestId,
      fileIndex: options.fileIndex,
      measurementSystem: options.measurementSystem,
      metricType: options.metricType,
      system: options.system,
      metric: options.metric,
      metricUnit: options.metricUnit,
      unit: options.unit,
      displayUnit: options.displayUnit,
      calibrateCorrectionMetricValue: options.calibrateCorrectionMetricValue,
      calibrateLength: options.calibrateLength,
      calibrateCorrectionFeetValue: options.calibrateCorrectionFeetValue,
      feet: options.feet,
      calibrateCorrectionInchValue: options.calibrateCorrectionInchValue,
      inches: options.inches,
      dimPrecision: options.dimPrecision,
      precisionValue: options.precisionValue,
      precision: options.precision,
      pageRanges: options.pageRanges,
      totalPages: options.totalPages
    });
  }

  private requireAvailableRequest(requestId: string, type: string): void {
    if (this.activeRequestId && this.activeRequestId !== requestId) {
      throw createCanvasCommandError(
        type,
        "Only one measurement calibration flow can be active for a viewer iframe.",
        {
          activeRequestId: this.activeRequestId,
          requestId
        }
      );
    }
  }

  private clearActiveRequest(requestId: string): void {
    if (this.activeRequestId === requestId) {
      this.activeRequestId = null;
    }
  }
}

function omitUndefined<TPayload extends Record<string, unknown>>(
  payload: TPayload
): TPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as TPayload;
}

function normalizeRequestId(requestId: string | undefined): string {
  const normalizedRequestId = requestId?.trim();

  return normalizedRequestId || createRequestId();
}

function isCalibrationFinishedEvent(
  payload: CalibrationFinishedEvent | undefined
): payload is CalibrationFinishedEvent {
  return !!payload && typeof payload === "object" && payload.isFinished === true;
}

function isCalibrationScaleCalculatedEvent(
  payload: CalibrationScaleCalculatedEvent | undefined
): payload is CalibrationScaleCalculatedEvent {
  return !!payload && typeof payload === "object" && isMeasurementScale(payload.scale);
}
