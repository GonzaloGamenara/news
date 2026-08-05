import { describe, expect, it } from "vitest";
import { cluster, coverageMap } from "./trending";
import type { Article } from "./types";

const NOW = 1_770_000_000_000;
const HOUR = 3_600_000;

let n = 0;
function article(title: string, sourceId: string, hoursAgo = 1): Article {
  n += 1;
  return {
    id: `a${n}`,
    title,
    summary: "",
    url: `https://example.com/${n}`,
    image: null,
    publishedAt: NOW - hoursAgo * HOUR,
    sourceId,
    sourceName: sourceId,
    category: "cine",
    lang: "es",
  };
}

describe("trending", () => {
  it("agrupa la misma historia contada por medios distintos", () => {
    const articles = [
      article("Nolan anuncia su nueva película sobre la Odisea", "variety"),
      article("Christopher Nolan confirma nueva película de la Odisea", "deadline"),
      article("La Odisea de Nolan ya tiene fecha de estreno", "collider"),
      article("Receta de milanesas a la napolitana", "cocina"),
    ];

    const clusters = cluster(articles, NOW);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].sources.sort()).toEqual(["collider", "deadline", "variety"]);
  });

  it("ordena por cantidad de medios, no por recencia", () => {
    const articles = [
      // Una sola nota, pero recién publicada.
      article("Estreno menor de una película independiente", "indiewire", 0),
      // Tres medios, un poco más viejas.
      article("Marvel anuncia el reparto de los Vengadores", "variety", 4),
      article("Los Vengadores suman reparto según Marvel", "deadline", 4),
      article("Marvel confirma reparto para los Vengadores", "collider", 4),
      // Dos medios.
      article("Se estrena el documental sobre Maradona", "clarin", 2),
      article("El documental de Maradona llega al cine", "lanacion", 2),
    ];

    const clusters = cluster(articles, NOW);

    expect(clusters[0].sources).toHaveLength(3);
    expect(clusters[1].sources).toHaveLength(2);
    // La nota de un solo medio no es tendencia por más nueva que sea.
    expect(clusters.every((c) => c.sources.length >= 2)).toBe(true);
  });

  it("ignora lo viejo aunque tenga mucha cobertura", () => {
    const articles = [
      article("Se filtró el tráiler de la serie", "variety", 60),
      article("El tráiler de la serie se filtró en la red", "deadline", 60),
      article("Filtración del tráiler de la serie", "collider", 60),
    ];

    expect(cluster(articles, NOW)).toHaveLength(0);
  });

  it("no agrupa dos notas del mismo medio como si fueran cobertura amplia", () => {
    const articles = [
      article("Nintendo presenta la nueva consola portátil", "ign"),
      article("La nueva consola portátil de Nintendo, presentada", "ign"),
    ];

    // Se agrupan, pero es un solo medio: no llega a tendencia.
    expect(cluster(articles, NOW)).toHaveLength(0);
  });

  it("expone cuántos medios cubren cada nota del grupo", () => {
    const articles = [
      article("Se viene la nueva temporada de la serie", "variety"),
      article("La serie estrena nueva temporada pronto", "deadline"),
    ];

    const map = coverageMap(cluster(articles, NOW));
    expect(map.size).toBe(2);
    expect([...map.values()]).toEqual([2, 2]);
  });

  it("el representante del grupo es la nota más reciente", () => {
    const articles = [
      article("Apple presenta el nuevo procesador para sus equipos", "verge", 6),
      article("El nuevo procesador de Apple para sus equipos", "arstechnica", 1),
    ];

    expect(cluster(articles, NOW)[0].lead.sourceId).toBe("arstechnica");
  });
});
