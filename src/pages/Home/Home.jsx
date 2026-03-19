import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Clock,
  Dumbbell, RefreshCw, TrendingUp, Zap
} from 'lucide-react';
import { GymApi } from '../../services/gymApi';
import { CONFIG } from '../../constants/config';
import './Home.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function Home() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await GymApi.fetchMap(CONFIG.GYM_ID);
      setMachines(Array.isArray(data) ? data : []);
      setLastUpdate(new Date());
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculs dérivés ---
  const total = machines.length;
  const libre   = machines.filter(m => m.state === 'libre').length;
  const utilise = machines.filter(m => m.state === 'utilise').length;
  const occupe  = machines.filter(m => m.state === 'occupe').length;
  const inUse   = utilise + occupe;
  const occupancyRate = total > 0 ? Math.round((inUse / total) * 100) : 0;

  const withHealth = machines.map(m => {
    const threshold = m.maintenance_threshold || 10000;
    const used = m.minutes_since_last_maint || 0;
    const health = Math.max(0, 100 - (used / threshold) * 100);
    const daysLeft = Math.max(0, Math.floor((threshold - used) / 120));
    return { ...m, health, daysLeft };
  });

  const alertCount = withHealth.filter(m => m.health < 20).length;
  const criticalMachines = withHealth
    .filter(m => m.health < 50)
    .sort((a, b) => a.health - b.health)
    .slice(0, 5);

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = lastUpdate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const kpis = [
    {
      icon: <Dumbbell size={22} />,
      label: 'Machines totales',
      value: total,
      sub: 'dans la salle',
      color: 'var(--accent-primary)',
    },
    {
      icon: <Activity size={22} />,
      label: 'En utilisation',
      value: inUse,
      sub: `${libre} libre${libre > 1 ? 's' : ''}`,
      color: '#ffe066',
    },
    {
      icon: <TrendingUp size={22} />,
      label: 'Taux d\'occupation',
      value: `${occupancyRate}%`,
      sub: 'des machines actives',
      color: occupancyRate > 70 ? '#ff6b6b' : 'var(--accent-primary)',
    },
    {
      icon: <AlertTriangle size={22} />,
      label: 'Alertes maintenance',
      value: alertCount,
      sub: alertCount === 0 ? 'Tout est OK' : `machine${alertCount > 1 ? 's' : ''} critique${alertCount > 1 ? 's' : ''}`,
      color: alertCount > 0 ? '#ff6b6b' : 'var(--accent-primary)',
    },
  ];

  return (
    <div className="home-container">

      {/* ── Header ── */}
      <motion.div className="home-header" {...fadeUp(0)}>
        <div>
          <h1 className="home-title">Bonjour 👋</h1>
          <p className="home-date">{dateStr}</p>
        </div>
        <button className="home-refresh-btn" onClick={loadData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          {loading ? 'Chargement...' : `Mis à jour à ${timeStr ?? '–'}`}
        </button>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="home-kpi-grid">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="home-kpi-card" {...fadeUp(0.05 * (i + 1))}>
            <div className="home-kpi-icon" style={{ color: k.color, background: `${k.color}18`, border: `1px solid ${k.color}33` }}>
              {k.icon}
            </div>
            <div>
              <div className="home-kpi-value" style={{ color: k.color }}>{loading ? '–' : k.value}</div>
              <div className="home-kpi-label">{k.label}</div>
              <div className="home-kpi-sub">{loading ? '...' : k.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Deux colonnes ── */}
      <div className="home-main-grid">

        {/* État du parc */}
        <motion.div className="home-card" {...fadeUp(0.25)}>
          <h2 className="home-card-title">
            <Zap size={16} /> État du parc machine
          </h2>

          <div className="state-row">
            <StateBar label="Libres" count={libre} total={total} color="var(--accent-primary)" bg="var(--state-free)" loading={loading} />
            <StateBar label="En utilisation" count={utilise} total={total} color="#ffe066" bg="var(--state-busy)" loading={loading} />
            <StateBar label="Occupées" count={occupe} total={total} color="#ff6b6b" bg="var(--state-occ)" loading={loading} />
          </div>

          {!loading && total > 0 && (
            <div className="state-visual">
              {machines.map(m => (
                <div
                  key={m.id}
                  className={`state-dot state-dot-${m.state}`}
                  title={`${m.label || 'Machine'} — ${m.state}`}
                />
              ))}
            </div>
          )}

          {!loading && total === 0 && (
            <p className="home-empty">Aucune machine enregistrée.</p>
          )}
        </motion.div>

        {/* Alertes maintenance */}
        <motion.div className="home-card" {...fadeUp(0.3)}>
          <h2 className="home-card-title">
            <AlertTriangle size={16} /> Machines à surveiller
          </h2>

          {loading && <p className="home-empty">Chargement...</p>}

          {!loading && criticalMachines.length === 0 && (
            <div className="home-all-good">
              <CheckCircle size={32} color="var(--accent-primary)" />
              <p>Toutes les machines sont en bonne santé.</p>
            </div>
          )}

          {!loading && criticalMachines.map((m, i) => (
            <motion.div
              key={m.id}
              className="alert-row"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
            >
              <div className="alert-info">
                <span className="alert-name">{m.label || 'Sans nom'}</span>
                <span className="alert-type">{m.type || 'Inconnu'}</span>
              </div>

              <div className="alert-health-wrap">
                <div className="alert-bar-bg">
                  <div
                    className="alert-bar-fill"
                    style={{
                      width: `${m.health}%`,
                      backgroundColor: m.health < 20 ? '#e63946' : m.health < 40 ? '#f4a261' : '#2a9d8f',
                    }}
                  />
                </div>
                <span className="alert-days" style={{ color: m.daysLeft <= 7 ? '#ff6b6b' : 'var(--text-muted)' }}>
                  <Clock size={11} /> {m.daysLeft}j
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function StateBar({ label, count, total, color, bg, loading }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="state-bar-row">
      <div className="state-bar-header">
        <span className="state-bar-label">{label}</span>
        <span className="state-bar-count" style={{ color }}>{loading ? '–' : `${count} (${pct}%)`}</span>
      </div>
      <div className="state-bar-track">
        <div
          className="state-bar-fill"
          style={{ width: loading ? '0%' : `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
        />
      </div>
    </div>
  );
}
