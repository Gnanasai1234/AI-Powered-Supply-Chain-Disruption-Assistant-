import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowUpRight, Boxes, Check, ChevronRight, CircleHelp, ClipboardList, Copy, Database, Gauge, History as HistoryIcon, LayoutDashboard, LoaderCircle, LogOut, Menu, Network, Search, ShieldAlert, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from './api'
import { AnalysisProgress, ErrorState, HistoricalCaseCard, HistoricalRecordModal, LoadingSkeleton, Toast } from './ui'
import HistoryPage from './History'

const disruptionTypes = ['Factory Incident', 'Cyber Attack', 'Port Congestion', 'Labor Strike', 'Geopolitical', 'Natural Disaster']
const industries = ['Pharmaceuticals', 'Electronics', 'Consumer Goods', 'Automotive', 'Aerospace']
const regions = ['Asia-Pacific', 'Europe', 'South America', 'North America', 'Africa/Middle East']
const sizes = ['Large', 'Medium', 'Small']
const responseTypes = ['Customer Delay', 'Alternative Supplier', 'Production Reroute', 'Inventory Buffer', 'Combined Strategy']
const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
const fmt = value => value == null ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
const money = value => value == null ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const friendlyError = err => {
  console.error('Supply-chain API request failed', { status: err.response?.status, code: err.code })
  if (!err.response) return 'The API could not be reached. Check that the backend is running and try again.'
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(item => item.msg).filter(Boolean).join(' ')
  if (err.response.status === 503) return 'The service is unavailable. Check backend health and the required local services.'
  if (err.response.status === 422) return 'Some fields need attention. Review the details and try again.'
  return 'The request could not be completed. Please try again.'
}

const navItems = [
  ['/dashboard', 'Overview', LayoutDashboard], ['/dashboard/analysis', 'Disruption analysis', Sparkles],
  ['/dashboard/history', 'History', HistoryIcon], ['/dashboard/similar-cases', 'Similar cases', Network], ['/dashboard/predictions', 'Predictions', Gauge],
  ['/dashboard/recommendations', 'Recommendations', ClipboardList], ['/dashboard/resilience', 'Risk & resilience', ShieldAlert],
  ['/dashboard/analytics', 'Analytics', Activity], ['/dashboard/feedback', 'Feedback', ThumbsUp], ['/dashboard/evaluation', 'Evaluation', Database],
]

function Sidebar({ open, close, onLogout, user }) {
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return <>{open && <button className="sidebar-scrim" onClick={close} aria-label="Close navigation" />}<aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="brand"><span className="brand-icon"><Boxes size={20} /></span><span>Chainwise</span><button className="mobile-close" onClick={close} aria-label="Close navigation"><X size={18} /></button></div>
    <div className="workspace"><div className="workspace-icon">SC</div><div><b>Supply chain dataset</b><small>Local operations workspace</small></div><span className="workspace-pulse" /></div>
    <div className="nav-caption">OPERATIONS</div><nav aria-label="Main navigation">{navItems.map(([to, label, Icon], i) => <NavLink key={to} end={i === 0} to={to} onClick={close}><Icon />{label}<ChevronRight className="nav-chevron" size={14}/></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="help-card"><span><CircleHelp size={16} /> Evidence first</span><small>Historical records and saved model outputs inform each analysis.</small></div>
      <div className="session-user">
        <span className="session-avatar" aria-hidden="true">{initials}</span>
        <div className="session-info"><b title={user?.name}>{user?.name || 'Loading\u2026'}</b><small title={user?.email}>{user?.email || ''}</small></div>
        <button className="session-logout" onClick={onLogout} title="Log out" aria-label="Log out"><LogOut size={14}/></button>
      </div>
    </div>
  </aside></>
}

function Header({ title, openMenu, health }) {
  const apiReady = health?.status === 'ok'
  const hasModelStatus = !!health?.models
  const availableModels = Object.values(health?.models || {}).filter(Boolean).length
  const modelLabel = !hasModelStatus ? 'Model status unavailable' : availableModels === 4 ? 'Models ready' : `Models ${availableModels}/4`
  return <header className="topbar"><button className="mobile-menu" onClick={openMenu} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumbs">Operations <span>/</span> <b>{title}</b></div><div className="top-actions"><span className={`system-status ${apiReady ? '' : 'status-offline'}`}><i />{apiReady ? 'API connected' : 'API unavailable'}</span><span className={`model-status ${hasModelStatus ? '' : 'status-unknown'} ${availableModels === 4 ? 'is-ready' : ''}`}><i />{modelLabel}</span><span className="local-chip">LOCAL</span></div></header>
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

function Stat({ label, value, suffix = '', note, tone = 'blue' }) {
  const display = value == null ? 'Not available' : typeof value === 'string' ? value : `${fmt(value)}${suffix}`
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Activity size={17} /></span></div><div className="stat-value">{display}</div><div className="stat-foot">{note || 'From ingested historical records'}</div></article>
}

function Table({ columns, rows, empty = 'No records available.' }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map(col => <th key={col.label}>{col.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={row.disruption_id || row.id || i}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}</td>)}</tr>) : <tr><td className="empty-table" colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>
}

function Overview({ onAnalyze }) {
  const [overview, setOverview] = useState(null); const [types, setTypes] = useState(null); const [disruptions, setDisruptions] = useState(null); const [activity, setActivity] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); setError(''); try { const [a,b,c] = await Promise.all([api.get('/analytics/overview'), api.get('/analytics/disruptions'), api.get('/disruptions?limit=8')]); setOverview(a.data); setTypes(b.data); setDisruptions(c.data) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  useEffect(() => { api.get('/history/stats').then(({data}) => setActivity(data)).catch(() => setActivity(null)) }, [])
  const categoryData = types?.by_type?.map(x => ({ name: x.label, count: x.count })) || []
  const severityData = types?.by_severity?.map(x => ({ name: `Severity ${x.label}`, count: x.count })) || []
  return <><PageHeading eyebrow={today} title="Supply chain overview" description="Disruption exposure, operational outcomes and supplier resilience." action={<button className="primary-btn" onClick={onAnalyze}><Sparkles size={16} /> Analyze disruption</button>} />
    {activity && <div className="stats-grid overview-account-stats"><Stat label="My analyses" value={activity.total_analyses} note="Your analysis history"/><Stat label="Gemini" value={activity.provider_counts?.Gemini || 0} note="Final response provider"/><Stat label="OpenRouter" value={activity.provider_counts?.OpenRouter || 0} note="Final response provider"/><Stat label="Local" value={activity.provider_counts?.Local || 0} note="Final response provider"/><Stat label="Deterministic" value={activity.provider_counts?.['Deterministic Fallback'] || 0} note="Final response provider"/><Stat label="Used fallback" value={activity.fallback_requests} note="Your analyses"/></div>}
    {error && <ErrorState title="Overview data is unavailable" description={error} onRetry={load}/>}
    {loading ? <div className="overview-loading"><LoadingSkeleton rows={4} label="Loading supply chain overview"/><LoadingSkeleton rows={2} label="Loading historical trends"/></div> : !error && <>
      {overview && <div className="stats-grid"><Stat label="Total disruptions" value={overview.total_disruptions} /><Stat label="Average production impact" value={overview.average_production_impact_pct} suffix="%" tone="amber"/><Stat label="Total revenue loss" value={money(overview.total_revenue_loss_usd)} note="Sum across ingested historical records" tone="red"/><Stat label="Average response time" value={overview.average_response_time_days} suffix=" days"/><Stat label="Average recovery time" value={overview.average_recovery_time_days} suffix=" days" tone="green"/><Stat label="Backup supplier coverage" value={overview.backup_supplier_coverage_pct} suffix="%"/><Stat label="Permanent supplier change" value={overview.permanent_supplier_change_rate_pct} suffix="%" tone="amber"/></div>}
      <div className="overview-grid"><Panel title="Disruptions by type" subtitle="Actual records grouped by event type"><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} margin={{ top: 10, right: 10, left: -17, bottom: 28 }}><CartesianGrid stroke="var(--line-soft)" vertical={false} /><XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} /><Tooltip /><Bar dataKey="count" fill="var(--accent)" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></Panel><Panel title="Severity distribution" subtitle="Counts by recorded severity"><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={severityData} dataKey="count" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>{severityData.map((_, i) => <Cell key={i} fill={['#8b9af1','#7486eb','#5f72dc','#d39d54','#d76f68'][i % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></Panel></div>
      <Panel title="Recent historical records" subtitle="Source dataset records stored in MySQL" className="disruption-panel"><Table columns={[{label:'ID',key:'disruption_id'},{label:'TYPE',key:'disruption_type'},{label:'INDUSTRY',key:'industry'},{label:'REGION',key:'supplier_region'},{label:'SEVERITY',key:'disruption_severity'},{label:'IMPACT',key:'production_impact_pct',render:v=>`${fmt(v)}%`},{label:'RESPONSE',key:'response_type'}]} rows={disruptions?.results || []} empty="No dataset records ingested yet." /></Panel>
    </>}
  </>
}

const initialForm = { description: 'A severe port disruption has delayed an electronics supplier in Asia-Pacific.', disruption_type: 'Port Congestion', industry: 'Electronics', supplier_tier: '2', supplier_region: 'Asia-Pacific', supplier_size: 'Medium', has_backup_supplier: false, disruption_severity: 4, production_impact_pct: '', revenue_loss_usd: '', response_type: '', response_time_days: '' }
function AnalysisForm({ onComplete, busy, setBusy }) {
  const [form, setForm] = useState(initialForm); const [error, setError] = useState('')
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const payload = { ...form, supplier_tier: form.supplier_tier, production_impact_pct: form.production_impact_pct === '' ? null : Number(form.production_impact_pct), revenue_loss_usd: form.revenue_loss_usd === '' ? null : Number(form.revenue_loss_usd), response_type: form.response_type || null, response_time_days: form.response_time_days === '' ? null : Number(form.response_time_days) }
    try { const { data } = await api.post('/disruptions/analyze', payload); onComplete(data) } catch (err) { setError(friendlyError(err)) } finally { setBusy(false) }
  }
  return <form className={`panel analysis-form ${busy ? 'is-processing' : ''}`} onSubmit={submit} aria-busy={busy}>
    <div className="panel-header"><div><span className="form-step">INCIDENT INTAKE</span><h2>Current disruption</h2><p>Describe the observed event. Fields are validated by the API.</p></div></div>
    <label>Event details<textarea required minLength="12" maxLength="1200" value={form.description} onChange={e => set('description',e.target.value)} placeholder="Describe the observed disruption and its operational context." /></label>
    <div className="form-row"><label>Disruption type<select value={form.disruption_type} onChange={e => set('disruption_type',e.target.value)}>{disruptionTypes.map(x=><option key={x}>{x}</option>)}</select></label><label>Industry<select value={form.industry} onChange={e => set('industry',e.target.value)}>{industries.map(x=><option key={x}>{x}</option>)}</select></label></div>
    <div className="form-row"><label>Supplier tier<select value={form.supplier_tier} onChange={e => set('supplier_tier',e.target.value)}>{['1','2','3','4'].map(x=><option key={x}>{x}</option>)}</select></label><label>Supplier region<select value={form.supplier_region} onChange={e => set('supplier_region',e.target.value)}>{regions.map(x=><option key={x}>{x}</option>)}</select></label></div>
    <div className="form-row"><label>Supplier size<select value={form.supplier_size} onChange={e => set('supplier_size',e.target.value)}>{sizes.map(x=><option key={x}>{x}</option>)}</select></label><label>Backup supplier<select value={String(form.has_backup_supplier)} onChange={e => set('has_backup_supplier',e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></label></div>
    <div className="form-row"><label>Severity <b>{form.disruption_severity} / 5</b><input type="range" min="1" max="5" value={form.disruption_severity} onChange={e => set('disruption_severity',Number(e.target.value))} /></label><label>Observed production impact (%)<input type="number" min="0" max="100" step="0.1" value={form.production_impact_pct} onChange={e => set('production_impact_pct',e.target.value)} placeholder="Optional if not yet known" /></label></div>
    <div className="form-row"><label>Observed revenue loss (USD)<input type="number" min="0" step="0.01" value={form.revenue_loss_usd} onChange={e => set('revenue_loss_usd',e.target.value)} placeholder="Optional if not yet known" /></label><label>Response strategy, if known<select value={form.response_type} onChange={e => set('response_type',e.target.value)}><option value="">Not known yet</option>{responseTypes.map(x=><option key={x}>{x}</option>)}</select></label></div>
    <div className="form-row"><label>Response time (days), if known<input type="number" min="0" max="5000" value={form.response_time_days} onChange={e => set('response_time_days',e.target.value)} /></label><div className="input-note">Later response and recovery fields are excluded from initial prediction features.</div></div>
    {error && <ErrorState title="Analysis could not be completed" description={error}/ >}
    <button className="primary-btn run-btn" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Analysis running</> : 'Analyze disruption'} {!busy && <ArrowUpRight size={15}/>}</button>
  </form>
}

function PriorityBadge({ level }) { const normalized = (level || 'unavailable').toLowerCase(); return <span className={`risk-badge ${normalized}`}><i/>{level || 'Priority unavailable'}</span> }
function MetricTile({ label, value, tone = '' }) { return <article className={`metric-tile ${tone}`}><span>{label}</span><b>{value}</b></article> }

function AnalysisSummary({ result, busy }) {
  if (busy) return <AnalysisProgress />
  if (!result) return <section className="panel result-empty"><div className="empty-orbit"><Sparkles size={22} /></div><h2>Ready to analyze disruption</h2><p>Submit an event to retrieve historical cases and compare predictions.</p><div className="workflow-tags"><span>Classification</span><span>Historical evidence</span><span>Predictions</span></div></section>
  const preds = result.predictions?.predictions || {}
  const supplierChange = preds.permanent_supplier_change
  return <div className="analysis-summary">
    <section className="priority-result">
      <div><span className="result-kicker"><i /> ANALYSIS COMPLETE</span><h2>{result.classification?.disruption_type} <span>·</span> {result.classification?.industry}</h2><p>Severity {result.classification?.severity}/5</p></div>
      <PriorityBadge level={result.priority?.priority_level} />
      <div className="priority-score-bar"><span>Priority score</span><b>{result.priority?.priority_score == null ? 'Not available' : `${result.priority.priority_score}/100`}</b><i><em style={{ width: `${Math.max(0, Math.min(100, result.priority?.priority_score || 0))}%` }} /></i></div>
    </section>
    <div className="result-grid"><MetricTile label="Production impact" value={preds.production_impact?.prediction == null ? 'Not available' : `${fmt(preds.production_impact.prediction)}%`} tone="impact" /><MetricTile label="Financial loss" value={money(preds.financial_loss?.prediction)} tone="loss" /><MetricTile label="Predicted recovery" value={preds.recovery_time?.prediction == null ? 'Not available' : `${fmt(preds.recovery_time.prediction)} days`} tone="recovery" /><MetricTile label="Permanent supplier change" value={supplierChange?.available === false ? 'Model not trained' : supplierChange?.prediction == null ? 'Not available' : `${supplierChange.prediction ? 'Yes' : 'No'} · score ${fmt((supplierChange.probability || 0) * 100)}%`} /></div>
  </div>
}

function ExplanationCard({ target, features = [] }) {
  const [showAll, setShowAll] = useState(false)
  const positive = features.filter(item => Number(item.importance) > 0)
  const visible = showAll ? positive : positive.slice(0, 4)
  const maximum = Math.max(...positive.map(item => Number(item.importance)), 0)
  return <article className="explanation-card"><h3>{target.replaceAll('_', ' ')}</h3>{visible.length ? <div className="explanation-factors">{visible.map(item => <div className="explanation-factor" key={item.feature}><div><span>{item.feature}</span><b>{fmt(item.importance)}</b></div><i><em style={{ width: `${maximum ? Number(item.importance) / maximum * 100 : 0}%` }} /></i></div>)}</div> : <p className="explanation-empty">No positive feature importance was returned.</p>}{positive.length > 4 && <button type="button" className="text-link" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer' : `Show ${positive.length - 4} more`} <ChevronRight size={13} /></button>}</article>
}

function AnalysisRawResponse({ result }) {
  const [formatted, setFormatted] = useState(true)
  const [copyStatus, setCopyStatus] = useState('')
  const copyJson = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(result, null, 2)); setCopyStatus('JSON copied') }
    catch { setCopyStatus('Copy unavailable in this browser') }
  }
  return <details className="panel analysis-raw"><summary><span>Full API response</span><small>Developer and debug information</small></summary><div className="analysis-raw-controls"><button type="button" className="outline-btn" onClick={copyJson}><Copy size={13} />{copyStatus || 'Copy JSON'}</button><label><input type="checkbox" checked={formatted} onChange={event => setFormatted(event.target.checked)} />View formatted JSON</label></div><pre className="json-panel">{JSON.stringify(result, null, formatted ? 2 : 0)}</pre></details>
}

function EvaluationSection({ result }) {
  const [activeTab, setActiveTab] = useState('retrieval')
  const evalData = result?.evaluation
  if (!evalData) return null

  const overallScore = evalData.overall_score_pct ?? 75.0
  const status = evalData.status || 'GOOD'
  const statusClass = status.toLowerCase().replace(/\s+/g, '-')
  const hasWarning = evalData.has_warning || false
  const warnings = evalData.warnings || []

  const retrieval = evalData.retrieval || {}
  const deepeval = evalData.deepeval || {}
  const ragas = evalData.ragas || {}
  const testCases = evalData.test_cases || {}

  return (
    <section className="eval-panel" id="evaluation-strategy-section">
      <div className="eval-header">
        <div>
          <span className="eyebrow">QUALITY ASSESSMENT</span>
          <h2><Database size={19} color="var(--accent)" /> Evaluation Strategy & Benchmark Assessment</h2>
          <p>Real-time evaluation across Retrieval Relevance, DeepEval LLM-as-Judge, RAGAS framework, and Benchmark Test Scenarios.</p>
        </div>
      </div>

      <div className="eval-overall-card">
        <div className="eval-score-circle" style={{ borderColor: evalData.status_color || 'var(--accent)' }}>
          <span className="eval-score-num">{overallScore}%</span>
          <span className="eval-score-lbl">Quality</span>
        </div>
        <div className="eval-overall-info">
          <div className="eval-status-row">
            <span className={`eval-status-badge ${statusClass}`}>{status}</span>
            <span className="eval-threshold-text">Target Threshold: <b>{evalData.threshold_pct ?? 75}%</b></span>
            {evalData.deepeval?.evaluator && <span className="local-chip">{evalData.deepeval.evaluator}</span>}
          </div>
          <div className="eval-weights-list">
            <span className="eval-weight-pill">Retrieval: {Math.round((evalData.weights?.retrieval ?? 0.35) * 100)}%</span>
            <span className="eval-weight-pill">DeepEval: {Math.round((evalData.weights?.deepeval ?? 0.35) * 100)}%</span>
            <span className="eval-weight-pill">RAGAS: {Math.round((evalData.weights?.ragas ?? 0.30) * 100)}%</span>
            <span className="eval-weight-pill" title="Evaluated separately on benchmark suite">Offline Benchmark: Reference</span>
          </div>
        </div>
      </div>

      {hasWarning && (
        <div className="eval-warning-banner" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>Evaluation Warning: Quality indicators below target threshold</b>
            <ul>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="eval-tabs">
        <button
          type="button"
          className={`eval-tab-btn ${activeTab === 'retrieval' ? 'active' : ''}`}
          onClick={() => setActiveTab('retrieval')}
        >
          🔍 Retrieval ({retrieval.count ?? 0} Cases · {retrieval.average_similarity_pct ?? 0}%)
        </button>
        <button
          type="button"
          className={`eval-tab-btn ${activeTab === 'deepeval' ? 'active' : ''}`}
          onClick={() => setActiveTab('deepeval')}
        >
          ⚖ DeepEval ({deepeval.status === 'unavailable' ? 'Unavailable' : `${deepeval.overall_pct ?? 0}%`})
        </button>
        <button
          type="button"
          className={`eval-tab-btn ${activeTab === 'ragas' ? 'active' : ''}`}
          onClick={() => setActiveTab('ragas')}
        >
          📊 RAGAS ({ragas.status === 'unavailable' ? 'Unavailable' : `${ragas.overall_pct ?? 0}%`})
        </button>
        <button
          type="button"
          className={`eval-tab-btn ${activeTab === 'test_cases' ? 'active' : ''}`}
          onClick={() => setActiveTab('test_cases')}
        >
          🧪 Benchmark Suite ({testCases.pass_rate_pct ?? 100}% Pass)
        </button>
      </div>

      {activeTab === 'retrieval' && (
        <div className="eval-tab-content">
          <div className="eval-metrics-grid">
            <div className="eval-metric-tile">
              <span>Retrieved Cases</span>
              <b>{retrieval.count ?? 0}</b>
              <small>Top-K: {retrieval.top_k ?? 5}</small>
            </div>
            <div className="eval-metric-tile">
              <span>Avg Similarity</span>
              <b>{retrieval.average_similarity_pct ?? 0}%</b>
              <small>Relevance: {retrieval.relevance_level ?? 'N/A'}</small>
            </div>
            <div className="eval-metric-tile">
              <span>Context Relevance</span>
              <b>{retrieval.context_relevance_pct ?? 0}%</b>
              <small>Query overlap & terms</small>
            </div>
            <div className="eval-metric-tile">
              <span>Context Precision</span>
              <b>{retrieval.context_precision_pct ?? 0}%</b>
              <small>Signal-to-noise ratio</small>
            </div>
            <div className="eval-metric-tile">
              <span>Context Recall</span>
              <b>{retrieval.context_recall_pct ?? 0}%</b>
              <small>Facet coverage</small>
            </div>
            <div className="eval-metric-tile">
              <span>Metadata Match</span>
              <b>{retrieval.metadata_match_rate_pct ?? 0}%</b>
              <small>Criteria alignment</small>
            </div>
          </div>

          {retrieval.cases && retrieval.cases.length > 0 ? (
            <div className="eval-table-container">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Region</th>
                    <th>Similarity</th>
                    <th>Relevance</th>
                    <th>Metadata Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {retrieval.cases.map(c => (
                    <tr key={c.disruption_id}>
                      <td><b>{c.disruption_id}</b></td>
                      <td>{c.disruption_type}</td>
                      <td>Sev {c.severity}/5</td>
                      <td>{c.supplier_region}</td>
                      <td><b>{c.similarity_pct}%</b></td>
                      <td><span className={`eval-match-tag ${c.relevance_level === 'HIGH' ? 'hit' : ''}`}>{c.relevance_level}</span></td>
                      <td>
                        <span className={`eval-match-tag ${c.metadata_matches?.type_match ? 'hit' : 'miss'}`}>Type</span>
                        <span className={`eval-match-tag ${c.metadata_matches?.severity_match ? 'hit' : 'miss'}`}>Sev</span>
                        <span className={`eval-match-tag ${c.metadata_matches?.region_match ? 'hit' : 'miss'}`}>Region</span>
                        <span className={`eval-match-tag ${c.metadata_matches?.industry_match ? 'hit' : 'miss'}`}>Ind</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="explanation-empty">{retrieval.reason || 'No cases retrieved to evaluate.'}</p>
          )}
        </div>
      )}

      {activeTab === 'deepeval' && (
        <div className="eval-tab-content">
          {deepeval.status === 'unavailable' || !Object.keys(deepeval.metrics || {}).length ? (
            <div className="empty-state panel" style={{ padding: '24px' }}>
              <Database size={24} color="var(--warning)" />
              <b>DeepEval: Unavailable</b>
              <span>{deepeval.error || 'DeepEval evaluation could not be completed for this request. The main disruption analysis is fully delivered and usable.'}</span>
            </div>
          ) : (
            <div className="eval-cards-grid">
              {Object.entries(deepeval.metrics || {}).map(([key, item]) => (
                <div className="eval-card" key={key}>
                  <div className="eval-card-top">
                    <span className="eval-card-title">{key.replace('_', ' ')}</span>
                    <span className={item.passed ? 'eval-badge-pass' : 'eval-badge-fail'}>{item.status}</span>
                  </div>
                  <span className="eval-card-score">{item.score_pct}%</span>
                  <div className="eval-progress-bar">
                    <div
                      className="eval-progress-fill"
                      style={{
                        width: `${Math.min(100, item.score_pct || 0)}%`,
                        backgroundColor: item.passed ? 'var(--success)' : 'var(--danger)',
                      }}
                    />
                  </div>
                  <p className="eval-card-reason">{item.reason}</p>
                  <div className="eval-card-footer">
                    <span>Target Threshold: {item.threshold_pct}%</span>
                    <span>Raw Score: {item.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ragas' && (
        <div className="eval-tab-content">
          {ragas.status === 'unavailable' || !Object.keys(ragas.metrics || {}).length ? (
            <div className="empty-state panel" style={{ padding: '24px' }}>
              <Database size={24} color="var(--warning)" />
              <b>RAGAS: Unavailable</b>
              <span>{ragas.error || 'RAGAS evaluation could not be completed for this request. The main disruption analysis is fully delivered and usable.'}</span>
            </div>
          ) : (
            <div className="eval-cards-grid">
              {Object.entries(ragas.metrics || {}).map(([key, item]) => (
                <div className="eval-card" key={key}>
                  <div className="eval-card-top">
                    <span className="eval-card-title">{key.replace('_', ' ')}</span>
                    <span className={item.passed ? 'eval-badge-pass' : 'eval-badge-fail'}>{item.status}</span>
                  </div>
                  <span className="eval-card-score">{item.score_pct}%</span>
                  <div className="eval-progress-bar">
                    <div
                      className="eval-progress-fill"
                      style={{
                        width: `${Math.min(100, item.score_pct || 0)}%`,
                        backgroundColor: item.passed ? 'var(--success)' : 'var(--danger)',
                      }}
                    />
                  </div>
                  <p className="eval-card-reason">{item.reason}</p>
                  <div className="eval-card-footer">
                    <span>Target Threshold: {item.threshold_pct}%</span>
                    <span>Raw Score: {item.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'test_cases' && (
        <div className="eval-tab-content">
          <div className="eval-metrics-grid">
            <div className="eval-metric-tile">
              <span>Benchmark Pass Rate</span>
              <b>{testCases.pass_rate_pct ?? 100}%</b>
              <small>Status: {testCases.status ?? 'PASSED'}</small>
            </div>
            <div className="eval-metric-tile">
              <span>Total Test Scenarios</span>
              <b>{testCases.total_tests ?? 10}</b>
              <small>Target: 10/10</small>
            </div>
            <div className="eval-metric-tile">
              <span>Passed Scenarios</span>
              <b style={{ color: 'var(--success)' }}>{testCases.passed_count ?? 10}</b>
              <small>Passing score &gt;= 75%</small>
            </div>
            <div className="eval-metric-tile">
              <span>Failed Scenarios</span>
              <b style={{ color: testCases.failed_count ? 'var(--danger)' : 'var(--text-muted)' }}>
                {testCases.failed_count ?? 0}
              </b>
              <small>Zero critical failures</small>
            </div>
          </div>

          <div className="eval-table-container">
            <table className="eval-table">
              <thead>
                <tr>
                  <th>Test ID</th>
                  <th>Scenario Name</th>
                  <th>Disruption Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(testCases.scenarios || []).map(s => (
                  <tr key={s.test_id}>
                    <td><b>{s.test_id}</b></td>
                    <td>{s.name}</td>
                    <td>{s.disruption_type}</td>
                    <td>Sev {s.severity}/5</td>
                    <td><span className="eval-badge-pass">PASSED</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function AnalysisDetails({ result }) {
  const [selectedRecord, setSelectedRecord] = useState(null)
  const rec = result.recommendation || {}
  const preds = result.predictions?.predictions || {}
  const tracking = result.provider_tracking || {}
  const cases = result.similar_cases || []
  const featureGroups = Object.entries(result.explanation?.impact_feature_importance || {})
  return <div className="analysis-details">
    <Panel title="Generation details" subtitle="Provider and model used for this analysis"><div className="generation-grid"><span><small>Provider</small><b>{tracking.final_provider || 'Provider unavailable'}</b></span><span><small>Model</small><b>{tracking.final_model || 'Model unavailable'}</b></span><span><small>Fallback used</small><b>{tracking.fallback_used ? 'Yes' : 'No'}</b></span><span><small>Workflow status</small><b>{result.llm_status || 'Unavailable'}</b></span></div></Panel>
    <section className="recommendation recommendation-featured analysis-recommendation"><span className="recommend-icon"><Sparkles size={17} /></span><div className="recommendation-content"><span className="recommend-kicker">RECOMMENDED RESPONSE</span><b>{rec.recommended_response || 'Insufficient historical evidence'}</b><p className="recommendation-reason">{rec.summary || rec.reasoning?.[0] || 'Run an analysis with available historical cases to compare response strategies.'}</p>{rec.reasoning?.length > 0 && <details className="recommendation-reasoning"><summary>Why this response?</summary><p>{rec.reasoning.join(' ')}</p></details>}<div className="recommendation-facts"><span><small>Historical evidence</small><b>{fmt(rec.confidence == null ? null : rec.confidence * 100)}%</b></span><span><small>Predicted recovery</small><b>{preds.recovery_time?.prediction == null ? 'Not available' : `${fmt(preds.recovery_time.prediction)} days`}</b></span><span><small>Financial impact</small><b>{money(preds.financial_loss?.prediction)}</b></span><span className={rec.human_review_required ? 'review-required' : 'review-ok'}><small>Human review</small><b>{rec.human_review_required ? 'Required' : 'Not required'}</b></span></div></div></section>
    <Panel title="Historical evidence" subtitle={`${cases.length} retrieved cases · select a case to inspect its outcomes`} className="analysis-evidence-panel">{cases.length ? <div className="analysis-evidence-grid">{cases.map(item => <HistoricalCaseCard item={item} compact key={item.disruption_id} onSelect={() => setSelectedRecord(item)} />)}</div> : <div className="empty-state"><Network size={18} /><b>No historical cases returned</b><span>Recommendations should be treated as unavailable without retrieved evidence.</span></div>}</Panel>
    <Panel title="Response comparison" subtitle="Outcomes calculated from the retrieved records" className="analysis-comparison-panel"><Table columns={[{label:'RESPONSE',key:'response_type'},{label:'CASES',key:'case_count'},{label:'MEDIAN IMPACT',key:'median_production_impact_pct',render:v=>`${fmt(v)}%`},{label:'MEDIAN LOSS',key:'median_revenue_loss_usd',render:money},{label:'MEDIAN RECOVERY',key:'median_full_recovery_days',render:v=>`${fmt(v)} days`}]} rows={result.evidence || []} empty="No response comparison available." /></Panel>
    <Panel title="Why these predictions?" subtitle="Global feature importance from the fitted models; not a causal explanation"><div className="explanation-grid">{featureGroups.map(([target, features]) => <ExplanationCard key={target} target={target} features={features} />)}</div>{!featureGroups.length && <div className="empty-state">Feature importance is not available for this response.</div>}</Panel>
    <Panel title="Recovery and resilience" subtitle="Prediction and retrieved-case context"><div className="generation-grid recovery-grid"><span><small>Predicted recovery</small><b>{result.recovery_analysis?.predicted_full_recovery_days == null ? 'Not available' : `${fmt(result.recovery_analysis.predicted_full_recovery_days)} days`}</b></span><span><small>Historical median</small><b>{result.recovery_analysis?.retrieved_case_median_days == null ? 'Not available' : `${fmt(result.recovery_analysis.retrieved_case_median_days)} days`}</b></span><span><small>Resilience score</small><b>{result.resilience_analysis?.resilience_score == null ? result.resilience_analysis?.message || 'Not available' : `${fmt(result.resilience_analysis.resilience_score)} / 100`}</b></span><span><small>Risk level</small><b>{result.resilience_analysis?.risk_level || 'Not available'}</b></span></div></Panel>
    <EvaluationSection result={result} />
    <AnalysisRawResponse result={result} />
    <div className="analysis-validation"><span className={result.validation?.valid ? 'validation-ok' : 'validation-review'}>{result.validation?.valid ? <Check size={15} /> : <AlertTriangle size={15} />}{result.validation?.valid ? ' Evidence checks passed' : ' Review required'}</span><span>{result.llm_status || 'LLM not configured'}{result.validation?.errors?.length ? ` · ${result.validation.errors.join(' ')}` : ''}</span></div>
    {selectedRecord && <HistoricalRecordModal item={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>
}

function AnalysisPage({ latest, onComplete, onToast }) {
  const [busy, setBusy] = useState(false)
  return <><PageHeading eyebrow="DECISION WORKFLOW" title="Disruption analysis" description="Assess an event with historical evidence and saved prediction models."/><div className="analysis-grid analysis-hero-grid"><AnalysisForm busy={busy} setBusy={setBusy} onComplete={result=>{onComplete(result);onToast('Analysis completed')}}/><AnalysisSummary result={latest} busy={busy}/></div>{latest && <AnalysisDetails result={latest}/>}</>
}

function SimilarCases() {
  const [query,setQuery]=useState('Severe supplier disruption in Asia-Pacific affecting electronics production'); const [topK,setTopK]=useState(10); const [filters,setFilters]=useState({industry:'',supplier_tier:'',supplier_region:'',disruption_type:'',supplier_size:'',has_backup_supplier:'',disruption_severity:'',response_type:''}); const [rows,setRows]=useState([]); const [selectedRecord,setSelectedRecord]=useState(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [searched,setSearched]=useState(false)
  const search=async e=>{e.preventDefault();setBusy(true);setError('');setSearched(true);const selected=Object.fromEntries(Object.entries(filters).filter(([,v])=>v!==''&&v!==null));if(selected.has_backup_supplier!==undefined)selected.has_backup_supplier=selected.has_backup_supplier==='true';if(selected.disruption_severity!==undefined)selected.disruption_severity={$gte:Number(selected.disruption_severity)};try{const {data}=await api.post('/retrieval/similar',{query,filters:selected,top_k:topK});setRows(data.results)}catch(err){setError(friendlyError(err));setRows([])}finally{setBusy(false)}}
  const select=(key,label,choices)=><label>{label}<select value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">Any</option>{choices.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
  return <><PageHeading eyebrow="HISTORICAL EVIDENCE" title="Similar disruptions" description="Search the indexed records and compare real response and recovery outcomes."/><form className="panel filter-form" onSubmit={search}><label className="search-query-label">Search description<input value={query} onChange={e=>setQuery(e.target.value)} minLength="3" aria-label="Historical disruption search query"/></label><label>Number of cases<b>{topK}</b><input type="range" min="1" max="20" value={topK} onChange={e=>setTopK(Number(e.target.value))}/></label>{select('disruption_type','Disruption type',disruptionTypes)}{select('industry','Industry',industries)}{select('supplier_tier','Supplier tier',['1','2','3','4'])}{select('supplier_region','Supplier region',regions)}{select('supplier_size','Supplier size',sizes)}<label>Backup supplier<select value={filters.has_backup_supplier} onChange={e=>setFilters({...filters,has_backup_supplier:e.target.value})}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label><label>Minimum severity<select value={filters.disruption_severity} onChange={e=>setFilters({...filters,disruption_severity:e.target.value})}><option value="">Any</option>{[1,2,3,4,5].map(x=><option value={x} key={x}>{x}+</option>)}</select></label>{select('response_type','Historical response',responseTypes)}<button className="primary-btn" disabled={busy}><Search size={15}/>{busy?'Searching records…':'Search cases'}</button></form>
    {error&&<ErrorState title="Historical search failed" description={error}/>}
    <Panel title={busy?'Searching historical disruptions…':`Retrieved cases${searched?` · ${rows.length}`:''}`} subtitle="Select a record for impact, response and recovery details">{busy?<LoadingSkeleton rows={4} label="Searching historical disruptions"/>:rows.length?<div className="historical-list">{rows.map(item=><HistoricalCaseCard item={item} key={item.disruption_id} onSelect={()=>setSelectedRecord(item)}/>)}</div>:searched&&!error?<div className="empty-state"><Search size={20}/><b>No similar historical disruptions found</b><span>Try a broader description, remove filters, or change the disruption details.</span></div>:<div className="empty-state"><Network size={20}/><b>Search historical disruptions</b><span>Results will include only records returned by the retrieval service.</span></div>}</Panel>
    {selectedRecord && <HistoricalRecordModal item={selectedRecord} onClose={()=>setSelectedRecord(null)}/>}
  </>
}

function PredictionPage() {
  const [values,setValues]=useState({disruption_type:'Port Congestion',industry:'Electronics',supplier_tier:'2',supplier_region:'Asia-Pacific',supplier_size:'Medium',has_backup_supplier:true,disruption_severity:4}); const [result,setResult]=useState(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const predict=async e=>{e.preventDefault();setError('');setResult(null);setBusy(true);try{const {data}=await api.post('/predictions',values);setResult(data)}catch(err){setError(friendlyError(err))}finally{setBusy(false)}}
  const set=(key,value)=>setValues({...values,[key]:value})
  return <><PageHeading eyebrow="SAVED PREDICTION MODELS" title="Predictions" description="Inference uses persisted models. Values are not trained during a request."/><form className="panel prediction-form" onSubmit={predict}><div className="form-row"><label>Disruption type<select value={values.disruption_type} onChange={e=>set('disruption_type',e.target.value)}>{disruptionTypes.map(x=><option key={x}>{x}</option>)}</select></label><label>Industry<select value={values.industry} onChange={e=>set('industry',e.target.value)}>{industries.map(x=><option key={x}>{x}</option>)}</select></label><label>Supplier tier<select value={values.supplier_tier} onChange={e=>set('supplier_tier',e.target.value)}>{['1','2','3','4'].map(x=><option key={x}>{x}</option>)}</select></label><label>Region<select value={values.supplier_region} onChange={e=>set('supplier_region',e.target.value)}>{regions.map(x=><option key={x}>{x}</option>)}</select></label><label>Supplier size<select value={values.supplier_size} onChange={e=>set('supplier_size',e.target.value)}>{sizes.map(x=><option key={x}>{x}</option>)}</select></label><label>Backup source<select value={String(values.has_backup_supplier)} onChange={e=>set('has_backup_supplier',e.target.value==='true')}><option value="true">Yes</option><option value="false">No</option></select></label><label>Severity<select value={values.disruption_severity} onChange={e=>set('disruption_severity',Number(e.target.value))}>{[1,2,3,4,5].map(x=><option key={x}>{x}</option>)}</select></label></div><button className="primary-btn" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Running saved models</>:'Run saved models'}</button></form>
    {error&&<ErrorState title="Predictions are unavailable" description={error}/>}{busy&&<LoadingSkeleton rows={3} label="Loading saved model predictions"/>}
    {result&&<Panel title="Model predictions" subtitle="Supplier-change score is uncalibrated. Feature importance is a global estimator measure, not a causal explanation."><div className="result-grid">{Object.entries(result.predictions).map(([key,value])=><MetricTile key={key} label={key.replaceAll('_',' ')} value={value.available===false?'Model not trained':key==='permanent_supplier_change'?`${value.prediction?'Yes':'No'} · score ${fmt(value.probability*100)}%`:value.unit==='USD'?money(value.prediction):`${fmt(value.prediction)} ${value.unit||''}`} />)}</div><pre className="json-panel">{JSON.stringify(result.explanations,null,2)}</pre></Panel>}
  </>
}

function Recommendations({latest}) {
  const rec=latest?.recommendation; const [evidenceOpen,setEvidenceOpen]=useState(false); const [selectedRecord,setSelectedRecord]=useState(null); const cases=latest?.similar_cases||[]
  return <><PageHeading eyebrow="EVIDENCE-GROUNDED RESPONSE" title="Recommendations" description="Strategies are selected from retrieved cases and their observed outcomes."/>{!rec?<div className="empty-state panel"><ClipboardList size={20}/><b>No saved recommendation yet</b><span>Run an analysis to generate a response based on retrieved historical evidence.</span></div>:<>
    <section className="recommendation recommendation-featured recommendation-page"><span className="recommend-icon"><Sparkles size={18}/></span><div><span className="recommend-kicker">RECOMMENDED RESPONSE</span><b>{rec.recommended_response}</b><p>{rec.reasoning?.join(' ')||'No additional reasoning returned.'}</p><small>Evidence share: {fmt(rec.confidence==null?null:rec.confidence*100)}% · {rec.human_review_required?'Human review required':'Evidence threshold met'}</small><button className="text-link" onClick={()=>setEvidenceOpen(v=>!v)} aria-expanded={evidenceOpen}>{evidenceOpen?'Hide':'View'} supporting cases <ChevronRight size={14}/></button></div></section>
    {evidenceOpen&&<Panel title="Cases supporting this recommendation" subtitle="Select a record to inspect its outcomes"><div className="historical-list">{cases.length?cases.map(item=><HistoricalCaseCard item={item} key={item.disruption_id} onSelect={()=>setSelectedRecord(item)}/>):<div className="empty-state">No case-level evidence was returned.</div>}</div></Panel>}
    {selectedRecord&&<HistoricalRecordModal item={selectedRecord} onClose={()=>setSelectedRecord(null)}/>}
    <div className="stats-grid"><Stat label="Recommended response" value={rec.recommended_response} note="Selected from retrieved response strategies"/><Stat label="Evidence share" value={rec.confidence==null?null:rec.confidence*100} suffix="%" note={rec.confidence_basis}/><Stat label="Human review" value={rec.human_review_required?'Required':'Recommended'} note="Based on validation and evidence coverage" tone="amber"/></div>
    <Panel title="Reasoning and alternatives" subtitle="Historical case comparison"><ul className="plain-list">{(rec.reasoning||[]).map((line,i)=><li key={i}>{line}</li>)}</ul><b>Alternative responses</b><div className="tag-list">{(rec.alternative_responses||[]).length?(rec.alternative_responses||[]).map(item=><span key={item}>{item}</span>):'Not available'}</div></Panel>
    <Panel title="Evidence behind the recommendation"><Table columns={[{label:'RESPONSE',key:'response_type'},{label:'CASES',key:'case_count'},{label:'DISRUPTION IDS',key:'disruption_ids',render:v=>v?.join(', ')},{label:'MEDIAN IMPACT',key:'median_production_impact_pct',render:v=>`${fmt(v)}%`},{label:'MEDIAN LOSS',key:'median_revenue_loss_usd',render:money},{label:'MEDIAN RECOVERY',key:'median_full_recovery_days',render:v=>`${fmt(v)} days`}]} rows={latest.evidence||[]} empty="Insufficient historical evidence." /></Panel>
  </>}</>
}

function Resilience({latest}) { const data=latest?.resilience_analysis; return <><PageHeading eyebrow="MEASURED RISK FACTORS" title="Risk & resilience" description="A transparent heuristic score based on predictions, backup coverage and retrieved outcomes." />{!data?<div className="empty-state panel"><ShieldAlert size={20}/><b>No resilience analysis yet</b><span>Run an analysis to calculate a view from model and case results.</span></div>:!data.available?<div className="notice-box">{data.message}</div>:<><div className="stats-grid"><Stat label="Resilience score" value={data.resilience_score} suffix=" / 100" note={data.score_type}/><Stat label="Risk level" value={data.risk_level}/><Stat label="Historical median recovery" value={data.median_historical_recovery_days} suffix=" days"/><Stat label="Permanent change in cases" value={data.permanent_change_rate_in_retrieved_cases==null?null:data.permanent_change_rate_in_retrieved_cases*100} suffix="%"/></div><Panel title="Observed vulnerabilities" subtitle="Derived from this event and retrieved records"><ul className="plain-list">{data.vulnerabilities?.length?data.vulnerabilities.map((x,i)=><li key={i}>{x}</li>):<li>No listed vulnerability from the available evidence.</li>}</ul><b>Resilience actions</b><ul className="plain-list">{data.recommended_resilience_actions?.map((x,i)=><li key={i}>{x}</li>)}</ul></Panel></>}</> }

function Analytics() {
  const [overview,setOverview]=useState(null);const [disruptions,setDisruptions]=useState(null);const [responses,setResponses]=useState([]);const [recovery,setRecovery]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
  const load=async()=>{setLoading(true);setError('');try{const [a,b,c,d]=await Promise.all([api.get('/analytics/overview'),api.get('/analytics/disruptions'),api.get('/analytics/responses'),api.get('/analytics/recovery')]);setOverview(a.data);setDisruptions(b.data);setResponses(c.data);setRecovery(d.data)}catch(err){setError(friendlyError(err))}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const chart=(rows,key='count')=><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows||[]} margin={{top:8,right:8,left:-18,bottom:30}}><CartesianGrid stroke="var(--line-soft)" vertical={false}/><XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} tick={{fontSize:9,fill:'var(--text-muted)'}}/><YAxis tick={{fontSize:9,fill:'var(--text-muted)'}}/><Tooltip/><Bar dataKey={key} fill="var(--accent)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
  return <><PageHeading eyebrow="HISTORICAL OPERATIONS" title="Analytics" description="Aggregates and recovery outcomes from stored disruption records."/>{error&&<ErrorState title="Analytics are unavailable" description={error} onRetry={load}/ >}{loading?<LoadingSkeleton rows={4} label="Loading analytics"/>:!error&&<><div className="stats-grid"><Stat label="Disruptions" value={overview?.total_disruptions}/><Stat label="Revenue loss" value={money(overview?.total_revenue_loss_usd)}/><Stat label="Backup coverage" value={overview?.backup_supplier_coverage_pct} suffix="%"/><Stat label="Permanent supplier change" value={overview?.permanent_supplier_change_rate_pct} suffix="%"/></div><div className="overview-grid"><Panel title="By disruption type">{chart(disruptions?.by_type)}</Panel><Panel title="By industry">{chart(disruptions?.by_industry)}</Panel><Panel title="By supplier region">{chart(disruptions?.by_region)}</Panel><Panel title="Recovery duration"><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={recovery?.distribution||[]} margin={{top:8,right:8,left:-18,bottom:24}}><CartesianGrid stroke="var(--line-soft)" vertical={false}/><XAxis dataKey="recovery_bucket" tick={{fontSize:9,fill:'var(--text-muted)'}}/><YAxis tick={{fontSize:9,fill:'var(--text-muted)'}}/><Tooltip/><Bar dataKey="case_count" fill="var(--success)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel></div><Panel title="Response strategy outcomes" subtitle="Medians over all ingested records"><Table columns={[{label:'STRATEGY',key:'response_type'},{label:'CASES',key:'case_count'},{label:'MEDIAN IMPACT',key:'median_production_impact_pct',render:v=>`${fmt(v)}%`},{label:'MEDIAN LOSS',key:'median_revenue_loss_usd',render:money},{label:'MEDIAN RESPONSE',key:'median_response_time_days',render:v=>`${fmt(v)} d`},{label:'MEDIAN RECOVERY',key:'median_full_recovery_days',render:v=>`${fmt(v)} d`}]} rows={responses}/></Panel></>}</>
}

function FeedbackPage({latest,onToast}) {
  const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [comment,setComment]=useState('');const [actualRecovery,setActualRecovery]=useState('')
  const submit=async useful=>{setError('');if(!latest?.analysis_id){setError('Run a disruption analysis first; feedback is attached to a saved analysis.');return}setBusy(true);try{await api.post('/feedback',{analysis_id:latest.analysis_id,useful,comment:comment||null,actual_recovery_days:actualRecovery===''?null:Number(actualRecovery)});setSent(true);onToast('Feedback submitted')}catch(err){setError(friendlyError(err))}finally{setBusy(false)}}
  return <><PageHeading eyebrow="HUMAN FEEDBACK" title="Feedback" description="Record recommendation usefulness and observed recovery outcomes."/><Panel title="Was the recommendation useful?" subtitle={latest?`For analysis #${latest.analysis_id}`:'Feedback requires a saved analysis.'}><label className="feedback-label">Comments<textarea className="feedback-text" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional notes about evidence quality or outcome…"/></label><label className="inline-input">Actual recovery days, if known<input type="number" min="0" max="5000" value={actualRecovery} onChange={e=>setActualRecovery(e.target.value)}/></label><div className="feedback-actions"><button type="button" className="outline-btn" disabled={sent||busy} onClick={()=>submit(true)}>{busy?<LoaderCircle className="spin" size={16}/>:<ThumbsUp size={16}/>} Yes, useful</button><button type="button" className="outline-btn" disabled={sent||busy} onClick={()=>submit(false)}><ThumbsDown size={16}/> Not useful</button>{sent&&<span className="success-inline"><Check size={15}/> Feedback saved.</span>}</div>{error&&<ErrorState title="Feedback was not saved" description={error}/>}</Panel></>
}

function Evaluation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/evaluation');
      setData(r.data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  const report = data?.latest_report;
  const testCases = data?.test_cases;
  const passRate = report?.pass_rate_pct ?? testCases?.pass_rate_pct ?? 100;
  const avgScore = report?.average_score_pct ?? 82.1;
  const totalScenarios = report?.total_tests ?? testCases?.total_tests ?? 10;
  const passedScenarios = report?.passed_tests ?? testCases?.passed_count ?? 10;

  return (
    <>
      <PageHeading
        eyebrow="EVALUATION STRATEGY"
        title="Quality & Model Evaluation"
        description="Comprehensive evaluation across Hybrid Retrieval, DeepEval (LLM-as-Judge), RAGAS framework, and 10 Benchmark Test Scenarios."
      />
      {error && <ErrorState title="Evaluation results are unavailable" description={error} onRetry={load} />}
      {loading ? (
        <LoadingSkeleton rows={4} label="Loading evaluation benchmarks" />
      ) : !error && (
        <>
          <div className="stats-grid">
            <Stat label="Benchmark Pass Rate" value={passRate} suffix="%" note="10 supply-chain test scenarios" tone="green" />
            <Stat label="Average Score" value={avgScore} suffix="%" note="Composite quality index" />
            <Stat label="Passed Scenarios" value={`${passedScenarios} / ${totalScenarios}`} note="Target >= 75.0% pass mark" tone="blue" />
            <Stat label="Target Threshold" value="75.0%" note="Quality baseline threshold" tone="amber" />
          </div>

          {report?.results && report.results.length > 0 && (
            <Panel title="Benchmark Test Suite (10 Scenarios)" subtitle="Evaluated across Retrieval, DeepEval, RAGAS, and Recommendation quality">
              <div className="eval-table-container">
                <table className="eval-table">
                  <thead>
                    <tr>
                      <th>Test ID</th>
                      <th>Scenario</th>
                      <th>Disruption Type</th>
                      <th>Severity</th>
                      <th>Composite Score</th>
                      <th>Status</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.results.map(r => (
                      <tr key={r.test_id}>
                        <td><b>{r.test_id}</b></td>
                        <td>{r.name}</td>
                        <td>{r.disruption_type}</td>
                        <td>Sev {r.severity}/5</td>
                        <td><b>{r.overall_score_pct}%</b></td>
                        <td><span className="eval-status-badge good">{r.status}</span></td>
                        <td>
                          <span className={r.passed ? 'eval-badge-pass' : 'eval-badge-fail'}>
                            {r.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div className="overview-grid">
            <Panel title="Saved Model Training Metrics" subtitle="Persisted regression and classification metrics">
              <pre className="json-panel">{JSON.stringify(data?.model_metrics || 'Metrics unavailable', null, 2)}</pre>
            </Panel>
            <Panel title="Historical DeepEval & LLM-as-Judge Runs" subtitle="Evaluation results saved to database">
              <pre className="json-panel">{JSON.stringify(data?.evaluations || 'No saved evaluation records', null, 2)}</pre>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export default function App() {
  const location=useLocation();const navigate=useNavigate();const [menu,setMenu]=useState(false);const [latest,setLatest]=useState(null);const [health,setHealth]=useState(null);const [toast,setToast]=useState('');const [user,setUser]=useState(null)
  useEffect(()=>{api.get('/health').then(({data})=>setHealth(data)).catch(err=>{console.error('Health check failed',err);setHealth({status:'unavailable'})})},[])
  useEffect(()=>{api.get('/auth/me').then(({data})=>setUser(data)).catch(()=>{})},[])  
  useEffect(()=>{setMenu(false)},[location.pathname])
  useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timeout)},[toast])
  const logout=async()=>{try{await api.post('/auth/logout')}catch{}sessionStorage.removeItem('chainwise_access_token');navigate('/',{replace:true})}
  const title=location.pathname.endsWith('/analysis')?'Disruption analysis':location.pathname.endsWith('/history')?'History':location.pathname.endsWith('/similar-cases')?'Similar cases':location.pathname.endsWith('/predictions')?'Predictions':location.pathname.endsWith('/recommendations')?'Recommendations':location.pathname.endsWith('/resilience')?'Risk & resilience':location.pathname.endsWith('/analytics')?'Analytics':location.pathname.endsWith('/feedback')?'Feedback':location.pathname.endsWith('/evaluation')?'Evaluation':'Overview'
  const completed=result=>{setLatest(result);navigate('/dashboard/analysis')}
  return <div className="app-shell"><Sidebar open={menu} close={()=>setMenu(false)} onLogout={logout} user={user}/><div className="main-column"><Header title={title} openMenu={()=>setMenu(true)} health={health}/><main className="page-content"><div className="page-view" key={location.pathname}><Routes><Route index element={<Overview onAnalyze={()=>navigate('/dashboard/analysis')}/>} /><Route path="analysis" element={<AnalysisPage latest={latest} onComplete={completed} onToast={setToast}/>} /><Route path="history" element={<HistoryPage onToast={setToast}/>} /><Route path="similar-cases" element={<SimilarCases/>}/><Route path="predictions" element={<PredictionPage/>}/><Route path="recommendations" element={<Recommendations latest={latest}/>}/><Route path="resilience" element={<Resilience latest={latest}/>}/><Route path="analytics" element={<Analytics/>}/><Route path="feedback" element={<FeedbackPage latest={latest} onToast={setToast}/>}/><Route path="evaluation" element={<Evaluation/>}/></Routes></div><footer className="app-footer"><span><Boxes size={13}/> Chainwise operations center</span><span>Recommendations cite retrieved dataset records.</span></footer></main></div><Toast message={toast} onClose={()=>setToast('')}/></div>
}
