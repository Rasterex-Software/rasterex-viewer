export interface MeasurementRequestOptions {
  requestId?: string;
  timeoutMs?: number;
}

export interface GetMeasurementInfoOptions extends MeasurementRequestOptions {
  fileIndex: number;
  pageIndex: number;
  guid: string;
  vertexIndex?: number;
}

export interface SelectMeasurementVertexOptions extends GetMeasurementInfoOptions {
  vertexIndex: number;
}

export interface NativeAnnotationPoint {
  x: number;
  y: number;
}

export interface MeasurementInfo {
  guid: string;
  pageIndex: number;
  kind: "Distance" | "Area" | "Path" | "Rectangular area" | "Arc" | "Angle" | "Count";
  name?: string;
  nameSource?: "user" | "pdfText" | "generated";
  value: string;
  scaleLabel?: string;
  vertexCount: number;
  holeCount: number;
  readOnly: boolean;
  horizontal?: string;
  vertical?: string;
  perimeter?: string;
  arcLength?: string;
  radius?: string;
}

export interface MeasurementEdgeInfo {
  from: number;
  to: number;
  length: number;
  direction: number;
  horizontal: number;
  vertical: number;
}

export interface MeasurementGeometryInfo {
  available: boolean;
  reason?: string;
  unit?: string;
  precision: number;
  scaleKey?: string;
  totalLength?: number;
  area?: number;
  grossArea?: number;
  openingsArea?: number;
  vertex?: {
    index: number;
    previous?: MeasurementEdgeInfo;
    next?: MeasurementEdgeInfo;
    angle?: number;
    interior: boolean;
  };
  edge?: MeasurementEdgeInfo;
}

export interface MeasurementVertexInfo {
  index: number;
  point: NativeAnnotationPoint;
  coordinateSpace: "nativeAnnotation";
}

export interface NativeMeasurementVertexSelection {
  guid: string;
  pageIndex: number;
  vertexIndex: number;
  point: NativeAnnotationPoint;
  coordinateSpace: "nativeAnnotation";
  measurement: string;
}

export interface MeasurementInfoResult {
  success: true;
  requestId: string;
  fileIndex: number;
  pageIndex: number;
  measurement: MeasurementInfo;
  geometry: MeasurementGeometryInfo;
  vertex?: MeasurementVertexInfo;
}

export interface MeasurementVertexSelectedResult {
  success: true;
  requestId: string;
  active: true;
  fileIndex: number;
  pageIndex: number;
  guid: string;
  vertexIndex: number;
  selection: NativeMeasurementVertexSelection;
}

export interface MeasurementVertexSelectionClearedResult {
  success: true;
  requestId: string;
  active: false;
}
