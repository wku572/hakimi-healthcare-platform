import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const allowedDispositions = new Set([
  'AS-BUILT FACT',
  'CANDIDATE LONG-TERM REQUIREMENT',
  'CANDIDATE ARCHITECTURE DECISION',
  'OPEN STAKEHOLDER DECISION',
]);

const allowedStatuses = new Set([
  'PROPOSED',
  'VERIFIED',
  'IMPLEMENTED',
  'OPEN DECISION',
  'PLANNED',
  'REJECTED',
  'CONTRADICTED',
  'DEPRECATED',
]);

const allowedDiscoveryActions = new Set([
  'PRESERVED',
  'MERGED',
  'RECLASSIFIED',
  'REMOVED AS DISPROVED',
]);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function normalizeTableMarker(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function parseMarkdownTable(markdown, headerMarker) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => normalizeTableMarker(line) === normalizeTableMarker(headerMarker),
  );
  if (headerIndex === -1) {
    throw new Error(`Missing table header: ${headerMarker}`);
  }

  const tableLines = [];
  for (let index = headerIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      if (tableLines.length > 0) break;
      continue;
    }
    if (!line.includes('|')) {
      if (tableLines.length > 0) break;
      continue;
    }
    tableLines.push(line);
  }

  if (tableLines.length < 2) {
    throw new Error(`No rows found under table header: ${headerMarker}`);
  }

  const headers = tableLines[0]
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of tableLines.slice(2)) {
    const cells = line
      .split('|')
      .map((value) => value.trim())
      .filter((value, index, array) => {
        if (index === 0 && value === '') return false;
        if (index === array.length - 1 && value === '') return false;
        return true;
      });

    if (cells.length === 0) {
      continue;
    }

    if (cells.length !== headers.length) {
      throw new Error(
        `Table row has ${cells.length} cells, expected ${headers.length}: ${line}`,
      );
    }

    rows.push(
      Object.fromEntries(
        headers.map((header, index) => [header, cells[index]]),
      ),
    );
  }

  return { headers, rows };
}

function normalizeLinkTarget(target) {
  return target.split('#')[0].trim();
}

function validateInternalLinks(files) {
  let brokenLinkCount = 0;

  for (const file of files) {
    const content = readFile(file);
    const baseDir = path.dirname(path.join(repoRoot, file));
    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;

    while ((match = linkPattern.exec(content))) {
      const target = match[1].trim();
      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:') ||
        target.startsWith('node:')
      ) {
        continue;
      }

      const normalized = normalizeLinkTarget(target);
      if (!normalized || normalized.startsWith('#')) {
        continue;
      }

      const resolved = path.resolve(baseDir, normalized);
      if (!resolved.startsWith(repoRoot)) {
        throw new Error(`Link escapes repository root in ${file}: ${target}`);
      }

      if (!fs.existsSync(resolved)) {
        throw new Error(`Broken internal link in ${file}: ${target}`);
      }
    }
  }

  return brokenLinkCount;
}

function validateDiscoveryReconciliation(canonicalIds) {
  const markdown = readFile('docs/REQUIREMENTS.md');
  const { headers, rows } = parseMarkdownTable(
    markdown,
    '| Discovery ID | Title | Implemented ID | Action | Evidence-based reason |',
  );

  for (const header of [
    'Discovery ID',
    'Title',
    'Implemented ID',
    'Action',
    'Evidence-based reason',
  ]) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required discovery field: ${header}`);
    }
  }

  if (rows.length !== 24) {
    throw new Error(
      `Discovery reconciliation must contain 24 rows, found ${rows.length}`,
    );
  }

  const discoveryIds = new Set();
  const implementedIds = new Set();

  for (const row of rows) {
    if (
      !row['Discovery ID'] ||
      !row.Title ||
      !row['Implemented ID'] ||
      !row.Action
    ) {
      throw new Error(
        `Missing discovery reconciliation field: ${JSON.stringify(row)}`,
      );
    }

    if (!allowedDiscoveryActions.has(row.Action)) {
      throw new Error(
        `Invalid discovery action for ${row['Discovery ID']}: ${row.Action}`,
      );
    }

    if (discoveryIds.has(row['Discovery ID'])) {
      throw new Error(`Duplicate discovery ID: ${row['Discovery ID']}`);
    }
    discoveryIds.add(row['Discovery ID']);

    const mappedIds = row['Implemented ID']
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    for (const id of mappedIds) {
      if (!canonicalIds.has(id)) {
        throw new Error(
          `Discovery record ${row['Discovery ID']} references missing canonical ID: ${id}`,
        );
      }
      implementedIds.add(id);
    }
  }

  const unreconciledIds = [...canonicalIds].filter(
    (id) => !implementedIds.has(id),
  );
  if (unreconciledIds.length > 0) {
    throw new Error(
      `Canonical IDs missing from discovery reconciliation: ${unreconciledIds.join(', ')}`,
    );
  }

  return rows.length;
}

function validateRequirements() {
  const markdown = readFile('docs/REQUIREMENTS.md');
  const { headers, rows } = parseMarkdownTable(
    markdown,
    '| ID | Title | Primary classification | Status | Confidence | Disposition | Observed behavior | Exact source path and symbol | Exact migration object when applicable | Exact test file, suite, and test name when applicable | Originating commit/sprint or not determined | Limitation or contradiction | Stakeholder decision | Recommended next status | Proposed normative wording only when promotion is justified |',
  );

  for (const header of [
    'ID',
    'Title',
    'Primary classification',
    'Status',
    'Confidence',
    'Disposition',
    'Observed behavior',
    'Exact source path and symbol',
    'Exact migration object when applicable',
    'Exact test file, suite, and test name when applicable',
    'Originating commit/sprint or not determined',
    'Limitation or contradiction',
    'Stakeholder decision',
    'Recommended next status',
    'Proposed normative wording only when promotion is justified',
  ]) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required register field: ${header}`);
    }
  }

  const ids = new Map();
  let confirmedCount = 0;

  for (const row of rows) {
    const id = row.ID;
    const classification = row['Primary classification'];
    const status = row.Status;
    const disposition = row.Disposition;

    if (!id || !classification || !status || !disposition) {
      throw new Error(
        `Missing required register field on row: ${JSON.stringify(row)}`,
      );
    }

    ids.set(id, (ids.get(id) ?? 0) + 1);

    if (!/^([A-Z]+)-\d+$/.test(id)) {
      throw new Error(`Invalid requirement ID format: ${id}`);
    }

    const prefix = id.split('-')[0];
    if (prefix !== classification) {
      throw new Error(`Prefix mismatch for ${id}: ${classification}`);
    }

    if (!allowedStatuses.has(status)) {
      throw new Error(`Invalid status for ${id}: ${status}`);
    }

    if (status === 'CONFIRMED') {
      confirmedCount += 1;
    }

    if (!allowedDispositions.has(disposition)) {
      throw new Error(`Invalid disposition for ${id}: ${disposition}`);
    }
  }

  for (const [id, count] of ids) {
    if (count !== 1) {
      throw new Error(`Duplicate requirement ID detected: ${id}`);
    }
  }

  if (confirmedCount > 0) {
    throw new Error(`Confirmed requirement not allowed: ${confirmedCount}`);
  }

  return {
    canonicalRecordCount: rows.length,
    uniqueIdCount: ids.size,
    confirmedCount,
    ids: new Set(ids.keys()),
  };
}

function collectFiles(directory, predicate) {
  const results = [];
  const entries = fs.readdirSync(path.join(repoRoot, directory), {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const relative = path.posix.join(directory.replace(/\\/g, '/'), entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(relative, predicate));
    } else if (predicate(relative)) {
      results.push(relative);
    }
  }

  return results;
}

function normalizeApiPath(pathname) {
  return pathname.replace(/\{([^}]+)\}/g, ':$1');
}

function buildOperationKey(method, pathname) {
  return `${method.toUpperCase()} ${pathname}`;
}

function extractTraceabilitySymbol(value) {
  return value.replace(/`/g, '').split('::').pop().trim();
}

function parseOpenApiOperations() {
  const lines = readFile('apps/api/openapi.yaml').split(/\r?\n/);
  const operations = [];
  let currentPath = null;
  let currentMethod = null;
  let currentIndent = null;

  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = null;
      currentIndent = 2;
      continue;
    }

    const methodMatch = line.match(/^    (get|post|patch|delete):\s*$/);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toUpperCase();
      currentIndent = 4;
      continue;
    }

    const operationIdMatch = line.match(/^      operationId:\s*([^\s]+)\s*$/);
    if (
      operationIdMatch &&
      currentPath &&
      currentMethod &&
      currentIndent === 4
    ) {
      operations.push({
        method: currentMethod,
        path: normalizeApiPath(currentPath),
        operationId: operationIdMatch[1],
      });
    }
  }

  return operations;
}

function parseExpressOperations() {
  const operations = [];
  const appSource = readFile('apps/api/src/app.ts');

  for (const match of appSource.matchAll(
    /app\.get\(\s*(['"])([^'"]+)\1\s*,/g,
  )) {
    operations.push({
      method: 'GET',
      path: match[2],
      symbol: `createApp / app.get('${match[2]}')`,
    });
  }

  const mountPattern =
    /app\.use\(\s*(['"])([^'"]+)\1\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  const mounts = [];
  for (const match of appSource.matchAll(mountPattern)) {
    mounts.push({ basePath: match[2], routerVariable: match[3] });
  }

  const routerFiles = collectFiles('apps/api/src', (file) =>
    file.endsWith('/router.ts'),
  );
  for (const routerFile of routerFiles) {
    const source = readFile(routerFile);
    const factoryMatch = source.match(
      /export\s+(?:const|function)\s+([A-Za-z0-9_]+)\s*(?:=|\()/,
    );
    const factoryName =
      factoryMatch?.[1] ?? path.basename(path.dirname(routerFile));
    const resourceName = path.basename(path.dirname(routerFile));
    const expectedVariableName = `${resourceName}Router`;
    const mount = mounts.find(
      (candidate) =>
        candidate.routerVariable === expectedVariableName ||
        candidate.routerVariable.toLowerCase() ===
          expectedVariableName.toLowerCase(),
    );

    if (!mount) {
      continue;
    }

    const routePattern = /router\.(get|post|patch|delete)\(\s*(['"])(.*?)\2/gms;
    for (const match of source.matchAll(routePattern)) {
      const method = match[1].toUpperCase();
      const subPath = match[3];
      const fullPath = normalizeJoinedPath(mount.basePath, subPath);
      operations.push({
        method,
        path: fullPath,
        symbol: `${factoryName} / router.${match[1]}('${subPath}')`,
      });
    }
  }

  return operations;
}

function normalizeJoinedPath(basePath, subPath) {
  const raw = `${basePath.replace(/\/$/, '')}/${subPath.replace(/^\//, '')}`;
  const collapsed = raw.replace(/\/+/g, '/');
  return collapsed.endsWith('/') && collapsed.length > 1
    ? collapsed.slice(0, -1)
    : collapsed;
}

function parseTraceability() {
  const markdown = readFile('docs/TRACEABILITY.md');
  const { headers, rows } = parseMarkdownTable(
    markdown,
    '| Method | Path | OpenAPI | Express | Canonical ID | Test | Result |',
  );

  for (const header of [
    'Method',
    'Path',
    'OpenAPI',
    'Express',
    'Canonical ID',
    'Test',
    'Result',
  ]) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required traceability field: ${header}`);
    }
  }

  return rows;
}

function validateTraceability(
  openApiOperations,
  expressOperations,
  canonicalIds,
) {
  const rows = parseTraceability();
  const openApiMap = new Map();
  const expressMap = new Map();

  for (const operation of openApiOperations) {
    const key = buildOperationKey(operation.method, operation.path);
    if (openApiMap.has(key)) {
      throw new Error(`Duplicate OpenAPI operation detected: ${key}`);
    }
    openApiMap.set(key, operation);
  }

  for (const operation of expressOperations) {
    const key = buildOperationKey(operation.method, operation.path);
    if (expressMap.has(key)) {
      throw new Error(`Duplicate Express operation detected: ${key}`);
    }
    expressMap.set(key, operation);
  }

  const mappedKeys = new Set();
  let mappedCount = 0;

  for (const row of rows) {
    const key = buildOperationKey(row.Method, row.Path);
    const openApiOperation = openApiMap.get(key);
    const expressOperation = expressMap.get(key);

    if (!openApiOperation) {
      throw new Error(
        `Traceability references missing OpenAPI operation: ${key}`,
      );
    }

    if (!expressOperation) {
      throw new Error(
        `Traceability references missing Express operation: ${key}`,
      );
    }

    if (row.OpenAPI !== openApiOperation.operationId) {
      throw new Error(
        `OpenAPI operation mismatch for ${key}: expected ${openApiOperation.operationId}, found ${row.OpenAPI}`,
      );
    }

    if (extractTraceabilitySymbol(row.Express) !== expressOperation.symbol) {
      throw new Error(
        `Express symbol mismatch for ${key}: expected ${expressOperation.symbol}, found ${row.Express}`,
      );
    }

    if (!row['Canonical ID'] || !row.Test || !row.Result) {
      throw new Error(
        `Missing traceability field on row: ${JSON.stringify(row)}`,
      );
    }

    if (!canonicalIds.has(row['Canonical ID'])) {
      throw new Error(
        `Traceability references missing canonical ID for ${key}: ${row['Canonical ID']}`,
      );
    }

    mappedKeys.add(key);
    mappedCount += 1;
  }

  const contractOnly = [...openApiMap.keys()].filter(
    (key) => !expressMap.has(key),
  );
  const implementationOnly = [...expressMap.keys()].filter(
    (key) => !openApiMap.has(key),
  );

  if (contractOnly.length > 0 || implementationOnly.length > 0) {
    throw new Error(
      `Public API operation mismatch: contract-only=${contractOnly.length}, implementation-only=${implementationOnly.length}`,
    );
  }

  if (mappedCount !== rows.length) {
    throw new Error(
      `Mapped operation count mismatch: ${mappedCount} rows=${rows.length}`,
    );
  }

  return {
    openApiCount: openApiOperations.length,
    expressCount: expressOperations.length,
    mappedCount,
  };
}

function main() {
  const requirementSummary = validateRequirements();
  const discoveryCount = validateDiscoveryReconciliation(
    requirementSummary.ids,
  );
  const openApiOperations = parseOpenApiOperations();
  const expressOperations = parseExpressOperations();
  const traceabilitySummary = validateTraceability(
    openApiOperations,
    expressOperations,
    requirementSummary.ids,
  );
  const brokenLinkCount = validateInternalLinks([
    'docs/README.md',
    'docs/PRODUCT_VISION.md',
    'docs/CURRENT_SYSTEM.md',
    'docs/REQUIREMENTS.md',
    'docs/PRODUCT_BACKLOG.md',
    'docs/DECISIONS.md',
    'docs/OPEN_DECISIONS.md',
    'docs/TRACEABILITY.md',
  ]);

  console.log(`Discovery record count: ${discoveryCount}`);
  console.log(
    `Canonical record count: ${requirementSummary.canonicalRecordCount}`,
  );
  console.log(`Unique ID count: ${requirementSummary.uniqueIdCount}`);
  console.log(`OpenAPI operation count: ${traceabilitySummary.openApiCount}`);
  console.log(`Express operation count: ${traceabilitySummary.expressCount}`);
  console.log(`Mapped operation count: ${traceabilitySummary.mappedCount}`);
  console.log(`Broken-link count: ${brokenLinkCount}`);
  console.log(`CONFIRMED-record count: ${requirementSummary.confirmedCount}`);
  console.log('Product baseline documentation validation passed.');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
  process.exit(1);
}
