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

  constructor(options: ViewerMessagingSessionOptions) {
    this.transport = new IframeTransport(options);
    this.canvasBroker = new CanvasMessageBroker(options);
  }

  start(): void {
    this.transport.start();
    this.canvasBroker.start();
  }

  destroy(): void {
    this.transport.destroy();
    this.canvasBroker.destroy();
  }
}
