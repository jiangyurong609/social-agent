// D1 database binding type
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: object;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// Worker environment bindings
export interface ApiWorkerEnv {
  D1?: D1Database; // Cloudflare D1 binding
  ORCHESTRATOR_BASE?: string; // optional orchestrator URL for action-result forwarding
  XHS_MCP_BASE?: string; // xiaohongshu-mcp server URL (Cloud Run)
}
