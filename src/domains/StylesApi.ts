import type { CanvasMessageBroker } from "../messaging/CanvasMessageBroker.js";
import { createCommandTimeoutError } from "../errors.js";
import {
  requireReadyBroker,
  sendCanvasFireAndForget
} from "./canvasBrokerCommands.js";

export interface GlobalAppearanceOptions {
  strokeColor?: string;
  fillColor?: string;
  textColor?: string;
  lineWidth?: number;
  lineStyle?: number;
  transparency?: number;
}

export interface AnnotationProperties {
  strokeColor?: string;
  fillColor?: string;
  textColor?: string;
  lineWidth?: number;
  lineStyle?: number;
  transparency?: number;
  locked?: boolean;
  text?: string;
  countType?: number;
  arrowType?: number;
  measureType?: number;
}

export interface GetAnnotationPropertiesOptions {
  guid: string;
  timeoutMs?: number;
}

export interface SetAnnotationPropertiesOptions {
  guid: string;
  props: AnnotationProperties;
}

export interface AnnotationPropertiesResult {
  guid: string;
  success: boolean;
  props?: AnnotationProperties;
  error?: string;
  [key: string]: unknown;
}

export interface StylesApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}

export class StylesApi {
  private readonly options: StylesApiOptions;

  constructor(options: StylesApiOptions) {
    this.options = options;
  }

  setGlobalAppearance(options: GlobalAppearanceOptions): void {
    sendCanvasFireAndForget({
      ...this.options,
      type: "setGlobalAppearance",
      payload: options,
      apiName: "viewer.styles"
    });
  }

  getAnnotationProperties(
    options: GetAnnotationPropertiesOptions
  ): Promise<AnnotationPropertiesResult> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "getAnnotationProperties",
      apiName: "viewer.styles"
    });
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;

    return new Promise<AnnotationPropertiesResult>((resolve, reject) => {
      const cleanup = broker.on<AnnotationPropertiesResult>(
        "annotationProperties",
        (message) => {
          const payload = message.payload;

          if (!payload || payload.guid !== options.guid) {
            return;
          }

          globalThis.clearTimeout(timeoutId);
          cleanup();
          resolve(payload);
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(options.guid, "getAnnotationProperties", timeoutMs));
      }, timeoutMs);

      broker.send("getAnnotationProperties", {
        guid: options.guid
      });
    });
  }

  setAnnotationProperties(options: SetAnnotationPropertiesOptions): void {
    sendCanvasFireAndForget({
      ...this.options,
      type: "setAnnotationProperties",
      payload: {
        guid: options.guid,
        props: options.props
      },
      apiName: "viewer.styles"
    });
  }
}
