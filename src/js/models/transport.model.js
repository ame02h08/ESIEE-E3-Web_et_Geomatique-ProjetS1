import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

/**
 * Charge les lignes de transport ferré (métro, RER, tram, train) en Île-de-France.
 *
 * Les données sont issues d’un fichier CSV contenant notamment :
 * - la géométrie de la ligne (champ Geo Shape au format GeoJSON)
 * - le mode (via indicateurs binaires metro/train/rer/tramway)
 * - un identifiant de ligne (ex : B, T2, 6...)
 * - une couleur (pour l'affichage dans le panneau)
 *
 * La sortie est convertie en FeatureCollection GeoJSON pour faciliter
 * les traitements spatiaux et l’exploitation par la carte.
 *
 * @returns {Promise<GeoJSON.FeatureCollection>} Lignes de transport ferré.
 */
export async function loadTransports() {
  // Lecture du fichier CSV contenant les lignes (séparateur ; )
  const rows = await d3.dsv(";", "data/transports_idf.csv");
  const features = [];
  for (const d of rows) {
    // On ignore les lignes sans géométrie
    if (!d["Geo Shape"]) continue;

    // Parsing du GeoJSON stocké dans une cellule CSV
    let geometry;
    try {
      geometry = JSON.parse(d["Geo Shape"].replace(/""/g, '"'));
    } catch {
      // Si parsing impossible → ligne ignorée
      continue;
    }

    // Détection du mode via les indicateurs binaires fournis dans le fichier
    let mode = "AUTRE";
    if (d.metro === "1") mode = "METRO";
    else if (d.rer === "1") mode = "RER";
    else if (d.tramway === "1") mode = "TRAMWAY";
    else if (d.train === "1") mode = "TRAIN";

    // Construction d’un Feature exploitable par l’application
    features.push({
      type: "Feature",
      geometry,
      properties: {
        mode,
        // Plusieurs colonnes possibles pour indiquer le nom de ligne selon la source
        ligne: d.SHAPE_Lig || d.indice_lig || d.res_com,
        // Couleur hexadécimale (sinon couleur neutre)
        couleur: d.ColourWeb_hexa ? `#${d.ColourWeb_hexa}` : "#999999",
      },
    });
  }
  // Sortie normalisée au format FeatureCollection
  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Charge les stations (gares et arrêts) associées au réseau ferré d'Île-de-France.
 *
 * Chaque station inclut :
 * - un point géographique (GeoJSON)
 * - le mode (métro, RER, tram, train)
 * - la ligne associée
 * - un nom
 *
 * Ces points sont utilisés pour déterminer la desserte d’un territoire
 * via l’analyse "station ∈ polygone".
 *
 * @returns {Promise<GeoJSON.FeatureCollection>} Stations de transport ferré.
 */
export async function loadStops() {
  // Lecture du fichier CSV contenant les gares (séparateur ; )
  const rows = await d3.dsv(";", "data/gares_idf.csv"); // adapte le nom

  const features = [];

  for (const d of rows) {
    if (!d["Geo Shape"]) continue;

    // Parsing de la géométrie point GeoJSON
    let geometry;
    try {
      geometry = JSON.parse(d["Geo Shape"].replace(/""/g, '"'));
    } catch {
      continue;
    }

    // Normalisation du mode
    let mode = (d.mode || "").toUpperCase();
    if (mode === "TRAM") mode = "TRAMWAY";

    // Ligne associée à la station (ex: B, T2, J, etc.)
    const ligne = d.indice_lig || d.res_com;
    if (!ligne) continue;

    features.push({
      type: "Feature",
      geometry,
      properties: {
        mode,
        ligne,
        nom: d.nom_long, // nom long de la gare
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
