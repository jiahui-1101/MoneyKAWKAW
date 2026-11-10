# Experimental future budget pressure

This CPU LightGBM experiment uses **SYNTHETIC** activity lifecycles only. It is
not validated on real club outcomes and never authorizes a financial operation.

## Target fixed before training

At a Treasurer's current submitted-claim review snapshot, predict whether a
subsequent procurement request or attempted approval is blocked by insufficient
department allocation during `(snapshot, min(snapshot + 30 days, activity end)]`.
A new task reserves its estimate; submission replaces that reservation with the
actual amount; approval checks total effective exposure; payment moves liability
to paid once; rejection restores the estimate. A blocked request is a simulated
legitimate demand, not proof that the club should approve it.

MoneyKAWKAW does not retain failed transactions as an outcome dataset. Audit
history is not a complete point-in-time reconstruction of earlier budgets.
No real completed activities or independently observed future labels have been
established. Development fixtures are not independent historical outcomes.
See the ignored `.local/phase06/REPORT.md` for the local count audit.

## Design fixed before training

Use independent complete activities, one submitted-claim snapshot per activity.
Generate events before the snapshot, freeze observed integer-sen inputs, then
continue the lifecycle to determine the future label. Hidden demand parameters,
future events, identities and outcome are never feature inputs. Split whole
scenario families and activities; challenge families use different parameters.
Reject duplicate trajectories, future source timestamps and unrecognized fields.

Compare majority, scaled logistic regression, a published headroom/demand
heuristic and real LightGBM on the same examples. Select small-tree parameters
and stopping iteration on validation only, then evaluate test/challenge once.
Report calibration only within the simulator distribution. Preserve raw model
scores as experimental scores, never validated real-world probabilities.

The declarative `feature-schema.json` is shared by Python and TypeScript.
Monetary accounting remains integer sen; ratios are computed only at this model
boundary. No personal names, bank identifiers, files or user tokens are inputs.

Runtime is lazy, local browser decision support. The authoritative SQL rule
assessment, financial locks, role checks and approval constraints remain intact.
No Qwen, archiving, hosted release, paid services or BERT changes are included.

## Reproduce locally (Python 3.11, CPU)

```powershell
py -3.11 -m venv .local/phase06/venv
.local/phase06/venv/Scripts/python.exe -m pip install -r ml/risk/requirements.lock.txt
.local/phase06/venv/Scripts/python.exe ml/risk/simulate.py
.local/phase06/venv/Scripts/python.exe ml/risk/validate.py
.local/phase06/venv/Scripts/python.exe -m unittest discover -s ml/risk -p test_data.py
.local/phase06/venv/Scripts/python.exe ml/risk/train.py
.local/phase06/venv/Scripts/python.exe ml/risk/evaluate.py
.local/phase06/venv/Scripts/python.exe ml/risk/export.py
.local/phase06/venv/Scripts/python.exe ml/risk/parity.py
node ml/risk/parity.mjs
.local/phase06/venv/Scripts/python.exe ml/risk/onnx-parity.py
.local/phase06/venv/Scripts/python.exe -m unittest discover -s ml/risk -p 'test_*.py'
```

Artifacts, reports and datasets are ignored. To package the browser feature,
include only `public/models/budget-pressure/manifest.json` and the JSON tree file
it names. No Python dependencies or test trajectories belong in the browser.
Missing model assets produce an honest nonblocking unavailable state. Set
`VITE_PRESSURE_MODEL=off` to disable inference; no server data is sent to a model
host. Only independent authorized Treasurers can fetch current claim features.

## Export choice and explanation

ONNX export succeeds and native/WASM inference runs with `zipmap=False`. Default
ZipMap output is not readable by the existing web runtime. More significantly,
float32 conversion changes some threshold-neighbour predictions. We retain that
measured evidence, and deploy the actual numeric trees with JavaScript double
precision instead. `parity.mjs` tests the exact application evaluator against
native LightGBM over random, boundary, missing, held-out and challenge inputs.
It also compares every prepared feature vector with the application transformer.

The exporter rejects categorical splits or unsupported missing modes. Each local
explanation attributes child-minus-parent expected leaf values to the visited
feature. Contributions plus the training-weighted base equal the raw logit.
These are tree-path associations, **not SHAP or causal explanations**. They
faithfully describe this trained simulator model, not reliable financial causes.
The UI shows a timestamped transient snapshot; it does not write ML results to
the claim or pretend they formed part of the immutable SQL decision assessment.

Training uses unweighted binary log loss because the generated training class
balance is moderate; the observed class counts and minority recall are reported.
Two predeclared tree sizes are selected by validation loss with early stopping.
Test/challenge results must not be used to tune a replacement model without a
new independent evaluation set. Missing historical features are omitted from
this schema; missing required current values reject inference rather than using
invented zeroes. The low-level evaluator supports model-native missing branches
for parity testing, not silent imputation of unavailable financial records.
