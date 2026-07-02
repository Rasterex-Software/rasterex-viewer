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

export type MeasurementScaleUnitSystem =
  | "0"
  | "1"
  | "METRIC"
  | "IMPERIAL"
  | 0
  | 1
  | 2;

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

export type MeasurementScaleUnit =
  | MeasurementScaleMetricUnit
  | MeasurementScaleImperialUnit;

export type MeasurementScalePageRange = [number, number];

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

export type CalibrationMeasurementSystem = 1 | 2;

export interface CalibrationStartOptions {
  requestId?: string;
  fileIndex?: number;
}

export interface CalibrationCancelOptions {
  requestId?: string;
  fileIndex?: number;
}

export interface CalibrationFinishedEvent {
  requestId?: string;
  fileIndex?: number;
  fileName?: string;
  isFinished: boolean;
  measuredLength?: string | number;
  [key: string]: unknown;
}

export interface CalibrationMetricSetOptions {
  requestId?: string;
  fileIndex?: number;
  measurementSystem: 1;
  metricUnit: MeasurementScaleMetricUnit;
  calibrateCorrectionMetricValue: number | string;
  dimPrecision: number;
  pageRanges?: MeasurementScalePageRange[];
  totalPages?: number;
  timeoutMs?: number;
}

export interface CalibrationImperialSetOptions {
  requestId?: string;
  fileIndex?: number;
  measurementSystem: 2;
  calibrateCorrectionFeetValue?: number | string;
  calibrateCorrectionInchValue?: number | string;
  dimPrecision: number;
  pageRanges?: MeasurementScalePageRange[];
  totalPages?: number;
  timeoutMs?: number;
}

export type CalibrationSetOptions =
  | CalibrationMetricSetOptions
  | CalibrationImperialSetOptions;

type CalibrationSetPayload = {
  requestId: string;
  fileIndex?: number;
  measurementSystem: CalibrationMeasurementSystem;
  metricUnit?: MeasurementScaleMetricUnit;
  calibrateCorrectionMetricValue?: number;
  calibrateCorrectionFeetValue?: number;
  calibrateCorrectionInchValue?: number;
  dimPrecision: number;
  precision: number;
  precisionValue: number;
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
  fileIndex?: number;
  scale?: MeasurementScale;
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
    const requestId = options.requestId ?? createRequestId();
    this.requireAvailableRequest(requestId, "startCalibrationV2");

    requireReadyBroker({
      ...this.options,
      type: "startCalibrationV2",
      apiName: "viewer.measurements.calibration"
    }).send("startCalibrationV2", {
      requestId,
      fileIndex: options.fileIndex
    });

    this.activeRequestId = requestId;

    return requestId;
  }

  calculate(options: CalibrationSetOptions): Promise<CalibrationScaleCalculatedEvent> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "setCalibrationV2",
      apiName: "viewer.measurements.calibration"
    });
    const requestId = options.requestId ?? createRequestId();
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    this.requireAvailableRequest(requestId, "setCalibrationV2");
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
        reject(createCommandTimeoutError(requestId, "setCalibrationV2", timeoutMs));
      }, timeoutMs);

      broker.send("setCalibrationV2", payload);
    });
  }

  apply(options: CalibrationApplyOptions = {}): Promise<MeasurementScalesSnapshot> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "addCalibrationScaleV2",
      apiName: "viewer.measurements.calibration"
    });
    const requestId = options.requestId ?? createRequestId();
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    this.requireAvailableRequest(requestId, "addCalibrationScaleV2");

    if (options.scale && !isMeasurementScale(options.scale)) {
      throw createCanvasCommandError(
        "addCalibrationScaleV2",
        "Calibration apply scale requires label, value, metric, metricUnit, dimPrecision, and isSelected.",
        {
          scale: options.scale
        }
      );
    }

    this.activeRequestId = requestId;

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
        this.clearActiveRequest(requestId);
        resolve(message.payload);
      });

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.clearActiveRequest(requestId);
        reject(createCommandTimeoutError(requestId, "addCalibrationScaleV2", timeoutMs));
      }, timeoutMs);

      broker.send("addCalibrationScaleV2");
    });
  }

  cancel(options: CalibrationCancelOptions = {}): void {
    requireReadyBroker({
      ...this.options,
      type: "cancelCalibration",
      apiName: "viewer.measurements.calibration"
    }).send("cancelCalibration", {
      requestId: options.requestId,
      fileIndex: options.fileIndex
    });

    if (!options.requestId || options.requestId === this.activeRequestId) {
      this.activeRequestId = null;
    }
  }

  private createCalibrationSetPayload(
    options: CalibrationSetOptions,
    requestId: string
  ): CalibrationSetPayload {
    this.validateCommonCalibrationSet(options);

    if (options.measurementSystem === 1) {
      if (!isMetricUnit(options.metricUnit)) {
        throw createCanvasCommandError(
          "setCalibrationV2",
          "Metric calibration requires a supported metricUnit.",
          {
            options
          }
        );
      }

      const metricValue = parseFiniteNumber(options.calibrateCorrectionMetricValue);

      if (metricValue === null || metricValue <= 0) {
        throw createCanvasCommandError(
          "setCalibrationV2",
          "Metric calibration requires a positive finite calibrateCorrectionMetricValue.",
          {
            options
          }
        );
      }

      return {
        requestId,
        fileIndex: options.fileIndex,
        measurementSystem: 1,
        metricUnit: options.metricUnit,
        calibrateCorrectionMetricValue: metricValue,
        dimPrecision: options.dimPrecision,
        precision: options.dimPrecision,
        precisionValue: options.dimPrecision,
        pageRanges: options.pageRanges,
        totalPages: options.totalPages
      };
    }

    const feet = parseFiniteNumber(options.calibrateCorrectionFeetValue);
    const inches = parseFiniteNumber(options.calibrateCorrectionInchValue);

    if (
      (options.calibrateCorrectionFeetValue !== undefined && feet === null) ||
      (options.calibrateCorrectionInchValue !== undefined && inches === null) ||
      (feet !== null && feet < 0) ||
      (inches !== null && inches < 0)
    ) {
      throw createCanvasCommandError(
        "setCalibrationV2",
        "Imperial calibration feet and inches must be finite non-negative numbers.",
        {
          options
        }
      );
    }

    if ((feet ?? 0) <= 0 && (inches ?? 0) <= 0) {
      throw createCanvasCommandError(
        "setCalibrationV2",
        "Imperial calibration requires calibrateCorrectionFeetValue or calibrateCorrectionInchValue greater than zero.",
        {
          options
        }
      );
    }

    return {
      requestId,
      fileIndex: options.fileIndex,
      measurementSystem: 2,
      calibrateCorrectionFeetValue: feet ?? undefined,
      calibrateCorrectionInchValue: inches ?? undefined,
      dimPrecision: options.dimPrecision,
      precision: options.dimPrecision,
      precisionValue: options.dimPrecision,
      pageRanges: options.pageRanges,
      totalPages: options.totalPages
    };
  }

  private validateCommonCalibrationSet(options: CalibrationSetOptions): void {
    if (!Number.isInteger(options.dimPrecision) || options.dimPrecision < 0) {
      throw createCanvasCommandError(
        "setCalibrationV2",
        "Calibration dimPrecision must be a non-negative integer.",
        {
          options
        }
      );
    }

    if (
      options.totalPages !== undefined &&
      (!Number.isInteger(options.totalPages) || options.totalPages < 1)
    ) {
      throw createCanvasCommandError(
        "setCalibrationV2",
        "Calibration totalPages must be a positive integer when provided.",
        {
          options
        }
      );
    }

    if (!options.pageRanges) {
      return;
    }

    for (const pageRange of options.pageRanges) {
      const [start, end] = pageRange;

      if (
        !Array.isArray(pageRange) ||
        pageRange.length !== 2 ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        (options.totalPages !== undefined && end > options.totalPages)
      ) {
        throw createCanvasCommandError(
          "setCalibrationV2",
          "Calibration pageRanges must contain 1-based inclusive [start, end] integer ranges within totalPages when provided.",
          {
            options
          }
        );
      }
    }
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
  return (
    metric === "0" ||
    metric === "1" ||
    metric === "METRIC" ||
    metric === "IMPERIAL" ||
    metric === 0 ||
    metric === 1 ||
    metric === 2
  );
}

function isMetricUnit(unit: unknown): unit is MeasurementScaleMetricUnit {
  return (
    unit === "Millimeter" ||
    unit === "Centimeter" ||
    unit === "Decimeter" ||
    unit === "Meter" ||
    unit === "Kilometer"
  );
}

function parseFiniteNumber(value: number | string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
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
