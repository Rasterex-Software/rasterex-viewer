import type {
  MessageEnvelope,
  ProtocolIncomingMessage
} from "@rasterex/viewer-protocol";

import type { Diagnostics } from "../diagnostics.js";

export interface IframeTransportOptions {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  sdkInstanceId: string;
  diagnostics?: Diagnostics;
  windowRef?: Window;
}

export type IframeTransportMessageHandler = (
  message: ProtocolIncomingMessage,
  event: MessageEvent
) => void;

export type IframeTransportUnsubscribe = () => void;

export class IframeTransport {
  private readonly iframe: HTMLIFrameElement;
  private readonly targetOrigin: string;
  private readonly sdkInstanceId: string;
  private readonly diagnostics?: Diagnostics;
  private readonly windowRef: Window;
  private readonly messageHandlers = new Set<IframeTransportMessageHandler>();
  private isListening = false;

  constructor(options: IframeTransportOptions) {
    this.iframe = options.iframe;
    this.targetOrigin = options.targetOrigin;
    this.sdkInstanceId = options.sdkInstanceId;
    this.diagnostics = options.diagnostics;
    this.windowRef = options.windowRef ?? window;
  }

  start(): void {
    if (this.isListening) {
      return;
    }

    this.windowRef.addEventListener("message", this.handleMessage);
    this.isListening = true;
  }

  send<TPayload = unknown>(message: MessageEnvelope<TPayload>): void {
    const contentWindow = this.iframe.contentWindow;

    if (!contentWindow) {
      this.emitTransportError(new Error("Rasterex iframe contentWindow is not available."));
      return;
    }

    contentWindow.postMessage(message, this.targetOrigin);
  }

  onMessage(
    handler: IframeTransportMessageHandler
  ): IframeTransportUnsubscribe {
    this.messageHandlers.add(handler);

    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  destroy(): void {
    if (this.isListening) {
      this.windowRef.removeEventListener("message", this.handleMessage);
      this.isListening = false;
    }

    this.messageHandlers.clear();
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (event.origin !== this.targetOrigin) {
      return;
    }

    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    if (!this.isProtocolIncomingMessage(event.data)) {
      return;
    }

    if (event.data.sdkInstanceId !== this.sdkInstanceId) {
      return;
    }

    for (const handler of [...this.messageHandlers]) {
      handler(event.data, event);
    }
  };

  private isProtocolIncomingMessage(
    value: unknown
  ): value is ProtocolIncomingMessage {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as {
      sdkInstanceId?: unknown;
      protocolVersion?: unknown;
      type?: unknown;
      id?: unknown;
      ok?: unknown;
    };

    return (
      typeof candidate.sdkInstanceId === "string" &&
      typeof candidate.protocolVersion === "string" &&
      (typeof candidate.type === "string" ||
        (typeof candidate.id === "string" && typeof candidate.ok === "boolean"))
    );
  }

  private emitTransportError(error: unknown): void {
    this.diagnostics?.emit("transport.error", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      error
    });
  }
}
