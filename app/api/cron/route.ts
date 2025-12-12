import { NextResponse } from "next/server";
import { runSubscriptionCheck, runDailyBrief } from "@/lib/smart-notifications";

export async function GET(request: Request) {
  // Simple security
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Run both checks in parallel
  const [subs, briefs] = await Promise.all([
    runSubscriptionCheck(),
    runDailyBrief()
  ]);

  return NextResponse.json({ success: true, subsSent: subs, briefsSent: briefs });
}
