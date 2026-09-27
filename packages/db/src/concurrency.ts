export class OptimisticConcurrencyError extends Error {
  readonly entityId: string;

  constructor(entityId: string) {
    super("The entity changed before this update could be applied.");
    this.name = "OptimisticConcurrencyError";
    this.entityId = entityId;
  }
}
