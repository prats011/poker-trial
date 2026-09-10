export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly safeMessage: string = "Something went wrong"
  ) {
    super(message);
  }
}
