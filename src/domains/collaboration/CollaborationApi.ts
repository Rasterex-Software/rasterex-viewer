import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createCommandTimeoutError } from "../../errors.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import type {
  CollaborationApiOptions,
  CollaborationConfigPayload,
  CollaborationEnableOptions,
  CollaborationEventHandler,
  CollaborationEventMap,
  CollaborationEventName,
  CollaborationEventUnsubscribe,
  CollaborationTooltipConfig,
  CollaborationUserPayload,
  SetUserOptions,
  SetUserResultPayload
} from "./types.js";
export type * from "./types.js";

export class CollaborationApi {
  private readonly options: CollaborationApiOptions;
  private readonly events = new DomainEventEmitter<CollaborationEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];
  private setUserInProgress = false;

  constructor(options: CollaborationApiOptions) {
    this.options = options;
  }

  on<TEventName extends CollaborationEventName>(
    eventName: TEventName,
    handler: CollaborationEventHandler<TEventName>
  ): CollaborationEventUnsubscribe {
    this.connect();
    return this.events.on(eventName, handler);
  }

  connect(): void {
    const broker = this.options.getBroker();

    if (!broker || broker === this.broker) {
      return;
    }

    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<SetUserResultPayload>("setUserResult", (message) => {
        if (isSetUserResultPayload(message.payload)) {
          this.events.emit("setUserResult", message.payload);
        }
      })
    ];
  }

  disconnect(): void {
    for (const cleanup of this.brokerCleanups) {
      cleanup();
    }

    this.brokerCleanups = [];
    this.broker = null;
    this.setUserInProgress = false;
  }

  setUser(options: SetUserOptions): Promise<SetUserResultPayload> {
    const { timeoutMs, ...payload } = options;
    this.validateUserPayload(payload);

    if (this.setUserInProgress) {
      return Promise.reject(
        createCanvasCommandError(
          "setUser",
          "Only one collaboration setUser request can be active for a viewer iframe."
        )
      );
    }

    const broker = requireReadyBroker({
      ...this.options,
      type: "setUser",
      apiName: "viewer.collaboration"
    });
    const resultTimeoutMs = timeoutMs ?? this.options.commandTimeoutMs;
    this.setUserInProgress = true;

    return new Promise<SetUserResultPayload>((resolve, reject) => {
      const cleanup = broker.on<SetUserResultPayload>("setUserResult", (message) => {
        if (!isSetUserResultPayload(message.payload)) {
          return;
        }

        globalThis.clearTimeout(timeoutId);
        cleanup();
        this.setUserInProgress = false;
        resolve(message.payload);
      });

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.setUserInProgress = false;
        reject(createCommandTimeoutError("setUserResult", "setUser", resultTimeoutMs));
      }, resultTimeoutMs);

      broker.send("setUser", payload);
    });
  }

  configure(payload: CollaborationConfigPayload): void {
    this.validateConfigPayload(payload);
    this.sendCollaboration(payload);
  }

  enable(options: CollaborationEnableOptions = {}): void {
    this.validateConfigPayload(options);
    this.sendCollaboration({
      ...options,
      enabled: true
    });
  }

  disable(options: CollaborationEnableOptions = {}): void {
    this.validateConfigPayload(options);
    this.sendCollaboration({
      ...options,
      enabled: false
    });
  }

  private sendCollaboration(payload: CollaborationConfigPayload): void {
    requireReadyBroker({
      ...this.options,
      type: "collaboration",
      apiName: "viewer.collaboration"
    }).send("collaboration", payload);
  }

  private validateUserPayload(payload: CollaborationUserPayload): void {
    if (!hasText(payload.username)) {
      throw createCanvasCommandError(
        "setUser",
        "Collaboration user requires a non-empty username.",
        {
          payload
        }
      );
    }

    if (payload.displayName !== undefined && typeof payload.displayName !== "string") {
      throw createCanvasCommandError(
        "setUser",
        "Collaboration user displayName must be a string when provided.",
        {
          payload
        }
      );
    }

    if (payload.email !== undefined && typeof payload.email !== "string") {
      throw createCanvasCommandError(
        "setUser",
        "Collaboration user email must be a string when provided.",
        {
          payload
        }
      );
    }
  }

  private validateConfigPayload(payload: CollaborationConfigPayload): void {
    if (!payload || typeof payload !== "object") {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration config requires a payload object.",
        {
          payload
        }
      );
    }

    if (payload.enabled !== undefined && typeof payload.enabled !== "boolean") {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration enabled must be a boolean when provided.",
        {
          payload
        }
      );
    }

    if (
      payload.canCollaborate !== undefined &&
      typeof payload.canCollaborate !== "boolean"
    ) {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration canCollaborate must be a boolean when provided.",
        {
          payload
        }
      );
    }

    if (payload.roomId !== undefined && !hasText(payload.roomId)) {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration roomId must be a non-empty string when provided.",
        {
          payload
        }
      );
    }

    if (
      payload.collaborationRoomId !== undefined &&
      !hasText(payload.collaborationRoomId)
    ) {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration collaborationRoomId must be a non-empty string when provided.",
        {
          payload
        }
      );
    }

    if (payload.collaborationTooltip !== undefined) {
      this.validateTooltip(payload.collaborationTooltip, payload);
    }
  }

  private validateTooltip(
    tooltip: CollaborationTooltipConfig,
    payload: CollaborationConfigPayload
  ): void {
    if (!tooltip || typeof tooltip !== "object") {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration tooltip config must be an object when provided.",
        {
          payload
        }
      );
    }

    if (
      tooltip.duration !== undefined &&
      !Number.isFinite(tooltip.duration)
    ) {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration tooltip duration must be a finite number when provided.",
        {
          payload
        }
      );
    }

    if (tooltip.position === undefined) {
      return;
    }

    const [x, y] = tooltip.position;

    if (
      !Array.isArray(tooltip.position) ||
      tooltip.position.length !== 2 ||
      !((typeof x === "number" && Number.isFinite(x)) || x === "center") ||
      typeof y !== "number" ||
      !Number.isFinite(y)
    ) {
      throw createCanvasCommandError(
        "collaboration",
        "Collaboration tooltip position must be [number | \"center\", number] when provided.",
        {
          payload
        }
      );
    }
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSetUserResultPayload(
  payload: SetUserResultPayload | undefined
): payload is SetUserResultPayload {
  return !!payload && typeof payload === "object" && typeof payload.success === "boolean";
}
