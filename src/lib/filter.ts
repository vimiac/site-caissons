// Filtrage & tri PURS, exécutés côté client sur le dataset chargé.
import type { CaissonProduct, FilterCriteria, SortKey, SortDir } from './types';

function inRange(value: number, min?: number, max?: number): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function matchesText(p: CaissonProduct, q?: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (needle === '') return true;
  const hay = `${p.nom_produit} ${p.gamme} ${p.enseigne} ${p.type_meuble}`.toLowerCase();
  return hay.includes(needle);
}

/**
 * Filtre une liste de produits selon les critères.
 * ⚠️ Règle non négociable : les produits `incertain` ne sont inclus QUE si
 * `inclureIncertains === true`. Par défaut, seuls les confirmés passent.
 */
export function filterProducts(products: CaissonProduct[], c: FilterCriteria): CaissonProduct[] {
  const wantIncertains = c.inclureIncertains === true;
  return products.filter((p) => {
    if (p.certitude === 'incertain' && !wantIncertains) return false;
    if (!inRange(p.largeur_cm, c.lMin, c.lMax)) return false;
    if (!inRange(p.profondeur_cm, c.pMin, c.pMax)) return false;
    if (!inRange(p.hauteur_cm, c.hMin, c.hMax)) return false;
    if (c.enseignes && c.enseignes.length > 0 && !c.enseignes.includes(p.enseigne)) return false;
    if (c.gammes && c.gammes.length > 0 && !c.gammes.includes(p.gamme)) return false;
    if (c.types && c.types.length > 0 && !c.types.includes(p.type_meuble)) return false;
    if (c.montages && c.montages.length > 0 && !c.montages.includes(p.montage)) return false;
    if (c.materiaux && c.materiaux.length > 0 && !c.materiaux.includes(p.materiau ?? '')) return false;
    if (c.pieces && c.pieces.length > 0) {
      const ps = p.piece ?? [];
      if (!c.pieces.some((x) => ps.includes(x))) return false;
    }
    if (!matchesText(p, c.q)) return false;
    return true;
  });
}

/** Tri stable par clé (dimension ou nom) et direction. */
export function sortProducts(products: CaissonProduct[], key: SortKey, dir: SortDir): CaissonProduct[] {
  const factor = dir === 'desc' ? -1 : 1;
  const copy = products.slice();
  copy.sort((a, b) => {
    let cmp: number;
    if (key === 'nom') {
      cmp = a.nom_produit.localeCompare(b.nom_produit, 'fr');
    } else {
      cmp = (a[key] as number) - (b[key] as number);
    }
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return cmp * factor;
  });
  return copy;
}
