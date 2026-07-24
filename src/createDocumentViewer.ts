import { createViewer } from "./createViewer.js";
import type { DocumentOpenOptions } from "./domains/DocumentsApi.js";
import type { RasterexViewer } from "./RasterexViewer.js";
import type { RasterexViewerOptions } from "./types.js";

export type DocumentViewerDocumentOptions = DocumentOpenOptions &
  ({ url: string } | { path: string });

export interface CreateDocumentViewerOptions extends RasterexViewerOptions {
  document: DocumentViewerDocumentOptions;
}

export async function createDocumentViewer(
  options: CreateDocumentViewerOptions
): Promise<RasterexViewer> {
  const { document, ...viewerOptions } = options;
  const viewer = createViewer(viewerOptions);

  try {
    await viewer.mount();
    await viewer.ready();
    await viewer.documents.open(document);

    return viewer;
  } catch (error) {
    viewer.destroy();
    throw error;
  }
}
