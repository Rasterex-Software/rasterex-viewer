import { sendCanvasCommandWithResult } from "../canvas/canvasBrokerCommands.js";
import type { StampPanelResult, ToolsApiOptions } from "./types.js";

export class ToolsSymbolsApi {
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

  private control(
    command: "open" | "close" | "toggle",
    options: { requestId?: string; timeoutMs?: number }
  ): Promise<StampPanelResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "symbolsControl",
      resultType: "symbolsControlResult",
      payload: {
        requestId: options.requestId,
        command
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }
}
