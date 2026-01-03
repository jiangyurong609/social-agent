import { Workflow } from "@social-agent/schemas";

export function compileGraphToTs(graph: Workflow): string {
  const header = `// Auto-generated from workflow graph ${graph.id} v${graph.version}`;
  const body = `export async function handle(input: unknown) { return input; }`;
  return [header, body].join("\n");
}
