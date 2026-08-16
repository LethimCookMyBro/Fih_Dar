// Exit-code policy for the refresh runner.
//
// The Railway cron schedule must keep ticking across runs. A PARTIAL run is a
// COMPLETED run — one source failed but the others' data was ingested and
// processed, and the failure is honestly recorded on the run row — so it
// exits 0. Only FAILED (every source failed, or critical orchestration
// failure) exits non-zero; a non-zero exit tells Railway the deployment
// crashed, which would otherwise stop future scheduled executions.
export function exitCodeForStatus(status) {
  return status === 'FAILED' ? 1 : 0;
}
