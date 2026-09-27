import type { Session } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";

export interface Clock {
  now: () => Date;
}

export interface RequestMetadata {
  method: string;
  path: string;
  requestId: string;
}

export interface ServerLogger {
  debug: (event: string, context?: Record<string, unknown>) => void;
  info: (event: string, context?: Record<string, unknown>) => void;
  warn: (event: string, context?: Record<string, unknown>) => void;
  error: (
    event: string,
    error: unknown,
    context?: Record<string, unknown>
  ) => void;
  child: (context: Record<string, unknown>) => ServerLogger;
}

export interface Context {
  db: Database;
  clock: Clock;
  logger: ServerLogger;
  request: RequestMetadata;
  session: Session | null;
}
