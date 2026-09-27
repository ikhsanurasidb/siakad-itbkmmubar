import { z } from "zod";

export const cursorPaginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export interface CursorPage<T> {
  data: readonly T[];
  nextCursor: string | null;
}

export const createCursorPage = <T>(
  data: readonly T[],
  hasMore: boolean,
  nextCursor: string | null
): CursorPage<T> => ({
  data,
  nextCursor: hasMore ? nextCursor : null,
});
