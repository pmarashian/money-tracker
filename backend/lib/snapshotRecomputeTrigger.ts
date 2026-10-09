import { recomputeSnapshotForUser } from './snapshotRecompute';

/** Fire-and-forget snapshot recompute after app-side input changes. */
export async function triggerSnapshotRecompute(userId: string, email: string): Promise<void> {
  try {
    await recomputeSnapshotForUser(userId, email);
  } catch (error) {
    console.error('[snapshotRecompute] failed for user', userId, error);
  }
}
