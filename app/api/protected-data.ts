// pages/api/protected-data.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { requireActiveSubscription } from "@/lib/subscription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.query.user as string;

    // ❌ Blocks expired users
    await requireActiveSubscription(userId);

    // ✅ Safe data for active users
    res.status(200).json({ secretData: "This is your SaaS content" });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
}
