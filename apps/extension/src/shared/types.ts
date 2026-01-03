export type Step =
  | { type: "goto"; url: string }
  | { type: "waitFor"; selector: string; timeoutMs?: number }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string }
  | { type: "assertText"; selector: string; contains: string };

export interface StepRunResult {
  ok: boolean;
  error?: string;
}
