# Artifact starter (SvelteKit 5 on Bun)

Ready-to-deploy template for the Solana Foundation artifact registry.
Apps deployed from this template are served at
`https://{your-username}.{base_domain}/{app-name}/` behind Google SSO (IAP).

## Use

1. Copy this whole directory to a new project folder and rename it.
2. `bun install`
3. `bun run dev` — local dev at http://localhost:5173 (no base path, no SSO header; the page shows "anonymous").
4. Build your app. Rules that must not be broken:
   - Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`).
   - Every internal link and client fetch uses `base` from `$app/paths`.
   - Identity comes from `event.locals.userEmail` (set in `src/hooks.server.ts`). Never build a login page.
   - Keep the `Dockerfile`, `svelte.config.js` base-path wiring, and `src/hooks.server.ts` intact.
5. Verify the production build locally: `bun run build` and `BASE_PATH=/myapp bun run build` must both succeed.
6. Deploy via the artifact-registry MCP server (see the deploy-artifact skill):
   tar.gz the project (excluding `node_modules`, `.svelte-kit`, `build`, `.git`) → `create_upload_url` → `curl -X PUT` → `deploy_app`.

## What's wired up

| File | Purpose |
|---|---|
| `svelte.config.js` | `adapter-node`; `paths.base` from the `BASE_PATH` build arg |
| `Dockerfile` | canonical multi-stage Bun build (do not replace) |
| `src/hooks.server.ts` | parses the IAP identity header into `locals.userEmail` (ignored when `APP_VISIBILITY=public` — forgeable without IAP) |
| `src/app.d.ts` | types `App.Locals.userEmail` |
| `src/routes/+page.svelte` | runes demo + base-path-aware fetch |
| `src/routes/api/health/+server.ts` | health endpoint at `{base}/api/health` |
| `src/lib/server/db.ts` | optional Drizzle/Postgres wiring; no-ops without `DATABASE_URL` |

## Database (optional)

Ask your agent to run the `provision_database` MCP tool (after the app's
first deploy — it requires the service to exist), then use `getDb()` from
`src/lib/server/db.ts`. For local dev:

```sh
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
echo 'DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres' > .env
```
