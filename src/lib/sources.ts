import type { Category, CategoryId, Source } from "./types";

export const CATEGORIES: Category[] = [
  { id: "para-vos", label: "Para vos", emoji: "✦", accent: "265 85% 62%" },
  { id: "cine", label: "Cine y series", emoji: "🎬", accent: "352 80% 60%" },
  { id: "videojuegos", label: "Videojuegos", emoji: "🎮", accent: "155 65% 45%" },
  { id: "teatro", label: "Teatro", emoji: "🎭", accent: "28 90% 58%" },
  { id: "libros", label: "Libros", emoji: "📚", accent: "200 85% 52%" },
  { id: "tecnologia", label: "Tecnología", emoji: "⚡", accent: "225 85% 62%" },
  { id: "ciencia", label: "Ciencia", emoji: "🔬", accent: "300 60% 58%" },
];

export const CATEGORY_MAP = new Map<CategoryId, Category>(
  CATEGORIES.map((c) => [c.id, c]),
);

/** Solo notas de teatro salen de los feeds generalistas de espectáculos. */
const TEATRO_MATCH =
  /teatro|teatral|dramaturg|obra de|escenario|off corrientes|broadway|west end|musical|puesta en escena|stage|playwright/i;

/**
 * Catálogo de fuentes. Todas verificadas con una request real: si alguna se cae,
 * el fetcher la saltea y la reporta en `failed` en vez de romper el feed.
 */
export const SOURCES: Source[] = [
  // ---------- CINE Y SERIES ----------
  { id: "variety", name: "Variety", url: "https://variety.com/feed/", category: "cine", lang: "en" },
  { id: "indiewire", name: "IndieWire", url: "https://www.indiewire.com/feed/", category: "cine", lang: "en" },
  { id: "thr", name: "Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "cine", lang: "en" },
  { id: "deadline", name: "Deadline", url: "https://deadline.com/feed/", category: "cine", lang: "en" },
  { id: "slashfilm", name: "/Film", url: "https://www.slashfilm.com/feed/", category: "cine", lang: "en" },
  { id: "collider", name: "Collider", url: "https://collider.com/feed/", category: "cine", lang: "en" },
  { id: "screenrant", name: "ScreenRant", url: "https://screenrant.com/feed/", category: "cine", lang: "en" },
  { id: "guardian-film", name: "The Guardian", url: "https://www.theguardian.com/film/rss", category: "cine", lang: "en" },
  { id: "guardian-tv", name: "The Guardian TV", url: "https://www.theguardian.com/tv-and-radio/rss", category: "cine", lang: "en" },
  { id: "espinof", name: "Espinof", url: "https://www.espinof.com/feedburner.xml", category: "cine", lang: "es" },
  { id: "sensacine", name: "SensaCine", url: "https://www.sensacine.com/rss/noticias.xml", category: "cine", lang: "es" },
  { id: "lanacion-esp", name: "La Nación", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/espectaculos/?outputType=xml", category: "cine", lang: "es" },
  { id: "fotogramas", name: "Fotogramas", url: "https://www.fotogramas.es/rss/all.xml", category: "cine", lang: "es" },
  { id: "cinemania", name: "Cinemanía", url: "https://www.20minutos.es/rss/cinemania/", category: "cine", lang: "es" },
  { id: "infobae-teleshow", name: "Infobae Teleshow", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/teleshow/?outputType=xml", category: "cine", lang: "es" },

  // ---------- VIDEOJUEGOS ----------
  { id: "ign", name: "IGN", url: "https://feeds.ign.com/ign/games-all", category: "videojuegos", lang: "en" },
  { id: "ign-latam", name: "IGN Latam", url: "https://latam.ign.com/feed.xml", category: "videojuegos", lang: "es" },
  { id: "polygon", name: "Polygon", url: "https://www.polygon.com/rss/index.xml", category: "videojuegos", lang: "en" },
  { id: "eurogamer", name: "Eurogamer", url: "https://www.eurogamer.net/feed", category: "videojuegos", lang: "en" },
  { id: "rps", name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", category: "videojuegos", lang: "en" },
  { id: "kotaku", name: "Kotaku", url: "https://kotaku.com/rss", category: "videojuegos", lang: "en" },
  { id: "gamespot", name: "GameSpot", url: "https://www.gamespot.com/feeds/news/", category: "videojuegos", lang: "en" },
  { id: "pcgamer", name: "PC Gamer", url: "https://www.pcgamer.com/rss/", category: "videojuegos", lang: "en" },
  { id: "vg247", name: "VG247", url: "https://www.vg247.com/feed", category: "videojuegos", lang: "en" },
  { id: "gamesradar", name: "GamesRadar", url: "https://www.gamesradar.com/rss/", category: "videojuegos", lang: "en" },
  { id: "nintendolife", name: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest", category: "videojuegos", lang: "en" },
  { id: "pushsquare", name: "Push Square", url: "https://www.pushsquare.com/feeds/latest", category: "videojuegos", lang: "en" },
  { id: "destructoid", name: "Destructoid", url: "https://www.destructoid.com/feed/", category: "videojuegos", lang: "en" },
  { id: "gamedeveloper", name: "Game Developer", url: "https://www.gamedeveloper.com/rss.xml", category: "videojuegos", lang: "en" },
  { id: "guardian-games", name: "The Guardian Games", url: "https://www.theguardian.com/games/rss", category: "videojuegos", lang: "en" },
  { id: "vandal", name: "Vandal", url: "https://vandal.elespanol.com/rss/", category: "videojuegos", lang: "es" },
  { id: "meristation", name: "MeriStation", url: "https://as.com/rss/meristation/portada.xml", category: "videojuegos", lang: "es" },
  { id: "eurogamer-es", name: "Eurogamer España", url: "https://www.eurogamer.es/feed", category: "videojuegos", lang: "es" },
  // AnaitGames queda afuera a propósito: su RSS tarda ~12 s de forma constante
  // y nunca llegaría al deadline de fetchAll, costando la espera completa en
  // cada request. Si alguna vez se pone rápido, se vuelve a agregar acá.
  { id: "nintenderos", name: "Nintenderos", url: "https://www.nintenderos.com/feed/", category: "videojuegos", lang: "es" },

  // ---------- TEATRO ----------
  // Es la categoría con menos RSS decentes, sobre todo en Argentina: por eso se
  // completa con feeds generalistas de espectáculos filtrados por keywords.
  { id: "guardian-stage", name: "The Guardian Stage", url: "https://www.theguardian.com/stage/rss", category: "teatro", lang: "en" },
  { id: "guardian-theatre", name: "The Guardian Theatre", url: "https://www.theguardian.com/stage/theatre/rss", category: "teatro", lang: "en" },
  { id: "playbill", name: "Playbill", url: "https://playbill.com/rss/news", category: "teatro", lang: "en" },
  { id: "americantheatre", name: "American Theatre", url: "https://www.americantheatre.org/feed/", category: "teatro", lang: "en" },
  { id: "broadwaynews", name: "Broadway News", url: "https://broadwaynews.com/feed/", category: "teatro", lang: "en" },
  { id: "nyt-theater", name: "NYT Theater", url: "https://rss.nytimes.com/services/xml/rss/nyt/Theater.xml", category: "teatro", lang: "en" },
  { id: "lanacion-teatro", name: "La Nación Teatro", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/espectaculos/teatro/?outputType=xml", category: "teatro", lang: "es" },
  { id: "clarin-esp", name: "Clarín", url: "https://www.clarin.com/rss/espectaculos/", category: "teatro", lang: "es", match: TEATRO_MATCH },
  { id: "elpais-cultura", name: "El País Cultura", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada", category: "teatro", lang: "es", match: TEATRO_MATCH },
  { id: "infobae-cultura-teatro", name: "Infobae Cultura", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/cultura/?outputType=xml", category: "teatro", lang: "es", match: TEATRO_MATCH },
  { id: "20min-cultura", name: "20minutos Cultura", url: "https://www.20minutos.es/rss/cultura/", category: "teatro", lang: "es", match: TEATRO_MATCH },

  // ---------- LIBROS ----------
  { id: "guardian-books", name: "The Guardian Books", url: "https://www.theguardian.com/books/rss", category: "libros", lang: "en" },
  { id: "lithub", name: "Literary Hub", url: "https://lithub.com/feed/", category: "libros", lang: "en" },
  { id: "nyt-books", name: "NYT Books", url: "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml", category: "libros", lang: "en" },
  { id: "parisreview", name: "The Paris Review", url: "https://www.theparisreview.org/blog/feed/", category: "libros", lang: "en" },
  { id: "electriclit", name: "Electric Literature", url: "https://electricliterature.com/feed/", category: "libros", lang: "en" },
  { id: "zenda", name: "Zenda Libros", url: "https://www.zendalibros.com/feed/", category: "libros", lang: "es" },
  { id: "babelia", name: "Babelia", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/babelia/portada", category: "libros", lang: "es" },
  { id: "infobae-cultura", name: "Infobae Cultura", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/cultura/?outputType=xml", category: "libros", lang: "es" },
  { id: "letraslibres", name: "Letras Libres", url: "https://letraslibres.com/feed/", category: "libros", lang: "es" },
  { id: "anfibia", name: "Revista Anfibia", url: "https://www.revistaanfibia.com/feed/", category: "libros", lang: "es" },
  { id: "lecturalia", name: "Lecturalia", url: "https://www.lecturalia.com/blog/feed/", category: "libros", lang: "es" },

  // ---------- TECNOLOGÍA ----------
  { id: "verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "tecnologia", lang: "en" },
  { id: "arstechnica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "tecnologia", lang: "en" },
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "tecnologia", lang: "en" },
  { id: "wired", name: "WIRED", url: "https://www.wired.com/feed/rss", category: "tecnologia", lang: "en" },
  { id: "404media", name: "404 Media", url: "https://www.404media.co/rss/", category: "tecnologia", lang: "en" },
  { id: "hn", name: "Hacker News", url: "https://hnrss.org/frontpage", category: "tecnologia", lang: "en" },
  { id: "guardian-tech", name: "The Guardian Tech", url: "https://www.theguardian.com/uk/technology/rss", category: "tecnologia", lang: "en" },
  { id: "xataka", name: "Xataka", url: "https://www.xataka.com/feedburner.xml", category: "tecnologia", lang: "es" },
  { id: "genbeta", name: "Genbeta", url: "https://www.genbeta.com/feedburner.xml", category: "tecnologia", lang: "es" },
  { id: "hipertextual", name: "Hipertextual", url: "https://hipertextual.com/feed", category: "tecnologia", lang: "es" },
  { id: "microsiervos", name: "Microsiervos", url: "https://www.microsiervos.com/index.xml", category: "tecnologia", lang: "es" },
  { id: "applesfera", name: "Applesfera", url: "https://www.applesfera.com/feedburner.xml", category: "tecnologia", lang: "es" },
  { id: "xatakamovil", name: "Xataka Móvil", url: "https://www.xatakamovil.com/feedburner.xml", category: "tecnologia", lang: "es" },
  { id: "fayerwayer", name: "FayerWayer", url: "https://www.fayerwayer.com/feed/", category: "tecnologia", lang: "es" },
  { id: "infobae-tecno", name: "Infobae Tecno", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/tecno/?outputType=xml", category: "tecnologia", lang: "es" },
  { id: "elpais-tecno", name: "El País Tecnología", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada", category: "tecnologia", lang: "es" },

  // ---------- CIENCIA ----------
  { id: "quanta", name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/", category: "ciencia", lang: "en" },
  { id: "ars-science", name: "Ars Technica Science", url: "https://feeds.arstechnica.com/arstechnica/science", category: "ciencia", lang: "en" },
  { id: "nature", name: "Nature", url: "https://www.nature.com/nature.rss", category: "ciencia", lang: "en" },
  { id: "sciencenews", name: "Science News", url: "https://www.sciencenews.org/feed", category: "ciencia", lang: "en" },
  { id: "phys", name: "Phys.org", url: "https://phys.org/rss-feed/", category: "ciencia", lang: "en" },
  { id: "guardian-science", name: "The Guardian Science", url: "https://www.theguardian.com/science/rss", category: "ciencia", lang: "en" },
  { id: "elpais-ciencia", name: "El País Ciencia", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada", category: "ciencia", lang: "es" },
  { id: "bbc-mundo-ciencia", name: "BBC Mundo Ciencia", url: "https://feeds.bbci.co.uk/mundo/topics/cyd7dvd3e5nt/rss.xml", category: "ciencia", lang: "es" },
  { id: "naukas", name: "Naukas", url: "https://naukas.com/feed/", category: "ciencia", lang: "es" },
  { id: "eureka", name: "Eureka", url: "https://danielmarin.naukas.com/feed/", category: "ciencia", lang: "es" },
  { id: "muyinteresante", name: "Muy Interesante", url: "https://www.muyinteresante.com/feed/", category: "ciencia", lang: "es" },
  { id: "elpais-salud", name: "El País Salud", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/salud-y-bienestar/portada", category: "ciencia", lang: "es" },
];

export const SOURCE_MAP = new Map(SOURCES.map((s) => [s.id, s]));

export function sourcesFor(category: CategoryId): Source[] {
  if (category === "para-vos") return SOURCES;
  return SOURCES.filter((s) => s.category === category);
}
