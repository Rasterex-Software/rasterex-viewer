import { RasterexViewer } from "./RasterexViewer.js";
import type { RasterexViewerOptions } from "./types.js";

export function createViewer(options: RasterexViewerOptions): RasterexViewer {
  return new RasterexViewer(options);
}
