# GitHub Workflows

## NPM Package Publish - OrdinalsPlus

This workflow automatically publishes the `ordinalsplus` package to npm using semantic-release when changes are pushed to the `main` branch.

### Required Secrets

To enable automatic publishing, you need to configure the following secrets in your GitHub repository:

1. **NPM_TOKEN** - Your npm authentication token
   - Go to [npm.com](https://www.npmjs.com) → Account Settings → Access Tokens
   - Create a new "Automation" token
   - Add it as a repository secret named `NPM_TOKEN`

2. **GITHUB_TOKEN** - This is automatically provided by GitHub Actions

### How It Works

1. **Trigger**: The workflow runs when:
   - Code is pushed to the `main` branch
   - Changes are made to files in `packages/ordinalsplus/`
   - The workflow file itself is modified

2. **Process**:
   - Checks out the code with full git history
   - Sets up Bun runtime
   - Installs dependencies
   - Builds the package
   - Runs semantic-release to:
     - Analyze commits for semantic versioning
     - Generate release notes
     - Update version in package.json
     - Publish to npm
     - Create GitHub release
     - Update CHANGELOG.md

### Commit Message Format

To trigger releases, use conventional commit messages:

- `feat: description` - Minor version bump (new feature)
- `fix: description` - Patch version bump (bug fix)
- `feat!: description` or `feat: description BREAKING CHANGE: details` - Major version bump
- `chore: description` - No version bump

### Manual Release

You can also run semantic-release manually from the package directory:

```bash
cd packages/ordinalsplus
npm run release
``` 