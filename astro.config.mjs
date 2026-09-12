// @ts-check
import { defineConfig } from 'astro/config';

// Site 100% statique, sans backend. Filtrage côté client sur le JSON versionné.
// `site` sert au sitemap/URLs absolues ; à ajuster au vrai domaine avant déploiement (Arnaud déploie).
export default defineConfig({
  site: 'https://caissons.vimiac.fr',
  output: 'static',
  build: {
    // Fichiers d'assets dans /_astro (défaut Astro).
  },
});
