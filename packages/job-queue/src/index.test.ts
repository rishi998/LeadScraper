import { describe, expect, it } from 'vitest';
import { ProcessingJobType } from '@leadintel/shared';
import { InMemoryJobQueue } from '../src/memory';
import { PermanentJobError, retryDelayMs } from '../src/types';
import { DomainConcurrencyGate } from '../src/domain-gate';

describe('retryDelayMs', () => {
  it('uses 5s then 30s then null', () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(30_000);
    expect(retryDelayMs(3)).toBeNull();
  });
});

describe('InMemoryJobQueue', () => {
  it('creates and completes jobs', async () => {
    const q = new InMemoryJobQueue();
    await q.enqueue({
      type: ProcessingJobType.DISCOVERY,
      searchJobId: '11111111-1111-1111-1111-111111111111',
      payload: { searchJobId: '11111111-1111-1111-1111-111111111111' },
    });
    const claimed = await q.claim('worker-a', 1);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.status).toBe('PROCESSING');
    expect(claimed[0]?.attempts).toBe(1);
    await q.complete(claimed[0]!.id, { ok: true });
    expect(q.get(claimed[0]!.id)?.status).toBe('COMPLETED');
  });

  it('does not double-claim the same job', async () => {
    const q = new InMemoryJobQueue();
    await q.enqueue({ type: ProcessingJobType.EXPORT, payload: { exportRunId: 'x' } });
    const [a, b] = await Promise.all([q.claim('w1', 1), q.claim('w2', 1)]);
    expect([...a, ...b]).toHaveLength(1);
  });

  it('retries with backoff then fails after max attempts', async () => {
    const q = new InMemoryJobQueue({ maxAttempts: 3, retryBackoffMs: [5_000, 30_000] });
    const job = await q.enqueue({ type: ProcessingJobType.CRAWL, payload: {} });

    const [c1] = await q.claim('w', 1);
    const after1 = await q.fail(c1!.id, 'network');
    expect(after1?.status).toBe('PENDING');
    expect(after1?.attempts).toBe(1);

    (q as unknown as { jobs: Map<string, { availableAt: Date }> }).jobs.get(job.id)!.availableAt =
      new Date(0);
    const [c2] = await q.claim('w', 1);
    expect(c2?.attempts).toBe(2);
    const after2 = await q.fail(c2!.id, 'network');
    expect(after2?.status).toBe('PENDING');

    (q as unknown as { jobs: Map<string, { availableAt: Date }> }).jobs.get(job.id)!.availableAt =
      new Date(0);
    const [c3] = await q.claim('w', 1);
    expect(c3?.attempts).toBe(3);
    const after3 = await q.fail(c3!.id, 'network');
    expect(after3?.status).toBe('FAILED');
  });

  it('does not retry permanent errors', async () => {
    const q = new InMemoryJobQueue({ maxAttempts: 3 });
    await q.enqueue({ type: ProcessingJobType.AUDIT, payload: {} });
    const [claimed] = await q.claim('w', 1);
    const failed = await q.fail(claimed!.id, new PermanentJobError('invalid').message, {
      permanent: true,
    });
    expect(failed?.status).toBe('FAILED');
  });

  it('recovers stale locks', async () => {
    const q = new InMemoryJobQueue({ maxAttempts: 3 });
    await q.enqueue({ type: ProcessingJobType.SCORING, payload: {} });
    const [claimed] = await q.claim('dead-worker', 1);
    const store = (q as unknown as { jobs: Map<string, { lockedAt: Date }> }).jobs;
    store.get(claimed!.id)!.lockedAt = new Date(Date.now() - 400_000);
    expect(await q.recoverStale(300_000)).toBe(1);
    expect(q.get(claimed!.id)?.status).toBe('PENDING');
  });

  it('supports pipeline progression via enqueue chaining', async () => {
    const q = new InMemoryJobQueue();
    const d = await q.enqueue({
      type: ProcessingJobType.DISCOVERY,
      searchJobId: 's1',
      payload: { searchJobId: 's1' },
    });
    const [cd] = await q.claim('w', 1);
    await q.complete(cd!.id);
    const er = await q.enqueue({
      type: ProcessingJobType.ENTITY_RESOLUTION,
      searchJobId: 's1',
      payload: { searchJobId: 's1' },
      priority: 50,
    });
    expect(er.type).toBe('ENTITY_RESOLUTION');
    expect(q.get(d.id)?.status).toBe('COMPLETED');
  });
});

describe('DomainConcurrencyGate', () => {
  it('serializes same-domain work when perDomain=1', async () => {
    const gate = new DomainConcurrencyGate(5, 1, 0);
    const order: string[] = [];
    await Promise.all([
      gate.run('a.com', async () => {
        order.push('a-start');
        await new Promise((r) => setTimeout(r, 30));
        order.push('a-end');
      }),
      gate.run('a.com', async () => {
        order.push('b-start');
        order.push('b-end');
      }),
    ]);
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });
});
