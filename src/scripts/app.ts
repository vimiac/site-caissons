// Island client de la refonte « plan technique ». 100 % navigateur, aucune requête réseau.
// Réutilise la logique métier VALIDÉE d'Arnaud (filter.ts / sortProducts, liens résolus au
// build) ; n'y touche pas. Ajoute : dessin SVG du mur d'essai, cartes à l'échelle, packing
// mono-rangée, tri par chips, sélection→mise en avant, état sérialisé dans l'URL.
import { filterProducts, sortProducts } from '../lib/filter';
import { rechercheQuery } from '../lib/liens';
import type { CaissonProduct, FilterCriteria, SortKey, SortDir } from '../lib/types';

interface Payload {
  produits: CaissonProduct[];
  facettes: { gammes: string[]; pieces: string[]; montages: string[] };
  compteurs: { confirmes: number; incertains: number };
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T | null;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) =>
  Array.from(document.querySelectorAll(s)) as T[];

const dataEl = document.getElementById('dataset-json');
if (!dataEl) throw new Error('dataset-json manquant');
const PAYLOAD: Payload = JSON.parse(dataEl.textContent || '{}');
const ALL = PAYLOAD.produits;

// ---------- libellés d'affichage (données codées → texte hifi) ----------
const MONTAGE_LABEL: Record<string, string> = { pose: 'posé au sol', les_deux: 'posé ou suspendu' };
const PIECE_LABEL: Record<string, string> = { multi: 'multi-pièces' };
const TYPE_LABEL: Record<string, string> = { bibliotheque: 'bibliothèque' };
const montageLabel = (v: string) => MONTAGE_LABEL[v] ?? v;
const pieceLabel = (v: string) => PIECE_LABEL[v] ?? v;
const typeLabel = (v: string) => TYPE_LABEL[v] ?? v;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// ---------- état ----------
const DEF = { w: 240, d: 45, h: 200 };
const sel = new Set<string>();
let sortKey: SortKey = 'largeur_cm';
let sortDir: SortDir = 'desc';

// ---------- lecture des contrôles ----------
const rangeVal = (axis: 'w' | 'd' | 'h') => Number(($<HTMLInputElement>(`#s-${axis}`))?.value ?? DEF[axis]);
function pressedValues(family: string): string[] {
  return $$(`.chip[data-family="${family}"][aria-pressed="true"]`).map((b) => b.dataset.value!).filter(Boolean);
}
const incOn = () => $('#chip-inc')?.getAttribute('aria-pressed') === 'true';

function criteria(): FilterCriteria {
  return {
    lMax: rangeVal('w'),
    pMax: rangeVal('d'),
    hMax: rangeVal('h'),
    gammes: pressedValues('gammes'),
    pieces: pressedValues('pieces'),
    montages: pressedValues('montages'),
    q: ($<HTMLInputElement>('#q')?.value || '').trim() || undefined,
    inclureIncertains: incOn(),
  };
}

// ---------- géométrie du mur d'essai (repris du handoff, au pixel près) ----------
const PAD = 40, FLOOR = 340, TOP = 60;
function murGeom(maxW: number, maxH: number) {
  const scale = Math.min((1000 - 2 * PAD) / Math.max(maxW, 60), (FLOOR - TOP) / Math.max(maxH, 40));
  const boxW = maxW * scale, boxH = maxH * scale;
  const vbW = Math.round(boxW + 2 * PAD);
  return { scale, boxW, boxH, vbW, box: { x: PAD, y: FLOOR - boxH, w: boxW, h: boxH } };
}

// candidats du packing : les sélectionnés d'abord, puis l'ordre de tri courant.
function packCandidates(sorted: CaissonProduct[]): CaissonProduct[] {
  if (sel.size === 0) return sorted;
  return [...sorted.filter((p) => sel.has(p.id)), ...sorted.filter((p) => !sel.has(p.id))];
}

interface Shape { p: CaissonProduct; x: number; y: number; w: number; h: number; }
function pack(sorted: CaissonProduct[], maxW: number, scale: number): { shapes: Shape[]; occupe: number } {
  const shapes: Shape[] = [];
  let cursor = 0;
  for (const p of packCandidates(sorted)) {
    if (shapes.length >= 14) break;
    if (cursor + p.largeur_cm > maxW) continue; // continue, PAS break (KALLAX 182 ne bloque pas)
    shapes.push({ p, x: PAD + cursor * scale, y: FLOOR - p.hauteur_cm * scale, w: p.largeur_cm * scale, h: p.hauteur_cm * scale });
    cursor += p.largeur_cm;
  }
  return { shapes, occupe: cursor };
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shelves(x: number, yTop: number, w: number, h: number, hCm: number, stroke = 'rgba(23,24,28,.35)'): string {
  // une ligne d'étagère tous les ~40 cm de hauteur.
  const n = Math.max(0, Math.floor(hCm / 40));
  let out = '';
  for (let k = 1; k <= n; k++) {
    const yy = (yTop + h) - (h * k) / (n + 1);
    out += `<line x1="${x.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${stroke}" stroke-width="1" />`;
  }
  return out;
}

function renderMur(sorted: CaissonProduct[], maxW: number, maxD: number, maxH: number) {
  const g = murGeom(maxW, maxH);
  const { shapes, occupe } = pack(sorted, maxW, g.scale);
  const N = Math.round(100 / g.scale);
  $('#mur-scale')!.textContent = `échelle 1:${N}`;

  // badge d'état (résumé texte, lisible par lecteur d'écran).
  const stateEl = $('#mur-state')!;
  if (shapes.length === 0) stateEl.textContent = 'aucun caisson ne rentre';
  else stateEl.textContent = `${shapes.length} caisson${shapes.length > 1 ? 's' : ''} aligné${shapes.length > 1 ? 's' : ''} · ${Math.round(occupe)} / ${maxW} cm occupés`;

  const animClass = reduced() ? '' : 'anim-draw';
  const floorX2 = g.vbW - PAD;

  // 1. quadrillage (pas de 50 unités, borné à la zone utile).
  let grid = '';
  for (let gx = PAD; gx <= floorX2; gx += 50) grid += `<line x1="${gx}" y1="${TOP}" x2="${gx}" y2="${FLOOR}" stroke="rgba(23,24,28,.1)" stroke-width="1" />`;
  for (let gy = FLOOR; gy >= TOP; gy -= 50) grid += `<line x1="${PAD}" y1="${gy}" x2="${floorX2}" y2="${gy}" stroke="rgba(23,24,28,.1)" stroke-width="1" />`;

  // 2. rectangle de contrainte + label.
  const box = g.box;
  const constraint =
    `<text x="${PAD}" y="${(box.y - 12).toFixed(1)}" fill="#b8482a" font-family="'IBM Plex Mono',monospace" font-size="13">contrainte ${maxW} × ${maxD} × ${maxH} cm</text>` +
    `<rect class="${animClass}" x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" fill="none" stroke="#b8482a" stroke-width="2" stroke-dasharray="9 7" style="stroke-dashoffset:0" />`;

  // 3. caissons empilés (une rangée).
  const boxes = shapes.map((s, i) => {
    const selOn = sel.has(s.p.id);
    const fill = selOn ? 'rgba(184,72,42,.18)' : (i % 2 === 0 ? '#f7f3ea' : '#efe9db');
    const anim = reduced() ? '' : `class="anim-rise" style="animation-delay:${i * 45}ms"`;
    const cote = `${s.p.largeur_cm}×${s.p.hauteur_cm}`;
    return `<g ${anim}>` +
      `<rect x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" width="${s.w.toFixed(1)}" height="${s.h.toFixed(1)}" fill="${fill}" stroke="#17181c" stroke-width="1.5" />` +
      shelves(s.x, s.y, s.w, s.h, s.p.hauteur_cm) +
      `<text x="${(s.x + s.w / 2).toFixed(1)}" y="${(FLOOR + 16).toFixed(1)}" fill="#4a4740" font-family="'IBM Plex Mono',monospace" font-size="10.5" text-anchor="middle">${cote}</text>` +
      `</g>`;
  }).join('');

  // 4. sol + hachures.
  const floor =
    `<line x1="${PAD}" y1="${FLOOR}" x2="${floorX2}" y2="${FLOOR}" stroke="#17181c" stroke-width="2" />` +
    `<rect x="${PAD}" y="${FLOOR}" width="${(floorX2 - PAD).toFixed(1)}" height="10" fill="url(#hatch)" />`;

  const svg =
    `<svg viewBox="0 0 ${g.vbW} 400" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">` +
    `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(23,24,28,.2)" stroke-width="1.2" /></pattern></defs>` +
    grid + constraint + boxes + floor + `</svg>`;
  $('#mur-svg')!.innerHTML = svg;
}

// ---------- mini élévation (carte) ----------
function elevSVG(p: CaissonProduct, selOn: boolean): string {
  const scale = 80 / Math.max(p.largeur_cm, p.hauteur_cm);
  const rw = p.largeur_cm * scale, rh = p.hauteur_cm * scale;
  const x = 46 - rw / 2, y = 88 - rh;
  const fill = selOn ? 'rgba(184,72,42,.18)' : '#f7f3ea';
  const boxCls = reduced() ? '' : 'box';
  return `<svg class="card-elev" viewBox="0 0 92 92" aria-hidden="true">` +
    `<line x1="4" y1="88" x2="88" y2="88" stroke="#17181c" stroke-width="1.5" />` +
    `<g class="${boxCls}">` +
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${fill}" stroke="#17181c" stroke-width="1.5" />` +
    shelves(x, y, rw, rh, p.hauteur_cm, 'rgba(23,24,28,.3)') +
    `</g></svg>`;
}

// ---------- cartes ----------
function lienCarte(p: CaissonProduct): string {
  const l = p.lien;
  if (!l) return `<span class="card-lien disabled" title="Aucun lien de marque disponible">lien indisponible</span>`;
  const label = l.kind === 'recherche' ? `chercher chez ${esc(p.enseigne)} ↗`
    : l.kind === 'gamme' ? `voir la gamme ↗` : `voir chez ${esc(p.enseigne)} ↗`;
  const title = l.kind === 'recherche'
    ? ` title="Recherche préremplie « ${esc(rechercheQuery(p))} » sur ${esc(p.enseigne)}"` : '';
  return `<a class="card-lien" href="${esc(l.href)}" target="_blank" rel="noopener nofollow"${title}>${label}</a>`;
}

function bar(k: string, val: number, constraint: number, selOn: boolean): string {
  const pct = Math.min(100, (val / constraint) * 100);
  return `<div class="bar"><span class="k">${k}</span><span class="track"><span class="fill" style="width:${pct.toFixed(1)}%"></span></span><span class="v">${val} cm</span></div>`;
}

function renderCards(sorted: CaissonProduct[], maxW: number, maxD: number, maxH: number) {
  const box = $('#cards')!;
  $('#res-count')!.textContent = `Résultats · ${sorted.length}`;
  if (sorted.length === 0) {
    box.innerHTML = `<p class="empty-state">Aucun caisson ne tient dans ces contraintes. Élargissez la hauteur ou la profondeur.</p>`;
    return;
  }
  const cards = sorted.slice(0, 96).map((p, i) => {
    const selOn = sel.has(p.id);
    const delay = reduced() ? 0 : Math.min(400, i * 15);
    const nv = p.certitude === 'incertain'
      ? `<span class="card-badge-nv" title="Combinaison non vérifiée">non vérifié</span>` : '';
    return `<div class="card" data-selected="${selOn}" style="animation-delay:${delay}ms">
      <button type="button" class="card-body" data-id="${esc(p.id)}" aria-pressed="${selOn}"
        aria-label="${esc(p.gamme)} ${p.largeur_cm}×${p.profondeur_cm}×${p.hauteur_cm} cm — ${selOn ? 'retirer du mur' : 'ajouter au mur'}">
        <div class="card-row1">
          <div class="card-id">
            <div class="card-brand">${esc(p.enseigne)}</div>
            <div class="card-gamme">${esc(p.gamme)}</div>
            ${nv}
          </div>
          <span class="card-type">${esc(typeLabel(p.type_meuble))}</span>
        </div>
        <div class="card-viz">
          ${elevSVG(p, selOn)}
          <div class="card-bars">
            ${bar('L', p.largeur_cm, maxW, selOn)}
            ${bar('P', p.profondeur_cm, maxD, selOn)}
            ${bar('H', p.hauteur_cm, maxH, selOn)}
          </div>
        </div>
      </button>
      <div class="card-foot">
        <span class="mount">${esc(montageLabel(p.montage))}</span>
        ${selOn ? `<span class="mat" style="color:#b8482a;font-weight:600">sélectionné</span>` : `<span class="mat">${esc(p.materiau || '—')}</span>`}
        ${lienCarte(p)}
      </div>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="cards-grid">${cards}</div>`;

  $$('.card-body').forEach((btn) => btn.addEventListener('click', () => {
    const id = (btn as HTMLElement).dataset.id!;
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    update();
  }));
}

// ---------- compteur d'en-tête + counts par gamme ----------
function updateGammeCounts() {
  const pool = ALL.filter((p) => incOn() || p.certitude === 'confirmé');
  const counts = new Map<string, number>();
  for (const p of pool) counts.set(p.gamme, (counts.get(p.gamme) ?? 0) + 1);
  $$('.count[data-count-for]').forEach((el) => {
    const g = (el as HTMLElement).dataset.countFor!;
    el.textContent = String(counts.get(g) ?? 0);
  });
}

// ---------- URL <-> état ----------
function stateToURL() {
  const p = new URLSearchParams();
  const c = criteria();
  if (c.lMax !== DEF.w) p.set('w', String(c.lMax));
  if (c.pMax !== DEF.d) p.set('d', String(c.pMax));
  if (c.hMax !== DEF.h) p.set('h', String(c.hMax));
  if (c.q) p.set('q', c.q);
  if (c.gammes?.length) p.set('g', c.gammes.join(','));
  if (c.pieces?.length) p.set('pc', c.pieces.join(','));
  if (c.montages?.length) p.set('mt', c.montages.join(','));
  if (c.inclureIncertains) p.set('inc', '1');
  if (sortKey !== 'largeur_cm') p.set('sort', sortKey);
  if (sortDir !== 'desc') p.set('dir', sortDir);
  if (sel.size) p.set('sel', [...sel].join(','));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function applyURL() {
  const p = new URLSearchParams(location.search);
  const setRange = (axis: 'w' | 'd' | 'h', key: string) => {
    const v = p.get(key); const el = $<HTMLInputElement>(`#s-${axis}`);
    if (el && v != null) el.value = v;
  };
  setRange('w', 'w'); setRange('d', 'd'); setRange('h', 'h');
  const q = p.get('q'); if (q) ($<HTMLInputElement>('#q')!).value = q;
  const press = (family: string, csv: string | null) => {
    if (!csv) return; const want = new Set(csv.split(','));
    $$(`.chip[data-family="${family}"]`).forEach((b) => b.setAttribute('aria-pressed', String(want.has(b.dataset.value!))));
  };
  press('gammes', p.get('g')); press('pieces', p.get('pc')); press('montages', p.get('mt'));
  if (p.get('inc') === '1') $('#chip-inc')!.setAttribute('aria-pressed', 'true');
  if (p.get('sort')) sortKey = p.get('sort') as SortKey;
  if (p.get('dir')) sortDir = p.get('dir') as SortDir;
  const s = p.get('sel'); if (s) s.split(',').forEach((id) => sel.add(id));
  syncSortChips();
}

function syncSortChips() {
  $$('#sort-chips .chip').forEach((b) => {
    const active = b.dataset.sort === sortKey;
    b.setAttribute('aria-pressed', String(active));
    const base = b.dataset.base || (b.dataset.base = b.textContent!.replace(/[ ↑↓]+$/, ''));
    b.textContent = active ? `${base} ${sortDir === 'asc' ? '↑' : '↓'}` : base;
  });
}

// ---------- boucle ----------
function update() {
  const c = criteria();
  const maxW = c.lMax!, maxD = c.pMax!, maxH = c.hMax!;
  $$('.slider').forEach((sl) => {
    const axis = sl.dataset.axis as 'w' | 'd' | 'h';
    const v = $<HTMLElement>(`#v-${axis}`); if (v) v.textContent = `${rangeVal(axis)} cm`;
  });
  const filtered = filterProducts(ALL, c);
  const sorted = sortProducts(filtered, sortKey, sortDir);
  $('#cnt-fit')!.textContent = String(sorted.length);
  renderMur(sorted, maxW, maxD, maxH);
  renderCards(sorted, maxW, maxD, maxH);
  updateGammeCounts();
  stateToURL();
}

// ---------- init ----------
function init() {
  // libellés d'affichage des chips (données codées → texte).
  $$('.chip .chip-txt[data-label]').forEach((el) => {
    const chip = el.closest('.chip') as HTMLElement;
    const fam = chip?.dataset.family; const val = el.dataset.label!;
    el.textContent = fam === 'montages' ? montageLabel(val) : fam === 'pieces' ? pieceLabel(val) : val;
  });

  applyURL();

  // chips filtres (switch)
  $$('.chip[data-family]').forEach((b) => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    update();
  }));
  const inc = $('#chip-inc');
  if (inc) inc.addEventListener('click', () => {
    inc.setAttribute('aria-pressed', String(inc.getAttribute('aria-pressed') !== 'true'));
    update();
  });

  // sliders + recherche
  $$('input[type=range]').forEach((el) => el.addEventListener('input', update));
  $('#q')!.addEventListener('input', update);

  // tri
  $$('#sort-chips .chip').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort as SortKey;
    if (k === sortKey) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = 'desc'; }
    syncSortChips();
    update();
  }));

  // reset
  $('#reset')!.addEventListener('click', () => {
    ($<HTMLInputElement>('#s-w')!).value = String(DEF.w);
    ($<HTMLInputElement>('#s-d')!).value = String(DEF.d);
    ($<HTMLInputElement>('#s-h')!).value = String(DEF.h);
    ($<HTMLInputElement>('#q')!).value = '';
    $$('.chip[data-family]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    $('#chip-inc')?.setAttribute('aria-pressed', 'false');
    sel.clear();
    sortKey = 'largeur_cm'; sortDir = 'desc'; syncSortChips();
    update();
  });

  syncSortChips();
  update();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
