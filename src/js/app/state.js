/**
 * État applicatif global.
 *
 * Il centralise :
 * - la carte Leaflet
 * - les couches actuellement affichées
 * - les données chargées / agrégées
 *
 * Cet objet permet au contrôleur de synchroniser l'affichage de la carte avec les données,
 * et d'assurer une navigation cohérente entre les échelles (département → commune → section).
 */
export const state = {
  /**
   * Instance de la carte Leaflet initialisée via initMap().
   * Devient non-null après le démarrage de l'application.
   */
  map: null,

  /**
   * Couches actuellement affichées sur la carte.
   *
   * Principe :
   * - Une seule couche par niveau (dept → commune → section)
   * - Si une couche est ne doit plus être visible sur la carte (ex : zoom), sa valeur doit redevenir null
   */
  layers: {
    dept: null, // couche des départements (niveau global, affichée au démarrage)
    commune: null, // couche des communes (affichée après clic sur un département)
    section: null, // couche des sections cadastrales (affichée après clic sur une commune)
    transport: null,
  },
  /**
   * Données chargées au démarrage puis pré-traitées pour l'affichage.
   *
   * Ces données servent à alimenter les couches, les panneaux de détail
   * ainsi que les opérations d'agrégation (US6–US8) et mobilité (US9–US12).
   */

  data: {
    dvf: [], // Liste brute des transactions DVF
    transports: [], // Données de transports
    /*/**
     * Statistiques agrégées par département :
     * { [codeDept]: { ventes, prixMedian, maisons, apparts, ... } }
     * → utilisées dans le panneau département.
     */
    statsDept: {},
    /**
     * Médiane de prix par commune :
     * { [codeCommune]: prixMedian }
     */
    prixCommune: {},
    /**
     * Médiane de prix par section cadastrale :
     * { [codeSection]: prixMedian }
     * */
    prixSection: {},
    /**
     * Index : commune → liste de ventes DVF
     * Exemple : Map { "75056" → [vente1, vente2, ...] }
     * → utilisé pour afficher les ventes détaillées d'une commune.
     */
    ventesByCommune: new Map(),
    /**
     * Index : section cadastrale → liste de ventes DVF
     * Exemple : Map { "7505601" → [vente1, vente2, ...] }
     * → utilisé poura afficher les ventes détaillées d'une section.
     */
    ventesBySection: new Map(),
  },
};
