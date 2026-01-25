import {
  heatPalette,
  heatColorQuantile,
  roundDown100,
  roundUp100,
} from "../utils/utils.js";

let legendControl = null;

/**
 * Initialise la légende cartographique affichant les prix au m².
 *
 * La légende est ajoutée dans le coin inférieur gauche de la carte et contient :
 * - un titre
 * - une barre colorée (dégradé)
 * - des étiquettes min / max
 *
 * Cette fonction doit être appelée une seule fois au lancement de l'application.
 *
 * @param {L.Map} map - Instance de carte Leaflet dans laquelle insérer la légende.
 */

export function initLegend(map) {
  // Création d'un contrôle Leaflet positionné en bas à gauche
  legendControl = L.control({ position: "bottomleft" });
  // Construction du DOM de la légende lorsque Leaflet l'ajoute à la carte
  legendControl.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    // Structure HTML de la légende
    div.innerHTML = `
      <div class="legend-title">Prix au m²</div>
      <div class="legend-bar"></div>
      <div class="legend-labels">
        <span id="legend-min">—</span>
        <span id="legend-max">—</span>
      </div>
    `;
    return div;
  };
  // Ajout du contrôle à la carte
  legendControl.addTo(map);
}

/**
 * Met à jour dynamiquement la légende des prix au m² selon les valeurs affichées sur la carte.
 *
 * La fonction remplit deux rôles :
 *  1. Actualiser le dégradé de couleur (en fonction d'une palette ou des quantiles)
 *  2. Actualiser les labels min/max pour contextualiser les prix
 *
 * @param {number} min - Valeur minimale affichée sur la carte (prix au m²).
 * @param {number} max - Valeur maximale affichée sur la carte (prix au m²).
 * @param {number[]} [quantiles=[]] - Seuils utilisés pour les classes (optionnel).
 */
export function updateLegend(min, max, quantiles = []) {
  // Si les valeurs min/max ne sont pas valides → pas de mise à jour
  if (!isFinite(min) || !isFinite(max)) return;

  const bar = document.querySelector(".legend-bar");
  const minEl = document.getElementById("legend-min");
  const maxEl = document.getElementById("legend-max");

  // ===================================================
  // Construction du dégradé visuel
  // ===================================================

  let colors;

  // Cas 1 : on a des quantiles (ex: appel depuis renderCommunes / renderSections) : on génère un dégradé
  if (Array.isArray(quantiles) && quantiles.length > 0) {
    colors = [
      heatColorQuantile(min, quantiles),
      ...quantiles.map((q) => heatColorQuantile(q, quantiles)),
      heatColorQuantile(max, quantiles),
    ];
  }
  // Cas 2 : pas de quantiles fournis → on utilise directement la palette
  else {
    colors = heatPalette();
  }

  // Application du dégradé sur la légende si la barre existe dans le DOM
  if (bar) {
    bar.style.background = `linear-gradient(to right, ${colors.join(",")})`;
  }

  // ===================================================
  // Mise à jour des labels numérique min/max
  // ===================================================

  if (minEl) {
     // On arrondit "au-dessus" pour éviter d'afficher des décimales
    minEl.textContent = `< ${roundUp100(min).toLocaleString("fr-FR")} €`;
  }
  if (maxEl) {
    // On arrondit "en dessous" pour obtenir une borne lisible
    maxEl.textContent = `> ${roundDown100(max).toLocaleString("fr-FR")} €`;
  }
}
