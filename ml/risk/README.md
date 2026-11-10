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
