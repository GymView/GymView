import { useEffect, useRef, useState, useCallback } from "react";
import { GridStack } from "gridstack";
import { motion } from "framer-motion";
import { Plus, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2, Zap } from "lucide-react";
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

    //
    //  PLAN — Salle Fitness (~450 m²) — grille 24 colonnes
    //  Chaque unité ≈ 80 cm  |  Les allées sont des colonnes / rangées vides
    //
    //  y= 0-3  ▏ MUR DU FOND — Cardio haut de gamme (face aux vitres)
    //  y= 4    ▏ allée de circulation
    //  y= 5-7  ▏ Cardio 2ème rang — vélos & rameurs
    //  y= 8-9  ▏ allée centrale
    //  y=10-13 ▏ Zone machines guidées (3 groupes séparés par allées)
    //  y=14    ▏ allée
    //  y=15-17 ▏ Zone haltères & bancs
    //  y=14-18 ▏ (droite) Coin stretching / yoga
    //

    const machines = [
      // ── MUR DU FOND : Cardio ─────────────────────────────────
      // 4 tapis de course (côté gauche)
      { id:"g1",  x:0,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 1"         },
      { id:"g2",  x:3,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 2"         },
      { id:"g3",  x:6,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 3"         },
      { id:"g4",  x:9,  y:0,  w:3, h:4, type:"treadmill",    label:"Tapis 4"         },
      // allée x=12 (1 col) entre tapis et elliptiques
      // 3 vélos elliptiques (côté droit)
      { id:"g5",  x:13, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 1"    },
      { id:"g6",  x:16, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 2"    },
      { id:"g7",  x:19, y:0,  w:3, h:4, type:"elliptical",   label:"Elliptique 3"    },
      // coin boxe (extrême droite, s'étend sur 2 rangées)
      { id:"g8",  x:22, y:0,  w:2, h:5, type:"boxing",       label:"Sac de frappe"   },

      // ── 2ème RANG CARDIO ─────────────────────────────────────
      // [allée y=4]
      // 4 vélos statiques / spinning (compacts, gauche)
      { id:"g9",  x:0,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 1"          },
      { id:"g10", x:2,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 2"          },
      { id:"g11", x:4,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 3"          },
      { id:"g12", x:6,  y:5,  w:2, h:3, type:"bike",         label:"Vélo 4"          },
      // allée x=8 (couloir vélos / rameurs)
      // 2 rameurs (machines très longues, basses — h=2)
      { id:"g13", x:9,  y:5,  w:7, h:2, type:"rowing",       label:"Rameur 1"        },
      { id:"g14", x:16, y:5,  w:6, h:2, type:"rowing",       label:"Rameur 2"        },

      // ── ZONE MACHINES GUIDÉES ────────────────────────────────
      // [allée y=8-9 (2 rangées)]
      //
      // Bloc power — x=0-7 (rack squat + smith)
      { id:"g15", x:0,  y:10, w:4, h:5, type:"squat",        label:"Rack Squat"      },
      { id:"g16", x:4,  y:10, w:4, h:5, type:"smith",        label:"Smith Machine"   },
      // allée x=8 (couloir central)
      // Bloc dos & câbles — x=9-17
      { id:"g17", x:9,  y:10, w:3, h:4, type:"lat_pulldown", label:"Tirage dorsaux"  },
      { id:"g18", x:12, y:10, w:3, h:4, type:"cable",        label:"Câble 1"         },
      { id:"g19", x:15, y:10, w:3, h:4, type:"cable",        label:"Câble 2 (croisé)"},
      // allée x=18
      // Bloc membres inférieurs — x=19-23
      { id:"g20", x:19, y:10, w:3, h:4, type:"leg_press",    label:"Leg Press"       },
      { id:"g21", x:22, y:10, w:2, h:4, type:"lat_pulldown", label:"Curl ischios"    },

      // ── ZONE HALTÈRES & BANCS ────────────────────────────────
      // [allée y=14]
      // Grand rack haltères (2-60 kg) — très large, peu profond
      { id:"g22", x:0,  y:15, w:7, h:2, type:"dumbbell",     label:"Rack haltères"   },
      // allée x=7
      // 3 bancs de développé couché
      { id:"g23", x:8,  y:15, w:4, h:3, type:"bench",        label:"Banc plat 1"     },
      { id:"g24", x:12, y:15, w:4, h:3, type:"bench",        label:"Banc plat 2"     },
      { id:"g25", x:16, y:15, w:4, h:3, type:"bench",        label:"Banc incliné"    },

      // ── COIN STRETCHING / YOGA ───────────────────────────────
      // (droite, s'étend de y=14 à y=18)
      { id:"g26", x:21, y:14, w:3, h:5, type:"mat",          label:"Zone yoga"       },
    ].map(m => ({ ...m, gymviewid: "", state: "libre" }));

    machines.forEach(m => {
      const widget = gridInstance.current.addWidget({ id: m.id, x: m.x, y: m.y, w: m.w, h: m.h });
      syncWidgetUI(widget, m);
    });

    updateCounts();
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
    </div>
  );
}
