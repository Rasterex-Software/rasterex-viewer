import { RasterexViewer } from "./RasterexViewer.js";
import type { RasterexViewerOptions } from "./types/index.js";

export function createViewer(options: RasterexViewerOptions): RasterexViewer {
  return new RasterexViewer(options);
}
