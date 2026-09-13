// Génère un SCHÉMA (SVG inline) par caisson, À PARTIR DE SES COTES.
// C'est NOTRE dessin (rectangle à l'échelle largeur×hauteur + profondeur suggérée + cotes lisibles),
// PAS une photo IKEA. Rien n'est chargé : aucun <img>, aucune URL, aucune requête réseau — que du SVG.
//
// « À l'échelle » = une seule ÉCHELLE PARTAGÉE (px par cm), dérivée des bornes calculées sur les
// données (jamais en dur). Deux caissons sont donc comparables à l'œil : mêmes cm ⇒ mêmes pixels.
import type { CaissonProduct, DimensionBounds } from './types';

// Fenêtre de dessin (unités utilisateur SVG) et budgets réservés aux cotes + à la profondeur.
export const VIEW_W = 170;
export const VIEW_H = 150;
const PAD_LEFT = 20; // place pour la cote H (verticale, à gauche de la face)
const PAD_RIGHT = 8;
const PAD_BOTTOM = 18; // place pour la cote L (sous la face)
const DEPTH_MAX = 22; // budget haut+droite pour la profondeur suggérée (jamais dépassé)
const DEPTH_FACTOR = 0.45; // profondeur suggérée (foreshortening ASSUMÉ, pas une vraie projection)

const FACE_MAX_W = VIEW_W - PAD_LEFT - PAD_RIGHT - DEPTH_MAX;
const FACE_MAX_H = VIEW_H - PAD_BOTTOM - DEPTH_MAX;

/** Échelle partagée px/cm : la plus grande face du jeu tient dans le budget. Dérivée des bornes. */
export function computeSchemaScale(bounds: DimensionBounds): number {
  const maxL = Math.max(1, bounds.largeur_cm.max);
  const maxH = Math.max(1, bounds.hauteur_cm.max);
  return Math.min(FACE_MAX_W / maxL, FACE_MAX_H / maxH);
}

export interface SchemaGeom {
  faceW: number; // largeur de la face avant, en px = largeur_cm * scale
  faceH: number; // hauteur de la face avant, en px = hauteur_cm * scale
  depth: number; // profondeur suggérée en px (bornée — n'entre PAS dans la preuve d'échelle)
  x: number; // coin bas-gauche de la face
  y: number;
}

/** Géométrie pure et déterministe (testée) : la face est EXACTEMENT cote_cm × scale. */
export function caissonGeom(p: CaissonProduct, scale: number): SchemaGeom {
  const faceW = p.largeur_cm * scale;
  const faceH = p.hauteur_cm * scale;
  // profondeur suggérée, plafonnée au budget (visuel seulement) :
  const depth = Math.min(DEPTH_MAX, p.profondeur_cm * scale * DEPTH_FACTOR);
  // face collée au « sol » (bas), alignée à gauche après la marge de cote H :
  const x = PAD_LEFT;
  const y = VIEW_H - PAD_BOTTOM - faceH;
  return { faceW, faceH, depth, x, y };
}

function n(v: number): string {
  // arrondi propre pour des attributs SVG lisibles et déterministes
  return (Math.round(v * 100) / 100).toString();
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * SVG inline d'un caisson. Face avant à l'échelle + dessus/côté suggérant la profondeur + cotes.
 * Aucune ressource externe : couleurs via currentColor, pas d'<image>, pas d'URL, pas de script.
 */
export function caissonSVG(p: CaissonProduct, scale: number): string {
  const g = caissonGeom(p, scale);
  const { x, y, faceW: w, faceH: h, depth: d } = g;
  const title = `${p.gamme} — ${p.largeur_cm}×${p.profondeur_cm}×${p.hauteur_cm} cm (L×P×H)`;

  // Points : face avant (rectangle), dessus (parallélogramme) et côté droit (parallélogramme).
  const top = `${n(x)},${n(y)} ${n(x + d)},${n(y - d)} ${n(x + w + d)},${n(y - d)} ${n(x + w)},${n(y)}`;
  const side = `${n(x + w)},${n(y)} ${n(x + w + d)},${n(y - d)} ${n(x + w + d)},${n(y - d + h)} ${n(x + w)},${n(y + h)}`;

  // Cotes lisibles (nombres en cm).
  const lCote = `${p.largeur_cm}`;
  const hCote = `${p.hauteur_cm}`;
  const pCote = `${p.profondeur_cm}`;

  return (
    `<svg class="schema" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="${esc(title)}" ` +
    `preserveAspectRatio="xMidYMax meet" focusable="false">` +
    `<title>${esc(title)}</title>` +
    // dessus et côté (profondeur suggérée) — teinte plus claire
    `<polygon class="s-top" points="${top}"/>` +
    `<polygon class="s-side" points="${side}"/>` +
    // face avant à l'échelle
    `<rect class="s-face" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>` +
    // cote largeur (sous la face)
    `<line class="s-dim" x1="${n(x)}" y1="${n(VIEW_H - 6)}" x2="${n(x + w)}" y2="${n(VIEW_H - 6)}"/>` +
    `<text class="s-num" x="${n(x + w / 2)}" y="${n(VIEW_H - 8)}" text-anchor="middle">${lCote}</text>` +
    // cote hauteur (à gauche, verticale)
    `<line class="s-dim" x1="10" y1="${n(y)}" x2="10" y2="${n(y + h)}"/>` +
    `<text class="s-num" x="9" y="${n(y + h / 2)}" text-anchor="middle" transform="rotate(-90 9 ${n(y + h / 2)})">${hCote}</text>` +
    // cote profondeur (arête haute suggérée)
    `<text class="s-num s-depth" x="${n(x + w + d / 2 + 1)}" y="${n(y - d / 2)}" text-anchor="start">P${pCote}</text>` +
    `</svg>`
  );
}
