[![NPM Package Publish - OrdinalsPlus](https://github.com/aviarytech/ordinalsplus/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/aviarytech/ordinalsplus/actions/workflows/npm-publish.yml)

# Ordinals Plus Project Guidelines

## Project Overview

Ordinals Plus is a comprehensive solution for creating, managing, and exploring Bitcoin Ordinals, Ordinals Plus Decentralized Identifiers (DIDs, `did:btco:*`), and linked resources. It allows users to interact with inscriptions on the Bitcoin blockchain through dedicated tools and interfaces. The project consists of several key components:

1.  **ordinalsplus/**: Core TypeScript library with shared types, utilities, and logic for working with Bitcoin Ordinals and Ordinals Plus DIDs/resources.
2.  **ordinals-plus-api/**: Backend API service (built with Elysia.js and TypeScript) that interfaces with the Bitcoin blockchain (via an Ord node) and potentially other services like Ordiscan. It handles inscription creation, data fetching, and business logic.
3.  **ordinals-plus-explorer/**: Frontend web application (built with React, TypeScript, and Tailwind CSS) for exploring and visualizing DIDs and linked resources, and potentially interacting with creation tools.
4.  **prd/**: Contains Product Requirements Documents detailing features and specifications.
5.  **specs/**: Contains formal specifications for protocols or data formats developed within the project, like the `did:btco` method.

## Tech & Style Requirements

*   **Core Library (`ordinalsplus`)**: TypeScript.
*   **Backend API (`ordinals-plus-api`)**: Elysia.js, TypeScript. Interfaces with Ord node and potentially Ordiscan API.
*   **Frontend Explorer (`ordinals-plus-explorer`)**: React, TypeScript, Tailwind CSS.
    *   **Icons**: Use `lucide-react` exclusively for icons (NO custom SVGs).
    *   **Styling**:
        *   Exclusive use of Tailwind utility classes (NO custom CSS files or CSS-in-JS libraries like styled-components).
        *   Ensure dark mode support using `dark:` prefixes.
        *   Utilize blue/indigo gradients for section headers where applicable.
        *   Employ a card-based UI for displaying resources or distinct data items.

## Code Guidelines (Apply Across All Codebases)

*   **Modularity**: Keep components, modules, and functions focused on single responsibilities.
*   **Typing**: Use TypeScript rigorously. Define clear interfaces for all data models, API payloads, and function signatures. Place shared types in the `ordinalsplus` library where appropriate.
*   **Style**: Prefer functional programming paradigms where applicable (e.g., functional components with hooks in React, pure functions).
*   **Error Handling**: Implement robust error handling, especially around API calls, blockchain interactions, and asynchronous operations. Provide clear feedback for loading and error states in user interfaces.

## Blockchain Context

*   **DIDs**: Decentralized Identifiers inscribed on Bitcoin using the format `did:btco:*`, following the specification defined in this project.
*   **Resources**: Data linked to DIDs (e.g., profile info, credentials, external links), also inscribed on Bitcoin according to the project's specification.
*   **Inscriptions**: Generic on-chain data stored using the standard Ordinals protocol.
*   **Content Types**: Resources and inscriptions can have various content types, which should influence how they are displayed or processed.

## UI/UX Requirements (Primarily for `ordinals-plus-explorer`)

*   **Controls**: Use pill styles for filter/selection controls. Toggle switches need clear visual distinction between on/off states.
*   **Layout**: Use cards with subtle shadows and rounded corners for displaying discrete items like resources or DIDs.
*   **Feedback**: Always provide user feedback for loading states (e.g., spinners) and asynchronous actions.
*   **Readability**: Truncate long identifiers (like inscription IDs or transaction hashes) with ellipsis and provide tooltips or copy-to-clipboard functionality.

## Project Structure

*   **ordinalsplus/**: Core shared library (TypeScript).
*   **ordinals-plus-api/**: Backend API (Elysia.js, TypeScript).
*   **ordinals-plus-explorer/**: Frontend Explorer (React, TypeScript, Tailwind CSS).
    *   `/src/components/`: Reusable UI components.
    *   `/src/services/`: API interaction logic, blockchain service integration.
    *   `/src/types/`: Frontend-specific TypeScript interfaces.
    *   `/src/utils/`: Frontend helper functions.
*   **prd/**: Product Requirements Documents (.md).
*   **specs/**: Formal Specifications (.md).

## Development Process

*   **Watch Mode**: Development servers (backend and frontend) are expected to be running in watch mode. Do not include instructions to start/restart servers.
*   **Focus**: Concentrate on code changes; assume changes are automatically reflected via the watch process.
*   **Environment**: Assume both backend and frontend servers are continuously running during development sessions.

## Setup

Run the `configure.sh` script to install Bun and all project dependencies:

```bash
./scripts/configure.sh
```

Create a `.env` file for each package using the provided `.env.example` templates:
```bash
cp .env.example .env
cp packages/ordinals-plus-api/.env.example packages/ordinals-plus-api/.env
cp packages/ordinals-plus-explorer/.env.example packages/ordinals-plus-explorer/.env
```
Update these `.env` files with your API keys and other settings before running tests.
