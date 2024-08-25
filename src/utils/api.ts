type GetRequestOpts = {
  path: string;
  query?: URLSearchParams;
};

export const API = {
  get: <TResponse>({ path, query }: GetRequestOpts, config: RequestInit = {}) =>
    request<TResponse>(APIUrl(path, query), config),

  // Using `extends` to set a type constraint:
  post: <TBody extends BodyInit, TResponse>(
    path: string,
    body?: TBody,
    config: RequestInit = {}
  ) => request<TResponse>(APIUrl(path), { ...config, method: "POST", body }),

  put: <TBody extends BodyInit, TResponse>(
    path: string,
    body?: TBody,
    config: RequestInit = {}
  ) => request<TResponse>(APIUrl(path), { ...config, method: "PUT", body }),
};

export function APIUrl(path: string, query?: URLSearchParams) {
  const configText =
    document.querySelector("script#config__json")?.textContent || "{}";
  const pageConfig = JSON.parse(configText);

  const riverApiBaseUrl =
    pageConfig.apiUrl || import.meta.env.VITE_RIVER_API_BASE_URL;

  return `${riverApiBaseUrl}${path}${query ? `?${query}` : ""}`;
}

type APIErrorResponse = {
  error: APIError;
};

type APIError = {
  msg: string;
};

export class NotFoundError extends Error {}

async function request<TResponse>(
  url: string,
  config: RequestInit
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
