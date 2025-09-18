# Defuse Protocol Monorepo

This is a monorepo for Defuse Protocol packages managed with Turborepo and Changesets.

## Packages

- [@defuse-protocol/intents-sdk](./packages/intents-sdk) - SDK for Near Intents
- [@defuse-protocol/contract-types](./packages/contract-types) - TypeScript type definitions for Defuse Protocol contracts

## Development

### Prerequisites

- [PNPM](https://pnpm.io) (v10.14.0)

### Setup

```bash
# Install dependencies
pnpm install
```

### Build

```bash
# Build all packages
pnpm run build
```

### Development Mode

```bash
# Run all packages in dev mode
pnpm run dev
```

### Lint

```bash
# Lint all packages
pnpm run lint
```

### Format

```bash
# Format all packages
pnpm run format
```

## Release Process

This repository uses [Changesets](https://github.com/changesets/changesets) to manage versions, create changelogs, and publish to npm.

### Creating a changeset

When making changes that should be released, create a changeset:

```bash
pnpm run changeset
```

This will prompt you to:
1. Select the packages you've modified
2. Choose the semver increment (patch, minor, major)
3. Add a description of the changes

The changeset will be committed to your branch as a markdown file in the `.changeset` directory.

### Releasing

Releases are managed through GitHub Actions. To create a release:

1. Make sure all your changesets are merged to main
2. Go to the "Actions" tab in GitHub
3. Select the "Release" workflow
4. Click "Run workflow" 
5. Select "main" branch
6. Click "Run workflow"

This will create a PR that:
- Updates package versions based on changesets
- Updates the CHANGELOG.md files
- Removes the changeset files

Once that PR is merged, the GitHub Action will automatically:
- Build the packages
- Publish to npm

## License

[MIT](LICENSE) © 2025 NEAR Foundation
