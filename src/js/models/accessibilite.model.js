import { state } from "../app/state.js";

/**
 * Détermine quelles lignes de transport desservent un territoire donné.
 *
 * Un territoire est considéré comme desservi si une station est :
 * 1) située dans le territoire, OU
 * 2) située à moins de 1 km du centre du territoire.
 *
 * @param {GeoJSON.Feature} zoneFeature - Territoire sélectionné.
 * @returns {Array<GeoJSON.Feature>} Liste des lignes desservant la zone.
 */
export function getTransportsServingZone(zoneFeature) {
  const stations = state.data?.stops?.features || [];
  const lignesTransport = state.data?.transports?.features || [];
  const DISTANCE_MAX_M = 1000; // 1 km en mètres

  if (!zoneFeature?.geometry) return [];

  // Centre approximatif du territoire (centre de la bbox Leaflet)
  const coucheZone = L.geoJSON(zoneFeature);
  const centreZone = coucheZone.getBounds().getCenter();

  /**
   * Test si un point est dans le contour d'un polygone
   * (algorithme ray casting)
   */
  function pointDansContour(lng, lat, contourPolygone) {
    let interieur = false;

    for (
      let i = 0, j = contourPolygone.length - 1;
      i < contourPolygone.length;
      j = i++
    ) {
      const xi = contourPolygone[i][0],
        yi = contourPolygone[i][1];
      const xj = contourPolygone[j][0],
        yj = contourPolygone[j][1];

      const coupe =
        (yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;

      if (coupe) interieur = !interieur;
    }

    return interieur;
  }

  /**
   * Test si un point appartient à une géométrie GeoJSON
   */
  function pointDansPolygoneGeoJSON(lng, lat, geometrie) {
    if (!geometrie) return false;

    if (geometrie.type === "Polygon") {
      return pointDansContour(lng, lat, geometrie.coordinates[0]);
    }

    if (geometrie.type === "MultiPolygon") {
      return geometrie.coordinates.some((poly) =>
        pointDansContour(lng, lat, poly[0])
      );
    }

    return false;
  }

  // Étape 1 : détecter les lignes présentes via les stations
  const clesLignesDansZone = new Set();

  for (const station of stations) {
    if (!station?.geometry?.coordinates) continue;

    const [lng, lat] = station.geometry.coordinates;
    const positionStation = L.latLng(lat, lng);

    // Station située dans la zone ?
    let dessertZone = pointDansPolygoneGeoJSON(
      lng,
      lat,
      zoneFeature.geometry
    );

    // Sinon, station proche du centre ?
    if (!dessertZone) {
      const distanceM = centreZone.distanceTo(positionStation);
      dessertZone = distanceM <= DISTANCE_MAX_M;
    }

    if (dessertZone) {
      const props = station.properties || {};
      const mode = (props.mode || "").toUpperCase();
      const ligne = props.ligne;

      if (!mode || !ligne) continue;

      clesLignesDansZone.add(`${mode}|${ligne}`);
    }
  }

  if (clesLignesDansZone.size === 0) return [];

  // Étape 2 : récupérer les lignes correspondantes
  const resultat = [];
  const clesDejaAjoutees = new Set();

  for (const ligneTransport of lignesTransport) {
    if (!ligneTransport) continue;

    const props = ligneTransport.properties || {};
    const mode = (props.mode || "").toUpperCase();
    const ligne = props.ligne;

    if (!mode || !ligne) continue;

    const cle = `${mode}|${ligne}`;

    if (!clesLignesDansZone.has(cle) || clesDejaAjoutees.has(cle)) continue;

    clesDejaAjoutees.add(cle);

    resultat.push({
      type: "Feature",
      geometry: null,
      properties: {
        mode,
        ligne,
        couleur: props.couleur || "#999999",
      },
    });
  }

  // Étape 3 : ajouter lignes manquantes sans couleur connue
  for (const cle of clesLignesDansZone) {
    if (clesDejaAjoutees.has(cle)) continue;

    const [mode, ligne] = cle.split("|");

    resultat.push({
      type: "Feature",
      geometry: null,
      properties: {
        mode,
        ligne,
        couleur: "#999999",
      },
    });
  }

  return resultat;
}
