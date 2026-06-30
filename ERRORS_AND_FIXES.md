# Draw App — Errors & Fixes Reference

All errors encountered during initial project setup and how each was resolved.

---

## 1. `@repo/backend-common` — MODULE_NOT_FOUND

**Error**
```
Error: Cannot find module '@repo/backend-common'
code: 'MODULE_NOT_FOUND'
```

**Cause**
`packages/backend-common/package.json` exports map pointed to `./src/index.js` (the raw TypeScript source) which doesn't exist at runtime.

```json
// WRONG
"exports": {
  "./config": {
    "types": "./src/index.d.ts",
    "default": "./src/index.js"
  }
}
```

**Fix**
Point exports to the compiled output in `dist/`:

```json
// FIXED
"exports": {
  "./config": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

**File changed:** `packages/backend-common/package.json`

---

## 2. `@repo/db` — Exports pointed to `.ts` source files

**Error**
```
Error: Could not find a declaration file for module '@repo/db/client'
implicitly has an 'any' type.
```

**Cause**
`packages/db/package.json` exports map pointed to `.ts` source files instead of compiled `.js`/`.d.ts` files.

```json
// WRONG
"exports": {
  "./client": {
    "types": "./src/index.ts",
    "default": "./src/index.ts"
  }
}
```

**Fix**
```json
// FIXED
"exports": {
  "./client": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

**File changed:** `packages/db/package.json`

---

## 3. `@repo/db` — Wrong PrismaClient import path

**Error**
```
Error: @prisma/client did not initialize yet.
Please run "prisma generate" and try to import it again.
```

**Cause**
`packages/db/src/index.ts` imported `PrismaClient` from `@prisma/client/extension` — this is a stub path that only re-exports helpers, not the actual generated client.

```ts
// WRONG
import { PrismaClient } from "@prisma/client/extension";
```

**Fix**
```ts
// FIXED
import { PrismaClient } from "@prisma/client";
```

**File changed:** `packages/db/src/index.ts`

---

## 4. `prisma.config.js` — Syntax error (CommonJS vs ESM)

**Error**
```
Failed to parse syntax of config file at "packages/db/prisma.config.js"
```

**Cause**
TypeScript compiled `prisma.config.ts` to CommonJS (`require()` syntax) but Prisma 7 expects ESM syntax in the config file.

```js
// WRONG (compiled CommonJS output)
const config_1 = require("prisma/config");
exports.default = config_1.defineConfig({ ... });
```

**Fix**
Rewrote `prisma.config.js` to use ESM syntax:

```js
// FIXED
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

**File changed:** `packages/db/prisma.config.js`

---

## 5. Prisma Client not generated

**Error**
```
Error: @prisma/client did not initialize yet.
Please run "prisma generate" and try to import it again.
```

**Cause**
`prisma generate` was never run after the schema was created, so the client runtime files didn't exist.

**Fix**
Run prisma generate from the `packages/db` directory (must use the local binary):

```bash
cd packages/db
node_modules\.bin\prisma generate
```

---

## 6. `packages/db` tsconfig — `.d.ts` files not emitted

**Error**
```
Error: Could not find a declaration file for module '@repo/db/client'
implicitly has an 'any' type.
```

**Cause**
`packages/db/tsconfig.json` had no `outDir`, `rootDir`, or `include` fields. TypeScript's incremental build (`tsc -b`) detected `prisma.config.js` as a newer output file and considered the build "up to date", skipping compilation and never emitting `.d.ts` files.

```jsonc
// WRONG — no outDir/rootDir/include
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "types": ["node"]
  }
}
```

**Fix**
```jsonc
// FIXED
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

**File changed:** `packages/db/tsconfig.json`

---

## 7. `http-backend` — `prismaClient.User` wrong casing

**Error**
```
Property 'User' does not exist on type 'PrismaClient<...>'.
Did you mean 'user'?
```

**Cause**
Prisma client exposes model names in **camelCase**, not PascalCase.

```ts
// WRONG
await prismaClient.User.create({ ... })
```

**Fix**
```ts
// FIXED
await prismaClient.user.create({ ... })
```

**File changed:** `apps/http-backend/src/index.ts`

---

## 8. `http-backend` — `DATABASE_URL` undefined at runtime (P1010)

**Error**
```
PrismaClientKnownRequestError:
User was denied access on the database `(not available)`
code: 'P1010' — DatabaseAccessDenied
```

**Cause**
The `DATABASE_URL` environment variable was defined only in `packages/db/.env` but `dotenv` was never loaded before the db module initialized. When `http-backend` starts, `process.env.DATABASE_URL` is `undefined`, so PrismaPg connects with no credentials.

**Fix — Step 1:** Create `.env` in `apps/http-backend/`:
```env
DATABASE_URL="postgresql://..."
```

**Fix — Step 2:** Add `dotenv/config` as the **first import** in `apps/http-backend/src/index.ts`:
```ts
import "dotenv/config";   // must be first — loads .env before anything else
import { prismaClient } from '@repo/db/client';
// ...
```

**Fix — Step 3:** Install `dotenv` in http-backend:
```bash
pnpm add dotenv
```

**Files changed:** `apps/http-backend/src/index.ts`, `apps/http-backend/.env`, `apps/http-backend/package.json`

---

## 9. `ws-backend` — Port 8080 EADDRINUSE

**Error**
```
Error: listen EADDRINUSE: address already in use :::8080
code: 'EADDRINUSE'
```

**Cause**
A previous manual test run left a `node` process still listening on port 8080. When Turbo restarted `ws-backend`, the port was already occupied.

**Fix**
Find and kill the process occupying the port:
```powershell
netstat -ano | findstr ":8080"
# note the PID in the last column
taskkill /PID <pid> /F
```

Or kill all node processes at once before restarting:
```powershell
taskkill /IM node.exe /F
```

---

## 10. Turbo exits when a persistent task fails

**Symptom**
Running `pnpm dev` (which runs `turbo run dev`) causes Turbo to kill all running apps as soon as one backend crashes.

**Cause**
By default, Turbo aborts the entire run when any task fails, even with `persistent: true` set.

**Fix**
Run with the `--continue` flag so other apps keep running even if one task fails:

```json
// package.json — update the dev script
"dev": "turbo run dev --continue"
```

Or run directly:
```bash
pnpm turbo run dev --continue
```

---

## Quick Reference — Commands

```powershell
# Regenerate Prisma client
cd packages/db
node_modules\.bin\prisma generate

# Rebuild a package
cd packages/db
node_modules\.bin\tsc -b --clean
node_modules\.bin\tsc -b

# Kill all node processes (clean slate)
taskkill /IM node.exe /F

# Run the full project
pnpm turbo run dev --continue

# Check which ports are listening
netstat -ano | findstr "LISTENING"
```

---

## Port Map

| Service       | Port  |
|---------------|-------|
| web (Next.js) | 3000  |
| docs (Next.js)| 3001  |
| http-backend  | 3003  |
| ws-backend    | 8080  |
