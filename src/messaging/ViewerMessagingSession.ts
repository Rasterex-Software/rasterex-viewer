import type { Diagnostics } from "../diagnostics.js";
import { CanvasMessageBroker } from "./CanvasMessageBroker.js";
import { IframeTransport } from "./IframeTransport.js";

export interface ViewerMessagingSessionOptions {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  sdkInstanceId: string;
  diagnostics: Diagnostics;
}

export class ViewerMessagingSession {
  readonly transport: IframeTransport;
  readonly canvasBroker: CanvasMessageBroker;
  private readyCapabilities: readonly string[] | null = null;

  get canvasCapabilities(): readonly string[] | null {
    return this.readyCapabilities;
  }

  constructor(options: ViewerMessagingSessionOptions) {
    this.transport = new IframeTransport(options);
    this.canvasBroker = new CanvasMessageBroker(options);
    // Subscribe before start so viewerReady is retained even before ready().
    this.canvasBroker.on<{ capabilities?: unknown }>("viewerReady", ({ payload }) => {
      const capabilities = payload?.capabilities;
      this.readyCapabilities = Array.isArray(capabilities) &&
        capabilities.every((value): value is string => typeof value === "string")
        ? Object.freeze([...new Set(capabilities)]) : null;
    });
  }

  start(): void {
    this.transport.start();
    this.canvasBroker.start();
  }

  destroy(): void {
    this.readyCapabilities = null;
    this.transport.destroy();
    this.canvasBroker.destroy();
  }
}
