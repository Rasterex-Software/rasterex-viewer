import {
  sendCanvasCommandWithResult,
  sendCanvasFireAndForget,
  type RequestPayload
} from "../canvas/canvasBrokerCommands.js";
import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import { ToolsNavigationApi } from "./ToolsNavigationApi.js";
import { ToolsStampsApi } from "./ToolsStampsApi.js";
import { ToolsSymbolsApi } from "./ToolsSymbolsApi.js";
import { ToolsThreeDApi } from "./ToolsThreeDApi.js";
import { ToolsToolbarApi } from "./ToolsToolbarApi.js";
import type {
  CanvasToolControlOptions,
  ToolControlResult,
  ToolSetOptions,
  ToolsApiOptions
} from "./types.js";

export type * from "./types.js";

export class ToolsApi {
  readonly navigation: ToolsNavigationApi;
  readonly threeD: ToolsThreeDApi;
  readonly stamps: ToolsStampsApi;
  readonly symbols: ToolsSymbolsApi;
  readonly toolbar: ToolsToolbarApi;

  private readonly getBroker: () => CanvasMessageBroker | null;
  private readonly getIsReady: () => boolean;
  private readonly commandTimeoutMs: number;

  constructor(options: ToolsApiOptions) {
    this.getBroker = options.getBroker;
    this.getIsReady = options.getIsReady;
    this.commandTimeoutMs = options.commandTimeoutMs;
    this.navigation = new ToolsNavigationApi(options);
    this.threeD = new ToolsThreeDApi(options);
    this.stamps = new ToolsStampsApi(options);
    this.symbols = new ToolsSymbolsApi(options);
    this.toolbar = new ToolsToolbarApi(options);
  }

  set(options: ToolSetOptions): Promise<ToolControlResult> {
    return this.sendWithResult<ToolControlResult>(
      "toolControlV2",
      "toolControlV2Result",
      {
        requestId: options.requestId,
        group: options.group,
        action: options.action,
        enabled: options.enabled,
        style: options.style
      },
      options.timeoutMs
    );
  }

  clear(): void {
    this.sendFireAndForget("toolControl", {
      command: "clear"
    });
  }

  canvasControl(options: CanvasToolControlOptions): void {
    this.sendFireAndForget("toolControl", options);
  }

  private sendFireAndForget<TPayload>(type: string, payload: TPayload): void {
    sendCanvasFireAndForget({
      getBroker: this.getBroker,
      getIsReady: this.getIsReady,
      type,
      payload,
      apiName: "viewer.tools"
    });
  }

  private sendWithResult<TResult extends { success: boolean; error?: string }>(
    type: string,
    resultType: string,
    payload: RequestPayload,
    timeoutMs = this.commandTimeoutMs
  ): Promise<TResult> {
    return sendCanvasCommandWithResult({
      getBroker: this.getBroker,
      getIsReady: this.getIsReady,
      type,
      resultType,
      payload,
      timeoutMs,
      apiName: "viewer.tools"
    });
  }
}

export {
  ToolsNavigationApi,
  ToolsStampsApi,
  ToolsSymbolsApi,
  ToolsThreeDApi,
  ToolsToolbarApi
};
