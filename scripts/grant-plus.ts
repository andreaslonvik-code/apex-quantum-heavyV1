/**
 * Manually grant Apex Quantum + access by patching Clerk privateMetadata.
 *
 * Use this when the Stripe → Clerk webhook didn't fire (misconfigured secret,
 * unregistered endpoint, etc.) but you've verified in the Stripe Dashboard
 * that the customer actually paid. The dashboard's hasPlusAccess() check
 * reads from privateMetadata, so patching it directly grants access.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/grant-plus.ts \
 *     <email> [stripeCustomerId] [stripeSubscriptionId] [days=30]
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/grant-plus.ts \
 *     andynikko08@gmail.com cus_UVzeiwgfMqDlq9
 */
import { createClerkClient } from '@clerk/backend';

interface PlusMetadata {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plusStatus?: string;
  plusActivatedAt?: string;
  plusCurrentPeriodEnd?: string;
  plusCancelAtPeriodEnd?: boolean;
  plusCanceledAt?: string;
  plusGrantedManually?: boolean;
}

async function main() {
  const [email, stripeCustomerId, stripeSubscriptionId, daysStr] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: grant-plus.ts <email> [stripeCustomerId] [stripeSubscriptionId] [days=30]');
    process.exit(1);
  }
  const days = daysStr ? parseInt(daysStr, 10) : 30;
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Invalid days: ${daysStr}`);
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY is not set. Run with --env-file=.env.local');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  const list = await clerk.users.getUserList({ emailAddress: [email] });
  if (list.totalCount === 0) {
    console.error(`No Clerk user found for email: ${email}`);
    process.exit(2);
  }
  if (list.totalCount > 1) {
    console.error(`Multiple Clerk users (${list.totalCount}) match ${email}. Aborting.`);
    process.exit(2);
  }
  const user = list.data[0];

  const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const existing = (user.privateMetadata ?? {}) as PlusMetadata;
  const patch: PlusMetadata = {
    ...existing,
    plusStatus: 'active',
    plusActivatedAt: existing.plusActivatedAt ?? new Date().toISOString(),
    plusCurrentPeriodEnd: periodEnd.toISOString(),
    plusCancelAtPeriodEnd: false,
    plusGrantedManually: true,
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
  };

  await clerk.users.updateUserMetadata(user.id, {
    privateMetadata: patch as unknown as Record<string, unknown>,
  });

  console.log(`Granted Plus to ${email} (userId=${user.id})`);
  console.log(`  plusCurrentPeriodEnd: ${periodEnd.toISOString()}`);
  console.log(`  stripeCustomerId:     ${stripeCustomerId ?? '(not set)'}`);
  console.log(`  stripeSubscriptionId: ${stripeSubscriptionId ?? '(not set)'}`);
  console.log('');
  console.log('Note: when Stripe webhook is fixed, future renewals will overwrite');
  console.log('plusCurrentPeriodEnd from the real subscription. plusGrantedManually');
  console.log('stays as a marker that the initial grant was a manual repair.');
}

main().catch((e) => {
  console.error('Failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
