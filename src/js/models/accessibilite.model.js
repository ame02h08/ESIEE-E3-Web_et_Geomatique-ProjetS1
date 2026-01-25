import booleanPointInPolygon from "https://cdn.jsdelivr.net/npm/@turf/boolean-point-in-polygon@6/+esm";
import { state } from "../app/state.js";

/**
 * Détermine quelles lignes de transport desservent un territoire donné.
 *
 * Un territoire (département, commune ou section cadastrale) est considéré
 * comme "desservi" lorsqu’au moins une station de transport est située
 * à l'intérieur de son périmètre géographique.
 *
 * Pour chaque ligne détectée, la fonction renvoie un objet décrivant :
 * - le mode (métro, RER, tram, train…)
 * - le nom/numéro de la ligne
 * - la couleur associée (si disponible)
 *
 * Cette fonction est utilisée lors de la sélection d’un territoire afin
 * d’enrichir le panneau d’information avec les lignes de transport correspondantes.
 *
 * @param {GeoJSON.Feature} zoneFeature - Territoire sélectionné (feature GeoJSON).
 * @returns {Array<GeoJSON.Feature>} Liste de lignes de transport desservant ce territoire.
 */
export function getTransportsServingZone(zoneFeature) {
  // Géométrie du territoire sélectionné (polygone)
  const zoneGeom = zoneFeature.geometry;
  // Récupération des stations et des lignes de transport chargées dans le state
  const stops = state.data?.stops?.features || []; //Stations
  const lines = state.data?.transports?.features || []; //Lignes (RER, métro, tram, etc.)

  /**
   * Étape 1 : Repérer les lignes qui disposent d'au moins
   * une station située à l'intérieur de la zone sélectionnée.
   *
   * On stocke les identifiants sous la forme "MODE|LIGNE"
   * ex: "RER|B", "METRO|6", "TRAM|T2"
   */
  const keysInZone = new Set();

  for (const stop of stops) {
    if (!stop || !stop.geometry) continue;
    // Vérification spatiale : "la station est-elle dans la zone ?"
    if (booleanPointInPolygon(stop, zoneGeom)) {
      const p = stop.properties || {};
      const mode = (p.mode || "").toUpperCase();
      const ligne = p.ligne;
      // On ignore les stations sans mode ou sans ligne
      if (!mode || !ligne) continue;
      // On ajoute l'identifiant ligne/mode
      keysInZone.add(`${mode}|${ligne}`);
    }
  }
  // Si aucune station n'est trouvée dans la zone → pas de desserte
  if (keysInZone.size === 0) {
    return [];
  }

  /**
   * Étape 2 : Associer chaque ligne détectée à sa couleur
   * Chaque ligne est représentée par un "Feature" plus simple :
   *
   * {
   *   mode: "RER",
   *   ligne: "B",
   *   couleur: "#0033cc"
   * }
   *
   * La couleur provient des données sources si elle existe,
   * sinon une couleur par défaut est appliquée.
   */
  const featuresOut = [];
  const usedKeys = new Set();

  for (const line of lines) {
    if (!line) continue;
    // Récupère les propriétés de la ligne (mode, numéro, couleur, etc.
    const p = line.properties || {};
    // Normalize le mode (ex: "rer", "RER", "Rer" → "RER")
    const mode = (p.mode || "").toUpperCase();
    const ligne = p.ligne;
    // Si l'une des deux informations est absente, on ne peut pas identifier la ligne → on passe
    if (!mode || !ligne) continue;

    // Création d’une clé unique identifiant la ligne
    // ex : "RER|B", "METRO|6", "TRAM|T2"
    const key = `${mode}|${ligne}`;
    // On ne garde que les lignes détectées à l'étape 1
    /**
     * Filtrage des lignes :
     * - On ne conserve que celles détectées à l'étape précédente (celles ayant au moins une station dans la zone)
     * - On évite les doublons si une ligne apparaît plusieurs fois dans les données
     */
    if (!keysInZone.has(key) || usedKeys.has(key)) continue;
    // On marque cette ligne comme traitée pour éviter de l'ajouter plusieurs fois
    usedKeys.add(key);
    /**
     * On garde uniquement les informations utiles pour l’affichage dans le panneau :
     * mode, ligne et couleur. Le tracé de la ligne n’est pas utilisé ici, donc on ne le charge pas.
     */
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
   * Étape 3 : Gestion du cas où une ligne a bien des stations
   * mais n'a pas de couleur renseignée dans les données.
   *
   * On lui attribue également une couleur par défaut.
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
        couleur: "#999999", // couleur par défaut
      },
    });
  }

  return featuresOut;
}
