import { describe, it, expect } from 'vitest';
import { rechercheQuery, rechercheURL, resolveLien, type MarqueLiens } from '../liens';
import type { CaissonProduct } from '../types';
import dataJson from '../../data/marque-recherche.json';

function make(over: Partial<CaissonProduct>): CaissonProduct {
  return {
    id: over.id ?? 'id',
    enseigne: over.enseigne ?? 'IKEA',
    gamme: over.gamme ?? 'BILLY',
    nom_produit: over.nom_produit ?? 'x',
    type_meuble: 'cube',
    largeur_cm: over.largeur_cm ?? 40,
    profondeur_cm: over.profondeur_cm ?? 28,
    hauteur_cm: over.hauteur_cm ?? 106,
    montage: 'pose',
    materiau: 'mélaminé',
    piece: ['multi'],
    url_produit: 'gamme:BILLY',
    url_gamme_resolue: null,
    certitude: 'confirmé',
    ...over,
  };
}

const MARQUES: Record<string, MarqueLiens> = {
  IKEA: { recherche: 'https://www.ikea.com/fr/fr/search/?q={q}', site: 'https://www.ikea.com/fr/fr/' },
};

describe('lien de recherche préremplie', () => {
  it('construit une requête gamme + cotes (× écrit x)', () => {
    expect(rechercheQuery(make({ gamme: 'BILLY', largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106 }))).toBe('BILLY 40x28x106');
    expect(rechercheQuery(make({ gamme: 'BESTÅ', largeur_cm: 120, profondeur_cm: 42, hauteur_cm: 64 }))).toBe('BESTÅ 120x42x64');
  });

  it('substitue {q} et encode proprement (espaces, accents)', () => {
    const billy = rechercheURL(make({ gamme: 'BILLY', largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106 }), MARQUES);
    expect(billy).toBe('https://www.ikea.com/fr/fr/search/?q=BILLY%2040x28x106');
    const besta = rechercheURL(make({ gamme: 'BESTÅ', largeur_cm: 120, profondeur_cm: 42, hauteur_cm: 64 }), MARQUES);
    expect(besta).toBe('https://www.ikea.com/fr/fr/search/?q=BEST%C3%85%20120x42x64');
    // URL valide, sans espace ni « × » bruts, sans placeholder résiduel
    for (const u of [billy!, besta!]) {
      expect(() => new URL(u)).not.toThrow();
      expect(u).not.toMatch(/[ ×]/);
      expect(u).not.toContain('{q}');
    }
  });

  it('renvoie null si la marque n’a pas de modèle de recherche', () => {
    expect(rechercheURL(make({ enseigne: 'INCONNUE' }), MARQUES)).toBeNull();
  });
});

describe('priorité du lien final', () => {
  it('recherche préremplie en premier', () => {
    const l = resolveLien(make({}), MARQUES, 'https://exemple/gamme');
    expect(l).toEqual({ href: 'https://www.ikea.com/fr/fr/search/?q=BILLY%2040x28x106', kind: 'recherche' });
  });

  it('sans recherche mais avec page de gamme explicite → gamme', () => {
    const l = resolveLien(make({ enseigne: 'SANS' }), { SANS: { site: 'https://sans/' } }, 'https://exemple/gamme');
    expect(l).toEqual({ href: 'https://exemple/gamme', kind: 'gamme' });
  });

  it('sans recherche ni gamme → site générique', () => {
    const l = resolveLien(make({ enseigne: 'SANS' }), { SANS: { site: 'https://sans/' } }, null);
    expect(l).toEqual({ href: 'https://sans/', kind: 'site' });
  });

  it('rien de tout ça → null (pas de lien mort)', () => {
    expect(resolveLien(make({ enseigne: 'RIEN' }), {}, null)).toBeNull();
  });

  it('recherche=null (marque sans moteur adressable) → repli site', () => {
    const l = resolveLien(make({ enseigne: 'HAY' }), { HAY: { recherche: null, site: 'https://www.hay.com/' } }, null);
    expect(l).toEqual({ href: 'https://www.hay.com/', kind: 'site' });
  });
});

// Garde-fou sur les VRAIES données : params constatés le 2026-09-14 (Arnaud a testé les liens).
// Fige la correction : Castorama ?term=, Leroy Merlin /search?q=, HAY sans recherche → site.
describe('marque-recherche.json (données réelles)', () => {
  const DATA = (dataJson as any).marques as Record<string, MarqueLiens>;

  it('les 5 marques produisent chacune un lien valide (jamais mort)', () => {
    for (const enseigne of ['IKEA', 'Castorama', 'Muuto', 'HAY', 'Leroy Merlin']) {
      const l = resolveLien(make({ enseigne, gamme: 'TEST', largeur_cm: 100, profondeur_cm: 45, hauteur_cm: 225 }), DATA, null);
      expect(l, `lien manquant pour ${enseigne}`).not.toBeNull();
      expect(() => new URL(l!.href)).not.toThrow();
      expect(l!.href).not.toContain('{q}');
    }
  });

  it('Castorama utilise ?term= (pas ?q=)', () => {
    const l = resolveLien(make({ enseigne: 'Castorama', gamme: 'Atomia', largeur_cm: 100, profondeur_cm: 45, hauteur_cm: 225 }), DATA, null);
    expect(l!.kind).toBe('recherche');
    expect(l!.href).toBe('https://www.castorama.fr/search?term=Atomia%20100x45x225');
  });

  it('Leroy Merlin utilise /search?q= (pas /produits/recherche)', () => {
    const l = resolveLien(make({ enseigne: 'Leroy Merlin', gamme: 'DELINIA', largeur_cm: 120, profondeur_cm: 58, hauteur_cm: 77 }), DATA, null);
    expect(l!.kind).toBe('recherche');
    expect(l!.href).toBe('https://www.leroymerlin.fr/search?q=DELINIA%20120x58x77');
  });

  it('HAY bascule sur le site (aucune recherche adressable par URL)', () => {
    const l = resolveLien(make({ enseigne: 'HAY', gamme: 'Colour Cabinet', largeur_cm: 120, profondeur_cm: 39, hauteur_cm: 51 }), DATA, null);
    expect(l!.kind).toBe('site');
    expect(l!.href).toBe('https://www.hay.com/');
  });

  it('IKEA et Muuto restent en ?q= (inchangés, testés OK par Arnaud)', () => {
    const ikea = resolveLien(make({ enseigne: 'IKEA', gamme: 'BILLY', largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106 }), DATA, null);
    expect(ikea!.href).toBe('https://www.ikea.com/fr/fr/search/?q=BILLY%2040x28x106');
    const muuto = resolveLien(make({ enseigne: 'Muuto', gamme: 'Stacked', largeur_cm: 21.8, profondeur_cm: 35, hauteur_cm: 43.6 }), DATA, null);
    expect(muuto!.kind).toBe('recherche');
    expect(muuto!.href).toContain('muuto.com');
    expect(muuto!.href).toContain('?q=');
  });
});
