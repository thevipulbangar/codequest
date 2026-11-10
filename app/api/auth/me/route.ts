import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { publicUser, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";

export const GET = handle(async () => NextResponse.json({ user: publicUser(await requireUser()) }));

const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform(v => (v ? v : null));
const Profile = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  jobTitle: opt(80), phone: opt(30), country: opt(60),
  company: opt(120), companyType: opt(80), about: opt(400),
  website: z.string().trim().max(200).optional().nullable()
    .refine(v => !v || /^https?:\/\/\S+\.\S+$/.test(v), "must start with http:// or https://")
    .transform(v => (v ? v : null)),
});

export const PATCH = handle(async (req: Request) => {
  const u = await requireUser();
  const data = await body(req, Profile);
  const user = await db.user.update({ where: { id: u.id }, data });
  return NextResponse.json({ user: publicUser(user) });
});
