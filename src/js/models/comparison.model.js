/**
 * Modèle de gestion des zones en comparaison
 * 
 * Gère :
 * - Le stockage des zones (max 3)
 * - L'ajout/suppression de zones
 * - La vérification des limites
 * - L'état du mode comparaison (actif/inactif)
 */

// Stockage des zones en comparaison (max 3)
const comparisonZones = [];

// Limite maximale de zones
const MAX_ZONES = 3;

// État du mode comparaison
let comparisonModeActive = false;

/**
 * Active le mode comparaison
 */
export function activateComparisonMode() {
  comparisonModeActive = true;
}

/**
 * Désactive le mode comparaison
 */
export function deactivateComparisonMode() {
  comparisonModeActive = false;
}

/**
 * Bascule le mode comparaison (toggle)
 * 
 * @returns {boolean} Nouvel état du mode
 */
export function toggleComparisonMode() {
  comparisonModeActive = !comparisonModeActive;
  return comparisonModeActive;
}

/**
 * Vérifie si le mode comparaison est actif
 * 
 * @returns {boolean} true si le mode est actif
 */
export function isComparisonModeActive() {
  return comparisonModeActive;
}

/**
 * Récupère toutes les zones actuellement en comparaison
 * 
 * @returns {Array} Liste des zones en comparaison
 */
export function getComparisonZones() {
  return [...comparisonZones];
}

/**
 * Récupère le nombre de zones en comparaison
 * 
 * @returns {number} Nombre de zones (0 à 3)
 */
export function getComparisonCount() {
  return comparisonZones.length;
}

/**
 * Vérifie si on peut ajouter une nouvelle zone
 * 
 * @returns {boolean} true si on peut ajouter (< 3 zones)
 */
export function canAddZone() {
  return comparisonZones.length < MAX_ZONES;
}

/**
 * Vérifie si une zone est déjà en comparaison
 * 
 * @param {string} zoneId - Identifiant unique de la zone
 * @returns {boolean} true si la zone est déjà présente
 */
export function isZoneInComparison(zoneId) {
  return comparisonZones.some(zone => zone.id === zoneId);
}

/**
 * Ajoute une zone à la comparaison
 * 
 * @param {Object} zoneData - Données de la zone à ajouter
 * @param {string} zoneData.id - Identifiant unique
 * @param {string} zoneData.name - Nom de la zone
 * @param {string} zoneData.type - Type : "département", "commune", "section"
 * @param {Object} zoneData.stats - Statistiques de la zone
 * @param {Array} zoneData.transports - Liste des transports
 * @returns {boolean} true si ajoutée avec succès, false sinon
 */
export function addZone(zoneData) {
  if (!canAddZone()) {
    console.warn("Impossible d'ajouter : limite de 3 zones atteinte");
    return false;
  }

  if (isZoneInComparison(zoneData.id)) {
    console.warn("Cette zone est déjà en comparaison");
    return false;
  }

  comparisonZones.push(zoneData);
  console.log("Zone ajoutée à la comparaison:", zoneData.name);
  
  return true;
}

/**
 * Supprime une zone de la comparaison
 * 
 * @param {string} zoneId - Identifiant de la zone à supprimer
 * @returns {boolean} true si supprimée avec succès, false sinon
 */
export function removeZone(zoneId) {
  const index = comparisonZones.findIndex(zone => zone.id === zoneId);
  
  if (index === -1) {
    console.warn("Zone non trouvée dans la comparaison");
    return false;
  }

  const removed = comparisonZones.splice(index, 1)[0];
  console.log("Zone supprimée de la comparaison:", removed.name);
  
  return true;
}

/**
 * Vide toute la comparaison
 */
export function clearComparison() {
  comparisonZones.length = 0;
  console.log("🧹 Comparaison vidée");
}

/**
 * Récupère la limite maximale de zones
 * 
 * @returns {number} Limite max (3)
 */
export function getMaxZones() {
  return MAX_ZONES;
}