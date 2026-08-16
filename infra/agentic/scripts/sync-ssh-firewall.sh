#!/usr/bin/env bash
# Put this machine's current public IPv4 on the hermes SSH allow-list.
#
# The Hetzner firewall permits port 22 from individual /32 addresses and drops
# everything else silently, so moving networks does not produce "connection
# refused" — it produces a timeout that looks exactly like a dead server.
# Run this after switching networks, or let `ssh hermes-admin` trigger it.
#
#   infra/agentic/scripts/sync-ssh-firewall.sh          # add current IP if missing
#   infra/agentic/scripts/sync-ssh-firewall.sh --prune  # ...and drop stale ones
#
# --prune never removes the address you are currently coming from, so it cannot
# lock you out of the box you are running it against.

set -euo pipefail

FIREWALL="${HERMES_FIREWALL:-openclaw-fw}"
LABEL_PREFIX="${HERMES_RULE_LABEL:-sahar admin}"
PRUNE=0
[[ "${1:-}" == "--prune" ]] && PRUNE=1

command -v hcloud >/dev/null || { echo "hcloud CLI not found" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq not found" >&2; exit 1; }

# -4 matters: the SSH aliases target an IPv4 host, so the IPv6 egress address
# this machine may also have is not the one the firewall will see.
ip="$(curl -fsS -4 --max-time 10 https://ifconfig.me)"
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "could not determine a public IPv4 (got: ${ip:-nothing})" >&2
  exit 1
}

rules="$(hcloud firewall describe "$FIREWALL" -o json)"
existing="$(jq -r --arg ip "$ip/32" \
  '.rules[] | select(.direction=="in" and .port=="22") | .source_ips[] | select(. == $ip)' \
  <<<"$rules" || true)"

if [[ -n "$existing" ]]; then
  echo "$ip already allowed on $FIREWALL"
else
  hcloud firewall add-rule "$FIREWALL" \
    --direction in --protocol tcp --port 22 \
    --source-ips "$ip/32" \
    --description "$LABEL_PREFIX $(date +%Y-%m-%d)"
  echo "added $ip to $FIREWALL"
fi

if (( PRUNE )); then
  # Rebuild the rule set with every stale label-prefixed /32 dropped, keeping
  # the current address and every rule this script did not create.
  stale="$(jq -r --arg ip "$ip/32" --arg prefix "$LABEL_PREFIX" \
    '[.rules[] | select(.direction=="in" and .port=="22"
        and (.description // "" | startswith($prefix))
        and (.source_ips | index($ip) | not))] | length' <<<"$rules")"

  if [[ "$stale" == "0" ]]; then
    echo "no stale $LABEL_PREFIX rules to prune"
  else
    kept="$(jq --arg ip "$ip/32" --arg prefix "$LABEL_PREFIX" \
      '[.rules[] | select((.direction=="in" and .port=="22"
          and (.description // "" | startswith($prefix))
          and (.source_ips | index($ip) | not)) | not)]' <<<"$rules")"
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' EXIT
    printf '%s' "$kept" >"$tmp"
    hcloud firewall replace-rules "$FIREWALL" --rules-file "$tmp"
    echo "pruned $stale stale $LABEL_PREFIX rule(s) from $FIREWALL"
  fi
fi
