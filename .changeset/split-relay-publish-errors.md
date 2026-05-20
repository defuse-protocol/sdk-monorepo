---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Split relay publish failures into confirmed rejections and unknown-result errors. `publishIntents` now uses `RelayPublishRejectedError` for relay `status: "FAILED"` responses and `RelayPublishResultUnknownError` when a usable publish response cannot be confirmed, while keeping `RelayPublishError` as the shared base class.

**BREAKING CHANGES:** `RelayPublishError` is now an abstract base class, `code` only exists on `RelayPublishRejectedError`, and `NETWORK_ERROR` is no longer part of the publish rejection code set. Handle `RelayPublishResultUnknownError` for in-doubt publish results.
