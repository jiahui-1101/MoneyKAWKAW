# Qwen financial assistant — local experimental generation

## Architecture fixed before implementation

An authenticated role selects a permitted activity, department or claim. A fixed
intent router chooses a bounded read-only PostgreSQL context RPC. Each RPC checks
current database membership, role and scope, regardless of the client role label.
Canonical integer-sen balances and claim states remain the financial authority.
No SQL, database tools, actions or financial credentials are given to the model.

The browser holds short, memory-only conversation state. Identity/role/scope or
claim revision changes invalidate it. Context is rechecked before displaying a
completed answer. Logout, focus/revocation checks, route changes and cancellation
stop generation and clear private messages. No chat transcript is persisted.

An optional lazy Web Worker runs real Qwen generation, only after explicit user
activation with a download-size notice. A bounded trusted prompt uses fixed
intent plus minimized verified facts; raw user instructions and database free
text cannot expand retrieval permissions. Bank destinations, receipts, proofs,
signed URLs, names, tokens and secrets never enter model context. Rejection
reasons can be displayed as escaped source data, not instructions to the model.

The UI separates canonical facts, deterministic guidance, validated Qwen prose
and experimental LightGBM advice. Generated text is untrusted: validate important
numbers/statuses and reject unsupported financial authority, settlement or ML
accuracy claims. Failed generation leaves deterministic help and ordinary claim
workflows available. No financial RPC consumes model output.

## Model feasibility plan

Start with Apache-2.0 Qwen3-0.6B and a revision-pinned ONNX conversion; compare
Qwen2.5-0.5B-Instruct if useful. Test the actual quantized artifact on the locked
Transformers.js runtime before selecting. Record source/checksums/tokenizer,
CPU/WASM and available WebGPU execution, token latency and response quality.
Qwen3 q4f16 is about 570 MB before tokenizer/runtime; this is not a universal
mobile-feasibility claim. Do not alter BERT's existing runtime/default-off mode.

Model files are ignored under public/models, separate from private evidence.
No hosted inference endpoint, paid service or always-running model server is
authorized. Browser distribution still needs a reviewed hosting/bandwidth plan.

## Verification plan

Compare deterministic templates, Qwen without context, context-grounded Qwen and
validated hybrid on real synthetic local Supabase fixtures. Expected facts come
from database records/rules, not an LLM. Include four roles, English/Malay/Chinese,
states, budget/risk/conflict explanations, unknown/unauthorized requests and
injection attempts. Record exact counts and a human rubric for prose quality.
Run existing financial/RLS/BERT/LightGBM regressions and the complete real-local
browser lifecycle, cancellation/revocation/failure and measured responsive QA.
Internal reports/transcripts stay ignored under .local/phase07.
