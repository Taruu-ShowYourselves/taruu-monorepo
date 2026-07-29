#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap-remote.sh must run as root" >&2
  exit 2
fi

bundle_root="${1:-}"
if [[ -z "$bundle_root" || ! -d "$bundle_root/infra/agentic" || ! -d "$bundle_root/scripts/agentic" ]]; then
  echo "usage: bootstrap-remote.sh <staged-bundle-root>" >&2
  exit 2
fi

echo "Reading bootstrap credentials from stdin"
IFS= read -r gh_token_b64
IFS= read -r anthropic_key_b64
IFS= read -r runner_token_b64

gh_agent_token="$(printf '%s' "$gh_token_b64" | base64 --decode)"
anthropic_api_key="$(printf '%s' "$anthropic_key_b64" | base64 --decode)"
runner_registration_token="$(printf '%s' "$runner_token_b64" | base64 --decode)"
unset gh_token_b64 anthropic_key_b64 runner_token_b64

if [[ -z "$gh_agent_token" || -z "$runner_registration_token" ]]; then
  echo "A GitHub agent token and runner registration token are required" >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive

echo "Installing operating-system dependencies"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  gh \
  jq \
  libicu-dev \
  openssl \
  rsync \
  sqlite3 \
  sudo \
  xz-utils

machine_arch="$(uname -m)"
if [[ "$machine_arch" != "x86_64" ]]; then
  echo "This bundle currently requires an x86_64 host for managed Google Chrome" >&2
  exit 2
fi

node_supported=false
if [[ -x /usr/bin/node ]]; then
  if /usr/bin/node -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major === 24 && minor >= 15 ? 0 : 1)'; then
    node_supported=true
  fi
fi

if [[ "$node_supported" != true ]]; then
  echo "Installing supported Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "Installing pinned agent CLIs"
/usr/bin/npm install --global \
  openclaw@2026.7.1-2 \
  ctx7@0.5.6 \
  pnpm@9.15.9

if ! command -v google-chrome >/dev/null 2>&1; then
  echo "Installing Google Chrome for managed visual verification"
  chrome_deb="/tmp/google-chrome-stable_current_amd64.deb"
  curl -fsSL \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    -o "$chrome_deb"
  apt-get install -y "$chrome_deb"
fi

if ! id taruu-agent >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash taruu-agent
fi
if ! id taruu-runner >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash taruu-runner
fi

install -d -o root -g root -m 0755 /opt/taruu-agent
install -d -o root -g root -m 0755 /opt/taruu-agent/scripts
install -d -o root -g root -m 0755 /etc/taruu-agent
install -d -o root -g root -m 0755 /srv/taruu-agent
install -d -o taruu-agent -g taruu-agent -m 0750 \
  /srv/taruu-agent/openclaw-state \
  /srv/taruu-agent/repo \
  /srv/taruu-agent/worktrees \
  /srv/taruu-agent/workspaces \
  /srv/taruu-agent/logs
install -d -o taruu-runner -g taruu-runner -m 0750 \
  /srv/taruu-agent/runner

echo "Installing runtime and agent workspace files"
for runtime_script in "$bundle_root"/scripts/agentic/*.mjs; do
  install -o root -g root -m 0755 "$runtime_script" /opt/taruu-agent/scripts/
done
install -o root -g root -m 0755 \
  "$bundle_root/infra/agentic/bin/taruu-agent-dispatch" \
  /usr/local/bin/taruu-agent-dispatch
install -o root -g taruu-agent -m 0640 \
  "$bundle_root/infra/agentic/openclaw/openclaw.json5" \
  /etc/taruu-agent/openclaw.json
rsync -a \
  "$bundle_root/infra/agentic/openclaw/workspaces/" \
  /srv/taruu-agent/workspaces/
chown -R taruu-agent:taruu-agent /srv/taruu-agent/workspaces

env_file="/etc/taruu-agent/agent.env"
touch "$env_file"
chown root:taruu-agent "$env_file"
chmod 0640 "$env_file"

upsert_env() {
  local key="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp /tmp/taruu-agent-env.XXXXXX)"
  grep -v -E "^${key}=" "$env_file" >"$temporary" || true
  printf '%s=%s\n' "$key" "$value" >>"$temporary"
  install -o root -g taruu-agent -m 0640 "$temporary" "$env_file"
  rm -f "$temporary"
}

existing_gateway_token="$(awk -F= '$1 == "OPENCLAW_GATEWAY_TOKEN" {print substr($0, index($0, "=") + 1)}' "$env_file" | tail -n 1)"
existing_hook_token="$(awk -F= '$1 == "OPENCLAW_HOOK_TOKEN" {print substr($0, index($0, "=") + 1)}' "$env_file" | tail -n 1)"
gateway_token="${existing_gateway_token:-$(openssl rand -hex 32)}"
hook_token="${existing_hook_token:-$(openssl rand -hex 32)}"
if [[ -n "$anthropic_api_key" ]]; then
  openclaw_model="anthropic/claude-opus-5"
  model_provider="anthropic"
else
  openclaw_model="openai/gpt-5.6-sol"
  model_provider="openai"
fi

upsert_env OPENCLAW_GATEWAY_TOKEN "$gateway_token"
upsert_env OPENCLAW_HOOK_TOKEN "$hook_token"
upsert_env OPENCLAW_GATEWAY_PORT "18790"
upsert_env OPENCLAW_CONFIG_PATH "/etc/taruu-agent/openclaw.json"
upsert_env OPENCLAW_STATE_DIR "/srv/taruu-agent/openclaw-state"
upsert_env OPENCLAW_MODEL "$openclaw_model"
if [[ -n "$anthropic_api_key" ]]; then
  upsert_env ANTHROPIC_API_KEY "$anthropic_api_key"
fi
upsert_env GH_TOKEN "$gh_agent_token"
upsert_env AGENT_REPOSITORY "Taruu-ShowYourselves/taruu-monorepo"
upsert_env AGENT_PROJECT_OWNER "Taruu-ShowYourselves"
upsert_env AGENT_PROJECT_NUMBER "2"
upsert_env AGENT_REPOSITORY_ROOT "/srv/taruu-agent/repo"
upsert_env AGENT_WORKTREES_ROOT "/srv/taruu-agent/worktrees"

agent_login="$(
  sudo -u taruu-agent -H bash -lc '
    set -a
    source /etc/taruu-agent/agent.env
    set +a
    gh api user --jq .login
  '
)"
upsert_env AGENT_GITHUB_LOGIN "$agent_login"
upsert_env AGENT_ASSIGNEE "$agent_login"
upsert_env AGENT_AUTHORIZED_ACTORS "SaharBarak,DolevSeren,$agent_login"
if [[ "${agent_login,,}" == "saharbarak" ]]; then
  agent_reviewers="DolevSeren"
else
  agent_reviewers="SaharBarak"
fi
upsert_env AGENT_REVIEWERS "$agent_reviewers"

dispatcher_env="/etc/taruu-agent/dispatcher.env"
dispatcher_temporary="$(mktemp /tmp/taruu-dispatcher-env.XXXXXX)"
{
  printf 'OPENCLAW_HOOK_TOKEN=%s\n' "$hook_token"
  printf 'OPENCLAW_GATEWAY_PORT=18790\n'
  printf 'AGENT_REPOSITORY=Taruu-ShowYourselves/taruu-monorepo\n'
  printf 'AGENT_AUTHORIZED_ACTORS=SaharBarak,DolevSeren,%s\n' "$agent_login"
} >"$dispatcher_temporary"
install -o root -g taruu-runner -m 0640 \
  "$dispatcher_temporary" \
  "$dispatcher_env"
rm -f "$dispatcher_temporary"

if [[ -z "$anthropic_api_key" ]]; then
  auth_source="/home/openclaw/.openclaw/agents/main/agent/openclaw-agent.sqlite"
  if [[ ! -f "$auth_source" ]]; then
    echo "No Anthropic key or reusable OpenClaw OAuth profile was found" >&2
    exit 2
  fi

  echo "Copying only the existing OpenAI auth profile into isolated agent stores"
  for agent_id in orchestrator implementer verifier; do
    agent_store_dir="/srv/taruu-agent/openclaw-state/agents/$agent_id/agent"
    agent_store="$agent_store_dir/openclaw-agent.sqlite"
    install -d -o taruu-agent -g taruu-agent -m 0750 "$agent_store_dir"
    sqlite3 "$auth_source" ".backup '$agent_store'"
    sqlite3 "$agent_store" '
      DELETE FROM cache_entries;
      DELETE FROM memory_embedding_cache;
      DELETE FROM memory_index_chunks;
      DELETE FROM memory_index_meta;
      DELETE FROM memory_index_sources;
      DELETE FROM memory_index_state;
      VACUUM;
    '
    chown taruu-agent:taruu-agent "$agent_store"
    chmod 0600 "$agent_store"
  done
  chown -R taruu-agent:taruu-agent \
    /srv/taruu-agent/openclaw-state/agents
fi

echo "Configuring Git and the canonical repository clone"
sudo -u taruu-agent -H bash -lc '
  set -euo pipefail
  export PATH=/usr/bin:/usr/local/bin:/bin
  set -a
  source /etc/taruu-agent/agent.env
  set +a
  gh auth setup-git
  if [[ -d /srv/taruu-agent/repo/.git ]]; then
    git -C /srv/taruu-agent/repo fetch origin main --prune
  else
    git clone https://github.com/Taruu-ShowYourselves/taruu-monorepo.git /srv/taruu-agent/repo
  fi
  git -C /srv/taruu-agent/repo config user.name "Taruu Delivery Agent"
  git -C /srv/taruu-agent/repo config user.email "taruu-agent@users.noreply.github.com"
'

echo "Installing the OpenClaw system service"
install -o root -g root -m 0644 \
  "$bundle_root/infra/agentic/systemd/taruu-openclaw.service" \
  /etc/systemd/system/taruu-openclaw.service
systemctl daemon-reload
systemctl enable taruu-openclaw.service

echo "Installing or reusing the self-hosted GitHub Actions runner"
runner_dir="/srv/taruu-agent/runner"
if [[ ! -f "$runner_dir/.runner" ]]; then
  runner_arch="x64"

  release_json="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest)"
  asset_json="$(
    jq -c --arg suffix "linux-${runner_arch}" \
      '[.assets[] | select(.name | contains($suffix)) | select(.name | endswith(".tar.gz"))][0]' \
      <<<"$release_json"
  )"
  runner_url="$(jq -r '.browser_download_url // empty' <<<"$asset_json")"
  runner_digest="$(jq -r '.digest // empty' <<<"$asset_json")"
  runner_archive="/tmp/actions-runner-${runner_arch}.tar.gz"
  if [[ -z "$runner_url" ]]; then
    echo "Could not resolve the latest GitHub Actions runner asset" >&2
    exit 1
  fi
  curl -fsSL "$runner_url" -o "$runner_archive"
  if [[ "$runner_digest" == sha256:* ]]; then
    printf '%s  %s\n' "${runner_digest#sha256:}" "$runner_archive" | sha256sum --check -
  fi
  tar -xzf "$runner_archive" -C "$runner_dir"
  chown -R taruu-runner:taruu-runner "$runner_dir"

  (
    cd "$runner_dir"
    sudo -u taruu-runner -H ./config.sh \
      --unattended \
      --replace \
      --url https://github.com/Taruu-ShowYourselves/taruu-monorepo \
      --token "$runner_registration_token" \
      --name "taruu-hetzner-$(hostname)" \
      --labels "taruu-agents" \
      --work _work
  )
fi
runner_service="$(
  find /etc/systemd/system \
    -maxdepth 1 \
    -name 'actions.runner.Taruu-ShowYourselves-taruu-monorepo.*.service' \
    -print \
    -quit
)"
if [[ -z "$runner_service" ]]; then
  (
    cd "$runner_dir"
    ./svc.sh install taruu-runner
  )
fi
(
  cd "$runner_dir"
  ./svc.sh start
)

echo "Validating and starting OpenClaw"
sudo -u taruu-agent -H bash -lc '
  set -euo pipefail
  export PATH=/usr/bin:/usr/local/bin:/bin
  set -a
  source /etc/taruu-agent/agent.env
  set +a
  [[ "$(openclaw config get gateway.mode)" == "local" ]]
  openclaw doctor --lint --json > /srv/taruu-agent/logs/doctor.json || true
  openclaw models status \
    --agent orchestrator \
    --check \
    --probe \
    --probe-provider '"$model_provider"' \
    --probe-max-tokens 1 \
    --probe-timeout 30000 \
    --json > /srv/taruu-agent/logs/model-probe.json
'
systemctl restart taruu-openclaw.service

ready=false
for _ in {1..90}; do
  if curl -fsS http://127.0.0.1:18790/readyz >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  systemctl --no-pager --full status taruu-openclaw.service || true
  journalctl -u taruu-openclaw.service -n 100 --no-pager || true
  exit 1
fi

sudo -u taruu-agent -H bash -lc '
  export PATH=/usr/bin:/usr/local/bin:/bin
  set -a
  source /etc/taruu-agent/agent.env
  set +a
  openclaw security audit --deep > /srv/taruu-agent/logs/security-audit.txt || true
  openclaw browser start --json > /srv/taruu-agent/logs/browser-start.json
  openclaw browser doctor --json > /srv/taruu-agent/logs/browser-doctor.json
'

unset gh_agent_token anthropic_api_key runner_registration_token
echo "Taruu agent host is ready"
echo "OpenClaw: loopback port 18790"
echo "Runner label: taruu-agents"
echo "Agent GitHub login: $agent_login"
