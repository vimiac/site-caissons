import { describe, it, expect } from 'vitest';
import { DOCTRINE, classerPile } from '../doctrine';

// Les 11 gammes des 76 combinaisons doivent toutes être connues de la doctrine.
const GAMMES_ATTENDUES = [
  'EKET', 'PLATSA', 'BILLY', 'Atomia', 'Stacked', // sanctionnées
  'KALLAX', 'BESTÅ', 'DELINIA', 'Colour Cabinet', 'METOD', 'PAX', // non documentées
];

describe('doctrine — couverture et sanction par gamme', () => {
  it('les 11 gammes du dataset sont présentes', () => {
    for (const g of GAMMES_ATTENDUES) expect(DOCTRINE[g], `manque ${g}`).toBeDefined();
    expect(Object.keys(DOCTRINE).length).toBe(11);
  });

  it('la sanction correspond au G1 (5 sanctionnées, 6 non documentées)', () => {
    const sanctionnees = Object.values(DOCTRINE).filter((d) => d.sanction === 'sanctionné').map((d) => d.gamme);
    expect(sanctionnees.sort()).toEqual(['Atomia', 'BILLY', 'EKET', 'PLATSA', 'Stacked'].sort());
    const nonDoc = Object.values(DOCTRINE).filter((d) => d.sanction === 'non-documenté').length;
    expect(nonDoc).toBe(6);
  });

  it('Muuto porte ses limites numériques documentées (285 cm / 6 modules)', () => {
    expect(DOCTRINE.Stacked.maxHauteurPileCm).toBe(285);
    expect(DOCTRINE.Stacked.maxModulesPile).toBe(6);
  });
});

describe('classerPile — avertissement CONTEXTUEL (exigence non négociable)', () => {
  it('une seule rangée → aucun-empilement, PAS de badge contextuel', () => {
    const a = classerPile([{ gamme: 'KALLAX', hauteur: 42 }]);
    expect(a.regime).toBe('aucun-empilement');
    expect(a.contextuel).toBe(false);
  });

  it('pile monogamme SANCTIONNÉE dans les limites → PAS de badge contextuel', () => {
    const a = classerPile([{ gamme: 'EKET', hauteur: 35 }, { gamme: 'EKET', hauteur: 70 }]);
    expect(a.regime).toBe('sanctionné');
    expect(a.contextuel).toBe(false);
    expect(a.niveau).toBe('ok');
  });

  it('pile monogamme NON documentée → badge contextuel (attention)', () => {
    const a = classerPile([{ gamme: 'KALLAX', hauteur: 42 }, { gamme: 'KALLAX', hauteur: 42 }]);
    expect(a.regime).toBe('non-documenté');
    expect(a.contextuel).toBe(true);
    expect(a.message).toContain('ne prévoit pas');
  });

  it('pile INTER-GAMME → badge contextuel FORT (personne ne sanctionne)', () => {
    const a = classerPile([{ gamme: 'Atomia', hauteur: 75 }, { gamme: 'Stacked', hauteur: 43.6 }]);
    expect(a.regime).toBe('inter-gamme');
    expect(a.contextuel).toBe(true);
    expect(a.niveau).toBe('fort');
    expect(a.message).toContain('gammes différentes');
  });

  it('pile sanctionnée AU-DELÀ des limites documentées → hors-limites (badge contextuel)', () => {
    // 7 modules Muuto = 305,2 cm > 285 cm et > 6 modules.
    const sept = Array.from({ length: 7 }, () => ({ gamme: 'Stacked', hauteur: 43.6 }));
    const a = classerPile(sept);
    expect(a.regime).toBe('hors-limites');
    expect(a.contextuel).toBe(true);
    expect(a.message).toContain('AU-DELÀ');
  });

  it('le fait géométrique (jamais un montage) est énoncé sur les combinaisons empilées', () => {
    const a = classerPile([{ gamme: 'BESTÅ', hauteur: 64 }, { gamme: 'BESTÅ', hauteur: 64 }]);
    expect(a.message.toLowerCase()).toContain('ajustement dimensionnel');
    expect(a.message.toLowerCase()).not.toContain('montez');
  });
});
