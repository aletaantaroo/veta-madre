import { totalOwned } from '../game/mining.js';
import { S, bizCount, bizLvl, gpsEq, has, unl } from '../game/state.js';

export const SAVE_KEY = 'veta-madre-v1';
export const SPREAD = 0.004, TPC = 10, NSLOTS = 180;


/* ================= contenido ================= */
export const METALS = {
  au:{name:'Oro',   low:'oro',   p0:80,   sig:.011, fvol:.0008, capBase:5,     yld:1,    lv:1,  open:0,      line:'#e4b84c', ink:'#241a05', vein:['#8a6a1f','#d9ad44'], fl:['#e4b84c','#c9982f'], glow:'255,215,110', txt:'#f5d783'},
  ag:{name:'Plata', low:'plata', p0:1,    sig:.018, fvol:.0011, capBase:400,   yld:1.15, lv:8,  open:20000,  line:'#cdd5d9', ink:'#1a2023', vein:['#5f676b','#d5dbde'], fl:['#e3e8ea','#aab3b8'], glow:'220,230,235', txt:'#eef3f4'},
  cu:{name:'Cobre', low:'cobre', p0:.01,  sig:.009, fvol:.0007, capBase:40000, yld:1.3,  lv:15, open:400000, line:'#dd8c56', ink:'#2a1206', vein:['#6b3519','#d98a55'], fl:['#e39a66','#b8683a'], glow:'240,160,110', txt:'#f3b68c'},
  pt:{name:'Platino', low:'platino', p0:30, sig:.014, fvol:.0009, capBase:12,   yld:1.45, lv:18, open:2.5e7,  line:'#a9b7de', ink:'#141a2a', vein:['#4f5a78','#c7d2ee'], fl:['#d5def5','#8f9cc0'], glow:'200,210,245', txt:'#dfe6ff'},
};
export const MK = ['au','ag','cu','pt'];
/* Un día del juego dura 6 minutos reales (1 hora = 15 s). De 06:00 a 18:00 es de día. */
export const DAY_LEN = 360;
export const CREW = [
  {id:'batea',    name:'Buscador con batea',     plural:'Los buscadores', desc:'Criba la grava del arroyo a mano.',                 cost:15,    gps:0.0025},
  {id:'pico',     name:'Minero con pico',        plural:'Los mineros',    desc:'Sigue la veta a golpe de pico.',                      cost:100,   gps:0.02},
  {id:'vagoneta', name:'Vagoneta sobre raíles',  plural:'Las vagonetas',  desc:'Saca el mineral del túnel sin cargarlo a hombros.',   cost:1100,  gps:0.18},
  {id:'perfo',    name:'Perforadora neumática',  plural:'Las perforadoras',desc:'Abre barrenos en la roca más dura.',                 cost:12000, gps:1.1},
  {id:'voladura', name:'Equipo de voladura',     plural:'Los equipos de voladura', desc:'Fractura el frente con cargas controladas.', cost:130000, gps:6.5},
  {id:'excav',    name:'Excavadora de cantera',  plural:'Las excavadoras',desc:'Mueve toneladas de mineral cada hora.',              cost:1.4e6, gps:38},
  {id:'lix',      name:'Planta de lixiviación',  plural:'Las plantas',    desc:'Extrae el metal fino que el ojo no ve.',              cost:2e7,   gps:260},
  {id:'tbm',      name:'Tuneladora',             plural:'Las tuneladoras',desc:'Un gusano de acero que no descansa nunca.',           cost:3.3e8, gps:2000},
];
const CREW_OPS = {batea:{sal:.2}, pico:{sal:.2}, vagoneta:{sal:.1,e:1}, perfo:{sal:.1,e:1}, voladura:{sal:.1,e:1,x:1}, excav:{sal:.1,e:1,f:1}, lix:{sal:.1,e:1}, tbm:{sal:.1,e:1,f:1,x:1}};
/* Ritmo global (v10): la producción va 2,5 veces más despacio que en la v9; los golpes, algo menos. */
export const PACE = 0.4, CLICK_PACE = 0.6;
CREW.forEach(c => { Object.assign(c, CREW_OPS[c.id]); c.gps *= PACE; });
const TIERS = {
  batea:['Batea de chapa','Canal de lavado'], pico:['Mangos de fresno','Turnos de noche'],
  vagoneta:['Raíles de acero','Cabrestante eléctrico'], perfo:['Brocas de diamante','Compresor doble'],
  voladura:['Detonadores electrónicos','Geólogo de guardia'], excav:['Cazo reforzado','Flota de volquetes'],
  lix:['Carbón activado','Circuito cerrado de agua'], tbm:['Cabeza de corte nueva','Operación 24/7'],
};
export const UP = [
  {id:'u_pico',     kind:'Mina',    name:'Pico de acero templado', desc:'Tus golpes arrancan el doble.', cost:50, req:()=>true},
  {id:'u_broker',   kind:'Mercado', name:'Cuenta en un bróker', desc:'Abre el Trading de Minijuegos: largo y corto con apalancamiento 1:5.', cost:300, req:()=>unl('trading')},
  {id:'u_analista', kind:'Mercado', name:'Analista de mercado', desc:'Media móvil, fase del mercado y aviso cuando el precio está alto o bajo.', cost:400, req:()=>unl('mercado') && S.earned>=150},
  {id:'u_casco',    kind:'Mina',    name:'Casco con linterna', desc:'Ves mejor la veta: golpes ×2.', cost:600, req:()=>S.clicks>=40},
  {id:'u_agente',   kind:'Mercado', name:'Agente de ventas', desc:'Abre la pestaña Órdenes: ventas automáticas por precio y al llenarse el almacén.', cost:1200, req:()=>unl('mercado') && S.earned>=500},
  {id:'u_bollinger',kind:'Mercado', name:'Bandas de Bollinger', desc:'La banda en la que suele moverse el precio (media ± 2 desviaciones).', cost:2500, req:()=>has('u_analista')},
  {id:'u_detector', kind:'Mina',    name:'Detector de metales', desc:'Cada golpe suma además el 5 % de tu producción por segundo.', cost:4000, req:()=>gpsEq()>=0.02},
  {id:'u_informante',kind:'Mercado',name:'Informante en el banco central', desc:'Antes de cada dato económico te dice hacia dónde cree que irán los metales.', cost:5000, req:()=>unl('trading') && S.earned>=3000},
  {id:'u_rsi',      kind:'Mercado', name:'Oscilador RSI', desc:'Mide si el precio viene de subir o bajar demasiado rápido (sobrecompra > 70, sobreventa < 30).', cost:6000, req:()=>has('u_bollinger')},
  {id:'u_tasador',  kind:'Mercado', name:'Tasador propio', desc:'La comisión al vender metal físico baja del 3 % al 1 %.', cost:7500, req:()=>unl('mercado') && S.earned>=2500},
  {id:'u_guantes',  kind:'Mina',    name:'Guantes de cuero curtido', desc:'Golpes ×2.', cost:9000, req:()=>S.clicks>=250},
  {id:'u_londres',  kind:'Mercado', name:'Mesa en la bolsa de Londres', desc:'Más compradores: vender mucho de golpe mueve el precio tres veces menos.', cost:15000, req:()=>unl('mercado') && S.earned>=8000},
  {id:'u_pro',      kind:'Mercado', name:'Cuenta profesional', desc:'Desbloquea el apalancamiento 1:20.', cost:20000, req:()=>has('u_broker') && S.trades>=10},
  {id:'u_martillo', kind:'Mina',    name:'Martillo percutor', desc:'Golpes ×2.', cost:250000, req:()=>S.clicks>=800},
];
CREW.forEach(c => TIERS[c.id].forEach((n,i) => {
  const need = i ? 10 : 1;
  UP.push({id:`u_${c.id}_${i}`, kind:'Equipo', name:n, desc:`${c.plural} producen el doble.`, cost:c.cost*(i?100:10), req:()=>(S.owned[c.id]||0)>=need});
}));
UP.push(
  {id:'u_comedor', kind:'Operaciones', name:'Comedor para la plantilla', desc:'Cada nómina pagada sube más la moral (+25 en vez de +10).', cost:3000, req:()=>totalOwned()>=10},
  {id:'u_taller',  kind:'Operaciones', name:'Taller propio', desc:'Tus máquinas se desgastan la mitad de rápido.', cost:15000, req:()=>(S.owned.vagoneta||0)>=1},
  {id:'u_ahorro',  kind:'Operaciones', name:'Motores eficientes', desc:'Tus máquinas gastan un 25 % menos de energía.', cost:25000, req:()=>(S.owned.perfo||0)>=1},
  {id:'u_asesor',  kind:'Operaciones', name:'Asesor fiscal', desc:'Pagas un 5 % de impuestos en vez de un 10 %.', cost:60000, req:()=>unl('taxes')},
);
UP.sort((a,b)=>a.cost-b.cost);
export const CLICK_UPS = ['u_pico','u_casco','u_guantes','u_martillo'];

export const NEWS = {
  au:[['Tensión geopolítica: los inversores buscan refugio en el oro', .07],['Un banco central anuncia compras récord de oro', .09],['Los joyeros adelantan pedidos antes de las fiestas', .04],
      ['Huelga en varias minas rivales: se reduce la oferta', .06],['El dólar se fortalece y el oro pierde atractivo', -.05],['Rumores de un yacimiento gigante en el hemisferio sur', -.06],
      ['Los grandes fondos recogen beneficios en oro', -.04],['Jornada tranquila en el oro', 0]],
  ag:[['La industria solar dispara la demanda de plata', .08],['Escasez de plata en los almacenes de Londres', .07],['Nueva mina de plata entra en producción en los Andes', -.07],
      ['Los especuladores abandonan la plata tras semanas de subidas', -.08],['Jornada tranquila en la plata', 0]],
  cu:[['Boom de la construcción: el cobre se dispara', .06],['Los coches eléctricos necesitan más cable que nunca', .05],['Frenazo industrial: cae la demanda de cobre', -.06],
      ['Los almacenes de cobre se llenan', -.04],['Jornada tranquila en el cobre', 0]],
  pt:[['Los fabricantes de coches compran platino para sus catalizadores', .07],['La industria del hidrógeno dispara la demanda de platino', .08],['Las minas sudafricanas recuperan su producción de platino', -.07],
      ['Los coches eléctricos restan demanda al platino', -.05],['Jornada tranquila en el platino', 0]],
};
export const EVENTS = [
  {name:'Dato de inflación', big:.08, eff:{au:1, ag:1, cu:.3, pt:.6}, pos:'La inflación sale más alta de lo esperado', neg:'La inflación se modera más de lo previsto'},
  {name:'Decisión de tipos del banco central', big:.10, eff:{au:1, ag:1.2, cu:.5, pt:.8}, pos:'El banco central baja los tipos por sorpresa', neg:'El banco central sube los tipos más de lo esperado'},
  {name:'Informe de empleo', big:.06, eff:{au:1, ag:.7, cu:-1, pt:-.5}, pos:'El empleo decepciona y crece la incertidumbre', neg:'El empleo sorprende al alza y la economía gana confianza'},
  {name:'Índice de actividad industrial', big:.07, eff:{au:-.3, ag:.6, cu:1.4, pt:1.1}, pos:'La industria acelera con fuerza', neg:'La actividad industrial se frena'},
  {name:'Subasta de reservas de oro', big:.07, eff:{au:1, ag:.3, cu:0, pt:.2}, pos:'La subasta de reservas queda desierta: sobran compradores', neg:'La subasta inunda el mercado de oro'},
];
export const REGIMES = [
  {name:'Fase alcista', mu:.00035, vol:1, tone:'up'},
  {name:'Fase bajista', mu:-.00035, vol:1, tone:'down'},
  {name:'Mercado lateral', mu:0, vol:.8, tone:''},
  {name:'Mercado nervioso', mu:0, vol:1.8, tone:''},
];
/* Clientes de los encargos: cada uno pide sus metales, tiene su carácter y te es más fiel cuantas más veces le cumples. */
export const CLIENTS = [
  {id:'ortega',  name:'Joyería Ortega',        ico:'coin',    col:'#ffc62e', m:['au'],      txt:'Encargos pequeños y bien pagados. No soporta los retrasos.'},
  {id:'salvat',  name:'Relojería Salvat',      ico:'clock',   col:'#ff9636', m:['au','ag'], txt:'Siempre con prisa: pide muchos encargos urgentes.', urgent:.35},
  {id:'banco',   name:'Banco del Norte',       ico:'bank',    col:'#3ea8ff', m:['au'],      txt:'Pedidos enormes para sus reservas, con mucho plazo.', big:.35},
  {id:'rios',    name:'Numismática Ríos',      ico:'star',    col:'#a06bff', m:['au','ag'], txt:'Monedas conmemorativas: le encantan los pedidos en cadena.', chain:.3},
  {id:'galan',   name:'Filigrana Galán',       ico:'helmet',  col:'#ff5b4f', m:['au','ag','pt'], txt:'Artesanos exigentes: pagan un extra por la calidad.', prem:.03},
  {id:'brisa',   name:'Paneles Solares Brisa', ico:'sun',     col:'#2cd3c6', m:['ag'],      txt:'Necesita plata para sus células solares.'},
  {id:'neon',    name:'Electrónica Neón',      ico:'bolt',    col:'#3fcf6c', m:['ag','cu'], txt:'Plata y cobre para circuitos. Encadena pedidos si le caes bien.', chain:.2},
  {id:'levante', name:'Cableados Levante',     ico:'factory', col:'#ff8a4c', m:['cu'],      txt:'Cobre por toneladas.', big:.3},
  {id:'iberica', name:'Fundición Ibérica',     ico:'wrench',  col:'#9a7a57', m:['cu','ag'], txt:'Compra lo que le eches, aunque regatea un poco.', prem:-.01},
  {id:'catalis', name:'Catalizadores Íbero',   ico:'gear',    col:'#8f9cc0', m:['pt'],      txt:'Platino para los tubos de escape de media Europa. Pedidos grandes.', big:.3},
];
/* Tipos de encargo. mult: cantidad respecto a uno normal · prem: prima sobre el spot · t: plazo en segundos reales (15 s = 1 hora del juego) · xp: experiencia por euro · rep: reputación. */
export const JOB_KINDS = {
  normal:  {name:'Encargo',     mult:[1, 1],     prem:[.02, .07], t:[90, 240],  xp:1,   rep:.5},
  urgente: {name:'¡Urgente!',   mult:[.4, .6],   prem:[.15, .25], t:[40, 75],   xp:1.2, rep:.75, lv:6},
  grande:  {name:'Gran pedido', mult:[3, 5],     prem:[.08, .12], t:[360, 600], xp:1, rep:.75, lv:9},
  cadena:  {name:'Cadena',      mult:[.8, 1.1],  prem:[.05, .09], t:[120, 200], xp:1,   rep:.25, lv:7, steps:3, bonus:.25},
};
export const STRATA = [
  {name:'Arenisca',   to:40,   base:'#8b6b4c', hi:'#a98863', lo:'#5d4531'},
  {name:'Pizarra',    to:150,  base:'#4f585c', hi:'#6c767b', lo:'#333a3d'},
  {name:'Granito',    to:500,  base:'#7b736d', hi:'#9b928b', lo:'#4d4743'},
  {name:'Cuarzo',     to:1500, base:'#a8a295', hi:'#cdc8bc', lo:'#76716a'},
  {name:'Basalto',    to:4000, base:'#3d3c40', hi:'#58575c', lo:'#252427'},
  {name:'Roca madre', to:Infinity, base:'#5c3d36', hi:'#7c564b', lo:'#3a2521'},
];
/* Desbloqueos por nivel. Con «sec» aparece además un botón nuevo en el dock. */
export const UNLOCKS = [
  {lv:2,  key:'habilidades', sec:'habilidades', txt:'Habilidades: gasta tus puntos'},
  {lv:2,  key:'logros',    sec:'logros',   txt:'Logros y estadísticas'},
  {lv:3,  key:'mercado',   sec:'mercado',  txt:'Mercado: gráfico de precios'},
  {lv:3,  key:'power',     txt:'Power-ups en la mina'},
  {lv:4,  key:'finanzas',  sec:'finanzas', txt:'Finanzas: tus cuentas'},
  {lv:5,  key:'contracts', txt:'Encargos de clientes'},
  {lv:6,  key:'minigames', sec:'minijuegos', txt:'Minijuegos: apuesta, vagoneta y voladura'},
  {lv:7,  key:'loans',     txt:'Préstamos bancarios'},
  {lv:8,  key:'ag',        txt:'Yacimiento de plata'},
  {lv:10, key:'trading',   txt:'Trading con apalancamiento (en Minijuegos)'},
  {lv:11, key:'taxes',     txt:'Hacienda te encuentra: impuestos cada 5 min'},
  {lv:12, key:'biz',       sec:'empresas', txt:'La ciudad de empresas'},
  {lv:15, key:'cu',        txt:'Yacimiento de cobre'},
  {lv:18, key:'pt',        txt:'Yacimiento de platino'},
  {lv:20, key:'stocks',    sec:'bolsa',    txt:'Bolsa de valores'},
  {lv:21, key:'ipo',       txt:'Sacar tus empresas a bolsa'},
  {lv:22, key:'prestige',  txt:'Vender la compañía con bonus'},
];
/* Árbol de habilidades. t: fila (0 arriba). req: todas; reqAny: basta una. ex: grupo excluyente (solo una del grupo). */
export const SKILLS = [
  {b:'m', id:'m1', t:0, name:'Brazo fuerte', desc:'Golpes +50 %.', cost:1, req:[]},
  {b:'m', id:'m2', t:1, name:'Ojo para la veta', desc:'Las pepitas salen más a menudo y valen el doble.', cost:1, req:['m1']},
  {b:'m', id:'m3', t:1, name:'Capataz', desc:'Producción del equipo +20 %.', cost:2, req:['m1']},
  {b:'m', id:'m4', t:2, name:'Almacén eficiente', desc:'Ampliar la caja fuerte cuesta un 30 % menos.', cost:2, req:['m3']},
  {b:'m', id:'m5', t:2, name:'Turnos dobles', desc:'Producción del equipo +30 %.', cost:3, req:['m3']},
  {b:'m', id:'m6', t:3, name:'Geología avanzada', desc:'La plata y el cobre rinden un 25 % más.', cost:3, req:['m5']},
  {b:'m', id:'m7', t:3, name:'Veta madre', desc:'Producción del equipo ×1,5.', cost:5, req:['m5','m2']},
  {b:'m', id:'m8', t:4, ex:'m-x', name:'Pozo profundo', desc:'El frente baja mucho más rápido: llegas antes a los hallazgos hondos.', cost:4, req:['m7']},
  {b:'m', id:'m9', t:4, ex:'m-x', name:'Cantera a cielo abierto', desc:'Buscadores, mineros y vagonetas producen el triple.', cost:4, req:['m7']},
  {b:'m', id:'m10', t:5, cap:true, name:'Leyenda del pico', desc:'Producción ×1,5 y las cajas fuertes guardan el doble.', cost:6, req:[], reqAny:['m8','m9']},
  {b:'t', id:'t1', t:0, name:'Buen regateo', desc:'La comisión al vender metal baja un 40 %.', cost:1, req:[]},
  {b:'t', id:'t2', t:1, name:'Lectura del mercado', desc:'El diferencial del trading se reduce a la mitad.', cost:1, req:['t1']},
  {b:'t', id:'t3', t:1, name:'Contactos', desc:'Los encargos pagan un 3 % más y llegan antes.', cost:2, req:['t1']},
  {b:'t', id:'t4', t:2, name:'Fuentes fiables', desc:'Tu informante acierta 9 de cada 10 veces.', cost:2, req:['t2']},
  {b:'t', id:'t5', t:2, name:'Espía en la competencia', desc:'Ves cuánto oro acumula Minas del Cierzo antes de soltarlo.', cost:2, req:['t3']},
  {b:'t', id:'t6', t:3, name:'Sangre fría', desc:'Desbloquea el apalancamiento 1:50.', cost:3, req:['t2']},
  {b:'t', id:'t7', t:3, name:'Lobo de la bolsa', desc:'Sin comisiones en bolsa y dividendos +50 %.', cost:4, req:['t4','t5']},
  {b:'t', id:'t8', t:4, ex:'t-x', name:'Cartera de clientes', desc:'Llevas 4 encargos a la vez y los clientes te cogen confianza el doble de rápido.', cost:4, req:['t7']},
  {b:'t', id:'t9', t:4, ex:'t-x', name:'Especulador', desc:'«Sube o baja» paga ×2 en vez de ×1,9 y puedes apostar el triple.', cost:4, req:['t7']},
  {b:'t', id:'t10', t:5, cap:true, name:'Magnate del metal', desc:'Vendes tu metal un 10 % más caro y tus ventas grandes mueven la mitad el precio.', cost:6, req:[], reqAny:['t8','t9']},
  {b:'e', id:'e1', t:0, name:'Emprendedor', desc:'Abrir y mejorar empresas cuesta un 15 % menos.', cost:1, req:[]},
  {b:'e', id:'e2', t:1, name:'Buen jefe', desc:'Ingresos de empresas +25 %.', cost:1, req:['e1']},
  {b:'e', id:'e3', t:1, name:'Delegar', desc:'Los gerentes cuestan la mitad.', cost:2, req:['e1']},
  {b:'e', id:'e4', t:2, name:'Sinergias', desc:'La joyería paga un 15 % más por tu oro y la refinería rinde el doble.', cost:2, req:['e2']},
  {b:'e', id:'e5', t:2, name:'Marketing', desc:'Ingresos de empresas +40 %.', cost:3, req:['e2','e3']},
  {b:'e', id:'e6', t:3, name:'Banca de inversión', desc:'Sacar una empresa a bolsa te da un 30 % más de dinero.', cost:3, req:['e5']},
  {b:'e', id:'e7', t:3, name:'Magnate', desc:'Ingresos de empresas ×1,5.', cost:5, req:['e5','e4']},
  {b:'e', id:'e8', t:4, ex:'e-x', name:'Franquicias', desc:'Abrir y mejorar empresas cuesta un 30 % menos (además de Emprendedor).', cost:4, req:['e7']},
  {b:'e', id:'e9', t:4, ex:'e-x', name:'Monopolio', desc:'Tu empresa de más nivel produce el triple.', cost:4, req:['e7']},
  {b:'e', id:'e10', t:5, cap:true, name:'Imperio', desc:'Cada empresa abierta suma un 5 % a la producción de la mina.', cost:6, req:[], reqAny:['e8','e9']},
  {b:'o', id:'o1', t:0, name:'Buen ambiente', desc:'La moral se recupera el doble de rápido y una nómina impagada la baja la mitad.', cost:1, req:[]},
  {b:'o', id:'o2', t:1, name:'Ahorro energético', desc:'Las máquinas gastan un 20 % menos de energía.', cost:1, req:['o1']},
  {b:'o', id:'o3', t:1, name:'Mantenimiento preventivo', desc:'La maquinaria se desgasta un 40 % menos.', cost:2, req:['o1']},
  {b:'o', id:'o4', t:2, name:'Logística', desc:'Combustible y explosivos: un 25 % menos de consumo.', cost:2, req:['o2']},
  {b:'o', id:'o5', t:2, name:'Horas extra', desc:'Los minijuegos sorpresa salen un 50 % más a menudo.', cost:3, req:['o3']},
  {b:'o', id:'o6', t:3, name:'Negociador', desc:'Las nóminas cuestan un 20 % menos.', cost:3, req:['o4']},
  {b:'o', id:'o7', t:3, name:'Turno de noche', desc:'De noche (de 18:00 a 06:00) la mina produce un 25 % más.', cost:4, req:['o4','o5']},
  {b:'o', id:'o8', t:4, ex:'o-x', name:'Autonomía energética', desc:'Paneles y aerogeneradores producen el doble.', cost:4, req:['o7']},
  {b:'o', id:'o9', t:4, ex:'o-x', name:'Contrato con la eléctrica', desc:'Pagas la luz siempre a tarifa valle, también de día.', cost:4, req:['o7']},
  {b:'o', id:'o10', t:5, cap:true, name:'Jefe de obra legendario', desc:'La maquinaria ya no se desgasta y la moral nunca baja del 60 %.', cost:6, req:[], reqAny:['o8','o9']},
];
export const BRANCHES = [
  {k:'m', name:'Minero', col:'orange', ico:'pick', desc:'Más producción, mejores pepitas y almacenes más baratos.'},
  {k:'t', name:'Comerciante', col:'blue', ico:'chart', desc:'Vender mejor, encargos, información y trading.'},
  {k:'e', name:'Empresario', col:'purple', ico:'factory', desc:'Empresas más baratas y rentables.'},
  {k:'o', name:'Jefe de obra', col:'green', ico:'helmet', desc:'Plantilla, energía, mantenimiento y noches productivas.'},
];
/* Combinaciones entre ramas que dan un extra cuando tienes las dos habilidades. */
export const SYNERGIES = [
  {id:'joyero',  name:'Joyero de la casa',     req:['m2','e4'], desc:'La joyería paga un 20 % más por tu oro.'},
  {id:'pico',    name:'Pico y pala',           req:['m5','o7'], desc:'Producción de la mina +15 %.'},
  {id:'equipo',  name:'Trabajo en equipo',     req:['m3','o1'], desc:'Nóminas un 10 % más baratas.'},
  {id:'cautivo', name:'Mercado cautivo',       req:['t3','e2'], desc:'Los encargos pagan un 5 % más.'},
  {id:'cadena',  name:'Cadena de suministro',  req:['e5','o4'], desc:'Ingresos de empresas +15 %.'},
  {id:'wall',    name:'Lobo de Wall Street',   req:['t7','e6'], desc:'Dividendos +25 %.'},
];
export const syn = id => { const X = SYNERGIES.find(x => x.id === id); return !!X && X.req.every(r => S.skills && S.skills[r]); };
/* ---- ciudad de empresas (v14) ----
   Cada empresa tiene un solar en el mapa (cell: esquina del solar en el plano de 1440 × 900), un barrio, cinco etapas
   (el edificio cambia en los niveles 1, 5, 10, 20 y 30) y tres anexos que se abren en las etapas II, III y IV.
   Para añadir una empresa nueva basta con otra entrada aquí (y su dibujo en render/cityArt.js; si no lo tiene, sale uno genérico).
   Los costes y los ingresos de la v14 están ajustados a lo que gana la mina cuando se desbloquea cada una. */
export const BIZ_STAGE_LV = [1, 5, 10, 20, 30];
export const DISTRICTS = {centro: {name: 'Centro', en: 'el centro'}, poligono: {name: 'Polígono industrial', en: 'el polígono industrial'}, parque: {name: 'Parque tecnológico', en: 'el parque tecnológico'}};
export const ROMAN = ['—', 'I', 'II', 'III', 'IV', 'V'];
export const BIZ = [
  {id:'joyeria',    name:'Joyería',             lv:12, cost:4e4,  inc:60,    district:'centro',   cell:[70, 200],  badge:'#ff5fa8', ground:'#9fdc7c',
   desc:'Convierte parte de tu oro en joyas y las vende un 30 % por encima del spot. Cuanto más nivel, más oro procesa.',
   stages:['Puesto', 'Tienda', 'Boutique', 'Galería', 'Casa de joyas'],
   anexos:[{id:'escaparate', name:'Escaparate de lujo', fx:'Las joyas se venden un 10 % más caras'},
           {id:'engaste',    name:'Taller de engaste',  fx:'Gasta un 20 % menos de oro por joya'},
           {id:'seguridad',  name:'Seguridad privada',  fx:'Las averías e inspecciones no le afectan'}]},
  {id:'refineria',  name:'Refinería',           lv:13, cost:4e5,  inc:450,   district:'poligono', cell:[70, 560],  badge:'#6b7785', ground:'#d6d1c6',
   desc:'Cada nivel sube un 2 % el precio al que vendes tu metal físico (hasta +40 %).',
   stages:['Taller', 'Fundición', 'Refino', 'Planta', 'Complejo metalúrgico'],
   anexos:[{id:'horno',  name:'Horno de arco',          fx:'Ingresos de la refinería +15 %'},
           {id:'pureza', name:'Laboratorio de pureza',  fx:'Tu metal se vende un 5 % más caro'},
           {id:'tren',   name:'Apartadero de tren',     fx:'Sus gastos fijos bajan un 25 %'}]},
  {id:'transporte', name:'Transporte blindado', lv:15, cost:3e6,  inc:3300,  district:'poligono', cell:[425, 560], badge:'#e0950b', ground:'#d6d1c6',
   desc:'Cada nivel amplía un 20 % todas tus cajas fuertes.',
   stages:['Garaje', 'Nave', 'Base', 'Centro logístico', 'Central de valores'],
   anexos:[{id:'taller',     name:'Taller mecánico', fx:'Sus gastos fijos bajan un 20 %'},
           {id:'escolta',    name:'Escolta armada',  fx:'Los encargos nuevos dan un 25 % más de plazo'},
           {id:'helipuerto', name:'Helipuerto',      fx:'Cajas fuertes un 25 % más grandes'}]},
  {id:'inmo',       name:'Inmobiliaria',        lv:17, cost:5e7,  inc:5.5e4, district:'centro',   cell:[770, 200], badge:'#12918a', ground:'#9fdc7c',
   desc:'Alquileres: ingresos estables y sin sorpresas.',
   stages:['Oficina', 'Adosados', 'Bloque de pisos', 'Urbanización', 'Rascacielos'],
   anexos:[{id:'ventas',    name:'Oficina de ventas',   fx:'Ingresos de la inmobiliaria +15 %'},
           {id:'piscina',   name:'Piscina comunitaria', fx:'Alquileres un 10 % más caros'},
           {id:'hipotecas', name:'Hipotecas propias',   fx:'Tus préstamos pagan un 30 % menos de interés'}]},
  {id:'banco',      name:'Banco',               lv:19, cost:5e8,  inc:5.5e5, district:'centro',   cell:[425, 200], badge:'#c9ab7c', ground:'#9fdc7c',
   desc:'Presta a otras empresas: ingresos altos y constantes.',
   stages:['Sucursal', 'Banco', 'Sede', 'Torre financiera', 'Banco central'],
   anexos:[{id:'cajero', name:'Cajero automático', fx:'Ingresos del banco +10 %'},
           {id:'camara', name:'Cámara acorazada',  fx:'Tu efectivo rinde un 1 % cada día (hasta 1 min de ingresos)'},
           {id:'mesa',   name:'Mesa de inversión', fx:'Dividendos de la bolsa +20 %'}]},
  {id:'tec',        name:'Tecnológica',         lv:21, cost:4e9,  inc:3.5e6, district:'parque',   cell:[770, 560], badge:'#3ea8ff', ground:'#9fdc7c',
   desc:'Ingresos enormes pero muy variables: su rendimiento cambia cada minuto.',
   stages:['Garaje', 'Coworking', 'Campus', 'Sede circular', 'Torre tecnológica'],
   anexos:[{id:'datos',  name:'Centro de datos',    fx:'Nunca rinde por debajo del 80 %'},
           {id:'idi',    name:'Laboratorio de I+D', fx:'+1 punto de habilidad'},
           {id:'antena', name:'Antena 5G',          fx:'Los eventos buenos de tus empresas duran el doble'}]},
];
/* Vecinos: dos empresas que comparten calle se ayudan cuando las dos están abiertas. */
export const VECINOS = [
  {a:'joyeria',   b:'banco',      name:'Joyas a crédito',       fx:{joyeria:.15},             txt:'la joyería gana un 15 % más'},
  {a:'banco',     b:'inmo',       name:'Hipotecas',             fx:{inmo:.15},                txt:'la inmobiliaria gana un 15 % más'},
  {a:'refineria', b:'transporte', name:'Metal blindado',        fx:{refineria:.1, transporte:.1}, txt:'+10 % de ingresos a las dos'},
  {a:'transporte',b:'tec',        name:'Logística inteligente', fx:{transporte:.1, tec:.1},   txt:'+10 % de ingresos a las dos'},
];
export const STOCKS = [
  {id:'CIE', name:'Minas del Cierzo',     sector:'Minería de oro',   p:42,  vol:.005, mu:.00004, beta:{au:1.3}, div:0,     desc:'Tu rival. Se mueve con el oro, pero más fuerte.'},
  {id:'ARG', name:'Argenta Metales',      sector:'Minería de plata', p:18,  vol:.006, mu:.00003, beta:{ag:1.2}, div:.001,  desc:'Sigue a la plata con fuerza.'},
  {id:'CDN', name:'Cobres del Norte',     sector:'Minería de cobre', p:27,  vol:.005, mu:.00004, beta:{cu:1.1}, div:.002,  desc:'Sigue al cobre y a la economía.'},
  {id:'MER', name:'Banco Meridiano',      sector:'Banca',            p:64,  vol:.003, mu:.00003, beta:{},       div:.004,  desc:'Tranquila y con buen dividendo.'},
  {id:'NUB', name:'Nubia Tech',           sector:'Tecnología',       p:120, vol:.008, mu:.00008, beta:{},       div:0,     desc:'Mucho crecimiento, mucha volatilidad, sin dividendo.'},
  {id:'SOL', name:'Energía Solaris',      sector:'Energía',          p:35,  vol:.004, mu:.00005, beta:{cu:.4},  div:.003,  desc:'Renovables: necesita cobre y paga dividendo.'},
  {id:'ATL', name:'Construcciones Atlas', sector:'Construcción',     p:22,  vol:.005, mu:.00003, beta:{cu:.8},  div:.002,  desc:'Sube cuando la economía (y el cobre) van bien.'},
  {id:'AUR', name:'Aurum Lujo',           sector:'Joyería de lujo',  p:88,  vol:.004, mu:.00004, beta:{au:.5, pt:.3}, div:.0025, desc:'Lujo: algo ligada al oro.'},
];
export const ST_POS = ['{n} presenta resultados mejores de lo esperado','{n} firma un contrato enorme','Un analista recomienda comprar {n}','{n} anuncia recompra de acciones'];
export const ST_NEG = ['{n} decepciona con sus resultados','{n} retrasa un proyecto clave','Dimite por sorpresa el consejero delegado de {n}','El regulador abre una investigación a {n}'];
export const BIZ_EV = [
  {name:'Temporada alta', txt:'Temporada alta en {n}: ingresos ×2 durante 60 s', mult:2, left:60, tone:'up'},
  {name:'Sale en la prensa', txt:'{n} sale en la prensa: ingresos ×1,5 durante 90 s', mult:1.5, left:90, tone:'up'},
  {name:'Avería', txt:'Avería en {n}: ingresos a la mitad durante 45 s', mult:.5, left:45, tone:'down'},
  {name:'Inspección', txt:'Inspección en {n}: ingresos a cero durante 20 s', mult:0, left:20, tone:'down'},
];
export const ACH = [
  {id:'a_click1', name:'Primer golpe', desc:'Pica la roca por primera vez.', test:()=>S.clicks>=1},
  {id:'a_click1k',name:'Brazo de hierro', desc:'Da 1.000 golpes de pico.', test:()=>S.clicks>=1000},
  {id:'a_g1',     name:'Primer gramo', desc:'Extrae 1 g de oro (o su equivalente).', test:()=>S.mined>=1},
  {id:'a_kg',     name:'Un kilo', desc:'Extrae 1 kg de equivalente en oro.', test:()=>S.mined>=1000},
  {id:'a_t',      name:'Una tonelada', desc:'Extrae 1 t de equivalente en oro.', test:()=>S.mined>=1e6},
  {id:'a_e1k',    name:'Negocio en marcha', desc:'Ingresa 1.000 €.', test:()=>S.earned>=1e3},
  {id:'a_e1m',    name:'Millonario', desc:'Ingresa 1 M€.', test:()=>S.earned>=1e6},
  {id:'a_e1b',    name:'Mil millones', desc:'Ingresa 1.000 M€.', test:()=>S.earned>=1e9},
  {id:'a_nug',    name:'Buscador de pepitas', desc:'Recoge 10 pepitas.', test:()=>S.nuggets>=10},
  {id:'a_high',   name:'Vender en máximos', desc:'Vende oro un 5 % por encima de su media de 3 minutos.', test:()=>!!S.flags.a_high},
  {id:'a_win',    name:'Primera ganancia', desc:'Cierra una operación de trading con beneficio.', test:()=>S.wins>=1},
  {id:'a_win10',  name:'Trader constante', desc:'Consigue 10 operaciones ganadoras.', test:()=>S.wins>=10},
  {id:'a_big',    name:'Golpe maestro', desc:'Gana 1.000 € o más en una sola operación.', test:()=>!!S.flags.a_big},
  {id:'a_liq',    name:'Lección aprendida', desc:'Sufre una liquidación. A todos nos ha pasado.', test:()=>!!S.flags.a_liq},
  {id:'a_con',    name:'Palabra cumplida', desc:'Cumple tu primer encargo.', test:()=>S.conDone>=1},
  {id:'a_con10',  name:'Proveedor de confianza', desc:'Cumple 10 encargos.', test:()=>S.conDone>=10},
  {id:'a_chain',  name:'Eslabón a eslabón', desc:'Completa un encargo en cadena.', test:()=>!!(S.jobStats && S.jobStats.chain)},
  {id:'a_urg5',   name:'Mensajero exprés', desc:'Cumple 5 encargos urgentes.', test:()=>!!(S.jobStats && S.jobStats.urgente >= 5)},
  {id:'a_loyal',  name:'Cliente de toda la vida', desc:'Consigue la máxima confianza de un cliente.', test:()=>Object.values(S.cli || {}).some(c => c.n >= 12)},
  {id:'a_rep',    name:'Reputación intachable', desc:'Llega a 5 estrellas de reputación.', test:()=>S.rep>=5},
  {id:'a_ag',     name:'Brillo de luna', desc:'Abre el yacimiento de plata.', test:()=>!!S.opened.ag},
  {id:'a_cu',     name:'Toma de tierra', desc:'Abre el yacimiento de cobre.', test:()=>!!S.opened.cu},
  {id:'a_pt',     name:'Metal noble', desc:'Abre el yacimiento de platino.', test:()=>!!S.opened.pt},
  {id:'a_gem',    name:'Algo que brilla', desc:'Encuentra tu primera gema.', test:()=>!!(S.gemsFound && Object.keys(S.gemsFound).length)},
  {id:'a_gem5',   name:'Cofre del tesoro', desc:'Encuentra los cinco tipos de gema.', test:()=>!!(S.gemsFound && Object.keys(S.gemsFound).length >= 5)},
  {id:'a_power',  name:'¡Energía!', desc:'Activa un power-up en la mina.', test:()=>!!S.flags.a_power},
  {id:'a_rival',  name:'Un paso por delante', desc:'Vende oro justo antes de que Minas del Cierzo inunde el mercado.', test:()=>!!S.flags.a_rival},
  {id:'a_biz',    name:'Emprendedor', desc:'Abre tu primera empresa.', test:()=>bizCount()>=1},
  {id:'a_biz6',   name:'Holding', desc:'Ten las 6 empresas.', test:()=>bizCount()>=6},
  {id:'a_biz10',  name:'Imperio', desc:'Sube una empresa a nivel 10.', test:()=>BIZ.some(b=>bizLvl(b.id)>=10)},
  {id:'a_ipo',    name:'Toque de campana', desc:'Saca una empresa a bolsa.', test:()=>!!S.flags.a_ipo},
  {id:'a_stock',  name:'Accionista', desc:'Compra tus primeras acciones.', test:()=>!!S.flags.a_stock},
  {id:'a_div',    name:'Vivir de rentas', desc:'Cobra 10.000 € en dividendos.', test:()=>S.divs>=1e4},
  {id:'a_lv10',   name:'Veterano', desc:'Llega al nivel 10.', test:()=>S.level>=10},
  {id:'a_lv25',   name:'Leyenda de la mina', desc:'Llega al nivel 25.', test:()=>S.level>=25},
  {id:'a_branch', name:'Especialista', desc:'Completa una rama del árbol de habilidades (con su habilidad maestra).', test:()=>BRANCHES.some(B=>SKILLS.filter(s=>s.b===B.k).every(s=>S.skills[s.id] || (s.ex && SKILLS.some(o=>o.ex===s.ex && S.skills[o.id]))))},
  {id:'a_syn3',   name:'Todo encaja', desc:'Activa 3 sinergias del árbol de habilidades.', test:()=>SYNERGIES.filter(x=>syn(x.id)).length>=3},
  {id:'a_prest',  name:'Borrón y cuenta nueva', desc:'Vende tu compañía y empieza de nuevo con bonus.', test:()=>S.prestiges>=1},
];

export const runT = () => S.runStart ? (Date.now() - S.runStart)/1000 : Infinity;
ACH.push(
  {id:'r_1k',   timed:600,   name:'Arranque rápido', desc:'Ingresa 1.000 € en menos de 10 min.', test:()=>S.earned>=1e3},
  {id:'r_lv5',  timed:1500,  name:'Aprendiz aventajado', desc:'Llega al nivel 5 en menos de 25 min.', test:()=>S.level>=5},
  {id:'r_ag',   timed:2400,  name:'Fiebre de la plata', desc:'Abre el yacimiento de plata en menos de 40 min.', test:()=>!!S.opened.ag},
  {id:'r_1m',   timed:5400,  name:'Millón exprés', desc:'Ingresa 1 M€ en menos de 1 h 30 min.', test:()=>S.earned>=1e6},
  {id:'r_biz3', timed:7200,  name:'Emprendedor en serie', desc:'Ten 3 empresas en menos de 2 h.', test:()=>bizCount()>=3},
  {id:'r_lv15', timed:5400, name:'Ascenso meteórico', desc:'Llega al nivel 15 en menos de 1 h 30 min.', test:()=>S.level>=15},
  {id:'r_100m', timed:9000, name:'Tiburón', desc:'Ingresa 100 M€ en menos de 2 h 30 min.', test:()=>S.earned>=1e8},
  {id:'r_nodebt', cond:true, name:'Sin deber nada a nadie', desc:'Ingresa 1 M€ en una compañía sin pedir ningún préstamo.', test:()=>S.earned>=1e6 && !S.borrowed, failed:()=>S.borrowed},
  {id:'r_boss',   cond:true, name:'Buen patrón', desc:'Llega al nivel 12 sin dejar ni una nómina sin pagar.', test:()=>S.level>=12 && !S.unpaid, failed:()=>S.unpaid},
  {id:'a_solar', name:'Energía propia', desc:'Instala 10 paneles solares.', test:()=>S.solar>=10},
  {id:'a_fix',   name:'Todo en orden', desc:'Repara tu maquinaria cuando esté por debajo del 30 %.', test:()=>!!S.flags.a_fix},
);
export const MILESTONES = [['1k','1.000 € ingresados',()=>S.earned>=1e3],['1m','1 M€ ingresados',()=>S.earned>=1e6],['1b','1.000 M€ ingresados',()=>S.earned>=1e9],['lv10','Nivel 10',()=>S.level>=10],['lv20','Nivel 20',()=>S.level>=20]];

export const PERKS = [
  {id:'p_auto',    cost:10, name:'Venta automática de la mina', desc:'Tu mina vende sola cuando el precio supera su media o cuando un almacén pasa del 90 %. Se configura en la mina.'},
  {id:'p_crew',    cost:6, name:'Capataz veterano', desc:'Cada compañía nueva empieza con 10 buscadores y 5 mineros.'},
  {id:'p_bank',    cost:6, name:'Contactos en el bróker', desc:'Cada compañía nueva empieza con la Cuenta en un bróker y el Analista de mercado.'},
  {id:'p_vault',   cost:8, name:'Almacén heredado', desc:'La caja fuerte empieza en el nivel 3.'},
  {id:'p_clients', cost:8, name:'Cartera de clientes', desc:'Los contratos pagan un 5 % más y la reputación empieza en 2 estrellas.'},
  {id:'p_plants',  cost:12, name:'Ingeniería propia', desc:'Paneles, aerogeneradores y plantas de recursos cuestan la mitad.'},
  {id:'p_level',   cost:15, name:'Experiencia previa', desc:'Cada compañía nueva empieza en el nivel 5, con sus puntos de habilidad.'},
];
export const OBJ = [
  {txt:'Pica la roca 15 veces', r:20, test:()=>S.clicks>=15},
  {txt:'Vende tu primer oro (botón «Vender todo»)', r:20, test:()=>S.sold>0},
  {txt:'Contrata un buscador con batea', r:30, test:()=>(S.owned.batea||0)>=1},
  {txt:'Compra el Pico de acero templado (Tienda → Mejoras → Mina)', r:40, test:()=>has('u_pico')},
  {txt:'Ten 5 buscadores y 1 minero', r:80, test:()=>(S.owned.batea||0)>=5 && (S.owned.pico||0)>=1},
  {txt:'Amplía la caja fuerte (botón «Ampliar» del panel de producción)', r:150, test:()=>S.cap>=1},
  {txt:'Aprende tu primera habilidad', r:200, test:()=>Object.keys(S.skills).length>=1},
  {txt:'Cumple un encargo (Mercado → Encargos)', r:400, test:()=>S.conDone>=1},
  {txt:'Compra una vagoneta y mira su consumo en Finanzas', r:600, test:()=>(S.owned.vagoneta||0)>=1},
  {txt:'Contrata al Agente de ventas', r:1000, test:()=>has('u_agente')},
  {txt:'Abre el yacimiento de plata', r:3000, test:()=>!!S.opened.ag},
  {txt:'Abre tu primera empresa', r:8000, test:()=>bizCount()>=1},
];


export const RES_NEWS = [['La OPEP recorta la producción: el combustible se encarece','fs',.18],['Se desploma el precio del petróleo: combustible más barato','fs',-.15],['Ola de calor: la electricidad se dispara','es',.45],['Mucho viento y sol: la electricidad se abarata','es',-.3]];

export const TUTS = {
  market:    {t:'El mercado', sec:'mercado', s:['El precio de cada metal cambia cada segundo. Noticias, datos económicos y la mina rival lo mueven.','En <b>Vender</b> conviertes tu almacén en dinero. Vender mucho de golpe baja el precio.','Las pestañas con candado se abren con mejoras o al subir de nivel.']},
  finanzas:  {t:'Tus cuentas', sec:'finanzas', s:['Arriba ves si ganas o pierdes dinero por segundo.','Las <b>nóminas</b> se pagan cada minuto: ten caja o activa la venta de metal para pagarlas.','Las máquinas gastan recursos: cómpralos o prodúcelos tú.']},
  contracts: {t:'Nuevo: encargos', sec:'mercado', desk:'con', s:['Los clientes pagan <b>más que el mercado</b> si entregas a tiempo. Llegan al tablón del Mercado.','Los aceptados aparecen en la mina: cuando tengas el metal, pulsa <b>Entregar</b>.','Cumple y cada cliente confiará más en ti: mejores precios y pedidos en cadena.']},
  loans:     {t:'Nuevo: préstamos', sec:'finanzas', s:['El banco te presta para crecer más rápido.','Cobra un <b>0,5 % por minuto</b>: invierte en algo que devuelva más que eso.','Devuelve la deuda en cuanto puedas.']},
  ag:        {t:'Nuevo: plata', sec:'mina', s:['Abre el yacimiento desde el selector <b>Oro · Plata · Cobre</b> de la mina.','Todas tus minas producen a la vez; cada mina extra sube un 50 % la plantilla.','La plata se mueve mucho más que el oro: más riesgo y más oportunidades.']},
  taxes:     {t:'Hacienda', sec:'finanzas', s:['Cada 5 minutos pagas un 10 % de tu beneficio.','Si en ese periodo pierdes dinero, no pagas.','El <b>Asesor fiscal</b> (Mejoras) lo baja al 5 %.']},
  biz:       {t:'Nuevo: tu ciudad', sec:'empresas', s:['Compra solares en la <b>ciudad</b> y monta empresas que <b>trabajan solas</b>.','Al subir de nivel el edificio crece por <b>etapas</b> (niveles 5, 10, 20 y 30): cada una da +25 % y abre un <b>anexo</b>.','Un <b>gerente</b> duplica lo que produce. Las empresas <b>vecinas</b> se ayudan entre sí.']},
  cu:        {t:'Nuevo: cobre', sec:'mina', s:['Ábrelo desde el selector de la mina.','El cobre sigue a la economía: sube cuando la industria va bien, aunque el oro baje.']},
  pt:        {t:'Nuevo: platino', sec:'mina', s:['Ábrelo desde el panel de Producción de la mina.','El platino es metal precioso e industrial a la vez: sube con la industria y con los coches.']},
  gems:      {t:'Nuevo: gemas', sec:'mina', s:['Al picar (y de vez en cuando, con tu equipo) salen <b>gemas</b>. Cuanto más hondo llega tu mina, más valiosas.','Véndelas desde el panel de Producción o en el Mercado. Si tienes joyería, las engasta sola y las vende al doble.']},
  power:     {t:'Nuevo: power-ups', sec:'mina', s:['De vez en cuando brilla una <b>burbuja</b> en la mina. Tócala antes de que se vaya.','Cada una da una ventaja durante un rato: golpes más fuertes, producción doble, mejores precios o más suerte.']},
  stocks:    {t:'Nuevo: bolsa', sec:'bolsa', s:['Compra acciones de 8 empresas; algunas pagan <b>dividendos</b> cada minuto.','Las mineras se mueven con su metal; las demás van a su aire.']},
  ipo:       {t:'Nuevo: salir a bolsa', sec:'empresas', s:['Con una empresa en nivel 5 puedes venderla en parte y cobrar mucho de golpe.','Después solo cobras de sus beneficios el porcentaje que conserves.']},
  prestige:  {t:'Vender la compañía', sec:'logros', s:['Ya puedes empezar de cero a cambio de <b>lingotes de legado</b>.','Cada lingote da +2 % a todo o se gasta en ventajas permanentes, como la venta automática de la mina.']},
  minigames: {t:'Nuevo: minijuegos', sec:'minijuegos', s:['Mientras picas en la mina, de vez en cuando se suelta una <b>vagoneta</b> o se prepara una <b>voladura</b>: acepta la invitación y juega. Pagan según lo que produce tu mina.','En la sección Minijuegos tienes además la apuesta <b>Sube o baja</b> y, más adelante, el trading.']},
  broker:    {t:'Nuevo: trading', sec:'minijuegos', mg:'trade', s:['<b>Largo</b> gana si el precio sube; <b>corto</b>, si baja.','El apalancamiento multiplica ganancias y pérdidas.','Pon un <b>stop loss</b> para limitar lo que puedes perder.']},
  agente:    {t:'Nuevo: órdenes', sec:'mercado', desk:'ord', s:['Deja ventas programadas para cuando el precio llegue a donde quieras.','Activa la venta automática para que tu almacén nunca se quede lleno.']},
  analista:  {t:'Nuevo: analista', sec:'mercado', s:['La <b>media móvil</b> (línea azul) muestra la tendencia.','El aviso bajo el gráfico te dice si el precio está alto o bajo respecto a su media.']},
  skills:    {t:'Puntos de habilidad', sec:'habilidades', s:['Cada nivel te da puntos. Gástalos en cuatro ramas: Minero, Comerciante, Empresario y Jefe de obra.','Abajo de cada rama hay una <b>elección</b>: o una o la otra. Y al final, una habilidad maestra.','Algunas parejas de habilidades de ramas distintas activan <b>sinergias</b>.']},
  legacy:    {t:'Tienda de legado', sec:'logros', s:['Tus lingotes están en la tienda de legado, en la sección Logros.','Las ventajas se quedan para todas tus compañías futuras.']},
};

export const RES = {
  e:{name:'Energía', unit:'kWh', cat:'energia', base:5000, cost:2000, store:'baterías', users:'vagonetas, perforadoras y todas las máquinas'},
  f:{name:'Combustible', unit:'L', cat:'combustible', base:1000, cost:2500, store:'depósito', users:'excavadoras y tuneladoras'},
  x:{name:'Explosivos', unit:'kg', cat:'explosivos', base:100, cost:3000, store:'polvorín', users:'equipos de voladura y tuneladoras'},
};

export const CATS_IN = [['metal','Venta de metal'],['gemas','Gemas'],['contratos','Contratos'],['empresas','Empresas'],['dividendos','Dividendos'],['trading','Trading'],['bolsa','Bolsa'],['otros','Otros']];
export const CATS_OUT = [['nominas','Nóminas'],['energia','Energía'],['combustible','Combustible'],['explosivos','Explosivos'],['mantenimiento','Mantenimiento'],['gastosEmp','Gastos de empresas'],['intereses','Intereses'],['impuestos','Impuestos']];

/* ================= el descenso: galerías, hallazgos y secretos ================= */
export const GAL_DEPTH = {au: 5, ag: 180, cu: 480, pt: 1100};
export const RARITY = {
  c: {name: 'Común', col: '#3fcf6c', dark: '#1f9447', sec: 20, floor: 40, xp: .04},
  r: {name: 'Raro', col: '#3ea8ff', dark: '#1d6fc4', sec: 45, floor: 150, xp: .08},
  e: {name: 'Épico', col: '#a06bff', dark: '#6737d1', sec: 90, floor: 1200, xp: .15},
  l: {name: 'Legendario', col: '#ffc62e', dark: '#e0950b', sec: 180, floor: 12000, xp: .30},
};
export const FINDS = [
  {id: 'chapa', name: 'Chapa de gaseosa', d: 12, rar: 'c', txt: 'De una marca que ya no existe. Todavía hace «pssst».'},
  {id: 'bocadillo', name: 'Bocadillo de chorizo de 1923', d: 23, rar: 'c', txt: 'Envuelto en un periódico que anuncia la llegada del tranvía. Huele a historia. Nadie se atreve a probarlo.'},
  {id: 'casco', name: 'Casco del abuelo', d: 31, rar: 'c', txt: 'Con una pegatina que dice «Sobreviví al turno de noche».'},
  {id: 'herradura', name: 'Herradura de la suerte', d: 34, rar: 'r', fx: 'luck', txt: 'Durante diez minutos salen pepitas mucho más a menudo.'},
  {id: 'mapa', name: 'Mapa pintado con ceras', d: 38, rar: 'r', fx: 'nugget', txt: 'La X está en tu propia mina. Muy útil: justo ahí aparece una pepita.'},
  {id: 'trilobites', name: 'Trilobites', d: 58, rar: 'c', txt: 'El vecino más antiguo de la mina. No paga alquiler.'},
  {id: 'lampara', name: 'Lámpara de carburo', d: 77, rar: 'c', txt: 'Todavía enciende. Huele a ajo, como debe ser.'},
  {id: 'topo', name: 'Topo con gafas de sol', d: 86, rar: 'r', fx: 'topo', txt: 'Se baja las gafas, te guiña un ojo y vuelve a su túnel. Desde hoy se asoma de vez en cuando: tócalo y te deja una pepita.'},
  {id: 'deberes', name: 'Pizarra con los deberes sin hacer', d: 112, rar: 'c', txt: 'Alguien se escondió aquí para no ir a clase. Faltan las divisiones.'},
  {id: 'carta', name: 'Carta de amor de 1951', d: 138, rar: 'r', fx: 'moral', txt: '«Querida Pilar: hoy he visto oro. Mañana, tus ojos». La plantilla se emociona: moral al 100 %.'},
  {id: 'amonites', name: 'Amonites gigante', d: 212, rar: 'c', txt: 'Del tamaño de una rueda de camión. Lo usáis de mesa en el comedor.'},
  {id: 'romana', name: 'Galería romana', d: 248, rar: 'r', txt: 'Una pintada en la pared: «Aquí estuvo Marco, año 23 a. C.». Tenía buena letra.'},
  {id: 'vagoneta', name: 'Vagoneta fantasma', d: 300, rar: 'r', night: true, txt: 'Solo sale de noche y rueda sola. Nadie la empuja. Nadie pregunta.'},
  {id: 'dino', name: 'Esqueleto de dinosaurio', d: 350, rar: 'e', txt: 'Enterito, menos un hueso de la cola. Los mineros ya le llaman Pedro y le dan los buenos días.'},
  {id: 'anfora', name: 'Ánfora llena de monedas', d: 420, rar: 'e', txt: 'Los romanos también ahorraban. Y mejor que tú.'},
  {id: 'disco', name: 'Disco de una verbena de 1978', d: 560, rar: 'c', fx: 'moral', txt: 'Lo pones y suena en toda la mina. La moral sube a tope.'},
  {id: 'geoda', name: 'Geoda con forma de corazón', d: 720, rar: 'r', fx: 'rep', txt: 'Tus clientes la adoran: tu reputación sube una estrella.'},
  {id: 'cofre', name: 'Cofre pirata', d: 900, rar: 'r', txt: 'Nadie sabe qué hace un cofre pirata a 900 metros bajo tierra. Tú tampoco preguntas.'},
  {id: 'cristales', name: 'Cueva de cristales gigantes', d: 1150, rar: 'e', txt: 'Tus mineros se hacen fotos con los cristales. Brillan con la linterna.'},
  {id: 'capsula', name: 'Cápsula del tiempo de Minas del Cierzo', d: 1380, rar: 'e', fx: 'spy', txt: 'Dentro están sus planes. Desde hoy ves venir sus ventas masivas en el mercado.'},
  {id: 'columnas', name: 'Columnas de basalto perfectas', d: 1580, rar: 'c', txt: 'Parecen hechas con regla. No lo están.'},
  {id: 'pez', name: 'Pez ciego del lago', d: 1618, rar: 'r', txt: 'No te ve, pero te juzga. Vive en un lago que nadie sabía que existía.'},
  {id: 'huella', name: 'Huella de un pie gigante', d: 2100, rar: 'e', txt: 'Un 58. Mejor no preguntar de quién.'},
  {id: 'cabina', name: 'Cabina de teléfono que suena', d: 2750, rar: 'e', txt: 'Contestas. Preguntan por Ramón, el capataz. Ramón dice que no está.'},
  {id: 'diamante', name: 'Diamante del tamaño de un puño', d: 3500, rar: 'l', txt: 'La refinería no sabe ni por dónde cogerlo.'},
  {id: 'patitos', name: 'Patitos de goma en un río de lava', d: 4400, rar: 'e', txt: 'Resisten. Nadie sabe cómo. Desde hoy flotan por tu mina.'},
  {id: 'espada', name: 'Espada clavada en la roca', d: 5200, rar: 'l', txt: 'Ninguno de tus mineros consigue sacarla. Tú tampoco. Lo intentáis cada viernes.'},
  {id: 'huevo', name: 'Huevo de dragón', d: 6300, rar: 'l', txt: 'Todavía está templado. Mejor no tener prisa.'},
  {id: 'ciudad', name: 'Ciudad perdida', d: 7600, rar: 'l', txt: 'Tiene hasta su propia mina. Más pequeña que la tuya.'},
  {id: 'centro', name: 'El centro de la Tierra', d: 9000, rar: 'l', fx: 'legacy', txt: 'Un cartel: «Cerrado por reformas. Disculpen las molestias». Al lado hay una campanilla. Te llevas un lingote de legado de recuerdo.'},
];
export const FIND_SETS = {
  pre: {name: 'Prehistoria', items: ['trilobites', 'amonites', 'dino', 'huella'], reward: '+10 % de producción para siempre'},
  his: {name: 'Historia', items: ['casco', 'carta', 'romana', 'anfora', 'disco'], reward: 'Los contratos pagan un 10 % más'},
  tes: {name: 'Tesoros', items: ['mapa', 'geoda', 'cofre', 'diamante', 'ciudad'], reward: 'Las pepitas valen el doble'},
  mis: {name: 'Misterios', items: ['topo', 'vagoneta', 'pez', 'cabina', 'huevo'], reward: '+10 % a la producción y a las empresas', hidden: true},
};
export const SECRETS = [
  {id: 's_luna', name: 'Houston, tenemos oro', desc: 'Toca la luna diez veces.'},
  {id: 's_bandera', name: 'Provocador', desc: 'Haz bailar la bandera de Minas del Cierzo.'},
  {id: 's_siesta', name: 'Siesta minera', desc: 'Deja que tu minero se quede dormido.'},
  {id: 's_veta', name: 'Palabra mágica', desc: 'Escribe VETA con el teclado.'},
  {id: 's_topo', name: 'Amigo del topo', desc: 'Toca al topo cinco veces.'},
  {id: 's_campana', name: '¿Hay alguien?', desc: 'Toca la campanilla del centro de la Tierra.'},
];
ACH.push(...SECRETS.map(s => ({id: s.id, name: s.name, desc: s.desc, secret: true, test: () => !!(S.flags && S.flags[s.id])})));
TUTS.finds = {t: 'Nuevo: hallazgos', sec: 'mina', s: ['Mientras tu mina baja aparecen <b>cosas escondidas en la roca</b>. Brillan y llevan una señal <b>!</b>.', 'Tócalas para desenterrarlas: dan premios y se guardan en el <b>Museo</b>.', 'Arrastra la mina o usa la rueda del ratón para bajar. El mapa de la derecha te lleva al frente.']};

/* ================= gemas =================
   Salen al picar y, muy de vez en cuando, con tu equipo. Cada una aparece a partir de una profundidad del frente.
   p: precio de referencia (se mueve un poco con el mercado) · w: lo común que es. */
export const GEMS = [
  {id:'ame', name:'Amatista',  f:1, pl:'amatistas',  col:'#a06bff', hi:'#e3d1ff', d:40,   p:3000,  w:40},
  {id:'esm', name:'Esmeralda', f:1, pl:'esmeraldas', col:'#22b86a', hi:'#b6f3d0', d:150,  p:4e4,   w:24},
  {id:'rub', name:'Rubí',      f:0, pl:'rubíes',     col:'#ff3d55', hi:'#ffc4cc', d:500,  p:1.2e6, w:14},
  {id:'zaf', name:'Zafiro',    f:0, pl:'zafiros',    col:'#3566ff', hi:'#bfd0ff', d:1500, p:1.2e7, w:8},
  {id:'dia', name:'Diamante',  f:0, pl:'diamantes',  col:'#bff4ff', hi:'#ffffff', d:4000, p:3e8,   w:3},
];
/* ================= power-ups =================
   Burbujas que aparecen en la mina: tócalas y durante un rato tienes una ventaja. */
export const POWERUPS = [
  {id:'pico',    name:'Pico dorado',  ico:'pick',   col:'#ffc62e', dur:30, txt:'Cada golpe saca 7 veces más'},
  {id:'turno',   name:'Turno doble',  ico:'helmet', col:'#3fcf6c', dur:60, txt:'La mina produce el doble'},
  {id:'subasta', name:'Subasta',      ico:'coin',   col:'#3ea8ff', dur:60, txt:'Vendes el metal un 25 % más caro'},
  {id:'lince',   name:'Ojo de lince', ico:'gem',    col:'#a06bff', dur:90, txt:'Pepitas y gemas salen el triple'},
];
