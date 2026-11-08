import { supabaseLocalEnvironment } from './supabase-local-env.mjs';

const { url, anonKey } = supabaseLocalEnvironment();
console.log(`VITE_DATA_MODE=local\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}`);
