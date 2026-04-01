## Disabled GitHub workflows

This directory stores workflows that must remain versioned in the repository, but must not be executed by GitHub Actions.

### Why `deploy.yml` was disabled

`deploy.yml` was removed from `.github/workflows/` because this repository is no longer being maintained as a SaaS product in active construction.

That decision was made after concluding that the platform was not commercially viable in its current direction.

The project is being converted into a public repository, so the automated publishing and deployment pipeline was intentionally disabled to avoid:

- accidental deployments
- exposure of infrastructure-related operational flow in a now-public repository
- confusion about the current maintenance and release model of the project

### How to re-enable it

If deployment automation is needed again in the future, move the file back to `.github/workflows/deploy.yml` and review all related secrets, environments, and infrastructure assumptions before enabling it.
