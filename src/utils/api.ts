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
  msg: string;
};

type APIErrorResponse = {
  error: APIError;
};

export class NotFoundError extends Error {}

export function APIUrl(path: string, query?: URLSearchParams) {
  const configText =
    document.querySelector("script#config__json")?.textContent || "{}";
  const pageConfig = JSON.parse(configText);

  const riverApiBaseUrl =
    pageConfig.apiUrl || import.meta.env.VITE_RIVER_API_BASE_URL;

  return `${riverApiBaseUrl}${path}${query ? `?${query}` : ""}`;
}

async function request<TResponse>(
  url: string,
  config: RequestInit,
): Promise<TResponse> {
  const response = await fetch(url, config);
  if (response.ok) {
    return await response.json();
  } else if (response.status == 404) {
    const json = (await response.json()) as APIErrorResponse;
    throw new NotFoundError(json.error.msg);
  } else {
    throw new Error(`unhandled response with status ${response.status}`);
  }
}
