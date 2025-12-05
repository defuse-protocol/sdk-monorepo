## Testing Guidelines

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
- Use Vitest syntax with TypeScript. Prefer not to use `any` type.
- Do not write conditional tests (e.g. `if (condition) { ... }`). Tests should be deterministic. If you still need conditional tests, use `expect.assertions(N)` to ensure all expected assertions run.
- When asserting collaborator calls, use `expect.objectContaining` and focus on important fields instead of all properties.
- Avoid using "should" in test descriptions, use present tense instead.