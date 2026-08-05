/**
 * Chequea que todas las fuentes del catálogo sigan vivas.
 *
 *   npm run feeds
 *
 * Los RSS se mueren, cambian de URL o empiezan a bloquear bots cada tanto.
 * Cuando el feed de una categoría se vea flaco, corré esto primero.
 *
 * (Funciona porque sources.ts solo importa tipos: Node lo carga borrándolos,
 * sin necesidad de compilar nada.)
 */
import { SOURCES } from "../src/lib/sources.ts";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CONCURRENCY = 6;
const TIMEOUT = 20_000;

async function check(source) {
  const started = Date.now();
  try {
    const res = await fetch(source.url, {
      headers: {
        "user-agent": UA,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: "follow",
    });

    const body = await res.text();
    const items =
      (body.match(/<item[\s>]/g) ?? []).length + (body.match(/<entry[\s>]/g) ?? []).length;

    return {
      source,
      ok: res.ok && items > 0,
      detail: `status=${res.status} items=${items}`,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      source,
      ok: false,
      detail: String(error?.message ?? error).slice(0, 60),
      ms: Date.now() - started,
    };
  }
}

const results = [];
for (let i = 0; i < SOURCES.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(SOURCES.slice(i, i + CONCURRENCY).map(check))));
}

const broken = results.filter((r) => !r.ok);

for (const r of results) {
  const mark = r.ok ? "ok  " : "FAIL";
  console.log(
    `${mark} ${r.source.category.padEnd(12)} ${r.source.name.padEnd(24)} ${r.detail} (${r.ms}ms)`,
  );
}

console.log(`\n${results.length - broken.length}/${results.length} fuentes vivas`);

if (broken.length > 0) {
  console.log("\nRevisar en src/lib/sources.ts:");
  for (const r of broken) console.log(`  ${r.source.id.padEnd(20)} ${r.source.url}`);
  process.exitCode = 1;
}
