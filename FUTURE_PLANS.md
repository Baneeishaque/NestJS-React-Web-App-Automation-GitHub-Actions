# Future Project Plans

This file tracks tasks and ideas deferred for a later time.

- **Explore Docker Bake:** A deeper dive into using `docker bake` for managing more complex, multi-target builds.
- **Implement Multi-Image Strategy:** Investigate building and publishing three distinct images (`api`, `web`, and a combined `web-app`) from the monorepo structure.
- **Set Up Registry Backups:** Configure the CI/CD pipeline to push the final Docker image to multiple container registries for backup and redundancy.
- **Cache Render CLI:** Optimize the deployment job by caching the Render CLI installation between workflow runs.
