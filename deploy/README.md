# Deploying EVE

Ansible provisions and updates the VM at `10.5.5.150` (inventory group `eve`), which runs Traefik
plus the app/worker/postgres stack via Docker Compose.

## Prerequisites

```
cd deploy/ansible
ansible-galaxy collection install -r requirements.yml
cp vars/secrets.yml.example vars/secrets.yml
```

Fill in `vars/secrets.yml` with real values (Cloudflare DNS API token, EVE SSO client secret,
session secret, Postgres password). `site.yml` refuses to run while any value is still
`CHANGEME`. Never commit `vars/secrets.yml`.

## First deploy

```
ansible-playbook site.yml
```

This runs all four roles in order: `common` (base packages, users), `docker` (engine + compose
plugin), `traefik` (reverse proxy, TLS via Cloudflare DNS challenge), `eve` (syncs the repo to the
VM, builds the app image, starts the stack, applies the DB schema).

## Redeploying app changes

```
ansible-playbook site.yml --tags eve
```

Only re-syncs the repo, rebuilds the image, restarts the stack and re-applies the schema — skips
the (idempotent but slower) `common`/`docker`/`traefik` roles.

## Running Ansible from Claude's shell

The Bash tool's non-interactive shell breaks Ansible's progress/callback output. Wrap the command
in `script` to give it a pseudo-tty:

```
script -qc "ansible-playbook site.yml --tags eve" /dev/null
```

## Where things live on the VM

- `/opt/eve/traefik` — Traefik config, dynamic routes, ACME certificate storage.
- `/opt/eve/src` — the synced repository; `/opt/eve/src/deploy` is the Compose project directory
  (`docker-compose.yml`, the templated `.env`) that `docker compose` commands run from.

## Static data (SDE)

The worker polls CCP's Static Data Export on a schedule; there is nothing to provision for it.

- On an empty database, the worker's first tick downloads the current SDE (~95 MB) and imports it
  — a few minutes, mostly the download. `/settings` shows "Not imported yet" until that completes.
- Once imported, the `sde-update` job re-checks the published build every 6 hours and only
  downloads/re-imports when it changed. A failed check (network blip, CCP endpoint down) retries
  after 10 minutes rather than waiting for the next 6-hour slot.
- The `/settings` page's "Static data" card shows the imported build number, release date, import
  timestamp and a few table counts (types, dogma attributes, dogma effects, solar systems) once an
  import has completed.
- To force a re-import without waiting for the schedule:

  ```
  ssh daniel@10.5.5.150 'cd /opt/eve/src/deploy && docker compose exec -T worker npm run sde:import'
  ```

## Logs and troubleshooting

```
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-app'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-worker'
```

Health check: `curl -sS https://eve.plasma66.com/api/health` should return `{"ok":true,"db":true}`.
