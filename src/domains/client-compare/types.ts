import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type { DomainEventHandler, DomainEventUnsubscribe } from "../../utils/DomainEventEmitter.js";

export interface ClientCompareSourceOptions {
  backgroundUrl?: string;
  overlayUrl?: string;
  backgroundFileName?: string;
  overlayFileName?: string;
}

export interface ClientCompareCreateOptions extends ClientCompareSourceOptions {
  backgroundColor?: string;
  overlayColor?: string;
  requestId?: string;
  timeoutMs?: number;
}

export interface ClientCompareCommandOptions {
  timeoutMs?: number;
  requestId?: string;
}

export interface ClientCompareReady {
  success: true;
  requestId: string;
  backgroundFileIndex?: number;
  overlayFileIndex?: number;
  comparisonFileIndex?: number;
}

export interface ClientCompareAlignStarted extends ClientCompareReady {}
export interface ClientCompareAlignComplete extends ClientCompareReady {}

export interface ClientCompareOpacityChanged {
  success: true;
  requestId: string;
  value?: number;
}

export interface ClientCompareCommonLevelChanged {
  success: true;
  requestId: string;
  level?: number;
}

export interface ClientCompareClosed {
  success: true;
  requestId: string;
}

export interface ClientCompareFailure {
  success: false;
  requestId?: string;
  error?: string;
}

export interface ClientCompareEventMap {
  ready: ClientCompareReady;
  opacityChanged: ClientCompareOpacityChanged;
  commonLevelChanged: ClientCompareCommonLevelChanged;
  alignStarted: ClientCompareAlignStarted;
  alignComplete: ClientCompareAlignComplete;
  closed: ClientCompareClosed;
  failed: ClientCompareFailure;
}

export type ClientCompareEventName = keyof ClientCompareEventMap;
export type ClientCompareEventHandler<TName extends ClientCompareEventName> =
  DomainEventHandler<ClientCompareEventMap[TName]>;
export type ClientCompareEventUnsubscribe = DomainEventUnsubscribe;

export interface ClientCompareApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
