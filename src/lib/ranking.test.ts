import { describe, expect, it } from "vitest";
import {
  affinity,
  emptyProfile,
  learn,
  prune,
  score,
  topTopics,
  unlearn,
  visible,
  type Profile,
} from "./ranking";
import type { Article } from "./types";

const HOUR = 3_600_000;
const NOW = 1_770_000_000_000;

let counter = 0;
function article(overrides: Partial<Article> = {}): Article {
  counter += 1;
  return {
    id: `a${counter}`,
    title: "Nintendo anuncia un nuevo Zelda para Switch",
    summary: "El estudio confirmó la fecha durante el evento.",
    url: `https://example.com/${counter}`,
    image: null,
    publishedAt: NOW - HOUR,
    sourceId: "polygon",
    sourceName: "Polygon",
    category: "videojuegos",
    lang: "es",
    ...overrides,
  };
}

/** Entrena el perfil con varios artículos del mismo tipo. */
function train(profile: Profile, template: Partial<Article>, liked: boolean, times: number) {
  let p = profile;
  for (let i = 0; i < times; i++) p = learn(p, article(template), liked);
  return p;
}

describe("aprendizaje", () => {
  it("arranca indiferente: sin votos, todo tiene afinidad 0.5", () => {
    expect(affinity(article(), emptyProfile())).toBeCloseTo(0.5, 5);
  });

  it("sube la afinidad de lo que te gusta y baja la de lo que rechazás", () => {
    const base = article();
    const liked = learn(emptyProfile(), base, true);
    const disliked = learn(emptyProfile(), base, false);

    expect(affinity(base, liked)).toBeGreaterThan(0.5);
    expect(affinity(base, disliked)).toBeLessThan(0.5);
  });

  it("generaliza: votar notas de Zelda sube otras notas de Zelda que nunca viste", () => {
    const profile = train(emptyProfile(), {}, true, 5);

    const otraDeZelda = article({
      title: "Zelda vuelve a Nintendo Switch con una remasterización",
      summary: "Nintendo confirmó el port.",
      id: "nuevo",
    });

    expect(affinity(otraDeZelda, profile)).toBeGreaterThan(0.7);
  });

  it("no contamina categorías ajenas", () => {
    const profile = train(emptyProfile(), {}, true, 5);

    const teatro = article({
      title: "Estrena una obra sobre la crisis del 2001 en el San Martín",
      summary: "La puesta reúne a seis actores en escena.",
      category: "teatro",
      sourceId: "guardian-stage",
      sourceName: "The Guardian Stage",
    });

    expect(affinity(teatro, profile)).toBeLessThan(0.55);
  });

  it("converge: el error se achica a medida que se repite el mismo voto", () => {
    let profile = emptyProfile();
    const errores: number[] = [];

    for (let i = 0; i < 8; i++) {
      const a = article();
      errores.push(1 - affinity(a, profile));
      profile = learn(profile, a, true);
    }

    // Cada iteración debe estar más cerca de acertar que la anterior.
    for (let i = 1; i < errores.length; i++) {
      expect(errores[i]).toBeLessThan(errores[i - 1]);
    }
  });

  it("los pesos quedan acotados aunque votes cien veces lo mismo", () => {
    const profile = train(emptyProfile(), {}, true, 100);
    for (const w of Object.values(profile.weights)) {
      expect(Math.abs(w)).toBeLessThanOrEqual(2.5);
    }
  });

  it("registra cuándo votaste, no solo qué votaste", () => {
    const a = article();
    const profile = learn(emptyProfile(), a, true);

    expect(profile.reactions[a.id].vote).toBe(1);
    expect(profile.reactions[a.id].at).toBeGreaterThan(0);
  });

  it("deshacer un voto lo saca del registro y revierte el aprendizaje", () => {
    const a = article();
    const liked = learn(emptyProfile(), a, true);
    const undone = unlearn(liked, a);

    expect(undone.reactions[a.id]).toBeUndefined();
    expect(undone.votes).toBe(0);
    expect(affinity(a, undone)).toBeLessThan(affinity(a, liked));
  });
});

describe("ranking", () => {
  it("con perfil vacío ordena por recencia", () => {
    const viejo = article({ id: "viejo", publishedAt: NOW - 48 * HOUR });
    const nuevo = article({ id: "nuevo", publishedAt: NOW - HOUR });

    const ranked = score([viejo, nuevo], emptyProfile(), 1, NOW);
    expect(ranked[0].id).toBe("nuevo");
  });

  it("con perfil entrenado, lo afín le gana a lo más nuevo pero irrelevante", () => {
    const profile = train(emptyProfile(), {}, true, 30);

    const afinPeroViejo = article({
      id: "afin",
      title: "Nintendo anuncia un nuevo Zelda para Switch",
      publishedAt: NOW - 20 * HOUR,
    });
    const recienteIrrelevante = article({
      id: "reciente",
      title: "Una obra de teatro independiente agota entradas en Montevideo",
      summary: "La puesta lleva tres meses en cartel.",
      category: "teatro",
      sourceId: "guardian-stage",
      sourceName: "The Guardian Stage",
      publishedAt: NOW - HOUR,
    });

    const ranked = score([recienteIrrelevante, afinPeroViejo], profile, 1, NOW);
    expect(ranked[0].id).toBe("afin");
  });

  it("no pone más de dos notas seguidas del mismo medio mientras haya alternativas", () => {
    // Polygon publica todo hoy e IGN hace diez horas: sin diversificación, las
    // seis de Polygon irían juntas arriba de todo.
    const articles = [
      ...Array.from({ length: 6 }, (_, i) =>
        article({ id: `p${i}`, sourceId: "polygon", publishedAt: NOW - i * 60_000 }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        article({ id: `i${i}`, sourceId: "ign", publishedAt: NOW - 10 * HOUR - i * 60_000 }),
      ),
    ];

    const ranked = score(articles, emptyProfile(), 7, NOW);
    const sources = ranked.map((a) => a.sourceId);

    // Solo exigimos la regla mientras quede material de las dos fuentes: en la
    // cola, cuando ya se agotó una, es normal que la otra venga seguida.
    const lastMixed = sources.lastIndexOf(
      sources[sources.length - 1] === "polygon" ? "ign" : "polygon",
    );

    let run = 1;
    for (let i = 1; i <= lastMixed; i++) {
      run = sources[i] === sources[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }

    // Y el resultado concreto: la primera pantalla mezcla los dos medios.
    expect(new Set(sources.slice(0, 6)).size).toBe(2);
  });

  it("esconde para siempre lo que marcaste con pulgar abajo", () => {
    const odiado = article({ id: "odiado" });
    const resto = article({ id: "resto" });
    const profile = learn(emptyProfile(), odiado, false);

    expect(visible([odiado, resto], profile).map((a) => a.id)).toEqual(["resto"]);
  });

  it("un 👍 no esconde nada", () => {
    const querido = article({ id: "querido" });
    const profile = learn(emptyProfile(), querido, true);

    expect(visible([querido], profile)).toHaveLength(1);
  });

  it("degrada lo leído en sesiones anteriores sin ocultarlo", () => {
    const leido = article({ id: "leido" });
    const nuevo = article({ id: "nuevo", publishedAt: NOW - 2 * HOUR });

    // Leído ANTES de este fetch.
    const profile: Profile = { ...emptyProfile(), seen: { leido: NOW - HOUR } };
    const ranked = score([leido, nuevo], profile, 1, NOW);

    expect(ranked.map((a) => a.id)).toEqual(["nuevo", "leido"]);
  });

  it("NO mueve una nota que abriste durante esta sesión", () => {
    // El caso que importa: tocás una nota, el sitio no carga, volvés — y la
    // nota tiene que seguir donde estaba, no haberse hundido bajo tus pies.
    const tocada = article({ id: "tocada", publishedAt: NOW - HOUR });
    const otra = article({ id: "otra", publishedAt: NOW - 2 * HOUR });

    const antes = score([tocada, otra], emptyProfile(), 1, NOW);

    const despues = score(
      [tocada, otra],
      // seen DESPUÉS del fetch: la abriste recién.
      { ...emptyProfile(), seen: { tocada: NOW + 5 * 60_000 } },
      1,
      NOW,
    );

    expect(despues.map((a) => a.id)).toEqual(antes.map((a) => a.id));
    expect(despues[0].score).toBeCloseTo(antes[0].score, 10);
  });

  it("tampoco mueve una nota que acabás de votar 👍", () => {
    const votada = article({ id: "votada", publishedAt: NOW - HOUR });
    const otra = article({ id: "otra", publishedAt: NOW - 2 * HOUR });

    const reciente: Profile = {
      ...emptyProfile(),
      reactions: { votada: { vote: 1, at: NOW + 60_000 } },
    };
    const vieja: Profile = {
      ...emptyProfile(),
      reactions: { votada: { vote: 1, at: NOW - 60_000 } },
    };

    expect(score([votada, otra], reciente, 1, NOW)[0].id).toBe("votada");
    // La misma nota votada en una sesión previa sí cede el lugar.
    expect(score([votada, otra], vieja, 1, NOW)[0].id).toBe("otra");
  });

  it("explica por qué subió una nota", () => {
    const profile = train(emptyProfile(), {}, true, 10);
    const ranked = score([article()], profile, 1, NOW);

    expect(ranked[0].reasons.length).toBeGreaterThan(0);
    expect(ranked[0].reasons[0].weight).toBeGreaterThan(0);
  });
});

describe("perfil", () => {
  it("no crece sin techo: recorta lo viejo y conserva los pesos fuertes", () => {
    const seen: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) seen[`s${i}`] = NOW + i;

    const weights: Record<string, number> = { "t:importante": 2.4 };
    for (let i = 0; i < 6000; i++) weights[`t:ruido${i}`] = 0.02;

    const pruned = prune({ ...emptyProfile(), seen, weights });

    expect(Object.keys(pruned.seen).length).toBe(1500);
    expect(Object.keys(pruned.weights).length).toBe(4000);
    // Se descarta lo más viejo, no lo más nuevo.
    expect(pruned.seen["s2999"]).toBeDefined();
    expect(pruned.seen["s0"]).toBeUndefined();
    // Y el peso que de verdad importa sobrevive.
    expect(pruned.weights["t:importante"]).toBe(2.4);
  });

  it("deja el perfil intacto mientras esté dentro de los límites", () => {
    const profile = train(emptyProfile(), {}, true, 3);
    expect(prune(profile)).toBe(profile);
  });

  it("separa los temas a favor de los temas en contra", () => {
    let profile = train(emptyProfile(), {}, true, 6);
    profile = train(profile, {
      title: "Se estrena una obra de teatro clásico en el circuito off",
      summary: "Temporada corta en Corrientes.",
      category: "teatro",
      sourceId: "guardian-stage",
      sourceName: "The Guardian Stage",
    }, false, 6);

    const { liked, disliked } = topTopics(profile);

    expect(liked.map((t) => t.label)).toContain("zelda");
    expect(disliked.map((t) => t.label)).toContain("teatro");
  });
});
