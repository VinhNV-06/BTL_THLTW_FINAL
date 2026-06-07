import { request } from "umi";
import type { RequestOptions } from "umi";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.UMI_APP_API_URL || ""
    : "http://localhost:5000";

export const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  return request<T>(fullUrl, {
    ...options,
    headers: {
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });
}

export function getApiUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";

  const url = isProduction
    ? process.env.UMI_APP_API_URL || ""
    : "http://localhost:5000";

  return url.endsWith("/") ? url.slice(0, -1) : url;
}
