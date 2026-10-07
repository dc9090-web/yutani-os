#!/usr/bin/env bash
# Yutani OS — install configurator.
#
# Asks for the few things only you know (the subdomain, your EVE SSO application, a Cloudflare DNS
# token, which characters may sign in) and detects or generates everything else. It writes three
# git-ignored files that the Ansible playbook reads:
#
#   deploy/ansible/inventory.ini      where to install: this machine, or a host over SSH
#   deploy/ansible/vars/site.yml      domain, contact email, characters, extra allowed networks
#   deploy/ansible/vars/secrets.yml   tokens and generated secrets (mode 0600)
#
# Re-running is safe: existing answers come back as defaults and a secret that already exists is
# never regenerated. Any prompt can be pre-seeded with an environment variable of the same name
# (DOMAIN, ACME_EMAIL, EVE_CLIENT_ID, ...), which also makes the script usable non-interactively.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ans="$here/ansible"
inventory="$ans/inventory.ini"
site="$ans/vars/site.yml"
secrets="$ans/vars/secrets.yml"

if [[ -t 1 ]]; then bold=$'\e[1m'; dim=$'\e[2m'; amber=$'\e[38;5;214m'; red=$'\e[31m'; reset=$'\e[0m'
else bold=""; dim=""; amber=""; red=""; reset=""; fi

heading() { printf '\n%s%s%s\n' "$amber$bold" "$*" "$reset"; }
note()    { printf '%s%s%s\n' "$dim" "$*" "$reset"; }
die()     { printf '%s%s%s\n' "$red" "$*" "$reset" >&2; exit 1; }

# yaml_get FILE KEY → the scalar value of a top-level `key: value` line, quotes stripped, or "".
yaml_get() {
  [[ -f "$1" ]] || return 0
  sed -n -E "s/^$2:[[:space:]]*\"?([^\"#]*[^\"# ])\"?[[:space:]]*(#.*)?$/\1/p" "$1" | head -n 1
}
# ini_get FILE KEY → value of `key=value` anywhere in the file, or "".
ini_get() { [[ -f "$1" ]] || return 0; sed -n -E "s/.*[[:space:]]$2=([^[:space:]]+).*/\1/p" "$1" | head -n 1; }

# ask VAR "Prompt" "default" [required] → sets VAR. The environment pre-seeds the default.
ask() {
  local var=$1 prompt=$2 default=${3:-} required=${4:-} value
  default=${!var:-$default}
  while :; do
    if [[ -n "$default" ]]; then printf '%s [%s]: ' "$prompt" "$default"; else printf '%s: ' "$prompt"; fi
    if ! read -r value; then value=""; fi
    value=${value:-$default}
    if [[ -n "$required" && -z "$value" ]]; then printf '  %sThis one is needed.%s\n' "$red" "$reset"; continue; fi
    printf -v "$var" '%s' "$value"; return 0
  done
}
# ask_secret VAR "Prompt" "existing" → like ask, but input is hidden and an existing value is kept on Enter.
ask_secret() {
  local var=$1 prompt=$2 existing=${3:-} value
  existing=${!var:-$existing}
  while :; do
    if [[ -n "$existing" ]]; then printf '%s [keep current]: ' "$prompt"; else printf '%s: ' "$prompt"; fi
    if ! read -rs value; then value=""; fi; printf '\n'
    value=${value:-$existing}
    if [[ -z "$value" ]]; then printf '  %sThis one is needed.%s\n' "$red" "$reset"; continue; fi
    printf -v "$var" '%s' "$value"; return 0
  done
}
yes_no() {  # yes_no "Prompt" default(y|n) → 0 for yes
  local prompt=$1 default=$2 value
  while :; do
    printf '%s [%s]: ' "$prompt" "$([[ $default == y ]] && echo Y/n || echo y/N)"
    if ! read -r value; then value=""; fi
    value=${value:-$default}
    case "${value,,}" in y|yes) return 0;; n|no) return 1;; esac
  done
}
rand_hex() {  # rand_hex BYTES
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"
  else head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}
valid_domain() { [[ $1 =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; }
valid_ids()    { [[ $1 =~ ^[0-9]+(,[0-9]+)*$ ]]; }
valid_cidrs()  { [[ -z $1 || $1 =~ ^([0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2})(,[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2})*$ ]]; }
local_ip() { ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}'; }

printf '%s%sYutani OS — install configurator%s\n' "$amber" "$bold" "$reset"
note "Answers are written under deploy/ansible/ (git-ignored). Press Enter to accept a default."

# ---------------------------------------------------------------- where
heading "Where"
prev_host=$(ini_get "$inventory" ansible_host)
prev_conn=$(ini_get "$inventory" ansible_connection)
prev_user=$(ini_get "$inventory" ansible_user)
default_local=n; [[ -z "$prev_host" || "$prev_conn" == local ]] && default_local=y
if yes_no "Install on this machine?" "$default_local"; then
  INSTALL_LOCAL=1; TARGET_HOST=127.0.0.1
  ask TARGET_USER "User that will own the install and run docker" "${prev_user:-${SUDO_USER:-$USER}}" required
  detected_ip=$(local_ip)
else
  INSTALL_LOCAL=0
  [[ "$prev_conn" == local ]] && prev_host=""
  ask TARGET_HOST "SSH host (IP or name) to install on" "$prev_host" required
  ask TARGET_USER "SSH user there (needs sudo)" "${prev_user:-$USER}" required
  detected_ip=$TARGET_HOST
fi

# ---------------------------------------------------------------- site
heading "Site"
note "The subdomain people will open. Its DNS zone must be on Cloudflare: Traefik proves ownership"
note "with a DNS-01 challenge to get the certificate, which also works for a LAN-only host."
prev_domain=$(yaml_get "$site" domain)
while :; do
  ask DOMAIN "Subdomain" "$prev_domain" required
  DOMAIN=${DOMAIN,,}
  valid_domain "$DOMAIN" && break
  printf '  %sThat is not a hostname (something like eve.example.com).%s\n' "$red" "$reset"
done
git_email=$(git -C "$here" config --get user.email 2>/dev/null || true)
prev_email=$(yaml_get "$site" acme_email)
ask ACME_EMAIL "Contact email (Let's Encrypt notices, and the ESI user agent CCP asks for)" "${prev_email:-$git_email}" required
prev_extra=$(yaml_get "$site" extra_allowed_cidrs | tr -d '[] "')
note "The site is reachable only from the host's own LAN, Tailscale and the networks you add here."
while :; do
  ask EXTRA_CIDRS "Extra networks allowed in (CIDRs, comma-separated; empty for none)" "$prev_extra"
  EXTRA_CIDRS=${EXTRA_CIDRS// /}
  valid_cidrs "$EXTRA_CIDRS" && break
  printf '  %sUse CIDRs like 192.168.1.0/24, separated by commas.%s\n' "$red" "$reset"
done

# ---------------------------------------------------------------- characters
heading "Characters"
note "Only allow-listed characters can sign in. Character IDs are the number in a zKillboard or"
note "ESI character URL. Several are separated by commas."
while :; do
  ask ALLOWED_CHARACTER_IDS "Allowed character IDs" "$(yaml_get "$site" allowed_character_ids)" required
  ALLOWED_CHARACTER_IDS=${ALLOWED_CHARACTER_IDS// /}
  valid_ids "$ALLOWED_CHARACTER_IDS" && break
  printf '  %sDigits and commas only.%s\n' "$red" "$reset"
done
while :; do
  ask OVERVIEW_CHARACTER_IDS "Characters on the Overview and the Training overview (empty = all of them)" "$(yaml_get "$site" overview_character_ids)"
  OVERVIEW_CHARACTER_IDS=${OVERVIEW_CHARACTER_IDS// /}
  [[ -z "$OVERVIEW_CHARACTER_IDS" ]] || valid_ids "$OVERVIEW_CHARACTER_IDS" && break
  printf '  %sDigits and commas only.%s\n' "$red" "$reset"
done

# ---------------------------------------------------------------- credentials
heading "EVE SSO application"
note "Create one at https://developers.eveonline.com → Manage Applications → Create New Application."
note "  Connection type: Authentication & API Access"
note "  Callback URL:    https://$DOMAIN/auth/callback"
note "  Scopes:          the twelve esi-* scopes listed in src/lib/auth/sso.ts"
ask EVE_CLIENT_ID "Client ID" "$(yaml_get "$secrets" eve_client_id | sed 's/^CHANGEME$//')" required
ask_secret EVE_CLIENT_SECRET "Secret key" "$(yaml_get "$secrets" eve_client_secret | sed 's/^CHANGEME$//')"

heading "Cloudflare"
note "An API token with Zone → DNS → Edit on the zone that holds $DOMAIN (dash.cloudflare.com → My Profile → API Tokens)."
ask_secret CLOUDFLARE_DNS_API_TOKEN "Cloudflare DNS API token" "$(yaml_get "$secrets" cloudflare_dns_api_token | sed 's/^CHANGEME$//')"

SESSION_SECRET=$(yaml_get "$secrets" session_secret | sed 's/^CHANGEME$//')
POSTGRES_PASSWORD=$(yaml_get "$secrets" postgres_password | sed 's/^CHANGEME$//')
[[ -n "$SESSION_SECRET" ]]    || SESSION_SECRET=$(rand_hex 32)
[[ -n "$POSTGRES_PASSWORD" ]] || POSTGRES_PASSWORD=$(rand_hex 16)

# ---------------------------------------------------------------- write
heading "Writing"
mkdir -p "$ans/vars"
if [[ $INSTALL_LOCAL == 1 ]]; then
  cat > "$inventory" <<INI
# Written by deploy/setup.sh — this machine.
[eve]
yutani-os ansible_host=127.0.0.1 ansible_connection=local

[eve:vars]
ansible_user=$TARGET_USER
ansible_python_interpreter=/usr/bin/python3
INI
else
  cat > "$inventory" <<INI
# Written by deploy/setup.sh.
[eve]
yutani-os ansible_host=$TARGET_HOST

[eve:vars]
ansible_user=$TARGET_USER
ansible_python_interpreter=/usr/bin/python3
INI
fi
extra_yaml="[]"
if [[ -n "$EXTRA_CIDRS" ]]; then extra_yaml="[\"${EXTRA_CIDRS//,/\", \"}\"]"; fi
cat > "$site" <<YAML
---
# Written by deploy/setup.sh. Site-specific settings; defaults live in group_vars/eve.yml and
# secrets in vars/secrets.yml. Edit and re-run: ansible-playbook site.yml --tags eve
domain: "$DOMAIN"
acme_email: "$ACME_EMAIL"
allowed_character_ids: "$ALLOWED_CHARACTER_IDS"
overview_character_ids: "$OVERVIEW_CHARACTER_IDS"
# Allowed through Traefik on top of the host's own LAN (detected at install time), Tailscale and loopback.
extra_allowed_cidrs: $extra_yaml
YAML
umask 077
cat > "$secrets" <<YAML
---
# Written by deploy/setup.sh. Never commit this file.
cloudflare_dns_api_token: "$CLOUDFLARE_DNS_API_TOKEN"
eve_client_id: "$EVE_CLIENT_ID"
eve_client_secret: "$EVE_CLIENT_SECRET"
session_secret: "$SESSION_SECRET"
postgres_password: "$POSTGRES_PASSWORD"
YAML
chmod 600 "$secrets"
printf '  %s\n  %s\n  %s\n' "${inventory#"$here/"}" "${site#"$here/"}" "${secrets#"$here/"} (0600)"

# ---------------------------------------------------------------- next
heading "Next"
dns_ip=${detected_ip:-"the host's LAN IP"}
cat <<TXT
1. DNS: an A record for ${bold}$DOMAIN${reset} → ${bold}$dns_ip${reset} in Cloudflare, DNS-only (grey cloud).
   The site is LAN/Tailscale-only, so the record can point at a private address.
2. Install (first time needs the Ansible collections; -K asks for the sudo password):
     cd deploy/ansible
     ansible-galaxy collection install -r requirements.yml
     ansible-playbook -K site.yml
   Later, to redeploy the app only:  ansible-playbook -K site.yml --tags eve
3. Open https://$DOMAIN and sign each allow-listed character in with EVE Online.
   The first worker tick imports CCP's static data, which takes a few minutes.
TXT
