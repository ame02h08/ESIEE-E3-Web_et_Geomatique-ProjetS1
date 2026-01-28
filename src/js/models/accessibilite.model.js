import booleanPointInPolygon from "https://cdn.jsdelivr.net/npm/@turf/boolean-point-in-polygon@6/+esm";
import distance from "https://cdn.jsdelivr.net/npm/@turf/distance@6/+esm";
import centroid from "https://cdn.jsdelivr.net/npm/@turf/centroid@6/+esm";
import { state } from "../app/state.js";

/**
 * Détermine quelles lignes de transport desservent un territoire donné.
 *
 * VERSION AMÉLIORÉE avec buffer de proximité
 * 
 * Un territoire est considéré comme "desservi" lorsqu'au moins une station
 * de transport est située :
 * 1. À l'intérieur de son périmètre géographique, OU
 * 2. À moins de 1 km du centre du territoire
 *
 * Cette approche plus permissive permet de capturer les stations situées
 * juste à la frontière des zones administratives.
 *
 * @param {GeoJSON.Feature} zoneFeature - Territoire sélectionné (feature GeoJSON).
 * @returns {Array<GeoJSON.Feature>} Liste de lignes de transport desservant ce territoire.
 */
export function getTransportsServingZone(zoneFeature) {
  // Géométrie du territoire sélectionné (polygone)
  const zoneGeom = zoneFeature.geometry;
  
  // Calculer le centre de la zone pour la recherche par distance
  const zoneCentroid = centroid(zoneFeature);
  
  // Récupération des stations et des lignes de transport chargées dans le state
  const stops = state.data?.stops?.features || [];
  const lines = state.data?.transports?.features || [];

  // Distance maximale de recherche (en kilomètres)
  const MAX_DISTANCE_KM = 1.0;

  /**
   * Étape 1 : Repérer les lignes qui disposent d'au moins
   * une station située dans ou près de la zone sélectionnée.
   */
  const keysInZone = new Set();

  for (const stop of stops) {
    if (!stop || !stop.geometry) continue;
    
    // Vérification en 2 étapes :
    // 1. Station dans le polygone ? (vérification exacte)
    let isServing = booleanPointInPolygon(stop, zoneGeom);
    
    // 2. Si pas dans le polygone, vérifier la distance au centre
    if (!isServing) {
      try {
        const dist = distance(stop, zoneCentroid, { units: 'kilometers' });
        isServing = dist <= MAX_DISTANCE_KM;
      } catch (e) {
        // En cas d'erreur de calcul, on ignore cette station
        continue;
      }
    }
    
    // Si la station dessert la zone (dans ou proche)
    if (isServing) {
      const p = stop.properties || {};
      const mode = (p.mode || "").toUpperCase();
      const ligne = p.ligne;
      
      if (!mode || !ligne) continue;
      
      keysInZone.add(`${mode}|${ligne}`);
    }
  }

  // Si aucune station n'est trouvée → pas de desserte
  if (keysInZone.size === 0) {
    return [];
  }

  /**
   * Étape 2 : Associer chaque ligne détectée à sa couleur
   */
  const featuresOut = [];
  const usedKeys = new Set();

  for (const line of lines) {
    if (!line) continue;
    
    const p = line.properties || {};
    const mode = (p.mode || "").toUpperCase();
    const ligne = p.ligne;
    
    if (!mode || !ligne) continue;

    const key = `${mode}|${ligne}`;
    
    if (!keysInZone.has(key) || usedKeys.has(key)) continue;
    
    usedKeys.add(key);
    
    featuresOut.push({
      type: "Feature",
      geometry: null,
      properties: {
        mode,
        ligne,
        couleur: p.couleur || "#999999",
      },
    });
  }

  /**
   * Étape 3 : Gestion des lignes sans couleur
   */
  for (const key of keysInZone) {
    if (usedKeys.has(key)) continue;
    const [mode, ligne] = key.split("|");

    featuresOut.push({
      type: "Feature",
      geometry: null,
      properties: {
        mode,
        ligne,
        couleur: "#999999",
      },
    });
  }

  return featuresOut;
}