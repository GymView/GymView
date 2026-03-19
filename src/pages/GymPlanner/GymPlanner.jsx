import { useEffect, useRef, useState, useCallback } from "react";
import { GridStack } from "gridstack";
import { motion } from "framer-motion";
import { Plus, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2, Zap, X } from "lucide-react";
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

// ── Helpers pour les pins ────────────────────────────────────────
const PRIO_ORDER  = ['urgente', 'haute', 'normale', 'faible'];
const PRIO_COLORS = { urgente: '#e63946', haute: '#f4a261', normale: '#6495ed', faible: '#a0b8cc' };

const matchesLabel = (reportMachine, widgetLabel) => {
  if (!reportMachine || !widgetLabel) return false;
  const rm = reportMachine.toLowerCase().trim();
  const wl = widgetLabel.toLowerCase().trim();
  return rm === wl || rm.includes(wl) || wl.includes(rm);
};

const getTopPriority = (reports) => {
  for (const p of PRIO_ORDER) {
    if (reports.some(r => r.priority === p)) return p;
  }
  return 'faible';
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ── Composant modal des pins ─────────────────────────────────────
function MachinePinModal({ data, onClose }) {
  const { label, reports } = data;
  return (
    <div className="pin-modal-overlay" onClick={onClose}>
      <div className="pin-modal" onClick={e => e.stopPropagation()}>
        <div className="pin-modal-header">
          <h3>{label} — {reports.length} signalement{reports.length > 1 ? 's' : ''} ouvert{reports.length > 1 ? 's' : ''}</h3>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pin-modal-body">
          {reports.map(r => (
            <div key={r.id} className={`pin-report-row prio-${r.priority}`}>
              <div className="pin-report-info">
                <div className="pin-report-title">{r.title}</div>
                {r.description && <div className="pin-report-desc">{r.description}</div>}
                <div className="pin-report-meta">
                  <span className={`pin-badge-status pin-status-${r.status}`}>
                    {r.status === 'en_cours' ? 'En cours' : 'Ouvert'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: PRIO_COLORS[r.priority], fontWeight: 600 }}>
                    {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
                  </span>
                  <span className="pin-report-date">{fmtDate(r.date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GymPlanner() {
  const gridRef      = useRef(null);
  const gridInstance = useRef(null);

  const [editingMachine, setEditingMachine] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saveStatus,     setSaveStatus]     = useState('idle');
  const [counts,         setCounts]         = useState({ total: 0, libre: 0, utilise: 0, occupe: 0 });

  // ── État pins ────────────────────────────────────────────────
  const [reports,  setReports]  = useState([]);
  const [pinModal, setPinModal] = useState(null); // { label, reports }
  const reportsRef     = useRef([]);
  const setPinModalRef = useRef(null);
  setPinModalRef.current = setPinModal;
  useEffect(() => { reportsRef.current = reports; }, [reports]);

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

  // ── Chargement des signalements ─────────────────────────────
  const loadReports = useCallback(async () => {
    try {
      const data = await GymApi.getReports(CONFIG.GYM_ID);
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    }
  }, []);

  // ── Rafraîchit les pins sur tous les widgets ────────────────
  const refreshAllPins = useCallback((allReports) => {
    if (!gridRef.current) return;
    gridRef.current.querySelectorAll('.grid-stack-item').forEach(el => {
      const label = el.dataset.label || '';
      const open  = allReports.filter(
        r => r.status !== 'resolu' && matchesLabel(r.machine, label)
      );

      // Supprimer l'ancien pin s'il existe
      el.querySelector('.machine-pin')?.remove();

      if (!open.length) return;

      const pin = document.createElement('div');
      pin.className = `machine-pin pin-${getTopPriority(open)}`;
      pin.textContent = open.length;
      pin.title = `${open.length} signalement${open.length > 1 ? 's' : ''} ouvert${open.length > 1 ? 's' : ''}`;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        setPinModalRef.current({ label, reports: open });
      });

      const content = el.querySelector('.grid-stack-item-content');
      if (content) content.appendChild(pin);
    });
  }, []);

  // Rafraîchir les pins quand les signalements changent
  useEffect(() => {
    refreshAllPins(reports);
  }, [reports, refreshAllPins]);

  // ── Init GridStack + chargement ─────────────────────────────
  useEffect(() => {
    gridInstance.current = GridStack.init(
      { column: 23, cellHeight: 27, float: true, margin: 4 },
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
    loadReports();
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

    // Remettre le pin si des signalements existent pour cette machine
    const open = reportsRef.current.filter(
      r => r.status !== 'resolu' && matchesLabel(r.machine, el.dataset.label)
    );
    if (open.length) {
      const pin = document.createElement('div');
      pin.className = `machine-pin pin-${getTopPriority(open)}`;
      pin.textContent = open.length;
      pin.title = `${open.length} signalement${open.length > 1 ? 's' : ''} ouvert${open.length > 1 ? 's' : ''}`;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        setPinModalRef.current({ label: el.dataset.label, reports: open });
      });
      content.appendChild(pin);
    }
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
      refreshAllPins(reportsRef.current);
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
    const rawNodes = gridInstance.current.save();
    console.log("GridStack save() brut:", JSON.stringify(rawNodes, null, 2));
    const layout = rawNodes.map(node => {
      const el = gridRef.current.querySelector(`[gs-id="${node.id}"]`);
      return {
        id:          String(node.id ?? el?.getAttribute("gs-id") ?? ""),
        x: Math.round(node.x ?? 0), y: Math.round(node.y ?? 0),
        w: Math.round(node.w ?? 2), h: Math.round(node.h ?? 2),
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
    const widget = gridInstance.current.addWidget({ x: 0, y: 0, w: 3, h: 3, id });
    syncWidgetUI(widget, { type: CONFIG.DEFAULT_MACHINE_TYPE, label: "Nouvelle machine" });
    updateCounts();
    persistLayout();
  };

  // ── Génération d'une salle réaliste ─────────────────────────
  const generateSampleGym = async () => {
    gridInstance.current.removeAll();

    const machines = [
      // ── MUR DU FOND : Cardio ─────────────────────────────────
      { id:"g1",  x:0,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 1"         },
      { id:"g2",  x:3,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 2"         },
      { id:"g3",  x:6,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 3"         },
      { id:"g4",  x:9,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 4"         },
      { id:"g5",  x:13, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 1"    },
      { id:"g6",  x:16, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 2"    },
      { id:"g7",  x:19, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 3"    },
      { id:"g8",  x:22, y:0,  w:2, h:5, type:"boxing",       label:"Sac de frappe"   },
      // ── 2ème RANG CARDIO ─────────────────────────────────────
      { id:"g9",  x:0,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 1"          },
      { id:"g10", x:2,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 2"          },
      { id:"g11", x:4,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 3"          },
      { id:"g12", x:6,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 4"          },
      { id:"g13", x:9,  y:5,  w:7, h:2, type:"rowing",       label:"Rameur 1"        },
      { id:"g14", x:16, y:5,  w:6, h:2, type:"rowing",       label:"Rameur 2"        },
      // ── ZONE MACHINES GUIDÉES ────────────────────────────────
      { id:"g15", x:0,  y:10, w:4, h:5, type:"squat",        label:"Rack Squat"      },
      { id:"g16", x:4,  y:10, w:4, h:5, type:"smith",        label:"Smith Machine"   },
      { id:"g17", x:9,  y:10, w:3, h:4, type:"lat_pulldown", label:"Tirage dorsaux"  },
      { id:"g18", x:12, y:10, w:3, h:4, type:"cable",        label:"Câble 1"         },
      { id:"g19", x:15, y:10, w:3, h:4, type:"cable",        label:"Câble 2 (croisé)"},
      { id:"g20", x:19, y:10, w:3, h:4, type:"leg_press",    label:"Leg Press"       },
      { id:"g21", x:22, y:10, w:2, h:4, type:"lat_pulldown", label:"Curl ischios"    },
      // ── ZONE HALTÈRES & BANCS ────────────────────────────────
      { id:"g22", x:0,  y:15, w:7, h:2, type:"dumbbell",     label:"Rack haltères"   },
      { id:"g23", x:8,  y:15, w:4, h:3, type:"bench",        label:"Banc plat 1"     },
      { id:"g24", x:12, y:15, w:4, h:3, type:"bench",        label:"Banc plat 2"     },
      { id:"g25", x:16, y:15, w:4, h:3, type:"bench",        label:"Banc incliné"    },
      // ── COIN STRETCHING ──────────────────────────────────────
      { id:"g26", x:21, y:14, w:3, h:5, type:"mat",          label:"Zone yoga"       },
    ].map(m => ({ ...m, gymviewid: "", state: "libre" }));

    machines.forEach(m => {
      const widget = gridInstance.current.addWidget({ id: m.id, x: m.x, y: m.y, w: m.w, h: m.h });
      syncWidgetUI(widget, m);
    });

    updateCounts();
    refreshAllPins(reportsRef.current);
    await persistLayout();
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
          <p className="planner-hint">Double-clic pour configurer · Glissez pour déplacer · Grille 24 colonnes</p>
        </div>

        <div className="planner-toolbar">
          {saveLabel && (
            <span className={`save-status ${saveLabel.cls}`}>
              {saveLabel.icon} {saveLabel.text}
            </span>
          )}

          <button className="btn-tool btn-generate" onClick={generateSampleGym} disabled={loading || saveStatus === "saving"}>
            <Zap size={15} /> Générer une salle
          </button>

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

      {/* ── Modal pins ── */}
      {pinModal && (
        <MachinePinModal data={pinModal} onClose={() => setPinModal(null)} />
      )}
    </div>
  );
}
