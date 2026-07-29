#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
ssh_target="${1:-hermes-admin}"

gh_agent_token="${GH_AGENT_TOKEN:-$(gh auth token)}"
anthropic_api_key="${ANTHROPIC_API_KEY:-}"
telegram_bot_token="${TELEGRAM_BOT_TOKEN:-}"
telegram_allowed_user_id="${TELEGRAM_ALLOWED_USER_ID:-}"

if [[ -z "$gh_agent_token" ]]; then
  echo "Authenticate gh or set GH_AGENT_TOKEN." >&2
  exit 2
fi

echo "Checking SSH connectivity to $ssh_target"
ssh -o BatchMode=yes -o ConnectTimeout=12 "$ssh_target" \
  'sudo -n true'

echo "Minting a short-lived self-hosted runner registration token"
runner_registration_token="$(
  gh api \
    --method POST \
    repos/Taruu-ShowYourselves/taruu-monorepo/actions/runners/registration-token \
    --jq .token
)"

remote_bundle="/tmp/taruu-agent-bootstrap-$$"
ssh "$ssh_target" "install -d -m 0700 '$remote_bundle/infra' '$remote_bundle/scripts'"
rsync -az "$repo_root/infra/agentic" "$ssh_target:$remote_bundle/infra/"
rsync -az "$repo_root/scripts/agentic" "$ssh_target:$remote_bundle/scripts/"

encode_line() {
  printf '%s' "$1" | base64 | tr -d '\n'
  printf '\n'
}

echo "Running the idempotent remote bootstrap"
{
  encode_line "$gh_agent_token"
  encode_line "$anthropic_api_key"
  encode_line "$runner_registration_token"
  encode_line "$telegram_bot_token"
  encode_line "$telegram_allowed_user_id"
} | ssh "$ssh_target" \
  "chmod 0700 '$remote_bundle/infra/agentic/scripts/bootstrap-remote.sh' && sudo -n '$remote_bundle/infra/agentic/scripts/bootstrap-remote.sh' '$remote_bundle'"

unset \
  gh_agent_token \
  anthropic_api_key \
  runner_registration_token \
  telegram_bot_token \
  telegram_allowed_user_id
echo "Remote bootstrap completed"
