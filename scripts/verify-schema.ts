/**
 * verify-schema.ts
 * -----------------------------------------------------------------------------
 * READ-ONLY verification that the live database (DATABASE_URL) matches the
 * consolidated migrations in /migrations (001..NNN, excluding _archive/).
 *
 * It parses every CREATE TABLE / CREATE TYPE ... AS ENUM / CREATE [UNIQUE] INDEX
 * in the consolidated migrations to build the EXPECTED schema, then introspects
 * the live database (information_schema + pg_catalog) and reports, per table:
 *   - missing tables / extra tables
 *   - missing columns / extra columns
 *   - base type (udt) mismatches            [ERROR]
 *   - nullability mismatches                 [ERROR]
 *   - varchar length / numeric precision     [WARN]
 *   - default value differences              [WARN]
 * Plus enum value coverage and index presence.
 *
 * The script issues ONLY SELECT statements — it never modifies the database.
 *
 * Usage:
 *   npx ts-node scripts/verify-schema.ts            # uses process.env.DATABASE_URL
 *   DATABASE_URL=... npx ts-node scripts/verify-schema.ts
 *   npx ts-node scripts/verify-schema.ts --url postgresql://...
 *
 * Exit code 0 when there are no ERRORs (warnings allowed), 1 otherwise.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ExpectedColumn {
  name: string;
  rawType: string;
  udt: string; // normalized to pg udt_name convention (uuid, varchar, int4, _text, <enum>, ...)
  length: number | null; // varchar length
  precision: number | null; // numeric precision
  scale: number | null; // numeric scale
  nullable: boolean;
  default: string | null;
  table: string;
  file: string;
}
interface ExpectedTable {
  name: string;
  columns: Map<string, ExpectedColumn>;
  file: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL parsing helpers
// ─────────────────────────────────────────────────────────────────────────────
function stripSqlComments(sql: string): string {
  // remove -- line comments and /* */ block comments
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Extract a balanced (...) body starting at the index of the opening paren. */
function extractBalanced(sql: string, openIdx: number): { body: string; end: number } {
  let depth = 0;
  for (let i = openIdx; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return { body: sql.slice(openIdx + 1, i), end: i };
    }
  }
  throw new Error('Unbalanced parentheses while parsing CREATE TABLE');
}

/** Split a CREATE TABLE body into top-level definitions (respecting nested parens). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const CONSTRAINT_STARTS = /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i;
const COLUMN_STOPWORDS = new Set([
  'NOT', 'NULL', 'DEFAULT', 'REFERENCES', 'CHECK', 'UNIQUE', 'PRIMARY',
  'GENERATED', 'COLLATE', 'CONSTRAINT',
]);

function normalizeType(
  rawIn: string,
  enumNames: Set<string>,
): { udt: string; length: number | null; precision: number | null; scale: number | null } {
  let raw = rawIn.trim();
  let isArray = false;
  if (/\[\s*\]$/.test(raw)) {
    isArray = true;
    raw = raw.replace(/\[\s*\]$/, '').trim();
  }
  const upper = raw.toUpperCase();
  const base = upper.replace(/\(.*\)/, '').trim();

  // length / precision
  let length: number | null = null;
  let precision: number | null = null;
  let scale: number | null = null;
  const paren = raw.match(/\(([^)]*)\)/);
  if (paren) {
    const nums = paren[1].split(',').map((s) => parseInt(s.trim(), 10));
    if (/VARCHAR|CHARACTER VARYING|CHAR/.test(base)) length = nums[0] ?? null;
    if (/NUMERIC|DECIMAL/.test(base)) {
      precision = nums[0] ?? null;
      scale = nums[1] ?? null;
    }
  }

  const map: Record<string, string> = {
    'UUID': 'uuid',
    'TEXT': 'text',
    'BOOLEAN': 'bool',
    'BOOL': 'bool',
    'INTEGER': 'int4',
    'INT': 'int4',
    'INT4': 'int4',
    'BIGINT': 'int8',
    'INT8': 'int8',
    'SMALLINT': 'int2',
    'INT2': 'int2',
    'NUMERIC': 'numeric',
    'DECIMAL': 'numeric',
    'JSONB': 'jsonb',
    'JSON': 'json',
    'DATE': 'date',
    'VARCHAR': 'varchar',
    'CHARACTER VARYING': 'varchar',
    'CHAR': 'bpchar',
    'TIMESTAMPTZ': 'timestamptz',
    'TIMESTAMP WITH TIME ZONE': 'timestamptz',
    'TIMESTAMP': 'timestamp',
    'TIMESTAMP WITHOUT TIME ZONE': 'timestamp',
  };

  let udt: string;
  if (enumNames.has(base.toLowerCase())) udt = base.toLowerCase();
  else if (map[base]) udt = map[base];
  else udt = base.toLowerCase().replace(/\s+/g, '_'); // unknown fallback

  if (isArray) udt = '_' + udt;
  return { udt, length, precision, scale };
}

function parseColumnDef(
  def: string,
  table: string,
  file: string,
  enumNames: Set<string>,
): ExpectedColumn | null {
  if (CONSTRAINT_STARTS.test(def)) return null;
  // column name (optionally quoted)
  const nameMatch = def.match(/^\s*"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+(.*)$/s);
  if (!nameMatch) return null;
  const name = nameMatch[1].toLowerCase();
  const rest = nameMatch[2].trim();

  // type = tokens until a top-level stopword
  const tokens = rest.split(/\s+/);
  const typeTokens: string[] = [];
  for (const tok of tokens) {
    const bare = tok.replace(/\(.*$/, '');
    if (COLUMN_STOPWORDS.has(bare.toUpperCase())) break;
    typeTokens.push(tok);
  }
  const rawType = typeTokens.join(' ');
  if (!rawType) return null;

  const nullable = !/\bNOT\s+NULL\b/i.test(rest) && !/\bPRIMARY\s+KEY\b/i.test(rest);
  let def_: string | null = null;
  const dm = rest.match(/\bDEFAULT\s+(.+?)(?:\s+(?:NOT\s+NULL|REFERENCES|CHECK|UNIQUE|PRIMARY\s+KEY)\b|$)/is);
  if (dm) def_ = dm[1].trim().replace(/\s+/g, ' ');

  const norm = normalizeType(rawType, enumNames);
  return {
    name,
    rawType,
    udt: norm.udt,
    length: norm.length,
    precision: norm.precision,
    scale: norm.scale,
    nullable,
    default: def_,
    table,
    file,
  };
}

function parseMigrations(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const enums = new Map<string, string[]>();
  const tables = new Map<string, ExpectedTable>();
  const indexes = new Map<string, string>(); // indexName -> table

  // first pass: enum names
  for (const file of files) {
    const sql = stripSqlComments(fs.readFileSync(path.join(dir, file), 'utf8'));
    const enumRe = /CREATE\s+TYPE\s+"?([a-zA-Z_][\w]*)"?\s+AS\s+ENUM\s*\(([^)]*)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = enumRe.exec(sql))) {
      const name = m[1].toLowerCase();
      const vals = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
      enums.set(name, vals);
    }
  }
  const enumNames = new Set(enums.keys());

  // second pass: tables + indexes
  for (const file of files) {
    const sql = stripSqlComments(fs.readFileSync(path.join(dir, file), 'utf8'));

    const tblRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][\w]*)"?\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = tblRe.exec(sql))) {
      const tableName = m[1].toLowerCase();
      const openIdx = sql.indexOf('(', m.index + m[0].length - 1);
      const { body } = extractBalanced(sql, openIdx);
      const defs = splitTopLevel(body);
      const cols = new Map<string, ExpectedColumn>();
      for (const def of defs) {
        const col = parseColumnDef(def, tableName, file, enumNames);
        if (col) cols.set(col.name, col);
      }
      tables.set(tableName, { name: tableName, columns: cols, file });
    }

    const idxRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][\w]*)"?\s+ON\s+"?([a-zA-Z_][\w]*)"?/gi;
    while ((m = idxRe.exec(sql))) {
      indexes.set(m[1].toLowerCase(), m[2].toLowerCase());
    }
  }

  return { enums, tables, indexes };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB introspection (read-only)
// ─────────────────────────────────────────────────────────────────────────────
interface DbColumn {
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

async function introspect(client: Client) {
  const cols = await client.query<{ table_name: string } & DbColumn & { column_name: string }>(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`,
  );
  const tables = new Map<string, Map<string, DbColumn>>();
  for (const r of cols.rows) {
    if (!tables.has(r.table_name)) tables.set(r.table_name, new Map());
    tables.get(r.table_name)!.set(r.column_name, r);
  }

  const enumsRes = await client.query<{ typname: string; enumlabel: string }>(
    `SELECT t.typname, e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder`,
  );
  const enums = new Map<string, string[]>();
  for (const r of enumsRes.rows) {
    if (!enums.has(r.typname)) enums.set(r.typname, []);
    enums.get(r.typname)!.push(r.enumlabel);
  }

  const idxRes = await client.query<{ indexname: string; tablename: string }>(
    `SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const indexes = new Set(idxRes.rows.map((r) => r.indexname.toLowerCase()));

  return { tables, enums, indexes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function normalizeDefault(d: string | null): string {
  if (!d) return '';
  return d
    .toLowerCase()
    .replace(/::[a-z_ ]+(\[\])?/g, '') // drop ::type casts
    .replace(/['"\s]/g, '')
    .replace(/nextval\(.*\)/, 'nextval')
    .trim();
}

async function main() {
  const argUrl = (() => {
    const i = process.argv.indexOf('--url');
    return i >= 0 ? process.argv[i + 1] : undefined;
  })();
  const url = argUrl || process.env.DATABASE_URL;
  if (!url) {
    console.error(C.red('No DATABASE_URL found (env or --url).'));
    process.exit(2);
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const expected = parseMigrations(migrationsDir);

  const masked = url.replace(/\/\/[^@]*@/, '//***@');
  console.log(C.bold('\nSchema verification — consolidated migrations vs live DB'));
  console.log(C.dim(`  target: ${masked}`));
  console.log(
    C.dim(
      `  parsed: ${expected.tables.size} tables, ${expected.enums.size} enums, ${expected.indexes.size} indexes\n`,
    ),
  );

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let actual;
  try {
    actual = await introspect(client);
  } finally {
    await client.end();
  }

  let errors = 0;
  let warnings = 0;
  const err = (s: string) => {
    errors++;
    console.log('   ' + C.red('✗ ERROR  ') + s);
  };
  const warn = (s: string) => {
    warnings++;
    console.log('   ' + C.yellow('⚠ WARN   ') + s);
  };

  // ── Tables & columns ──────────────────────────────────────────────────────
  for (const [tname, etbl] of [...expected.tables].sort()) {
    const atbl = actual.tables.get(tname);
    if (!atbl) {
      console.log(C.cyan(`\n▸ ${tname}`) + C.dim(` (${etbl.file})`));
      err(`table MISSING from database`);
      continue;
    }
    const colIssues: string[] = [];

    for (const [cname, ecol] of etbl.columns) {
      const acol = atbl.get(cname);
      if (!acol) {
        colIssues.push(C.red('✗ ERROR  ') + `column "${cname}" MISSING (expected ${ecol.rawType})`);
        errors++;
        continue;
      }
      // base type
      if (ecol.udt !== acol.udt_name.toLowerCase()) {
        colIssues.push(
          C.red('✗ ERROR  ') +
            `column "${cname}" type mismatch: migration=${ecol.udt} db=${acol.udt_name}`,
        );
        errors++;
      } else {
        // length / precision (warn only, same base type)
        if (
          ecol.length != null &&
          acol.character_maximum_length != null &&
          ecol.length !== acol.character_maximum_length
        ) {
          colIssues.push(
            C.yellow('⚠ WARN   ') +
              `column "${cname}" varchar length: migration(${ecol.length}) db(${acol.character_maximum_length})`,
          );
          warnings++;
        }
        if (
          ecol.precision != null &&
          acol.numeric_precision != null &&
          (ecol.precision !== acol.numeric_precision || (ecol.scale ?? 0) !== (acol.numeric_scale ?? 0))
        ) {
          colIssues.push(
            C.yellow('⚠ WARN   ') +
              `column "${cname}" numeric(${ecol.precision},${ecol.scale}) vs db(${acol.numeric_precision},${acol.numeric_scale})`,
          );
          warnings++;
        }
      }
      // nullability
      const dbNullable = acol.is_nullable === 'YES';
      if (ecol.nullable !== dbNullable) {
        colIssues.push(
          C.red('✗ ERROR  ') +
            `column "${cname}" nullability: migration=${ecol.nullable ? 'NULL' : 'NOT NULL'} db=${dbNullable ? 'NULL' : 'NOT NULL'}`,
        );
        errors++;
      }
      // default (warn)
      if (ecol.default != null) {
        if (normalizeDefault(ecol.default) !== normalizeDefault(acol.column_default)) {
          colIssues.push(
            C.yellow('⚠ WARN   ') +
              `column "${cname}" default: migration(${ecol.default}) db(${acol.column_default ?? 'none'})`,
          );
          warnings++;
        }
      }
    }

    // extra columns in DB not in migration
    for (const cname of atbl.keys()) {
      if (!etbl.columns.has(cname)) {
        colIssues.push(C.yellow('⚠ WARN   ') + `column "${cname}" exists in DB but NOT in migrations`);
        warnings++;
      }
    }

    if (colIssues.length) {
      console.log(C.cyan(`\n▸ ${tname}`) + C.dim(` (${etbl.file})`));
      colIssues.forEach((s) => console.log('   ' + s));
    } else {
      console.log(C.cyan(`▸ ${tname}`) + '  ' + C.green(`✓ ${etbl.columns.size} columns match`));
    }
  }

  // tables in DB not in migrations
  const extraTables = [...actual.tables.keys()].filter(
    (t) => !expected.tables.has(t) && t !== 'applied_migrations',
  );
  if (extraTables.length) {
    console.log(C.cyan('\n▸ extra tables in DB (not in consolidated migrations)'));
    extraTables.forEach((t) => warn(`table "${t}" present in DB but not in migrations`));
  }

  // ── Enums ─────────────────────────────────────────────────────────────────
  console.log(C.bold('\nEnums'));
  for (const [ename, evals] of [...expected.enums].sort()) {
    const avals = actual.enums.get(ename);
    if (!avals) {
      err(`enum "${ename}" MISSING from database`);
      continue;
    }
    const missing = evals.filter((v) => !avals.includes(v));
    const extra = avals.filter((v) => !evals.includes(v));
    if (missing.length) err(`enum "${ename}" missing values: ${missing.join(', ')}`);
    if (extra.length) warn(`enum "${ename}" has extra DB values: ${extra.join(', ')}`);
    if (!missing.length && !extra.length)
      console.log('   ' + C.green('✓ ') + `${ename} (${evals.length} values)`);
  }

  // ── Indexes ───────────────────────────────────────────────────────────────
  console.log(C.bold('\nIndexes'));
  const missingIdx = [...expected.indexes.keys()].filter((i) => !actual.indexes.has(i));
  if (missingIdx.length) {
    missingIdx.forEach((i) => warn(`index "${i}" (on ${expected.indexes.get(i)}) MISSING from DB`));
  } else {
    console.log('   ' + C.green('✓ ') + `all ${expected.indexes.size} migration indexes present`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(C.bold('\n────────────────────────────────────────'));
  console.log(
    `  ${errors === 0 ? C.green('ERRORS: 0') : C.red('ERRORS: ' + errors)}   ` +
      `${warnings === 0 ? C.green('WARNINGS: 0') : C.yellow('WARNINGS: ' + warnings)}`,
  );
  console.log(C.dim('  (ERROR = schema would break the app; WARN = cosmetic / extra / default drift)\n'));

  process.exit(errors === 0 ? 0 : 1);
}

main().catch((e) => {
  const detail =
    e?.code === 'ETIMEDOUT' || e?.code === 'ENETUNREACH' || e?.errors
      ? 'cannot reach the database host (network/firewall). Run this from an environment that can connect to DATABASE_URL.'
      : e?.message || String(e);
  console.error(C.red('\nVerification failed to run:'), detail);
  if (e?.code) console.error(C.dim('  code: ' + e.code));
  process.exit(2);
});
