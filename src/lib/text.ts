/** Palabras vacías ES + EN. Sin esto el modelo aprende "the" y "para". */
const STOPWORDS = new Set([
  // español
  "que", "como", "para", "por", "con", "sin", "los", "las", "del", "una", "uno", "unos", "unas",
  "sus", "sobre", "entre", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "mas",
  "pero", "porque", "cuando", "donde", "quien", "cual", "todo", "toda", "todos", "todas", "hay",
  "ser", "son", "fue", "era", "han", "has", "hace", "desde", "hasta", "muy", "tambien", "asi",
  "ya", "no", "si", "su", "al", "lo", "le", "se", "es", "en", "de", "la", "el", "un", "y", "o", "a",
  "ano", "anos", "dia", "dias", "vez", "ver", "dos", "tres", "nuevo", "nueva", "mejor", "mejores",
  // inglés
  "the", "and", "for", "with", "that", "this", "these", "those", "from", "have", "has", "had",
  "will", "would", "could", "should", "into", "than", "then", "there", "their", "they", "them",
  "you", "your", "its", "his", "her", "was", "were", "are", "been", "being", "but", "not", "all",
  "can", "out", "who", "what", "how", "why", "new", "now", "one", "two", "more", "most", "just",
  "about", "after", "before", "over", "under", "some", "any", "may", "get", "got", "make", "made",
  "say", "says", "said", "here", "much", "many", "way", "does", "did", "our", "off", "per", "via",
]);

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

/**
 * Convierte un texto en tokens de contenido. Cap de 14 para que un artículo con
 * resumen largo no pese 10x más que uno con solo título en el gradiente.
 */
export function tokenize(text: string, limit = 14): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const word of normalize(text).split(/\s+/)) {
    if (word.length < 4 || word.length > 24) continue;
    if (STOPWORDS.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= limit) break;
  }

  return out;
}

/** Etiqueta legible para mostrar un feature en la pantalla de perfil. */
export function featureLabel(feature: string): string {
  const [kind, ...rest] = feature.split(":");
  const value = rest.join(":");
  if (kind === "cat") return value;
  if (kind === "src") return value;
  return value;
}
