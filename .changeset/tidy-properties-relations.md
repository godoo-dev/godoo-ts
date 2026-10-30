---
"@godoo-dev/client": patch
---

Normalize properties relation display tuples to IDs before dictionary writes, preserving supported server-returned values during single and batch updates. Correct raw read and unset value types, omit separators, and reject malformed reads before launching batch writes. Read/merge/write remains non-atomic and cannot preserve hidden stored keys.
