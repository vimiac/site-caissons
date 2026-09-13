import { describe, it, expect } from 'vitest';
import { caissonGeom, caissonSVG, computeSchemaScale } from '../schema';
import type { CaissonProduct, DimensionBounds } from '../types';

function make(over: Partial<CaissonProduct>): CaissonProduct {
  return {
    id: over.id ?? 'id',
    enseigne: 'IKEA',
    gamme: over.gamme ?? 'BILLY',
    nom_produit: over.nom_produit ?? 'x',
    type_meuble: over.type_meuble ?? 'cube',
    largeur_cm: over.largeur_cm ?? 40,
    profondeur_cm: over.profondeur_cm ?? 28,
    hauteur_cm: over.hauteur_cm ?? 106,
    montage: over.montage ?? 'pose',
    materiau: over.materiau ?? 'mélaminé',
    piece: over.piece ?? ['multi'],
    url_produit: 'gamme:BILLY',
    url_gamme_resolue: null,
    certitude: over.certitude ?? 'confirmé',
    ...over,
  };
}

// Bornes représentatives du jeu (dérivées des données au build ; ici fixées pour un test déterministe).
const bounds: DimensionBounds = {
  largeur_cm: { min: 35, max: 182 },
  profondeur_cm: { min: 20, max: 60 },
  hauteur_cm: { min: 35, max: 237 },
};

describe('schéma SVG à l’échelle', () => {
  const scale = computeSchemaScale(bounds);
  const billy = make({ gamme: 'BILLY', largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106 });
  const kallax = make({ gamme: 'KALLAX', largeur_cm: 77, profondeur_cm: 39, hauteur_cm: 77 });

  it('la face est EXACTEMENT cote_cm × échelle partagée', () => {
    const gb = caissonGeom(billy, scale);
    const gk = caissonGeom(kallax, scale);
    expect(gb.faceW).toBeCloseTo(40 * scale, 6);
    expect(gb.faceH).toBeCloseTo(106 * scale, 6);
    expect(gk.faceW).toBeCloseTo(77 * scale, 6);
    expect(gk.faceH).toBeCloseTo(77 * scale, 6);
  });

  it('les proportions inter-caissons reflètent les cm réels (BILLY 40×106 vs KALLAX 77×77)', () => {
    const gb = caissonGeom(billy, scale);
    const gk = caissonGeom(kallax, scale);
    // même échelle partagée ⇒ rapport des pixels = rapport des cm
    expect(gb.faceW / gk.faceW).toBeCloseTo(40 / 77, 6);
    expect(gb.faceH / gk.faceH).toBeCloseTo(106 / 77, 6);
    // KALLAX 77×77 est carré ⇒ son schéma est carré
    expect(gk.faceW).toBeCloseTo(gk.faceH, 6);
  });

  it('un caisson plus large rend une face plus large (monotonie)', () => {
    const petit = caissonGeom(make({ largeur_cm: 40, hauteur_cm: 106 }), scale);
    const grand = caissonGeom(make({ largeur_cm: 112, hauteur_cm: 112 }), scale);
    expect(grand.faceW).toBeGreaterThan(petit.faceW);
  });

  it('le SVG est inline et SANS ressource externe (invariants du site)', () => {
    const svg = caissonSVG(billy, scale);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<img/i);
    expect(svg).not.toMatch(/<image/i);
    expect(svg).not.toMatch(/https?:/i);
    expect(svg).not.toMatch(/url\(/i);
    expect(svg).not.toMatch(/xlink:href|href=/i);
    // porte l'accessibilité (role img + titre coté)
    expect(svg).toMatch(/role="img"/);
    expect(svg).toContain('40×28×106');
  });
});
