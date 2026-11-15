# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| < 0.1 | No (never published) |

Fixes are released as a new patch version of the latest minor.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's private vulnerability reporting: open the
repository's **Security** tab and choose **Report a vulnerability**, or go to
<https://github.com/vashishtaHD/angular-assistant-ui/security/advisories/new>. Please do not open a
public issue, pull request or discussion for a vulnerability.

Include the affected package version, the Angular version, a description of the issue and its impact,
and the steps or code to reproduce it. You will get a reply on the advisory. Once a fix is released,
the advisory is published with credit to you, unless you prefer otherwise.

## Scope

- **The library**: the `angular-assistant-ui` npm package and all its entry points (`ui`, `markdown`,
  `shiki`, `mastra`, `testing`, `react-interop`). For example: markdown or attachment rendering that
  allows script injection, or the `mastra` entry leaking auth headers to another origin.
- **The reference Mastra server** (`mastra-server/`). It is an example of the server contract the
  `mastra` entry relies on, not a product. Its `dev` auth mode trusts every request, and its `jwt` mode
  is an example verifier. Harden it before you deploy it: use your own identity provider, set CORS to
  your origin, gate the chat route and limit request sizes. See
  [docs/deployment.md](docs/deployment.md) and [docs/mastra.md](docs/mastra.md). Reports about it are
  welcome, especially where it behaves differently from what those docs say.

Out of scope: the demo app (`projects/demo`), the compat apps (`compat/`), and vulnerabilities in
upstream packages (`@assistant-ui/*`, the AI SDK, Mastra, Angular), which should go to their
maintainers. If a dependency's issue affects this package in a way that needs a change here, report it.
