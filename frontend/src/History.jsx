import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Eye, Search, Trash2, X } from 'lucide-react'
import api from './api'
import { ErrorState, LoadingSkeleton } from './ui'

const PAGE_SIZE = 10
const errorMessage = error => {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(item => item.msg).filter(Boolean).join(' ')
  if (!error.response) return 'The API could not be reached. Check that the backend is running and try again.'
  return 'The request could not be completed. Please try again.'
}
const dateLabel = value => value ? new Date(value).toLocaleString() : 'Date unavailable'
const providerLabel = item => item.final_provider || 'Provider unavailable'

function HistoryStat({ label, value, note }) {
  return <article className="history-stat panel"><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</article>
}

function AnalysisDetails({ item, onClose }) {
  const response = item.response || {}
  const attempts = item.provider_attempts || []
  return <section className="panel history-detail" aria-labelledby="history-detail-title">
    <div className="panel-header"><div><h2 id="history-detail-title">Analysis details</h2><p>{item.query}</p></div><button className="outline-btn" onClick={onClose}><X size={15}/> Close</button></div>
    <div className="history-detail-grid">
      <span><small>Provider</small><b>{providerLabel(item)}</b></span>
      <span><small>Model</small><b>{item.final_model || 'Unavailable'}</b></span>
      <span><small>Fallback used</small><b>{item.fallback_used ? 'Yes' : 'No'}</b></span>
      <span><small>Response time</small><b>{item.response_time_ms == null ? 'Unavailable' : `${(item.response_time_ms / 1000).toFixed(2)} seconds`}</b></span>
      <span><small>Created</small><b>{dateLabel(item.created_at)}</b></span>
      <span><small>Retrieved cases</small><b>{response.similar_cases?.length ?? 0}</b></span>
    </div>
    <div className="history-detail-copy"><b>Recommendation</b><p>{response.recommendation?.recommended_response || 'Not available'}</p><b>Response summary</b><p>{response.recommendation?.summary || item.summary || 'Not available'}</p></div>
    {attempts.length > 0 && <div className="history-attempts"><h3>Provider attempts</h3><div className="table-scroll"><table><thead><tr><th>Provider</th><th>Model</th><th>Status</th></tr></thead><tbody>{attempts.map((attempt, index) => <tr key={`${attempt.provider}-${index}`}><td>{attempt.provider}</td><td>{attempt.model}</td><td>{attempt.status}</td></tr>)}</tbody></table></div></div>}
    <details className="history-json"><summary>Full analysis response</summary><pre className="json-panel">{JSON.stringify(response, null, 2)}</pre></details>
  </section>
}

export default function HistoryPage({ onToast }) {
  const [stats, setStats] = useState(null)
  const [facets, setFacets] = useState({})
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filters, setFilters] = useState({ date: 'All time', provider: 'All', model: 'All', severity: 'All', disruption_type: 'All', industry: 'All', supplier_region: 'All', search: '', date_from: '', date_to: '' })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.get('/history/stats'), api.get('/history/filters')]).then(([statsResponse, facetsResponse]) => {
      if (!active) return
      setStats(statsResponse.data)
      setFacets(facetsResponse.data)
    }).catch(err => { if (active) setError(errorMessage(err)) })
    return () => { active = false }
  }, [refresh])

  const params = useMemo(() => {
    const result = { page, page_size: PAGE_SIZE }
    const datePresets = { Today: 'today', 'Last 7 days': 'last_7_days', 'Last 30 days': 'last_30_days', 'Custom range': 'custom' }
    if (datePresets[filters.date]) result.date_preset = datePresets[filters.date]
    if (filters.date === 'Custom range') {
      if (filters.date_from) result.date_from = filters.date_from
      if (filters.date_to) result.date_to = filters.date_to
    }
    for (const key of ['provider', 'model', 'disruption_type', 'industry', 'supplier_region']) {
      if (filters[key] !== 'All') result[key] = filters[key]
    }
    if (filters.severity !== 'All') result.severity = Number(filters.severity)
    if (filters.search.trim()) result.search = filters.search.trim()
    return result
  }, [filters, page])

  useEffect(() => {
    if (filters.date === 'Custom range' && (!filters.date_from || !filters.date_to || filters.date_from > filters.date_to)) {
      setFilterError('Choose a valid start and end date to filter your history.')
      setItems([])
      setTotal(0)
      setTotalPages(0)
      setLoading(false)
      return
    }
    setFilterError('')
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.get('/history', { params, signal: controller.signal }).then(({ data }) => {
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 0)
    }).catch(err => {
      if (err.code !== 'ERR_CANCELED') setError(errorMessage(err))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [params, refresh, filters.date, filters.date_from, filters.date_to])

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }))
    setPage(1)
    setDetail(null)
  }
  const clearFilters = () => {
    setFilters({ date: 'All time', provider: 'All', model: 'All', severity: 'All', disruption_type: 'All', industry: 'All', supplier_region: 'All', search: '', date_from: '', date_to: '' })
    setPage(1)
    setDetail(null)
  }
  const openDetail = async id => {
    setError('')
    try { const { data } = await api.get(`/history/${id}`); setDetail(data) }
    catch (err) { setError(errorMessage(err)) }
  }
  const deleteItem = async id => {
    if (!window.confirm('Delete this analysis from your history?')) return
    setError('')
    try {
      await api.delete(`/history/${id}`)
      if (detail?.id === id) setDetail(null)
      setRefresh(value => value + 1)
      onToast?.('Analysis deleted from your history')
    } catch (err) { setError(errorMessage(err)) }
  }
  const clearHistory = async () => {
    setError('')
    try {
      const { data } = await api.delete('/history')
      setConfirmClear(false)
      setDetail(null)
      setPage(1)
      setRefresh(value => value + 1)
      onToast?.(`Deleted ${data.deleted} history item${data.deleted === 1 ? '' : 's'}`)
    } catch (err) { setError(errorMessage(err)) }
  }
  const providerCounts = stats?.provider_counts || {}
  const selectFilter = (key, label, values = []) => <label key={key}>{label}<select value={filters[key]} onChange={event => updateFilter(key, event.target.value)}><option>All</option>{values.map(value => <option key={value}>{value}</option>)}</select></label>

  return <>
    <div className="page-heading"><div><div className="eyebrow">PRIVATE ACTIVITY</div><h1>Analysis history</h1><p>Review, filter and manage analyses saved to your account.</p></div></div>
    {error && <ErrorState title="History could not be loaded" description={error} onRetry={() => setRefresh(value => value + 1)} />}
    {stats && <div className="history-stats-grid">
      <HistoryStat label="Total analyses" value={stats.total_analyses} />
      <HistoryStat label="Successful requests" value={stats.successful_requests} />
      <HistoryStat label="Fallback requests" value={stats.fallback_requests} />
      <HistoryStat label="Average response" value={stats.average_response_time_ms == null ? '—' : `${(stats.average_response_time_ms / 1000).toFixed(2)}s`} />
      {Object.entries(providerCounts).map(([provider, count]) => <HistoryStat key={provider} label={provider} value={count} note="Final response provider" />)}
    </div>}

    <section className="panel history-filters-panel">
      <div className="panel-header"><div><h2>Filter history</h2><p>Filters and provider options apply only to your account.</p></div><button type="button" className="outline-btn" onClick={clearFilters}>Reset</button></div>
      <div className="history-filter-grid">
        <label>Date<select value={filters.date} onChange={event => updateFilter('date', event.target.value)}>{['All time', 'Today', 'Last 7 days', 'Last 30 days', 'Custom range'].map(option => <option key={option}>{option}</option>)}</select></label>
        {selectFilter('provider', 'Provider', facets.providers)}
        {selectFilter('model', 'Model', facets.models)}
        <label>Severity<select value={filters.severity} onChange={event => updateFilter('severity', event.target.value)}><option>All</option>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label>
        {selectFilter('disruption_type', 'Disruption type', facets.disruption_types)}
        {selectFilter('industry', 'Industry', facets.industries)}
        {selectFilter('supplier_region', 'Supplier region', facets.supplier_regions)}
        <label className="history-search"><span>Search</span><span className="history-search-input"><Search size={15}/><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Query, response, type…" /></span></label>
        {filters.date === 'Custom range' && <>
          <label>From<input type="date" value={filters.date_from} onChange={event => updateFilter('date_from', event.target.value)} /></label>
          <label>To<input type="date" value={filters.date_to} onChange={event => updateFilter('date_to', event.target.value)} /></label>
        </>}
      </div>
      {filterError && <p className="history-filter-error" role="alert">{filterError}</p>}
    </section>

    <section className="panel history-list-panel">
      <div className="panel-header"><div><h2>Your analyses</h2><p>{total} matching analysis{total === 1 ? '' : 'es'}</p></div><button className="outline-btn danger-outline" disabled={total === 0} onClick={() => setConfirmClear(true)}><Trash2 size={14}/> Clear my history</button></div>
      {confirmClear && <div className="history-confirm" role="alertdialog" aria-label="Confirm clear history"><span>This permanently removes all analyses from your account history.</span><div><button className="outline-btn" onClick={() => setConfirmClear(false)}>Cancel</button><button className="primary-btn danger-button" onClick={clearHistory}>Confirm clear history</button></div></div>}
      {loading ? <LoadingSkeleton rows={3} label="Loading your analysis history" /> : filterError ? null : error ? null : items.length ? <div className="history-record-list">{items.map(item => <article className="history-record" key={item.id}>
        <div className="history-record-heading"><div><span className="history-record-date"><CalendarDays size={13}/>{dateLabel(item.created_at)}</span><h3>{item.query}</h3></div><span className="history-provider-chip">{providerLabel(item)}</span></div>
        <p className="history-record-summary">{item.summary || 'Analysis completed.'}</p>
        <div className="history-record-meta"><span><b>Model</b> {item.final_model}</span><span><b>Severity</b> {item.severity}/5</span><span><b>Industry</b> {item.industry}</span><span><b>Region</b> {item.supplier_region}</span><span><b>Response</b> {item.recommended_response || 'Not available'}</span><span><Clock3 size={13}/> {item.response_time_ms == null ? 'Unavailable' : `${(item.response_time_ms / 1000).toFixed(2)}s`}</span><span><b>Fallback</b> {item.fallback_used ? 'Yes' : 'No'}</span></div>
        <div className="history-record-actions"><button className="outline-btn" onClick={() => openDetail(item.id)}><Eye size={14}/> View details</button><button className="outline-btn danger-outline" onClick={() => deleteItem(item.id)}><Trash2 size={14}/> Delete</button></div>
      </article>)}</div> : <div className="empty-state"><CalendarDays size={20}/><b>No matching analyses</b><span>Analyses you run will appear here with provider, model and fallback details.</span></div>}
      {!loading && total > 0 && <div className="history-pagination"><button className="outline-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15}/> Previous</button><span>Page {page} of {Math.max(1, totalPages)}</span><button className="outline-btn" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next <ChevronRight size={15}/></button></div>}
    </section>
    {detail && <AnalysisDetails item={detail} onClose={() => setDetail(null)} />}
  </>
}
