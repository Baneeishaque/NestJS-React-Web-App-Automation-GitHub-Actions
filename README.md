[![Deploy API & Web](https://github.com/Baneeishaque/NestJS-React-Web-App-Automation-GitHub-Actions/actions/workflows/deploy.yaml/badge.svg)](https://github.com/Baneeishaque/NestJS-React-Web-App-Automation-GitHub-Actions/actions/workflows/deploy.yaml)

# NestJS Backed React Web App. Automation

This repository contains the codebase and deployment workflow for a NestJS Backed React Web App. Automation project, including:

- **api**: NestJS backend API
- **web**: React frontend client

## Deployment

Deployment is automated via GitHub Actions. You can trigger the deployment manually from the Actions tab on GitHub (look for the "Deploy CRM API & Web" workflow).

### What the workflow does

1. Builds and zips the API and web client.
2. Uploads the zipped builds to your server via SCP.
3. Unzips and restarts the services using SSH.

### Requirements

- Server SSH access (add your private key and server IP as GitHub secrets: `SERVER_SSH_KEY`, `SERVER_HOST`)
- PM2 and Nginx configured on your server

See `.github/workflows/deploy.yaml` for details.
