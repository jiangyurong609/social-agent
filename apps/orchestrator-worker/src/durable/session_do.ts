// TODO(MVP): implement SessionDo Durable Object
export class SessionDo {
  constructor(public state: DurableObjectState, public env: unknown) {}

  async fetch(): Promise<Response> {
    return new Response("not implemented", { status: 501 });
  }
}

// Minimal type for DurableObjectState
type DurableObjectState = {
  id: { toString(): string };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
  };
};
