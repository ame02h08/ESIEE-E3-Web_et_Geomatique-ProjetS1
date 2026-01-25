import { median } from "../utils/utils.js";

/**
 * Charge les données DVF nettoyées et mises au format, sans filtrage supplémentaire.
 *
 * Le fichier d'entrée est supposé propre (valeurs foncières valides, surfaces présentes).
 * La fonction se contente donc de mapper les lignes CSV dans un format adapté à
 * l'application et à l'agrégation territoriale.
 *
 * @returns {Promise<Array<Object>>} Liste des ventes DVF formatées.
 */
export async function loadDVF() {
  // Chargement du CSV DVF et transformation de chaque ligne en objet JavaScript
  const rows = await d3.csv("data/dvf_idf_final.csv", (d) => {
    const surface = +d.surface_reelle_bati; //surface en m²
    const valeur = +d.valeur_fonciere; // valeur foncière totale en €

    return {
      dept: d.code_commune.slice(0, 2), // extraction du code département (2 premiers caractères)
      commune: d.code_commune, // code commune INSEE
      section: d.id_parcelle ? d.id_parcelle.slice(0, -4) : null, // section cadastrale
      type: d.type_local, // type de bien (Maison / Appartement)
      prix: valeur / surface, // prix au m²
      valeur_fonciere: valeur,
      surface,
      nb_pieces: +d.nombre_pieces_principales || null,
      date: d.date_mutation, // date de la transaction
      adresse: `${d.adresse_numero || ""} ${d.adresse_nom_voie || ""}`.trim(),
      code_postal: d.code_postal,
    };
  });
  // Le fichier étant propre, aucun filtrage supplémentaire n'est nécessaire
  return rows;
}

/**
 * Calcule des indicateurs immobiliers de synthèse à partir d'une liste de ventes.
 *
 * Les indicateurs calculés sont :
 * - nombre total de ventes
 * - prix médian au m²
 * - répartitions des ventes maisons / appartements
 * - prix médians par type de bien
 *
 * @param {Array<Object>} ventes - Ventes DVF associées à un territoire.
 * @returns {Object} Statistiques immobilières agrégées.
 */
export function computeStats(ventes) {
  // Gestion du cas où le territoire n'a pas de ventes
  if (!ventes || ventes.length === 0) {
    return {
      ventes: 0,
      prixMedian: null,
      maisons: 0,
      apparts: 0,
      prixMaisons: null,
      prixApparts: null,
    };
  }
  // Extraction des prix au m² pour calcul de la médiane
  const prix = ventes.map((v) => v.prix);
  // Séparation des ventes par type de bien
  const maisons = ventes.filter((v) => v.type === "Maison");
  const apparts = ventes.filter((v) => v.type === "Appartement");

   // Construction de l'objet statistique
  return {
    ventes: ventes.length,
    prixMedian: median(prix),
    maisons: maisons.length,
    apparts: apparts.length,
    prixMaisons: maisons.length ? median(maisons.map((v) => v.prix)) : null,
    prixApparts: apparts.length ? median(apparts.map((v) => v.prix)) : null,
  };
}

/**
 * Agrège les ventes DVF au niveau départemental.
 *
 * Pour chaque département, la fonction comptabilise :
 * - le nombre de ventes
 * - le prix médian au m²
 * - la répartition maisons / appartements
 *
 * @param {Array<Object>} data - Liste des ventes DVF.
 * @returns {Object} Statistiques par département indexées par code département.
 */
export function computeStatsByDept(data) {
  const g = {};
  // Regroupement des ventes par département
  data.forEach((d) => {
    if (!g[d.dept]) g[d.dept] = { ventes: 0, prix: [], maisons: 0, apparts: 0 };
    g[d.dept].ventes++;
    g[d.dept].prix.push(d.prix);
    if (d.type === "Maison") g[d.dept].maisons++;
    if (d.type === "Appartement") g[d.dept].apparts++;
  });

  // Calcul des indicateurs départementaux
  const res = {};
  for (const k in g) {
    res[k] = {
      ventes: g[k].ventes,
      prixMedian: median(g[k].prix),
      maisons: g[k].maisons,
      apparts: g[k].apparts,
    };
  }
  return res;
}

/**
 * Calcule le prix médian au m² en regroupant les ventes selon une clé territoriale
 * (ex : par commune ou par section cadastrale).
 *
 * @param {Array<Object>} data - Ventes DVF.
 * @param {string} key - Champ utilisé pour le regroupement (ex: "commune", "section").
 * @returns {Object} Prix médians indexés par valeur du champ clé.
 */
export function aggregateMedianByKey(data, key) {
  const g = {};
  // Regroupement des ventes par clé (ex: commune → [prix...])
  data.forEach((d) => {
    if (!d[key]) return;
    if (!g[d[key]]) g[d[key]] = [];
    g[d[key]].push(d.prix);
  });
  // Calcul du prix médian pour chaque groupe
  const res = {};
  for (const k in g) res[k] = median(g[k]);
  return res;
}

/**
 * Construit des index territoriaux pour accélérer les requêtes lors des clics utilisateur.
 *
 * Deux niveaux d'index sont générés :
 * - ventesByCommune : Map(commune → ventes)
 * - ventesBySection : Map(section → ventes)
 *
 * Ces index permettent d'éviter un filtrage manuel à chaque sélection
 * et améliorent la fluidité lors de l'exploration multi-échelle.
 *
 * @param {Array<Object>} data - Ventes DVF.
 * @returns {{ ventesByCommune: Map, ventesBySection: Map }}
 */
export function buildIndexes(data) {
  const ventesByCommune = new Map();
  const ventesBySection = new Map();

  // Insertion des ventes dans les deux index
  for (const v of data) {
    if (v.commune) {
      if (!ventesByCommune.has(v.commune)) ventesByCommune.set(v.commune, []);
      ventesByCommune.get(v.commune).push(v);
    }
    if (v.section) {
      if (!ventesBySection.has(v.section)) ventesBySection.set(v.section, []);
      ventesBySection.get(v.section).push(v);
    }
  }

  return { ventesByCommune, ventesBySection };
}
