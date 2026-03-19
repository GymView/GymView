import { useEffect, useRef, useState, useCallback } from "react";
import { GridStack } from "gridstack";
import { motion } from "framer-motion";
import { Plus, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { CONFIG } from "../../constants/config";
import { ICONS, ICON_KEYS } from "../../utils/iconLoader";
import { useMachineSocket } from "../../hooks/useMachineSocket";
import { GymApi } from "../../services/gymApi";
import MachineEditor from "../../components/MachineEditor";

import "gridstack/dist/gridstack.min.css";
import "./GymPlanner.css";

// 'idle' | 'saving' | 'saved' | 'error'
const SAVE_LABELS = {
  idle:   null,
  saving: { text: 'Sauvegarde...', icon: <Loader2 size={13} className="spin" />, cls: 'status-saving' },
  saved:  { text: 'Sauvegardé',    icon: <CheckCircle2 size={13} />,             cls: 'status-saved'  },
  error:  { text: 'Erreur',        icon: <AlertCircle size={13} />,              cls: 'status-error'  },
};

export default function GymPlanner() {
  const gridRef      = useRef(null);
  const gridInstance = useRef(null);

  const [editingMachine, setEditingMachine] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saveStatus,     setSaveStatus]     = useState('idle');
  const [counts,         setCounts]         = useState({ total: 0, libre: 0, utilise: 0, occupe: 0 });

  // ── Comptage réactif des machines ───────────────────────────
  const updateCounts = useCallback(() => {
    if (!gridRef.current) return;
    const items = gridRef.current.querySelectorAll(".grid-stack-item");
    const c = { total: 0, libre: 0, utilise: 0, occupe: 0 };
    items.forEach(el => {
      const s = el.dataset.state || "libre";
      c[s] = (c[s] || 0) + 1;
      c.total++;
    });
    setCounts(c);
  }, []);

  useMachineSocket(gridRef, updateCounts);

  // ── Init GridStack + chargement ─────────────────────────────
  useEffect(() => {
    gridInstance.current = GridStack.init(
      { column: 12, cellHeight: "auto", float: true },
      gridRef.current
    );

    gridRef.current.addEventListener("dblclick", (e) => {
      const item = e.target.closest(".grid-stack-item");
      if (!item) return;
      setEditingMachine({
        gsId:       item.getAttribute("gs-id"),
        name:       item.dataset.label     || "",
        gymviewid:  item.dataset.gymviewid || "",
        state:      item.dataset.state     || "libre",
        type:       item.dataset.type      || CONFIG.DEFAULT_MACHINE_TYPE,
      });
    });

    loadLayout();
  }, []);

  // ── Rendu d'un widget ────────────────────────────────────────
  const syncWidgetUI = (el, data) => {
    const content = el.querySelector(".grid-stack-item-content");
    if (!content) return;
    el.dataset.type      = (data.type || "treadmill").toLowerCase();
    el.dataset.label     = data.label     || "Machine";
    el.dataset.state     = data.state     || "libre";
    el.dataset.gymviewid = data.gymviewid || data.gymview_id || "";

    content.className = `grid-stack-item-content machine machine-${el.dataset.state}`;
    content.innerHTML = `
      <img class="machine-icon" src="${ICONS[el.dataset.type] || ''}" alt="" />
      <span class="machine-label">${el.dataset.label}</span>
      <span class="machine-state-dot"></span>
    `;
  };

  // ── Chargement : API d'abord, localStorage en fallback ──────
  const loadLayout = async () => {
    setLoading(true);
    try {
      const data = await GymApi.fetchMap(CONFIG.GYM_ID);
      if (Array.isArray(data) && data.length > 0) {
        const nodes = data.map(m => ({
          id:         String(m.id),
          x: m.x, y: m.y, w: m.w, h: m.h,
          gymviewid:  m.gymview_id || "",
          state:      m.state     || "libre",
          type:       m.type      || CONFIG.DEFAULT_MACHINE_TYPE,
          label:      m.label     || "Machine",
        }));
        gridInstance.current.load(nodes);
        nodes.forEach(node => {
          const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
          if (el) syncWidgetUI(el, node);
        });
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(nodes));
      } else {
        loadFromLocalStorage();
      }
    } catch {
      loadFromLocalStorage();
    } finally {
      setLoading(false);
      updateCounts();
    }
  };

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!saved) return;
    const nodes = JSON.parse(saved);
    gridInstance.current.load(nodes);
    nodes.forEach(node => {
      const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
      if (el) syncWidgetUI(el, node);
    });
  };

  // ── Sauvegarde ───────────────────────────────────────────────
  const persistLayout = async () => {
    setSaveStatus("saving");
    const layout = gridInstance.current.save().map(node => {
      const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
      return {
        id:          String(node.id),
        x: node.x, y: node.y, w: node.w, h: node.h,
        gym_id:      CONFIG.GYM_ID,
        gymview_id:  el?.dataset.gymviewid || "",
        state:       el?.dataset.state     || "libre",
        type:        el?.dataset.type      || CONFIG.DEFAULT_MACHINE_TYPE,
        label:       el?.dataset.label     || "Machine",
      };
    });
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(layout));
    try {
      await GymApi.updateMap(CONFIG.GYM_ID, CONFIG.API_KEY, layout);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  // ── Ajout machine ────────────────────────────────────────────
  const addNewMachine = () => {
    const id     = `machine-${Date.now()}`;
    const widget = gridInstance.current.addWidget({ x: 0, y: 0, w: 2, h: 2, id });
    syncWidgetUI(widget, { type: CONFIG.DEFAULT_MACHINE_TYPE, label: "Nouvelle machine" });
    updateCounts();
    persistLayout();
  };

  const saveLabel = SAVE_LABELS[saveStatus];

  return (
    <div className="planner-container">

      {/* ── En-tête ── */}
      <motion.div
        className="planner-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y:  0  }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="planner-title">Plan de la salle</h1>
          <p className="planner-hint">Double-clic sur une machine pour la configurer · Glissez pour déplacer</p>
        </div>

        <div className="planner-toolbar">
          {saveLabel && (
            <span className={`save-status ${saveLabel.cls}`}>
              {saveLabel.icon} {saveLabel.text}
            </span>
          )}

          <button className="btn-tool btn-add" onClick={addNewMachine} disabled={loading}>
            <Plus size={15} /> Ajouter
          </button>

          <button className="btn-tool btn-reload" onClick={loadLayout} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            {loading ? "Chargement..." : "Recharger"}
          </button>

          <button
            className="btn-tool btn-save"
            onClick={persistLayout}
            disabled={loading || saveStatus === "saving"}
          >
            <Save size={15} /> Sauvegarder
          </button>
        </div>
      </motion.div>

      {/* ── Barre de stats ── */}
      <motion.div
        className="planner-stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <span className="stat-pill pill-total">
          {counts.total} machine{counts.total > 1 ? "s" : ""}
        </span>
        <span className="stat-pill pill-libre">
          <span className="dot" /> {counts.libre} libre{counts.libre > 1 ? "s" : ""}
        </span>
        <span className="stat-pill pill-utilise">
          <span className="dot" /> {counts.utilise} en cours
        </span>
        <span className="stat-pill pill-occupe">
          <span className="dot" /> {counts.occupe} occupée{counts.occupe > 1 ? "s" : ""}
        </span>
      </motion.div>

      {/* ── Grille ── */}
      <div className="grid-wrapper">
        {loading && (
          <div className="planner-loading-overlay">
            <Loader2 size={28} className="spin" />
            <span>Chargement de la salle...</span>
          </div>
        )}
        <div className="grid-stack" ref={gridRef} />
      </div>

      {/* ── Éditeur machine ── */}
      {editingMachine && (
        <MachineEditor
          data={editingMachine}
          onClose={() => setEditingMachine(null)}
          onDelete={(id) => {
            const el = gridRef.current.querySelector(`[gs-id="${id}"]`);
            gridInstance.current.removeWidget(el);
            setEditingMachine(null);
            updateCounts();
            persistLayout();
          }}
          onSave={(updated) => {
            const el = gridRef.current.querySelector(`[gs-id="${updated.gsId}"]`);
            syncWidgetUI(el, updated);
            setEditingMachine(null);
            updateCounts();
            persistLayout();
          }}
        />
      )}
    </div>
  );
}
