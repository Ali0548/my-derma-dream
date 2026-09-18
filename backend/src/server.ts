import { createApp } from './app.js';
import { env } from './config/env.js';
import { reportsService } from './modules/reports/reports.service.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Lumora API listening on http://localhost:${env.PORT}`);

  // Warm default full-range reports so the first UI hit stays under 2s.
  void reportsService
    .warmDefaultCaches()
    .then(() => console.log('Performance report cache warmed'))
    .catch((err) => console.warn('Report cache warm skipped:', err instanceof Error ? err.message : err));
});
