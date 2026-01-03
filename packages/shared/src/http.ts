export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: unknown;
}

export async function safeFetch<T>(url: string, init?: RequestInit): Promise<HttpResponse<T>> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("json");
    const data = (isJson ? await res.json() : await res.text()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, error };
  }
}
