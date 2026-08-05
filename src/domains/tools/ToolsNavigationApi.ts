import { sendCanvasCommandWithResult } from "../canvas/canvasBrokerCommands.js";
import type {
  NavigationToolControlResult,
  NavigationToolSetOptions,
  ToolsApiOptions
} from "./types.js";

export class ToolsNavigationApi {
  private readonly options: ToolsApiOptions;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  set(options: NavigationToolSetOptions): Promise<NavigationToolControlResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "navigationToolControl",
      resultType: "navigationToolControlResult",
      payload: {
        requestId: options.requestId,
        action: options.action,
        enabled: options.enabled,
        value: options.value,
        searchText: options.searchText,
        searchCaseSensitive: options.searchCaseSensitive,
        searchForward: options.searchForward
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }

  clear(
    options: { requestId?: string; timeoutMs?: number } = {}
  ): Promise<NavigationToolControlResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "navigationToolControl",
      resultType: "navigationToolControlResult",
      payload: {
        requestId: options.requestId,
        command: "clear"
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs,
      apiName: "viewer.tools"
    });
  }
}
