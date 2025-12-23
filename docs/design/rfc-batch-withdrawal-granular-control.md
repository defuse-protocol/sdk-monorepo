# RFC: Granular Control Over Batch Withdrawals

- **Status**: Draft
- **Author**: cawabunga-bytes
- **Created**: 2025-12-08

## Summary

Add `watchWithdrawals` and `describeWithdrawals` methods to enable granular tracking of batch withdrawal completion, allowing services to process each withdrawal independently as it completes.

## Problem Statement

The SDK supports batch withdrawals - multiple tokens withdrawn in a single intent. For example: USDC to Solana + BTC refund to Bitcoin.

Current `waitForWithdrawalCompletion` has limitations:

1. **Waits for slowest** - Fast withdrawal (Solana ~2s) blocked by slow withdrawal (Bitcoin ~1hr)
2. **All-or-nothing failure** - If one withdrawal fails, entire function throws
3. **No progress visibility** - Can't know which withdrawals completed until all finish

## Requirements

1. **Granular results** - Process each withdrawal as it completes
2. **Independent failures** - One failure doesn't affect others
3. **Recovery-friendly** - Works after service restart with saved data
4. **Optimized polling** - SDK handles per-chain timing internally
5. **Simple API** - Easy to use correctly

## Design Considerations

### Why not callbacks?

```typescript
await sdk.waitForWithdrawalCompletion({
  withdrawalParams,
  intentTx,
  onComplete: (index, result) => { ... }
});
```

Problems:
- No backpressure - SDK might call again before async handler finishes
- Exit control requires `AbortSignal` only, can't `break`
- Error handling unclear - throw in callback?

### Array of Promises (chosen approach)

```typescript
// After intent submission
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });
promises[0].then(tx => saveUsdc(tx));
promises[1].then(tx => saveBtc(tx));

// Or wait for specific one
const usdcTx = await promises[0];

// Or process sequentially with backpressure (AsyncIterator-like)
const pending = new Map(promises.map((p, i) => [i, p]));
while (pending.size > 0) {
  const { index, tx } = await Promise.race(
    [...pending.entries()].map(async ([i, p]) => ({ index: i, tx: await p }))
  );
  pending.delete(index);
  await processUpdate(index, tx);  // Backpressure maintained!
}
```

Pros:
- Natural for "fire and forget" patterns
- Easy to wait for specific withdrawal by index
- Simple mental model - just promises
- Recovery works: recreate promises from saved `{ withdrawalParams, intentTx }`
- Backpressure achievable via `Promise.race` loop (see example above)
- Most generic: supports all patterns (parallel, sequential, specific)

Cons:
- Separate `.catch()` per promise for error handling
- Sequential processing requires more code than AsyncIterator

### Promise.allSettled wrapper

```typescript
const results = await sdk.waitForWithdrawalCompletion({
  withdrawalParams,
  intentTx,
  settleMode: 'allSettled',
});
```

Problems:
- Still waits for slowest withdrawal
- No real-time progress

### AsyncIterator

```typescript
for await (const update of sdk.watchWithdrawals({ withdrawalParams, intentTx })) {
  if (update.status === 'completed') {
    await saveSuccess(update.index, update.tx);
  }
}
```

Pros:
- **Backpressure** - SDK waits for your async work
- **Exit control** - `break` to exit early
- **Natural error handling** - throw breaks loop
- Single loop handles all withdrawals uniformly

Cons:
- More verbose for simple "fire and forget" cases
- Cannot easily wait for specific withdrawal by index
- More complex SDK implementation
- Less composable - cannot build other patterns on top of it

### Decision

Array of Promises chosen because:
1. **Most generic** - supports fire-and-forget, specific await, AND sequential processing with backpressure
2. **Composable** - AsyncIterator CAN be built on top of promises via `Promise.race`, but not vice versa
3. **Simpler primitive** - easier to understand and implement in SDK
4. **Flexible** - users choose their own concurrency pattern

**Backpressure with Promise.race:**

```typescript
// Sequential processing with backpressure (same safety as AsyncIterator)
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });
const pending = new Map(promises.map((p, i) => [i, p]));

while (pending.size > 0) {
  const { index, tx } = await Promise.race(
    [...pending.entries()].map(async ([i, p]) => ({ index: i, tx: await p }))
  );
  pending.delete(index);

  if (index === 0) quoteEntity.destinationTx = tx.hash;
  if (index === 1) quoteEntity.refundTx = tx.hash;
  await db.save(quoteEntity);  // Backpressure: next promise only resolves after this
}
```

## API Design

### Types

```typescript
interface CreateWithdrawalCompletionPromisesParams {
  withdrawalParams: WithdrawalParams[];
  intentTx: NearTxInfo;
  signal?: AbortSignal;
  retryOptions?: RetryOptions[];  // per-withdrawal
}
```

### Methods

```typescript
// Primary: returns array of promises, one per withdrawal
sdk.createWithdrawalCompletionPromises(params: CreateWithdrawalCompletionPromisesParams): Array<Promise<TxInfo | TxNoInfo>>

// Convenience: waits for all (uses createWithdrawalCompletionPromises internally)
sdk.waitForWithdrawalCompletion(params): Promise<(TxInfo | TxNoInfo)[]>
```

## Usage Examples

### Fire and forget

```typescript
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });
promises[0].then(tx => saveUsdc(tx)).catch(err => logError(0, err));
promises[1].then(tx => saveBtc(tx)).catch(err => logError(1, err));
```

### Await specific withdrawal

```typescript
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });

// Wait for USDC (fast chain) immediately
const usdcTx = await promises[0];
await notifyUser('USDC received', usdcTx.hash);

// BTC will resolve later, handle separately
promises[1].then(tx => notifyUser('BTC received', tx.hash));
```

### Sequential processing with backpressure

```typescript
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });
const pending = new Map(promises.map((p, i) => [i, p]));

while (pending.size > 0) {
  const { index, tx } = await Promise.race(
    [...pending.entries()].map(async ([i, p]) => ({ index: i, tx: await p }))
  );
  pending.delete(index);
  await saveSuccess(index, tx);  // Backpressure: waits before processing next
}
```

### Wait for all (parallel)

```typescript
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });
const results = await Promise.allSettled(promises);

for (const [i, result] of results.entries()) {
  if (result.status === 'fulfilled') {
    await saveSuccess(i, result.value);
  } else {
    await saveFailure(i, result.reason);
  }
}
```

### With timeout

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 25_000);

const promises = sdk.createWithdrawalCompletionPromises({
  withdrawalParams,
  intentTx,
  signal: controller.signal
});

// Promises reject with AbortError when signal fires
const results = await Promise.allSettled(promises);
```

### Recovery after restart

```typescript
// Load saved state
const { intentTx, withdrawalParams, handledIndexes } = await db.load(quoteId);
const handled = new Set(handledIndexes);

// Resume - same API, SDK re-checks all withdrawals
const promises = sdk.createWithdrawalCompletionPromises({ withdrawalParams, intentTx });

for (const [i, promise] of promises.entries()) {
  if (handled.has(i)) continue;  // Already processed

  try {
    const tx = await promise;
    await saveSuccess(i, tx);
    handled.add(i);
    await db.update(quoteId, { handledIndexes: [...handled] });
  } catch (err) {
    await saveFailure(i, err);
  }
}
```

## Behavioral Details

### Promise resolution

- Each promise resolves independently when its withdrawal completes
- Promises poll internally with optimized timing per chain
- A promise only resolves/rejects once (settled state)

### Error handling

- Network errors: SDK retries internally per withdrawal
- Exhausted retries: promise rejects with error
- One withdrawal's failure doesn't affect others

### Abort signal

- When signal fires, pending promises reject with `AbortError`
- Already-resolved promises are unaffected
- Use `Promise.allSettled` to handle partial completion gracefully

### Index correspondence

Array index of returned promise matches array index of input `withdrawalParams`. SDK handles internal per-route indexing transparently.

## State Persistence

Minimal state to save for recovery:

```typescript
{
  intentTx: NearTxInfo,
  withdrawalParams: WithdrawalParams[],
  handledIndexes: number[],
}
```

All inputs are serializable plain data. No SDK-internal state needed.
