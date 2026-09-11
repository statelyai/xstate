import type {
  PropertyCoverage,
  PropertyCoverageDimension,
  PropertyEventCaseCounts,
  PropertyExplorationBounds
} from './propertyCoverage.ts';

/** Options for {@link formatPropertyCoverage}. */
export interface FormatPropertyCoverageOptions {
  /** `'text'` (default) renders plain text; `'markdown'` renders tables. */
  readonly format?: 'text' | 'markdown';
}

/** Options for {@link formatPropertyCoverageJUnit}. */
export interface FormatPropertyCoverageJUnitOptions {
  readonly suiteName?: string;
}

/** Options for {@link formatPropertyCoverageHTML}. */
export interface FormatPropertyCoverageHTMLOptions {
  readonly title?: string;
}

/** A JSON-safe summary of a single coverage dimension. */
export interface PropertyCoverageDimensionJSON {
  readonly total: number;
  readonly covered: number;
  readonly ratio: number;
  readonly counts: Record<string, number>;
  readonly coveredIds: string[];
  readonly uncovered: string[];
  readonly unreachable: string[];
  readonly unknown: string[];
}

/** The stable, versioned JSON representation of a {@link PropertyCoverage}. */
export interface PropertyCoverageJSON {
  readonly formatVersion: 1;
  readonly totals: {
    readonly runs: number;
    readonly steps: number;
    readonly skipped: number;
    readonly prefixSteps: number;
    readonly generatedSteps: number;
    readonly invariantChecks: number;
    readonly temporalChecks: number;
    readonly clockAdvances: number;
    readonly checkpoints: number;
    readonly stops: number;
    readonly sutComparisons: number;
    readonly oracleComparisons: number;
  };
  readonly dimensions: Record<string, PropertyCoverageDimensionJSON>;
  readonly guardOutcomes: Record<
    string,
    { readonly passed: number; readonly failed: number }
  >;
  readonly eventCases: Record<string, PropertyEventCaseCounts>;
  readonly dynamicTransitions: Record<
    string,
    {
      readonly hits: number;
      readonly observedTargetIds: string[];
      readonly outcomeCompleteness: string;
    }
  >;
  readonly temporal: {
    readonly satisfied: string[];
    readonly failed: string[];
    readonly inconclusive: string[];
  };
  readonly exploration: {
    readonly configuredRuns: number | null;
    readonly completedRuns: number;
    readonly attemptedRuns: number;
    readonly maximumSequenceLength: number | null;
    readonly maximumObservedSequenceLength: number;
    readonly truncated: boolean;
    readonly truncationReasons: string[];
    readonly frontiers: {
      readonly id: string;
      readonly prefixLength: number;
      readonly runBudget: number | null;
      readonly configuredRuns: number | null;
      readonly completedRuns: number;
      readonly attemptedRuns: number;
    }[];
    readonly seeds: {
      readonly frontierId: string;
      readonly engine: string | null;
      readonly seed: number | null;
      readonly path: string | null;
    }[];
  };
}

/** Thresholds accepted by {@link assertPropertyCoverage}. */
export type PropertyCoverageThresholds = {
  readonly [K in DimensionKey]?: number;
};

type DimensionKey =
  | 'states'
  | 'stateNodes'
  | 'configurations'
  | 'statuses'
  | 'eventTypes'
  | 'transitions'
  | 'guards'
  | 'transitionPairs'
  | 'requirements'
  | 'frontiers';

const DIMENSION_KEYS: readonly DimensionKey[] = [
  'states',
  'stateNodes',
  'configurations',
  'statuses',
  'eventTypes',
  'transitions',
  'guards',
  'transitionPairs',
  'requirements',
  'frontiers'
];

function getDimension(
  coverage: PropertyCoverage,
  key: DimensionKey
): PropertyCoverageDimension {
  return coverage[key];
}

function totalOf(dimension: PropertyCoverageDimension): number {
  return (
    dimension.covered.length +
    dimension.uncovered.length +
    dimension.unreachable.length +
    dimension.unknown.length
  );
}

function percentage(covered: number, total: number): string {
  if (!total) {
    return '100.0%';
  }
  return `${((covered / total) * 100).toFixed(1)}%`;
}

/**
 * Renders a coverage id in a human-readable form. Ids are stable JSON strings;
 * ids that are not recognized are rendered as-is.
 */
export function formatPropertyCoverageId(id: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(id);
  } catch {
    return id;
  }
  if (!Array.isArray(parsed)) {
    return id;
  }
  const [kind, ...rest] = parsed as unknown[];
  if (kind === 'transition' && rest.length === 3) {
    const [source, eventType, index] = rest as [string, string, unknown];
    return `${source} --${eventType}--> #${String(index)}`;
  }
  if (kind === 'guard' && rest.length === 1) {
    return `guard of ${formatPropertyCoverageId(String(rest[0]))}`;
  }
  if (kind === 'event-case' && rest.length === 2) {
    const [eventType, caseName] = rest as [string, string];
    return `${eventType} / ${caseName}`;
  }
  return id;
}

function dimensionLine(
  name: string,
  dimension: PropertyCoverageDimension
): string {
  const total = totalOf(dimension);
  const covered = dimension.covered.length;
  return (
    `${name}: ${covered}/${total} covered (${percentage(covered, total)}), ` +
    `${dimension.uncovered.length} uncovered, ` +
    `${dimension.unreachable.length} unreachable, ` +
    `${dimension.unknown.length} unknown`
  );
}

function explorationLines(exploration: PropertyExplorationBounds): string[] {
  const lines = [
    `runs: configured ${exploration.configuredRuns ?? 'n/a'}, ` +
      `completed ${exploration.completedRuns}, ` +
      `attempted ${exploration.attemptedRuns}`,
    `sequence length: max ${exploration.maximumSequenceLength ?? 'n/a'}, ` +
      `max observed ${exploration.maximumObservedSequenceLength}`,
    `truncated: ${exploration.truncated}${
      exploration.truncationReasons.length
        ? ` (${[...exploration.truncationReasons].sort().join(', ')})`
        : ''
    }`
  ];
  for (const frontier of exploration.frontiers) {
    lines.push(
      `frontier ${frontier.id}: prefix ${frontier.prefixLength}, ` +
        `budget ${frontier.runBudget ?? 'n/a'}, ` +
        `configured ${frontier.configuredRuns ?? 'n/a'}, ` +
        `completed ${frontier.completedRuns}, ` +
        `attempted ${frontier.attemptedRuns}`
    );
  }
  for (const seed of exploration.seeds) {
    lines.push(
      `seed ${seed.frontierId}: engine ${seed.engine ?? 'n/a'}, ` +
        `seed ${seed.seed ?? 'n/a'}, path ${seed.path ?? 'n/a'}`
    );
  }
  return lines;
}

function listLines(title: string, ids: readonly string[]): string[] {
  if (!ids.length) {
    return [];
  }
  return [
    `${title}:`,
    ...[...ids].sort().map((id) => `  - ${formatPropertyCoverageId(id)}`)
  ];
}

function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ];
}

function formatText(coverage: PropertyCoverage): string {
  const lines: string[] = ['Property coverage', ''];
  for (const key of DIMENSION_KEYS) {
    lines.push(dimensionLine(key, getDimension(coverage, key)));
  }
  lines.push('');
  for (const key of DIMENSION_KEYS) {
    const dimension = getDimension(coverage, key);
    lines.push(
      ...listLines(`uncovered ${key}`, dimension.uncovered),
      ...listLines(`unreachable ${key}`, dimension.unreachable),
      ...listLines(`unknown ${key}`, dimension.unknown)
    );
  }
  const guardOutcomes = Object.entries(coverage.guards.outcomes).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  if (guardOutcomes.length) {
    lines.push('guard outcomes:');
    for (const [id, outcome] of guardOutcomes) {
      lines.push(
        `  - ${formatPropertyCoverageId(id)}: ${outcome.passed} passed, ${
          outcome.failed
        } failed`
      );
    }
  }
  const eventCases = Object.entries(coverage.eventCases).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  if (eventCases.length) {
    lines.push('event cases:');
    for (const [id, counts] of eventCases) {
      lines.push(
        `  - ${formatPropertyCoverageId(id)}: ${counts.generated} generated, ${
          counts.applicable
        } applicable, ${counts.executed} executed, ${counts.ignored} ignored`
      );
    }
  }
  lines.push(
    `temporal: ${coverage.temporal.satisfied.length} satisfied, ${coverage.temporal.failed.length} failed, ${coverage.temporal.inconclusive.length} inconclusive`,
    ...listLines('  satisfied', coverage.temporal.satisfied),
    ...listLines('  failed', coverage.temporal.failed),
    ...listLines('  inconclusive', coverage.temporal.inconclusive),
    '',
    'exploration:',
    ...explorationLines(coverage.exploration).map((line) => `  ${line}`)
  );
  return lines.join('\n');
}

function formatMarkdown(coverage: PropertyCoverage): string {
  const lines: string[] = ['# Property coverage', ''];
  lines.push(
    ...markdownTable(
      [
        'Dimension',
        'Covered',
        'Total',
        'Ratio',
        'Uncovered',
        'Unreachable',
        'Unknown'
      ],
      DIMENSION_KEYS.map((key) => {
        const dimension = getDimension(coverage, key);
        const total = totalOf(dimension);
        return [
          key,
          String(dimension.covered.length),
          String(total),
          percentage(dimension.covered.length, total),
          String(dimension.uncovered.length),
          String(dimension.unreachable.length),
          String(dimension.unknown.length)
        ];
      })
    ),
    ''
  );

  const outstanding: string[][] = [];
  for (const key of DIMENSION_KEYS) {
    const dimension = getDimension(coverage, key);
    for (const status of ['uncovered', 'unreachable', 'unknown'] as const) {
      for (const id of [...dimension[status]].sort()) {
        outstanding.push([key, status, formatPropertyCoverageId(id)]);
      }
    }
  }
  lines.push('## Outstanding', '');
  if (outstanding.length) {
    lines.push(
      ...markdownTable(['Dimension', 'Status', 'Id'], outstanding),
      ''
    );
  } else {
    lines.push('Everything declared was covered.', '');
  }

  const guardOutcomes = Object.entries(coverage.guards.outcomes).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  if (guardOutcomes.length) {
    lines.push(
      '## Guard outcomes',
      '',
      ...markdownTable(
        ['Guard', 'Passed', 'Failed'],
        guardOutcomes.map(([id, outcome]) => [
          formatPropertyCoverageId(id),
          String(outcome.passed),
          String(outcome.failed)
        ])
      ),
      ''
    );
  }

  const eventCases = Object.entries(coverage.eventCases).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  if (eventCases.length) {
    lines.push(
      '## Event cases',
      '',
      ...markdownTable(
        ['Case', 'Generated', 'Applicable', 'Executed', 'Ignored'],
        eventCases.map(([id, counts]) => [
          formatPropertyCoverageId(id),
          String(counts.generated),
          String(counts.applicable),
          String(counts.executed),
          String(counts.ignored)
        ])
      ),
      ''
    );
  }

  lines.push(
    '## Temporal',
    '',
    ...markdownTable(
      ['Status', 'Count', 'Ids'],
      (['satisfied', 'failed', 'inconclusive'] as const).map((status) => [
        status,
        String(coverage.temporal[status].length),
        [...coverage.temporal[status]].sort().join('; ') || '-'
      ])
    ),
    '',
    '## Exploration',
    '',
    ...explorationLines(coverage.exploration).map((line) => `- ${line}`)
  );
  return lines.join('\n');
}

/** Formats a {@link PropertyCoverage} as human-readable text or markdown. */
export function formatPropertyCoverage(
  coverage: PropertyCoverage,
  options: FormatPropertyCoverageOptions = {}
): string {
  return options.format === 'markdown'
    ? formatMarkdown(coverage)
    : formatText(coverage);
}

function dimensionToJSON(
  dimension: PropertyCoverageDimension
): PropertyCoverageDimensionJSON {
  const total = totalOf(dimension);
  const covered = dimension.covered.length;
  return {
    total,
    covered,
    ratio: total ? covered / total : 1,
    counts: { ...dimension.counts },
    coveredIds: [...dimension.covered],
    uncovered: [...dimension.uncovered],
    unreachable: [...dimension.unreachable],
    unknown: [...dimension.unknown]
  };
}

/** Converts a {@link PropertyCoverage} to stable, versioned, JSON-safe data. */
export function propertyCoverageToJSON(
  coverage: PropertyCoverage
): PropertyCoverageJSON {
  const dimensions: Record<string, PropertyCoverageDimensionJSON> = {};
  for (const key of DIMENSION_KEYS) {
    dimensions[key] = dimensionToJSON(getDimension(coverage, key));
  }
  return {
    formatVersion: 1,
    totals: {
      runs: coverage.runs,
      steps: coverage.steps,
      skipped: coverage.skipped,
      prefixSteps: coverage.prefixSteps,
      generatedSteps: coverage.generatedSteps,
      invariantChecks: coverage.invariantChecks,
      temporalChecks: coverage.temporalChecks,
      clockAdvances: coverage.clockAdvances,
      checkpoints: coverage.checkpoints,
      stops: coverage.stops,
      sutComparisons: coverage.sutComparisons,
      oracleComparisons: coverage.oracleComparisons
    },
    dimensions,
    guardOutcomes: Object.fromEntries(
      Object.entries(coverage.guards.outcomes)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, outcome]) => [
          id,
          { passed: outcome.passed, failed: outcome.failed }
        ])
    ),
    eventCases: Object.fromEntries(
      Object.entries(coverage.eventCases)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, counts]) => [
          id,
          {
            weight: counts.weight,
            generated: counts.generated,
            applicable: counts.applicable,
            executed: counts.executed,
            ignored: counts.ignored
          }
        ])
    ),
    dynamicTransitions: Object.fromEntries(
      Object.entries(coverage.dynamicTransitions)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, dynamic]) => [
          id,
          {
            hits: dynamic.hits,
            observedTargetIds: [...dynamic.observedTargetIds],
            outcomeCompleteness: dynamic.outcomeCompleteness
          }
        ])
    ),
    temporal: {
      satisfied: [...coverage.temporal.satisfied],
      failed: [...coverage.temporal.failed],
      inconclusive: [...coverage.temporal.inconclusive]
    },
    exploration: {
      configuredRuns: coverage.exploration.configuredRuns,
      completedRuns: coverage.exploration.completedRuns,
      attemptedRuns: coverage.exploration.attemptedRuns,
      maximumSequenceLength: coverage.exploration.maximumSequenceLength,
      maximumObservedSequenceLength:
        coverage.exploration.maximumObservedSequenceLength,
      truncated: coverage.exploration.truncated,
      truncationReasons: [...coverage.exploration.truncationReasons],
      frontiers: coverage.exploration.frontiers.map((frontier) => ({
        id: frontier.id,
        prefixLength: frontier.prefixLength,
        runBudget: frontier.runBudget,
        configuredRuns: frontier.configuredRuns,
        completedRuns: frontier.completedRuns,
        attemptedRuns: frontier.attemptedRuns
      })),
      seeds: coverage.exploration.seeds.map((seed) => ({
        frontierId: seed.frontierId,
        engine: seed.engine ?? null,
        seed: seed.seed ?? null,
        path: seed.path ?? null
      }))
    }
  };
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a {@link PropertyCoverage} as JUnit XML, with one `<testcase>` per
 * transition and per state node.
 */
export function formatPropertyCoverageJUnit(
  coverage: PropertyCoverage,
  options: FormatPropertyCoverageJUnitOptions = {}
): string {
  const suiteName = options.suiteName ?? 'property-coverage';
  const cases: string[] = [];
  let tests = 0;
  let failures = 0;
  let skipped = 0;

  for (const key of ['transitions', 'stateNodes'] as const) {
    const dimension = getDimension(coverage, key);
    const entries: [
      string,
      'covered' | 'uncovered' | 'unreachable' | 'unknown'
    ][] = [
      ...dimension.covered.map((id) => [id, 'covered'] as [string, 'covered']),
      ...dimension.uncovered.map(
        (id) => [id, 'uncovered'] as [string, 'uncovered']
      ),
      ...dimension.unreachable.map(
        (id) => [id, 'unreachable'] as [string, 'unreachable']
      ),
      ...dimension.unknown.map((id) => [id, 'unknown'] as [string, 'unknown'])
    ];
    entries.sort(([left], [right]) => left.localeCompare(right));
    for (const [id, status] of entries) {
      tests++;
      const name = escapeXML(formatPropertyCoverageId(id));
      if (status === 'covered') {
        cases.push(`    <testcase classname="${key}" name="${name}" />`);
      } else if (status === 'uncovered') {
        failures++;
        cases.push(
          `    <testcase classname="${key}" name="${name}">\n` +
            `      <failure message="uncovered" type="uncovered" />\n` +
            `    </testcase>`
        );
      } else {
        skipped++;
        cases.push(
          `    <testcase classname="${key}" name="${name}">\n` +
            `      <skipped message="${status}" />\n` +
            `    </testcase>`
        );
      }
    }
  }

  const properties = explorationLines(coverage.exploration).map(
    (line, index) =>
      `      <property name="exploration.${index}" value="${escapeXML(
        line
      )}" />`
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<testsuites>',
    `  <testsuite name="${escapeXML(
      suiteName
    )}" tests="${tests}" failures="${failures}" skipped="${skipped}">`,
    '    <properties>',
    ...properties,
    '    </properties>',
    ...cases,
    '  </testsuite>',
    '</testsuites>',
    ''
  ].join('\n');
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formats a {@link PropertyCoverage} as a self-contained HTML document. */
export function formatPropertyCoverageHTML(
  coverage: PropertyCoverage,
  options: FormatPropertyCoverageHTMLOptions = {}
): string {
  const title = options.title ?? 'Property coverage';
  const cards = DIMENSION_KEYS.map((key) => {
    const dimension = getDimension(coverage, key);
    const total = totalOf(dimension);
    return (
      `<div class="card"><h2>${escapeHTML(key)}</h2>` +
      `<p class="ratio">${dimension.covered.length}/${total} (${percentage(
        dimension.covered.length,
        total
      )})</p>` +
      `<p class="detail">${dimension.uncovered.length} uncovered, ` +
      `${dimension.unreachable.length} unreachable, ` +
      `${dimension.unknown.length} unknown</p></div>`
    );
  }).join('');

  const rows: string[] = [];
  for (const key of DIMENSION_KEYS) {
    const dimension = getDimension(coverage, key);
    for (const status of ['uncovered', 'unreachable', 'unknown'] as const) {
      for (const id of [...dimension[status]].sort()) {
        rows.push(
          `<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(
            status
          )}</td><td>${escapeHTML(formatPropertyCoverageId(id))}</td></tr>`
        );
      }
    }
  }

  const explorationItems = explorationLines(coverage.exploration)
    .map((line) => `<li>${escapeHTML(line)}</li>`)
    .join('');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${escapeHTML(title)}</title>`,
    '<style>',
    'body{font-family:system-ui,sans-serif;margin:2rem;color:#111;background:#fff}',
    '.cards{display:flex;flex-wrap:wrap;gap:1rem}',
    '.card{border:1px solid #ddd;border-radius:8px;padding:1rem;min-width:12rem}',
    '.card h2{font-size:.9rem;margin:0 0 .5rem;text-transform:uppercase}',
    '.ratio{font-size:1.4rem;margin:0}',
    '.detail{color:#555;font-size:.8rem;margin:.25rem 0 0}',
    'table{border-collapse:collapse;margin-top:1rem;width:100%}',
    'th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left;font-size:.85rem}',
    '</style>',
    '</head>',
    '<body>',
    `<h1>${escapeHTML(title)}</h1>`,
    `<p>${coverage.runs} runs, ${coverage.steps} steps, ${coverage.invariantChecks} invariant checks</p>`,
    `<div class="cards">${cards}</div>`,
    '<h2>Outstanding</h2>',
    rows.length
      ? `<table><thead><tr><th>Dimension</th><th>Status</th><th>Id</th></tr></thead><tbody>${rows.join(
          ''
        )}</tbody></table>`
      : '<p>Everything declared was covered.</p>',
    '<h2>Temporal</h2>',
    `<p>${coverage.temporal.satisfied.length} satisfied, ${coverage.temporal.failed.length} failed, ${coverage.temporal.inconclusive.length} inconclusive</p>`,
    '<h2>Exploration</h2>',
    `<ul>${explorationItems}</ul>`,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

/**
 * Throws an `Error` containing the formatted coverage text when any dimension's
 * covered ratio — `covered / (covered + uncovered)` — is below its threshold.
 * Thresholds are ratios between `0` and `1`.
 */
export function assertPropertyCoverage(
  coverage: PropertyCoverage,
  thresholds: PropertyCoverageThresholds
): void {
  const failures: string[] = [];
  for (const key of DIMENSION_KEYS) {
    const threshold = thresholds[key];
    if (threshold === undefined) {
      continue;
    }
    const dimension = getDimension(coverage, key);
    const considered = dimension.covered.length + dimension.uncovered.length;
    const ratio = considered ? dimension.covered.length / considered : 1;
    if (ratio < threshold) {
      failures.push(
        `${key}: ${percentage(
          dimension.covered.length,
          considered
        )} covered, below the ${percentage(threshold, 1)} threshold`
      );
    }
  }
  if (failures.length) {
    throw new Error(
      `Property coverage thresholds not met:\n${failures
        .map((failure) => `  - ${failure}`)
        .join('\n')}\n\n${formatPropertyCoverage(coverage)}`
    );
  }
}
