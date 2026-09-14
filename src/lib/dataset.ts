// Chargement du dataset AU BUILD : normalisation, validation, quarantaine (journalisée),
// dépliage des combinaisons incertaines, calcul des bornes de sliders, facettes.
// Exécuté dans le frontmatter Astro (build statique). Aucune donnée inventée.

import rawIkea from '../data/ikea.json';
import rawAutres from '../data/marques-2026-09-14.json'; // Castorama Atomia + Muuto Stacked + HAY Colour Cabinet
import gammeUrls from '../data/gamme-urls.json';
import marqueRecherche from '../data/marque-recherche.json';
import { normalizeProduct, validateProduct, parseDimensionTriplet } from './dimensions';
import { resolveLien, type MarqueLiens } from './liens';
import type {
  CaissonProduct,
  Dataset,
  DimensionBounds,
  QuarantineEntry,
} from './types';

interface IncertainGroup {
  gamme: string;
  combinaisons: string[];
  raison?: string;
  source?: string;
}

const URL_MAP: Record<string, string | null> = (gammeUrls as any).urls ?? {};
const MARQUES: Record<string, MarqueLiens> = (marqueRecherche as any).marques ?? {};

/** Résout le placeholder "gamme:<GAMME>" → URL publique de la page de gamme, ou null. */
function resolveGammeUrl(urlProduit: string | undefined, gamme: string): string | null {
  if (!urlProduit) return null;
  if (/^https?:\/\//i.test(urlProduit)) return urlProduit; // déjà une URL réelle
  const mapped = URL_MAP[gamme];
  return typeof mapped === 'string' && mapped.trim() !== '' ? mapped : null;
}

function toProduct(n: Record<string, unknown>): CaissonProduct {
  const gamme = String(n.gamme);
  const urlGamme = resolveGammeUrl(n.url_produit as string | undefined, gamme);
  const p = {
    ...(n as any),
    gamme,
    url_gamme_resolue: urlGamme,
  } as CaissonProduct;
  p.lien = resolveLien(p, MARQUES, urlGamme); // recherche préremplie > gamme > site > null
  return p;
}

/**
 * Déplie un groupe de combinaisons incertaines en produits complets, en HÉRITANT
 * des métadonnées de gamme (type_meuble, montage, materiau, piece) des confirmés.
 * ⚠️ Énumération de combos réels fournis (pas de produit cartésien d'axes).
 */
function expandIncertains(
  groups: IncertainGroup[],
  confirmes: CaissonProduct[],
): { produits: CaissonProduct[]; quarantaine: QuarantineEntry[] } {
  const byGamme = new Map<string, CaissonProduct>();
  for (const p of confirmes) if (!byGamme.has(p.gamme)) byGamme.set(p.gamme, p);

  const produits: CaissonProduct[] = [];
  const quarantaine: QuarantineEntry[] = [];

  for (const g of groups) {
    const model = byGamme.get(g.gamme);
    // La marque et le préfixe d'id sont HÉRITÉS du modèle confirmé de la gamme (pas forcés à IKEA) :
    // sinon les incertains d'une autre marque (ex. HAY) seraient étiquetés IKEA (filtre/lien faux).
    const enseigne = model?.enseigne ?? 'IKEA';
    for (const combo of g.combinaisons) {
      const trip = parseDimensionTriplet(combo);
      const id = `${enseigne.toLowerCase()}-${g.gamme.toLowerCase().replace(/\s+/g, '-')}-${combo.replace(/[^0-9]+/g, 'x').replace(/^x|x$/g, '')}-incertain`;
      if (!trip) {
        quarantaine.push({ id, raison: `combinaison incertaine illisible: "${combo}"`, champ: 'combinaisons' });
        continue;
      }
      produits.push(
        toProduct(
          normalizeProduct({
            id,
            enseigne,
            gamme: g.gamme,
            nom_produit: `${g.gamme} ${combo}`,
            type_meuble: model?.type_meuble ?? 'autre',
            largeur_cm: trip.largeur_cm,
            profondeur_cm: trip.profondeur_cm,
            hauteur_cm: trip.hauteur_cm,
            montage: model?.montage ?? 'pose',
            materiau: model?.materiau ?? null,
            piece: model?.piece ?? [],
            url_produit: `gamme:${g.gamme}`,
            source_type: 'recherche_publique',
            certitude: 'incertain',
            source: g.source ?? '—',
          }),
        ),
      );
    }
  }
  return { produits, quarantaine };
}

function computeBounds(products: CaissonProduct[]): DimensionBounds {
  const axis = (key: 'largeur_cm' | 'profondeur_cm' | 'hauteur_cm') => {
    const vals = products.map((p) => p[key]);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };
  return {
    largeur_cm: axis('largeur_cm'),
    profondeur_cm: axis('profondeur_cm'),
    hauteur_cm: axis('hauteur_cm'),
  };
}

function uniqSorted(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ''))).sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
}

let cached: Dataset | null = null;

/** Construit (et met en cache) le dataset validé. Journalise la quarantaine au build. */
export function buildDataset(): Dataset {
  if (cached) return cached;

  const confirmes: CaissonProduct[] = [];
  const quarantaine: QuarantineEntry[] = [];

  // Sources multi-marques : IKEA + les marques du lot (Castorama Atomia, Muuto Stacked).
  const rawProduits: any[] = [
    ...((rawIkea as any).produits ?? []),
    ...((rawAutres as any).produits ?? []),
  ];
  for (const raw of rawProduits) {
    const n = normalizeProduct(raw);
    const errors = validateProduct(n);
    if (errors.length > 0) {
      quarantaine.push({ id: String(n.id ?? raw.id ?? '?'), raison: errors.join('; ') });
      continue;
    }
    const p = toProduct(n);
    if (p.certitude === 'incertain') {
      // Un confirmé marqué incertain dans la source resterait un incertain (rare) — traité plus bas.
    }
    confirmes.push(p);
  }

  const groups: IncertainGroup[] = [
    ...((rawIkea as any).produits_incertains ?? []),
    ...((rawAutres as any).produits_incertains ?? []),
  ];
  const expanded = expandIncertains(groups, confirmes);
  const incertains = expanded.produits;
  quarantaine.push(...expanded.quarantaine);

  const all = [...confirmes, ...incertains];
  const bounds = computeBounds(all);

  const dataset: Dataset = {
    confirmes,
    incertains,
    quarantaine,
    bounds,
    gammes: uniqSorted(all.map((p) => p.gamme)),
    enseignes: uniqSorted(all.map((p) => p.enseigne)),
    types_meuble: uniqSorted(all.map((p) => p.type_meuble)),
    pieces: uniqSorted(all.flatMap((p) => p.piece ?? [])),
    montages: uniqSorted(all.map((p) => p.montage)),
    materiaux: uniqSorted(all.map((p) => p.materiau ?? null)),
  };

  // Journal de build (règle : quarantaine journalisée, jamais rejet silencieux).
  console.log(
    `[dataset] confirmés=${confirmes.length} incertains=${incertains.length} quarantaine=${quarantaine.length}`,
  );
  if (quarantaine.length > 0) {
    for (const q of quarantaine) console.warn(`[dataset][quarantaine] ${q.id}: ${q.raison}`);
  }

  cached = dataset;
  return dataset;
}
