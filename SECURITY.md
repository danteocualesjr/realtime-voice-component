# Security Policy

## Reporting a Vulnerability

Do not report security vulnerabilities through public GitHub issues.

Please report suspected vulnerabilities through OpenAI's coordinated disclosure
program:

https://openai.com/security/disclosure/

Include enough detail for the team to reproduce and assess the issue, such as
the affected package version or commit, browser/runtime version, reproduction
steps, and the expected impact.

## Scope

This repository is a reference implementation for browser voice controls using
OpenAI Realtime. It is not a production service and does not host a public demo
or collect user data.

Security-sensitive issues are still in scope when they affect the code or
documentation in this repository, including:

- accidental exposure of credentials or sensitive configuration
- unsafe handling of Realtime session credentials
- browser-side behavior that could expose user audio or app state unexpectedly
- dependency or supply-chain issues in the checked-in project configuration

## Support Expectations

This project is provided as an open-source reference implementation. OpenAI will
review vulnerability reports, but this repository is not a long-term product
support channel.
