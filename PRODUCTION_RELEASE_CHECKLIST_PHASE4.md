# VEGA Phase 4 Production Release Checklist

## Required before deploy
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `docker compose config --quiet`
- [ ] CI dependency audit passes
- [ ] Gitleaks passes
- [ ] Trivy HIGH/CRITICAL image gate passes
- [ ] Real production secrets are stored in a secret manager, not `.env` in source

## Infrastructure
- [ ] Managed MySQL/RDS with automated snapshots and point-in-time recovery
- [ ] Redis with persistence/HA appropriate to queue and signaling requirements
- [ ] Private object-storage bucket and lifecycle rules
- [ ] Coturn or managed TURN tested from restrictive campus/mobile networks
- [ ] HTTPS termination at ALB/Cloudflare/ingress
- [ ] Prometheus-compatible metrics collected from `/internal/metrics`
- [ ] Centralized JSON logs collected from stdout
- [ ] Alerting for 5xx, p95/p99 latency, DB latency/errors, event-loop delay and queue failures

## Staging gates
- [ ] Login/refresh/logout browser flow tested
- [ ] Student flow tested
- [ ] Company/TPO/Admin RBAC negative tests completed
- [ ] Assessment attempts and submissions tested
- [ ] WebRTC interview across two API replicas tested
- [ ] S3 upload/download tested
- [ ] Email worker retry path tested
- [ ] MySQL backup restored into an isolated database successfully
- [ ] k6 production-readiness gate passes

## Capacity claim
Record actual tested concurrency/RPS, p95, p99, error rate, DB CPU/connections, Redis latency, queue depth, API CPU/RAM and TURN bandwidth. Do not advertise a concurrency figure higher than the measured staging result with headroom.
