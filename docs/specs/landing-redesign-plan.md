# Landing redesign plan — Pettzi portfolio (borrador)

Objetivo: llevar `apps/landing` (https://fjbatresv.github.io/pettzi/) al nivel de
https://sdg19.fjbatresv.com, manteniéndolo como sitio estático (HTML/CSS + JS mínimo),
sin dependencias pesadas y con el build Nx actual (`nx build landing`, `nx lint landing`).

## Referencia (sdg19)
- Estructura: hero con titular grande + "ficha técnica" (proyecto/hoja/fecha/stack/escala),
  franja de métricas (números grandes), Architecture, Flows ("Follow an order"),
  Decisions, Quality (sección invertida), Docs, Contact (sección invertida), footer con metadatos.
- Estética "blueprint": fondo papel con retícula sutil, display sans pesada (Archivo),
  IBM Plex Sans para texto, JetBrains Mono para etiquetas; acento azul + CTA naranja.
- Toggle de idioma y de tema (claro/oscuro) en el header; reveal on scroll (7 elementos).
- SEO: JSON-LD `@graph` (WebSite + WebPage + Person con url), title con "| Portfolio".

## Brechas del landing actual
1. Sin franja de métricas ni ficha técnica: no comunica escala ni resultados.
2. Faltan secciones de valor: flujos (p. ej. "sigue un recordatorio": EventBridge → Lambda → SES),
   decisiones de arquitectura (trade-offs), calidad (cobertura ≥80 %, OpenAPI, lint, CI, seguridad),
   documentación (README, ARCHITECTURE, TABLE_DESIGN, DESIGN-SYSTEM) y contacto/CTA a fjbatresv.com.
3. Tipografía pequeña: cuerpo 11–14 px, etiquetas 7–10 px (incumple mínimo 16 px cuerpo / 12 px labels).
4. Sin toggle de tema (el CSS ya soporta `data-theme`) ni navegación móvil (`.nav` se oculta en ≤640 px).
5. Iconos con glifos (✳ ↗ ↓) en lugar de SVG; ticker sin pausa para reduced-motion fuera del media query.
6. Diagrama SVG con colores fijos (`#827f73`) y scroll horizontal en 640–900 px.
7. SEO: JSON-LD sólo `SoftwareSourceCode`; falta `@graph` WebSite/WebPage/Person, Person sin `url`;
   fuentes de Google sin `preload`; 404 sólo en inglés; OG image genérica.

## Dirección de diseño
Mantener la identidad cálida de Pettzi (papel, terracota, Newsreader) pero adoptar el rigor
"cuaderno técnico" de sdg19: retícula de fondo sutil, ficha de campo como "title block",
números grandes en mono/display, secciones invertidas (verde oscuro) para Calidad y Contacto.
Evitar copiar la marca/colores de sdg19 — sólo el nivel de estructura y acabado.

## Tareas (una por commit, `feat(landing): ...`)
1. Tokens y tipografía: escala 12/14/16/18/24/32/48/72, cuerpo ≥16 px, labels ≥12 px,
   retícula de fondo con CSS, colores del SVG vía variables, toggle de tema con `localStorage` en try/catch.
2. Header: nav con estado activo, menú móvil accesible (botón con `aria-expanded`), toggle ES/EN y tema.
3. Hero: título + "title block" (proyecto, dominios, stack, estado) + franja de métricas reales
   del repo (nº de APIs/dominios, stacks CDK, cobertura objetivo, idiomas).
4. Nuevas secciones: Flujos (2 recorridos paso a paso), Decisiones (4–6 ADR cortos con trade-off),
   Calidad (sección invertida), Documentación (tarjetas a los .md), Contacto (CTA a fjbatresv.com).
5. Iconos SVG inline consistentes (stroke 1.5) en vez de glifos; reveal on scroll con
   IntersectionObserver, contenido visible sin JS, respetando `prefers-reduced-motion`.
6. Diagrama: responsive sin scroll horizontal (versión vertical desde 900 px).
7. SEO: JSON-LD `@graph` (WebSite, WebPage, Person con url, SoftwareSourceCode, BreadcrumbList),
   preload de fuente display, OG image nueva 1200×630 ≤100 KB, 404 bilingüe con noindex y sin canonical,
   `lastmod` en sitemap. Ampliar `check.mjs` para validar todo lo anterior.
8. QA: `nx build landing && nx lint landing`, revisión visual a 375/768/1440 px en claro y oscuro,
   contraste ≥4.5:1, sin overflow horizontal, paridad de contenido EN/ES.

## Datos reales del repo (para métricas y ficha)
- 8 APIs de dominio con su propio stack CDK: auth, pets, owners, events, reminders, routines, uploads, catalogs.
  (El diagrama actual omite `routines` — añadirlo.)
- 18 stacks CDK en `apps/cdk/src`, 8 contratos OpenAPI (`libs/api-*/openapi/*.yml`).
- Objetivo de cobertura ≥ 80 % por archivo tocado (AGENTS.md), Node.js 24, workflows CI + Snyk + Pages.
- Contacto: mismo patrón que sdg19 (CTA a https://fjbatresv.com y el correo público que muestra sdg19).

## Estado de implementación
- [x] 1. Tokens, tipografía, retícula y tema claro/oscuro persistido.
- [x] 2. Navegación activa, menú móvil accesible e idiomas.
- [x] 3. Hero, ficha de proyecto y métricas verificadas en el repositorio.
- [x] 4. Enfoque, arquitectura, flujos, decisiones, calidad, documentos y contacto bilingües.
- [x] 5. Iconos SVG, revelado con IntersectionObserver y movimiento reducido.
- [x] 6. Diagrama HTML responsivo sin desplazamiento horizontal.
- [x] 7. Metadatos, JSON-LD, imagen OG, 404 bilingüe y sitemap.
- [x] 8. QA: `nx build landing` y `nx lint landing` pasan; EN/ES se revisaron a 375, 768 y 1440 px en ambos temas, sin overflow horizontal.

Desviación: el diagrama usa HTML/CSS en vez de un SVG escalable; conserva la misma información y evita scroll horizontal entre móvil, tablet y escritorio.
