import { validToolState } from "../canvas/parentToolState.js";
import { createCanvasCommandError } from "../canvas/canvasBrokerCommands.js";
import { isRecord } from "../canvas/ParentCommands.js";
import type { ParentCommands, ParentCommandOptions } from "../canvas/ParentCommands.js";
import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import {
  validCountConfiguration,
  validCountInfo,
  validCountItems
} from "./countValidation.js";
import type {
  CountConfiguration,
  CountFinishedEvent,
  CountInsertPointResult,
  CountItemInfo,
  CountItemsResult,
  CountPointModeResult,
  ParentToolStateResult
} from "./editingCountTypes.js";

export class CountApi {
  private readonly events = new DomainEventEmitter<{ finished: CountFinishedEvent }>();
  private broker: CanvasMessageBroker | null = null;
  private unsubscribe?: () => void;

  constructor(
    private readonly commands: ParentCommands,
    private readonly getBroker: () => CanvasMessageBroker | null
  ) {}

  connect(): void {
    const broker = this.getBroker();
    if (broker === this.broker) {
      return;
    }
    this.disconnect();
    this.broker = broker;
    this.unsubscribe = broker?.on<unknown>("countFinished", ({ payload }) => {
      if (
        isRecord(payload) &&
        payload.success === true &&
        payload.requestId === undefined
      ) {
        this.events.emit("finished", { success: true });
      }
    });
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.broker = null;
  }

  /** Finish initiated in Canvas, independently of SDK finish replies. */
  onFinished(handler: (event: CountFinishedEvent) => void): () => void {
    this.connect();
    return this.events.on("finished", handler);
  }

  /** Configure the next native Count draft. */
  async configure(
    configuration: CountConfiguration,
    options: ParentCommandOptions = {}
  ): Promise<ParentToolStateResult> {
    if (!validCountConfiguration(configuration)) {
      throw createCanvasCommandError("configureCount", "Invalid Count configuration.");
    }
    const { visibility, content, name, markerName, numbered, symbol } = configuration;
    return this.commands.request(
      { type: "configureCount", reply: "countConfigured", capability: "countWorkflow" },
      { options: { visibility, content, name, markerName, numbered, symbol } },
      options,
      validToolState
    );
  }

  finish(options: ParentCommandOptions = {}): Promise<ParentToolStateResult> {
    return this.commands.request(
      { type: "finishCount", reply: "countFinished", capability: "countWorkflow" },
      {},
      options,
      validToolState
    );
  }

  /** Arm native insertion for the currently selected Count. */
  insertPoint(options: ParentCommandOptions = {}): Promise<CountInsertPointResult> {
    return this.commands.request(
      { type: "insertCountPoint", reply: "insertCountPointResult" },
      {},
      options,
      validInsertResult
    );
  }

  /** Enable persistent insertion for a Count, or stop the rearming mode. */
  async setPointMode(
    settings: ParentCommandOptions &
      ({ enabled: true; guid: string } | { enabled: false })
  ): Promise<CountPointModeResult> {
    if (
      typeof settings?.enabled !== "boolean" ||
      (settings.enabled && !validGuid(settings.guid))
    ) {
      throw createCanvasCommandError(
        "insertCountPointMode",
        "Provide a Count GUID when enabling point mode."
      );
    }
    const enabled = settings.enabled;
    return this.commands.request(
      { type: "insertCountPointMode", reply: "insertCountPointModeResult" },
      enabled ? { enabled, guid: settings.guid } : { enabled },
      settings,
      (result) => validInsertResult(result) && result.enabled === enabled
    );
  }

  async getItems(
    guid: string,
    options: ParentCommandOptions = {}
  ): Promise<CountItemsResult> {
    if (!validGuid(guid)) {
      throw createCanvasCommandError("getCountItems", "Invalid Count GUID.");
    }
    return this.commands.request(
      { type: "getCountItems", reply: "countItems", capability: "countItemInfo" },
      { guid },
      options,
      (result) => validCountItems(result, guid)
    );
  }

  async setItemInfo(
    guid: string,
    itemId: string,
    info: CountItemInfo,
    options: ParentCommandOptions = {}
  ): Promise<CountItemsResult> {
    if (
      !validGuid(guid) ||
      typeof itemId !== "string" ||
      !itemId.trim() ||
      itemId.length > 100 ||
      !validCountInfo(info)
    ) {
      throw createCanvasCommandError(
        "setCountItemInfo",
        "Invalid Count GUID, item ID or item information."
      );
    }

    return this.commands.request(
      {
        type: "setCountItemInfo",
        reply: "countItemInfoChanged",
        capability: "countItemInfo"
      },
      { guid, itemId, info: { ...info } },
      options,
      (result) => validCountItems(result, guid)
    );
  }
}

function validGuid(guid: unknown): guid is string {
  return typeof guid === "string" && guid.trim().length > 0 && guid.length <= 128;
}

function validInsertResult(result: Record<string, unknown>): boolean {
  return (
    (result.markupNumber === undefined || Number.isSafeInteger(result.markupNumber)) &&
    (result.uniqueId === undefined || typeof result.uniqueId === "string")
  );
}
