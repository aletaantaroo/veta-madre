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
- **Ritmo pausado (v10):** las secciones aparecen poco a poco según subes de nivel (Mercado en el 3, Finanzas en el 4, Empresas en el 12, Bolsa en el 20…). El panel de **Producción** de la mina te dice cuánto sacas, si algo va mal y cómo arreglarlo. Los avisos son discretos y quedan en la **campana**. Copias de seguridad automáticas y partida descargable en un archivo.
- **Reloj y encargos (v11):** un día del juego dura 6 minutos; arriba ves la hora y el día (empieza en el Día 0). Los clientes dejan encargos en el tablón del Mercado (normales, urgentes, grandes pedidos y cadenas de tres entregas) con plazo en horas del juego; se entregan desde la mina y cada cliente te es más fiel cuanto más le cumples.
- **Minijuegos (v11.1):** sección propia desde el nivel 6. «Sube o baja» (apuesta rápida con tu caja), «Vagoneta desbocada» (corredor: salta rocas y agujeros) y «Voladura» (detona en el momento justo) gastan fichas (3 al día, se recargan a medianoche) y pagan según lo que produce tu mina. El trading con apalancamiento se mudó aquí desde el Mercado.
- **La mina se mueve (v11.2):** lo que compras baja por el pozo en la plataforma hasta su sitio; a las 06:00, 14:00 y 22:00 hay cambio de turno; al fondo del pozo hay una cámara de trabajo con tu gente y tu mejor máquina, y según tengas más mineros se abren tajos en los estratos que ya atravesaste. Un cubo sube el mineral desde el frente.
- **Ciudad de empresas (v12):** la sección Empresas es ahora una calle con un solar por negocio. Los edificios crecen con el nivel (más plantas, anexos en el 15 y el 25, cartel luminoso desde el 10), el gerente espera en la puerta y las que cotizan llevan bandera. Hay tráfico, gente y el mismo día y noche que la mina. Toca un edificio para ver su ficha.
- **Primeros pasos (v10.1):** la primera vez, el capataz y una flecha te enseñan a picar, vender y contratar. La tienda se pliega en una pestaña al borde y las mejoras van en desplegables por tipo.

### Ajustar el ritmo

Todo el ritmo depende de dos sitios:

- `js/data/content.js` → `PACE` (producción del equipo) y `CLICK_PACE` (golpes). Más alto = más rápido.
- `js/game/state.js` → `xpNeed` (experiencia por nivel). La experiencia se mide en «segundos de producción vendida», así que los niveles llegan a un ritmo parecido aunque la economía crezca mucho.
- Los niveles de cada desbloqueo están en `UNLOCKS` (`js/data/content.js`).

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
