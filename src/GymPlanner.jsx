import { useEffect, useRef, useState } from "react";
import { GridStack } from "gridstack";
import { CONFIG } from "./constants/config";
import { ICONS, ICON_KEYS } from "./utils/iconLoader";
import { useMachineSocket } from "./utils/useMachineSocket";
import { GymApi } from "./ApiService";
import MachineEditor from "./components/MachineEditor";

import "gridstack/dist/gridstack.min.css";
import "./GymPlanner.css";

export default function GymPlanner() {
  const gridRef = useRef(null);
  const gridInstance = useRef(null);
  const [editingMachine, setEditingMachine] = useState(null);

  // Activation du temps réel via notre hook
  useMachineSocket(gridRef);

  useEffect(() => {
    gridInstance.current = GridStack.init({ column: 12, cellHeight: 100, float: true }, gridRef.current);

    // Gestion de l'édition (Double Clic)
    gridRef.current.addEventListener("dblclick", (e) => {
      const item = e.target.closest(".grid-stack-item");
      if (!item) return;

      setEditingMachine({
        gsId: item.getAttribute("gs-id"),
        name: item.dataset.label || "",
        gymviewid: item.dataset.gymviewid || "",
        state: item.dataset.state || "libre",
        type: item.dataset.type || CONFIG.DEFAULT_MACHINE_TYPE
      });
    });

    loadSavedLayout();
  }, []);

  const syncWidgetUI = (el, data) => {
    const content = el.querySelector('.grid-stack-item-content');
    if (!content) return;

    // Mise à jour des données
    el.dataset.type = data.type.toLowerCase();
    el.dataset.label = data.label || "Machine";
    el.dataset.state = data.state || "libre";
    el.dataset.gymviewid = data.gymviewid || "";

    // Mise à jour visuelle
    content.className = `grid-stack-item-content machine machine-${el.dataset.state}`;
    content.innerHTML = `
      <img class="machine-icon" src="${ICONS[el.dataset.type]}" alt="" />
      <span class="machine-label">${el.dataset.label}</span>
    `;
  };

  const loadSavedLayout = () => {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!saved) return;

    const nodes = JSON.parse(saved);
    gridInstance.current.load(nodes);
    
    nodes.forEach(node => {
      const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
      if (el) syncWidgetUI(el, node);
    });
  };

  // DANS GymPlanner.jsx
const persistLayout = () => {
  const layout = gridInstance.current.save().map((node) => {
    const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
    
    return {
      id: String(node.id),
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      gym_id: CONFIG.GYM_ID,
      gymview_id: el?.dataset.gymviewid || "", 
      state: el?.dataset.state || "libre",
      type: el?.dataset.type || CONFIG.DEFAULT_MACHINE_TYPE,
      label: el?.dataset.label || "Machine"
    };
  });

  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(layout));
  GymApi.updateMap(CONFIG.GYM_ID, CONFIG.API_KEY, layout);
};

  const addNewMachine = () => {
    const id = `machine-${Date.now()}`;
    const widget = gridInstance.current.addWidget({ x: 0, y: 0, w: 2, h: 2, id });
    syncWidgetUI(widget, { type: CONFIG.DEFAULT_MACHINE_TYPE, label: "Nouvelle machine" });
    persistLayout();
  };

  return (
    <div className="planner-container">
      <header className="controls">
        <button onClick={addNewMachine}>Ajouter une machine</button>
        <button onClick={persistLayout}>Sauvegarder la salle</button>
      </header>

      <div className="grid-stack" ref={gridRef}></div>

      {editingMachine && (
        <MachineEditor 
          data={editingMachine} 
          onClose={() => setEditingMachine(null)}
          onDelete={(id) => {
            const el = gridRef.current.querySelector(`[gs-id="${id}"]`);
            gridInstance.current.removeWidget(el);
            setEditingMachine(null);
            persistLayout();
          }}
          onSave={(updated) => {
            const el = gridRef.current.querySelector(`[gs-id="${updated.gsId}"]`);
            syncWidgetUI(el, updated);
            setEditingMachine(null);
            persistLayout();
          }}
        />
      )}
    </div>
  );
}