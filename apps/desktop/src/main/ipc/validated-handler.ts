import type { z } from "zod";

export class IpcValidationError extends Error {
  readonly code = "invalid_ipc_payload";

  constructor() {
    super("SprintOps rejected an invalid desktop request.");
    this.name = "IpcValidationError";
  }
}

export function createValidatedHandler<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  execute: (input: z.infer<TSchema>) => Promise<TResult>,
) {
  return async (input: unknown): Promise<TResult> => {
    const result = schema.safeParse(input);
    if (!result.success) throw new IpcValidationError();
    return execute(result.data);
  };
}
