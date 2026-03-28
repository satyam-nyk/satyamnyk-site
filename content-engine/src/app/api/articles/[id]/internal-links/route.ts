import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";

type LinkSuggestion = {
  targetArticleId: string;
  slug: string;
  title: string;
  anchorText: string;
  reason: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(request);
    const { id } = await context.params;

    await connectToDb();

    const current = await Article.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const related = await Article.find({
      clusterId: current.clusterId,
      _id: { $ne: current._id },
      status: { $in: ["approved", "published"] },
    })
      .sort({ status: -1, updatedAt: -1 })
      .lean()
      .limit(8);

    const suggestions: LinkSuggestion[] = related.map((item) => {
      const overlap = getKeywordOverlap(current.keywords, item.keywords);
      const anchorText = overlap.length
        ? `${overlap[0]} guide`
        : item.title.replace(/[:|].*$/, "").trim();

      return {
        targetArticleId: item._id.toString(),
        slug: item.slug,
        title: item.title,
        anchorText,
        reason: overlap.length
          ? `Shared keyword focus: ${overlap.slice(0, 3).join(", ")}`
          : "Same topic cluster and complementary subtopic",
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getKeywordOverlap(source: string[], target: string[]) {
  const sourceSet = new Set(source.map((value) => normalize(value)).filter(Boolean));
  const overlap: string[] = [];

  for (const keyword of target) {
    const normalized = normalize(keyword);
    if (normalized && sourceSet.has(normalized)) {
      overlap.push(keyword);
    }
  }

  return overlap;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
