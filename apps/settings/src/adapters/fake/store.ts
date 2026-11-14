import type { AccountSettings } from "~/domain/types";

export interface FakeStore {
  state: AccountSettings;
  delayMs: number;
  now(): Date;
  nextId(prefix: string): string;
  snapshot(): AccountSettings;
  settle<T>(value: () => T): Promise<T>;
}

export interface FakeStoreOptions {
  delayMs?: number;
  now?: () => Date;
}

export function createFakeStore(seed: AccountSettings, options: FakeStoreOptions = {}): FakeStore {
  let counter = 0;
  const store: FakeStore = {
    state: structuredClone(seed),
    delayMs: options.delayMs ?? 0,
    now: options.now ?? (() => new Date()),
    nextId(prefix) {
      counter += 1;
      return `${prefix}_${counter.toString().padStart(4, "0")}`;
    },
    snapshot() {
      return structuredClone(store.state);
    },
    async settle(value) {
      if (store.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, store.delayMs));
      return value();
    },
  };
  return store;
}
