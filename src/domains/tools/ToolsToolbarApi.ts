import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import {
  requireReadyBroker,
  type RequestResultMessage
} from "../canvas/canvasBrokerCommands.js";
import type {
  CustomToolbarButtonOptions,
  RemoveToolbarButtonOptions,
  ToolsApiOptions,
  ToolsEventUnsubscribe,
  ToolsToolbarEventHandler,
  ToolsToolbarEventMap,
  ToolsToolbarEventName
} from "./types.js";

export class ToolsToolbarApi {
  private readonly options: ToolsApiOptions;
  private readonly events = new DomainEventEmitter<ToolsToolbarEventMap>();
  private clickCleanup: (() => void) | null = null;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  addButton(options: CustomToolbarButtonOptions): void {
    requireReadyBroker({
      ...this.options,
      type: "addToolbarButton",
      apiName: "viewer.tools"
    }).send("addToolbarButton", options);
  }

  removeButton(options: RemoveToolbarButtonOptions): void {
    requireReadyBroker({
      ...this.options,
      type: "removeToolbarButton",
      apiName: "viewer.tools"
    }).send("removeToolbarButton", options);
  }

  on<TEventName extends ToolsToolbarEventName>(
    eventName: TEventName,
    handler: ToolsToolbarEventHandler<TEventName>
  ): ToolsEventUnsubscribe {
    if (eventName === "click" && !this.clickCleanup) {
      this.clickCleanup = requireReadyBroker({
        ...this.options,
        type: "toolbarClick",
        apiName: "viewer.tools"
      }).on("toolbarClick", (message) => {
        const toolbarMessage = message as RequestResultMessage<unknown>;
        const id = toolbarMessage.id;

        if (typeof id === "string") {
          this.events.emit("click", {
            id,
            active: toolbarMessage.active === true
          });
        }
      });
    }

    return this.events.on(eventName, handler);
  }
}
