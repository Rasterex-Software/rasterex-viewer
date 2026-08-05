import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export type MeasurementScaleUnitSystem = string | number;
export type MeasurementScaleMetricUnit = "Millimeter" | "Centimeter" | "Decimeter" | "Meter" | "Kilometer";
export type MeasurementScaleImperialUnit = "Inch" | "Feet" | "Yard" | "Mile" | "Nautical Miles";
export type MeasurementScaleUnit = string;
export type MeasurementScalePageRange = number[];

export interface MeasurementScale {
  label: string; value: string; preciseValue?: number; metric: MeasurementScaleUnitSystem;
  metricUnit: MeasurementScaleUnit; dimPrecision: number; isSelected: boolean;
  isGlobal?: boolean; pageRanges?: MeasurementScalePageRange[]; source?: string;
  imperialNumerator?: number; imperialDenominator?: number;
}
export interface AddMeasurementScaleOptions { fileIndex?: number; scale: MeasurementScale; }
export interface GetMeasurementScalesOptions { fileIndex?: number; timeoutMs?: number; }
export interface RequestMeasurementScalesOptions { fileIndex?: number; }
export interface MeasurementScalesSnapshot { fileIndex?: number; fileName?: string; selectedLabel?: string; scales: MeasurementScale[]; [key: string]: unknown; }
export interface MeasurementScaleEventMap { snapshot: MeasurementScalesSnapshot; }
export type MeasurementScaleEventName = keyof MeasurementScaleEventMap;
export type MeasurementScaleEventHandler<T extends MeasurementScaleEventName> = DomainEventHandler<MeasurementScaleEventMap[T]>;
export type MeasurementScaleEventUnsubscribe = DomainEventUnsubscribe;

export type CalibrationMeasurementSystem = string | number;
export interface CalibrationStartOptions { requestId?: string; fileIndex?: number; measurementSystem?: CalibrationMeasurementSystem; metricType?: CalibrationMeasurementSystem; system?: CalibrationMeasurementSystem; metric?: CalibrationMeasurementSystem; metricUnit?: string; unit?: string; displayUnit?: string; }
/** @deprecated Use CalibrationStartOptions. */
export type CalibrationMetricStartOptions = CalibrationStartOptions;
/** @deprecated Use CalibrationStartOptions. */
export type CalibrationImperialStartOptions = CalibrationStartOptions;
export interface CalibrationCancelOptions { requestId?: string; }
export interface CalibrationFinishedEvent { requestId?: string; fileIndex?: number; fileName?: string; isFinished: boolean; measuredLength?: string | number; [key: string]: unknown; }
export interface CalibrationSetOptions { requestId?: string; fileIndex?: number; measurementSystem?: CalibrationMeasurementSystem; metricType?: CalibrationMeasurementSystem; system?: CalibrationMeasurementSystem; metric?: CalibrationMeasurementSystem; metricUnit?: string; unit?: string; displayUnit?: string; calibrateCorrectionMetricValue?: number | string; calibrateLength?: number | string; calibrateCorrectionFeetValue?: number | string; feet?: number | string; calibrateCorrectionInchValue?: number | string; inches?: number | string; dimPrecision?: number; precisionValue?: number; precision?: number; pageRanges?: MeasurementScalePageRange[]; totalPages?: number; timeoutMs?: number; }
/** @deprecated Use CalibrationSetOptions. */
export type CalibrationMetricSetOptions = CalibrationSetOptions;
/** @deprecated Use CalibrationSetOptions. */
export type CalibrationImperialSetOptions = CalibrationSetOptions;
export interface CalibrationScaleCalculatedEvent { requestId?: string; fileIndex?: number; fileName?: string; scale: MeasurementScale; [key: string]: unknown; }
export interface CalibrationApplyOptions { requestId?: string; scale?: Partial<MeasurementScale>; timeoutMs?: number; }
export interface MeasurementCalibrationEventMap { finished: CalibrationFinishedEvent; scaleCalculated: CalibrationScaleCalculatedEvent; }
export type MeasurementCalibrationEventName = keyof MeasurementCalibrationEventMap;
export type MeasurementCalibrationEventHandler<T extends MeasurementCalibrationEventName> = DomainEventHandler<MeasurementCalibrationEventMap[T]>;
export type MeasurementCalibrationEventUnsubscribe = DomainEventUnsubscribe;
export interface MeasurementsApiOptions { getBroker: () => CanvasMessageBroker | null; getIsReady: () => boolean; commandTimeoutMs: number; }
