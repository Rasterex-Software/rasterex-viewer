import { createViewerNotReadyError } from "../../errors.js";
import type {
  CanvasMessage,
  CanvasMessageBroker,
  CanvasMessageHandler,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import type { CanvasApiOptions } from "./types.js";
export type { CanvasApiOptions } from "./types.js";

export class CanvasApi {
  private readonly getBroker: () => CanvasMessageBroker | null;

  constructor(options: CanvasApiOptions) {
    this.getBroker = options.getBroker;
  }

  send<TPayload = unknown>(type: string, payload?: TPayload): void {
    this.requireBroker("send").send(type, payload);
  }

  on<TPayload = unknown>(
    type: string,
    handler: CanvasMessageHandler<TPayload>
  ): CanvasMessageUnsubscribe {
    return this.requireBroker("subscribe").on(type, handler);
  }

  private requireBroker(action: "send" | "subscribe"): CanvasMessageBroker {
    const broker = this.getBroker();

    if (!broker) {
      throw createViewerNotReadyError(
        "RasterexViewer must be mounted before using viewer.canvas.",
        {
          action
        }
      );
    }

    return broker;
  }
}

export type {
  CanvasMessage,
  CanvasMessageHandler,
  CanvasMessageUnsubscribe
};
