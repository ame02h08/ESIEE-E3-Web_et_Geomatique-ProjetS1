// views/transport.view.js
import { state } from "../app/state.js";

/* =====================================================
   GESTION DE LA COUCHE TRANSPORTS (METRO / RER / TRAM / TRAIN)
===================================================== */

/**
 * Construit et retourne la couche Leaflet des transports.
 *
 * La couche est créée à partir de `state.data.transports`
 * (supposé être un FeatureCollection ou tableau GeoJSON).
 *
 * @returns {L.GeoJSON} Couche GeoJSON Leaflet représentant les transports.
 */
export function renderTransportLayer() {
  // Si la couche existe déjà, on la retourne directement
  // (évite de recréer inutilement).
  if (state.layers.transport) return state.layers.transport;

  // Création de la couche GeoJSON Leaflet.
  // Chaque feature représente un tronçon ou un point de transport
  // (ex: une ligne de métro, un arrêt, un segment ferroviaire…).
  const layer = L.geoJSON(state.data.transports, {
    style: (f) => ({
      // Couleur issue des données si disponible,
      // sinon via getColor(mode).
      color: f.properties?.couleur || getColor(f.properties?.mode),
      weight: 2,     // épaisseur du trait
      opacity: 0.7,  // opacité visuelle
    }),
  });

  // On stocke la couche dans l’état global pour éviter de dupliquer.
  state.layers.transport = layer;

  return layer;
}

/**
 * Affiche la couche des transports sur la carte.
 *
 * - Si la couche n'existe pas encore, elle est construite
 * - Puis elle est ajoutée à `state.map`
 */
export function showTransportLayer() {
  // Crée la couche si absente.
  if (!state.layers.transport) renderTransportLayer();

  // Ajoute la couche à la carte Leaflet.
  state.layers.transport.addTo(state.map);
}

/**
 * Masque / retire la couche des transports si elle est affichée.
 *
 * - Ne supprime pas la couche du state
 *   → permet de la re-afficher rapidement via showTransportLayer()
 */
export function hideTransportLayer() {
  if (state.layers.transport) {
    state.map.removeLayer(state.layers.transport);
  }
}

/**
 * Retourne une couleur par défaut selon le mode de transport.
 *
 * @param {string} mode - Mode transport (ex: "METRO", "RER", "TRAMWAY", "TRAIN").
 * @returns {string} Couleur hexadécimale.
 */
function getColor(mode) {
  switch ((mode || "").toUpperCase()) {
    case "METRO":   return "#e10000";  // rouge
    case "RER":     return "#0055a4";  // bleu foncé
    case "TRAMWAY": return "#008c3c";  // vert tram
    case "TRAIN":   return "#666666";  // gris ferroviaire
    default:        return "#999999";  // fallback neutre
  }
}
