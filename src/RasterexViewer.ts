import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_IFRAME_TITLE,
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_VIEWER_URL,
  SDK_VERSION
} from "./constants.js";
import {
  createCanvasReadyTimeoutError,
  createCanvasIframeError,
  createCanvasLoadTimeoutError,
  createContainerNotFoundError,
  createViewerNotReadyError
} from "./errors.js";
import { Diagnostics } from "./diagnostics.js";
import {
  CAPABILITIES,
  PROTOCOL_VERSION,
  VIEWER_READY_MESSAGE_TYPE,
  type Capability,
  type ViewerReadyMessage
} from "@rasterex/viewer-protocol";
import { IframeTransport } from "./messaging/IframeTransport.js";
import { CanvasMessageBroker } from "./messaging/CanvasMessageBroker.js";
import { CanvasApi } from "./domains/CanvasApi.js";
import { DocumentsApi } from "./domains/DocumentsApi.js";
import { AnnotationsApi } from "./domains/AnnotationsApi.js";
import { ToolsApi } from "./domains/ToolsApi.js";
import { evaluateCompatibility } from "./utils/compatibility.js";
import { createSdkInstanceId } from "./utils/createSdkInstanceId.js";
import { deriveOrigin } from "./utils/deriveOrigin.js";
import type {
  RasterexViewerInfo,
  RasterexViewerOptions,
  ViewerState
} from "./types.js";

export class RasterexViewer {
  private readonly container: HTMLElement | string;
  private readonly viewerUrl: string;
  private readonly targetOrigin: string;
  private readonly iframeTitle: string;
  private readonly iframeClassName?: string;
  private readonly iframeAttributes?: Record<string, string>;
  private readonly connectTimeoutMs: number;
  private readonly readyTimeoutMs: number;
  private readonly commandTimeoutMs: number;
  private readonly sdkInstanceId: string;
  readonly diagnostics: Diagnostics;
  readonly canvas: CanvasApi;
  readonly documents: DocumentsApi;
  readonly annotations: AnnotationsApi;
  readonly tools: ToolsApi;
  private state: ViewerState = "idle";
  private iframe: HTMLIFrameElement | null = null;
  private mountPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyCleanup: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private transport: IframeTransport | null = null;
  private canvasBroker: CanvasMessageBroker | null = null;
  private canvasSessionId: string | null = null;
  private canvasVersion: string | null = null;
  private buildDate: string | null = null;
  private capabilities: readonly Capability[] | null = null;
  private minimumSdkVersion: string | null = null;
  private compatibility: RasterexViewerInfo["compatibility"] = null;

  constructor(options: RasterexViewerOptions) {
    this.container = options.container;
    this.viewerUrl = options.viewerUrl ?? DEFAULT_VIEWER_URL;
    this.targetOrigin = options.targetOrigin ?? deriveOrigin(this.viewerUrl);
    this.iframeTitle = options.iframeTitle ?? DEFAULT_IFRAME_TITLE;
    this.iframeClassName = options.iframeClassName;
    this.iframeAttributes = options.iframeAttributes;
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this.sdkInstanceId = createSdkInstanceId();
    this.diagnostics = new Diagnostics(options.debug ?? false);
    this.canvas = new CanvasApi({
      getBroker: () => this.canvasBroker
    });
    this.documents = new DocumentsApi({
      getBroker: () => this.canvasBroker,
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.annotations = new AnnotationsApi({
      getBroker: () => this.canvasBroker,
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.tools = new ToolsApi({
      getBroker: () => this.canvasBroker,
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
  }

  mount(): Promise<void> {
    if (this.iframe && this.iframe.isConnected) {
      return this.mountPromise ?? Promise.resolve();
    }

    const container = this.resolveContainer();
    const iframe = document.createElement("iframe");
    this.state = "mounting";
    this.diagnostics.emit("iframe.mount.started", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      viewerUrl: this.viewerUrl,
      targetOrigin: this.targetOrigin,
      timeoutMs: this.connectTimeoutMs
    });

    iframe.src = this.viewerUrl;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.style.border = "0";
    iframe.title = this.iframeTitle;

    if (this.iframeClassName) {
      iframe.className = this.iframeClassName;
    }

    if (this.iframeAttributes) {
      for (const [name, value] of Object.entries(this.iframeAttributes)) {
        iframe.setAttribute(name, value);
      }
    }

    this.iframe = iframe;
    this.mountPromise = new Promise((resolve, reject) => {
      const fail = (error: Error) => {
        cleanup();
        this.state = "error";
        this.diagnostics.emit("iframe.mount.failed", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          viewerUrl: this.viewerUrl,
          targetOrigin: this.targetOrigin,
          error
        });
        this.diagnostics.emit("transport.error", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          error
        });

        if (this.iframe === iframe) {
          this.iframe = null;
        }

        iframe.remove();
        reject(error);
      };

      const timeoutId = window.setTimeout(() => {
        fail(createCanvasLoadTimeoutError(this.connectTimeoutMs));
      }, this.connectTimeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        iframe.removeEventListener("load", handleLoad);
        iframe.removeEventListener("error", handleError);
        this.mountPromise = null;
      };

      const handleLoad = () => {
        cleanup();
        this.state = "mounted";
        this.transport = new IframeTransport({
          iframe,
          targetOrigin: this.targetOrigin,
          sdkInstanceId: this.sdkInstanceId,
          diagnostics: this.diagnostics
        });
        this.transport.start();
        this.canvasBroker = new CanvasMessageBroker({
          iframe,
          targetOrigin: this.targetOrigin,
          sdkInstanceId: this.sdkInstanceId,
          diagnostics: this.diagnostics
        });
        this.canvasBroker.start();
        this.annotations.connect();
        this.diagnostics.emit("iframe.mount.resolved", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          viewerUrl: this.viewerUrl,
          targetOrigin: this.targetOrigin
        });
        resolve();
      };

      const handleError = () => {
        fail(createCanvasIframeError());
      };

      iframe.addEventListener("load", handleLoad);
      iframe.addEventListener("error", handleError);
      container.appendChild(iframe);
    });

    return this.mountPromise;
  }

  ready(): Promise<void> {
    if (this.state === "ready") {
      return Promise.resolve();
    }

    if (!this.iframe?.isConnected || !this.transport) {
      return Promise.reject(
        createViewerNotReadyError("RasterexViewer must be mounted before ready() is called.")
      );
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.state = "handshaking";
    this.readyPromise = new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | null = null;
      let unsubscribeCanvasReady: (() => void) | null = null;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        unsubscribe?.();
        unsubscribeCanvasReady?.();
        this.readyPromise = null;
        this.readyCleanup = null;
        this.readyReject = null;
      };

      this.readyCleanup = cleanup;
      this.readyReject = reject;

      const fail = (error: Error) => {
        cleanup();
        this.state = "error";
        this.diagnostics.emit("handshake.timeout", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          timeoutMs: this.readyTimeoutMs
        });
        reject(error);
      };

      const timeoutId = window.setTimeout(() => {
        fail(createCanvasReadyTimeoutError(this.readyTimeoutMs));
      }, this.readyTimeoutMs);

      const completeCanvasReady = () => {
        const reason = "Canvas emitted viewerReady using the current Canvas message structure without Protocol V1 handshake metadata.";
        cleanup();
        this.canvasSessionId = "canvas-session-unreported";
        this.canvasVersion = null;
        this.buildDate = null;
        this.capabilities = [
          CAPABILITIES.iframe,
          CAPABILITIES.documentOpen
        ];
        this.minimumSdkVersion = null;
        this.compatibility = {
          state: "degraded",
          reason
        };
        this.diagnostics.emit("compatibility.warning", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          reason
        });
        this.state = "ready";
        this.diagnostics.emit("handshake.complete", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          canvasVersion: "current-canvas",
          canvasSessionId: this.canvasSessionId
        });
        resolve();
      };

      unsubscribe = this.transport?.onMessage((message) => {
        if (!this.isViewerReadyMessage(message)) {
          return;
        }

        cleanup();
        this.canvasSessionId = message.canvasSessionId;
        this.canvasVersion = message.canvasVersion;
        this.buildDate = message.buildDate;
        this.capabilities = message.capabilities;
        this.minimumSdkVersion = message.minimumSdkVersion;
        const compatibility = evaluateCompatibility({
          protocolVersion: message.protocolVersion,
          canvasVersion: message.canvasVersion,
          minimumSdkVersion: message.minimumSdkVersion,
          capabilities: message.capabilities
        });

        this.compatibility = compatibility.result;

        if (compatibility.error) {
          this.state = "error";
          reject(compatibility.error);
          return;
        }

        if (compatibility.result.state === "degraded") {
          this.diagnostics.emit("compatibility.warning", {
            sdkInstanceId: this.sdkInstanceId,
            timestamp: new Date().toISOString(),
            reason: compatibility.result.reason ?? "Canvas compatibility is degraded."
          });
        }

        this.state = "ready";
        this.diagnostics.emit("handshake.complete", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          canvasVersion: message.canvasVersion,
          canvasSessionId: message.canvasSessionId
        });
        resolve();
      }) ?? null;

      if (this.canvasBroker?.hasReceived("viewerReady")) {
        completeCanvasReady();
      } else {
        unsubscribeCanvasReady = this.canvasBroker?.on("viewerReady", () => {
          completeCanvasReady();
        }) ?? null;
      }
    });

    return this.readyPromise;
  }

  destroy(): void {
    if (!this.iframe) {
      this.state = "destroyed";
      this.diagnostics.clear();
      return;
    }

    this.iframe.remove();
    this.iframe = null;
    this.mountPromise = null;
    const rejectReady = this.readyReject;
    this.readyCleanup?.();
    rejectReady?.(
      createViewerNotReadyError("RasterexViewer was destroyed before ready completed.")
    );
    this.readyPromise = null;
    this.readyCleanup = null;
    this.readyReject = null;
    this.transport?.destroy();
    this.transport = null;
    this.annotations.disconnect();
    this.canvasBroker?.destroy();
    this.canvasBroker = null;
    this.state = "destroyed";
    this.diagnostics.emit("iframe.destroyed", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString()
    });
    this.diagnostics.clear();
  }

  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }

  isMounted(): boolean {
    return this.iframe?.isConnected ?? false;
  }

  getInfo(): RasterexViewerInfo {
    return {
      sdkInstanceId: this.sdkInstanceId,
      sdkVersion: SDK_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      viewerUrl: this.viewerUrl,
      targetOrigin: this.targetOrigin,
      state: this.state,
      canvasSessionId: this.canvasSessionId,
      canvasVersion: this.canvasVersion,
      buildDate: this.buildDate,
      capabilities: this.capabilities,
      minimumSdkVersion: this.minimumSdkVersion,
      compatibility: this.compatibility
    };
  }

  private isViewerReadyMessage(
    message: unknown
  ): message is ViewerReadyMessage {
    if (!message || typeof message !== "object") {
      return false;
    }

    const candidate = message as Partial<ViewerReadyMessage>;

    return (
      candidate.type === VIEWER_READY_MESSAGE_TYPE &&
      candidate.sdkInstanceId === this.sdkInstanceId &&
      typeof candidate.canvasSessionId === "string" &&
      typeof candidate.protocolVersion === "string" &&
      typeof candidate.canvasVersion === "string" &&
      typeof candidate.buildDate === "string" &&
      Array.isArray(candidate.capabilities) &&
      typeof candidate.minimumSdkVersion === "string"
    );
  }

  private resolveContainer(): HTMLElement {
    if (typeof this.container !== "string") {
      return this.container;
    }

    const element = document.querySelector<HTMLElement>(this.container);

    if (!element) {
      throw createContainerNotFoundError(this.container);
    }

    return element;
  }
}
