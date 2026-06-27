# ADR-002: MongoDB Singleton Connection via globalThis

**Date:** 2026-06-26  
**Status:** Accepted

## Context

Next.js in development mode uses hot module replacement (HMR). Every time a source file changes, Node.js re-evaluates the affected modules. If `lib/mongodb.ts` were to call `new MongoClient(uri).connect()` at module evaluation time (top-level `await` or module-level variable initialisation), each HMR cycle would create a new connection — eventually exhausting the MongoDB connection pool limit and producing `MongoServerSelectionError: too many connections`.

## Decision

Store the `Promise<MongoClient>` in `globalThis._mongoClientPromise` during development. `globalThis` persists across HMR cycles because it lives on the Node.js global object, which is not re-evaluated when modules reload. In production, a new client is created once per process (no HMR, so no risk of multiple connections).

```ts
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  clientPromise = new MongoClient(uri).connect()
}
```

The exported `getDb()` function awaits `clientPromise` and calls `client.db(dbName)`, providing a thin API that API routes use without needing to know about connection management.

## Consequences

**Positive:**
- Zero connection leaks during development with hot reload.
- Single connection pool shared across all API route invocations in production.
- Simple, idiomatic pattern documented in the official Next.js MongoDB example.

**Negative:**
- The `globalThis` approach uses a loosely typed global declaration, requiring a `declare global` block in TypeScript.
- Not suitable for multi-database applications without extending the singleton to a map keyed by database name.

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| New MongoClient per request | Connection pool exhaustion; unacceptable latency for each request |
| Mongoose with `mongoose.connect()` | Adds an ODM layer with no benefit when the native driver is sufficient |
| Connection pooling via environment variable | Still creates new clients on HMR; globalThis is the correct boundary |
