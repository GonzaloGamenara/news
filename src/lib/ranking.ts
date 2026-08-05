/**
 * EL "ALGORITMO"
 * ==============
 * Es una regresión logística online (perceptrón con pérdida logística) que corre
 * entera en tu teléfono. Nada sale del dispositivo.
 *
 * 1. Cada artículo se descompone en FEATURES binarias:
 *      cat:videojuegos   src:polygon   t:zelda  t:nintendo  t:remake ...
 * 2. El perfil es un diccionario feature -> peso.
 *      score = Σ peso[f]          p = sigmoide(score)   ∈ (0,1)
 * 3. Cuando votás (y = 1 me gusta, y = 0 no me gusta):
 *      peso[f] += LR * (y - p) * contribución(f)
 *    Es descenso de gradiente estocástico: si el modelo ya predecía bien, el
 *    error (y - p) es chico y casi no se mueve; si se equivocó feo, corrige fuerte.
 * 4. El orden final mezcla gusto, frescura y una pizca de azar (exploración),
 *    para que no se te cierre en una burbuja de tres temas.
 *
 * Todo esto son ~60 líneas y no necesita servidor, entrenamiento ni cuenta.
 */

import type { Article } from "./types";
import { tokenize } from "./text";

// ---------------------------------------------------------------- parámetros

/** Cuánto se mueve el modelo por voto. Alto = aprende rápido pero es volátil. */
const LEARNING_RATE = 0.35;
/** Regularización L2: empuja los pesos hacia 0 para que ninguno se dispare. */
const L2 = 0.004;
/** Techo por feature: evita que una sola palabra secuestre el ranking. */
const CLAMP = 2.5;
/** Votos necesarios para confiar del todo en el perfil (cold start). */
const CONFIDENCE_VOTES = 25;
/** Vida media de la frescura, en horas. */
const FRESHNESS_HALFLIFE = 20;
/** Cuánto azar se inyecta siempre, para exploración. */
const EXPLORATION = 0.12;
/** Olvido: a los 60 días sin tocar, un peso vale la mitad. */
const FORGET_HALFLIFE_DAYS = 60;

// Techos del perfil. Cada voto agrega ~15 features y cada nota abierta una
// entrada en `seen`: sin límites, en un año esto no entra en localStorage.
const MAX_WEIGHTS = 4000;
const MAX_SEEN = 1500;
const MAX_REACTIONS = 2000;
/** Más alto que `seen`: se registra una impresión por nota que pasa por pantalla. */
const MAX_IMPRESSIONS = 4000;

export type Weights = Record<string, number>;

/** El `at` importa: sin él no podríamos distinguir un voto de hace un rato de
 *  uno de recién, y una nota que tocás ahora se hundiría bajo tus pies. */
export type Reaction = { vote: 1 | -1; at: number };

/** Cuántas veces te pasó por delante una nota, y cuándo fue la última. */
export type Impression = { n: number; last: number };

export type Profile = {
  weights: Weights;
  /** Cantidad total de votos emitidos. */
  votes: number;
  reactions: Record<string, Reaction>;
  /** articleId -> timestamp en que se abrió/leyó. */
  seen: Record<string, number>;
  /**
   * Impresiones: notas que aparecieron en pantalla, las hayas abierto o no.
   *
   * Es la diferencia entre "ya la leí" y "ya me la mostraste". Sin esto, una
   * nota que scrolleás sin abrir vuelve intacta al tope en cada sesión, que era
   * exactamente por qué el feed se sentía repetido.
   */
  impressions: Record<string, Impression>;
  updatedAt: number;
};

export const emptyProfile = (): Profile => ({
  weights: {},
  votes: 0,
  reactions: {},
  seen: {},
  impressions: {},
  updatedAt: Date.now(),
});

// ------------------------------------------------------------------ features

/**
 * Features de un artículo, con su contribución al gradiente. La categoría y la
 * fuente pesan 1; los tokens se reparten 1 entre todos, así un título largo no
 * mueve el modelo más que uno corto.
 */
export function featuresOf(article: Article): Array<[string, number]> {
  const tokens = tokenize(`${article.title} ${article.summary}`);
  const share = tokens.length > 0 ? 1 / Math.sqrt(tokens.length) : 0;

  return [
    [`cat:${article.category}`, 1],
    [`src:${article.sourceId}`, 1],
    ...tokens.map((t) => [`t:${t}`, share] as [string, number]),
  ];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Probabilidad de que te guste el artículo, según el perfil actual. */
export function affinity(article: Article, profile: Profile): number {
  let z = 0;
  for (const [f, contrib] of featuresOf(article)) {
    z += (profile.weights[f] ?? 0) * contrib;
  }
  return sigmoid(z);
}

// ------------------------------------------------------------- entrenamiento

/**
 * Un paso de SGD. Devuelve un perfil nuevo (inmutable) para que React lo vea.
 */
export function learn(
  profile: Profile,
  article: Article,
  liked: boolean,
): Profile {
  const y = liked ? 1 : 0;
  const p = affinity(article, profile);
  const error = y - p;

  const weights: Weights = { ...profile.weights };

  for (const [f, contrib] of featuresOf(article)) {
    const current = weights[f] ?? 0;
    const next = current + LEARNING_RATE * error * contrib - L2 * current;
    weights[f] = Math.max(-CLAMP, Math.min(CLAMP, next));
    // Un peso que quedó en ~0 es ruido: lo borramos para no inflar el storage.
    if (Math.abs(weights[f]) < 0.01) delete weights[f];
  }

  return {
    ...profile,
    weights,
    votes: profile.votes + 1,
    reactions: {
      ...profile.reactions,
      [article.id]: { vote: liked ? 1 : -1, at: Date.now() },
    },
    updatedAt: Date.now(),
  };
}

/** Deshace un voto: reentrena en la dirección opuesta y lo saca del registro. */
export function unlearn(profile: Profile, article: Article): Profile {
  const previous = profile.reactions[article.id];
  if (!previous) return profile;

  const reverted = learn(profile, article, previous.vote === -1);
  const reactions = { ...reverted.reactions };
  delete reactions[article.id];

  return { ...reverted, votes: Math.max(0, profile.votes - 1), reactions };
}

/**
 * Recorta el perfil para que no crezca sin techo. Se queda con los pesos más
 * fuertes (los débiles son ruido de una sola aparición) y con lo más reciente
 * de `seen` y `reactions` — las claves de un objeto conservan el orden de
 * inserción, así que cortar por el final descarta lo más viejo.
 */
export function prune(profile: Profile): Profile {
  const weightKeys = Object.keys(profile.weights);
  const seenKeys = Object.keys(profile.seen);
  const reactionKeys = Object.keys(profile.reactions);
  const impressionKeys = Object.keys(profile.impressions);

  if (
    weightKeys.length <= MAX_WEIGHTS &&
    seenKeys.length <= MAX_SEEN &&
    reactionKeys.length <= MAX_REACTIONS &&
    impressionKeys.length <= MAX_IMPRESSIONS
  ) {
    return profile;
  }

  const weights: Weights =
    weightKeys.length > MAX_WEIGHTS
      ? Object.fromEntries(
          Object.entries(profile.weights)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, MAX_WEIGHTS),
        )
      : profile.weights;

  const keepLast = <T>(record: Record<string, T>, keys: string[], max: number) =>
    keys.length > max
      ? Object.fromEntries(keys.slice(keys.length - max).map((k) => [k, record[k]]))
      : record;

  return {
    ...profile,
    weights,
    seen: keepLast(profile.seen, seenKeys, MAX_SEEN),
    reactions: keepLast(profile.reactions, reactionKeys, MAX_REACTIONS),
    impressions: keepLast(profile.impressions, impressionKeys, MAX_IMPRESSIONS),
  };
}

/**
 * Suma impresiones al perfil. Se llama de a tandas, no por tarjeta: mientras
 * scrolleás se acumulan aparte y esto las vuelca cuando cambia el feed.
 */
export function addImpressions(
  profile: Profile,
  ids: Iterable<string>,
  at = Date.now(),
): Profile {
  const impressions = { ...profile.impressions };
  let changed = false;

  for (const id of ids) {
    const previous = impressions[id];
    impressions[id] = { n: (previous?.n ?? 0) + 1, last: at };
    changed = true;
  }

  return changed ? { ...profile, impressions } : profile;
}

/**
 * Olvido por tiempo: se aplica al cargar el perfil. Lo que te gustaba en marzo
 * pesa menos hoy, así el feed puede seguirte cuando cambiás de intereses.
 */
export function decay(profile: Profile): Profile {
  const days = (Date.now() - profile.updatedAt) / 86_400_000;
  if (days < 1) return profile;

  const factor = Math.pow(0.5, days / FORGET_HALFLIFE_DAYS);
  const weights: Weights = {};
  for (const [f, w] of Object.entries(profile.weights)) {
    const next = w * factor;
    if (Math.abs(next) >= 0.01) weights[f] = next;
  }

  return { ...profile, weights, updatedAt: Date.now() };
}

// ------------------------------------------------------------------ ranking

const freshness = (publishedAt: number, now: number) =>
  Math.pow(0.5, (now - publishedAt) / 3_600_000 / FRESHNESS_HALFLIFE);

/** Cada cuántos días se "perdona" una impresión. */
const IMPRESSION_HEAL_DAYS = 2.5;

/**
 * Penalización por repetición, que es lo que hace que el feed se sienta nuevo.
 *
 * La curva es agresiva a propósito: con una impresión la nota vale la mitad,
 * con tres es casi invisible. Es el mismo principio que usan los feeds grandes
 * (impression capping): si te lo mostré y no lo tocaste, no insisto.
 *
 * Pero se sana con el tiempo. Una nota que viste hace una semana puede volver:
 * quizá ese día no tenías tiempo. Sin esto el catálogo se agota solo.
 */
function fatigue(impression: Impression | undefined, now: number): number {
  if (!impression) return 1;

  const days = (now - impression.last) / 86_400_000;
  const effective = impression.n - days / IMPRESSION_HEAL_DAYS;
  if (effective <= 0) return 1;

  return 1 / (1 + Math.pow(effective, 1.6) * 0.9);
}

/** Ruido determinístico por artículo: mismo orden en un re-render, distinto por sesión. */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export type ScoredArticle = Article & {
  score: number;
  affinity: number;
  /** Los features que más empujaron este artículo hacia arriba o abajo. */
  reasons: Array<{ feature: string; weight: number }>;
};

/**
 * @param salt semilla de exploración.
 * @param now  instante de referencia para la frescura. Se pasa (en vez de usar
 *   Date.now() acá adentro) para que el ranking sea una función pura: el
 *   servidor y el cliente calculan exactamente el mismo orden al hidratar.
 */
export function score(
  articles: Article[],
  profile: Profile,
  salt: number,
  now: number,
): ScoredArticle[] {
  // Con pocos votos el feed es básicamente cronológico; la personalización
  // entra de a poco a medida que hay señal real.
  const confidence = Math.min(1, profile.votes / CONFIDENCE_VOTES);
  const wAffinity = 0.62 * confidence;
  const wFresh = 0.88 - 0.42 * confidence;

  const scored = articles.map((article) => {
    const feats = featuresOf(article);
    const a = affinity(article, profile);

    const reasons = feats
      .map(([feature, contrib]) => ({
        feature,
        weight: (profile.weights[feature] ?? 0) * contrib,
      }))
      .filter((r) => Math.abs(r.weight) > 0.08)
      .sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight))
      .slice(0, 3);

    let s =
      wAffinity * a +
      wFresh * freshness(article.publishedAt, now) +
      EXPLORATION * jitter(article.id, salt);

    // Solo penalizamos lo que tocaste ANTES de este fetch.
    //
    // Si abrís una nota y volvés, tiene que seguir donde estaba: quizá el sitio
    // no cargó, quizá quedaste sin señal. Que se hunda apenas la tocás es peor
    // que verla dos veces — la perdés para siempre sin haberla leído.
    const seenAt = profile.seen[article.id];
    if (seenAt !== undefined && seenAt < now) s *= 0.4;

    // Lo mismo para el 👍: baja recién en la próxima carga del feed.
    const reaction = profile.reactions[article.id];
    if (reaction?.vote === 1 && reaction.at < now) s *= 0.6;

    // Y la fatiga por repetición. Las impresiones de ESTA sesión no cuentan
    // todavía (se acumulan aparte y se vuelcan al refrescar), así que scrollear
    // no reordena el feed bajo tus pies.
    s *= fatigue(profile.impressions[article.id], now);

    return { ...article, score: s, affinity: a, reasons };
  });

  return diversify(scored.sort((a, b) => b.score - a.score));
}

/** Máximo de notas consecutivas del mismo medio. */
const MAX_RUN = 2;

/**
 * Evita que un medio que publica 30 veces por día se coma la pantalla.
 *
 * La regla es mínimamente invasiva: respeta el orden por score y solo
 * interviene cuando ya hay MAX_RUN seguidas de la misma fuente, y únicamente
 * si queda alguna alternativa en el pool. Al final de la lista, cuando ya solo
 * sobran notas de un mismo medio, las deja pasar en vez de trabarse.
 */
function diversify(sorted: ScoredArticle[]): ScoredArticle[] {
  const out: ScoredArticle[] = [];
  const pool = [...sorted];

  let lastSource: string | null = null;
  let run = 0;

  while (pool.length > 0) {
    let pick = 0;

    if (run >= MAX_RUN) {
      const alternative = pool.findIndex((a) => a.sourceId !== lastSource);
      if (alternative !== -1) pick = alternative;
    }

    const [article] = pool.splice(pick, 1);
    out.push(article);

    run = article.sourceId === lastSource ? run + 1 : 1;
    lastSource = article.sourceId;
  }

  return out;
}

/** Artículos con 👎 no se muestran nunca más. */
export function visible(articles: Article[], profile: Profile): Article[] {
  return articles.filter((a) => profile.reactions[a.id]?.vote !== -1);
}

// ------------------------------------------------- introspección del perfil

export type TopicWeight = { feature: string; label: string; weight: number };

/** Top temas a favor y en contra, para la pantalla "Tu perfil". */
export function topTopics(profile: Profile, limit = 8) {
  const entries = Object.entries(profile.weights)
    .filter(([f]) => f.startsWith("t:"))
    .map(([feature, weight]) => ({
      feature,
      label: feature.slice(2),
      weight,
    }));

  const liked = entries
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);

  const disliked = entries
    .filter((e) => e.weight < 0)
    .sort((a, b) => a.weight - b.weight)
    .slice(0, limit);

  return { liked, disliked };
}
