import { AsyncLocalStorage } from "node:async_hooks";

export type ApiIdentity = { id: string; name: string; email: string; image: string | null };
// Only the authenticated v1 dispatcher can establish this context. Headers cannot set it.
export const apiContext = new AsyncLocalStorage<ApiIdentity>();
