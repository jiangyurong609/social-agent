import type { Node } from "./node";

const registry = new Map<string, () => Node<any, any>>();

export function registerNode(type: string, factory: () => Node<any, any>) {
  registry.set(type, factory);
}

export function createNode(type: string): Node<any, any> {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Node type not registered: ${type}`);
  }
  return factory();
}

export function clearRegistry() {
  registry.clear();
}
