import { execFileSync } from 'node:child_process';

const SECTION_DEFINITIONS = [
  { key: 'problem', names: ['problem'] },
  { key: 'outcome', names: ['outcome', 'desired outcome'] },
  { key: 'context', names: ['context', 'background'] },
  { key: 'scope', names: ['scope'] },
  { key: 'requirements', names: ['requirements'] },
  {
    key: 'acceptance',
    names: ['acceptance criteria', 'acceptance criterion'],
  },
  {
    key: 'verification',
    names: ['verification plan', 'test plan', 'testing plan'],
  },
  {
    key: 'evidence',
    names: ['visual evidence', 'screenshots', 'evidence'],
  },
  {
    key: 'risks',
    names: ['risks and rollback', 'risks & rollback', 'rollback'],
  },
];

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  /\bCLOUDFLARE_API_TOKEN\s*=\s*\S+/i,
  /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i,
];

export function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      parsed._.push(value);
      continue;
    }

    const equalsIndex = value.indexOf('=');
    if (equalsIndex !== -1) {
      parsed[value.slice(2, equalsIndex)] = value.slice(equalsIndex + 1);
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }

  return parsed;
}

function normalizeHeading(value) {
  return value
    .toLowerCase()
    .replace(/[`*_:[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPrdSections(markdown) {
  const headingPattern = /^(#{2,3})[ \t]+(.+?)[ \t]*$/gm;
  const headings = [];
  let match;

  while ((match = headingPattern.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      name: normalizeHeading(match[2]),
      contentStart: headingPattern.lastIndex,
      headingStart: match.index,
    });
  }

  const sections = {};
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const definition = SECTION_DEFINITIONS.find((candidate) =>
      candidate.names.includes(heading.name),
    );
    if (!definition || sections[definition.key]) {
      continue;
    }

    const nextBoundary = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level);
    const end = nextBoundary?.headingStart ?? markdown.length;
    sections[definition.key] = markdown
      .slice(heading.contentStart, end)
      .trim();
  }

  return sections;
}

export function validatePrd(markdown) {
  const errors = [];
  const normalized = String(markdown ?? '').replace(/\r\n/g, '\n').trim();

  if (normalized.length < 500) {
    errors.push('The PRD is too short; provide implementation-level detail.');
  }

  const sections = extractPrdSections(normalized);
  for (const definition of SECTION_DEFINITIONS) {
    const content = sections[definition.key];
    if (!content) {
      errors.push(`Missing required section: ${definition.names[0]}.`);
      continue;
    }
    if (content.replace(/\s+/g, ' ').length < 20) {
      errors.push(`Section "${definition.names[0]}" needs more detail.`);
    }
  }

  if (sections.acceptance && !/- \[[ xX]\]\s+\S/.test(sections.acceptance)) {
    errors.push('Acceptance criteria must contain at least one task-list item.');
  }

  if (
    sections.scope &&
    !/out of scope|excluded|exclusions/i.test(sections.scope)
  ) {
    errors.push('Scope must explicitly state what is out of scope.');
  }

  if (
    sections.evidence &&
    !/(https?:\/\/|\/[A-Za-z0-9_[\]()./-]+|screen|route|page|not applicable)/i.test(
      sections.evidence,
    )
  ) {
    errors.push(
      'Visual evidence must name screens/routes or give a specific N/A reason.',
    );
  }

  if (SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    errors.push('The PRD appears to contain a secret or private key.');
  }

  return { valid: errors.length === 0, errors, sections };
}

export function runGh(args, options = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...options.env },
  }).trim();
}

export function repositoryParts(repository) {
  const [owner, name, extra] = String(repository).split('/');
  if (!owner || !name || extra) {
    throw new Error(`Invalid repository "${repository}"; expected owner/name.`);
  }
  return { owner, name };
}

export async function setProjectStatus({
  repository,
  issueNumber,
  projectOwner,
  projectNumber,
  status,
  assignee,
  addLabels = [],
  removeLabels = [],
}) {
  const { owner, name } = repositoryParts(repository);
  const query = `
    query(
      $repoOwner: String!,
      $repoName: String!,
      $issueNumber: Int!,
      $projectOwner: String!,
      $projectNumber: Int!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        issue(number: $issueNumber) {
          id
          url
          projectItems(first: 100) {
            nodes {
              id
              project { id number }
            }
          }
        }
      }
      organization(login: $projectOwner) {
        projectV2(number: $projectNumber) {
          id
          fields(first: 100) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const result = JSON.parse(
    runGh([
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      '-f',
      `repoOwner=${owner}`,
      '-f',
      `repoName=${name}`,
      '-F',
      `issueNumber=${Number(issueNumber)}`,
      '-f',
      `projectOwner=${projectOwner}`,
      '-F',
      `projectNumber=${Number(projectNumber)}`,
    ]),
  );

  const issue = result.data?.repository?.issue;
  const project = result.data?.organization?.projectV2;
  if (!issue) {
    throw new Error(`Issue #${issueNumber} was not found in ${repository}.`);
  }
  if (!project) {
    throw new Error(
      `Project #${projectNumber} was not found for ${projectOwner}.`,
    );
  }

  const statusField = project.fields.nodes.find(
    (field) => field?.name === 'Status',
  );
  const statusOption = statusField?.options?.find(
    (option) => option.name === status,
  );
  if (!statusField || !statusOption) {
    throw new Error(
      `Project status "${status}" does not exist in project #${projectNumber}.`,
    );
  }

  let itemId = issue.projectItems.nodes.find(
    (item) => item.project?.id === project.id,
  )?.id;

  if (!itemId) {
    const addMutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(
          input: { projectId: $projectId, contentId: $contentId }
        ) {
          item { id }
        }
      }
    `;
    const addResult = JSON.parse(
      runGh([
        'api',
        'graphql',
        '-f',
        `query=${addMutation}`,
        '-f',
        `projectId=${project.id}`,
        '-f',
        `contentId=${issue.id}`,
      ]),
    );
    itemId = addResult.data?.addProjectV2ItemById?.item?.id;
  }

  if (!itemId) {
    throw new Error(`Could not add issue #${issueNumber} to the project.`);
  }

  const updateMutation = `
    mutation(
      $projectId: ID!,
      $itemId: ID!,
      $fieldId: ID!,
      $optionId: String!
    ) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item { id }
      }
    }
  `;
  runGh([
    'api',
    'graphql',
    '-f',
    `query=${updateMutation}`,
    '-f',
    `projectId=${project.id}`,
    '-f',
    `itemId=${itemId}`,
    '-f',
    `fieldId=${statusField.id}`,
    '-f',
    `optionId=${statusOption.id}`,
  ]);

  const issueEditArgs = ['issue', 'edit', issue.url];
  if (assignee) {
    issueEditArgs.push('--add-assignee', assignee);
  }
  for (const label of addLabels) {
    issueEditArgs.push('--add-label', label);
  }
  for (const label of removeLabels) {
    issueEditArgs.push('--remove-label', label);
  }
  if (issueEditArgs.length > 3) {
    runGh(issueEditArgs);
  }

  return { issueUrl: issue.url, itemId, projectId: project.id, status };
}
