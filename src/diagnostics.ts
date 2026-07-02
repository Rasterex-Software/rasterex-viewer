export interface DiagnosticEventBase {
  sdkInstanceId: string;
  timestamp: string;
}

export interface DiagnosticEventMap {
  "iframe.mount.started": DiagnosticEventBase & {
    viewerUrl: string;
    targetOrigin: string;
    timeoutMs: number;
  };
  "iframe.mount.resolved": DiagnosticEventBase & {
    viewerUrl: string;
    targetOrigin: string;
  };
  "iframe.mount.failed": DiagnosticEventBase & {
    viewerUrl: string;
    targetOrigin: string;
    error: unknown;
  };
  "iframe.mount.slow": DiagnosticEventBase & {
    viewerUrl: string;
    targetOrigin: string;
    timeoutMs: number;
    message: string;
  };
  "iframe.destroyed": DiagnosticEventBase;
  "handshake.complete": DiagnosticEventBase & {
    canvasVersion: string;
    canvasSessionId: string;
  };
  "handshake.timeout": DiagnosticEventBase & {
    timeoutMs: number;
  };
  "handshake.slow": DiagnosticEventBase & {
    timeoutMs: number;
    message: string;
  };
  "compatibility.warning": DiagnosticEventBase & {
    reason: string;
  };
  "command.sent": DiagnosticEventBase & {
    id: string;
    type: string;
  };
  "command.resolved": DiagnosticEventBase & {
    id: string;
    type: string;
  };
  "command.timeout": DiagnosticEventBase & {
    id: string;
    type: string;
    timeoutMs: number;
  };
  "canvas.command.sent": DiagnosticEventBase & {
    type: string;
  };
  "canvas.event.received": DiagnosticEventBase & {
    type: string;
  };
  "transport.error": DiagnosticEventBase & {
    error: unknown;
  };
}

export type DiagnosticEventName = keyof DiagnosticEventMap;
export type DiagnosticHandler<TEventName extends DiagnosticEventName> = (
  event: DiagnosticEventMap[TEventName]
) => void;
export type DiagnosticUnsubscribe = () => void;

type DiagnosticListenerSet<TEventName extends DiagnosticEventName> = Set<
  DiagnosticHandler<TEventName>
>;

export class Diagnostics {
  private readonly listeners = new Map<
    DiagnosticEventName,
    DiagnosticListenerSet<DiagnosticEventName>
  >();

  constructor(private readonly debug = false) {}

  on<TEventName extends DiagnosticEventName>(
    eventName: TEventName,
    handler: DiagnosticHandler<TEventName>
  ): DiagnosticUnsubscribe {
    const listeners = this.getListeners(eventName);
    listeners.add(handler as DiagnosticHandler<DiagnosticEventName>);

    return () => {
      listeners.delete(handler as DiagnosticHandler<DiagnosticEventName>);
    };
  }

  emit<TEventName extends DiagnosticEventName>(
    eventName: TEventName,
    event: DiagnosticEventMap[TEventName]
  ): void {
    if (this.debug) {
      console.debug("[RasterexViewer]", eventName, event);
    }

    const listeners = this.listeners.get(eventName);

    if (!listeners) {
      return;
    }

    for (const listener of [...listeners]) {
      listener(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  private getListeners<TEventName extends DiagnosticEventName>(
    eventName: TEventName
  ): DiagnosticListenerSet<TEventName> {
    const existing = this.listeners.get(eventName);

    if (existing) {
      return existing as DiagnosticListenerSet<TEventName>;
    }

    const listeners: DiagnosticListenerSet<TEventName> = new Set();
    this.listeners.set(
      eventName,
      listeners as DiagnosticListenerSet<DiagnosticEventName>
    );

    return listeners;
  }
}
