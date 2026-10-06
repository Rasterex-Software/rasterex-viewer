import { createEvaluationError, RasterexViewerError } from "../errors.js";
import { ERROR_CODES } from "../protocol/index.js";
import type { EvaluationRegistrationOptions } from "../types/index.js";

export const VIEWSPACE_EVALUATION_TOKEN_KEY = "rx_viewspace_evaluation_token";

const EVALUATION_API_BASE_URL =
  "https://rxserver.rasterex.com/api/viewspace/evaluation";
const REQUEST_TIMEOUT_MS = 10_000;
const VALIDATION_MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;

export interface EvaluationValidation {
  expires: string;
}

interface ActivationResponse {
  token: string;
  expires: string;
}

interface ValidationResponse {
  valid: boolean;
  expires?: string;
  reason?: string | null;
}

export class EvaluationService {
  private initialization: Promise<EvaluationValidation> | null = null;
  private controller: AbortController | null = null;
  private destroyed = false;

  constructor(private readonly registration?: EvaluationRegistrationOptions) {}

  initialize(): Promise<EvaluationValidation> {
    if (!this.initialization) {
      this.initialization = this.initializeEvaluation();
    }

    return this.initialization;
  }

  destroy(): void {
    this.destroyed = true;
    this.controller?.abort();
    this.controller = null;
  }

  private async initializeEvaluation(): Promise<EvaluationValidation> {
    const token = this.readToken();
    return this.validateToken(token ?? (await this.createAndStoreToken()));
  }

  private readToken(): string | null {
    try {
      const token = window.localStorage.getItem(VIEWSPACE_EVALUATION_TOKEN_KEY);
      return isNonEmptyString(token) ? token : null;
    } catch (cause) {
      throw this.createFailure(ERROR_CODES.evaluationRegistrationFailed, "storage-read", cause);
    }
  }

  private async createAndStoreToken(): Promise<string> {
    let response: ActivationResponse;
    const failureCode = getRegistrationDetails(this.registration)
      ? ERROR_CODES.evaluationRegistrationFailed
      : ERROR_CODES.evaluationActivationFailed;

    try {
      response = await this.requestActivation();
    } catch (cause) {
      if (cause instanceof RasterexViewerError) {
        throw cause;
      }

      throw this.createFailure(failureCode, "request", cause);
    }

    if (!isNonEmptyString(response.token)) {
      throw this.createFailure(failureCode, "response");
    }

    try {
      window.localStorage.setItem(VIEWSPACE_EVALUATION_TOKEN_KEY, response.token);
    } catch (cause) {
      throw this.createFailure(failureCode, "storage", cause);
    }

    return response.token;
  }

  private async validateToken(token: string): Promise<EvaluationValidation> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= VALIDATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.requestValidation(token);

        if (response.valid) {
          if (!isNonEmptyString(response.expires)) {
            throw this.createFailure(ERROR_CODES.evaluationValidationFailed, "response");
          }

          return { expires: response.expires };
        }

        if (response.reason === ERROR_CODES.evaluationExpired) {
          throw createEvaluationError(
            ERROR_CODES.evaluationExpired,
            "Rasterex Viewer evaluation has expired.",
            response.expires ? { expires: response.expires } : undefined
          );
        }

        if (response.reason === ERROR_CODES.invalidToken) {
          throw createEvaluationError(
            ERROR_CODES.invalidToken,
            "Rasterex Viewer evaluation token is invalid.",
            response.expires ? { expires: response.expires } : undefined
          );
        }

        throw this.createFailure(ERROR_CODES.evaluationValidationFailed, "response");
      } catch (cause) {
        if (!isTransientFailure(cause) || attempt === VALIDATION_MAX_ATTEMPTS) {
          throw this.toValidationFailure(cause);
        }

        lastError = cause;
        await this.delayBeforeRetry(attempt);
      }
    }

    throw this.toValidationFailure(lastError);
  }

  private async requestActivation(): Promise<ActivationResponse> {
    const registration = getRegistrationDetails(this.registration);
    const response = await this.request(
      registration ? "register" : "activate",
      registration ?? {}
    );

    if (!response.ok) {
      throw new EvaluationHttpError(response.status);
    }

    return parseActivationResponse(await response.json());
  }

  private async requestValidation(token: string): Promise<ValidationResponse> {
    const response = await this.request("validate", { token });
    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      if (response.status === 404) {
        const validation = parseValidationResponse(body);

        if (
          !validation.valid &&
          (validation.reason === ERROR_CODES.evaluationExpired ||
            validation.reason === ERROR_CODES.invalidToken)
        ) {
          return validation;
        }
      }

      throw new EvaluationHttpError(response.status);
    }

    return parseValidationResponse(body);
  }

  private async request(path: string, body: Record<string, string>): Promise<Response> {
    if (this.destroyed) {
      throw new EvaluationAbortedError();
    }

    const controller = new AbortController();
    this.controller = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      return await fetch(`${EVALUATION_API_BASE_URL}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (cause) {
      if (this.destroyed) {
        throw new EvaluationAbortedError();
      }

      throw new EvaluationNetworkError(timedOut, cause);
    } finally {
      window.clearTimeout(timeoutId);
      if (this.controller === controller) {
        this.controller = null;
      }
    }
  }

  private async delayBeforeRetry(attempt: number): Promise<void> {
    const delay = Math.min(
      INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
      MAX_RETRY_DELAY_MS
    );
    const jitteredDelay = delay * (0.75 + Math.random() * 0.5);

    await new Promise<void>((resolve) => window.setTimeout(resolve, jitteredDelay));
  }

  private toValidationFailure(cause: unknown): RasterexViewerError {
    if (cause instanceof RasterexViewerError) {
      return cause;
    }

    if (cause instanceof EvaluationAbortedError) {
      return createEvaluationError(
        ERROR_CODES.evaluationValidationFailed,
        "Rasterex Viewer evaluation validation was cancelled.",
        { stage: "aborted" }
      );
    }

    return this.createFailure(ERROR_CODES.evaluationValidationFailed, "request", cause);
  }

  private createFailure(
    code:
      | typeof ERROR_CODES.evaluationActivationFailed
      | typeof ERROR_CODES.evaluationRegistrationFailed
      | typeof ERROR_CODES.evaluationValidationFailed,
    stage: "storage-read" | "storage" | "request" | "response" | "registration",
    cause?: unknown
  ): RasterexViewerError {
    return createEvaluationError(
      code,
      code === ERROR_CODES.evaluationActivationFailed
        ? "Rasterex Viewer evaluation activation failed."
        : code === ERROR_CODES.evaluationRegistrationFailed
          ? "Rasterex Viewer evaluation registration failed."
          : "Rasterex Viewer evaluation validation failed.",
      {
        stage,
        ...(cause instanceof EvaluationHttpError ? { status: cause.status } : {}),
        ...(cause instanceof EvaluationNetworkError && cause.timedOut
          ? { timeoutMs: REQUEST_TIMEOUT_MS }
          : {})
      }
    );
  }
}

class EvaluationHttpError extends Error {
  constructor(readonly status: number) {
    super(`Evaluation request failed with status ${status}.`);
  }
}

class EvaluationNetworkError extends Error {
  constructor(readonly timedOut: boolean, readonly cause: unknown) {
    super(timedOut ? "Evaluation request timed out." : "Evaluation request failed.");
  }
}

class EvaluationAbortedError extends Error {}

function isTransientFailure(cause: unknown): boolean {
  return (
    cause instanceof EvaluationNetworkError ||
    (cause instanceof EvaluationHttpError &&
      (cause.status === 408 || cause.status === 429 || cause.status >= 500))
  );
}

function parseActivationResponse(value: unknown): ActivationResponse {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.token) ||
    !isNonEmptyString(value.expires)
  ) {
    throw new Error("Invalid evaluation activation response.");
  }

  return { token: value.token, expires: value.expires };
}

function parseValidationResponse(value: unknown): ValidationResponse {
  if (!isRecord(value) || typeof value.valid !== "boolean") {
    throw new Error("Invalid evaluation validation response.");
  }

  return {
    valid: value.valid,
    expires: isNonEmptyString(value.expires) ? value.expires : undefined,
    reason: typeof value.reason === "string" || value.reason === null ? value.reason : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getRegistrationDetails(
  registration?: EvaluationRegistrationOptions
): Record<string, string> | undefined {
  if (!isNonEmptyString(registration?.company) || !isNonEmptyString(registration?.email)) {
    return undefined;
  }

  return {
    company: registration.company.trim(),
    email: registration.email.trim()
  };
}
