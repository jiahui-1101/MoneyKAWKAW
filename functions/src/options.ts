// Emulator default only. Choose a region alongside Firestore before an authorized deployment.
export const callableOptions = { region: process.env.FUNCTION_REGION || 'us-central1',
  minInstances: 0, maxInstances: 2, timeoutSeconds: 30, memory: '256MiB' as const };
