import {
  createCapabilityNotSupportedError,
  createCommandTimeoutError,
  createViewerNotReadyError
} from "../../errors.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { createCanvasCommandError, requireReadyBroker } from "./canvasBrokerCommands.js";
import type { CanvasBrokerAccess } from "./canvasBrokerCommands.js";

export interface ParentCommandOptions {
  requestId?: string;
  timeoutMs?: number;
}

export interface ParentCommandAccess extends CanvasBrokerAccess {
  getCapabilities?: () => readonly string[] | null;
  commandTimeoutMs: number;
}

interface Command {
  type: string;
  reply: string;
  capability?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Requests in the editing and Count workflows use payload request IDs. */
export class ParentCommands {
  private readonly pending = new Map<string, (error: Error) => void>();

  constructor(
    private readonly access: ParentCommandAccess,
    private readonly apiName: string
  ) {}

  async request<T extends { requestId: string; success: true }>(
    command: Command,
    payload: Record<string, unknown>,
    options: ParentCommandOptions,
    valid: (result: Record<string, unknown>) => boolean
  ): Promise<T> {
    const { type, reply, capability } = command;
    const broker = requireReadyBroker({ ...this.access, type, apiName: this.apiName });
    if (capability && !this.access.getCapabilities?.()?.includes(capability)) {
      throw createCapabilityNotSupportedError(capability);
    }

    const requestId =
      options.requestId === undefined ? createRequestId() : options.requestId;
    const timeoutMs =
      options.timeoutMs === undefined ? this.access.commandTimeoutMs : options.timeoutMs;
    if (
      typeof requestId !== "string" ||
      !requestId.trim() ||
      requestId.length > 256 ||
      this.pending.has(requestId)
    ) {
      throw createCanvasCommandError(
        type,
        "Use a unique, nonblank request ID of at most 256 characters."
      );
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      throw createCanvasCommandError(type, "Use a positive timer-safe timeoutMs.");
    }

    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      let settled = false;
      const cleanup = () => {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        this.pending.delete(requestId);
      };
      const fail = (error: Error) => {
        if (!settled) {
          cleanup();
          reject(error);
        }
      };

      const timer = setTimeout(() => {
        fail(createCommandTimeoutError(requestId, type, timeoutMs));
      }, timeoutMs);
      this.pending.set(requestId, fail);

      try {
        unsubscribe = broker.on<unknown>(reply, ({ payload: result }) => {
          if (settled || !isRecord(result) || result.requestId !== requestId) {
            return;
          }
          if (result.success === true && result.error === undefined && valid(result)) {
            cleanup();
            resolve(result as T);
            return;
          }

          let message = "Canvas returned an invalid result.";
          if (result.success === false) {
            message =
              typeof result.error === "string"
                ? result.error
                : typeof result.reason === "string"
                  ? result.reason
                  : "Canvas command failed.";
          }
          fail(createCanvasCommandError(type, message, { requestId, result }));
        });
        broker.send(type, { ...payload, requestId });
      } catch {
        fail(
          createCanvasCommandError(type, "Could not send Canvas command.", { requestId })
        );
      }
    });
  }

  disconnect(): void {
    for (const fail of this.pending.values()) {
      fail(
        createViewerNotReadyError(
          "Viewer disconnected before the Canvas command completed."
        )
      );
    }
  }
}
