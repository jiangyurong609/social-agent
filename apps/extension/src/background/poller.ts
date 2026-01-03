let intervalId: any;

export function startPoller(apiBase: string, userId: string, handleAction: (action: any) => Promise<void>) {
  stopPoller();
  intervalId = setInterval(async () => {
    const res = await safeFetch<{ ok: boolean; pending: boolean; action?: any }>(`${apiBase}/extension/poll?userId=${encodeURIComponent(userId)}`);
    if (!res || (res as any).ok === false) return;
    if (!(res as any).pending || !(res as any).action) return;
    await handleAction((res as any).action);
  }, 1500);
}

export function stopPoller() {
  if (intervalId) clearInterval(intervalId);
}

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | { ok: boolean; error?: unknown }> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("json");
    return (isJson ? await res.json() : await res.text()) as T;
  } catch (error) {
    return { ok: false, error };
  }
}
