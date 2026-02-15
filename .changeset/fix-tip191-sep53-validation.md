---
"@defuse-protocol/contract-types": patch
---

fix: tip191 (Tron) and sep53 (Stellar) validation in MultiPayloadValidator

parseJson keyword was mutating payload data during oneOf evaluation, corrupting sibling branches. Deferred mutations until after AJV selects the matching branch.
