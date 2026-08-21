// `server-only` is resolved by Next, not installed as a package, so anything importing it is
// unloadable under Vitest without this stub.
export {};
