import { PlatformAdapter } from "./adapter";
import { linkedinAdapter } from "./linkedin";
import { xAdapter } from "./x";
import { xiaohongshuAdapter } from "./xiaohongshu";

const adapters: Record<string, PlatformAdapter> = {
  linkedin: linkedinAdapter,
  x: xAdapter,
  xiaohongshu: xiaohongshuAdapter
};

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Adapter not found for platform ${platform}`);
  }
  return adapter;
}
