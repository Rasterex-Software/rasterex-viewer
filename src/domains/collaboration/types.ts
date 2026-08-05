import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export interface CollaborationUserPayload {
  username: string;
  displayName?: string;
  email?: string;
}

export interface CollaborationTooltipConfig {
  iconSrc?: string;
  title?: string;
  message?: string;
  messageTemplate?: string;
  duration?: number;
  position?: [number | "center", number];
}

export interface CollaborationConfigPayload {
  enabled?: boolean;
  canCollaborate?: boolean;
  roomId?: string;
  collaborationRoomId?: string;
  canFileOpen?: boolean;
  localStoreAnnotation?: boolean;
  dbBackendApiKey?: string;
  collaborationTooltip?: CollaborationTooltipConfig;
  [key: string]: unknown;
}

export type CollaborationEnableOptions = Omit<
  CollaborationConfigPayload,
  "enabled" | "canCollaborate"
>;

export interface SetUserOptions extends CollaborationUserPayload {
  timeoutMs?: number;
}

export interface SetUserResultPayload {
  success: boolean;
  reason?: string;
}

export interface CollaborationEventMap {
  setUserResult: SetUserResultPayload;
}

export type CollaborationEventName = keyof CollaborationEventMap;
export type CollaborationEventHandler<TEventName extends CollaborationEventName> =
  DomainEventHandler<CollaborationEventMap[TEventName]>;
export type CollaborationEventUnsubscribe = DomainEventUnsubscribe;

export interface CollaborationApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
