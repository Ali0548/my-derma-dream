import { commissionService } from '../modules/commission/commission.service.js';
import { pgClient } from '../db/client.js';

async function main() {
  const force = process.env.FORCE_RECALC === 'true';

  if (!force) {
    // Skip if commissions already stamped
    const { db } = await import('../db/client.js');
    const { orders } = await import('../db/schema/index.js');
    const { sql } = await import('drizzle-orm');
    const [{ pending }] = await db
      .select({
        pending: sql<number>`count(*) filter (where commission_status = 'pending')::int`,
      })
      .from(orders);

    if (Number(pending) === 0) {
      console.log('Commissions already calculated. Skipping (FORCE_RECALC=true to rerun).');
      await pgClient.end({ timeout: 5 });
      return;
    }
  }

  console.log('Recalculating commissions for all orders...');
  const started = Date.now();
  const result = await commissionService.recalculateAll((done, total) => {
    if (done % 20000 === 0 || done === total) {
      console.log(`  ${done}/${total}`);
    }
  });
  console.log(
    `Done. processed=${result.processed} rules=${result.rulesLoaded} in ${Math.round(
      (Date.now() - started) / 1000,
    )}s`,
  );
  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pgClient.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
