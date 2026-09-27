import { z } from "zod";

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16, "Idempotency key terlalu pendek.")
  .max(128, "Idempotency key terlalu panjang.");

export interface IdempotencyRecord {
  requestHash: string;
  resultReference: string | null;
  status: "COMPLETED" | "FAILED" | "PENDING";
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Request dengan idempotency key yang sama memakai payload berbeda.");
    this.name = "IdempotencyConflictError";
  }
}

export const assertIdempotentRequest = (
  record: IdempotencyRecord | null,
  requestHash: string
): void => {
  if (record && record.requestHash !== requestHash) {
    throw new IdempotencyConflictError();
  }
};
