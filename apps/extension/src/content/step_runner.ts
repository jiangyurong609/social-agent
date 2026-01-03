import type { Step, StepRunResult } from "../shared/types";

function query(selector: string): HTMLElement | null {
  return document.querySelector(selector) as HTMLElement | null;
}

async function waitFor(selector: string, timeoutMs = 5000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = query(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for selector ${selector}`);
}

export async function runSteps(steps: Step[]): Promise<StepRunResult> {
  try {
    for (const step of steps) {
      switch (step.type) {
        case "goto":
          window.location.href = step.url;
          await new Promise((r) => setTimeout(r, 500));
          break;
        case "waitFor":
          await waitFor(step.selector, step.timeoutMs);
          break;
        case "click": {
          const el = await waitFor(step.selector);
          (el as HTMLElement).click();
          break;
        }
        case "type": {
          const el = await waitFor(step.selector);
          const target = el as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
          (target as any).focus?.();
          if ("value" in target) {
            (target as HTMLInputElement).value = step.text;
          } else {
            target.textContent = step.text;
          }
          break;
        }
        case "assertText": {
          const el = await waitFor(step.selector);
          const text = (el.textContent || "").trim();
          if (!text.includes(step.contains)) throw new Error(`assertText failed: ${step.contains}`);
          break;
        }
        default:
          throw new Error(`Unsupported step ${JSON.stringify(step)}`);
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
