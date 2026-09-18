import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEEDS_DIR = join(ROOT, 'initial-seeds');
const ORDERS_CSV = join(SEEDS_DIR, 'orders.csv');
const RULES_CSV = join(SEEDS_DIR, 'rules.csv');

const BATCH_SIZE = 2000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizePricePoint(value) {
  const raw = emptyToNull(value);
  if (!raw) return '';
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return String(num);
}

function moneyOrNull(value) {
  const raw = emptyToNull(value);
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(2);
}

function specificityScore(product, pricePoint, affiliate, subAffiliate) {
  return [product, pricePoint, affiliate, subAffiliate].filter((v) => Boolean(v)).length;
}

async function readCsv(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Seed file not found: ${filePath}`);
  }

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  const rows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (!headers) {
      headers = cells;
      continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

async function streamCsv(filePath, onBatch) {
  if (!existsSync(filePath)) {
    throw new Error(`Seed file not found: ${filePath}`);
  }

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let batch = [];
  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (!headers) {
      headers = cells;
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      total += batch.length;
      await onBatch(batch, total);
      batch = [];
    }
  }

  if (batch.length > 0) {
    total += batch.length;
    await onBatch(batch, total);
  }

  return total;
}

async function importRules(sql) {
  console.log('Importing rules.csv...');
  const rows = await readCsv(RULES_CSV);
  const values = rows.map((row) => {
    const product = emptyToNull(row.product) ?? '';
    const pricePoint = normalizePricePoint(row.price_point);
    const affiliate = emptyToNull(row.affiliate) ?? '';
    const subAffiliate = emptyToNull(row.sub_affiliate) ?? '';

    return {
      rule_id: row.rule_id,
      product,
      price_point: pricePoint,
      affiliate,
      sub_affiliate: subAffiliate,
      cpa_type: row.cpa_type,
      cpa_value: Number(row.cpa_value).toFixed(4),
      effective_from: row.effective_from,
      effective_to: emptyToNull(row.effective_to),
      specificity_score: specificityScore(product, pricePoint, affiliate, subAffiliate),
      is_active: true,
    };
  });

  if (values.length === 0) {
    console.log('No rules found.');
    return 0;
  }

  await sql`
    insert into cpa_rules ${sql(
      values,
      'rule_id',
      'product',
      'price_point',
      'affiliate',
      'sub_affiliate',
      'cpa_type',
      'cpa_value',
      'effective_from',
      'effective_to',
      'specificity_score',
      'is_active',
    )}
    on conflict (rule_id) do update set
      product = excluded.product,
      price_point = excluded.price_point,
      affiliate = excluded.affiliate,
      sub_affiliate = excluded.sub_affiliate,
      cpa_type = excluded.cpa_type,
      cpa_value = excluded.cpa_value,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      specificity_score = excluded.specificity_score,
      is_active = excluded.is_active,
      updated_at = now()
  `;

  console.log(`Rules imported: ${values.length}`);
  return values.length;
}

async function importOrders(sql) {
  console.log('Importing orders.csv (batched)...');

  const affiliateSet = new Set();
  const subMap = new Map();
  const productSet = new Map();
  const pricePointSet = new Set();

  const total = await streamCsv(ORDERS_CSV, async (batch, seen) => {
    const values = batch.map((row) => {
      const product1Price = moneyOrNull(row.product_1_price) ?? '0.00';
      const p2 = moneyOrNull(row.product_2_price);
      const p3 = moneyOrNull(row.product_3_price);
      const p4 = moneyOrNull(row.product_4_price);
      const p5 = moneyOrNull(row.product_5_price);

      const frontend = Number(product1Price);
      const upsell =
        Number(p2 ?? 0) + Number(p3 ?? 0) + Number(p4 ?? 0) + Number(p5 ?? 0);
      const pricePoint = normalizePricePoint(row.product_1_price);
      const affiliateCode = emptyToNull(row.affiliate_code) ?? '';
      const subAffiliateCode = emptyToNull(row.sub_affiliate_code) ?? '';
      const product1Name = row.product_1_name;

      if (affiliateCode) affiliateSet.add(affiliateCode);
      if (subAffiliateCode) {
        subMap.set(subAffiliateCode, affiliateCode || subAffiliateCode.split('-')[0] || '');
      }

      productSet.set(`${product1Name}::frontend`, {
        name: product1Name,
        kind: 'frontend',
      });
      pricePointSet.add(`${product1Name}::${pricePoint}`);

      for (const [nameKey, priceKey] of [
        ['product_2_name', 'product_2_price'],
        ['product_3_name', 'product_3_price'],
        ['product_4_name', 'product_4_price'],
        ['product_5_name', 'product_5_price'],
      ]) {
        const upsellName = emptyToNull(row[nameKey]);
        if (upsellName) {
          productSet.set(`${upsellName}::upsell`, { name: upsellName, kind: 'upsell' });
        }
      }

      return {
        order_id: row.order_id,
        order_date: row.order_date,
        affiliate_code: affiliateCode,
        sub_affiliate_code: subAffiliateCode,
        product_1_name: product1Name,
        product_1_price: product1Price,
        price_point: pricePoint,
        product_2_name: emptyToNull(row.product_2_name),
        product_2_price: p2,
        product_3_name: emptyToNull(row.product_3_name),
        product_3_price: p3,
        product_4_name: emptyToNull(row.product_4_name),
        product_4_price: p4,
        product_5_name: emptyToNull(row.product_5_name),
        product_5_price: p5,
        frontend_revenue: frontend.toFixed(2),
        upsell_revenue: upsell.toFixed(2),
        total_revenue: (frontend + upsell).toFixed(2),
        commission_status: 'pending',
      };
    });

    await sql`
      insert into orders ${sql(
        values,
        'order_id',
        'order_date',
        'affiliate_code',
        'sub_affiliate_code',
        'product_1_name',
        'product_1_price',
        'price_point',
        'product_2_name',
        'product_2_price',
        'product_3_name',
        'product_3_price',
        'product_4_name',
        'product_4_price',
        'product_5_name',
        'product_5_price',
        'frontend_revenue',
        'upsell_revenue',
        'total_revenue',
        'commission_status',
      )}
      on conflict (order_id) do update set
        order_date = excluded.order_date,
        affiliate_code = excluded.affiliate_code,
        sub_affiliate_code = excluded.sub_affiliate_code,
        product_1_name = excluded.product_1_name,
        product_1_price = excluded.product_1_price,
        price_point = excluded.price_point,
        product_2_name = excluded.product_2_name,
        product_2_price = excluded.product_2_price,
        product_3_name = excluded.product_3_name,
        product_3_price = excluded.product_3_price,
        product_4_name = excluded.product_4_name,
        product_4_price = excluded.product_4_price,
        product_5_name = excluded.product_5_name,
        product_5_price = excluded.product_5_price,
        frontend_revenue = excluded.frontend_revenue,
        upsell_revenue = excluded.upsell_revenue,
        total_revenue = excluded.total_revenue,
        updated_at = now()
    `;

    if (seen % 20000 === 0 || batch.length < BATCH_SIZE) {
      console.log(`  orders processed: ${seen}`);
    }
  });

  console.log('Syncing affiliate / product directories...');

  const affiliateRows = [...affiliateSet].map((code) => ({
    code,
    name: code,
    is_active: true,
  }));
  if (affiliateRows.length) {
    await sql`
      insert into affiliates ${sql(affiliateRows, 'code', 'name', 'is_active')}
      on conflict (code) do update set updated_at = now(), is_active = true
    `;
  }

  const subRows = [...subMap.entries()].map(([code, affiliateCode]) => ({
    code,
    affiliate_code: affiliateCode,
    name: code,
    is_active: true,
  }));
  if (subRows.length) {
    await sql`
      insert into sub_affiliates ${sql(subRows, 'code', 'affiliate_code', 'name', 'is_active')}
      on conflict (code) do update set
        affiliate_code = excluded.affiliate_code,
        updated_at = now(),
        is_active = true
    `;
  }

  const productRows = [...productSet.values()].map((p) => ({
    name: p.name,
    product_kind: p.kind,
    is_active: true,
  }));
  if (productRows.length) {
    await sql`
      insert into products ${sql(productRows, 'name', 'product_kind', 'is_active')}
      on conflict (name, product_kind) do update set is_active = true
    `;
  }

  const priceRows = [...pricePointSet].map((key) => {
    const [productName, pricePoint] = key.split('::');
    return { product_name: productName, price_point: pricePoint };
  });
  if (priceRows.length) {
    await sql`
      insert into product_price_points ${sql(priceRows, 'product_name', 'price_point')}
      on conflict (product_name, price_point) do nothing
    `;
  }

  console.log(`Orders imported: ${total}`);
  return total;
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const force = process.env.FORCE_INITIAL_SEEDS === 'true';
  const sql = postgres(databaseUrl, { max: 5 });

  const startedAt = new Date();
  const [importRow] = await sql`
    insert into data_imports (kind, status, source_path, started_at, notes)
    values (
      'full',
      'running',
      ${SEEDS_DIR},
      ${startedAt},
      'CSV import of rules + orders'
    )
    returning id
  `;

  try {
    const [{ count: orderCount }] = await sql`select count(*)::int as count from orders`;
    const [{ count: ruleCount }] = await sql`select count(*)::int as count from cpa_rules`;

    if (!force && orderCount > 0 && ruleCount > 0) {
      console.log(
        `Initial seeds already present (orders=${orderCount}, rules=${ruleCount}). Skipping. Set FORCE_INITIAL_SEEDS=true to re-import.`,
      );
      await sql`
        update data_imports
        set
          status = 'completed',
          finished_at = now(),
          row_count = ${orderCount + ruleCount},
          success_count = ${orderCount + ruleCount},
          notes = 'Skipped — data already present'
        where id = ${importRow.id}
      `;
      await sql.end({ timeout: 5 });
      return;
    }

    const rulesImported = await importRules(sql);
    const ordersImported = await importOrders(sql);

    await sql`
      update data_imports
      set
        status = 'completed',
        finished_at = now(),
        row_count = ${rulesImported + ordersImported},
        success_count = ${rulesImported + ordersImported},
        error_count = 0,
        notes = ${`rules=${rulesImported}; orders=${ordersImported}`}
      where id = ${importRow.id}
    `;

    console.log('Initial seeds complete.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      update data_imports
      set
        status = 'failed',
        finished_at = now(),
        notes = ${`Import failed: ${message}`}
      where id = ${importRow.id}
    `.catch(() => undefined);

    throw err;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
