---
"@godoo-dev/client": patch
---

Recognize Odoo 18's exact `/odoo` self-redirect as module lifecycle completion,
alongside Odoo 17's `/web`. Keep refusal validation, installed dependency closure
and module identity checks unchanged; reject other URL paths and targets.
