import type { GetMeasurementInfoOptions } from "./inspectionTypes.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const isNonnegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoundedText = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 4096;

export const normalizeGuid = (value: string): string =>
  value.trim().replace(/[{}]/g, "").toUpperCase();

const isNativePoint = (value: unknown) =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isMeasurementEdge = (value: unknown): boolean =>
  isRecord(value) &&
  isNonnegativeInteger(value.from) &&
  isNonnegativeInteger(value.to) &&
  ["length", "direction", "horizontal", "vertical"].every((field) =>
    isFiniteNumber(value[field])
  );

export function isValidInspection(
  value: Record<string, unknown>,
  expected: GetMeasurementInfoOptions
): boolean {
  const measurement = value.measurement;
  const geometry = value.geometry;
  const vertex = value.vertex;

  if (
    value.fileIndex !== expected.fileIndex ||
    value.pageIndex !== expected.pageIndex ||
    !isRecord(measurement) ||
    !isRecord(geometry) ||
    measurement.guid !== expected.guid ||
    measurement.pageIndex !== expected.pageIndex ||
    !["Distance", "Area", "Path", "Rectangular area", "Arc", "Angle", "Count"].includes(
      measurement.kind as string
    ) ||
    !isBoundedText(measurement.value) ||
    !isNonnegativeInteger(measurement.vertexCount) ||
    measurement.vertexCount > 1000 ||
    !isNonnegativeInteger(measurement.holeCount) ||
    measurement.holeCount > 128 ||
    typeof measurement.readOnly !== "boolean"
  ) {
    return false;
  }

  if (
    ![
      "name",
      "scaleLabel",
      "horizontal",
      "vertical",
      "perimeter",
      "arcLength",
      "radius"
    ].every(
      (field) => measurement[field] === undefined || isBoundedText(measurement[field])
    ) ||
    (measurement.nameSource !== undefined &&
      !["user", "pdfText", "generated"].includes(measurement.nameSource as string))
  ) {
    return false;
  }

  if (
    typeof geometry.available !== "boolean" ||
    !isNonnegativeInteger(geometry.precision) ||
    geometry.precision > 10 ||
    !["reason", "unit", "scaleKey"].every(
      (field) => geometry[field] === undefined || isBoundedText(geometry[field])
    ) ||
    !["totalLength", "area", "grossArea", "openingsArea"].every(
      (field) => geometry[field] === undefined || isFiniteNumber(geometry[field])
    ) ||
    (geometry.available && typeof geometry.unit !== "string") ||
    (!geometry.available && typeof geometry.reason !== "string") ||
    (geometry.edge !== undefined && !isMeasurementEdge(geometry.edge))
  ) {
    return false;
  }

  if (
    geometry.vertex !== undefined &&
    (!isRecord(geometry.vertex) ||
      !isNonnegativeInteger(geometry.vertex.index) ||
      geometry.vertex.index >= measurement.vertexCount ||
      (expected.vertexIndex !== undefined &&
        geometry.vertex.index !== expected.vertexIndex) ||
      typeof geometry.vertex.interior !== "boolean" ||
      (geometry.vertex.angle !== undefined && !isFiniteNumber(geometry.vertex.angle)) ||
      !["previous", "next"].every(
        (field) =>
          geometry.vertex &&
          isRecord(geometry.vertex) &&
          (geometry.vertex[field] === undefined ||
            isMeasurementEdge(geometry.vertex[field]))
      ))
  ) {
    return false;
  }

  if (
    expected.vertexIndex !== undefined &&
    (!isRecord(vertex) || vertex.index !== expected.vertexIndex)
  ) {
    return false;
  }

  return (
    vertex === undefined ||
    (isRecord(vertex) &&
      isNonnegativeInteger(vertex.index) &&
      vertex.index < measurement.vertexCount &&
      vertex.coordinateSpace === "nativeAnnotation" &&
      isNativePoint(vertex.point))
  );
}

export function isValidSelection(
  value: Record<string, unknown>,
  expected: GetMeasurementInfoOptions
): boolean {
  const selection = value.selection;

  return (
    value.active === true &&
    value.fileIndex === expected.fileIndex &&
    value.pageIndex === expected.pageIndex &&
    value.guid === expected.guid &&
    value.vertexIndex === expected.vertexIndex &&
    isRecord(selection) &&
    selection.guid === expected.guid &&
    selection.pageIndex === expected.pageIndex &&
    selection.vertexIndex === expected.vertexIndex &&
    selection.coordinateSpace === "nativeAnnotation" &&
    isNativePoint(selection.point) &&
    isBoundedText(selection.measurement)
  );
}
