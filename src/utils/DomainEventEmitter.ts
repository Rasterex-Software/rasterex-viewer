export type DomainEventMap = object;
export type DomainEventName<TEvents extends DomainEventMap> = Extract<
  keyof TEvents,
  string
>;
export type DomainEventHandler<TPayload> = (event: TPayload) => void;
export type DomainEventUnsubscribe = () => void;

export class DomainEventEmitter<TEvents extends DomainEventMap> {
  private readonly listeners = new Map<
    DomainEventName<TEvents>,
    Set<DomainEventHandler<TEvents[DomainEventName<TEvents>]>>
  >();

  on<TEventName extends DomainEventName<TEvents>>(
    eventName: TEventName,
    handler: DomainEventHandler<TEvents[TEventName]>
  ): DomainEventUnsubscribe {
    const listeners = this.getListeners(eventName);
    listeners.add(
      handler as DomainEventHandler<TEvents[DomainEventName<TEvents>]>
    );

    return () => {
      listeners.delete(
        handler as DomainEventHandler<TEvents[DomainEventName<TEvents>]>
      );
    };
  }

  emit<TEventName extends DomainEventName<TEvents>>(
    eventName: TEventName,
    event: TEvents[TEventName]
  ): void {
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

  private getListeners<TEventName extends DomainEventName<TEvents>>(
    eventName: TEventName
  ): Set<DomainEventHandler<TEvents[DomainEventName<TEvents>]>> {
    const existing = this.listeners.get(eventName);

    if (existing) {
      return existing;
    }

    const listeners = new Set<
      DomainEventHandler<TEvents[DomainEventName<TEvents>]>
    >();
    this.listeners.set(eventName, listeners);

    return listeners;
  }
}
