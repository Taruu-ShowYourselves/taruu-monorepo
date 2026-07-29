---
name: dispatch-prd
description: Turn the current Claude session into a complete implementation PRD, create a GitHub issue, and add it to the delivery project for manual In Progress dispatch.
argument-hint: "[short issue title]"
disable-model-invocation: true
allowed-tools:
  - Bash(gh *)
  - Bash(node scripts/agentic/create-issue.mjs *)
  - Read
  - Write
---

# Dispatch a PRD to the agent workflow

Use the current conversation as the source of truth. `$ARGUMENTS` is a title
hint, not a replacement for the requirements discussed in the session.

1. Read `prd-template.md` beside this file.
2. Draft a complete PRD at a temporary path outside the repository. Do not
   leave a generated PRD in the working tree.
3. Resolve ambiguity from the session with conservative, explicit assumptions.
   If a missing decision would materially change scope, ask the user before
   creating the issue.
4. Every acceptance criterion must be objectively testable.
5. The verification plan must name the commands, routes, screens, and states
   the delivery agents must verify. For non-visual work, say why visual evidence
   is not applicable.
6. Validate and create the issue:

   ```bash
   node scripts/agentic/create-issue.mjs \
     --title "<concise title>" \
     --body-file "<temporary PRD path>"
   ```

7. Report the issue URL and tell the user that the card is waiting in **Todo**.
   Moving the Project #2 card to **In Progress** is the only implementation
   dispatch signal. Do not call OpenClaw or move the card yourself.

Never include API keys, tokens, private credentials, raw production data, or
personal identity documents in the PRD.
