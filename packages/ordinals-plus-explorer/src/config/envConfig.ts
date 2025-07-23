import * as v from 'valibot';

// Schema for frontend environment variables
const EnvSchema = v.object({
  VITE_BACKEND_URL: v.string(),
  VITE_DEFAULT_NETWORK: v.string(),
  VITE_API_BASE_URL: v.optional(v.string())
});

export type EnvConfig = v.InferOutput<typeof EnvSchema>;

export function loadEnv(): EnvConfig {
  try {
    const values = {
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
      VITE_DEFAULT_NETWORK: import.meta.env.VITE_DEFAULT_NETWORK,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    };
    return v.parse(EnvSchema, values);
  } catch (err) {
    console.error('Invalid frontend environment configuration:', err);
    throw err;
  }
}

export const env = loadEnv();
