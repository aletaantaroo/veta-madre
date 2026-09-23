# Veta Madre

Tycoon minero en el navegador. Empiezas con un pico y una veta de oro y acabas con tres minas, un mercado de metales con trading apalancado, seis empresas, una bolsa y un árbol de habilidades.

**Jugar:** abre la web de GitHub Pages del repositorio. La partida se guarda sola en tu navegador.

## Qué hay dentro

- **La mina viva:** un corte de la montaña donde aparece todo lo que compras: buscadores en el río, mineros, vagonetas, perforadoras, voladuras, excavadoras, tanques de lixiviación y tuneladoras. Arriba, la caja fuerte, las plantas, los paneles, los aerogeneradores y tus empresas. Hay día y noche.
- **Mercado:** oro, plata y cobre con precios que se mueven por noticias, datos económicos y una mina rival. Venta física, contratos, órdenes y trading en largo y corto.
- **Finanzas:** energía, combustible y explosivos, nóminas, moral, mantenimiento, préstamos e impuestos.
- **Empresas y bolsa:** negocios que trabajan solos, acciones con dividendos y salida a bolsa de tus propias empresas.
- **Progreso:** niveles, habilidades, logros, contrarreloj y venta de la compañía a cambio de lingotes de legado.
- **El descenso:** la mina baja estrato a estrato (arenisca, pizarra, granito, cuarzo, basalto y roca madre). Por el camino aparecen 30 hallazgos que se guardan en el **Museo**, con colecciones que dan ventajas permanentes, y unos cuantos secretos escondidos.

## Estructura

```
index.html          capa del juego (HUD, dock, ventanas)
css/                base, HUD, ventanas y capas superiores
js/main.js          arranque y bucle principal
js/core/            bus de eventos, formato, DOM y ajustes
js/data/content.js  metales, equipo, mejoras, empresas, logros…
js/game/            lógica: estado, economía, mercado, bolsa, empresas, progreso
js/render/          escena de la mina, sprites y gráficos
js/ui/              interfaz de cada sección, efectos, sonido y tutoriales
dist/veta-madre.html  el juego entero en un solo archivo (funciona sin servidor)
```

La lógica no toca la interfaz directamente: avisa por `core/bus.js` (`emit('sold')`, `emit('levelup')`…) y la interfaz decide cómo mostrarlo.

## Desarrollo

Los módulos ES necesitan un servidor (no funcionan con doble clic en `index.html`):

```
python3 -m http.server 8000     # y abre http://localhost:8000
```

Para abrirlo sin servidor usa `dist/veta-madre.html`.

Con Node instalado:

```
npm install
npm run imports   # regenera los import/export de cada módulo
npm run build     # crea dist/veta-madre.html en un solo archivo
```

Precios, noticias, clientes y empresas son ficticios.
