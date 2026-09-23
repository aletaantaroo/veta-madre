/* Iconos dibujados a mano en SVG: relleno de color con contorno de tinta, como pegatinas. */
const O = 'stroke="#2a1a0e" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';
const I = {
  coin: `<circle cx="12" cy="12" r="9.6" fill="#ffc62e" ${O}/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#e0950b" stroke-width="1.7"/><path d="M14.6 8.9a3.9 3.9 0 1 0 0 6.2M8.2 11h4.6M8.2 13.2h4.6" fill="none" stroke="#7a4700" stroke-width="1.7" stroke-linecap="round"/><path d="M6.4 8.4a6.6 6.6 0 0 1 3-2.6" fill="none" stroke="#fff6c8" stroke-width="1.6" stroke-linecap="round"/>`,
  ingot: `<path d="M2.6 17.6l3.2-7.4h12.4l3.2 7.4z" fill="var(--ic1,#ffc62e)" ${O}/><path d="M5.8 10.2L8 5.8h8l2.2 4.4z" fill="var(--ic2,#ffe68a)" ${O}/><path d="M9.3 7.6h3.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`,
  pick: `<path d="M5 20.2L15.6 9.6" stroke="#2a1a0e" stroke-width="5" stroke-linecap="round"/><path d="M5 20.2L15.6 9.6" stroke="#b77838" stroke-width="2.6" stroke-linecap="round"/><path d="M6.8 5.2c5.3-3 11.2-1.7 14.4 3.6-3.8-1.6-7.6-1.4-10.5.7z" fill="#dfe7ef" ${O}/><path d="M14.2 7.2l3 3" stroke="#2a1a0e" stroke-width="3.2" stroke-linecap="round"/>`,
  chart: `<rect x="2.8" y="3.8" width="18.4" height="16.4" rx="3.4" fill="#fff" ${O}/><path d="M6 16.2l4-4.4 3 2.4 5.2-6" fill="none" stroke="#1c9146" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.8 8.1h3.6v3.6" fill="none" stroke="#1c9146" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  bank: `<path d="M2.8 9.4L12 3.8l9.2 5.6z" fill="#fff" ${O}/><rect x="3.6" y="17.2" width="16.8" height="3.2" rx="1" fill="#fff" ${O}/><path d="M6.4 10.8v5M10.2 10.8v5M13.8 10.8v5M17.6 10.8v5" stroke="#2a1a0e" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.3" fill="#ffc62e" stroke="#2a1a0e" stroke-width="1"/>`,
  factory: `<path d="M2.8 20.4V11l5 3.1V11l5 3.1V8.2l4.6 2.9V3.6h3.8v16.8z" fill="#fff" ${O}/><path d="M5.6 17h2M10.6 17h2M15.4 17h2" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>`,
  bull: `<rect x="3.4" y="12.4" width="4" height="7.4" rx="1" fill="#ff5b4f" ${O}/><rect x="10" y="8.4" width="4" height="11.4" rx="1" fill="#3fcf6c" ${O}/><rect x="16.6" y="4" width="4" height="15.8" rx="1" fill="#3fcf6c" ${O}/><path d="M5.4 12.4V9.6M12 8.4V5.8M18.6 4V2.4" stroke="#2a1a0e" stroke-width="1.6" stroke-linecap="round"/>`,
  star: `<path d="M12 2.6l2.8 5.7 6.2.9-4.5 4.3 1.1 6.2L12 16.8l-5.6 2.9 1.1-6.2L3 9.2l6.2-.9z" fill="#fff" ${O}/><path d="M9.8 8.8l1.2-2.2" stroke="#ffc62e" stroke-width="1.5" stroke-linecap="round"/>`,
  trophy: `<path d="M7 3.6h10v4.6a5 5 0 0 1-10 0z" fill="#fff" ${O}/><path d="M7 5.2H4.4a2.8 2.8 0 0 0 3.3 4.2M17 5.2h2.6a2.8 2.8 0 0 1-3.3 4.2" fill="none" ${O}/><path d="M10.4 13h3.2v3h2.6v3.8H7.8V16h2.6z" fill="#fff" ${O}/>`,
  gear: `<circle cx="12" cy="12" r="7.6" fill="none" stroke="#2a1a0e" stroke-width="6" stroke-dasharray="3.1 2.87"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#9a7a57" stroke-width="3" stroke-dasharray="3.1 2.87"/><circle cx="12" cy="12" r="6.4" fill="#c9ab7c" ${O}/><circle cx="12" cy="12" r="2.6" fill="#fff5de" ${O}/>`,
  flag: `<path d="M5.4 21V3.4" stroke="#2a1a0e" stroke-width="2.4" stroke-linecap="round"/><path d="M6.2 4.2c4-1.8 6.4 1.8 12.4 0v8.4c-6 1.8-8.4-1.8-12.4 0z" fill="#ff5b4f" ${O}/>`,
  cart: `<path d="M3.2 7.8h17.6l-2.4 8.6H5.6z" fill="#b77838" ${O}/><path d="M7.6 8v8.2M12 8v8.2M16.4 8v8.2" stroke="#7a4a1d" stroke-width="1.4"/><path d="M5.4 7.8c.6-2.6 2.2-3.2 3.6-2.4 1-2 3-2.4 4.4-.8 1.6-1.4 4-.8 4.8 1.4.6.4 1 1 1.2 1.8z" fill="#ffc62e" ${O}/><circle cx="8" cy="18.8" r="2.2" fill="#555" ${O}/><circle cx="16" cy="18.8" r="2.2" fill="#555" ${O}/>`,
  alert: `<path d="M12 3.2l9.6 16.8H2.4z" fill="#ffc62e" ${O}/><path d="M12 9.2v5" stroke="#2a1a0e" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.4" fill="#2a1a0e"/>`,
  safe: `<rect x="3.2" y="3.6" width="17.6" height="16" rx="3" fill="#b8c7d6" ${O}/><circle cx="12" cy="11.6" r="4.8" fill="#e6eef5" ${O}/><path d="M12 8.2v6.8M8.6 11.6h6.8" stroke="#2a1a0e" stroke-width="1.6" stroke-linecap="round"/><path d="M6 19.6v1.4M18 19.6v1.4" stroke="#2a1a0e" stroke-width="2.4" stroke-linecap="round"/>`,
  bolt: `<path d="M13.6 2.6L5 13.4h5.6l-1.6 8 8.6-11h-5.6z" fill="#ffc62e" ${O}/>`,
  drop: `<path d="M12 2.8c3.6 4.8 6 8.2 6 11.2a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11.2z" fill="#ff9636" ${O}/><path d="M9.2 14.6a3 3 0 0 0 2 2.6" fill="none" stroke="#fff3d6" stroke-width="1.6" stroke-linecap="round"/>`,
  tnt: `<rect x="5.6" y="8" width="5" height="12.4" rx="1.4" fill="#ff5b4f" ${O}/><rect x="11.2" y="8" width="5" height="12.4" rx="1.4" fill="#ff5b4f" ${O}/><path d="M5.2 13.2h11.4" stroke="#2a1a0e" stroke-width="1.6"/><path d="M13.6 8c0-3 2-4.4 4.4-4" fill="none" stroke="#2a1a0e" stroke-width="1.6" stroke-linecap="round"/><path d="M18 2.2l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#ffc62e"/>`,
  helmet: `<path d="M3.4 16.2a8.6 8.6 0 0 1 17.2 0z" fill="#ffc62e" ${O}/><rect x="2" y="15.6" width="20" height="3.4" rx="1.6" fill="#ffc62e" ${O}/><circle cx="12" cy="10.6" r="2.4" fill="#fff6c8" ${O}/>`,
  wrench: `<path d="M14.6 3.4a5 5 0 0 0-4.2 6.8L3.6 17a2.2 2.2 0 0 0 3.2 3.2l6.8-6.8a5 5 0 0 0 6.8-4.2l-3 1.2-2.4-2.4z" fill="#dfe7ef" ${O}/>`,
  museum: `<path d="M10 3.5h4v2.2c3.2 1.6 4.8 4.8 4 8.4-.7 3.2-3.2 5.6-6 5.6s-5.3-2.4-6-5.6c-.8-3.6.8-6.8 4-8.4z" fill="#fff" ${O}/><path d="M8.6 8.4q-3 .6-2.4 4M15.4 8.4q3 .6 2.4 4" fill="none" ${O}/><path d="M7 13.4h10" stroke="#b8923a" stroke-width="1.8"/><path d="M5 21.2h14" ${O}/>`,
  close: `<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`,
};
const KIND = {'Mina':'pick', 'Mercado':'chart', 'Equipo':'helmet', 'Operaciones':'wrench'};
function icon(name){ return `<svg viewBox="0 0 24 24" aria-hidden="true">${I[name] || I.star}</svg>`; }
export function kindIcon(kind){ return icon(KIND[kind] || 'star'); }
export function paintIcons(root = document){
  root.querySelectorAll('[data-icon]').forEach(el => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });
}
