export class BatchLimitError extends Error {
  constructor(statementCount: number, maxStatements: number) {
    super(
      `D1 batch contains ${statementCount} statements; the configured maximum is ${maxStatements}.`
    );
    this.name = "BatchLimitError";
  }
}
