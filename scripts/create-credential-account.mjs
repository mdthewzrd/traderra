// Idempotently create an email/password (credential) account for an existing user,
// using better-auth's OWN hashPassword so the hash verifies on /sign-in.
// Usage: node scripts/create-credential-account.mjs <userId> <email> <password>
import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { PrismaClient } from "@prisma/client";

const [, , userId, email, password] = process.argv;
if (!userId || !email || !password) {
  console.error("Usage: node scripts/create-credential-account.mjs <userId> <email> <password>");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be >= 6 chars (auth.ts minPasswordLength).");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  // 1. confirm user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { console.error(`No user with id ${userId}`); process.exit(2); }
  console.log(`User confirmed: ${user.email} (${user.name || "no name"})`);

  // 2. idempotent: existing credential account?
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });
  if (existing) {
    console.log("Credential account already exists — updating password.");
    const hash = await hashPassword(password);
    await prisma.account.update({ where: { id: existing.id }, data: { password: hash } });
    console.log("Password updated.");
  } else {
    const hash = await hashPassword(password);
    await prisma.account.create({
      data: {
        id: `cred_${userId}`,
        userId,
        accountId: userId,          // better-auth convention for credential accounts
        providerId: "credential",
        password: hash,
      },
    });
    console.log("Credential account created.");
  }

  // 3. verify the hash round-trips
  const stored = await prisma.account.findFirst({ where: { userId, providerId: "credential" } });
  const ok = await verifyPassword({ hash: stored.password, password });
  console.log(`Hash verify round-trip: ${ok ? "OK ✓" : "FAILED ✗"}`);
  console.log(`\nLogin:  email=${email}  (password set)`);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(3);
} finally {
  await prisma.$disconnect();
}
