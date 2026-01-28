/**
 * Gestion du système de filtrage des données immobilières.
 *
 * Ce module centralise la logique de filtrage multi-critères appliquée
 * aux données DVF (budget, surface, type de bien, accessibilité transport).
 *
 * Il permet de :
 * - Stocker les critères de filtrage actifs
 * - Vérifier si une entité respecte les filtres
 * - Recalculer les statistiques sur un ensemble de ventes filtrées
 * - Calculer le score de compatibilité d'une zone avec les critères
 */

// Stockage des critères de filtrage actifs
const activeFilters = {
  budget: null,      // Budget maximum (€)
  surface: null,     // Surface minimale (m²)
  type: null,        // Type de bien : "1" (maison) ou "2" (appartement)
  transport: false   // true = uniquement zones avec transport
};

/**
 * Met à jour les critères de filtrage actifs.
 *
 * @param {Object} filters - Objet contenant les nouveaux critères
 * @param {number|null} filters.budget - Budget maximum en euros
 * @param {number|null} filters.surface - Surface minimale en m²
 * @param {string|null} filters.type - Type de bien ("1" ou "2")
 * @param {boolean} filters.transport - Filtre transport actif ou non
 */
export function setFilters(filters) {
  Object.assign(activeFilters, filters);
}

/**
 * Récupère une copie des critères de filtrage actuellement actifs.
 *
 * @returns {Object} - Copie de l'objet activeFilters
 */
export function getFilters() {
  return { ...activeFilters };
}

/**
 * Réinitialise tous les critères de filtrage à leur valeur par défaut.
 */
export function resetFilters() {
  activeFilters.budget = null;
  activeFilters.surface = null;
  activeFilters.type = null;
  activeFilters.transport = false;
}

/**
 * Vérifie si une entité géographique respecte les critères de filtrage actifs.
 *
 * Cette fonction est utilisée pour déterminer si une commune ou une section
 * doit être affichée ou masquée sur la carte en fonction des filtres.
 *
 * @param {Object} entity - Entité à tester (commune ou section avec statistiques)
 * @param {number} entity.prixMedian - Prix médian au m² de l'entité
 * @param {number} entity.surfaceMin - Surface minimale disponible
 * @param {Array} entity.typeLocal - Types de locaux présents (ex: [1, 2])
 * @param {Array} transports - Liste des lignes de transport desservant la zone
 * @returns {boolean} - true si l'entité respecte tous les filtres actifs
 */
export function matchesFilters(entity, transports = []) {
  const filters = getFilters();

  // Filtre budget : exclure si prix médian dépasse le budget
  if (filters.budget !== null && entity.prixMedian > filters.budget) {
    return false;
  }

  // Filtre surface : exclure si surface min de l'entité < surface demandée
  if (filters.surface !== null && entity.surfaceMin < filters.surface) {
    return false;
  }

  // Filtre type de bien : exclure si le type demandé n'est pas présent
  if (filters.type !== null) {
    const hasType = entity.typeLocal?.includes(parseInt(filters.type));
    if (!hasType) return false;
  }

  // Filtre transport : exclure si aucun transport et filtre activé
  if (filters.transport && transports.length === 0) {
    return false;
  }

  return true;
}

/**
 * Calcule des statistiques filtrées à partir d'un ensemble de ventes.
 *
 * Applique les critères de filtrage actifs sur une liste de ventes DVF
 * et recalcule les indicateurs statistiques (nombre de ventes, répartition
 * maisons/appartements, prix médian) uniquement sur les ventes respectant les filtres.
 *
 * @param {Array} ventes - Liste des ventes DVF brutes
 * @param {Array} transports - Liste des transports desservant la zone (optionnel)
 * @returns {Object} - Objet contenant les statistiques filtrées
 * @returns {number} return.ventes - Nombre total de ventes après filtrage
 * @returns {number} return.maisons - Nombre de maisons après filtrage
 * @returns {number} return.apparts - Nombre d'appartements après filtrage
 * @returns {number} return.prixMedian - Prix médian au m² après filtrage
 * @returns {Array} return.ventesFiltered - Liste des ventes respectant les filtres
 */
export function getFilteredStats(ventes, transports = []) {
  const filters = getFilters();
  
  // Filtrer les ventes selon les critères actifs
  const ventesFiltered = ventes.filter(vente => {
    // Vérifications de base : vente valide
    if (!vente.surface_reelle_bati || vente.surface_reelle_bati <= 0) {
      return false;
    }
    if (!vente.valeur_fonciere || vente.valeur_fonciere <= 0) {
      return false;
    }

    // Filtre budget : le prix TOTAL de la vente ne doit pas dépasser le budget
    if (filters.budget !== null && vente.valeur_fonciere > filters.budget) {
      return false;
    }

    // Filtre surface : la surface doit être >= à la surface minimale demandée
    if (filters.surface !== null && vente.surface_reelle_bati < filters.surface) {
      return false;
    }

    // Filtre type de bien : exclure si type de local ne correspond pas
    if (filters.type !== null && vente.type_local !== parseInt(filters.type)) {
      return false;
    }

    // Filtre transport : si activé et pas de transport, exclure toutes les ventes
    if (filters.transport && transports.length === 0) {
      return false;
    }

    return true;
  });

  // Calcul du nombre total de ventes filtrées
  const nbVentes = ventesFiltered.length;

  // Répartition par type de bien
  const nbMaisons = ventesFiltered.filter(v => v.type_local === 1).length;
  const nbApparts = ventesFiltered.filter(v => v.type_local === 2).length;

  // Calcul du prix médian au m² sur les ventes filtrées
  const prixAuM2 = ventesFiltered
    .map(v => v.valeur_fonciere / v.surface_reelle_bati)
    .sort((a, b) => a - b);

  const prixMedian = prixAuM2.length > 0
    ? prixAuM2[Math.floor(prixAuM2.length / 2)]
    : 0;

  // Retourner le format attendu par panel.view.js
  return {
    ventes: nbVentes,           // Nom de champ attendu par showDeptPanel()
    maisons: nbMaisons,         // Nom de champ attendu par showDeptPanel()
    apparts: nbApparts,         // Nom de champ attendu par showDeptPanel()
    prixMedian: prixMedian,
    ventesFiltered: ventesFiltered  // Pour affichage détaillé dans le panneau
  };
}

/**
 * Calcule le score de compatibilité d'une zone avec les filtres actifs
 * 
 * Retourne un pourcentage représentant combien de ventes dans la zone
 * correspondent aux critères de filtrage de l'utilisateur.
 * 
 * @param {Array} ventes - Liste des ventes de la zone
 * @param {Array} transports - Liste des transports desservant la zone
 * @returns {Object} - { score: 0-100, ventesTotal, ventesCorrespondantes }
 */
export function calculateCompatibilityScore(ventes, transports = []) {
  if (!ventes || ventes.length === 0) {
    return { score: 0, ventesTotal: 0, ventesCorrespondantes: 0 };
  }

  const filters = getFilters();
  
  // Si aucun filtre actif, score de 100%
  const hasActiveFilters = 
    filters.budget !== null || 
    filters.surface !== null || 
    filters.type !== null || 
    filters.transport === true;
  
  if (!hasActiveFilters) {
    return { score: 100, ventesTotal: ventes.length, ventesCorrespondantes: ventes.length };
  }

  // Compter les ventes qui correspondent aux filtres
  const ventesCorrespondantes = ventes.filter(vente => {
    // Vérifications de base
    if (!vente.surface_reelle_bati || vente.surface_reelle_bati <= 0) return false;
    if (!vente.valeur_fonciere || vente.valeur_fonciere <= 0) return false;

    // Appliquer les filtres
    if (filters.budget !== null && vente.valeur_fonciere > filters.budget) return false;
    if (filters.surface !== null && vente.surface_reelle_bati < filters.surface) return false;
    if (filters.type !== null && vente.type_local !== parseInt(filters.type)) return false;
    if (filters.transport && transports.length === 0) return false;

    return true;
  }).length;

  // Calculer le pourcentage
  const score = Math.round((ventesCorrespondantes / ventes.length) * 100);

  return { 
    score, 
    ventesTotal: ventes.length, 
    ventesCorrespondantes 
  };
}