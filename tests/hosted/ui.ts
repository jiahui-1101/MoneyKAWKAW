import '../../src/styles/tokens.css';
import '../../src/styles/shell.css';
import '../../src/styles/components.css';
import { login } from '../../src/services/supabase/auth';
import { captureIdentity, type Plan } from './runtime';

const root = document.querySelector<HTMLElement>('#qa')!;
const title = document.createElement('h1'); title.textContent = 'Synthetic hosted acceptance';
const note = document.createElement('p');
note.textContent = 'Temporary engineering checks. Normal Google identity and server permissions apply. No real transfers. Captured credentials stay in this tab’s memory.';
const status = document.createElement('p'); status.role = 'status'; status.textContent = 'No identity captured.';
const capture = document.createElement('button'); capture.className = 'btn primary'; capture.textContent = 'Capture current Google identity';
const switchAccount = document.createElement('button'); switchAccount.className = 'btn'; switchAccount.textContent = 'Switch Google account';
const clear = document.createElement('button'); clear.className = 'btn'; clear.textContent = 'Release captured identity';
const label = document.createElement('label'); label.textContent = 'Reviewed synthetic request plan'; label.htmlFor = 'plan';
const plan = document.createElement('textarea'); plan.id = 'plan'; plan.rows = 18;
plan.value = JSON.stringify({ label: 'SYNTHETIC-09C-membership', groups: [[{ label: 'Accept current invitation',
  path: '/rest/v1/rpc/accept_club_invitation', method: 'POST', body: {}, expectStatus: [200] }]] }, null, 2);
const run = document.createElement('button'); run.className = 'btn primary'; run.textContent = 'Run reviewed checks'; run.disabled = true;
const resultLabel = document.createElement('h2'); resultLabel.textContent = 'Sanitized results';
const output = document.createElement('pre'); output.id = 'results'; output.style.whiteSpace = 'pre-wrap'; output.style.overflowWrap = 'anywhere';
let identity: Awaited<ReturnType<typeof captureIdentity>> | undefined;
capture.onclick = async () => {
  try { identity = await captureIdentity(); status.textContent = identity.role + ' · ' + identity.uid; run.disabled = false; }
  catch { status.textContent = 'An approved Google sign-in is required. Use Switch Google account.'; }
};
switchAccount.onclick = () => { void login().catch(() => { status.textContent = 'Google sign-in could not start.'; }); };
clear.onclick = () => { identity = undefined; run.disabled = true; status.textContent = 'Captured identity released.'; };
run.onclick = async () => {
  if (!identity) return;
  run.disabled = true; output.textContent = 'Running bounded checks…';
  try { output.textContent = JSON.stringify(await identity.run(JSON.parse(plan.value) as Plan), null, 2); }
  catch (error) { output.textContent = error instanceof Error ? error.message : 'Test could not complete.'; }
  finally { run.disabled = !identity; }
};
root.append(title, note, status, capture, switchAccount, clear, label, plan, run, resultLabel, output);
