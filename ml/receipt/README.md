# Experimental post-OCR receipt understanding

This is a real fine-tuned multilingual DistilBERT sequence classifier. It classifies
receipt rows; it does not generate prices, determine eligibility, change stored
claims or make financial decisions. Existing deterministic parsing and PostgreSQL
validation remain authoritative. Member review is mandatory.

## Reproduce locally (Python 3.11, CPU)

Run from the repository root. All downloads, public annotations, intermediate
results and trained weights stay in ignored directories. No hosted inference is used.

```powershell
py -3.11 -m venv .local/phase05/venv
.local/phase05/venv/Scripts/python -m pip install -r ml/receipt/requirements.lock.txt
.local/phase05/venv/Scripts/python ml/receipt/sources.py
.local/phase05/venv/Scripts/python ml/receipt/prepare.py
.local/phase05/venv/Scripts/python ml/receipt/test_data.py
node ml/receipt/baseline.mjs
.local/phase05/venv/Scripts/python ml/receipt/train.py --epochs 3 --batch 32 --lr 0.00003 --threads 6
.local/phase05/venv/Scripts/python ml/receipt/export.py
.local/phase05/venv/Scripts/python ml/receipt/evaluate.py
.local/phase05/venv/Scripts/python ml/receipt/fields.py
.local/phase05/venv/Scripts/python ml/receipt/test_model.py
npm run build
```

The loader uses revision-pinned Hugging Face parquet annotation columns. Dataset
viewer outages do not require downloading receipt images. Cache files retain
source paths and SHA-256. The public source revisions are in `sources.py`.
Base checkpoint: `distilbert/distilbert-base-multilingual-cased`, revision
`45c032ab32cc946ad88a166f7cb282f58c753c2e` (Apache-2.0).

CORD contains Indonesian item semantics; its published subset omits some store
and payment annotations. SROIE supplies company/date/total fields, not comprehensive
item labels. Unknown SROIE rows are masked, never treated as non-item negatives.
SROIE text boxes on the same visual row are merged before field matching; bare
matching amounts without a total label remain unknown, rather than invented labels.
CORD rows merge annotated words by row identity; prices on separate physical rows
remain separate. This is sequence classification, not token tagging or layout OCR.

Splits group whole receipts, normalized template families and near-duplicates
(trigram Jaccard >=0.85) before assigning train/validation/test. Variants inherit
the parent split. No line-level random split. Heuristic template grouping cannot
prove universal merchant/template independence; audit the retained source groups
before using these metrics for claims beyond this experiment.

Only the last two encoder layers and classification head are trainable. Earlier
layers/embeddings are frozen for CPU feasibility. The seed is fixed; weighted loss
uses square-root inverse class frequency for measured imbalance. Best checkpoint
is selected using validation Macro F1. Final test results do not tune training.
`training.json` records actual updates, losses, dataset hash and encoder hashes.

## Interpret the benchmark correctly

`baseline.mjs` bundles the exact application parser. `evaluate.py` compares its
output, real quantized model predictions, and the actual conservative hybrid
implementation on identical documents. Unlabelled rows are excluded from label
metrics. Full item-selection metrics use CORD/synthetic annotations only.
Selection-edit counts are an annotation disagreement proxy, not observed human
editing time, OCR accuracy, price correctness or reimbursement eligibility.

The public text is annotation-derived, not a new run of Tesseract. Character
corruption and missing-line probes are simulated stress tests. Six separately
held-out synthetic challenges include English, Malay, Chinese, tax, discounts,
partial text and long descriptions. This does not establish Malaysian multilingual
receipt accuracy. Real Tesseract/browser acceptance is recorded separately.

Observed domain transfer is weak: keep the model experimental/advisory. A high
CORD item-label score does not show fewer real MoneyKAWKAW corrections. The safe
hybrid preserves baseline financial lines and only suggests joining a confidently
detected description with an adjacent, deterministically parsed amount.

## Artifacts, browser operation and failure recovery

Export produces a full-precision and a quantized ONNX model, runs CPU inference
and checks PyTorch classification agreement before copying only the browser model,
tokenizer/config and manifest to ignored `public/models/receipt-bert/`.
The manifest selects a checksum-versioned subdirectory so browser caches cannot
silently substitute an older checkpoint while reporting the new model version.
No weights are committed or published to Hugging Face. Rebuild artifacts locally
or distribute an internally reviewed, checksum-verified archive with attribution.

`prepare:receipt-model` serves the pinned WASM runtime locally. The browser worker
disables remote model loading; no receipt goes to a model service. Suggestions
have request identity, cancellation, a 60-second timeout and output validation.
No model artifact means an honest OCR/rules fallback. Set `VITE_RECEIPT_MODEL=off`
to disable loading for a test build, or uncheck the optional model control.
Members must opt in; no model download is needed for ordinary OCR.
Model weights are separate assets, outside the main JavaScript bundle.

For compiled-worker verification (synthetic text only):

```powershell
node scripts/receipt-production-probe.mjs
npm run preview -- --port 4173 --strictPort
```

Open `/__receipt-model-test.html`; run the compiled worker. This disposable page
is generated under ignored `dist/` and must not be deployed. Production login
remains unchanged; local synthetic account login is development-only.

## Attribution and boundaries

- CORD: Park et al., *CORD: A Consolidated Receipt Dataset for Post-OCR Parsing*,
  NeurIPS Document Intelligence Workshop, 2019; [source](https://github.com/clovaai/cord),
  [revision-pinned dataset](https://huggingface.co/datasets/naver-clova-ix/cord-v1), CC-BY-4.0.
- SROIE: Huang et al., ICDAR2019 robust reading challenge;
  [dataset conversion/extended annotations](https://huggingface.co/datasets/jsdnrs/ICDAR2019-SROIE), CC-BY-4.0 per its dataset card/license.
- DistilBERT: [model card](https://huggingface.co/distilbert/distilbert-base-multilingual-cased), Apache-2.0.

Training code transforms these annotations and changes the task model weights.
Retain attribution and relevant licenses when redistributing derived artifacts.
No private club receipts or payment details are training data. No paid compute,
API, mandatory inference subscription, database model migration, LightGBM, Qwen
or archive workflow is introduced.
