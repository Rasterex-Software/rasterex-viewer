import { sendCanvasCommandWithResult } from "../canvas/canvasBrokerCommands.js";
import type {
  StampPanelResult,
  StampUploadOptions,
  StampUploadResult,
  ToolsApiOptions
} from "./types.js";

export class ToolsStampsApi {
  private readonly options: ToolsApiOptions;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  open(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("open", options);
  }

  close(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("close", options);
  }

  toggle(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("toggle", options);
  }

  upload(options: StampUploadOptions): Promise<StampUploadResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "uploadStamp",
      resultType: "uploadStampResult",
      payload: {
        requestId: options.requestId,
        urls: options.urls,
        openStampPanel: options.openStampPanel
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }

  private control(
    command: "open" | "close" | "toggle",
    options: { requestId?: string; timeoutMs?: number }
  ): Promise<StampPanelResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "stampControl",
      resultType: "stampControlResult",
      payload: {
        requestId: options.requestId,
        command
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }
}
