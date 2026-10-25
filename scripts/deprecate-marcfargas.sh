#!/usr/bin/env bash
# deprecate-marcfargas.sh
#
# One-shot script to mark all seven retiring @marcfargas/odoo-* packages as
# deprecated on the npm registry. Run locally with npm auth active (npm login
# or equivalent). Do NOT run this in CI — npm deprecate requires interactive
# auth and a valid TOTP code.
#
# TOTP codes expire in ~30s; run interactively or pass --otp=CODE per call.
# Because each call requires a fresh OTP, either:
#   Option A: run the script interactively and type a new OTP at each prompt
#   Option B: run each npm deprecate command individually with --otp=<code>
#
# After all seven calls succeed, verify with:
#   npm view @marcfargas/odoo-client deprecated
#   npm view @marcfargas/odoo-introspection deprecated
#   npm view @marcfargas/odoo-testcontainers deprecated
#   npm view @marcfargas/odoo-state-manager deprecated
#   npm view @marcfargas/odoo-cli deprecated
#   npm view @marcfargas/odoo-mcp deprecated
#   npm view @marcfargas/odoo-skills deprecated

set -euo pipefail

# 1. @marcfargas/odoo-client — renamed to @godoo-dev/client
npm deprecate '@marcfargas/odoo-client@*' 'Renamed to @godoo-dev/client. Install that package instead — see https://github.com/godoo-dev/godoo-ts.'

# 2. @marcfargas/odoo-introspection — renamed to @godoo-dev/introspection
npm deprecate '@marcfargas/odoo-introspection@*' 'Renamed to @godoo-dev/introspection. Install that package instead — see https://github.com/godoo-dev/godoo-ts.'

# 3. @marcfargas/odoo-testcontainers — renamed to @godoo-dev/testcontainers
npm deprecate '@marcfargas/odoo-testcontainers@*' 'Renamed to @godoo-dev/testcontainers. Install that package instead — see https://github.com/godoo-dev/godoo-ts.'

# 4. @marcfargas/odoo-state-manager — superseded by godoo-stateman (Python)
npm deprecate '@marcfargas/odoo-state-manager@*' 'Superseded by godoo-stateman (Python). No JS shim — see https://github.com/godoo-dev for the godoo initiative.'

# 5. @marcfargas/odoo-cli — deprecated, no direct replacement
npm deprecate '@marcfargas/odoo-cli@*' 'Deprecated. No direct replacement — see https://github.com/godoo-dev for the godoo initiative.'

# 6. @marcfargas/odoo-mcp — deprecated, source preserved for future salvage
npm deprecate '@marcfargas/odoo-mcp@*' 'Deprecated. Source preserved for future salvage at https://github.com/marcfargas/odoo-toolbox (archived) targets/odoo-mcp/.'

# 7. @marcfargas/odoo-skills — deprecated, CI-generated knowledge modules
npm deprecate '@marcfargas/odoo-skills@*' 'Deprecated. CI-generated knowledge modules — future home TBD in the Atlas KB.'
