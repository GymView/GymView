import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Users, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { GymApi } from '../ApiService';
import { CONFIG } from '../constants/config';
import './Dashboard.css';

// Données de simulation (à remplacer par des appels API réels)
const usageData = [
  { time: '08:00', occupancy: 20 },
  { time: '10:00', occupancy: 45 },
  { time: '12:00', occupancy: 70 },
  { time: '14:00', occupancy: 40 },
  { time: '17:00', occupancy: 85 },
  { time: '19:00', occupancy: 95 },
  { time: '21:00', occupancy: 50 },
];

const machinePopularity = [
  { name: 'Tapis', visits: 120 },
  { name: 'Vélos', visits: 80 },
  { name: 'Poulies', visits: 150 },
  { name: 'Bancs', visits: 90 },
  { name: 'Rameurs', visits: 60 },
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeUsers: 42,
    machineLoad: '76%',
    alerts: 2,
    dailyGrowth: '+12%'
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="dashboard-container"
    >
      <header className="dashboard-header">
        <h1>Dashboard Stratégique</h1>
        <p className="text-muted">Analyse en temps réel - Salle #{CONFIG.GYM_ID}</p>
      </header>

      {/* Cartes de KPI */}
      <div className="stats-grid">
        <StatCard icon={<Users />} title="Membres Actuels" value={stats.activeUsers} trend="+5 depuis 1h" />
        <StatCard icon={<Activity />} title="Charge Machines" value={stats.machineLoad} trend="Pic attendu à 18h" />
        <StatCard icon={<AlertTriangle color="#e63946" />} title="Alertes Maintenance" value={stats.alerts} trend="2 capteurs hors-ligne" />
        <StatCard icon={<TrendingUp color="#2a9d8f" />} title="Croissance Jour" value={stats.dailyGrowth} trend="Vs hier" />
      </div>

      <div className="charts-main-grid">
        {/* Graphique de fréquentation */}
        <div className="chart-card">
          <h3>Fréquentation de la salle (Occupation %)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={usageData}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#375a7f" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#375a7f" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#b0b0b0" />
                <YAxis stroke="#b0b0b0" />
                <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: 'none' }} />
                <Area type="monotone" dataKey="occupancy" stroke="#375a7f" fillOpacity={1} fill="url(#colorUsage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Popularité des machines */}
        <div className="chart-card">
          <h3>Utilisation par Type de Machine</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={machinePopularity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#b0b0b0" />
                <YAxis stroke="#b0b0b0" />
                <Tooltip cursor={{fill: '#2d2d2d'}} contentStyle={{ backgroundColor: '#1e1e1e', border: 'none' }} />
                <Bar dataKey="visits" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, title, value, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h4>{title}</h4>
        <div className="stat-value">{value}</div>
        <span className="stat-trend">{trend}</span>
      </div>
    </div>
  );
}