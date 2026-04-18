# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.**

Instead, email the maintainers privately. Include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal repro is ideal).
- Any suggested remediation.

We will acknowledge receipt within **3 business days** and aim to provide a
fix or mitigation within **30 days** for confirmed issues. Coordinated
disclosure is appreciated — we will credit reporters in the release notes
unless you prefer to remain anonymous.

## Scope

Issues in scope include but are not limited to:

- XSS vectors in the binding / template system.
- Prototype pollution via reactive state.
- CSP-related bypasses of our documented requirements.
- Supply-chain concerns with the published npm package.

Out of scope:

- Issues that require an attacker to already author component templates
  (templates are trusted code — see `docs/17-security.md`).
- Missing HTTP security headers on the sample apps.

For general security guidance when using LadrillosJS, see
[`docs/17-security.md`](docs/17-security.md).
