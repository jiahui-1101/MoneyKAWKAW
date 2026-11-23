export function membershipAccessError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error
    && error.code === '23514' && error.message === 'This financial operation is frozen during activity closing') {
    return 'The activity in your invitation is closing or archived. Ask a Director for a new invitation to an open activity.';
  }
  // Never reflect raw server errors, identifiers or unrelated constraint details into the login page.
  return 'Club access could not be verified. Check your connection, then retry.';
}

export function oauthCallbackError(search: string): string | undefined {
  const query = new URLSearchParams(search);
  if (!query.has('error') && !query.has('error_code')) return;
  return ['bad_oauth_state', 'flow_state_expired'].includes(query.get('error_code') ?? '')
    ? 'Google sign-in expired. Start a new Google sign-in.'
    : 'Google sign-in did not complete. Start a new Google sign-in.';
}
