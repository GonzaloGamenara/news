import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { NextResponse } from "next/server";
import { isReadable } from "@/lib/reader";
import { sanitize } from "@/lib/sanitize";
import type { ArticleContent, ArticleFailure } from "@/lib/types";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Debajo de esto no vale la pena: es un teaser o un muro de pago. */
const MIN_CHARS = 900;

const WORDS_PER_MINUTE = 220;

function fail(reason: ArticleFailure, status = 200) {
  return NextResponse.json<ArticleContent>({ ok: false, reason }, { status });
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");

  if (!target) return fail("invalid", 400);
  // No es una restricción cosmética: sin allowlist esto sería un proxy abierto.
  if (!isReadable(target)) return fail("unsupported");

  let html: string;
  try {
    const res = await fetch(target, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return fail("failed");

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return fail("failed");

    html = await res.text();
  } catch {
    return fail("failed");
  }

  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document, { charThreshold: 250 }).parse();

    const text = parsed?.textContent?.trim() ?? "";
    if (!parsed?.content || text.length < MIN_CHARS) return fail("too-short");

    const body: ArticleContent = {
      ok: true,
      title: parsed.title ?? "",
      byline: parsed.byline ?? null,
      siteName: parsed.siteName ?? null,
      html: sanitize(parsed.content, target),
      minutes: Math.max(1, Math.round(text.split(/\s+/).length / WORDS_PER_MINUTE)),
    };

    return NextResponse.json(body, {
      headers: {
        // Una nota publicada no cambia: la cacheamos fuerte en el CDN.
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return fail("failed");
  }
}
