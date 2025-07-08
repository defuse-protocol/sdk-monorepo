---
"@defuse-protocol/bridge-sdk": patch
---

Add a new optional parameter to SDK `env` ("production" or "stage"). Depending on the passed environment:
- will be used the appropriate API servers for POA Bridge and Solver Relay.
- POA Bridge will handle only either `omft.near` or `stft.near` tokens.
