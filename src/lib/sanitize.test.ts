import { describe, expect, it } from "vitest";
import { sanitize } from "./sanitize";
import { isReadable } from "./reader";

const BASE = "https://www.theguardian.com/film/2026/una-nota";

describe("sanitize", () => {
  it("borra scripts con todo su contenido", () => {
    const out = sanitize('<p>Hola</p><script>fetch("/api/robar")</script>', BASE);
    expect(out).toContain("Hola");
    expect(out).not.toContain("script");
    expect(out).not.toContain("robar");
  });

  it("borra handlers inline", () => {
    const out = sanitize('<p onclick="alert(1)" onerror="alert(2)">Texto</p>', BASE);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("Texto");
  });

  it("bloquea javascript: en los links", () => {
    const out = sanitize('<a href="javascript:alert(1)">click</a>', BASE);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click");
  });

  it("bloquea imágenes con src peligroso", () => {
    const out = sanitize('<img src="javascript:alert(1)"><p>ok</p>', BASE);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("ok");
  });

  it("convierte los links relativos en absolutos y los abre afuera", () => {
    const out = sanitize('<a href="/film/otra-nota">otra</a>', BASE);
    expect(out).toContain("https://www.theguardian.com/film/otra-nota");
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noopener");
  });

  it("conserva el texto de etiquetas que no conoce", () => {
    const out = sanitize("<custom-widget><p>importante</p></custom-widget>", BASE);
    expect(out).toContain("importante");
    expect(out).not.toContain("custom-widget");
  });

  it("mantiene la estructura de una nota normal", () => {
    const out = sanitize(
      '<h2>Subtítulo</h2><p>Un <strong>párrafo</strong>.</p><ul><li>uno</li></ul><figure><img src="https://cdn.example.com/a.jpg" alt="foto"><figcaption>Pie</figcaption></figure>',
      BASE,
    );
    expect(out).toContain("<h2>Subtítulo</h2>");
    expect(out).toContain("<strong>párrafo</strong>");
    expect(out).toContain("<li>uno</li>");
    expect(out).toContain("Pie");
    expect(out).toContain('loading="lazy"');
    // La imagen sale redimensionada, con el original adentro del proxy.
    expect(out).toContain("wsrv.nl");
    expect(out).toContain(encodeURIComponent("https://cdn.example.com/a.jpg"));
  });

  it("borra iframes de trackers y embeds", () => {
    const out = sanitize('<p>a</p><iframe src="https://tracker.example"></iframe>', BASE);
    expect(out).not.toContain("iframe");
  });
});

describe("allowlist del lector", () => {
  it("acepta los dominios del catálogo, incluidos subdominios", () => {
    expect(isReadable("https://www.theguardian.com/film/una-nota")).toBe(true);
    expect(isReadable("https://variety.com/2026/film/news/x")).toBe(true);
    expect(isReadable("https://latam.ign.com/una-nota")).toBe(true);
    expect(isReadable("https://www.lanacion.com.ar/espectaculos/x")).toBe(true);
  });

  it("rechaza cualquier dominio de afuera", () => {
    // Hacker News enlaza a todo internet: esas notas van al navegador.
    expect(isReadable("https://blog-random.example.com/post")).toBe(false);
    expect(isReadable("https://evil.example/x")).toBe(false);
  });

  it("rechaza esquemas que no sean https y objetivos internos", () => {
    expect(isReadable("http://variety.com/x")).toBe(false);
    expect(isReadable("file:///etc/passwd")).toBe(false);
    expect(isReadable("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isReadable("https://localhost/admin")).toBe(false);
    expect(isReadable("no es una url")).toBe(false);
  });

  it("no se deja engañar por un dominio que termina parecido", () => {
    expect(isReadable("https://variety.com.evil.example/x")).toBe(false);
    expect(isReadable("https://notvariety.com/x")).toBe(false);
  });
});
