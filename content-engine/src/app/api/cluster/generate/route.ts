import { NextRequest, NextResponse } from "next/server";

import { generateCluster } from "@/lib/seo/generateCluster";
import { fetchSerpResearch } from "@/lib/seo/serp";
import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { TopicCluster } from "@/models/TopicCluster";

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const baseTopic = String(body?.baseTopic ?? "").trim();

    if (!baseTopic) {
      return NextResponse.json(
        { error: "baseTopic is required" },
        { status: 400 }
      );
    }

    const serpData = await fetchSerpResearch(baseTopic);
    const cluster = await generateCluster(baseTopic, serpData);

    await connectToDb();

    const saved = await TopicCluster.create({
      baseTopic,
      keywords: cluster.keywords,
      questions: serpData.questions,
      relatedSearches: serpData.relatedSearches,
      generatedTitles: cluster.titles,
      category: cluster.category,
    });

    return NextResponse.json({ cluster: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate cluster";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
