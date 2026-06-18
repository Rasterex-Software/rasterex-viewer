import type { Diagnostics } from "../diagnostics.js";

export interface CanvasMessage<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  message?: string;
}

export interface CanvasMessageBrokerOptions {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  sdkInstanceId: string;
  diagnostics?: Diagnostics;
  windowRef?: Window;
}

export type CanvasMessageHandler<TPayload = unknown> = (
  message: CanvasMessage<TPayload>,
  event: MessageEvent
) => void;

export type CanvasMessageUnsubscribe = () => void;

export class CanvasMessageBroker {
  private readonly iframe: HTMLIFrameElement;
  private readonly targetOrigin: string;
  private readonly sdkInstanceId: string;
  private readonly diagnostics?: Diagnostics;
  private readonly windowRef: Window;
  private readonly handlers = new Map<string, Set<CanvasMessageHandler>>();
  private readonly receivedTypes = new Set<string>();
  private isListening = false;

  constructor(options: CanvasMessageBrokerOptions) {
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

  send<TPayload = unknown>(type: string, payload?: TPayload): void {
    const contentWindow = this.iframe.contentWindow;

    if (!contentWindow) {
      this.emitTransportError(new Error("Rasterex iframe contentWindow is not available."));
      return;
    }

    contentWindow.postMessage({ type, payload }, this.targetOrigin);
    this.diagnostics?.emit("canvas.command.sent", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      type
    });
  }

  on<TPayload = unknown>(
    type: string,
    handler: CanvasMessageHandler<TPayload>
  ): CanvasMessageUnsubscribe {
    const handlers = this.getHandlers(type);
    handlers.add(handler as CanvasMessageHandler);

    return () => {
      handlers.delete(handler as CanvasMessageHandler);
    };
  }

  hasReceived(type: string): boolean {
    return this.receivedTypes.has(type);
  }

  destroy(): void {
    if (this.isListening) {
      this.windowRef.removeEventListener("message", this.handleMessage);
      this.isListening = false;
    }

    this.handlers.clear();
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (event.origin !== this.targetOrigin) {
      return;
    }

    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    if (!this.isCanvasMessage(event.data)) {
      return;
    }

    this.receivedTypes.add(event.data.type);

    this.diagnostics?.emit("canvas.event.received", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      type: event.data.type
    });

    const handlers = this.handlers.get(event.data.type);

    if (!handlers) {
      return;
    }

    for (const handler of [...handlers]) {
      handler(event.data, event);
    }
  };

  private isCanvasMessage(value: unknown): value is CanvasMessage {
    return (
      !!value &&
      typeof value === "object" &&
      typeof (value as Partial<CanvasMessage>).type === "string"
    );
  }

  private getHandlers(type: string): Set<CanvasMessageHandler> {
    const existing = this.handlers.get(type);

    if (existing) {
      return existing;
    }

    const handlers = new Set<CanvasMessageHandler>();
    this.handlers.set(type, handlers);

    return handlers;
  }

  private emitTransportError(error: unknown): void {
    this.diagnostics?.emit("transport.error", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      error
    });
  }
}
