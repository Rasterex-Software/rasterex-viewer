import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_IFRAME_TITLE,
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_VIEWER_URL,
  SDK_VERSION
} from "./constants.js";
import {
  createCanvasIframeError,
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
} from "./protocol/index.js";
import { ViewerMessagingSession } from "./messaging/ViewerMessagingSession.js";
import { CanvasApi } from "./domains/CanvasApi.js";
import { DocumentsApi } from "./domains/DocumentsApi.js";
import { AnnotationsApi } from "./domains/AnnotationsApi.js";
import { ToolsApi } from "./domains/ToolsApi.js";
import { MeasurementsApi } from "./domains/MeasurementsApi.js";
import { CompareApi } from "./domains/CompareApi.js";
import { CollaborationApi } from "./domains/CollaborationApi.js";
import { StylesApi } from "./domains/StylesApi.js";
import { LayersApi } from "./domains/LayersApi.js";
import { BlocksApi } from "./domains/BlocksApi.js";
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
  readonly measurements: MeasurementsApi;
  readonly compare: CompareApi;
  readonly collaboration: CollaborationApi;
  readonly styles: StylesApi;
  readonly layers: LayersApi;
  readonly blocks: BlocksApi;
  private state: ViewerState = "idle";
  private iframe: HTMLIFrameElement | null = null;
  private mountPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyCleanup: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private messagingSession: ViewerMessagingSession | null = null;
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
      getBroker: () => this.getCanvasBroker()
    });
    this.documents = new DocumentsApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.annotations = new AnnotationsApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.tools = new ToolsApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.measurements = new MeasurementsApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.compare = new CompareApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready"
    });
    this.collaboration = new CollaborationApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.styles = new StylesApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.layers = new LayersApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
    this.blocks = new BlocksApi({
      getBroker: () => this.getCanvasBroker(),
      getIsReady: () => this.state === "ready",
      commandTimeoutMs: this.commandTimeoutMs
    });
  }

  mount(): Promise<void> {
    if (this.iframe && this.iframe.isConnected) {
      return this.mountPromise ?? Promise.resolve();
    }

    const container = this.resolveContainer();
    const iframe = this.createIframe();
    this.state = "mounting";
    this.emitMountStarted();

    this.iframe = iframe;
    this.mountPromise = new Promise((resolve, reject) => {
      const fail = (error: Error) => {
        cleanup();
        this.messagingSession?.destroy();
        this.messagingSession = null;
        this.state = "error";
        this.emitMountFailed(error);

        if (this.iframe === iframe) {
          this.iframe = null;
        }

        iframe.remove();
        reject(error);
      };

      const timeoutId = window.setTimeout(() => {
        this.emitMountSlow();
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
        this.documents.connect();
        this.annotations.connect();
        this.measurements.connect();
        this.compare.connect();
        this.collaboration.connect();
        this.layers.connect();
        this.blocks.connect();
        this.emitMountResolved();
        resolve();
      };

      const handleError = () => {
        fail(createCanvasIframeError());
      };

      iframe.addEventListener("load", handleLoad);
      iframe.addEventListener("error", handleError);
      this.startMessaging(iframe);
      container.appendChild(iframe);
    });

    return this.mountPromise;
  }

  ready(): Promise<void> {
    if (this.state === "ready") {
      return Promise.resolve();
    }

    if (!this.iframe?.isConnected || !this.messagingSession) {
      return Promise.reject(
        createViewerNotReadyError("RasterexViewer must be mounted before ready() is called.")
      );
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    const messagingSession = this.messagingSession;
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

      const timeoutId = window.setTimeout(() => {
        this.emitHandshakeSlow();
      }, this.readyTimeoutMs);

      const completeCanvasReady = () => {
        this.completeCanvasBrokerReady(cleanup, resolve);
      };

      unsubscribe = messagingSession.transport.onMessage((message) => {
        if (!this.isViewerReadyMessage(message)) {
          return;
        }

        this.completeProtocolReady(message, cleanup, resolve, reject);
      });

      if (messagingSession.canvasBroker.hasReceived("viewerReady")) {
        completeCanvasReady();
      } else {
        unsubscribeCanvasReady = messagingSession.canvasBroker.on("viewerReady", () => {
          completeCanvasReady();
        });
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
    this.documents.disconnect();
    this.annotations.disconnect();
    this.measurements.disconnect();
    this.compare.disconnect();
    this.collaboration.disconnect();
    this.layers.disconnect();
    this.blocks.disconnect();
    this.messagingSession?.destroy();
    this.messagingSession = null;
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

  private createIframe(): HTMLIFrameElement {
    const iframe = document.createElement("iframe");

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

    return iframe;
  }

  private startMessaging(iframe: HTMLIFrameElement): void {
    this.messagingSession = new ViewerMessagingSession({
      iframe,
      targetOrigin: this.targetOrigin,
      sdkInstanceId: this.sdkInstanceId,
      diagnostics: this.diagnostics
    });
    this.messagingSession.start();
  }

  private completeCanvasBrokerReady(
    cleanup: () => void,
    resolve: () => void
  ): void {
    const reason = "Canvas emitted viewerReady using the Canvas broker message structure without Protocol V1 handshake metadata.";
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
    this.emitCompatibilityWarning(reason);
    this.state = "ready";
    this.emitHandshakeComplete("current-canvas", this.canvasSessionId);
    resolve();
  }

  private completeProtocolReady(
    message: ViewerReadyMessage,
    cleanup: () => void,
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
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
      this.emitCompatibilityWarning(
        compatibility.result.reason ?? "Canvas compatibility is degraded."
      );
    }

    this.state = "ready";
    this.emitHandshakeComplete(message.canvasVersion, message.canvasSessionId);
    resolve();
  }

  private emitMountStarted(): void {
    this.diagnostics.emit("iframe.mount.started", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      viewerUrl: this.viewerUrl,
      targetOrigin: this.targetOrigin,
      timeoutMs: this.connectTimeoutMs
    });
  }

  private emitMountResolved(): void {
    this.diagnostics.emit("iframe.mount.resolved", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      viewerUrl: this.viewerUrl,
      targetOrigin: this.targetOrigin
    });
  }

  private emitMountFailed(error: Error): void {
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
  }

  private emitMountSlow(): void {
    this.diagnostics.emit("iframe.mount.slow", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      viewerUrl: this.viewerUrl,
      targetOrigin: this.targetOrigin,
      timeoutMs: this.connectTimeoutMs,
      message: "Rasterex Canvas is still loading. The connection may be slow."
    });
  }

  private emitHandshakeSlow(): void {
    this.diagnostics.emit("handshake.slow", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      timeoutMs: this.readyTimeoutMs,
      message: "Rasterex Canvas is still becoming ready. The connection may be slow."
    });
  }

  private emitCompatibilityWarning(reason: string): void {
    this.diagnostics.emit("compatibility.warning", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      reason
    });
  }

  private emitHandshakeComplete(
    canvasVersion: string,
    canvasSessionId: string
  ): void {
    this.diagnostics.emit("handshake.complete", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      canvasVersion,
      canvasSessionId
    });
  }

  private getCanvasBroker() {
    return this.messagingSession?.canvasBroker ?? null;
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
