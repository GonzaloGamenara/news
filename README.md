# Titular

PWA de noticias mobile-first: cine y series, videojuegos, teatro, libros, tecnología y
ciencia. Se instala en el teléfono, abre offline y ordena el feed según lo que te gusta.

Toda la personalización corre y se guarda **en tu dispositivo**. No hay cuentas, no hay
base de datos, no sale nada a ningún lado.

## Arrancar

```bash
npm install
npm run dev
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Build de producción |
| `npm test` | Tests del algoritmo de ranking |
| `npm run feeds` | Chequea que las fuentes RSS sigan vivas |
| `npm run icons` | Regenera los íconos de la PWA |

## Cómo funciona el "algoritmo"

Es una **regresión logística online** de unas 60 líneas ([`src/lib/ranking.ts`](src/lib/ranking.ts)).
No necesita servidor, ni entrenamiento previo, ni cuenta.

**1. Cada nota se parte en features binarias**

```
"Nintendo anuncia un nuevo Zelda"  (Polygon, videojuegos)
   ↓
cat:videojuegos   src:polygon   t:nintendo   t:anuncia   t:zelda
```

**2. Tu perfil es un diccionario `feature → peso`**

```
afinidad = sigmoide( Σ pesos de las features de la nota )   →  entre 0 y 1
```

**3. Cuando votás, corrige el error**

Con `y = 1` para 👍 y `y = 0` para 👎:

```
peso[f]  +=  LR × (y − afinidad) × contribución(f)
```

Eso es descenso de gradiente estocástico. Lo importante es el `(y − afinidad)`: si el
modelo ya predecía bien, el error es chico y casi no se mueve; si se equivocó feo,
corrige fuerte. Por eso **generaliza**: votás tres notas de Zelda y sube cualquier nota
que mencione Zelda, aunque sea de otro medio.

**4. El orden final mezcla tres cosas**

```
score = w_gusto × afinidad
      + w_frescura × decaimiento_exponencial(antigüedad)
      + 0.12 × ruido_determinístico
```

- `w_gusto` arranca en 0 y sube hasta 0.62 recién a los 25 votos (**cold start**): con el
  perfil vacío el feed es básicamente cronológico.
- El **ruido de exploración** siempre está: sin él, el feed se cierra en tres temas y
  nunca más te muestra nada nuevo.
- Lo ya leído baja al 40%, lo que te gustó al 50% (sigue accesible, deja de competir).
- Lo que marcaste 👎 no vuelve a aparecer.
- **Olvido**: los pesos pierden la mitad de su valor cada 60 días. Si cambiás de
  intereses, el feed te sigue.
- **Diversificación**: nunca más de dos notas seguidas del mismo medio, así un sitio que
  publica 30 veces por día no se come la pantalla.

En la pantalla **Tu perfil** (el botón `✦ N` arriba a la derecha) ves los temas que el
modelo aprendió a favor y en contra, y podés borrar todo.

### Ajustar el comportamiento

Las constantes de arriba de [`src/lib/ranking.ts`](src/lib/ranking.ts):

| Constante | Efecto si la subís |
| --- | --- |
| `LEARNING_RATE` | Aprende más rápido, pero más volátil |
| `CONFIDENCE_VOTES` | Tarda más en personalizar |
| `FRESHNESS_HALFLIFE` | Tolera notas más viejas |
| `EXPLORATION` | Más variedad, menos precisión |
| `FORGET_HALFLIFE_DAYS` | Recuerda tus gustos por más tiempo |

Los tests de [`src/lib/ranking.test.ts`](src/lib/ranking.test.ts) verifican que el modelo
converge, que generaliza, que no contamina categorías ajenas y que los pesos quedan
acotados.

## Fuentes

60 feeds RSS en [`src/lib/sources.ts`](src/lib/sources.ts), mezcla de español e inglés.
Cada uno declara categoría e idioma; los generalistas (por ejemplo "Espectáculos" de
Clarín) llevan un `match` con keywords para que solo aporten lo relevante.

Una fuente caída nunca tumba el feed: se saltea y se reporta en `failed`.

> Teatro es la categoría con menos RSS decentes, sobre todo en Argentina. Está cubierta
> con Guardian Stage, Playbill, American Theatre, Broadway News y NYT Theater, más Clarín
> y El País filtrados por keywords. Si aparece algo mejor y local, va en `sources.ts`.

## Arquitectura

```
src/app/page.tsx           Home: trae "Para vos" en el servidor (ISR, 10 min)
src/app/api/feed/route.ts  Feed por categoría (cache CDN 10 min + SWR 1 h)
src/lib/rss.ts             Fetch y normalización de RSS/Atom + dedupe
src/lib/sources.ts         Catálogo de fuentes
src/lib/ranking.ts         El algoritmo
src/lib/useProfile.ts      Perfil en localStorage (useSyncExternalStore)
src/components/            UI
public/sw.js               Service worker escrito a mano
```

El HTML de la home ya llega con noticias adentro, así que abre con contenido antes de que
corra un solo fetch del cliente. El ranking se aplica en el cliente, porque el perfil
nunca sale del dispositivo.

El service worker cachea el shell (network-first) y `/api/feed`
(stale-while-revalidate): si te quedás sin señal, ves lo último que bajaste.

## Deploy

Importá el repo en [Vercel](https://vercel.com/new). No hace falta configurar nada: no hay
variables de entorno ni base de datos.

Para instalarla en el teléfono: abrila en Chrome/Safari → *Agregar a pantalla de inicio*.
