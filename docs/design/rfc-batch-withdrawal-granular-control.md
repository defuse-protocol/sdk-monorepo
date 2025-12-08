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

### Waiter objects

```typescript
// After intent submission
const withdrawals = sdk.createWithdrawalWaiters({ withdrawalParams, intentTx });
withdrawals[0].result.then(tx => saveUsdc(tx));
withdrawals[1].result.then(tx => saveBtc(tx));

// Or wait for specific one
const usdcTx = await withdrawals[0].result;
```

Pros:
- Natural for "fire and forget" patterns
- Easy to wait for specific withdrawal
- Simple mental model - just promises
- Recovery works: recreate waiters from saved `{ withdrawalParams, intentTx }`

Cons:
- No backpressure - `.then()` handler doesn't block SDK
- Separate `.catch()` per waiter for error handling
- Multiple handlers vs single loop

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

### AsyncIterator (chosen approach)

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
- **User-driven flow** - not SDK-driven
- Single loop handles all withdrawals uniformly

Cons:
- More verbose for simple "fire and forget" cases
- Must iterate to get specific withdrawal result

### Decision

AsyncIterator chosen because:
1. Backpressure is critical for reliable distributed systems (see example below)
2. Unified loop is easier to reason about for recovery logic
3. Waiter objects can be built on top of AsyncIterator if needed, but not vice versa

**Backpressure example:**

```typescript
// Waiter objects - race condition
withdrawals[0].result.then(async (tx) => {
  quoteEntity.destinationTx = tx.hash;
  await db.save(quoteEntity);  // Save starts
});
withdrawals[1].result.then(async (tx) => {
  quoteEntity.refundTx = tx.hash;
  await db.save(quoteEntity);  // Concurrent save - may overwrite first
});

// AsyncIterator - safe sequential updates
for await (const update of sdk.watchWithdrawals({...})) {
  if (update.index === 0) quoteEntity.destinationTx = update.tx.hash;
  if (update.index === 1) quoteEntity.refundTx = update.tx.hash;
  await db.save(quoteEntity);  // SDK waits before yielding next
}
```

## API Design

### Types

```typescript
type WithdrawalStatus =
  | { status: 'pending' }
  | { status: 'completed'; tx: TxInfo | TxNoInfo }
  | { status: 'failed'; error: Error }

interface WithdrawalUpdate {
  index: number;
  params: WithdrawalParams;
  status: 'pending' | 'completed' | 'failed';
  tx?: TxInfo | TxNoInfo;   // if completed
  error?: Error;             // if failed
}

interface WatchWithdrawalsParams {
  withdrawalParams: WithdrawalParams[];
  intentTx: NearTxInfo;
  signal?: AbortSignal;
  retryOptions?: RetryOptions[];  // per-withdrawal
}

interface DescribeWithdrawalsParams {
  withdrawalParams: WithdrawalParams[];
  intentTx: NearTxInfo;
}
```

### Methods

```typescript
// Low-level: single poll, returns current state
sdk.describeWithdrawals(params: DescribeWithdrawalsParams): Promise<WithdrawalStatus[]>

// High-level: optimized streaming, yields updates as they happen
sdk.watchWithdrawals(params: WatchWithdrawalsParams): AsyncIterable<WithdrawalUpdate>

// Legacy: waits for all (unchanged, uses watchWithdrawals internally)
sdk.waitForWithdrawalCompletion(params): Promise<(TxInfo | TxNoInfo)[]>
```

## Usage Examples

### Basic usage

```typescript
for await (const update of sdk.watchWithdrawals({ withdrawalParams, intentTx })) {
  if (update.status === 'completed') {
    await saveSuccess(update.index, update.tx);
  }

  if (update.status === 'failed') {
    await saveFailure(update.index, update.error);
  }
}
// Loop exits when all withdrawals are completed or failed
```

### With index tracking

```typescript
const destinationIndex = withdrawalParams.length;
withdrawalParams.push(destinationWithdrawal);

const refundIndex = withdrawalParams.length;
withdrawalParams.push(refundWithdrawal);

for await (const update of sdk.watchWithdrawals({ withdrawalParams, intentTx })) {
  if (update.status === 'completed') {
    if (update.index === destinationIndex) {
      quoteEntity.destinationChainTxHashes.push(update.tx.hash);
    }
    if (update.index === refundIndex) {
      quoteEntity.originChainTxHashes.push(update.tx.hash);
    }
  }
}
```

### With timeout (graceful exit)

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 25_000);

for await (const update of sdk.watchWithdrawals({
  withdrawalParams,
  intentTx,
  signal: controller.signal
})) {
  processUpdate(update);
}

// Check exit reason
if (controller.signal.aborted) {
  // Exited early, save progress for retry
} else {
  // All withdrawals done
}
```

### Recovery after restart

```typescript
// Load saved state
const { intentTx, withdrawalParams, handledIndexes } = await db.load(quoteId);
const handled = new Set(handledIndexes);

// Resume - same API, SDK re-checks all withdrawals
for await (const update of sdk.watchWithdrawals({ withdrawalParams, intentTx })) {
  if (update.status === 'completed' && !handled.has(update.index)) {
    await saveSuccess(update.index, update.tx);
    handled.add(update.index);
    await db.update(quoteId, { handledIndexes: [...handled] });
  }
}
```

### Single poll (cron job style)

```typescript
const statuses = await sdk.describeWithdrawals({ withdrawalParams, intentTx });

for (const [i, status] of statuses.entries()) {
  if (status.status === 'completed' && !handled.has(i)) {
    await processComplete(i, status.tx);
    handled.add(i);
  }
}
// Exit immediately, run again next cron tick
```

## Behavioral Details

### Yielding

- Yields once per status change (not per poll)
- First yield is immediate after initial poll
- Only yields for the withdrawal that changed

### Error handling

- Network errors: SDK retries internally per withdrawal
- Exhausted retries: yields `{ status: 'failed', error }` for that withdrawal
- One withdrawal's failure doesn't affect others

### Abort signal

- Abort = graceful exit, not throw
- Loop stops yielding, exits normally
- User checks `signal.aborted` to distinguish from completion

### Index calculation

Indexes are per-route internally (for bridge correlation), but exposed as array index to user. SDK handles the mapping transparently.

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
