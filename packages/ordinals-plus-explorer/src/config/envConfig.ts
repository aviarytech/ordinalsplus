import * as v from 'valibot';

// Schema for frontend environment variables
const EnvSchema = v.object({
  VITE_BACKEND_URL: v.string(),
  VITE_ALLOWED_HOSTS: v.optional(v.string()),
  VITE_ORD_NODE_URL: v.optional(v.string())
});

export type EnvConfig = v.InferOutput<typeof EnvSchema>;

export function loadEnv(): EnvConfig {
  try {
    const values = {
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
      VITE_ALLOWED_HOSTS: import.meta.env.VITE_ALLOWED_HOSTS,
      VITE_ORD_NODE_URL: import.meta.env.VITE_ORD_NODE_URL,
    };
    return v.parse(EnvSchema, values);
  } catch (err) {
    console.error('Invalid frontend environment configuration:', err);
    throw err;
  }
}

export const env = loadEnv();
