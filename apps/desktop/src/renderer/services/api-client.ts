import type { z } from "zod";

type RequestOptions<TSchema extends z.ZodType> = {
  schema: TSchema;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

type ApiClientDependencies = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImplementation?: typeof fetch;
  createCorrelationId?: () => string;
};

type ApiSuccessEnvelope = {
  ok: true;
  data: unknown;
  correlationId: string;
};

type ApiFailureEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  correlationId: string;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly correlationId: string | null;

  constructor(message: string, code: string, correlationId: string | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.correlationId = correlationId;
  }
}

function isSuccessEnvelope(value: unknown): value is ApiSuccessEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Record<string, unknown>;
  return envelope.ok === true && typeof envelope.correlationId === "string" && "data" in envelope;
}

function isFailureEnvelope(value: unknown): value is ApiFailureEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Record<string, unknown>;
  const error = envelope.error;
  return (
    envelope.ok === false &&
    typeof envelope.correlationId === "string" &&
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as Record<string, unknown>).code === "string" &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function resolveEndpoint(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  const endpoint = new URL(path, `${base.toString().replace(/\/$/, "")}/`);

  if (endpoint.origin !== base.origin || !path.startsWith("/")) {
    throw new ApiClientError("The requested API path is invalid.", "invalid_api_path");
  }

  return endpoint.toString();
}

export function createApiClient({
  baseUrl,
  getAccessToken,
  fetchImplementation = fetch,
  createCorrelationId = () => crypto.randomUUID(),
}: ApiClientDependencies) {
  const request = async <TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>,
  ): Promise<z.infer<TSchema>> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new ApiClientError("Your session has expired. Sign in again.", "session_required");
    }

    const response = await fetchImplementation(resolveEndpoint(baseUrl, path), {
      method: options.method ?? "GET",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "x-correlation-id": createCorrelationId(),
      },
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || isFailureEnvelope(payload)) {
      if (isFailureEnvelope(payload)) {
        throw new ApiClientError(payload.error.message, payload.error.code, payload.correlationId);
      }
      throw new ApiClientError("SprintOps could not complete the request.", "invalid_api_response");
    }

    if (!isSuccessEnvelope(payload)) {
      throw new ApiClientError("SprintOps received an invalid server response.", "invalid_api_response");
    }

    const parsed = options.schema.safeParse(payload.data);
    if (!parsed.success) {
      throw new ApiClientError("SprintOps received unexpected data.", "invalid_api_data", payload.correlationId);
    }

    return parsed.data;
  };

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
