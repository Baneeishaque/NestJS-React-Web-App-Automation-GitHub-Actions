# nestjs-react-web-app-automation-github-actions Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for a NestJS-React web application with heavy focus on GitHub Actions automation and deployment workflows. The codebase emphasizes DevOps practices, continuous integration, and deployment automation using Docker, Render CLI, and GitHub Actions. The project demonstrates iterative improvement patterns for CI/CD pipelines, Docker configurations, and development environment optimization.

## Coding Conventions

### File Naming
- Use **camelCase** for file names
- Test files follow `*.test.*` pattern
- Workflow files use kebab-case: `build-api.yaml`, `deploy.yaml`

### Import Style
```javascript
// Use absolute imports
import { Component } from '@/components/Component'
import { Service } from '@/services/Service'
```

### Export Style
```javascript
// Mixed export patterns - both named and default exports
export const utility = () => {}
export default class MainComponent {}
```

### Commit Messages
- Use conventional prefixes: `feat:`, `fix:`, `chore:`
- Keep messages concise (~42 characters average)
- Examples:
  - `feat: add Docker ARM64 support`
  - `fix: render CLI installation method`
  - `chore: update vscode spell check dict`

## Workflows

### CI/CD Workflow Optimization
**Trigger:** When you need to improve CI/CD performance and reduce complexity
**Command:** `/optimize-ci`

1. Review `.github/workflows/*.yaml` files for unnecessary parameters
2. Remove redundant `fetch-depth` parameters from checkout actions
3. Clean up unused inputs and dependencies in workflow definitions
4. Streamline job configurations by removing obsolete steps
5. Update `.vscode/settings.json` to maintain spell check dictionary

```yaml
# Before optimization
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    token: ${{ secrets.GITHUB_TOKEN }}
    unnecessary-param: value

# After optimization
- uses: actions/checkout@v4
```

### Docker Deployment Refinement
**Trigger:** When you need to refine Docker image building and deployment processes
**Command:** `/refine-docker`

1. Analyze current `Dockerfile` for build optimization opportunities
2. Update `.github/workflows/deploy.yaml` with improved Docker operations
3. Evaluate platform support requirements (ARM64 vs x86_64)
4. Configure proper image tagging strategy
5. Test multi-platform builds and adjust as needed

```dockerfile
# Example Dockerfile optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
COPY --from=builder /app/node_modules ./node_modules
```

### Render CLI Deployment Iteration
**Trigger:** When you need to improve Render deployment reliability and debugging
**Command:** `/improve-render-deploy`

1. Update Render CLI installation method in deployment workflow
2. Modify deployment configuration in `.github/workflows/deploy.yaml`
3. Add comprehensive logging and output handling
4. Configure proper secret management for Render API keys
5. Update workspace settings and environment variables

```yaml
# Render CLI installation example
- name: Install Render CLI
  run: |
    curl -fsSL https://cli.render.com/install | sh
    echo "$HOME/.local/bin" >> $GITHUB_PATH

- name: Deploy to Render
  run: |
    render deploy --service-id ${{ secrets.RENDER_SERVICE_ID }}
  env:
    RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
```

### VS Code Settings Maintenance
**Trigger:** When you need to update development environment configuration
**Command:** `/update-vscode-config`

1. Add new technical terms to spell check dictionary in `.vscode/settings.json`
2. Update extension configurations for project-specific needs
3. Modify workspace-specific settings for consistency
4. Ensure all team members have consistent development environment

```json
{
  "cSpell.words": [
    "nestjs",
    "dockerfile",
    "yaml",
    "github",
    "render"
  ],
  "typescript.preferences.importModuleSpecifier": "absolute"
}
```

## Testing Patterns

- Test files use `*.test.*` naming convention
- Framework-agnostic approach (specific testing framework not detected)
- Maintain test coverage for CI/CD configuration changes
- Test Docker builds locally before pushing workflow changes

```javascript
// Example test structure
describe('Component', () => {
  it('should render correctly', () => {
    // Test implementation
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `/optimize-ci` | Streamline GitHub Actions workflows and remove unnecessary configurations |
| `/refine-docker` | Improve Docker build processes and deployment configurations |
| `/improve-render-deploy` | Enhance Render CLI integration and deployment reliability |
| `/update-vscode-config` | Maintain VS Code workspace settings and development environment |