import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'; // Import fs to read the certificate files
import path from 'path'; // Import path for resolving file paths
import wasm from 'vite-plugin-wasm'; // Import the wasm plugin
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // Import the node polyfills plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(), // Add the wasm plugin here
    nodePolyfills({ // Add the node polyfills plugin
      // Optionally specify which polyfills to include or exclude
      // Exclude Buffer? We need it, so keep it.
      // globals: {
      //   Buffer: true, // Default: true
      //   global: true, // Default: true
      //   process: true, // Default: true
      // },
      // protocolImports: true, // Default: true. For node: imports
    }),
  ],

  // optimizeDeps can often be removed or simplified when using the plugin
  // optimizeDeps: {
  //   esbuildOptions: {
  //     define: {
  //       global: 'globalThis' 
  //     },
  //   },
  // },
  // resolve.alias for buffer/process usually not needed with the plugin
  // resolve: {
  //   alias: {
  //     process: 'process/browser', 
  //     buffer: 'buffer', 
  //   },
  // },
  // define for Buffer/process usually not needed with the plugin
  // define: {
  //   'globalThis.Buffer': ['buffer', 'Buffer'],
  //   'process.env': '({})', 
  // },
  server: {
    // https: {
    //   key: fs.readFileSync(path.resolve(__dirname, './localhost+2-key.pem')), // Adjust path if files are elsewhere
    //   cert: fs.readFileSync(path.resolve(__dirname, './localhost+2.pem')), // Adjust path if files are elsewhere
    // },
    // Optional: Define port if needed, default is 5173 for Vite
    // port: 3000, 
  },
  preview: {
    allowedHosts: process.env.VITE_ALLOWED_HOSTS 
      ? process.env.VITE_ALLOWED_HOSTS.split(',').map(host => host.trim())
      : ['localhost', '127.0.0.1']
  },
})
