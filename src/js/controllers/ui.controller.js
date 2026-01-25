import { showTransportLayer, hideTransportLayer } from "../views/transport.view.js";

// État local indiquant si la couche transport est actuellement affichée
let visible = false;

/**
 * Initialise les éléments d'interface liés aux interactions utilisateur.
 *
 * Dans le cadre de cette application, cette fonction met en place
 * le bouton permettant d'activer ou de désactiver l'affichage de la couche
 * représentant le réseau de transports sur la carte.
 *
 * Cette fonction doit être appelée au démarrage de l'application,
 * une fois le DOM chargé.
 *
 * @returns {void}
 */
export function initUI() {
  // Récupération du bouton permettant d'afficher/masquer les transports
  const btn = document.getElementById("toggle-transports");

  // Lorsque l'utilisateur clique sur le bouton :
  btn.addEventListener("click", () => {
    // On inverse l'état visible / non visible
    visible = !visible;
    // Mise à jour de la carte et du libellé du bouton en fonction du nouvel état
    if (visible) {
      showTransportLayer();
      // Met à jour le texte du bouton pour indiquer l'action inverse
      btn.textContent = "Masquer les transports";
    } else {
      // Retire la couche transport de la carte
      hideTransportLayer();
      // Met à jour le texte du bouton
      btn.textContent = "Afficher les transports";
    }
  });
}