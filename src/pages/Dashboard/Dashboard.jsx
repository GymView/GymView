import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Clock, Dumbbell,
  Heart, RefreshCw, Wifi, WifiOff, Zap
} from 'lucide-react';
import { GymApi } from '../../services/gymApi';
import { CONFIG } from '../../constants/config';
import './Dashboard.css';


const TOOLTIP_STYLE = {
  backgroundColor: '#07203a',
  border: '1px solid rgba(0,230,118,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontSize: '0.82rem',
};

const STATE_COLORS = {
  libre:   '#00e676',
  utilise: '#ffe066',
  occupe:  '#ff6b6b',
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [machines,    setMachines]    = useState([]);
  const [hourlyData,  setHourlyData]  = useState([]);
  const [dailyData,   setDailyData]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdate,  setLastUpdate]  = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [machines, hourly, daily] = await Promise.all([
        GymApi.fetchMap(CONFIG.GYM_ID),
        GymApi.getHourlyUsage(CONFIG.GYM_ID, 30),
        GymApi.getDailyUsage(CONFIG.GYM_ID, 60),
      ]);
      setMachines(Array.isArray(machines) ? machines : []);
      setHourlyData(Array.isArray(hourly)  ? hourly  : []);
      setDailyData(Array.isArray(daily)    ? daily   : []);
      setLastUpdate(new Date());
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Calculs ──────────────────────────────────────────────────
  const total   = machines.length;
  const libre   = machines.filter(m => m.state === 'libre').length;
  const utilise = machines.filter(m => m.state === 'utilise').length;
  const occupe  = machines.filter(m => m.state === 'occupe').length;
  const inUse   = utilise + occupe;
  const rate    = total > 0 ? Math.round((inUse / total) * 100) : 0;

  const withHealth = machines.map(m => {
    const threshold = m.maintenance_threshold || 10000;
    const used      = m.minutes_since_last_maint || 0;
    const health    = Math.max(0, Math.round(100 - (used / threshold) * 100));
    const daysLeft  = Math.max(0, Math.floor((threshold - used) / 120));
    return { ...m, health, daysLeft };
  });

  const avgHealth   = total > 0
    ? Math.round(withHealth.reduce((s, m) => s + m.health, 0) / total)
    : 0;
  const critCount   = withHealth.filter(m => m.health < 20).length;
  const warnCount   = withHealth.filter(m => m.health >= 20 && m.health < 50).length;
  const connected   = machines.filter(m => m.gymview_id && m.gymview_id !== '').length;
  const totalHours  = Math.round(machines.reduce((s, m) => s + (m.total_minutes || 0), 0) / 60);

  // Données pour les graphiques
  const stateData = [
    { name: 'Libres',   value: libre,   fill: STATE_COLORS.libre },
    { name: 'En cours', value: utilise, fill: STATE_COLORS.utilise },
    { name: 'Occupées', value: occupe,  fill: STATE_COLORS.occupe },
  ].filter(d => d.value > 0);

  const typeUsage = Object.values(
    machines.reduce((acc, m) => {
      const t = m.type || 'inconnu';
      acc[t] = acc[t] || { type: t.charAt(0).toUpperCase() + t.slice(1), heures: 0, count: 0 };
      acc[t].heures += Math.round((m.total_minutes || 0) / 60);
      acc[t].count  += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.heures - a.heures);

  const healthChartData = [...withHealth]
    .sort((a, b) => a.health - b.health)
    .map(m => ({
      name: m.label || 'Machine',
      sante: m.health,
      fill: m.health < 20 ? '#e63946' : m.health < 50 ? '#f4a261' : '#2a9d8f',
    }));

  const timeStr = lastUpdate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const kpis = [
    {
      icon: <Activity size={20} />,
      label: 'Occupation',
      value: `${rate}%`,
      sub: `${inUse} machine${inUse > 1 ? 's' : ''} actives / ${total}`,
      color: rate > 80 ? '#ff6b6b' : rate > 50 ? '#ffe066' : '#00e676',
    },/*
    {
      icon: <Dumbbell size={20} />,
      label: 'Libres maintenant',
      value: libre,
      sub: `${occupe} occupées · ${utilise} en cours`,
      color: '#00e676',
    },*/
    {
      icon: <Heart size={20} />,
      label: 'Santé moyenne',
      value: `${avgHealth}%`,
      sub: `${critCount} critique${critCount > 1 ? 's' : ''} · ${warnCount} avertissement${warnCount > 1 ? 's' : ''}`,
      color: avgHealth < 40 ? '#ff6b6b' : avgHealth < 70 ? '#f4a261' : '#2a9d8f',
    },
    {
      icon: <AlertTriangle size={20} />,
      label: 'Révisions urgentes',
      value: critCount,
      sub: critCount === 0 ? 'Aucune machine critique' : `Intervention requise`,
      color: critCount > 0 ? '#ff6b6b' : '#00e676',
    },
    {
      icon: <Clock size={20} />,
      label: "Heures d'usage cumulées",
      value: `${totalHours.toLocaleString('fr-FR')}h`,
      sub: 'sur toutes les machines',
      color: '#a78bfa',
    },
    {
      icon: connected < total ? <WifiOff size={20} /> : <Wifi size={20} />,
      label: 'Connectées IoT',
      value: `${connected}/${total}`,
      sub: connected < total ? `${total - connected} hors-ligne` : 'Toutes connectées',
      color: connected < total ? '#f4a261' : '#00e676',
    },
  ];

  return (
    <div className="dashboard-container">

      {/* ── En-tête ── */}
      <motion.header className="dashboard-header" {...fadeUp(0)}>
        <div>
          <h1>Dashboard Analytics</h1>
          <p className="dash-subtitle">Salle #{CONFIG.GYM_ID} · données en temps réel</p>
        </div>
        <button className="dash-refresh-btn" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? 'Chargement...' : `Actualisé à ${timeStr ?? '–'}`}
        </button>
      </motion.header>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="kpi-card" {...fadeUp(0.04 * (i + 1))}>
            <div className="kpi-icon" style={{ color: k.color, background: `${k.color}1a`, border: `1px solid ${k.color}33` }}>
              {k.icon}
            </div>
            <div className="kpi-body">
              <div className="kpi-value" style={{ color: k.color }}>{loading ? '–' : k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-sub">{loading ? '...' : k.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Ligne 1 : état + usage par type ── */}
      <div className="charts-row">

        <motion.div className="chart-card" {...fadeUp(0.2)}>
          <h3 className="chart-title"><Zap size={14} /> Répartition des états</h3>
          {total === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stateData}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    {stateData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} machine${v>1?'s':''}`, n]} />
                  <Legend iconType="circle" iconSize={10} formatter={v => <span style={{color:'#a0b8cc',fontSize:'0.8rem'}}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
          }
        </motion.div>

        <motion.div className="chart-card" {...fadeUp(0.25)}>
          <h3 className="chart-title"><Clock size={14} /> Heures d'usage par type</h3>
          {typeUsage.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={typeUsage} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="type" stroke="#a0b8cc" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#a0b8cc" tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [`${v}h d'usage`, 'Total']}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="heures" fill="#2a9d8f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </motion.div>
      </div>

      {/* ── Ligne 2 : fréquentation horaire réelle (pleine largeur) ── */}
      <motion.div className="chart-card" {...fadeUp(0.3)}>
        <h3 className="chart-title">
          <Activity size={14} /> Fréquentation horaire — 30 derniers jours
          {hourlyData.length === 0 && <span className="chart-badge">en attente de données</span>}
        </h3>
        {hourlyData.length === 0
          ? <EmptyChart />
          : <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="gradOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00e676" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00e676" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="h" stroke="#a0b8cc" tick={{ fontSize: 11 }} />
                <YAxis stroke="#a0b8cc" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, _, props) => [
                    `${v}% d'occupation · ${props.payload.sessions} sessions`,
                    'Activité',
                  ]}
                />
                <Area type="monotone" dataKey="taux" stroke="#00e676" strokeWidth={2} fill="url(#gradOcc)" />
              </AreaChart>
            </ResponsiveContainer>
        }
      </motion.div>

      {/* ── Ligne 3 : tendance journalière (pleine largeur) ── */}
      <motion.div className="chart-card" {...fadeUp(0.35)}>
        <h3 className="chart-title">
          <Clock size={14} /> Tendance d'usage journalière — 60 derniers jours
          {dailyData.length === 0 && <span className="chart-badge">en attente de données</span>}
        </h3>
        {dailyData.length === 0
          ? <EmptyChart />
          : <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="#a0b8cc"
                  tick={{ fontSize: 10 }}
                  tickFormatter={d => {
                    const dt = new Date(d);
                    return `${dt.getDate()}/${dt.getMonth() + 1}`;
                  }}
                  interval={Math.floor(dailyData.length / 10)}
                />
                <YAxis stroke="#a0b8cc" tick={{ fontSize: 11 }} unit="h" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  formatter={(v) => [`${v}h d'usage cumulé`, 'Activité']}
                />
                <Area type="monotone" dataKey="heures" stroke="#a78bfa" strokeWidth={2} fill="url(#gradDaily)" />
              </AreaChart>
            </ResponsiveContainer>
        }
      </motion.div>

      {/* ── Tableau détaillé ── */}
      <motion.div className="chart-card table-card" {...fadeUp(0.4)}>
        <h3 className="chart-title"><Dumbbell size={14} /> Détail des machines</h3>
        {loading
          ? <p className="dash-empty">Chargement...</p>
          : total === 0
            ? <p className="dash-empty">Aucune machine enregistrée.</p>
            : <div className="table-scroll">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Type</th>
                      <th>État</th>
                      <th>IoT</th>
                      <th>Santé</th>
                      <th>Usage total</th>
                      <th>Depuis maint.</th>
                      <th>Révision dans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withHealth
                      .sort((a, b) => a.health - b.health)
                      .map(m => (
                        <tr key={m.id} className={m.health < 20 ? 'row-critical' : m.health < 50 ? 'row-warn' : ''}>
                          <td className="td-name">{m.label || 'Sans nom'}</td>
                          <td className="td-muted">{m.type || '–'}</td>
                          <td>
                            <span className={`state-badge state-${m.state}`}>
                              {m.state === 'libre' ? 'Libre' : m.state === 'utilise' ? 'En cours' : 'Occupée'}
                            </span>
                          </td>
                          <td>
                            {m.gymview_id
                              ? <span className="iot-on"><Wifi size={12} /> {m.gymview_id}</span>
                              : <span className="iot-off"><WifiOff size={12} /> –</span>
                            }
                          </td>
                          <td>
                            <div className="mini-bar-wrap">
                              <div className="mini-bar-track">
                                <div
                                  className="mini-bar-fill"
                                  style={{
                                    width: `${m.health}%`,
                                    backgroundColor: m.health < 20 ? '#e63946' : m.health < 50 ? '#f4a261' : '#2a9d8f',
                                  }}
                                />
                              </div>
                              <span className="mini-bar-pct">{m.health}%</span>
                            </div>
                          </td>
                          <td className="td-num">{Math.round((m.total_minutes || 0) / 60)}h</td>
                          <td className="td-num">{Math.round((m.minutes_since_last_maint || 0) / 60)}h</td>
                          <td className={`td-num ${m.daysLeft <= 7 ? 'text-danger' : ''}`}>
                            {m.daysLeft <= 7 && <AlertTriangle size={11} style={{ marginRight: 4 }} />}
                            {m.daysLeft}j
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
        }
      </motion.div>

    </div>
  );
}

function EmptyChart() {
  return <p className="dash-empty">Aucune donnée disponible.</p>;
}
