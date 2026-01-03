export class ExecutorError extends Error {
  constructor(message: string, public readonly retriable = false) {
    super(message);
  }
}
