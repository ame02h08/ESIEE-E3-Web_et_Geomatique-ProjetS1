/**
 * Modèle pour l'analyse de pouvoir d'achat
 * 
 * Calcule quelles communes sont accessibles avec un budget donné
 * et quelle surface on peut acheter
 */

/**
 * Calcule les communes accessibles avec un budget donné
 * 
 * @param {number} budget - Budget en euros
 * @param {Object} prixCommune - Prix médian par commune { communeId: prix }
 * @param {Object} geoCommunes - GeoJSON des communes
 * @returns {Array} - Liste des communes avec surface possible, triée par surface décroissante
 */
export function analyserPouvoirAchat(budget, prixCommune, geoCommunes) {
  const results = [];

  // Pour chaque commune dans le GeoJSON
  for (const feature of geoCommunes.features) {
    const communeId = feature.properties.id;
    const communeName = feature.properties.nom;
    const prixM2 = prixCommune[communeId];

    // Si on a un prix médian pour cette commune
    if (prixM2 && prixM2 > 0) {
      // Calculer la surface possible
      const surfacePossible = Math.floor(budget / prixM2);

      results.push({
        id: communeId,
        name: communeName,
        prixM2: prixM2,
        surfacePossible: surfacePossible
      });
    }
  }

  // Trier par surface possible (décroissant)
  results.sort((a, b) => b.surfacePossible - a.surfacePossible);

  return results;
}

/**
 * Récupère le top N des communes
 * 
 * @param {Array} results - Résultats de l'analyse
 * @param {number} n - Nombre de communes à retourner (défaut: 5)
 * @returns {Array} - Top N communes
 */
export function getTopCommunes(results, n = 5) {
  return results.slice(0, n);
}