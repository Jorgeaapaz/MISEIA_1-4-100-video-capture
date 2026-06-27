@~/.claude/prompts/new_functionality_prompt_spec.md

# Add Production Deploy Instructions to README

## Role
Act as a DevOps Engineer and Technical Writer, expert in documenting Docker and cloud deployment procedures.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

**Prerequisite:** Task [009_cicd_github_deploy_fn_prompt.md](009_cicd_github_deploy_fn_prompt.md) must be completed first (Dockerfile + CI/CD workflow exist).

Current state:
- No Dockerfile documentation in README
- No deploy instructions for cloud or production
- Evaluation requirement `dc_instrucciones_deploy` fails: "Sección de despliegue con pasos verificables (Dockerfile + comando, script de deploy, instrucciones cloud) además del entorno local"

Infrastructure:
- GCI VM at `34.174.56.186`
- Traefik reverse proxy at `deviaaps.com` wildcard
- Target URL: `https://video-capture.deviaaps.com`
- MongoDB: `mongodb://admin:MongoAdmin2024!@34.174.56.186:27020/?authSource=admin`
- Rustfs: `https://rustfs-api.deviaaps.com`

## Task
Add a `## Deployment` section to `README.md` covering:
1. Local Docker build and run (for testing the container locally)
2. Production deployment via GitHub Actions (automated on push to master)
3. Manual deployment steps if CI is unavailable
4. Environment variables for production vs local

### Deploy Instructions Guidelines
- Section must be in `README.md` (not a separate file)
- Must include the Dockerfile path reference and build command
- Must document all production env vars with production values format (not secrets — use placeholder format like `mongodb://USER:PASS@HOST:PORT/`)
- Include the public URL after deploy: `https://video-capture.deviaaps.com`
- Provide the `docker run` command for manual deploy

### README Section Template
```markdown
## Deployment

### Local Docker
Build and run the production image locally to verify before deploying:
\`\`\`bash
docker build -t video-capture:latest .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://localhost:27017" \
  -e MONGODB_DB="screen-capture" \
  -e RUSTFS_ENDPOINT="http://localhost:10000" \
  -e RUSTFS_ACCESS_KEY="minioadmin" \
  -e RUSTFS_SECRET_KEY="minioadmin1234" \
  -e RUSTFS_BUCKET="recordings" \
  video-capture:latest
\`\`\`

### Production — Automatic (GitHub Actions)
Push to `master` triggers `.github/workflows/deploy.yml`:
1. Runs lint + tests + build
2. SSH-deploys to GCI VM `34.174.56.186` in `~/MISEIA1-4-100_video-capture`
3. Restarts Docker container with Traefik labels
4. Accessible at: **https://video-capture.deviaaps.com**

### Production — Manual SSH Deploy
\`\`\`bash
ssh -i ~/.ssh/vboxuser gcvmuser@34.174.56.186
cd ~/MISEIA1-4-100_video-capture
git pull origin master
docker build -t video-capture:latest .
# ... docker run with miseia-net and Traefik labels
\`\`\`

### Production Environment Variables
| Variable | Production Value |
|---|---|
| `MONGODB_URI` | `mongodb://admin:PASS@34.174.56.186:27020/?authSource=admin` |
| `RUSTFS_ENDPOINT` | `https://rustfs-api.deviaaps.com` |
| `RUSTFS_BUCKET` | `recordings` |
```

## Output Checklist and Guardrails
- [ ] `## Deployment` section added to README.md
- [ ] Local Docker run command is fully working (test it)
- [ ] GitHub Actions workflow is referenced with the trigger (push to master)
- [ ] Public URL `https://video-capture.deviaaps.com` is mentioned
- [ ] Production env vars table uses placeholder/masked format for sensitive values
- [ ] Manual SSH deploy steps are included
- [ ] Commit: `docs: add complete deployment instructions to README`
