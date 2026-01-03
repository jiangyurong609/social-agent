import { nowIso } from "@social-agent/shared";

export type TraceEvent =
  | { t: "RunStarted"; runId: string; at: string }
  | { t: "NodeStarted"; runId: string; nodeId: string; at: string; inputRef?: string }
  | { t: "NodeCompleted"; runId: string; nodeId: string; at: string; outputRef?: string }
  | { t: "ActionRequested"; runId: string; nodeId: string; requestId: string; platform: string; action: string; mode: string; at: string }
  | { t: "ActionResultReceived"; runId: string; requestId: string; ok: boolean; at: string; error?: unknown };

export interface TraceEmitter {
  emit: (event: TraceEvent) => Promise<void> | void;
}

export function createInMemoryEmitter(events: TraceEvent[] = []): TraceEmitter {
  return {
    emit: (event) => {
      events.push({ ...event, at: event.at ?? nowIso() });
    }
  };
}
