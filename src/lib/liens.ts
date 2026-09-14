// Construit le lien sortant d'un caisson vers la MARQUE, PUR et testable.
// Priorité : (1) RECHERCHE préremplie sur le moteur public de la marque (nom + cotes),
//            (2) page de gamme explicite si renseignée dans les données,
//            (3) SITE générique de la marque,
//            (4) rien — lien laissé désactivé (jamais de lien mort).
// Aucune URL de produit n'est inventée : la recherche est une requête sur un moteur public,
// le modèle d'URL est fourni en DONNÉES (src/data/marque-recherche.json), pas en dur.
import type { CaissonProduct } from './types';

export interface MarqueLiens {
  recherche?: string | null; // modèle avec le placeholder {q}, ex. ".../search/?q={q}"
  site?: string | null; // page d'accueil publique (repli)
}

export type LienKind = 'recherche' | 'gamme' | 'site';
export interface LienResolu {
  href: string;
  kind: LienKind;
}

/**
 * Requête de recherche lisible : gamme + cotes en L×P×H, le « × » écrit « x » pour
 * une requête propre (ex. "BILLY 40x28x106"). C'est le texte AVANT encodage URL.
 */
export function rechercheQuery(p: CaissonProduct): string {
  return `${p.gamme} ${p.largeur_cm}x${p.profondeur_cm}x${p.hauteur_cm}`;
}

/** URL de recherche préremplie pour un caisson, ou null si la marque n'a pas de modèle. */
export function rechercheURL(p: CaissonProduct, marques: Record<string, MarqueLiens>): string | null {
  const m = marques[p.enseigne];
  if (!m || typeof m.recherche !== 'string' || !m.recherche.includes('{q}')) return null;
  // encodeURIComponent gère accents (BESTÅ→BEST%C3%85), espaces (%20), etc.
  return m.recherche.replace('{q}', encodeURIComponent(rechercheQuery(p)));
}

/**
 * Résout le lien final d'un caisson selon la priorité ci-dessus.
 * `urlGammeResolue` = la page de gamme explicite déjà résolue au build (ou null).
 */
export function resolveLien(
  p: CaissonProduct,
  marques: Record<string, MarqueLiens>,
  urlGammeResolue: string | null | undefined,
): LienResolu | null {
  const rech = rechercheURL(p, marques);
  if (rech) return { href: rech, kind: 'recherche' };
  if (typeof urlGammeResolue === 'string' && urlGammeResolue.trim() !== '') {
    return { href: urlGammeResolue, kind: 'gamme' };
  }
  const m = marques[p.enseigne];
  if (m && typeof m.site === 'string' && m.site.trim() !== '') {
    return { href: m.site, kind: 'site' };
  }
  return null;
}
