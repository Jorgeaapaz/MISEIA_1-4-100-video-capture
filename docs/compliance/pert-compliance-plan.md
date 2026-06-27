# PERT Compliance Plan — Screen Capture App
**Project:** `video-capture`  
**Date:** 2026-06-26  
**Goal:** Achieve full compliance (30/30) from current baseline (19/30)

---

## PERT Compliance Plan

Ordered by dependency chains. Tasks with no dependencies can run in parallel. Tasks that share a dependency chain must run sequentially.

### Chain A — Documentation Quick Wins (Parallel, no dependencies)

**A1 → [001] Create `.env.example` file**  
No blockers. One file, immediate impact on base documentation score.  
→ Prompt: [001_doc_env_example_fn_prompt.md](001_doc_env_example_fn_prompt.md)

**A2 → [002] Add architecture diagram to README**  
No blockers. ASCII/Mermaid diagram of components and data flow.  
→ Prompt: [002_doc_arch_diagram_fn_prompt.md](002_doc_arch_diagram_fn_prompt.md)

**A3 → [003] Document AI usage and changes**  
No blockers. Add AI-assistance reflection section to README.  
→ Prompt: [003_doc_ai_changes_fn_prompt.md](003_doc_ai_changes_fn_prompt.md)

**A4 → [004] Create ADR decision log**  
No blockers. Structured architecture decision records in `docs/decisions/`.  
→ Prompt: [004_doc_adr_decision_fn_prompt.md](004_doc_adr_decision_fn_prompt.md)

**A5 → [005] Add quantitative justification**  
No blockers. Benchmark or latency measurement for one technical decision.  
→ Prompt: [005_doc_quant_justify_fn_prompt.md](005_doc_quant_justify_fn_prompt.md)

---

### Chain B — Testing (Sequential)

**B1 → [006] Implement minimum unit tests**  
No blockers. Jest/Vitest setup with coverage for API routes and lib utilities.  
→ Prompt: [006_cq_unit_tests_fn_prompt.md](006_cq_unit_tests_fn_prompt.md)

**B2 → [007] Achieve >60% test coverage** *(depends on B1)*  
After B1 is done and passing. Add integration tests and coverage report.  
→ Prompt: [007_cq_test_coverage_fn_prompt.md](007_cq_test_coverage_fn_prompt.md)

---

### Chain C — CI/CD (depends on B1; parallel within C)

**C1 → [008] GitLab CI pipeline** *(depends on B1)*  
After tests exist. `.gitlab-ci.yml` with lint + test stages.  
→ Prompt: [008_cicd_gitlab_pipeline_fn_prompt.md](008_cicd_gitlab_pipeline_fn_prompt.md)

**C2 → [009] GitHub Actions CI/CD + Deploy to GCI VM** *(depends on B1)*  
After tests exist. Compile + test in Actions, deploy to `34.174.56.186` via SSH/Docker.  
→ Prompt: [009_cicd_github_deploy_fn_prompt.md](009_cicd_github_deploy_fn_prompt.md)

---

### Chain D — Deploy Documentation and Public URL (depends on C2)

**D1 → [010] Add deploy instructions to README** *(depends on C2)*  
After deploy pipeline exists. Document Dockerfile, secrets, domain URL.  
→ Prompt: [010_doc_deploy_instructions_fn_prompt.md](010_doc_deploy_instructions_fn_prompt.md)

**D2 → [011] Public deploy accessible** *(depends on C2 + D1)*  
After C2 deploys the app. Verify `video-capture.deviaaps.com` is live and add URL to README.  
→ Prompt: [011_fn_public_deploy_fn_prompt.md](011_fn_public_deploy_fn_prompt.md)

---

### Chain E — Feature Enhancements (Independent, lowest priority)

**E1 → [012] Add extra features: pagination, search, filters** *(independent)*  
Can be done at any point. Adds value to the recordings gallery.  
→ Prompt: [012_fn_extra_features_fn_prompt.md](012_fn_extra_features_fn_prompt.md)

---

## Execution PERT

| # | Task | ID | Depends On | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Create `.env.example` | A1 | — | 15 min | HIGH |
| 2 | Add architecture diagram to README | A2 | — | 30 min | MEDIUM |
| 3 | Document AI usage and changes | A3 | — | 20 min | MEDIUM |
| 4 | Implement unit and integration tests | B1 | — | 3 h | HIGH |
| 5 | Create ADR decision log | A4 | — | 45 min | LOW |
| 6 | Add quantitative justification | A5 | — | 60 min | LOW |
| 7 | Add extra features (pagination, search) | E1 | — | 4 h | LOW |
| 8 | Achieve >60% test coverage | B2 | #4 (B1) | 2 h | MEDIUM |
| 9 | GitLab CI pipeline | C1 | #4 (B1) | 1 h | HIGH |
| 10 | GitHub Actions CI/CD + VM Deploy | C2 | #4 (B1) | 2 h | HIGH |
| 11 | Add deploy instructions to README | D1 | #10 (C2) | 30 min | HIGH |
| 12 | Verify public deploy live | D2 | #10 (C2), #11 (D1) | 30 min | HIGH |

> **Note:** Tasks 1–7 can all run in parallel. Tasks 8–10 require task 4 to complete first. Tasks 11–12 require task 10. Favor GitHub Actions (C2) over GitLab (C1) per project instructions.
