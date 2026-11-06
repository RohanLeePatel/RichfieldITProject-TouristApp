// Encrypts (or, with --decrypt, restores) the plaintext already in the encrypted columns,
// and fills the email blind index (emailHash) on User and Invitation.
// Uses a plain pg connection on purpose: it must bypass the Prisma extension.
// Idempotent and resumable: values already encrypted are skipped.
//   node scripts/backfill-column-encryption.js [--dry-run] [--decrypt] [--hashes-only]
//
// --hashes-only  only fills emailHash from the plaintext emails and encrypts nothing. Run it
//                BEFORE deploying the code that looks emails up by hash, so nobody is locked out.
require('dotenv/config');
const { Pool } = require('pg');
const { FIELDS, BLIND } = require('../src/utils/columnEncryption');
const { encryptText, decryptText, encryptBytes, decryptBytes, isEncryptedText, isEncryptedBytes, blindIndex } = require('../src/utils/fieldCrypto');

const DRY_RUN = process.argv.includes('--dry-run');
const DECRYPT = process.argv.includes('--decrypt');
const HASHES_ONLY = process.argv.includes('--hashes-only');
if (DECRYPT && HASHES_ONLY) throw new Error('--decrypt and --hashes-only cannot be combined');

// Every encrypted table has an "id" primary key, which the batches page on. A
// TripDocument row holds up to 1 MB of data, so its batches are much smaller.
const BATCH = { TripDocument: 20 };
const DEFAULT_BATCH = 500;

function convert(table, column, kind, value) {
  const aad = `${table}.${column}`;
  if (value === null || value === undefined || value === '') return { skip: true };
  if (kind === 'bytes') {
    if (DECRYPT) return isEncryptedBytes(value) ? { value: decryptBytes(value, aad) } : { skip: true };
    return isEncryptedBytes(value) ? { skip: true } : { value: encryptBytes(value, aad) };
  }
  if (DECRYPT) return isEncryptedText(value) ? { value: decryptText(value, aad) } : { skip: true };
  return isEncryptedText(value) ? { skip: true } : { value: encryptText(value, aad) };
}

async function run() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const summary = [];
  try {
    for (const [table, fields] of Object.entries(FIELDS)) {
      const blind = BLIND[table] || {};
      const indexColumns = Object.values(blind);
      const columns = [...Object.keys(fields), ...indexColumns];
      const batch = BATCH[table] || DEFAULT_BATCH;
      const stats = { table, scanned: 0, rowsChanged: 0, valuesChanged: 0, hashed: 0, conflicts: 0 };
      let last = null;

      for (;;) {
        const select = `select id, ${columns.map((c) => `"${c}"`).join(', ')} from "${table}" ${last === null ? '' : 'where id > $1 '}order by id limit ${batch}`;
        const { rows } = await pool.query(select, last === null ? [] : [last]);
        if (rows.length === 0) break;

        const client = await pool.connect();
        try {
          await client.query('begin');
          for (const row of rows) {
            stats.scanned += 1;
            const sets = [];
            const params = [];
            const add = (column, value) => {
              params.push(value);
              sets.push(`"${column}" = $${params.length}`);
            };

            if (!HASHES_ONLY) {
              for (const column of Object.keys(fields)) {
                const result = convert(table, column, fields[column], row[column]);
                if (!result.skip) add(column, result.value);
              }
            }
            const encryptedByThisRow = sets.length;

            // the hash is taken from the plaintext, so read it back from ciphertext if need be
            if (!DECRYPT) {
              for (const [column, indexColumn] of Object.entries(blind)) {
                const plain = decryptText(row[column], `${table}.${column}`);
                if (typeof plain === 'string' && plain && row[indexColumn] !== blindIndex(plain)) {
                  add(indexColumn, blindIndex(plain));
                  stats.hashed += 1;
                }
              }
            }
            if (sets.length === 0) continue;

            if (!DRY_RUN) {
              params.push(row.id);
              await client.query('savepoint row_update');
              try {
                await client.query(`update "${table}" set ${sets.join(', ')} where id = $${params.length}`, params);
                await client.query('release savepoint row_update');
              } catch (error) {
                if (error.code !== '23505') throw error;
                // two accounts whose emails differ only by case or spacing: leave both for a human
                await client.query('rollback to savepoint row_update');
                stats.conflicts += 1;
                console.warn(`${table} id ${row.id}: another row already has this email hash; skipped`);
                continue;
              }
            }
            stats.rowsChanged += 1;
            stats.valuesChanged += encryptedByThisRow;
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        } finally {
          client.release();
        }
        last = rows[rows.length - 1].id;
      }
      summary.push(stats);
    }
  } finally {
    await pool.end();
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}${DECRYPT ? 'Decrypt' : HASHES_ONLY ? 'Hash-only' : 'Encrypt'} backfill complete:`);
  console.table(summary);
}

run().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exit(1);
});
