@~/.claude/prompts/new_functionality_prompt_spec.md

# Create GitHub Actions CI/CD Pipeline and Deploy App to VM at Google Cloud

## Role
Act as a Software Architect, you are an expert in GitHub Actions and Google Cloud Services.

## Context
Project: `video-capture` — Next.js 16 screen recorder.  
GitHub repo: `https://github.com/Jorgeaapaz/MISEIA_1-4-100-video-capture`  
**Prerequisite:** Task [006_cq_unit_tests_fn_prompt.md](006_cq_unit_tests_fn_prompt.md) must be completed first.

Use /gh-cli for all GitHub CLI operations and gcloud for secrets management.

Remote VM:
- SSH: `ssh -i C:\ubuntuiso\.ssh\vboxuser gcvmuser@34.174.56.186`
- Deploy directory: `~/MISEIA1-4-100_video-capture`
- Infrastructure: Traefik v3.3 + Docker on `miseia-net` network
- Domain: `video-capture.deviaaps.com` (wildcard cert `*.deviaaps.com` via Cloudflare DNS-01)
- Traefik entry port: `30001` (websecure)

## Task
Create GitHub Actions that:
1. On push to `master`: runs lint and tests
2. On push to `master` (after tests pass): builds Docker image and deploys to GCI VM
3. The service runs in Docker on the remote VM, accessible via Traefik at `video-capture.deviaaps.com`

### GitHub Actions CI/CD Guidelines
Use /gh-cli to configure all required secrets.

**Required GitHub Secrets** (set with `gh secret set`):
- `SSH_PRIVATE_KEY` — contents of `C:\ubuntuiso\.ssh\vboxuser`
- `SSH_HOST` — `34.174.56.186`
- `SSH_USER` — `gcvmuser`
- `MONGODB_URI` — `mongodb://admin:MongoAdmin2024!@34.174.56.186:27020/?authSource=admin`
- `MONGODB_DB` — `screen-capture`
- `RUSTFS_ENDPOINT` — `https://rustfs-api.deviaaps.com`
- `RUSTFS_ACCESS_KEY` — `rustfsadmin`
- `RUSTFS_SECRET_KEY` — `RustfsSecret2024!`
- `RUSTFS_BUCKET` — `recordings`

**Dockerfile** (create at project root):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN NODE_ENV=production npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**next.config.ts** must have `output: 'standalone'` for the Dockerfile to work.

**GitHub Actions workflow** (`.github/workflows/deploy.yml`):
```yaml
name: CI/CD — Build, Test, Deploy

on:
  push:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: NODE_ENV=production npm run build
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GCI VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/MISEIA1-4-100_video-capture || git clone https://github.com/Jorgeaapaz/MISEIA_1-4-100-video-capture.git ~/MISEIA1-4-100_video-capture && cd ~/MISEIA1-4-100_video-capture
            git pull origin master
            docker build -t video-capture:latest .
            docker stop video-capture 2>/dev/null || true
            docker rm video-capture 2>/dev/null || true
            docker run -d \
              --name video-capture \
              --network miseia-net \
              --restart unless-stopped \
              -e MONGODB_URI="${{ secrets.MONGODB_URI }}" \
              -e MONGODB_DB="${{ secrets.MONGODB_DB }}" \
              -e RUSTFS_ENDPOINT="${{ secrets.RUSTFS_ENDPOINT }}" \
              -e RUSTFS_ACCESS_KEY="${{ secrets.RUSTFS_ACCESS_KEY }}" \
              -e RUSTFS_SECRET_KEY="${{ secrets.RUSTFS_SECRET_KEY }}" \
              -e RUSTFS_BUCKET="${{ secrets.RUSTFS_BUCKET }}" \
              --label "traefik.enable=true" \
              --label "traefik.http.routers.video-capture.rule=Host(\`video-capture.deviaaps.com\`)" \
              --label "traefik.http.routers.video-capture.entrypoints=websecure" \
              --label "traefik.http.routers.video-capture.tls=true" \
              --label "traefik.http.routers.video-capture.tls.certresolver=cloudflare" \
              --label "traefik.http.services.video-capture-svc.loadbalancer.server.port=3000" \
              video-capture:latest
```

## Output Checklist and Guardrails
- [ ] `Dockerfile` created at project root (multi-stage build)
- [ ] `next.config.ts` updated with `output: 'standalone'`
- [ ] `.github/workflows/deploy.yml` created
- [ ] All 8 GitHub secrets set via `gh secret set`
- [ ] `test` job runs lint, build, and tests
- [ ] `deploy` job only runs after `test` passes
- [ ] Docker container uses `miseia-net` network for Traefik discovery
- [ ] Traefik labels configure `video-capture.deviaaps.com` with TLS
- [ ] Push to master and verify workflow runs: `gh run list`
- [ ] Verify site at `https://video-capture.deviaaps.com`
- [ ] Commit: `ci: add GitHub Actions CI/CD with Docker deploy to GCI VM`
