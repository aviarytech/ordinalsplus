# Development & Contribution

We welcome contributions to the Ordinals Plus library. This guide provides all the necessary information to get your development environment set up and to build, test, and lint the codebase. The project uses Bun as its primary toolkit for dependency management, running tests, and bundling the final package.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

*   **Git:** For version control.
*   **Node.js:** Version 18.0.0 or higher is required. You can check your version with `node -v`.
*   **Bun:** The runtime and toolkit used by this project. You can find installation instructions on the [official Bun website](https://bun.sh/).

## Getting Started: Local Setup

Follow these steps to get a local copy of the project running on your machine.

1.  **Clone the Repository**
    
    First, clone the repository from GitHub to your local machine:
    
    ```bash
    git clone https://github.com/aviarytech/ordinalsplus.git
    cd ordinalsplus
    ```

2.  **Install Dependencies**
    
    Once you are inside the project directory, install the required dependencies using Bun:
    
    ```bash
    bun install
    ```

## Common Development Tasks

The project's `package.json` includes a set of scripts to streamline common development tasks. You can run any of these scripts using `bun run <script_name>`.

### Building the Library

You have a few options for building the code, depending on your needs.

| Command | Description |
|---|---|
| `bun run build:check` | Runs the TypeScript compiler to check for type errors without emitting any JavaScript files. This is the fastest way to validate your changes. |
| `bun run build:types` | Emits only the TypeScript declaration files (`.d.ts`) to the `./dist` directory. |
| `bun run build:bundled` | Creates the final bundled JavaScript files in the `./dist` directory. |
| `bun run dev` | Starts the TypeScript compiler in watch mode. It will automatically re-check types whenever a file is saved. |

### Running Tests

We use Bun's built-in test runner for unit and integration tests. It's fast and provides a great developer experience.

| Command | Description |
|---|---|
| `bun test` | Executes the entire test suite once. |
| `bun test:watch` | Runs the test suite in watch mode, automatically re-running tests when source or test files are changed. |
| `bun test:bail` | Executes the tests but stops immediately on the first failure. This is useful for debugging a specific failing test without running the entire suite. |

### Linting and Code Style

To maintain code consistency, we use ESLint. Before submitting any code, please run the linter to ensure your changes adhere to the project's coding standards.

```bash
# Run ESLint on the src directory
bun run lint
```

### Cleaning the Project

If you need to remove the build artifacts, you can use the `clean` script:

```bash
# Deletes the dist directory
bun run clean
```

## Contribution Process

We encourage community contributions. If you'd like to contribute, please follow these general steps:

1.  **Find an Issue:** Look for an existing issue on our [GitHub Issues page](https://github.com/aviarytech/ordinalsplus/issues) or create a new one to discuss a bug or a new feature you'd like to work on.
2.  **Fork and Branch:** Fork the repository and create a new branch for your work.
3.  **Implement Changes:** Make your changes, ensuring you follow the existing code style.
4.  **Test Your Code:** Add new tests for any new functionality and ensure all existing tests pass by running `bun test`.
5.  **Lint Your Code:** Run `bun run lint` and fix any reported issues.
6.  **Submit a Pull Request:** Push your branch to your fork and open a pull request against the main `ordinalsplus` repository. Provide a clear description of the changes you've made.