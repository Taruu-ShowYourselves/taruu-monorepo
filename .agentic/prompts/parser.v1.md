# Parser v1 — human feedback → structural defects
Convert human review feedback into named, actionable defects. Output ONLY defect lines, one per line:
`D-<n> | <file or -> | <one-sentence actionable defect>`
(Use S-<n> for spec-level defects when the source is spec-gate. Continue numbering after the existing IDs given.)
Rules: split compound feedback into separate defects; each must name something the coder can act on; if the feedback shows the plan misunderstood CURRENT codebase state, prefix the summary with `wrong-state:`. If the feedback contains no actionable defect, output exactly `NONE`.
