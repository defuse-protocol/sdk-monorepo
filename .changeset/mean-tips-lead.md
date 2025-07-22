---
"@defuse-protocol/internal-utils": patch
"@defuse-protocol/bridge-sdk": patch
---

Fix minimum withdrawal validation for POA bridge tokens by ensuring the correct token identifier (`defuse_asset_identifier`) is used in `validateMinWithdrawalAmount`. Also, format the `files` array in `package.json` for both packages to a more compact style.
