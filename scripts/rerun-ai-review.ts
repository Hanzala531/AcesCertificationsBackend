/**
 * rerun-ai-review.ts — manually re-run AI review for assessments.
 *
 * Boots a standalone Nest application context (so all services + AI providers
 * are wired exactly as in the running app) and re-drives the AI review through
 * the same submit -> triggerAiReview path a real submission uses.
 *
 * Usage:
 *   # Re-run specific assessment(s):
 *   npx ts-node scripts/rerun-ai-review.ts <assessmentId> [assessmentId ...]
 *
 *   # Or sweep all currently-failed-and-eligible reviews (same as the cron):
 *   npx ts-node scripts/rerun-ai-review.ts --sweep
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AiReviewRetryService } from '../src/modules/ai-review/services/ai-review-retry.service';

async function main() {
  const args = process.argv.slice(2);
  const sweep = args.includes('--sweep');
  const ids = args.filter((a) => !a.startsWith('--'));

  if (!sweep && ids.length === 0) {
    console.error(
      'Usage: ts-node scripts/rerun-ai-review.ts <assessmentId...> | --sweep',
    );
    process.exit(2);
  }

  const logger = new Logger('rerun-ai-review');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  try {
    const retry = app.get(AiReviewRetryService);

    if (sweep) {
      logger.log('Running failed-AI-review sweep…');
      const n = await retry.runSweep();
      logger.log(`Sweep complete — ${n} assessment(s) retried.`);
    } else {
      logger.log(`Re-running AI review for ${ids.length} assessment(s): ${ids.join(', ')}`);
      await retry.retrySpecific(ids);
      logger.log('Re-run complete. Check the assessment status / ai_reviews row for the outcome.');
    }
  } catch (err) {
    logger.error('Re-run failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
