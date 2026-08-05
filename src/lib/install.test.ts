import { describe, expect, it } from "vitest";
import { stepsFor, warningFor } from "./install";

describe("tutorial de instalación", () => {
  it("en iPhone con Safari explica el botón Compartir", () => {
    const steps = stepsFor("ios", "safari");
    expect(steps).toHaveLength(3);
    expect(steps[0].title).toMatch(/compartir/i);
    expect(steps.some((s) => /pantalla de inicio/i.test(s.detail))).toBe(true);
    expect(warningFor("ios", "safari")).toBeNull();
  });

  it("en iPhone con otro navegador avisa que hay que usar Safari", () => {
    // Es la limitación que motivó todo esto: en iOS solo Safari instala PWAs.
    for (const browser of ["chrome", "firefox", "opera", "edge"] as const) {
      expect(warningFor("ios", browser)).toMatch(/Safari/);
      expect(stepsFor("ios", browser)[0].detail).toMatch(/Safari/);
    }
  });

  it("en Android cada navegador tiene su camino", () => {
    expect(stepsFor("android", "chrome")[1].title).toMatch(/instalar/i);
    expect(stepsFor("android", "samsung")[0].detail).toMatch(/rayitas/i);
    expect(stepsFor("android", "firefox")[1].title).toMatch(/instalar/i);
    expect(warningFor("android", "chrome")).toBeNull();
  });

  it("avisa que Firefox de escritorio no puede instalar", () => {
    expect(warningFor("escritorio", "firefox")).toMatch(/no instala/i);
  });

  it("siempre devuelve pasos, para cualquier combinación", () => {
    const platforms = ["ios", "android", "escritorio"] as const;
    const browsers = ["safari", "chrome", "edge", "firefox", "opera", "samsung"] as const;

    for (const p of platforms) {
      for (const b of browsers) {
        const steps = stepsFor(p, b);
        expect(steps.length).toBeGreaterThan(0);
        for (const step of steps) {
          expect(step.title).not.toBe("");
          expect(step.detail).not.toBe("");
        }
      }
    }
  });
});
