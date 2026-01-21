---
"@defuse-protocol/contract-types": minor
---

Add Standard Schema compliant validators with lazy compilation and type inference helpers

## New Export Added: `@defuse-protocol/contract-types/validate`. Example Usage:

```typescript
import {
  MultiPayloadNarrowedValidator,
  type InferOutput,
} from "@defuse-protocol/contract-types/validate";

// Validate data
const result = MultiPayloadNarrowedValidator.validate(data);
if (result.issues) {
  console.error("Validation failed:", result.issues);
} else {
  // result.value is typed as MultiPayloadNarrowed__Parsed
  console.log(result.value);
}

// Type inference if you need it (all the types are available to be imported directly from @defuse-protocol/contract-types as before)
type MyPayload = InferOutput<typeof MultiPayloadNarrowedValidator>;
```

## Library Integrations

Works with any Standard Schema compatible library. See test files for copyable wrapper code:

- **Hono/tRPC/TanStack Form** - use validators directly (Standard Schema)
- **class-validator (NestJS)** - see `class-validator.test.ts` for `ValidateWithSchema` decorator
- **Zod** - see `zod.test.ts` for `toZodSchema()` wrapper
- **Valibot** - see `valibot.test.ts` for `toValibotSchema()` wrapper
- **ArkType** - see `arktype.test.ts` for `toArkTypeSchema()` wrapper
