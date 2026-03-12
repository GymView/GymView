import React, { useState } from "react";
import { ICONS, ICON_KEYS } from "../utils/iconLoader";

/**
 * Composant d'édition de machine
 * @param {Object} data - Les données initiales de la machine ({gsId, name, gymviewid, state, type})
 * @param {Function} onSave - Callback après validation
 * @param {Function} onClose - Callback pour fermer sans enregistrer
 * @param {Function} onDelete - Callback pour supprimer la machine
 */
export default function MachineEditor({ data, onSave, onClose, onDelete }) {
  // On initialise l'état local avec les données reçues en props
  const [form, setForm] = useState({
    label: data.name,
    gymviewid: data.gymviewid,
    state: data.state,
    type: data.type,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // On renvoie les données fusionnées avec l'ID GridStack d'origine
    onSave({ ...data, ...form });
  };

  return (
    <div className="machine-editor-overlay">
      <div className="machine-editor-modal">
        <header className="modal-header">
          <h3>Configuration Machine</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          <div className="form-group">
            <label>Nom de la machine</label>
            <input
              name="label"
              value={form.label}
              onChange={handleChange}
              placeholder="Ex: Poulie vis-à-vis"
            />
          </div>

          <div className="form-group">
            <label>ID Temps Réel (IoT)</label>
            <input
              name="gymviewid"
              value={form.gymviewid}
              onChange={handleChange}
              placeholder="ID envoyé par l'ESP32"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>État initial</label>
              <select name="state" value={form.state} onChange={handleChange}>
                <option value="libre">Libre</option>
                <option value="utilise">Utilisée</option>
                <option value="occupe">Occupée</option>
              </select>
            </div>

            <div className="form-group">
              <label>Type / Icône</label>
              <div className="icon-select-wrapper">
                <img src={ICONS[form.type]} alt="preview" className="type-preview" />
                <select name="type" value={form.type} onChange={handleChange}>
                  {ICON_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-actions">
          <button className="btn-delete" onClick={() => onDelete(data.gsId)}>
            Supprimer
          </button>
          <div className="right-actions">
            <button className="btn-cancel" onClick={onClose}>Annuler</button>
            <button className="btn-save" onClick={handleSave}>Enregistrer</button>
          </div>
        </footer>
      </div>
    </div>
  );
}