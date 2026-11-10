import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { toState } from "@/lib/server/verification";

export const GET = handle(async () => {
  await requireUser(["admin"]);
  // NOTE: unpaginated; add cursor pagination past a few hundred applicants.
  const users = await db.user.findMany({
    where: { role: { in: ["operator", "owner"] }, verification: { isNot: null } },
    include: { verification: { include: { submissions: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items: users.map(u => toState(u, u.verification)).sort((a, b) => b.updatedAt - a.updatedAt) });
});
