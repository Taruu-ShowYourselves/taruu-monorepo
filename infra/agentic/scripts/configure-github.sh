#!/usr/bin/env bash
set -euo pipefail

repository="Taruu-ShowYourselves/taruu-monorepo"
project_owner="Taruu-ShowYourselves"
project_number="2"
apply=false

if [[ "${1:-}" == "--apply" ]]; then
  apply=true
elif [[ -n "${1:-}" ]]; then
  echo "usage: configure-github.sh [--apply]" >&2
  exit 2
fi

if [[ "$apply" != true ]]; then
  echo "Dry run only. This will:"
  echo "- create agent lifecycle labels"
  echo "- remove the legacy agent:ready dispatch label"
  echo "- enable repository auto-merge and merged-branch deletion"
  echo "- set non-secret agent repository variables"
  echo "- protect main with one fresh human approval and Agent verification"
  echo
  echo "Run after these workflow files are on main:"
  echo "  infra/agentic/scripts/configure-github.sh --apply"
  exit 0
fi

echo "Configuring repository merge behavior"
gh api \
  --method PATCH \
  "repos/$repository" \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true \
  --silent

echo "Creating lifecycle labels"
while IFS='|' read -r name color description; do
  gh label create "$name" \
    --repo "$repository" \
    --color "$color" \
    --description "$description" \
    --force
done <<'LABELS'
agent:running|1d76db|Agent implementation or correction is in progress
agent:blocked|b60205|Agent needs human input or an external fix
agent:review|5319e7|Verified agent PR is waiting for human review
agent:merged|8250df|Approved agent PR merged; deployment is owned by Actions
agent:deployed|0e8a16|Production deployment completed
agent:deploy-failed|b60205|Production deployment failed
LABELS
gh label delete agent:ready --repo "$repository" --yes 2>/dev/null || true

echo "Setting non-secret repository variables"
gh variable set AGENT_PROJECT_OWNER --repo "$repository" --body "$project_owner"
gh variable set AGENT_PROJECT_NUMBER --repo "$repository" --body "$project_number"
gh variable set AGENT_OWNER_DOLEV --repo "$repository" --body "DolevSeren"
gh variable set AGENT_OWNER_SAHAR --repo "$repository" --body "SaharBarak"
gh variable set AGENT_RUNNER_LABEL_DOLEV \
  --repo "$repository" \
  --body "taruu-owner-dolevseren"
gh variable set AGENT_RUNNER_LABEL_SAHAR \
  --repo "$repository" \
  --body "taruu-owner-saharbarak"
gh variable set AGENT_REVIEWERS --repo "$repository" --body "DolevSeren"
gh variable set AGENT_AUTHORIZED_ACTORS \
  --repo "$repository" \
  --body "SaharBarak,DolevSeren"

ruleset_name="Agent delivery gate"
ruleset_payload="$(mktemp /tmp/taruu-ruleset.XXXXXX.json)"
jq -n \
  --arg name "$ruleset_name" \
  '{
    name: $name,
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: []
      }
    },
    bypass_actors: [],
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_linear_history" },
      {
        type: "pull_request",
        parameters: {
          allowed_merge_methods: ["squash"],
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: true,
          required_approving_review_count: 1,
          required_review_thread_resolution: true
        }
      },
      {
        type: "required_status_checks",
        parameters: {
          do_not_enforce_on_create: true,
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: "Agent verification" }
          ]
        }
      }
    ]
  }' >"$ruleset_payload"

existing_ruleset_id="$(
  gh api "repos/$repository/rulesets" \
    --jq ".[] | select(.name == \"$ruleset_name\") | .id" \
    | head -n 1
)"
if [[ -n "$existing_ruleset_id" ]]; then
  echo "Updating main-branch delivery ruleset"
  gh api \
    --method PUT \
    "repos/$repository/rulesets/$existing_ruleset_id" \
    --input "$ruleset_payload" \
    --silent
else
  echo "Creating main-branch delivery ruleset"
  gh api \
    --method POST \
    "repos/$repository/rulesets" \
    --input "$ruleset_payload" \
    --silent
fi
rm -f "$ruleset_payload"

echo "Checking required deployment credential"
if ! gh secret list --repo "$repository" | awk '{print $1}' | grep -qx CLOUDFLARE_API_TOKEN; then
  echo "MISSING: CLOUDFLARE_API_TOKEN"
  echo "Set it with: gh secret set CLOUDFLARE_API_TOKEN --repo $repository"
fi

echo "GitHub control plane configured"
