import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, Wrench, Wifi, WifiOff, ShieldCheck
} from 'lucide-react';
import { GymApi } from '../../services/gymApi';
import { CONFIG } from '../../constants/config';
import './Maintenance.css';

const FILTERS = [
  { key: 'all',      label: 'Toutes'   },
  { key: 'critical', label: 'Critiques' },
  { key: 'warning',  label: 'Alertes'  },
  { key: 'ok',       label: 'Saines'   },
];

function computeMachine(m) {
  const threshold   = m.maintenance_threshold || 10000;
  const used        = m.minutes_since_last_maint || 0;
  const health      = Math.max(0, Math.round(100 - (used / threshold) * 100));
  const daysLeft    = Math.max(0, Math.floor((threshold - used) / 120));
  const urgency     = health < 20 ? 'critical' : health < 50 ? 'warning' : 'ok';
  return { ...m, health, daysLeft, urgency };
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d)) return '–';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function healthColor(h) {
  if (h < 20) return '#e63946';
  if (h < 50) return '#f4a261';
  return '#2a9d8f';
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
});

// ─────────────────────────────────────────────────────────────
export default function Maintenance() {
  const [machines,    setMachines]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [confirming,  setConfirming]  = useState(null); // id of machine pending confirm
  const [resetting,   setResetting]   = useState(null); // id currently being reset
  const [lastUpdate,  setLastUpdate]  = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await GymApi.fetchMap(CONFIG.GYM_ID);
      setMachines(Array.isArray(data) ? data.map(computeMachine) : []);
      setLastUpdate(new Date());
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (id) => {
    try {
      setResetting(id);
      setConfirming(null);
      await GymApi.resetMaintenance(id, CONFIG.API_KEY);
      await load();
    } catch {
      alert('Erreur lors de la mise à jour.');
    } finally {
      setResetting(null);
    }
  };

  // ── Stats ────────────────────────────────────────────────────
  const total    = machines.length;
  const critical = machines.filter(m => m.urgency === 'critical');
  const warning  = machines.filter(m => m.urgency === 'warning');
  const ok       = machines.filter(m => m.urgency === 'ok');

  const avgHealth = total > 0
    ? Math.round(machines.reduce((s, m) => s + m.health, 0) / total)
    : 0;

  const soonest = [...machines].sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const filtered = machines
    .filter(m => filter === 'all' || m.urgency === filter)
    .sort((a, b) => a.health - b.health);

  const timeStr = lastUpdate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = [
    {
      icon: <AlertOctagon size={20} />,
      label: 'Critiques',
      value: critical.length,
      sub: 'santé < 20% — intervention requise',
      color: critical.length > 0 ? '#e63946' : '#2a9d8f',
    },
    {
      icon: <AlertTriangle size={20} />,
      label: 'En alerte',
      value: warning.length,
      sub: 'santé 20–50% — à surveiller',
      color: warning.length > 0 ? '#f4a261' : '#2a9d8f',
    },
    {
      icon: <ShieldCheck size={20} />,
      label: 'Saines',
      value: ok.length,
      sub: `santé moyenne ${avgHealth}%`,
      color: '#2a9d8f',
    },
    {
      icon: <Clock size={20} />,
      label: 'Prochaine révision',
      value: soonest ? `${soonest.daysLeft}j` : '–',
      sub: soonest ? soonest.label || 'Machine inconnue' : 'Aucune machine',
      color: soonest && soonest.daysLeft <= 7 ? '#e63946' : '#f4a261',
    },
  ];

  return (
    <div className="maint-container">

      {/* ── En-tête ── */}
      <motion.div className="maint-header" {...fadeUp(0)}>
        <div>
          <h1>Maintenance Prédictive</h1>
          <p className="maint-subtitle">Salle #{CONFIG.GYM_ID} · estimation basée sur 2h d'usage/jour</p>
        </div>
        <button className="maint-refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? 'Chargement...' : `Actualisé à ${timeStr ?? '–'}`}
        </button>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="maint-kpi-grid">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="maint-kpi-card" {...fadeUp(0.05 * (i + 1))}>
            <div
              className="maint-kpi-icon"
              style={{ color: k.color, background: `${k.color}1a`, border: `1px solid ${k.color}33` }}
            >
              {k.icon}
            </div>
            <div>
              <div className="maint-kpi-value" style={{ color: k.color }}>
                {loading ? '–' : k.value}
              </div>
              <div className="maint-kpi-label">{k.label}</div>
              <div className="maint-kpi-sub">{loading ? '...' : k.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <motion.div className="maint-filters" {...fadeUp(0.22)}>
        {FILTERS.map(f => {
          const count = f.key === 'all'      ? total
                      : f.key === 'critical' ? critical.length
                      : f.key === 'warning'  ? warning.length
                      : ok.length;
          return (
            <button
              key={f.key}
              className={`filter-btn filter-${f.key} ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="filter-badge">{count}</span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Tableau ── */}
      <motion.div className="maint-table-wrap" {...fadeUp(0.28)}>
        {loading ? (
          <p className="maint-empty">Chargement du parc machine...</p>
        ) : filtered.length === 0 ? (
          <div className="maint-all-good">
            <CheckCircle2 size={36} color="var(--accent-primary)" />
            <p>Aucune machine dans cette catégorie.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="maint-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Santé</th>
                  <th>Usage total</th>
                  <th>Depuis maint.</th>
                  <th>Dernière révision</th>
                  <th>Révision dans</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((m, i) => (
                    <motion.tr
                      key={m.id}
                      className={`maint-row maint-row-${m.urgency}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      {/* Machine */}
                      <td className="td-machine">
                        <div className="machine-name">{m.label || 'Sans nom'}</div>
                        <div className="machine-meta">
                          <span className="machine-type">{m.type || 'Inconnu'}</span>
                          {m.gymview_id
                            ? <span className="iot-on"><Wifi size={10} />{m.gymview_id}</span>
                            : <span className="iot-off"><WifiOff size={10} />Non connectée</span>
                          }
                        </div>
                      </td>

                      {/* Santé */}
                      <td className="td-health">
                        <div className="health-row">
                          <div className="health-track">
                            <div
                              className="health-fill"
                              style={{ width: `${m.health}%`, backgroundColor: healthColor(m.health) }}
                            />
                          </div>
                          <span className="health-pct" style={{ color: healthColor(m.health) }}>
                            {m.health}%
                          </span>
                        </div>
                        <div className="urgency-label" data-level={m.urgency}>
                          {m.urgency === 'critical' ? 'Critique'
                            : m.urgency === 'warning' ? 'Alerte'
                            : 'OK'}
                        </div>
                      </td>

                      {/* Usage total */}
                      <td className="td-num">
                        <span className="num-big">{Math.round((m.total_minutes || 0) / 60)}</span>
                        <span className="num-unit">h</span>
                      </td>

                      {/* Depuis maintenance */}
                      <td className="td-num">
                        <span className="num-big">{Math.round((m.minutes_since_last_maint || 0) / 60)}</span>
                        <span className="num-unit">h</span>
                      </td>

                      {/* Dernière révision */}
                      <td className="td-date">{formatDate(m.last_maintenance_date)}</td>

                      {/* Jours restants */}
                      <td className="td-days">
                        {m.daysLeft <= 7
                          ? <span className="days-urgent">
                              <AlertOctagon size={12} />
                              {m.daysLeft === 0 ? 'Dépassé' : `${m.daysLeft} jour${m.daysLeft > 1 ? 's' : ''}`}
                            </span>
                          : <span className="days-ok">
                              <Clock size={12} />
                              {m.daysLeft} jours
                            </span>
                        }
                      </td>

                      {/* Action */}
                      <td className="td-action">
                        {resetting === m.id ? (
                          <span className="btn-resetting">
                            <RefreshCw size={13} className="spin" /> En cours...
                          </span>
                        ) : confirming === m.id ? (
                          <div className="confirm-row">
                            <button
                              className="btn-confirm"
                              onClick={() => handleReset(m.id)}
                            >
                              <CheckCircle2 size={13} /> Confirmer
                            </button>
                            <button
                              className="btn-cancel-confirm"
                              onClick={() => setConfirming(null)}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-revise"
                            onClick={() => setConfirming(m.id)}
                          >
                            <Wrench size={13} /> Révisé
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
