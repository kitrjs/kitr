# Security policy

## Supported versions

kitr is pre-release. Security fixes go into the latest release only; every `kitr` and `@kitr/*` package shares one version.

## Reporting a vulnerability

Please report vulnerabilities privately, not in a public issue, pull request or discussion.

Use GitHub's private reporting: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/kitrjs/kitr/security/advisories/new)).

Include what you can of:

- the affected package and version, or the commit
- what an attacker can do, and under what conditions
- steps or code to reproduce it

You will get an acknowledgement within 3 working days and an assessment within 10. We will keep you updated while a fix is prepared, agree a disclosure date with you, and credit you in the advisory unless you prefer not to be named.

## Scope

In scope: the packages in this repository, the `kitr` CLI and the code it generates, and the component registry in `registry/`.

Out of scope: vulnerabilities in upstream libraries that kitr re-exports (report those upstream; we will update the dependency), and issues that need an attacker to already control the app's configuration or server.
