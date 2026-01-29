# Tools

- Use `node` as Node.js runtime
- Use `pnpm` as package manager
- Use `vitest` as test runner

# Development Commands

- `pnpm typecheck` check TypeScript types.
- `pnpm test` to run test
- `pnpm lint:fix` to run linter and formatter (biomejs)
- `pnpm build` to build packages

# Verifying Changes

Before finishing work on any file:

1. **TypeScript**: Check if the file/directory has its own `tsconfig.json`. If so, run `npx tsc --noEmit -p <path-to-tsconfig>` directly. The root `pnpm typecheck` may not cover all files (e.g., scripts with separate tsconfig).
2. **Lint**: Run `pnpm biome check <file>` on modified files.
3. **Tests**: Run relevant tests with `pnpm vitest run <path>`.

Example for `packages/contract-types/scripts/`:
```bash
cd packages/contract-types
npx tsc --noEmit -p scripts/tsconfig.json  # scripts have their own tsconfig
pnpm biome check scripts/gen-defuse-types.ts
```

# Architecture

- Progressive disclosure - simple things simple, complex things possible. Give escape hatches when needed

# Code Style

- Do not use `any` type
- Do not use `as` typecasting to silence TypeScript errors. If you encounter type errors:
  - Fix the root cause (add proper type guards, narrow types correctly)
  - Use destructuring and validation to build properly typed values
  - Throw an error if the data is invalid
  - Ask for help if stuck
- Do not use `as never` cast
- Do not use `as unknown as X` pattern - this is a double cast that hides type errors
- The only acceptable use of `as` is `as const` for literal types
- Do not use barrel files
- Avoid arbitrary strings, use const enums (`as const`) instead.
- In catch blocks error is `unknown`: `catch (err: unknown) { ... }`

# Testing Guidelines

Write tests with these rules:

- Prefer fewer, high-value tests over many similar ones. Do not test the same behaviour twice.
- Use as few mocks as possible. Only mock external dependencies (HTTP, DB, time, randomness, external services). Do not mock the class/module under test itself.
- Treat the code as a black box. Do not test implementation details (private helpers, internal state, specific algorithms).
- Do not test logs or logging behaviour unless they are part of the public contract or user-visible output.
- Do not write tests whose only purpose is to check TypeScript's static types. Types are checked at compile time. Instead, focus on runtime behaviour. Only exception if the type is complex and we need to test the type behaviour separately.
- Focus tests on:
    - Main "happy path" flows.
    - Important edge cases and error handling.
    - Regression scenarios that previously broke.
- Use clear, descriptive test names that explain the scenario and the expected result.
- Prefer Arrange–Act–Assert structure inside each test.
- Avoid heavy fixtures or setup when not needed.
- Use Vitest syntax with TypeScript.
- Do not write conditional tests (e.g. `if (condition) { ... }`). Tests should be deterministic. If you still need conditional tests, use `expect.assertions(N)` to ensure all expected assertions run.
- When asserting collaborator calls, use `expect.objectContaining` and focus on important fields instead of all properties.
- Avoid using "should" in test descriptions, use present tense instead.

# Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
