import type {
  D1Database,
  D1Result,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { BatchLimitError } from "@db/batch-errors";
import { OptimisticConcurrencyError } from "@db/concurrency";

export { BatchLimitError } from "@db/batch-errors";
export { OptimisticConcurrencyError } from "@db/concurrency";

export const D1_HARD_MAX_BOUND_PARAMS = 100;
export const D1_SAFE_MAX_BOUND_PARAMS = 80;
export const DEFAULT_D1_BATCH_STATEMENT_LIMIT = 25;

export interface AtomicBatchOptions {
  readonly maxStatements?: number;
  readonly onExecute?: (statementCount: number) => void;
}

export interface AtomicBatchExecutor {
  execute: (
    statements: readonly D1PreparedStatement[]
  ) => Promise<readonly D1Result[]>;
}

export const createAtomicBatchExecutor = (
  database: D1Database,
  options: AtomicBatchOptions = {}
): AtomicBatchExecutor => {
  const maxStatements =
    options.maxStatements ?? DEFAULT_D1_BATCH_STATEMENT_LIMIT;

  if (!Number.isInteger(maxStatements) || maxStatements < 1) {
    throw new RangeError("maxStatements must be a positive integer.");
  }

  return {
    execute: (statements) => {
      if (statements.length === 0) {
        return Promise.resolve([]);
      }

      if (statements.length > maxStatements) {
        throw new BatchLimitError(statements.length, maxStatements);
      }

      options.onExecute?.(statements.length);
      return database.batch([...statements]);
    },
  };
};

export interface ChunkByParameterBudgetOptions {
  readonly fixedParameterCount?: number;
  readonly maxParameters?: number;
  readonly parametersPerRow: number;
}

export const calculateRowsPerChunk = ({
  fixedParameterCount = 0,
  maxParameters = D1_SAFE_MAX_BOUND_PARAMS,
  parametersPerRow,
}: ChunkByParameterBudgetOptions): number => {
  if (!Number.isInteger(parametersPerRow) || parametersPerRow < 1) {
    throw new RangeError("parametersPerRow must be a positive integer.");
  }

  if (
    !Number.isInteger(fixedParameterCount) ||
    fixedParameterCount < 0 ||
    fixedParameterCount >= maxParameters
  ) {
    throw new RangeError(
      "fixedParameterCount must be non-negative and smaller than maxParameters."
    );
  }

  if (
    !Number.isInteger(maxParameters) ||
    maxParameters > D1_HARD_MAX_BOUND_PARAMS
  ) {
    throw new RangeError(
      `maxParameters must be an integer no greater than ${D1_HARD_MAX_BOUND_PARAMS}.`
    );
  }

  return Math.max(
    1,
    Math.floor((maxParameters - fixedParameterCount) / parametersPerRow)
  );
};

export const chunkByParameterBudget = <T>(
  rows: readonly T[],
  options: ChunkByParameterBudgetOptions
): T[][] => {
  const rowsPerChunk = calculateRowsPerChunk(options);
  const chunks: T[][] = [];

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    chunks.push(rows.slice(start, start + rowsPerChunk));
  }

  return chunks;
};

export const chunkUniqueIds = (
  ids: readonly string[],
  fixedParameterCount = 0
): string[][] =>
  chunkByParameterBudget([...new Set(ids)], {
    fixedParameterCount,
    parametersPerRow: 1,
  });

export const assertSingleChange = (
  changes: number | undefined,
  entityId: string
): void => {
  if (changes !== 1) {
    throw new OptimisticConcurrencyError(entityId);
  }
};

export interface RepositoryResult<T> {
  readonly data: T;
  readonly rowCount: number;
}
