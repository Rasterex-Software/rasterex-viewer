import {
  ERROR_CODES,
  PROTOCOL_VERSION,
  SDK_NAME,
  type Capability,
  type MessageEnvelope,
  type ProtocolErrorPayload,
  type ProtocolIncomingMessage,
  type ResponseEnvelope
} from "../protocol/index.js";

import { SDK_VERSION } from "../constants.js";
import type { Diagnostics } from "../diagnostics.js";
import {
  RasterexViewerError,
  createCapabilityNotSupportedError,
  createCommandTimeoutError,
  createViewerNotReadyError
} from "../errors.js";
import { createRequestId } from "../utils/createRequestId.js";
import type { IframeTransport } from "./IframeTransport.js";

export interface MessageClientOptions {
  transport: IframeTransport;
  sdkInstanceId: string;
  commandTimeoutMs: number;
  diagnostics?: Diagnostics;
  getIsReady: () => boolean;
  getCapabilities: () => readonly Capability[] | null;
}

export interface SendCommandOptions {
  requiredCapability?: Capability;
  timeoutMs?: number;
}

interface PendingRequest {
  type: string;
  timeoutId: ReturnType<typeof globalThis.setTimeout>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class MessageClient {
  private readonly transport: IframeTransport;
  private readonly sdkInstanceId: string;
  private readonly commandTimeoutMs: number;
  private readonly diagnostics?: Diagnostics;
  private readonly getIsReady: () => boolean;
  private readonly getCapabilities: () => readonly Capability[] | null;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly unsubscribeTransport: () => void;

  constructor(options: MessageClientOptions) {
    this.transport = options.transport;
    this.sdkInstanceId = options.sdkInstanceId;
    this.commandTimeoutMs = options.commandTimeoutMs;
    this.diagnostics = options.diagnostics;
    this.getIsReady = options.getIsReady;
    this.getCapabilities = options.getCapabilities;
    this.unsubscribeTransport = this.transport.onMessage((message) => {
      this.handleIncomingMessage(message);
    });
  }

  sendCommand<TResult = unknown, TPayload = unknown>(
    type: string,
    payload?: TPayload,
    options: SendCommandOptions = {}
  ): Promise<TResult> {
    if (!this.getIsReady()) {
      return Promise.reject(
        createViewerNotReadyError("RasterexViewer must be ready before commands can be sent.")
      );
    }

    if (options.requiredCapability) {
      const capabilities = this.getCapabilities() ?? [];

      if (!capabilities.includes(options.requiredCapability)) {
        return Promise.reject(
          createCapabilityNotSupportedError(options.requiredCapability)
        );
      }
    }

    const id = createRequestId();
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;
    const message: MessageEnvelope<TPayload> = {
      id,
      sdkInstanceId: this.sdkInstanceId,
      sdk: SDK_NAME,
      sdkVersion: SDK_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      type,
      payload
    };

    this.diagnostics?.emit("command.sent", {
      sdkInstanceId: this.sdkInstanceId,
      timestamp: new Date().toISOString(),
      id,
      type
    });

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = globalThis.setTimeout(() => {
        this.pendingRequests.delete(id);
        this.diagnostics?.emit("command.timeout", {
          sdkInstanceId: this.sdkInstanceId,
          timestamp: new Date().toISOString(),
          id,
          type,
          timeoutMs
        });
        reject(createCommandTimeoutError(id, type, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        type,
        timeoutId,
        resolve: resolve as (value: unknown) => void,
        reject
      });

      this.transport.send(message);
    });
  }

  destroy(): void {
    this.unsubscribeTransport();

    for (const [id, pendingRequest] of this.pendingRequests) {
      globalThis.clearTimeout(pendingRequest.timeoutId);
      pendingRequest.reject(
        createViewerNotReadyError(
          `Rasterex command ${pendingRequest.type} was canceled because the viewer was destroyed.`
        )
      );
      this.pendingRequests.delete(id);
    }
  }

  private handleIncomingMessage(message: ProtocolIncomingMessage): void {
    if (!this.isResponseEnvelope(message)) {
      return;
    }

    const pendingRequest = this.pendingRequests.get(message.id);

    if (!pendingRequest) {
      return;
    }

    globalThis.clearTimeout(pendingRequest.timeoutId);
    this.pendingRequests.delete(message.id);

    if (message.ok) {
      this.diagnostics?.emit("command.resolved", {
        sdkInstanceId: this.sdkInstanceId,
        timestamp: new Date().toISOString(),
        id: message.id,
        type: pendingRequest.type
      });
      pendingRequest.resolve(message.result);
      return;
    }

    pendingRequest.reject(this.createProtocolError(message.error));
  }

  private isResponseEnvelope(
    message: ProtocolIncomingMessage
  ): message is ResponseEnvelope {
    return (
      "id" in message &&
      typeof message.id === "string" &&
      "ok" in message &&
      typeof message.ok === "boolean"
    );
  }

  private createProtocolError(error: ProtocolErrorPayload): RasterexViewerError {
    return new RasterexViewerError({
      code: error.code || ERROR_CODES.unknownCommand,
      message: error.message,
      context: error.context
    });
  }
}
