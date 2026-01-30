import {
  computeQuantiles,
  heatColorQuantile,
  fmtEuro,
} from "../utils/utils.js";
import { updateLegend } from "./legend.view.js";
import { getFilters, calculateCompatibilityScore } from "../models/filter.model.js";
import { getTransportsServingZone } from "../models/accessibilite.model.js";
import { state } from "../app/state.js";

/**
 * Initialise la carte Leaflet dans l'élément #map.
 *
 * - crée une instance de carte Leaflet
 * - fixe un zoom minimum et maximum
 * - centre la vue sur l'Île-de-France (Paris approximativement)
 * - ajoute un fond OpenStreetMap
 *
 * @returns {L.Map} Instance de carte Leaflet initialisée.
 */
export function initMap() {
  const map = L.map("map", { minZoom: 9, maxZoom: 16 }).setView(
    [48.85, 2.35],
    9,
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  return map;
}

/**
 * Supprime proprement une couche cartographique Leaflet si elle est présente.
 *
 * @param {L.Map} map - Instance de la carte Leaflet.
 * @param {L.Layer|null} layer - Couche précédente à retirer, si elle existe.
 * @returns {null} Toujours `null`, permettant de réinitialiser la référence dans le state
 */
export function clearLayer(map, layer) {
  if (layer) map.removeLayer(layer);
  return null;
}

/**
 * Affiche les **départements** sur la carte.
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} geo - GeoJSON contenant les départements.
 * @param {Object.<string, { prixMedian: number }>} statsDept - Stats par code INSEE de département.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onDeptClick - Callback au clic sur un département.
 * @returns {L.GeoJSON} Couche Leaflet GeoJSON ajoutée à la carte.
 */
export function renderDepartments(map, geo, statsDept, onDeptClick) {
  const layer = L.geoJSON(geo, {
    style: { color: "#000", weight: 2, fillOpacity: 0.12 },
    onEachFeature: (f, l) => {
      const code = f.properties.code_insee;
      l.bindTooltip(
        `<b>${f.properties.nom}</b><br>${fmtEuro(statsDept[code]?.prixMedian)} / m²`,
        { sticky: true },
      );
      l.on("click", () => onDeptClick(f, l));
    },
  }).addTo(map);

  map.fitBounds(layer.getBounds());
  return layer;
}

/**
 * Vérifie si des filtres sont actifs
 * @returns {boolean}
 */
function hasActiveFilters() {
  const filters = getFilters();
  return filters.budget !== null || 
         filters.surface !== null || 
         filters.type !== null || 
         filters.transport === true;
}

/**
 * Retourne la couleur selon le score de compatibilité
 * 
 * @param {number} score - Score de 0 à 100
 * @returns {string} - Code couleur hexadécimal
 */
function getCompatibilityColor(score) {
  if (score === 0) return '#cccccc';
  if (score <= 30) return '#ff5252';
  if (score <= 60) return '#ff9800';
  if (score <= 80) return '#ffc107';
  return '#4caf50';
}

/**
 * Retourne l'opacité selon le score
 * 
 * @param {number} score - Score de 0 à 100
 * @returns {number} - Opacité de 0.2 à 0.85
 */
function getCompatibilityOpacity(score) {
  if (score === 0) return 0.2;
  if (score <= 30) return 0.4;
  if (score <= 60) return 0.6;
  if (score <= 80) return 0.75;
  return 0.85;
}

/**
 * Vérifie si une commune respecte les filtres actifs.
 *
 * @param {GeoJSON.Feature} feature - Feature de la commune
 * @param {number} prix - Prix médian au m² de la commune
 * @returns {boolean} - true si la commune respecte les filtres
 */
function communeMatchesFilters(feature, prix) {
  const filters = getFilters();

  if (filters.budget !== null) {
    const estimatedPrice = prix * 60;
    if (estimatedPrice > filters.budget) {
      return false;
    }
  }

  if (filters.transport) {
    const transports = getTransportsServingZone(feature) || [];
    if (transports.length === 0) {
      return false;
    }
  }

  return true;
}

/**
 * Affiche les **communes** d'un département sur la carte.
 *
 * Gradient de PRIX par défaut, gradient de COMPATIBILITÉ seulement si filtres actifs
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} geo - GeoJSON des communes du département sélectionné.
 * @param {Object.<string, number>} prixCommune - Prix médian au m² par id de commune.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onCommuneClick - Callback au clic sur une commune.
 * @returns {L.GeoJSON} Couche des communes ajoutée à la carte.
 */
export function renderCommunes(map, geo, prixCommune, onCommuneClick) {
  const values = geo.features
    .map((f) => prixCommune[f.properties.id])
    .filter((v) => isFinite(v));

  const quantiles = computeQuantiles(values);

  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    updateLegend(min, max, quantiles);
  }

  // VÉRIFIER SI DES FILTRES SONT ACTIFS
  const filtersActive = hasActiveFilters();

  const layer = L.geoJSON(geo, {
    style: (f) => {
      const prix = prixCommune[f.properties.id];
      
      // SI AUCUN FILTRE ACTIF : utiliser gradient de prix (comportement original)
      if (!filtersActive) {
        const fill = heatColorQuantile(prix, quantiles);
        return {
          fillOpacity: 0.85,
          weight: 1,
          color: "#333",
          fillColor: fill
        };
      }

      // SI FILTRES ACTIFS : utiliser gradient de compatibilité
      const ventes = state.data.ventesByCommune?.get(f.properties.id) || [];
      const transports = [];
      const compatibility = calculateCompatibilityScore(ventes, transports);
      const score = compatibility.score;

      let finalColor;
      let finalOpacity;

      if (score === 0) {
        finalColor = '#cccccc';
        finalOpacity = 0.2;
      } else {
        finalColor = getCompatibilityColor(score);
        finalOpacity = getCompatibilityOpacity(score);
      }

      return {
        fillOpacity: finalOpacity,
        weight: 1,
        color: score === 0 ? "#999" : "#333",
        fillColor: finalColor
      };
    },
    onEachFeature: (f, l) => {
      const prix = prixCommune[f.properties.id];
      const nom = f.properties.nom || "Commune";

      // Tooltip adapté selon si filtres actifs ou non
      let tooltipContent = `<b>${nom}</b><br>${fmtEuro(prix)} / m²`;
      
      if (filtersActive) {
        const ventes = state.data.ventesByCommune?.get(f.properties.id) || [];
        const compatibility = calculateCompatibilityScore(ventes, []);
        const score = compatibility.score;

        if (score === 0) {
          tooltipContent += '<br><i style="color:#999">✗ Hors critères (0%)</i>';
        } else if (score < 100) {
          const colorStyle = score > 80 ? '#4caf50' : (score > 60 ? '#ffc107' : (score > 30 ? '#ff9800' : '#ff5252'));
          tooltipContent += `<br><i style="color:${colorStyle}">✓ ${score}% compatible</i>`;
        } else {
          tooltipContent += '<br><i style="color:#4caf50">✓ 100% compatible</i>';
        }
      }

      l.bindTooltip(tooltipContent, { sticky: true });
      l.on("click", () => onCommuneClick(f, l));
    },
  }).addTo(map);

  return layer;
}

/**
 * Affiche les **sections cadastrales** d'une commune.
 *
 * Gradient de PRIX par défaut, gradient de COMPATIBILITÉ seulement si filtres actifs
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} features - GeoJSON des sections.
 * @param {Object.<string, number>} prixSection - Prix par id de section.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onSectionClick - Callback au clic.
 * @returns {L.GeoJSON} Couche des sections.
 */
export function renderSections(map, features, prixSection, onSectionClick) {
  const values = features
    .map((f) => prixSection[f.properties.id])
    .filter((v) => isFinite(v));

  const quantiles = computeQuantiles(values);

  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    updateLegend(min, max, quantiles);
  }

  // VÉRIFIER SI DES FILTRES SONT ACTIFS
  const filtersActive = hasActiveFilters();

  const layer = L.geoJSON(features, {
    style: (f) => {
      const prix = prixSection[f.properties.id];
      
      // SI AUCUN FILTRE ACTIF : utiliser gradient de prix
      if (!filtersActive) {
        const fill = heatColorQuantile(prix, quantiles);
        return {
          fillOpacity: 0.9,
          weight: 1,
          color: "#111",
          fillColor: fill
        };
      }

      // 🆕 SI FILTRES ACTIFS : utiliser gradient de compatibilité
      const ventes = state.data.ventesBySection?.get(f.properties.id) || [];
      const compatibility = calculateCompatibilityScore(ventes, []);
      const score = compatibility.score;

      let finalColor;
      let finalOpacity;

      if (score === 0) {
        finalColor = '#cccccc';
        finalOpacity = 0.2;
      } else {
        finalColor = getCompatibilityColor(score);
        finalOpacity = getCompatibilityOpacity(score);
      }

      return {
        fillOpacity: finalOpacity,
        weight: 1,
        color: score === 0 ? "#999" : "#111",
        fillColor: finalColor
      };
    },
    onEachFeature: (f, l) => {
      const prix = prixSection[f.properties.id];
      const code = f.properties.code || "?";

      let tooltipContent = `<b>Section ${code}</b><br>${fmtEuro(prix)} / m²`;
      
      if (filtersActive) {
        const ventes = state.data.ventesBySection?.get(f.properties.id) || [];
        const compatibility = calculateCompatibilityScore(ventes, []);
        const score = compatibility.score;

        if (score === 0) {
          tooltipContent += '<br><i style="color:#999">✗ Hors critères (0%)</i>';
        } else if (score < 100) {
          const colorStyle = score > 80 ? '#4caf50' : (score > 60 ? '#ffc107' : (score > 30 ? '#ff9800' : '#ff5252'));
          tooltipContent += `<br><i style="color:${colorStyle}">✓ ${score}% compatible</i>`;
        } else {
          tooltipContent += '<br><i style="color:#4caf50">✓ 100% compatible</i>';
        }
      }

      l.bindTooltip(tooltipContent, {
        sticky: true,
        direction: "auto",
      });
      l.on("click", () => onSectionClick(f, l));
    },
  }).addTo(map);

  return layer;
}