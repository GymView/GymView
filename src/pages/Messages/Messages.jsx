import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Clock, Flame,
  Loader2, MessageSquarePlus, Package, ShieldAlert,
  Sparkles, Trash2, Wrench, X, ChevronDown, RefreshCw,
} from 'lucide-react';
import { GymApi } from '../../services/gymApi';
import { CONFIG } from '../../constants/config';
import './Messages.css';

// ── Config ───────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'panne',       label: 'Panne machine',      icon: Wrench,        color: '#f4a261' },
  { key: 'maintenance', label: 'Maintenance urgente', icon: AlertTriangle, color: '#ffe066' },
  { key: 'securite',    label: 'Sécurité',            icon: ShieldAlert,   color: '#e63946' },
  { key: 'hygiene',     label: 'Hygiène / Propreté',  icon: Sparkles,      color: '#a78bfa' },
  { key: 'equipement',  label: 'Équipement manquant', icon: Package,       color: '#6495ed' },
  { key: 'autre',       label: 'Autre',               icon: MessageSquarePlus, color: '#a0b8cc' },
];

const PRIORITIES = [
  { key: 'faible',   label: 'Faible',   color: '#a0b8cc' },
  { key: 'normale',  label: 'Normale',  color: '#6495ed' },
  { key: 'haute',    label: 'Haute',    color: '#f4a261' },
  { key: 'urgente',  label: 'Urgente',  color: '#e63946' },
];

const STATUSES = [
  { key: 'ouvert',   label: 'Ouvert',    color: '#f4a261' },
  { key: 'en_cours', label: 'En cours',  color: '#ffe066' },
  { key: 'resolu',   label: 'Résolu',    color: '#00e676' },
];

const FILTERS = [
  { key: 'all',      label: 'Tous'     },
  { key: 'ouvert',   label: 'Ouverts'  },
  { key: 'en_cours', label: 'En cours' },
  { key: 'resolu',   label: 'Résolus'  },
];

const EMPTY_FORM = { title: '', category: 'panne', priority: 'normale', machine: '', description: '' };

function getCat(key)  { return CATEGORIES.find(c => c.key === key) || CATEGORIES.at(-1); }
function getPrio(key) { return PRIORITIES.find(p => p.key === key) || PRIORITIES[1]; }
function getStat(key) { return STATUSES.find(s => s.key === key)   || STATUSES[0]; }

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now - d) / 3600000);
  if (diffH < 1)   return "À l'instant";
  if (diffH < 24)  return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)   return `Il y a ${diffD}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0  },
  transition: { duration: 0.3, delay },
});

// ─────────────────────────────────────────────────────────────
export default function Messages() {
  const [reports,    setReports]    = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const loadReports = useCallback(async () => {
    setApiLoading(true);
    try {
      const data = await GymApi.getReports(CONFIG.GYM_ID);
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── CRUD ──────────────────────────────────────────────────
  const submit = async () => {
    const errs = {};
    if (!form.title.trim()) errs.title    = 'Titre requis';
    if (!form.category)     errs.category = 'Catégorie requise';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    try {
      const created = await GymApi.createReport(CONFIG.GYM_ID, {
        title:       form.title.trim(),
        category:    form.category,
        priority:    form.priority,
        machine:     form.machine.trim(),
        description: form.description.trim(),
      });
      setReports(prev => [created, ...prev]);
    } catch { /* silencieux */ }
    setShowForm(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const setStatus = async (id, status) => {
    try {
      const updated = await GymApi.updateReportStatus(id, status);
      setReports(prev => prev.map(r => r.id === id ? updated : r));
    } catch { /* silencieux */ }
  };

  const remove = async (id) => {
    try {
      await GymApi.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch { /* silencieux */ }
  };

  const field = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  // ── Dérivés ────────────────────────────────────────────────
  const byStatus = (k) => reports.filter(r => r.status === k).length;

  const filtered = reports
    .filter(r => filter === 'all' || r.status === filter)
    .sort((a, b) => {
      const po = ['urgente','haute','normale','faible'];
      const pd = po.indexOf(a.priority) - po.indexOf(b.priority);
      if (pd !== 0) return pd;
      return new Date(b.date) - new Date(a.date);
    });

  return (
    <div className="msg-container">

      {/* ── Header ── */}
      <motion.div className="msg-header" {...fadeUp(0)}>
        <div>
          <h1>Signalement de problèmes</h1>
          <p className="msg-subtitle">
            Signalez pannes, incidents et problèmes pour les traiter rapidement
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-new-report" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={loadReports} disabled={apiLoading}>
            <RefreshCw size={14} className={apiLoading ? 'spin' : ''} />
          </button>
          <button className="btn-new-report" onClick={() => setShowForm(true)} disabled={apiLoading}>
            <MessageSquarePlus size={16} /> Nouveau signalement
          </button>
        </div>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="msg-kpi-row">
        {[
          { label: 'Ouverts',   count: byStatus('ouvert'),   color: '#f4a261', Icon: AlertTriangle },
          { label: 'En cours',  count: byStatus('en_cours'), color: '#ffe066', Icon: Loader2       },
          { label: 'Résolus',   count: byStatus('resolu'),   color: '#00e676', Icon: CheckCircle2  },
          { label: 'Total',     count: reports.length,       color: '#a0b8cc', Icon: Flame         },
        ].map((k, i) => (
          <motion.div key={k.label} className="msg-kpi" {...fadeUp(0.05 * (i + 1))}>
            <k.Icon size={18} style={{ color: k.color }} />
            <span className="kpi-num" style={{ color: k.color }}>{k.count}</span>
            <span className="kpi-lbl">{k.label}</span>
          </motion.div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <motion.div className="msg-filters" {...fadeUp(0.2)}>
        {FILTERS.map(f => {
          const count = f.key === 'all' ? reports.length : byStatus(f.key);
          const st = getStat(f.key);
          return (
            <button
              key={f.key}
              className={`filter-pill ${filter === f.key ? 'active' : ''}`}
              style={filter === f.key ? { borderColor: st?.color || 'var(--accent-primary)', color: st?.color || 'var(--accent-primary)' } : {}}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Liste ── */}
      <div className="msg-list">
        <AnimatePresence mode="popLayout">
          {apiLoading ? (
            <motion.div key="loading" className="msg-empty" {...fadeUp(0.1)}>
              <Loader2 size={28} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <p>Chargement des signalements…</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" className="msg-empty" {...fadeUp(0.1)}>
              <CheckCircle2 size={36} color="var(--accent-primary)" />
              <p>{filter === 'all' ? 'Aucun signalement. Tout va bien !' : 'Aucun signalement dans cette catégorie.'}</p>
            </motion.div>
          ) : (
            filtered.map((r, i) => (
              <ReportCard
                key={r.id}
                report={r}
                delay={i * 0.04}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onStatus={setStatus}
                onDelete={remove}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal nouveau signalement ── */}
      <AnimatePresence>
        {showForm && (
          <ReportForm
            form={form}
            errors={errors}
            onChange={field}
            onSubmit={submit}
            onClose={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────
function ReportCard({ report, delay, expanded, onToggle, onStatus, onDelete }) {
  const cat  = getCat(report.category);
  const prio = getPrio(report.priority);
  const stat = getStat(report.status);
  const CatIcon = cat.icon;

  const nextStatuses = STATUSES.filter(s => s.key !== report.status);

  return (
    <motion.div
      className={`report-card priority-${report.priority}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, delay }}
    >
      <div className="card-main" onClick={onToggle}>
        {/* Icône catégorie */}
        <div className="card-cat-icon" style={{ color: cat.color, background: `${cat.color}18`, border: `1px solid ${cat.color}28` }}>
          <CatIcon size={16} />
        </div>

        {/* Contenu */}
        <div className="card-body">
          <div className="card-top">
            <span className="card-title">{report.title}</span>
            <div className="card-badges">
              <span className="badge prio-badge" style={{ color: prio.color, background: `${prio.color}18`, borderColor: `${prio.color}30` }}>
                {prio.label}
              </span>
              <span className="badge stat-badge" style={{ color: stat.color, background: `${stat.color}18`, borderColor: `${stat.color}30` }}>
                {stat.label}
              </span>
            </div>
          </div>
          <div className="card-meta">
            <span className="meta-cat">{cat.label}</span>
            {report.machine && <span className="meta-machine">· {report.machine}</span>}
            <span className="meta-date">{formatDate(report.date)}</span>
          </div>
        </div>

        <ChevronDown size={16} className={`card-chevron ${expanded ? 'rotated' : ''}`} />
      </div>

      {/* Contenu étendu */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="card-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="card-detail-inner">
              {report.description
                ? <p className="card-desc">{report.description}</p>
                : <p className="card-desc card-no-desc">Aucune description fournie.</p>
              }

              <div className="card-actions">
                <div className="action-status-btns">
                  {nextStatuses.map(s => (
                    <button
                      key={s.key}
                      className="btn-status"
                      style={{ color: s.color, borderColor: `${s.color}40` }}
                      onClick={() => onStatus(report.id, s.key)}
                    >
                      {s.key === 'en_cours'  ? <Loader2 size={12} />      : null}
                      {s.key === 'resolu'    ? <CheckCircle2 size={12} /> : null}
                      {s.key === 'ouvert'    ? <AlertTriangle size={12} /> : null}
                      Marquer « {s.label} »
                    </button>
                  ))}
                </div>
                <button className="btn-delete-report" onClick={() => onDelete(report.id)}>
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Formulaire ──────────────────────────────────────────────
function ReportForm({ form, errors, onChange, onSubmit, onClose }) {
  return (
    <motion.div
      className="form-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="form-modal"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0,    y: 16, scale: 0.97 }}
        transition={{ duration: 0.28, type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="form-header">
          <h3>Nouveau signalement</h3>
          <button className="btn-close-form" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-body">
          {/* Titre */}
          <div className={`field ${errors.title ? 'field-error' : ''}`}>
            <label>Titre <span className="required">*</span></label>
            <input
              value={form.title}
              onChange={e => onChange('title', e.target.value)}
              placeholder="Ex : Tapis de course n°3 hors service"
              autoFocus
            />
            {errors.title && <span className="error-msg">{errors.title}</span>}
          </div>

          {/* Catégorie + Priorité */}
          <div className="field-row">
            <div className={`field ${errors.category ? 'field-error' : ''}`}>
              <label>Catégorie <span className="required">*</span></label>
              <select value={form.category} onChange={e => onChange('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              {errors.category && <span className="error-msg">{errors.category}</span>}
            </div>

            <div className="field">
              <label>Priorité</label>
              <select value={form.priority} onChange={e => onChange('priority', e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Machine concernée */}
          <div className="field">
            <label>Machine concernée <span className="optional">(optionnel)</span></label>
            <input
              value={form.machine}
              onChange={e => onChange('machine', e.target.value)}
              placeholder="Ex : Vélo elliptique 2, Poulie haute..."
            />
          </div>

          {/* Description */}
          <div className="field">
            <label>Description <span className="optional">(optionnel)</span></label>
            <textarea
              value={form.description}
              onChange={e => onChange('description', e.target.value)}
              placeholder="Décrivez le problème en détail : symptômes, circonstances, risques..."
              rows={4}
            />
          </div>
        </div>

        <div className="form-footer">
          <button className="btn-form-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-form-submit" onClick={onSubmit}>
            <MessageSquarePlus size={15} /> Envoyer le signalement
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
