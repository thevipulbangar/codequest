// Create or promote an admin account. Admins cannot sign up through the website.
// Usage: npm run create-admin -- <email> <password> [name]
import prismaPkg from "@prisma/client";
import { hashPassword } from "../lib/server/password.ts";

const { PrismaClient } = prismaPkg;
const [emailArg, password, name = "Admin"] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();

if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 12) {
  console.error("Usage: npm run create-admin -- <email> <password (min 12 chars)> [name]");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name, role: "admin", passwordHash },
    update: { role: "admin", passwordHash },
  });
  console.log(`Admin ready: ${user.email}`);
} finally {
  await db.$disconnect();
}
