Backend — Status
Already real (not stubs):

Orchestrator WebSocket server (port 8080) — complete
5 robot agent processes with full decision loop — complete
x402 micropayments between robots — real, wired to Base Sepolia
On-chain reputation reads/writes via Viem — real
Groq LLM task decomposer with rule-based fallback — complete
Peer selector using on-chain registry queries — complete
Pinata uploader — real and working
Redis task queue, zone locks, state — complete
Backend gaps:

Storacha credentials not provisioned — code exists, env vars need manual setup via CLI
Missing event broadcasts — ZONE_LOCKED, ZONE_RELEASED, TASK_ASSIGNED, LOG_ENTRY are defined in types but orchestrator never publishes them
Logs are ephemeral — written to local logs/ directory, lost on server restart (Railway)
No agent manifests verified — the agents/manifests/ JSON files need to exist for registration script to work
Frontend ↔ Backend Connection
Wired and working:

WebSocket connects to NEXT_PUBLIC_WS_URL ?? ws://localhost:8080
STATE_CHANGED → agent state + 3D movement
PAYMENT_SENT → trust beam animation + log
REPUTATION_UPDATED → reputation bar update
SESSION_STATS → stats panel (broadcast every 5s)
When connected: true, the fake simulation loop is correctly bypassed
Missing handlers on frontend:

TASK_ASSIGNED — no handler
ZONE_LOCKED / ZONE_RELEASED — no handler
LOG_ENTRY — agent decision logs never streamed, only file-written
Prioritized TODO
Critical (blocks a real demo):

BACKEND — Verify agents/manifests/ files exist, fund wallets, run registration script
BACKEND — Add TASK_ASSIGNED + ZONE_LOCKED broadcasts from orchestrator
FRONTEND — Add missing WS event handlers for the above
INTEGRATION — Create .env.example for both backend + frontend with all required vars documented
Important (quality of demo):

BACKEND — Persist logs to Pinata immediately on task complete (not just at process end) so Railway deployments don't lose them
FRONTEND — Add Base Sepolia explorer links on payment events in the live log (basescan.org/tx/...)
BACKEND — Add peer endpoint health check before delegation attempt (currently fails silently if peer is down)
Polish:

FRONTEND — Handle REPUTATION_UPDATED with a visual flash on the rep bar
BACKEND — Storacha setup automation or graceful fallback to Pinata-only
INTEGRATION — Docker Compose file so orchestrator + 5 robots + Redis start with one command
Bottom line: ~75% done. The entire backend architecture is real and functional. The main remaining work is env setup/ops, a couple missing event broadcasts, and the missing frontend event handlers. Nothing architecturally broken — it just needs the wiring completed.