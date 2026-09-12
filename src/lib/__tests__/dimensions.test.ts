import { describe, it, expect } from 'vitest';
import { toCm, parseDimensionTriplet, normalizeProduct, validateProduct } from '../dimensions';

describe('toCm', () => {
  it('accepte un nombre positif', () => {
    expect(toCm(60)).toBe(60);
    expect(toCm(39.5)).toBe(39.5);
  });
  it('rejette 0, négatif, NaN, Infinity', () => {
    expect(toCm(0)).toBeNull();
    expect(toCm(-5)).toBeNull();
    expect(toCm(NaN)).toBeNull();
    expect(toCm(Infinity)).toBeNull();
  });
  it('parse une chaîne avec unité et décimale FR', () => {
    expect(toCm('60 cm')).toBe(60);
    expect(toCm('39,5')).toBe(39.5);
    expect(toCm('  80  ')).toBe(80);
  });
  it('rejette une chaîne vide ou non numérique', () => {
    expect(toCm('')).toBeNull();
    expect(toCm('abc')).toBeNull();
    expect(toCm(null)).toBeNull();
    expect(toCm(undefined)).toBeNull();
  });
});

describe('parseDimensionTriplet', () => {
  it('parse L×P×H avec le séparateur ×', () => {
    expect(parseDimensionTriplet('80×28×202')).toEqual({
      largeur_cm: 80,
      profondeur_cm: 28,
      hauteur_cm: 202,
    });
  });
  it('accepte x, X et * comme séparateurs', () => {
    expect(parseDimensionTriplet('60x40x38')).toEqual({ largeur_cm: 60, profondeur_cm: 40, hauteur_cm: 38 });
    expect(parseDimensionTriplet('60 X 40 X 38')).toEqual({ largeur_cm: 60, profondeur_cm: 40, hauteur_cm: 38 });
    expect(parseDimensionTriplet('60*40*38')).toEqual({ largeur_cm: 60, profondeur_cm: 40, hauteur_cm: 38 });
  });
  it('ignore un suffixe entre parenthèses (grille KALLAX)', () => {
    expect(parseDimensionTriplet('42×39×77 (1×2)')).toEqual({
      largeur_cm: 42,
      profondeur_cm: 39,
      hauteur_cm: 77,
    });
  });
  it('gère les décimales FR', () => {
    expect(parseDimensionTriplet('42×39,5×77')).toEqual({ largeur_cm: 42, profondeur_cm: 39.5, hauteur_cm: 77 });
  });
  it('préserve l’ordre canonique L×P×H (pas de tri)', () => {
    const t = parseDimensionTriplet('202×28×80');
    expect(t).toEqual({ largeur_cm: 202, profondeur_cm: 28, hauteur_cm: 80 });
  });
  it('retourne null si le compte de cotes n’est pas 3', () => {
    expect(parseDimensionTriplet('80×28')).toBeNull();
    expect(parseDimensionTriplet('80×28×202×10')).toBeNull();
    expect(parseDimensionTriplet('80')).toBeNull();
  });
  it('retourne null si une cote est invalide', () => {
    expect(parseDimensionTriplet('80×0×202')).toBeNull();
    expect(parseDimensionTriplet('80×abc×202')).toBeNull();
  });
  it('retourne null pour une entrée non-string', () => {
    expect(parseDimensionTriplet(123 as unknown)).toBeNull();
    expect(parseDimensionTriplet(null)).toBeNull();
  });
});

describe('normalizeProduct', () => {
  it('met les cotes dans les champs canoniques et vide les champs prix (grain b)', () => {
    const n = normalizeProduct({
      id: 'ikea-billy-80x28x202',
      enseigne: 'IKEA',
      gamme: 'BILLY',
      nom_produit: 'BILLY 80×28×202',
      type_meuble: 'bibliotheque',
      largeur_cm: 80,
      profondeur_cm: 28,
      hauteur_cm: 202,
      montage: 'pose',
      materiau: 'mélaminé',
      piece: ['multi'],
      url_produit: 'gamme:BILLY',
      certitude: 'confirmé',
      prix: 59,
    });
    expect(n.largeur_cm).toBe(80);
    expect(n.profondeur_cm).toBe(28);
    expect(n.hauteur_cm).toBe(202);
    expect(n.prix).toBeNull();
    expect(n.devise).toBeNull();
    expect(n.date_maj_prix).toBeNull();
    expect(n.certitude).toBe('confirmé');
  });
  it('n’invente pas de cotes : une cote invalide devient null', () => {
    const n = normalizeProduct({ id: 'x', gamme: 'X', largeur_cm: 'oops', profondeur_cm: 0, hauteur_cm: 10 });
    expect(n.largeur_cm).toBeNull();
    expect(n.profondeur_cm).toBeNull();
    expect(n.hauteur_cm).toBe(10);
  });
});

describe('validateProduct', () => {
  const base = {
    id: 'x',
    gamme: 'BILLY',
    largeur_cm: 80,
    profondeur_cm: 28,
    hauteur_cm: 202,
    url_produit: 'gamme:BILLY',
  };
  it('valide une ligne complète du grain (1)', () => {
    expect(validateProduct(base)).toEqual([]);
  });
  it('N’EXIGE PAS reference (piège n°1)', () => {
    // Aucun champ reference présent → toujours valide.
    expect(validateProduct(base)).toEqual([]);
  });
  it('rejette une cote absente ou ≤ 0', () => {
    expect(validateProduct({ ...base, largeur_cm: 0 })).toContain('largeur_cm invalide (> 0 requis)');
    expect(validateProduct({ ...base, hauteur_cm: null })).toContain('hauteur_cm invalide (> 0 requis)');
  });
  it('rejette id / gamme / url_produit manquants', () => {
    expect(validateProduct({ ...base, id: '' })).toContain('id manquant');
    expect(validateProduct({ ...base, gamme: undefined })).toContain('gamme manquante');
    expect(validateProduct({ ...base, url_produit: '' })).toContain('url_produit manquante');
  });
});
