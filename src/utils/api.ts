type GetRequestOpts = {
  path: string;
  query?: URLSearchParams;
};

export const API = {
  get: <TResponse>({ path, query }: GetRequestOpts, config: RequestInit = {}) =>
    request<TResponse>(APIUrl(path, query), config),

  patch: <TBody extends BodyInit, TResponse>(
    path: string,
    body?: TBody,
    config: RequestInit = {},
  ) => request<TResponse>(APIUrl(path), { ...config, body, method: "PATCH" }),

  // Using `extends` to set a type constraint:
  post: <TBody extends BodyInit, TResponse>(
    path: string,
    body?: TBody,
    config: RequestInit = {},
  ) => request<TResponse>(APIUrl(path), { ...config, body, method: "POST" }),

  put: <TBody extends BodyInit, TResponse>(
    path: string,
    body?: TBody,
    config: RequestInit = {},
  ) => request<TResponse>(APIUrl(path), { ...config, body, method: "PUT" }),
};

type APIError = {
  msg?: string;
};

type APIErrorResponse = {
  error?: APIError;
  message?: string;
};

export class APIResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends Error {}

export function APIUrl(path: string, query?: URLSearchParams) {
  const configText =
    document.querySelector("script#config__json")?.textContent || "{}";
  const pageConfig = JSON.parse(configText);

  const riverApiBaseUrl =
    pageConfig.apiUrl || import.meta.env.VITE_RIVER_API_BASE_URL;

  return `${riverApiBaseUrl}${path}${query ? `?${query}` : ""}`;
}

async function parseJSONResponse<TResponse>(
  response: Response,
  url: string,
): Promise<TResponse> {
  const contentType = response.headers.get("Content-Type");
  if (!contentType?.includes("application/json")) {
    const received = contentType || "unknown content type";
    throw new APIResponseError(
      `Expected JSON response from ${url}, received ${received}.`,
      response.status,
      response.statusText,
    );
  }

  return (await response.json()) as TResponse;
}

async function request<TResponse>(
  url: string,
  config: RequestInit,
): Promise<TResponse> {
  const headers = new Headers(config.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(url, { ...config, headers });
  if (response.ok) {
    return await parseJSONResponse<TResponse>(response, url);
  }

  const message = await responseErrorMessage(response);
  if (response.status == 404) {
    throw new NotFoundError(message || "Resource not found.");
  }

  throw new APIResponseError(
    message || `Request failed with status ${response.status}.`,
    response.status,
    response.statusText,
  );
}

async function responseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    const json = (await response.json()) as APIErrorResponse;
    return json.message ?? json.error?.msg ?? "";
  }

  return (await response.text()).trim();
}
