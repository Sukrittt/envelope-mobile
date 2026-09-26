# Security and reliability audit — 26 September 2026

Reviewed baseline `be2a8c5`. Severity measures impact; priority is repair order. These are source findings and synthetic regressions, not production exploits or device penetration tests.

| Priority | Severity | Finding | Change |
| --- | --- | --- | --- |
| P1 | High | F04: an offline batch could send A's expense using B's token after an account switch | Bind requests and every queue operation to their initiating session/owner; stop stale batches |
| P1 | High | F05: an old refresh could restore a logged-out session or replace a new login | Generation checks and serialized credential persistence |
| P1 | High | F06: a failed key/decryption read deleted the only offline copy | Preserve ciphertext and propagate read failures; save dead-letter destination before removing source |
| P2 | Medium | F10: refresh outages silently sent unauthenticated demo requests | Throw a retryable refresh error for existing sessions |
| P2 | Medium | F13: temporary HTTP failures exhausted offline attempts | Retain entries on 408/429/5xx and session/access errors, retry on later flush triggers |

Regression coverage includes delayed refresh success across logout/new login, identity change during queue reads and requests, encrypted data corruption, failed dead-letter writes, and transient HTTP statuses. Type checking, lint and all 743 tests passed. The existing CI `--forceExit` workaround remains necessary for React Native test handles; no physical-device verification was performed.

Compatible lockfile updates patch xmldom and js-yaml. Remaining npm audit entries include Metro's image-size 1.x parser denial of service and Expo tooling dependencies. Metro consumes build assets; no native-app remote image-size parser path was found. Do not feed untrusted assets into builds. Resolving the remaining reports requires an Expo/Metro-compatible dependency update; audit's suggested Expo downgrades were not applied. Retry-After/backoff improvements and device validation remain follow-up work.
