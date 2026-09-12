# Drizzle Tools

> A modern TypeScript monorepo managed with pnpm and TurboRepo.

## 🚀 Getting Started

### Development

Build all packages:

```sh
pnpm build
```

Run tests:

```sh
pnpm test
```

Lint and format:

```sh
pnpm lint
pnpm format
```

### Create a New Package

Generate a new package in the monorepo:

```sh
pnpm run gen:package
```

## 📦 Packages

### [drizzle-pg](./packages/drizzle-pg/README.md)

PostgreSQL adapter utilities for Drizzle ORM  

### [drizzle-supabase](./packages/drizzle-supabase/README.md)

Drizzle ORM integration for Supabase

### [drizzle-test-pglite](./packages/drizzle-test-pglite/README.md)

A test package for drizzle with pglite


## 🚢 Releases

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

## 📄 License

[MIT](LICENSE)
