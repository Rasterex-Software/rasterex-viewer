import type { SDK_NAME } from "./constants.js";
import type { ProtocolErrorPayload } from "./errors.js";
import type { ViewerReadyMessage } from "./handshake.js";

export interface MessageEnvelope<TPayload = unknown> {
  id?: string;
  sdkInstanceId: string;
  sdk: typeof SDK_NAME;
  sdkVersion: string;
  protocolVersion: string;
  type: string;
  payload?: TPayload;
}

export type ResponseEnvelope<TResult = unknown> =
  | {
      id: string;
      sdkInstanceId: string;
      protocolVersion: string;
      ok: true;
      result: TResult;
    }
  | {
      id: string;
      sdkInstanceId: string;
      protocolVersion: string;
      ok: false;
      error: ProtocolErrorPayload;
    };

export type ProtocolIncomingMessage =
  | MessageEnvelope
  | ResponseEnvelope
  | ViewerReadyMessage;
