import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { generateTopicIdeas } from "@/lib/seo/generateTopicIdeas";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { TopicCluster } from "@/models/TopicCluster";

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const recentClusters = await TopicCluster.find({})
      .sort({ createdAt: -1 })
      .select({ baseTopic: 1 })
      .lean()
      .limit(12);

    const ideas = await generateTopicIdeas(
      recentClusters.map((cluster) => cluster.baseTopic)
    );

    return NextResponse.json({ ideas });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to generate ideas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
