# Titular

PWA de noticias mobile-first: cine y series, videojuegos, teatro, libros, tecnología y
ciencia. Se instala en el teléfono, abre offline y ordena el feed según lo que te gusta.

Las notas se leen **adentro de la app**, sin saltar al sitio de cada medio. Podés filtrar
por idioma o traducir al español lo que esté en inglés.

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
- Lo ya leído baja al 40% y lo que te gustó al 60%, pero **solo a partir de la próxima
  carga del feed**. Una nota que tocás ahora no se mueve: si el sitio no cargó o te
  quedaste sin señal, tiene que seguir donde estaba cuando volvés. Perderla sin haberla
  leído es peor que verla dos veces.
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

## Leer sin salir de la app

Tocar una nota abre un lector a pantalla completa: [`/api/article`](src/app/api/article/route.ts)
baja la página, la pasa por Readability y devuelve el texto limpio, con imágenes y sin
banners. Se puede votar desde ahí mismo y siempre queda el link al original.

Dos cosas que no son obvias:

- **El endpoint solo acepta dominios del catálogo** ([`src/lib/reader.ts`](src/lib/reader.ts)).
  Sin esa allowlist sería un proxy abierto: cualquiera podría usar la app para pedir URLs
  internas de la red donde esté desplegada. Hacker News enlaza a todo internet, así que
  esas notas se abren en el navegador.
- **El HTML se sanea en el servidor** ([`src/lib/sanitize.ts`](src/lib/sanitize.ts)) con
  una allowlist de etiquetas y atributos antes de inyectarlo. Viene de páginas de
  terceros y termina en un `dangerouslySetInnerHTML`.

Si una nota tiene muro de pago o no se puede extraer, el lector lo dice y ofrece el link.

## Ajustes

Todo vive en un solo panel (el botón `✦` del header): perfil, tema, géneros, idioma,
datos y sincronización.

- **Tema**: sistema, claro, oscuro, noche (negro puro para OLED), sepia e índigo. Se
  aplica con `data-theme` en `<html>` y un script inline en
  [`layout.tsx`](src/app/layout.tsx) que corre antes del primer pintado — sin eso se ve un
  flash del tema anterior en cada carga.
- **Géneros**: qué categorías aparecen en el nav. Las apagadas tampoco entran en «Para
  vos». «Para vos» no se puede apagar.

## Idioma

El filtro de idioma y la opción **Traducir al español** están en Ajustes. Traduce títulos
y resúmenes vía [`/api/translate`](src/app/api/translate/route.ts), y **también el cuerpo
completo** de la nota en el lector (`/api/article?tr=1`): se recorren los nodos de texto
del HTML ya saneado, así los enlaces y el formato sobreviven a la traducción. Los lotes
van en paralelo de a 5, que baja una nota larga de 7 s a ~2 s.

Se hace en el servidor a propósito. La Translator API on-device de Chrome parecía la
opción elegante, pero **en iOS toda PWA corre sobre WebKit** —incluso la que instalás
"desde Chrome"—, así que ahí no existe. Del lado del servidor anda en cualquier teléfono.

Las traducciones se cachean en el CDN (una semana) y en `localStorage`, así que el mismo
título no se traduce dos veces. Si el servicio falla, se muestran los originales en
inglés en vez de dejar la tarjeta en blanco.

## Sincronización (Supabase)

El perfil vive en `localStorage` y se respalda en Supabase. Es **offline-first**: si no hay
red, si Supabase se cae o si no está configurado, la app funciona exactamente igual.

**No hay login.** Cada dispositivo genera un UUID aleatorio que funciona como credencial.
Pegando ese código en otro teléfono (Ajustes → Sincronización), ese teléfono adopta el
perfil. Se eligió así porque el login anónimo estaba deshabilitado en el proyecto y esto
evita pedirte una cuenta para una app de noticias personal.

La tabla tiene **RLS prendido y sin políticas**: la clave publicable no puede tocarla. El
único acceso es [`/api/sync`](src/app/api/sync/route.ts), que corre en el servidor con la
secret key. El `device_id` nunca sale del backend hacia otro lado.

Setup:

1. Correr [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor.
2. Copiar `.env.example` a `.env.local` y completar las claves.

Los conflictos se resuelven por *last write wins* sobre `updatedAt`. No hay merge por
campo a propósito: el perfil es un modelo entrenado y mezclar pesos de dos dispositivos
daría uno que no entrenó nadie.

## Ancho de banda

Pensada para usarse con datos móviles, así que el peso importa. Medido sobre el build de
producción con imágenes reales de las notas:

| | Original | Primera pasada | Ahora |
| --- | --- | --- | --- |
| Documento inicial | 348 KB | 124 KB | **124 KB** |
| Promedio por imagen | 574 KB | 49 KB | **27 KB** |
| Imágenes (primera pantalla) | 6,4 MB | 539 KB | **~400 KB** |
| Leer una nota | 21 KB | 21 KB | 21 KB |

Las imágenes eran el **95% del tráfico**: los feeds publican el original del medio (hasta
1,8 MB) para mostrarlo en una tarjeta de 350 px. Pasan por [wsrv.nl](https://wsrv.nl), que
redimensiona y convierte a WebP. Es gratis, no necesita cuenta y no consume la cuota de
optimización de imágenes de Vercel.

Tres ajustes medidos sobre imágenes reales:

- **Ancho real, no inflado.** Se pedía 960 px para una tarjeta de 350. Ahora se pide el
  doble del ancho real (720) por las pantallas retina, y nada más.
- **Calidad 60 en vez de 72.** A este tamaño la diferencia no se ve: 49 KB → 27 KB.
- **Cache en el service worker.** Las imágenes ya redimensionadas no cambian nunca, así
  que van cache-first con un techo de 300 (~8 MB). Volver a abrir la app en el mismo
  viaje no vuelve a bajar nada.

Se probó AVIF, que sería ~25% más chico todavía, pero wsrv falló en las 10 imágenes de
prueba: el encoder tarda demasiado y corta. Si algún día responde, es cambiar `output` en
[`images.ts`](src/lib/images.ts).

En viaje: de ~20 MB a **~1,5 MB** por trayecto, y menos todavía a partir del segundo día
por el cache.

**Ahorrar datos** (Ajustes → Datos) apaga las imágenes del todo. Si el sistema tiene
activado el ahorro de datos, arranca prendido solo.

## Fuentes

Feeds RSS en [`src/lib/sources.ts`](src/lib/sources.ts), mezcla de español e inglés (unas
40% en español). Cada uno declara categoría e idioma; los generalistas (por ejemplo
"Espectáculos" de Clarín) llevan un `match` con keywords para que solo aporten lo
relevante.

Una fuente caída nunca tumba el feed: se saltea y se reporta en `failed`. Y hay un
**deadline global de 4 s** en `fetchAll`: sin él, una sola fuente lenta define la latencia
de todo el feed (con `Promise.allSettled` a secas, una fuente de 8 s hacía que cada
request tardara 8 s aunque las otras sesenta contestaran en 400 ms).

> Teatro es la categoría con menos RSS decentes, sobre todo en Argentina. Está cubierta
> con Guardian Stage, Playbill, American Theatre, Broadway News y NYT Theater, más Clarín,
> Infobae y El País filtrados por keywords. Si aparece algo mejor y local, va en
> `sources.ts`.

## Arquitectura

```
src/app/page.tsx              Home: trae "Para vos" en el servidor (ISR, 10 min)
src/app/api/feed/route.ts     Feed por categoría (cache CDN 10 min + SWR 1 h)
src/app/api/article/route.ts  Lector: extrae y sanea el texto de una nota
src/lib/rss.ts                Fetch y normalización de RSS/Atom + dedupe
src/lib/sources.ts            Catálogo de fuentes
src/lib/ranking.ts            El algoritmo
src/lib/reader.ts             Allowlist de dominios del lector
src/lib/sanitize.ts           Saneado del HTML de terceros
src/lib/translate.ts          Cliente de traducción + cache
src/lib/useProfile.ts         Perfil en localStorage (useSyncExternalStore)
src/lib/usePrefs.ts           Idioma y traducción
src/components/               UI
public/sw.js                  Service worker escrito a mano
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
