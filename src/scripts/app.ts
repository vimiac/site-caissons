// Island client : filtrage/tri 100% navigateur sur le dataset embarqué, état dans l'URL,
// vue tableau/cartes, comparateur 2-4 avec surlignage des écarts. Aucune requête réseau.
import { filterProducts, sortProducts } from '../lib/filter';
import { caissonSVG, computeSchemaScale } from '../lib/schema';
import type {
  CaissonProduct,
  DimensionBounds,
  FilterCriteria,
  SortDir,
  SortKey,
} from '../lib/types';

interface Payload {
  produits: CaissonProduct[];
  bounds: DimensionBounds;
  facettes: Record<string, string[]>;
  compteurs: { confirmes: number; incertains: number; quarantaine: number };
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  Array.from(document.querySelectorAll(sel)) as T[];

const dataEl = document.getElementById('dataset-json');
if (!dataEl) throw new Error('dataset-json manquant');
const PAYLOAD: Payload = JSON.parse(dataEl.textContent || '{}');
const ALL = PAYLOAD.produits;
const B = PAYLOAD.bounds;
// Échelle partagée des schémas (px/cm), dérivée des bornes calculées : tous les caissons comparables.
const SCALE = computeSchemaScale(B);

const FACET_FIELDS: Array<keyof FilterCriteria> = ['gammes', 'types', 'pieces', 'montages', 'materiaux'];
const FACET_NAME: Record<string, string> = {
  gammes: 'gammes',
  types: 'types',
  pieces: 'pieces',
  montages: 'montages',
  materiaux: 'materiaux',
};

// ---------- état comparateur ----------
const compareIds = new Set<string>();
const MAX_COMPARE = 4;

// ---------- lecture des contrôles ----------
function readCheckboxes(name: string): string[] {
  return $$<HTMLInputElement>(`input[name="${name}"]:checked`).map((el) => el.value);
}

function num(id: string): number {
  const el = $<HTMLInputElement>(`#${id}`);
  return el ? Number(el.value) : 0;
}

function readState(): { criteria: FilterCriteria; sort: SortKey; dir: SortDir; view: string } {
  const criteria: FilterCriteria = {
    q: ($<HTMLInputElement>('#q')?.value || '').trim() || undefined,
    lMin: num('lmin'),
    lMax: num('lmax'),
    pMin: num('pmin'),
    pMax: num('pmax'),
    hMin: num('hmin'),
    hMax: num('hmax'),
    gammes: readCheckboxes('gammes'),
    types: readCheckboxes('types'),
    pieces: readCheckboxes('pieces'),
    montages: readCheckboxes('montages'),
    materiaux: readCheckboxes('materiaux'),
    inclureIncertains: $<HTMLInputElement>('#inc')?.checked === true,
  };
  const sort = ($<HTMLSelectElement>('#sort')?.value || 'nom') as SortKey;
  const dir = (($<HTMLButtonElement>('#dir')?.dataset.dir as SortDir) || 'asc') as SortDir;
  const view = ($<HTMLButtonElement>('#view-cards')?.getAttribute('aria-pressed') === 'true')
    ? 'cards'
    : 'table';
  return { criteria, sort, dir, view };
}

// ---------- URL <-> état ----------
function stateToURL(s: ReturnType<typeof readState>) {
  const p = new URLSearchParams();
  const c = s.criteria;
  if (c.q) p.set('q', c.q);
  if (c.lMin !== B.largeur_cm.min) p.set('lmin', String(c.lMin));
  if (c.lMax !== B.largeur_cm.max) p.set('lmax', String(c.lMax));
  if (c.pMin !== B.profondeur_cm.min) p.set('pmin', String(c.pMin));
  if (c.pMax !== B.profondeur_cm.max) p.set('pmax', String(c.pMax));
  if (c.hMin !== B.hauteur_cm.min) p.set('hmin', String(c.hMin));
  if (c.hMax !== B.hauteur_cm.max) p.set('hmax', String(c.hMax));
  for (const f of FACET_FIELDS) {
    const arr = (c[f] as string[]) || [];
    if (arr.length) p.set(f as string, arr.join(','));
  }
  if (c.inclureIncertains) p.set('inc', '1');
  if (s.sort !== 'nom') p.set('sort', s.sort);
  if (s.dir !== 'asc') p.set('dir', s.dir);
  if (s.view !== 'table') p.set('view', s.view);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function applyURLToControls() {
  const p = new URLSearchParams(location.search);
  const setVal = (id: string, v: string | null) => {
    const el = $<HTMLInputElement>(`#${id}`);
    if (el && v != null) el.value = v;
  };
  setVal('q', p.get('q'));
  setVal('lmin', p.get('lmin'));
  setVal('lmax', p.get('lmax'));
  setVal('pmin', p.get('pmin'));
  setVal('pmax', p.get('pmax'));
  setVal('hmin', p.get('hmin'));
  setVal('hmax', p.get('hmax'));
  for (const f of FACET_FIELDS) {
    const raw = p.get(f as string);
    if (!raw) continue;
    const wanted = new Set(raw.split(','));
    $$<HTMLInputElement>(`input[name="${FACET_NAME[f as string]}"]`).forEach((el) => {
      el.checked = wanted.has(el.value);
    });
  }
  const inc = $<HTMLInputElement>('#inc');
  if (inc) inc.checked = p.get('inc') === '1';
  const sortSel = $<HTMLSelectElement>('#sort');
  if (sortSel && p.get('sort')) sortSel.value = p.get('sort') as string;
  const dirBtn = $<HTMLButtonElement>('#dir');
  if (dirBtn) {
    const d = (p.get('dir') as SortDir) || 'asc';
    dirBtn.dataset.dir = d;
    dirBtn.textContent = d === 'asc' ? '↑' : '↓';
  }
  setView(p.get('view') === 'cards' ? 'cards' : 'table', false);
}

// ---------- sliders (empêcher min > max) ----------
function clampSliders() {
  const pairs: Array<[string, string, string]> = [
    ['lmin', 'lmax', 'lout'],
    ['pmin', 'pmax', 'pout'],
    ['hmin', 'hmax', 'hout'],
  ];
  for (const [minId, maxId, outId] of pairs) {
    const mi = $<HTMLInputElement>(`#${minId}`)!;
    const ma = $<HTMLInputElement>(`#${maxId}`)!;
    if (Number(mi.value) > Number(ma.value)) {
      // celui qui a bougé garde sa valeur ; on rapproche l'autre
      const tmp = mi.value;
      mi.value = ma.value;
      ma.value = tmp;
    }
    const out = $(`#${outId}`);
    if (out) out.textContent = `${mi.value}–${ma.value}`;
  }
}

// ---------- rendu ----------
const results = $('#results')!;
const compteur = $('#compteur')!;

function badge(p: CaissonProduct): string {
  return p.certitude === 'incertain'
    ? '<span class="badge badge-warn" title="Combinaison non vérifiée">non vérifié</span>'
    : '';
}

function lienGamme(p: CaissonProduct): string {
  if (p.url_gamme_resolue) {
    return `<a class="lien-gamme" href="${p.url_gamme_resolue}" target="_blank" rel="noopener nofollow">Voir la gamme ${escapeHtml(p.gamme)} ↗</a>`;
  }
  return `<span class="lien-gamme disabled" title="URL de la page de gamme non renseignée (voir README)">Lien gamme indisponible</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function cmpCheckbox(p: CaissonProduct): string {
  const checked = compareIds.has(p.id) ? 'checked' : '';
  return `<input type="checkbox" class="cmp" data-id="${p.id}" ${checked} aria-label="Ajouter ${escapeHtml(p.nom_produit)} au comparateur" />`;
}

function renderTable(list: CaissonProduct[]) {
  const rows = list
    .map(
      (p) => `<tr class="${p.certitude === 'incertain' ? 'row-incertain' : ''}">
        <td class="c-cmp">${cmpCheckbox(p)}</td>
        <td class="c-nom">${escapeHtml(p.nom_produit)} ${badge(p)}</td>
        <td>${escapeHtml(p.gamme)}</td>
        <td class="num">${p.largeur_cm}</td>
        <td class="num">${p.profondeur_cm}</td>
        <td class="num">${p.hauteur_cm}</td>
        <td>${escapeHtml(p.type_meuble)}</td>
        <td>${escapeHtml(p.montage)}</td>
        <td>${escapeHtml(p.materiau || '—')}</td>
        <td class="c-lien">${lienGamme(p)}</td>
      </tr>`,
    )
    .join('');
  results.innerHTML = `<div class="table-scroll"><table class="dense" aria-label="Résultats (tableau)">
    <thead><tr>
      <th scope="col"><span class="sr-only">Comparer</span></th>
      <th scope="col">Nom</th><th scope="col">Gamme</th>
      <th scope="col" class="num">L</th><th scope="col" class="num">P</th><th scope="col" class="num">H</th>
      <th scope="col">Type</th><th scope="col">Montage</th><th scope="col">Matériau</th><th scope="col">Lien</th>
    </tr></thead><tbody>${rows || emptyRow(10)}</tbody></table></div>`;
}

function emptyRow(cols: number) {
  return `<tr><td colspan="${cols}" class="empty">Aucun résultat pour ces contraintes. Élargissez une plage ou réinitialisez.</td></tr>`;
}

function renderCards(list: CaissonProduct[]) {
  if (list.length === 0) {
    results.innerHTML = `<p class="empty">Aucun résultat pour ces contraintes. Élargissez une plage ou réinitialisez.</p>`;
    return;
  }
  const cards = list
    .map(
      (p) => `<article class="card ${p.certitude === 'incertain' ? 'row-incertain' : ''}">
        <header><h3>${escapeHtml(p.nom_produit)} ${badge(p)}</h3><label class="cmp-wrap">${cmpCheckbox(p)}<span class="sr-only">Comparer</span></label></header>
        <figure class="schema-wrap">${caissonSVG(p, SCALE)}<figcaption class="sr-only">Schéma à l'échelle du caisson ${escapeHtml(p.nom_produit)}, ${p.largeur_cm}×${p.profondeur_cm}×${p.hauteur_cm} cm.</figcaption></figure>
        <dl class="cotes">
          <div><dt>L</dt><dd>${p.largeur_cm} cm</dd></div>
          <div><dt>P</dt><dd>${p.profondeur_cm} cm</dd></div>
          <div><dt>H</dt><dd>${p.hauteur_cm} cm</dd></div>
        </dl>
        <p class="meta">${escapeHtml(p.gamme)} · ${escapeHtml(p.type_meuble)} · ${escapeHtml(p.montage)} · ${escapeHtml(p.materiau || '—')}</p>
        <p>${lienGamme(p)}</p>
      </article>`,
    )
    .join('');
  results.innerHTML = `<div class="cards-grid">${cards}</div>`;
}

let currentView = 'table';
function setView(view: string, rerender = true) {
  currentView = view;
  const t = $<HTMLButtonElement>('#view-table')!;
  const c = $<HTMLButtonElement>('#view-cards')!;
  t.setAttribute('aria-pressed', String(view === 'table'));
  c.setAttribute('aria-pressed', String(view === 'cards'));
  if (rerender) render();
}

// ---------- chips filtres actifs ----------
function renderChips(s: ReturnType<typeof readState>) {
  const chips: Array<{ label: string; clear: () => void }> = [];
  const c = s.criteria;
  const dim = (name: string, min: number, max: number, dmin: number, dmax: number, ids: [string, string]) => {
    if (min !== dmin || max !== dmax) {
      chips.push({
        label: `${name} ${min}–${max} cm`,
        clear: () => {
          ($<HTMLInputElement>(`#${ids[0]}`)!).value = String(dmin);
          ($<HTMLInputElement>(`#${ids[1]}`)!).value = String(dmax);
        },
      });
    }
  };
  dim('Largeur', c.lMin!, c.lMax!, B.largeur_cm.min, B.largeur_cm.max, ['lmin', 'lmax']);
  dim('Profondeur', c.pMin!, c.pMax!, B.profondeur_cm.min, B.profondeur_cm.max, ['pmin', 'pmax']);
  dim('Hauteur', c.hMin!, c.hMax!, B.hauteur_cm.min, B.hauteur_cm.max, ['hmin', 'hmax']);
  if (c.q) chips.push({ label: `« ${c.q} »`, clear: () => (($<HTMLInputElement>('#q')!).value = '') });
  for (const f of FACET_FIELDS) {
    for (const v of (c[f] as string[]) || []) {
      chips.push({
        label: v,
        clear: () => {
          const el = $$<HTMLInputElement>(`input[name="${FACET_NAME[f as string]}"]`).find((x) => x.value === v);
          if (el) el.checked = false;
        },
      });
    }
  }
  if (c.inclureIncertains) chips.push({ label: 'non vérifiées incluses', clear: () => (($<HTMLInputElement>('#inc')!).checked = false) });

  const box = $('#chips')!;
  box.innerHTML = '';
  chips.forEach((ch) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `${escapeHtml(ch.label)} <span aria-hidden="true">✕</span>`;
    b.setAttribute('aria-label', `Retirer le filtre ${ch.label}`);
    b.addEventListener('click', () => {
      ch.clear();
      update();
    });
    box.appendChild(b);
  });
}

// ---------- comparateur ----------
function refreshTray() {
  const tray = $('#comparateur-tray')!;
  const count = $('#tray-count')!;
  const open = $<HTMLButtonElement>('#open-compare')!;
  const n = compareIds.size;
  tray.hidden = n === 0;
  count.textContent = `${n} sélectionné${n > 1 ? 's' : ''} (2 à ${MAX_COMPARE})`;
  open.disabled = n < 2;
}

function toggleCompare(id: string, on: boolean) {
  if (on) {
    if (compareIds.size >= MAX_COMPARE) return false;
    compareIds.add(id);
  } else {
    compareIds.delete(id);
  }
  refreshTray();
  return true;
}

function openCompare() {
  const items = ALL.filter((p) => compareIds.has(p.id));
  if (items.length < 2) return;
  const attrs: Array<[string, (p: CaissonProduct) => string]> = [
    ['Largeur', (p) => `${p.largeur_cm} cm`],
    ['Profondeur', (p) => `${p.profondeur_cm} cm`],
    ['Hauteur', (p) => `${p.hauteur_cm} cm`],
    ['Gamme', (p) => p.gamme],
    ['Type', (p) => p.type_meuble],
    ['Montage', (p) => p.montage],
    ['Matériau', (p) => p.materiau || '—'],
    ['Certitude', (p) => (p.certitude === 'incertain' ? 'non vérifié' : 'vérifié')],
  ];
  const head = `<tr><th>Attribut</th>${items.map((p) => `<th>${escapeHtml(p.nom_produit)}</th>`).join('')}</tr>`;
  const schemaRow = `<tr class="row-schema"><th scope="row">Schéma (même échelle)</th>${items
    .map((p) => `<td class="c-schema">${caissonSVG(p, SCALE)}</td>`)
    .join('')}</tr>`;
  const body = attrs
    .map(([label, fn]) => {
      const vals = items.map(fn);
      const diff = new Set(vals).size > 1; // écart = valeurs différentes
      const cells = vals
        .map((v) => `<td class="${diff ? 'diff' : ''}">${escapeHtml(v)}</td>`)
        .join('');
      return `<tr class="${diff ? 'row-diff' : ''}"><th scope="row">${label}</th>${cells}</tr>`;
    })
    .join('');
  $('#compare-body')!.innerHTML =
    `<div class="table-scroll"><table class="compare"><thead>${head}</thead><tbody>${schemaRow}${body}</tbody></table></div>
     <p class="hint">Les lignes surlignées marquent un <strong>écart</strong> entre les produits comparés.</p>`;
  const dlg = $<HTMLDialogElement>('#compare-dialog')!;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

// ---------- boucle principale ----------
function render() {
  const s = readState();
  const filtered = filterProducts(ALL, s.criteria);
  const sorted = sortProducts(filtered, s.sort, s.dir);
  if (currentView === 'cards') renderCards(sorted);
  else renderTable(sorted);
  const n = sorted.length;
  compteur.textContent = `${n} résultat${n > 1 ? 's' : ''}${s.criteria.inclureIncertains ? ' (dont non vérifiées)' : ''}`;
  renderChips(s);
  // rebrancher les cases comparateur (le HTML vient d'être remplacé)
  $$<HTMLInputElement>('input.cmp').forEach((el) => {
    el.addEventListener('change', () => {
      const ok = toggleCompare(el.dataset.id!, el.checked);
      if (!ok) el.checked = false;
    });
  });
}

function update() {
  clampSliders();
  render();
  stateToURL(readState());
}

// ---------- init ----------
function init() {
  applyURLToControls();
  // Écouteurs
  $('#filtres')!.addEventListener('input', update);
  $('#filtres')!.addEventListener('change', update);
  $('#sort')!.addEventListener('change', update);
  $('#dir')!.addEventListener('click', () => {
    const btn = $<HTMLButtonElement>('#dir')!;
    const d = btn.dataset.dir === 'desc' ? 'asc' : 'desc';
    btn.dataset.dir = d;
    btn.textContent = d === 'asc' ? '↑' : '↓';
    update();
  });
  $('#view-table')!.addEventListener('click', () => {
    setView('table');
    stateToURL(readState());
  });
  $('#view-cards')!.addEventListener('click', () => {
    setView('cards');
    stateToURL(readState());
  });
  $('#reset')!.addEventListener('click', () => {
    const f = $<HTMLFormElement>('#filtres')!;
    f.reset();
    // remettre les sliders aux bornes
    ($<HTMLInputElement>('#lmin')!).value = String(B.largeur_cm.min);
    ($<HTMLInputElement>('#lmax')!).value = String(B.largeur_cm.max);
    ($<HTMLInputElement>('#pmin')!).value = String(B.profondeur_cm.min);
    ($<HTMLInputElement>('#pmax')!).value = String(B.profondeur_cm.max);
    ($<HTMLInputElement>('#hmin')!).value = String(B.hauteur_cm.min);
    ($<HTMLInputElement>('#hmax')!).value = String(B.hauteur_cm.max);
    update();
  });
  $('#open-compare')!.addEventListener('click', openCompare);
  $('#clear-compare')!.addEventListener('click', () => {
    compareIds.clear();
    $$<HTMLInputElement>('input.cmp').forEach((el) => (el.checked = false));
    refreshTray();
  });
  $('#close-compare')!.addEventListener('click', () => {
    const dlg = $<HTMLDialogElement>('#compare-dialog')!;
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  });

  refreshTray();
  update();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
