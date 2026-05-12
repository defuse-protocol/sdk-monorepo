---
"@defuse-protocol/intents-sdk": patch
"@defuse-protocol/internal-utils": patch
"@defuse-protocol/crosschain-assetid": patch
"@defuse-protocol/contract-types": patch
---

Point CJS consumers at `.d.cts` type declarations via conditional `exports`. With `"type": "module"` set, every `.d.ts` file is interpreted as ESM-flavored types under `moduleResolution: node16`/`nodenext`/`bundler`, which can cause subtle interop mismatches (e.g. around default exports) for CJS consumers. tsdown already emits the `.d.cts` artifacts; this change wires them into the `exports` map so they actually get resolved.
