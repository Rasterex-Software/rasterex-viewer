import type {
  MeasurementScale,
  MeasurementScalesSnapshot,
  MeasurementScaleUnitSystem
} from "./types.js";

export function isMeasurementScalesSnapshot(
  payload: MeasurementScalesSnapshot | undefined
): payload is MeasurementScalesSnapshot {
  return !!payload && typeof payload === "object" && Array.isArray(payload.scales);
}

export function isMeasurementScale(
  scale: MeasurementScale | undefined
): scale is MeasurementScale {
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

export function isMeasurementScaleUnitSystem(
  metric: unknown
): metric is MeasurementScaleUnitSystem {
  return typeof metric === "string" || typeof metric === "number";
}
