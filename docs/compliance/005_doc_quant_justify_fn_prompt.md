@~/.claude/prompts/new_functionality_prompt_spec.md

# Add Quantitative Justification for Technical Decision

## Role
Act as a Software Engineer with expertise in performance measurement and technical benchmarking.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- No technical decisions are justified with measurements or numbers
- Evaluation requirement `dc_justificacion_cuantitativa` fails: "Al menos una decisión técnica está justificada con números (benchmark, latencia medida, coste estimado, comparación con alternativa)"

Best candidate for quantitative justification: **Video streaming proxy performance**
- The proxy at `/api/stream/[id]` adds a server hop vs direct presigned URLs
- This trade-off (latency/bandwidth cost vs correctness) can be measured
- The `videoCache` in-memory store impacts memory usage (measurable)

Alternative option: **MongoDB connection pool impact**
- Single connection vs per-request connections under load

## Task
1. Measure and document the latency overhead of the server-side proxy vs direct URL access (if RustFS direct URL works for metadata, measure headers response time)
2. Add a `## Performance Notes` section to `README.md` (or `docs/decisions/ADR-001-video-streaming-proxy.md`) with measured values
3. Include memory impact of `videoCache` for typical recording sizes

### Measurement Guidelines
- Use `curl -w "%{time_total}\n"` to measure response times for `/api/stream/[id]`
- Measure a typical 10-second recording (~5 MB WebM) for latency to first byte (TTFB)
- Compare with a direct Rustfs fetch if possible
- For memory: calculate typical cache size (recording count × average file size)
- Document the trade-off: correctness (no ECONNRESET) at the cost of server memory and bandwidth

### Example Measurement to Include
```
Proxy endpoint TTFB (5 MB file):  ~45ms
Direct Rustfs URL TTFB:           ~15ms (but fails on range requests >chunk boundary)
Memory overhead (10 recordings × 5MB average): ~50 MB server RAM
Conclusion: +30ms latency is acceptable for guaranteed seek correctness
```

## Output Format
Add a `## Performance Notes` section to `README.md` or update `docs/decisions/ADR-001-video-streaming-proxy.md` with:
- Measured values (run the actual measurements with curl/fetch during local dev)
- Table comparing proxy vs direct approach
- Explicit statement of the trade-off accepted

## Output Checklist and Guardrails
- [ ] At least 2 measured values with units (ms, MB, etc.)
- [ ] Comparison between two approaches (proxy vs direct)
- [ ] States which was chosen and the accepted trade-off
- [ ] Measurements are reproducible (include the command used)
- [ ] Commit: `docs: add quantitative performance measurements for proxy decision`
