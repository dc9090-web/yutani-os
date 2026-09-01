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

## Logs and troubleshooting

```
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-app'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-worker'
```

Health check: `curl -sS https://eve.plasma66.com/api/health` should return `{"ok":true,"db":true}`.
