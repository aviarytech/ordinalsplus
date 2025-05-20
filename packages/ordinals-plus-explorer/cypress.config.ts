import { defineConfig } from "cypress";

export default defineConfig({
  env: {
    // Make API URL available to Cypress tests
    API_BASE_URL: "http://localhost:3005", // Corrected backend API port
  },
  e2e: {
    baseUrl: "http://localhost:5173", // Assuming default Vite dev server port
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: false, // Disable the need for a support file
    defaultCommandTimeout: 10000, // Increase global command timeout to 10 seconds
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
}); 