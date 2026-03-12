import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { GymApi } from './ApiService';
import { CONFIG } from './constants/config';
import './Maintenance.css';


export default function Maintenance() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Chargement des données au démarrage
  useEffect(() => {
    loadMaintenanceData();
  }, []);

  const loadMaintenanceData = async () => {
    try {
      setLoading(true);
      const data = await GymApi.fetchMap(CONFIG.GYM_ID);
      // On s'assure que les données sont valides avant de mettre à jour
      setMachines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement maintenance:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Action de reset (Révisé)
  const handleReset = async (machineId) => {
    if (!window.confirm("Confirmer la révision technique de cette machine ?")) return;
    
    try {
      await GymApi.resetMaintenance(machineId, CONFIG.API_KEY);
      // Rechargement immédiat pour voir les barres de santé revenir à 100%
      await loadMaintenanceData();
    } catch (error) {
      alert("Erreur lors de la mise à jour de la maintenance.");
    }
  };

  const calculatePrediction = (m) => {
    const threshold = m.maintenance_threshold || 10000;
    const used = m.minutes_since_last_maint || 0;
    const remaining = threshold - used;
    // On estime 120min d'usage moyen par jour
    const daysLeft = Math.floor(remaining / 120); 
    return daysLeft > 0 ? daysLeft : 0;
  };

  if (loading) return <div className="loader">Chargement du parc machine...</div>;

  return (
    <div className="maintenance-container">
      <div className="maintenance-header">
        <h1>Maintenance Prédictive</h1>
        <button className="btn-refresh" onClick={loadMaintenanceData}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>
      
      <table className="maintenance-table">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Usage Total</th>
            <th>Depuis Maintenance</th>
            <th>Santé</th>
            <th>Prochaine Révision</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {machines.length === 0 ? (
            <tr><td colSpan="6" style={{textAlign: 'center'}}>Aucune machine enregistrée.</td></tr>
          ) : (
            machines.map(m => {
              const daysLeft = calculatePrediction(m);
              const threshold = m.maintenance_threshold || 10000;
              const used = m.minutes_since_last_maint || 0;
              const healthPercent = Math.max(0, 100 - (used / threshold * 100));
              
              return (
                <tr key={m.id} className={healthPercent < 20 ? 'row-critical' : ''}>
                  <td>
                    <strong>{m.label || "Sans nom"}</strong><br/>
                    <small>{m.type || "Inconnu"} | ID: {m.gymviewid}</small>
                  </td>
                  <td>{Math.floor((m.total_minutes || 0) / 60)}h</td>
                  <td>{Math.floor(used / 60)}h</td>
                  <td>
                    <div className="health-bar-bg">
                      <div className="health-bar-fill" style={{ 
                        width: `${healthPercent}%`,
                        backgroundColor: healthPercent < 20 ? '#e63946' : '#2a9d8f'
                      }}></div>
                    </div>
                  </td>
                  <td>
                     {daysLeft <= 7 ? 
                      <span className="text-alert"><AlertOctagon size={14}/> ~{daysLeft} jours</span> : 
                      `~ ${daysLeft} jours`}
                  </td>
                  <td>
                    <button className="btn-maint" onClick={() => handleReset(m.id)}>
                      Révisé
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  );
}