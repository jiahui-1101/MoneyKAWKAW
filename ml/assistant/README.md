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

## Reproduce the selected runtime

Selected: Qwen3-0.6B, Apache-2.0, ONNX q4f16, version
`qwen3:9e33a5911974`. The downloader pins upstream revisions, verifies each
artifact's SHA-256 and retains the original license. No fine-tuning is claimed.

```sh
python ml/assistant/download.py --help
python ml/assistant/download.py --activate
npm run prepare:receipt-model
npm run dev
```

Use the downloader's documented candidate argument if comparing Qwen2.5.
The selected model requires 578,918,903 bytes including tokenizer assets.
Only package the selected manifest and its referenced directory; comparison
weights and temporary probe pages are not release assets. Existing receipt JSEP
runtime files are reused without changing BERT. All models stay outside Git.
The model is optional: `VITE_QWEN_MODEL=off` disables it; otherwise the checkbox
still defaults off. No automatic model download occurs at login.

The locked Transformers.js 3.8.1 native Node runtime requires disabling Node's
new native Float16Array when benchmarking this q4f16 graph:

```sh
node --no-js-float16array ml/assistant/benchmark.mjs
node ml/assistant/capture.mjs
node --no-js-float16array ml/assistant/evaluate.mjs
node ml/assistant/assess.mjs
```

This flag is for the native CPU benchmark only. Browser WASM and WebGPU have
both executed the actual graph. WebGPU requires a compatible device; WASM is
available explicitly and can be much slower. The worker uses one WASM thread,
at most 1,024 input tokens and 128 generated tokens, greedy decoding and a
120-second deadline. Cancellation destroys its worker and model allocation.
Browser/model caches may retain public weights; private context is not saved
there by this application. Network-offline operation is not guaranteed.

## Evaluation rubric and interpretation

A = deterministic database explanation; B = actual Qwen without club context;
C = actual Qwen with authorized minimized context; D = validated C or A.
Capture uses authenticated loopback Supabase fixtures, never model-generated
expected answers. Historical state snapshots remain evaluation fixtures after
the live claim changes state. These are correlated synthetic examples, not a
held-out representative user population or an independent model accuracy study.

Review every raw output for invented facts, amount-to-label correctness,
current status versus workflow guidance, authority/settlement confusion,
language compliance, completeness and usefulness. Count an incorrect assertion
as a failure even if other parts are correct. An honest unknown answer is
preferable to fabrication. Unauthorized cases must expose no private context;
their B-only answers do not test database authorization. RLS/RPC tests do that.
Report sample counts, failures and fallback frequency separately. Automatic
number/status checks and validation acceptance are not semantic accuracy scores.

The validator rejects important numeric/status errors and truncated runtime
outputs, but it is a heuristic and cannot prove all paraphrases correct. Always
retain the expandable canonical facts/source panel. Deterministic fallback is
currently English even when Qwen is asked to use Malay or Chinese.

## Availability and scope limits

Qwen: **Local Demo Verified — Hosted Availability Unresolved**.
No deployment or hosted capacity has been verified. One fresh selected-model
download is about 579 MB: 10/50/100 clients imply approximately 5.79/28.95/57.89
GB before runtime assets, cache misses or model updates. No free hosting quota
or zero-cost multi-user availability is assumed. Desktop CPU process RSS was
roughly 2.2–3.1 GB across benchmarks; peak browser/mobile memory remains unmeasured. Responsive desktop
browser emulation does not establish physical-phone inference feasibility.

Retrieval is selected-record based, with at most 30 record choices and 10 task
details. Open-ended SQL, bulk analytics, autonomous actions, financial writes,
bank validation, archive operations and production hosting are unsupported.
Every answer rechecks authorization before and after inference. Open history
is rechecked on focus and every 30 seconds; remote revocation while idle can
therefore leave already-visible text until the next check. Closing, changing
scope/route/identity or clearing the conversation removes its in-memory history.

## Observed local evaluation (2026-11-10)

Thirty-one cases cover 26 authorized synthetic contexts and five denied or
unsupported cases. B ran 31 times; C ran only for the 26 authorized
cases. Final validation retained 16 C outputs and rejected ten; the other five
cases receive deterministic denial/clarification without model context. A later
validation-only reassessment preserves original generation text and timing.

Human review found materially incorrect, unsupported or misleading financial /
workflow assertions in 21/26 authorized B answers and 9/26 C answers. Current D
rejected those nine plus one incomplete risk explanation. Deficit explanations
retain deterministic approval blockers. This small reviewed
sample is not proof that the validator handles unseen paraphrases. Accepted
short answers still omit useful detail; always inspect the canonical source.
The six Malay/Chinese C questions all received English prose: multilingual
quality is **not verified**, and English fallback is an explicit limitation.
No measured advantage over deterministic A in factual reliability or user effort
has been demonstrated. Keep Qwen experimental and optional.

CPU evaluation C median was 4.24 seconds, p95 7.90 seconds, excluding initial
model loading. One browser synthetic 65-token test took 50.3 seconds on WASM
and 5.9 seconds on WebGPU. An actual integrated Member response generated ten
tokens in 4.9 seconds cold / 0.9 seconds warm on the tested desktop WebGPU.
These are individual local measurements, not capacity or mobile guarantees.
