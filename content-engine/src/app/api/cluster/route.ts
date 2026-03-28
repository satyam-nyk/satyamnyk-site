import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { TopicCluster } from "@/models/TopicCluster";

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const clusters = await TopicCluster.find({})
      .sort({ createdAt: -1 })
      .lean()
      .limit(100);

    return NextResponse.json({ clusters });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
