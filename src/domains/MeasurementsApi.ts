import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../messaging/CanvasMessageBroker.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "./canvasBrokerCommands.js";
import { createCommandTimeoutError } from "../errors.js";
import { createRequestId } from "../utils/createRequestId.js";

export type MeasurementScaleUnitSystem = string | number;

export type MeasurementScaleMetricUnit =
  | "Millimeter"
  | "Centimeter"
  | "Decimeter"
  | "Meter"
  | "Kilometer";

export type MeasurementScaleImperialUnit =
  | "Inch"
  | "Feet"
  | "Yard"
  | "Mile"
  | "Nautical Miles";

export type MeasurementScaleUnit = string;

export type MeasurementScalePageRange = number[];

export interface MeasurementScale {
  label: string;
  value: string;
  preciseValue?: number;
  metric: MeasurementScaleUnitSystem;
  metricUnit: MeasurementScaleUnit;
  dimPrecision: number;
  isSelected: boolean;
  isGlobal?: boolean;
  pageRanges?: MeasurementScalePageRange[];
  source?: string;
  imperialNumerator?: number;
  imperialDenominator?: number;
}

export interface AddMeasurementScaleOptions {
  fileIndex?: number;
  scale: MeasurementScale;
}

export interface GetMeasurementScalesOptions {
  fileIndex?: number;
  timeoutMs?: number;
}

export interface RequestMeasurementScalesOptions {
  fileIndex?: number;
}

export interface MeasurementScalesSnapshot {
  fileIndex?: number;
  fileName?: string;
  selectedLabel?: string;
  scales: MeasurementScale[];
  [key: string]: unknown;
}

export interface MeasurementScaleEventMap {
  snapshot: MeasurementScalesSnapshot;
}

export type MeasurementScaleEventName = keyof MeasurementScaleEventMap;
export type MeasurementScaleEventHandler<TEventName extends MeasurementScaleEventName> =
  DomainEventHandler<MeasurementScaleEventMap[TEventName]>;
export type MeasurementScaleEventUnsubscribe = DomainEventUnsubscribe;

export type CalibrationMeasurementSystem = string | number;

export interface CalibrationStartOptions {
  requestId?: string;
  fileIndex?: number;
  measurementSystem?: CalibrationMeasurementSystem;
  metricType?: CalibrationMeasurementSystem;
  system?: CalibrationMeasurementSystem;
  metric?: CalibrationMeasurementSystem;
  metricUnit?: string;
  unit?: string;
  displayUnit?: string;
}

/** @deprecated Use CalibrationStartOptions. */
export type CalibrationMetricStartOptions = CalibrationStartOptions;
/** @deprecated Use CalibrationStartOptions. */
export type CalibrationImperialStartOptions = CalibrationStartOptions;

export interface CalibrationCancelOptions {
  requestId?: string;
}

export interface CalibrationFinishedEvent {
  requestId?: string;
  fileIndex?: number;
  fileName?: string;
  isFinished: boolean;
  measuredLength?: string | number;
  [key: string]: unknown;
}

export interface CalibrationSetOptions {
  requestId?: string;
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
  timeoutMs?: number;
}

/** @deprecated Use CalibrationSetOptions. */
export type CalibrationMetricSetOptions = CalibrationSetOptions;
/** @deprecated Use CalibrationSetOptions. */
export type CalibrationImperialSetOptions = CalibrationSetOptions;

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

export interface CalibrationScaleCalculatedEvent {
  requestId?: string;
  fileIndex?: number;
  fileName?: string;
  scale: MeasurementScale;
  [key: string]: unknown;
}

export interface CalibrationApplyOptions {
  requestId?: string;
  scale?: Partial<MeasurementScale>;
  timeoutMs?: number;
}

export interface MeasurementCalibrationEventMap {
  finished: CalibrationFinishedEvent;
  scaleCalculated: CalibrationScaleCalculatedEvent;
}

export type MeasurementCalibrationEventName = keyof MeasurementCalibrationEventMap;
export type MeasurementCalibrationEventHandler<
  TEventName extends MeasurementCalibrationEventName
> = DomainEventHandler<MeasurementCalibrationEventMap[TEventName]>;
export type MeasurementCalibrationEventUnsubscribe = DomainEventUnsubscribe;

export interface MeasurementsApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}

export class MeasurementsApi {
  readonly scale: MeasurementScaleApi;
  readonly calibration: MeasurementCalibrationApi;

  constructor(options: MeasurementsApiOptions) {
    this.scale = new MeasurementScaleApi(options);
    this.calibration = new MeasurementCalibrationApi(options);
  }

  connect(): void {
    this.scale.connect();
    this.calibration.connect();
  }

  disconnect(): void {
    this.scale.disconnect();
    this.calibration.disconnect();
  }
}

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
      const cleanup = broker.on<MeasurementScalesSnapshot>("scalesSnapshot", (message) => {
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
      });

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
    }).send("calibrationStart", omitUndefined({
      requestId,
      fileIndex: options.fileIndex,
      measurementSystem: options.measurementSystem,
      metricType: options.metricType,
      system: options.system,
      metric: options.metric,
      metricUnit: options.metricUnit,
      unit: options.unit,
      displayUnit: options.displayUnit
    }));

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
      const cleanup = broker.on<MeasurementScalesSnapshot>("scalesSnapshot", (message) => {
        if (!isMeasurementScalesSnapshot(message.payload)) {
          return;
        }

        globalThis.clearTimeout(timeoutId);
        cleanup();
        this.clearActiveRequest(requestId);
        resolve(message.payload);
      });

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.clearActiveRequest(requestId);
        reject(createCommandTimeoutError(requestId, "calibrationAddScale", timeoutMs));
      }, timeoutMs);

      broker.send("calibrationAddScale", omitUndefined({
        requestId,
        scale: options.scale
      }));
    });
  }

  cancel(options: CalibrationCancelOptions = {}): void {
    const requestId = options.requestId?.trim() || undefined;

    requireReadyBroker({
      ...this.options,
      type: "calibrationCancel",
      apiName: "viewer.measurements.calibration"
    }).send("calibrationCancel", omitUndefined({
      requestId
    }));

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

function isMeasurementScalesSnapshot(
  payload: MeasurementScalesSnapshot | undefined
): payload is MeasurementScalesSnapshot {
  return !!payload && typeof payload === "object" && Array.isArray(payload.scales);
}

function isMeasurementScale(scale: MeasurementScale | undefined): scale is MeasurementScale {
  return (
    !!scale &&
    typeof scale.label === "string" &&
    typeof scale.value === "string" &&
    isMeasurementScaleUnitSystem(scale.metric) &&
    typeof scale.metricUnit === "string" &&
    typeof scale.dimPrecision === "number" &&
    typeof scale.isSelected === "boolean"
  );
}

function isMeasurementScaleUnitSystem(
  metric: unknown
): metric is MeasurementScaleUnitSystem {
  return typeof metric === "string" || typeof metric === "number";
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
