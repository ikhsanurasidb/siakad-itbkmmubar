import type { Session } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";

export interface Context {
  session: Session | null;
  db: Database;
}
