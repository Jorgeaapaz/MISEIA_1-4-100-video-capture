@~/.claude/prompts/new_functionality_prompt_spec.md

# Deploy App Publicly to GCI VM and Document URL

## Role
Act as a DevOps Engineer and Software Architect, expert in Docker, Traefik, and Google Cloud VM deployments.

## Context
Project: `video-capture` — Next.js 16 screen recorder.  
**Prerequisites:**
- Task [009_cicd_github_deploy_fn_prompt.md](009_cicd_github_deploy_fn_prompt.md) completed (Dockerfile + GitHub Actions)
- Task [010_doc_deploy_instructions_fn_prompt.md](010_doc_deploy_instructions_fn_prompt.md) completed (deploy docs in README)

Target:
- VM: `ssh -i C:\ubuntuiso\.ssh\vboxuser gcvmuser@34.174.56.186`
- Deploy directory: `~/MISEIA1-4-100_video-capture`
- Target URL: `https://video-capture.deviaaps.com`
- Network: `miseia-net` (Traefik already running)
- Wildcard cert: `*.deviaaps.com` (Cloudflare DNS-01, already provisioned)

Current state:
- Evaluation requirement `fn_deploy_publico_accesible` fails: "Hay un deploy público accesible (URL) con el proyecto corriendo, documentado en el README"
- No public URL exists

## Task
1. Trigger the GitHub Actions workflow (push to master or manual trigger)
2. Verify the Docker container is running on the VM in `miseia-net` with correct Traefik labels
3. Verify `https://video-capture.deviaaps.com` is accessible and the app works
4. Add the public URL to the README prominently (top of file, after project title)

### Deployment Verification Steps
```bash
# On remote VM: verify container is running
ssh -i C:\ubuntuiso\.ssh\vboxuser gcvmuser@34.174.56.186 "docker ps | grep video-capture"

# Check Traefik picked up the container
# Traefik dashboard: https://traefik.deviaaps.com

# Test the public URL
curl -I https://video-capture.deviaaps.com
```

### Production MongoDB Configuration
Use the production MongoDB connection string:
```
mongodb://admin:MongoAdmin2024!@34.174.56.186:27020/?authSource=admin
```
Database: `screen-capture`

### Production Rustfs Configuration
```
RUSTFS_ENDPOINT=https://rustfs-api.deviaaps.com
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=RustfsSecret2024!
RUSTFS_BUCKET=recordings
```

### README Update
Add after the project title in README:

```markdown
## Live Demo

**Production URL:** https://video-capture.deviaaps.com

> Deployed on Google Cloud VM via Docker + Traefik. Requires screen capture permission in browser.
```

### Traefik Labels Required
The Docker container must have:
```
traefik.enable=true
traefik.http.routers.video-capture.rule=Host(`video-capture.deviaaps.com`)
traefik.http.routers.video-capture.entrypoints=websecure
traefik.http.routers.video-capture.tls=true
traefik.http.routers.video-capture.tls.certresolver=cloudflare
traefik.http.services.video-capture-svc.loadbalancer.server.port=3000
```

## Output Checklist and Guardrails
- [ ] GitHub Actions workflow triggered and green (all stages pass)
- [ ] Docker container `video-capture` running on VM: `docker ps | grep video-capture`
- [ ] Container connected to `miseia-net`: `docker inspect video-capture | grep miseia`
- [ ] `curl -I https://video-capture.deviaaps.com` returns 200
- [ ] App loads in browser: screen recorder UI visible
- [ ] Test end-to-end: record → upload → view in gallery
- [ ] README updated with `## Live Demo` section and URL
- [ ] Commit + push: `feat: production deploy at video-capture.deviaaps.com`
