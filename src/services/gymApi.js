const BASE_URL = "http://localhost:8000";

export const GymApi = {

  // Récupère la carte d'une salle
  fetchMap: async (gymId) => {
    try {
      const response = await fetch(`${BASE_URL}/${gymId}/get_map`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
      const result = await response.json();
      console.log("Réponse du serveur :", result);
      return await result;

    } catch (error) {
      console.error("Échec lors de la récupération de la carte:", error);
      throw error;
    }
  },

  // ENVOYER/METTRE À JOUR la carte complète
  updateMap: async (gymId, apiKey, machines) => {
    try {
        console.log("Donéees envoyées ICIIIIIII")
        console.log(machines)
      const response = await fetch(`${BASE_URL}/${gymId}/update_map/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(machines)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Détail erreur Pydantic:", JSON.stringify(errorData, null, 2));
        const detail = Array.isArray(errorData.detail)
          ? errorData.detail.map(e => `${e.loc?.join('.')} — ${e.msg}`).join('\n')
          : errorData.detail;
        throw new Error(detail || "Erreur lors de la mise à jour");
      }

      const result = await response.json();
      console.log("Réponse du serveur :", result);

      return response;
    } catch (error) {
      console.error("Erreur de synchronisation base de données:", error);
      throw error;
    }
  },

  resetMaintenance: async (machineId, apiKey) => {
    const response = await fetch(`${BASE_URL}/reset_maintenance/${machineId}`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey }
    });
    if (!response.ok) throw new Error("Échec du reset maintenance");
    return await response.json();
  },

  // Récupérer toutes les salles
  getAllGyms: async () => {
    const response = await fetch(`${BASE_URL}/gym_map/`);
    return await response.json();
  }

};
