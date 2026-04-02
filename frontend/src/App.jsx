import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Webcam from 'react-webcam';
import { useDropzone } from 'react-dropzone';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import {
  Cpu, Upload, Camera, History, BarChart2, FileText, AlertTriangle,
  CheckCircle2, XCircle, Zap, Eye, Layers, Download, RefreshCw,
  Volume2, ChevronRight, Activity, Shield, Sun, Moon, Filter,
  ZoomIn, ZoomOut, Maximize2, Grid, List, Search, Trash2,
  TrendingUp, Award, Info, ArrowLeft, ArrowRight, SplitSquareVertical,
  Brain, Cpu as CpuIcon, GitBranch, BarChart3
} from 'lucide-react';
import './index.css';

const API = 'http://localhost:8000';

// ─── THEME CONTEXT ───────────────────────────────────────────────────────────
const ThemeCtx = createContext({ dark: true, toggle: () => { } });

// ─── SEVERITY HELPERS ────────────────────────────────────────────────────────
const SEV = {
  Critical: { cls: 'badge-critical', color: '#ff4d6d', icon: '🔴' },
  Major: { cls: 'badge-major', color: '#ff8c00', icon: '🟠' },
  Minor: { cls: 'badge-minor', color: '#ffd60a', icon: '🟡' },
  None: { cls: 'badge-ok', color: '#00d4aa', icon: '🟢' },
};

// ─── CUSTOM CONFIRM MODAL ────────────────────────────────────────────────────
function ConfirmModal({ title, message, icon = '⚠️', confirmLabel = 'Confirm',
  confirmColor = 'var(--accent-red)', onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, marginBottom: 8 }}>{title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} className="btn btn-outline"
            style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button onClick={onConfirm} className="btn"
            style={{ flex: 1, justifyContent: 'center', background: confirmColor, color: 'white' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── AI ANALYSIS PANEL (Gemini) ──────────────────────────────────────────────
function GeminiPanel({ defects, scanId, imageB64 }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');
  const [revealed, setRevealed] = useState('');
  const [open, setOpen] = useState(false);

  async function runAnalysis() {
    setLoading(true); setOpen(true); setAnalysis(null); setRevealed('');
    try {
      const { data } = await axios.post(`${API}/api/analytics/gemini-analysis`, {
        scan_id: scanId || null,
        defects: defects || [],
        image_b64: imageB64 || null,
      });
      setAnalysis(data.analysis);
      setSource(data.source);
      let i = 0;
      const interval = setInterval(() => {
        i += 6;
        setRevealed(data.analysis.slice(0, i));
        if (i >= data.analysis.length) clearInterval(interval);
      }, 12);
    } catch { setAnalysis('AI analysis unavailable. Check backend.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="card slide-up" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>🧠</div>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: 0 }}>AI Expert Analysis</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Gemini-powered PCB quality engineering report</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={runAnalysis} disabled={loading} style={{ gap: 6, minWidth: 140 }}>
          {loading
            ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Analyzing…</>
            : <><span>🧠</span> {analysis ? 'Re-analyse' : 'Generate Report'}</>}
        </button>
      </div>

      {open && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {loading && !analysis && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px', borderWidth: 3 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Consulting AI quality engineer…</p>
            </div>
          )}
          {revealed && (
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12, padding: '20px 24px',
              border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.9,
              color: 'var(--text-primary)', whiteSpace: 'pre-wrap'
            }}>
              {revealed}
              {revealed.length < (analysis?.length || 0) && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: 'var(--accent-primary)', marginLeft: 2, verticalAlign: 'middle',
                  animation: 'pulse-dot 0.7s steps(1) infinite'
                }} />
              )}
            </div>
          )}
          {analysis && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {source === 'gemini-1.5-flash' ? '🟣 Gemini AI' : '🟡 Rule-Based Engine'}
              </span>
              <button onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([analysis], { type: 'text/plain' }));
                a.download = `SpotBot_Analysis_${scanId || 'result'}.txt`; a.click();
              }} className="btn btn-outline btn-sm"><Download size={12} /> Save</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DEEP LEARNING CV TOOLKIT ──────────────────────────────────────────────────
function DLPanel({ scanId, imageB64, defects }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runDL() {
    setLoading(true); setError(null);
    try {
      const payload = {
        scan_id: scanId || null,
        image_b64: imageB64 || null,
        defects: defects || []
      };
      const resp1 = await axios.post(`${API}/api/analytics/dl-analysis`, payload);
      const resp2 = await axios.post(`${API}/api/analytics/perception`, payload);
      setData({ ...resp1.data, ...resp2.data });
    } catch (e) {
      setError('DL Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card slide-up" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: data || loading ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a8ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'white'
          }}><Brain size={16} /></div>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: 0, color: 'var(--text-primary)' }}>Deep Learning CV Toolkit</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Grad-CAM XAI • Autoencoder • Siamese Networks</p>
          </div>
        </div>
        <button className="btn btn-sm" onClick={runDL} disabled={loading} style={{ background: 'var(--accent-green)', color: '#0d0d1a', border: 'none', fontWeight: 600, minWidth: 140 }}>
          {loading ? <><div className="spinner" style={{ width: 12, height: 12, borderColor: '#0d0d1a', borderTopColor: 'transparent' }} /> Processing CNN…</> : 'Run DL Pipeline'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {data && (
        <div style={{ animation: 'fadeIn 0.4s ease', marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,212,170,0.15)', color: 'var(--accent-green)', fontWeight: 600 }}>
              {data.pytorch_active ? '✅ Deep ResNet Backbone Active' : '🟡 Simulated Tensor Fallback'}
            </span>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Embeddings Extracted: {data.siamese_embeddings ? data.siamese_embeddings.length : 0} dimensions
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start', marginTop: 16 }}>
            {/* Depth Map (SFS) */}
            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 0' }}>
                <Layers size={14} color="#00a8ff" /> 3D Depth Topography
              </h4>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>Shape-from-Shading (SFS) estimating component height contours and deep vias.</p>
              {data.depth_map ? <img src={`data:image/jpeg;base64,${data.depth_map}`} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} alt="Depth Map" /> : <div className="spinner" style={{ margin: 'auto' }} />}
            </div>

            {/* OCR Extractor */}
            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 0' }}>
                <Search size={14} color="#ffd60a" /> OCR Verification
              </h4>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>Scanning for component serial numbers and PCB silkscreen identifiers.</p>
              {data.ocr && data.ocr.texts && data.ocr.texts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.ocr.texts.slice(0, 5).map((txt, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{txt.text}</span>
                      <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>{Math.round(txt.confidence * 100)}% conf</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{data.ocr?.error || 'No printed text / serials detected'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANOMALY SCORE PANEL ──────────────────────────────────────────────────────
function AnomalyPanel({ imageFile }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!score?.anomaly_tiles || !canvasRef.current) return;
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const tw = W / 8, th = H / 6;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(c * tw, r * th, tw - 1, th - 1);
    }
    score.anomaly_tiles.forEach(t => {
      const intensity = Math.min(1, (t.anomaly_score - 3.5) / 6);
      ctx.fillStyle = `rgba(${Math.round(255 * intensity)},${Math.round(80 * (1 - intensity))},30,${0.4 + intensity * 0.5})`;
      ctx.fillRect(t.col * tw, t.row * th, tw - 1, th - 1);
      ctx.strokeStyle = 'rgba(255,100,30,0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.col * tw + 1, t.row * th + 1, tw - 3, th - 3);
      ctx.fillStyle = 'white'; ctx.font = `${Math.round(th * 0.28)}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(t.anomaly_score.toFixed(1), t.col * tw + tw / 2, t.row * th + th * 0.65);
    });
  }, [score]);

  async function runAnomaly() {
    if (!imageFile) return;
    setLoading(true); setScore(null);
    const fd = new FormData();
    fd.append('file', imageFile);
    try {
      const { data } = await axios.post(`${API}/api/analytics/anomaly-score`, fd);
      setScore(data);
    } catch { setScore({ error: true }); }
    finally { setLoading(false); }
  }

  const ratingColor = !score ? '#6c63ff'
    : score.anomaly_rating?.startsWith('HIGH') ? '#ff4d6d'
      : score.anomaly_rating?.startsWith('MEDIUM') ? '#ff8c00'
        : score.anomaly_rating?.startsWith('LOW') ? '#ffd60a' : '#00d4aa';

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: 0 }}>🔍 Anomaly Heat Grid</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Tile-based statistical anomaly detection</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={runAnomaly} disabled={loading || !imageFile}>
          {loading ? <><div className="spinner" style={{ width: 11, height: 11 }} /> Scanning</> : '🔍 Scan Tiles'}
        </button>
      </div>
      {score && !score.error && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 999,
              border: `1px solid ${ratingColor}44`, background: `${ratingColor}18`, color: ratingColor
            }}>
              {score.anomaly_rating}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {score.anomalous_tiles}/{score.total_tiles} tiles flagged · Max: {score.max_score}
            </span>
          </div>
          <canvas ref={canvasRef} width={320} height={240}
            style={{ borderRadius: 8, border: '1px solid var(--border)', width: '100%', maxWidth: 320, display: 'block' }} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            ⚠️ Bright orange cells = statistically unusual texture regions not matching PCB baseline.
          </p>
        </>
      )}
      {score?.error && <p style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8 }}>Analysis failed. Upload an image first.</p>}
      {!imageFile && !score && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>⬆️ Upload a PCB image first to run anomaly scanning.</p>}
    </div>
  );
}

// ─── SPC CONTROL CHART ────────────────────────────────────────────────────────
function SPCChart() {
  const [spc, setSpc] = useState(null);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/analytics/spc-data`)
      .then(r => setSpc(r.data))
      .catch(() => setSpc(null))
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!spc || spc.points.length < 2) return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
      <p>Need data from at least 2 days to draw an SPC chart.</p>
      <p style={{ fontSize: 12, marginTop: 4 }}>Scan boards on different days to enable this view.</p>
    </div>
  );

  const chartData = spc.points.map(p => ({
    date: p.date.slice(5), Rate: p.rate, UCL: spc.UCL,
    ...(spc.LCL > 0 ? { LCL: spc.LCL } : {}), Mean: spc.mean,
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['Mean', spc.mean + '%', '#6c63ff'], ['UCL', spc.UCL + '%', '#ff4d6d'], ['LCL', spc.LCL + '%', '#00d4aa'], ['σ', spc.std + '%', 'var(--text-muted)']].map(([l, v, c]) => (
          <span key={l} style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>{l}: </span><strong style={{ color: c }}>{v}</strong></span>
        ))}
        <span style={{
          marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 999,
          background: spc.process_stable ? 'rgba(0,212,170,0.12)' : 'rgba(255,77,109,0.12)',
          color: spc.process_stable ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${spc.process_stable ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,109,0.3)'}`
        }}>
          {spc.process_stable ? '✅ Process Stable' : '⚠️ Process Unstable'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} unit="%" />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
            formatter={v => [v + '%']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Rate" stroke="#6c63ff" strokeWidth={2} dot={{ r: 3, fill: '#6c63ff' }} name="Defect Rate" />
          <Line type="monotone" dataKey="UCL" stroke="#ff4d6d" strokeWidth={1} strokeDasharray="5 3" dot={false} name="UCL (+3σ)" />
          <Line type="monotone" dataKey="LCL" stroke="#00d4aa" strokeWidth={1} strokeDasharray="5 3" dot={false} name="LCL (-3σ)" />
          <Line type="monotone" dataKey="Mean" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="2 4" dot={false} name="Mean" />
        </LineChart>
      </ResponsiveContainer>
      {spc.violations.length > 0 && (
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,140,0,0.06)', borderRadius: 8, border: '1px solid rgba(255,140,0,0.2)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 8 }}>⚠️ {spc.violations.length} SPC Violation{spc.violations.length > 1 ? 's' : ''}</p>
          {spc.violations.slice(0, 3).map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
                background: v.severity === 'critical' ? 'rgba(255,77,109,0.15)' : 'rgba(255,140,0,0.15)',
                color: v.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-orange)',
                border: `1px solid ${v.severity === 'critical' ? 'rgba(255,77,109,0.3)' : 'rgba(255,140,0,0.3)'}`
              }}>
                {v.date}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.rule}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DBSCAN CLUSTER MAP ───────────────────────────────────────────────────────
const CLUSTER_COLORS = ['#6c63ff', '#ff4d6d', '#00d4aa', '#ff8c00', '#ffd60a', '#00a8ff', '#ff69b4', '#7fff00'];

function ClusterMap() {
  const [clusters, setClusters] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/analytics/defect-clusters`)
      .then(r => setClusters(r.data))
      .catch(() => setClusters(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clusters?.clusters?.length || !canvasRef.current) return;
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(108,99,255,0.2)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.strokeRect(4, 4, W - 8, H - 8); ctx.setLineDash([]);
    [1, 2].forEach(i => {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(W / 3 * i, 0); ctx.lineTo(W / 3 * i, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H / 3 * i); ctx.lineTo(W, H / 3 * i); ctx.stroke();
    });
    clusters.clusters.forEach((cl, idx) => {
      const cx = cl.centre_x * W, cy = cl.centre_y * H;
      const radius = Math.max(14, Math.min(42, cl.point_count * 5));
      const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
      grad.addColorStop(0, color + 'cc'); grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color + '55'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'white'; ctx.font = `bold ${Math.max(9, Math.min(13, radius * 0.55))}px Inter`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cl.point_count, cx, cy);
    });
  }, [clusters]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!clusters?.clusters?.length) return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
      <p style={{ fontSize: 13 }}>Not enough defect data for clustering.</p>
      <p style={{ fontSize: 11, marginTop: 4 }}>Run at least 5+ scans with defects to see spatial patterns.</p>
    </div>
  );

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={260}
        style={{ width: '100%', maxWidth: 400, borderRadius: 8, border: '1px solid var(--border)', display: 'block', marginBottom: 12 }} />
      <p style={{
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12,
        padding: '10px 14px', background: 'rgba(108,99,255,0.06)', borderRadius: 8, border: '1px solid rgba(108,99,255,0.15)'
      }}>
        💡 {clusters.interpretation}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {clusters.clusters.slice(0, 5).map((cl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: CLUSTER_COLORS[i], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
              <strong style={{ color: CLUSTER_COLORS[i] }}>{cl.dominant_type}</strong>
              {' — '}{cl.point_count} pts · {Object.keys(cl.type_breakdown).length} type{Object.keys(cl.type_breakdown).length > 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(cl.centre_x * 100)}%,{Math.round(cl.centre_y * 100)}%</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
        Circle size = cluster size. Numbers = defect count in cluster. Noise points excluded.
      </p>
    </div>
  );
}

// ─── SCORE RING ────────────────────────────────────────────────────────────────
function ScoreRing({ score = 100, size = 80 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? '#00d4aa' : score >= 50 ? '#ffd60a' : score >= 20 ? '#ff8c00' : '#ff4d6d';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700, transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {score}
      </text>
    </svg>
  );
}


// ─── PCB ZONE DIAGRAM ─────────────────────────────────────────────────────────
const ZONE_LABELS = [
  ['top-left', 'Top L'], ['top', 'Top'], ['top-right', 'Top R'],
  ['center-left', 'Mid L'], ['center', 'Centre'], ['center-right', 'Mid R'],
  ['bottom-left', 'Bot L'], ['bottom', 'Bottom'], ['bottom-right', 'Bot R'],
];

function PCBZoneDiagram({ defects = [], imgW = 640, imgH = 640 }) {
  const [hovered, setHovered] = useState(null);
  const W = 360, H = Math.round(W * imgH / imgW);
  const scaleX = W / imgW, scaleY = H / imgH;

  // Group defects by location for zone summary
  const byZone = {};
  defects.forEach(d => {
    const z = d.location || 'center';
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(d);
  });

  // Zone grid: map zone-name → SVG rect position
  const zoneGrid = {
    'top-left': { x: 0, y: 0, w: W / 3, h: H / 3 },
    'top': { x: W / 3, y: 0, w: W / 3, h: H / 3 },
    'top-right': { x: 2 * W / 3, y: 0, w: W / 3, h: H / 3 },
    'center-left': { x: 0, y: H / 3, w: W / 3, h: H / 3 },
    'center': { x: W / 3, y: H / 3, w: W / 3, h: H / 3 },
    'center-right': { x: 2 * W / 3, y: H / 3, w: W / 3, h: H / 3 },
    'bottom-left': { x: 0, y: 2 * H / 3, w: W / 3, h: H / 3 },
    'bottom': { x: W / 3, y: 2 * H / 3, w: W / 3, h: H / 3 },
    'bottom-right': { x: 2 * W / 3, y: 2 * H / 3, w: W / 3, h: H / 3 },
  };

  // For each defect, project box centre to SVG
  const dots = defects.map((d, i) => {
    const [x1, y1, x2, y2] = d.box || [imgW / 2, imgH / 2, imgW / 2 + 10, imgH / 2 + 10];
    const cx = ((x1 + x2) / 2) * scaleX;
    const cy = ((y1 + y2) / 2) * scaleY;
    const r = Math.max(6, Math.min(22, Math.sqrt((x2 - x1) * (y2 - y1) * scaleX * scaleY) * 0.4));
    return { ...d, cx, cy, r, idx: i };
  });

  const worstZone = Object.entries(byZone).sort((a, b) => {
    const sevScore = d => ({ Critical: 3, Major: 2, Minor: 1 })[d.severity] || 0;
    return b[1].reduce((s, d) => s + sevScore(d), 0) - a[1].reduce((s, d) => s + sevScore(d), 0);
  })[0]?.[0];

  return (
    <div>
      <p style={{
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 8,
        textTransform: 'uppercase', letterSpacing: 1
      }}>PCB Zone Diagram</p>

      <div style={{ position: 'relative', display: 'inline-block', width: W }}>
        <svg width={W} height={H} style={{ display: 'block', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(0,40,20,0.35)' }}>
          <defs>
            <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,180,80,0.08)" strokeWidth="0.5" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* PCB board background */}
          <rect width={W} height={H} fill="url(#pcb-grid)" />
          <rect width={W} height={H} fill="none" stroke="rgba(0,200,100,0.25)" strokeWidth="2" rx="8" />

          {/* Corner markers (PCB mounting holes) */}
          {[[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={6} fill="none" stroke="rgba(0,200,100,0.3)" strokeWidth="1.5" />
              <circle cx={cx} cy={cy} r={2} fill="rgba(0,200,100,0.5)" />
            </g>
          ))}

          {/* Zone grid lines */}
          <line x1={W / 3} y1={0} x2={W / 3} y2={H} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={2 * W / 3} y1={0} x2={2 * W / 3} y2={H} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={0} y1={H / 3} x2={W} y2={H / 3} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={0} y1={2 * H / 3} x2={W} y2={2 * H / 3} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Zone highlights for zones with defects */}
          {Object.entries(byZone).map(([zone, zDefects]) => {
            const zg = zoneGrid[zone];
            if (!zg) return null;
            const worst = zDefects.reduce((w, d) => {
              const s = { Critical: 3, Major: 2, Minor: 1 };
              return (s[d.severity] || 0) > (s[w.severity] || 0) ? d : w;
            }, zDefects[0]);
            const c = SEV[worst.severity]?.color || '#fff';
            return (
              <rect key={zone} x={zg.x + 1} y={zg.y + 1} width={zg.w - 2} height={zg.h - 2}
                fill={`${c}14`} stroke={`${c}44`} strokeWidth="1" rx="4" />
            );
          })}

          {/* Defect dots */}
          {dots.map((d, i) => {
            const c = SEV[d.severity]?.color || '#fff';
            const isH = hovered === i;
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}>
                {/* Glow ring */}
                <circle cx={d.cx} cy={d.cy} r={d.r + 5} fill={`${c}22`} filter="url(#glow)" />
                {/* Main dot */}
                <circle cx={d.cx} cy={d.cy} r={isH ? d.r + 3 : d.r}
                  fill={`${c}cc`} stroke={c} strokeWidth={isH ? 2.5 : 1.5}
                  style={{ transition: 'r 0.15s ease' }} />
                {/* Severity letter */}
                <text x={d.cx} y={d.cy + 4} textAnchor="middle"
                  style={{
                    fontSize: Math.max(7, d.r * 0.65), fontWeight: 700, fill: '#fff',
                    fontFamily: 'Inter', pointerEvents: 'none'
                  }}>
                  {d.severity[0]}
                </text>
                {/* Tooltip */}
                {isH && (() => {
                  const tx = d.cx > W * 0.65 ? d.cx - 130 : d.cx + 10;
                  const ty = d.cy > H * 0.7 ? d.cy - 70 : d.cy + 10;
                  return (
                    <g>
                      <rect x={tx} y={ty} width={130} height={58} rx={6}
                        fill="rgba(13,13,26,0.95)" stroke={`${c}88`} strokeWidth="1" />
                      <text x={tx + 8} y={ty + 16} style={{ fontSize: 10, fontWeight: 700, fill: c, fontFamily: 'Inter' }}>
                        {d.type}
                      </text>
                      <text x={tx + 8} y={ty + 30} style={{ fontSize: 9, fill: 'rgba(255,255,255,0.7)', fontFamily: 'Inter' }}>
                        {d.severity} · {Math.round(d.confidence * 100)}% conf
                      </text>
                      <text x={tx + 8} y={ty + 44} style={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }}>
                        {d.location} · {d.area_pct?.toFixed(1)}% area
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {/* Zone labels overlay */}
        {ZONE_LABELS.map(([zone, label]) => {
          const zg = zoneGrid[zone];
          if (!zg) return null;
          const count = (byZone[zone] || []).length;
          return (
            <div key={zone} style={{
              position: 'absolute',
              left: zg.x + 4, top: zg.y + 4,
              fontSize: 8, color: count > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
              fontFamily: 'Inter', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
              pointerEvents: 'none',
            }}>{label}{count > 0 && <span style={{ color: 'var(--accent-red)', marginLeft: 3 }}>({count})</span>}</div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(SEV).filter(([k]) => k !== 'None').map(([sev, info]) => (
          <span key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{sev[0]} = {sev}</span>
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>Hover dots for details</span>
      </div>

      {worstZone && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          ⚠️ Highest defect concentration in <strong style={{ color: 'var(--accent-orange)' }}>{worstZone.replace('-', ' ')}</strong> zone
          ({(byZone[worstZone] || []).length} defect{(byZone[worstZone] || []).length > 1 ? 's' : ''})
        </p>
      )}
    </div>
  );
}


// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function Navbar() {
  const { dark, toggle } = useContext(ThemeCtx);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: dark ? 'rgba(13,13,26,0.92)' : 'rgba(244,244,252,0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)', padding: '0 32px',
      display: 'flex', alignItems: 'center', height: 64,
      transition: 'background 0.35s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 48 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Cpu size={20} color="white" />
        </div>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px' }}>
          Spot<span style={{ color: 'var(--accent-primary)' }}>Bot</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[
          { to: '/', icon: Upload, label: 'Scan' },
          { to: '/results', icon: Eye, label: 'Results' },
          { to: '/history', icon: History, label: 'History' },
          { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
        ].map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            color: isActive ? 'white' : 'var(--text-secondary)',
            background: isActive ? 'var(--bg-card)' : 'transparent',
            textDecoration: 'none', fontSize: 14, fontWeight: 500,
            border: isActive ? '1px solid var(--border)' : '1px solid transparent',
            transition: 'all 0.2s',
          })}>
            <Icon size={15} />{label}
          </NavLink>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={toggle} title={dark ? 'Switch to light' : 'Switch to dark'}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.25s'
          }}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span style={{ fontSize: 12 }}>{dark ? 'Light' : 'Dark'}</span>
        </button>
        <span className="status-dot ok" />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>System Online</span>
      </div>
    </nav>
  );
}


// ─── SCAN PAGE ───────────────────────────────────────────────────────────────
function ScanPage({ setResults }) {
  const [mode, setMode] = useState('upload'); // upload|camera|url|paste
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(0.30);
  const [batch, setBatch] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [pcbError, setPcbError] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [liveResults, setLiveResults] = useState(null);
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let timerId = null;
    async function scanFrame() {
      if (!liveMode || mode !== 'camera' || !webcamRef.current) return;
      const imgSrc = webcamRef.current.getScreenshot();
      if (imgSrc) {
        try {
          const { data } = await axios.post(`${API}/api/detect/camera`, { image: imgSrc });
          if (active) setLiveResults(data);
        } catch (e) { }
      }
      if (active && liveMode) timerId = setTimeout(scanFrame, 1500);
    }
    if (liveMode && mode === 'camera') scanFrame();
    else setLiveResults(null);
    return () => { active = false; if (timerId) clearTimeout(timerId); };
  }, [liveMode, mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    onDrop: async files => {
      setPcbError(null);
      if (files.length === 1) { await handleUpload(files[0]); } else { setBatch(files); }
    }
  });

  async function handleUpload(file) {
    setLoading(true); setPcbError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await axios.post(`${API}/api/detect/upload`, fd);
      setResults(data); navigate('/results');
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || '';
      if (detail.includes('NOT_A_PCB:')) { setPcbError(detail.replace(/.*NOT_A_PCB:/, '').trim()); }
      else { setPcbError('Detection failed: ' + detail); }
    } finally { setLoading(false); }
  }

  async function handleUrlScan() {
    if (!urlInput.trim()) return;
    setLoading(true); setPcbError(null);
    try {
      const { data } = await axios.post(`${API}/api/detect/url`, { url: urlInput });
      setResults(data); navigate('/results');
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || '';
      if (detail.includes('NOT_A_PCB:')) { setPcbError(detail.replace(/.*NOT_A_PCB:/, '').trim()); }
      else { setPcbError('Could not fetch image from URL: ' + detail); }
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    setPcbError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            await handleUpload(new File([blob], 'clipboard.png', { type }));
            return;
          }
        }
      }
      setPcbError('No image found in clipboard. Copy an image first (Ctrl+C on an image), then try again.');
    } catch { setPcbError('Clipboard access denied. Please use File Upload instead.'); }
  }

  async function handleBatch() {
    setLoading(true);
    const results = [];
    for (const file of batch) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const { data } = await axios.post(`${API}/api/detect/upload`, fd);
        results.push({ name: file.name, ...data });
      } catch { results.push({ name: file.name, error: true }); }
    }
    setBatchResults(results);
    setLoading(false);
  }

  async function handleCapture() {
    const imgSrc = webcamRef.current?.getScreenshot();
    if (!imgSrc) return;
    setLoading(true); setPcbError(null);
    try {
      const { data } = await axios.post(`${API}/api/detect/camera`, { image: imgSrc });
      setResults(data); navigate('/results');
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || '';
      if (detail.includes('NOT_A_PCB:')) { setPcbError(detail.replace(/.*NOT_A_PCB:/, '').trim()); }
      else { setPcbError('Detection failed: ' + detail); }
    } finally { setLoading(false); }
  }


  return (
    <div style={{ padding: '96px 32px 32px', maxWidth: 900, margin: '0 auto' }} className="fade-in">
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div className="float-anim" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 80, height: 80, borderRadius: 24, marginBottom: 24,
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          boxShadow: '0 0 40px var(--accent-glow)'
        }}>
          <Cpu size={40} color="white" />
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 42, fontWeight: 700, letterSpacing: '-1px', marginBottom: 12 }}>
          PCB Defect <span style={{
            backgroundImage: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>Detection</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
          Upload single or batch PCB images. SpotBot runs AI + thermal analysis to find all defects instantly.
        </p>
      </div>

      {/* Mode Tabs — 4 input methods */}
      <div className="tabs" style={{ marginBottom: 24, maxWidth: 560, margin: '0 auto 24px' }}>
        {[
          ['upload', 'File Upload', Upload],
          ['camera', 'Live Camera', Camera],
          ['url', 'Image URL', Layers],
          ['paste', 'Paste / Clipboard', Download],
        ].map(([m, l, Icon]) => (
          <button key={m} className={`tab ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setPcbError(null); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Icon size={13} /><span style={{ fontSize: 12 }}>{l}</span>
          </button>
        ))}
      </div>

      {/* ─ Upload Zone ─ */}
      {mode === 'upload' && (
        <div className="slide-up">
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--accent-primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '60px 40px', textAlign: 'center',
            background: isDragActive ? 'rgba(108,99,255,0.05)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'var(--transition)', marginBottom: 20,
            boxShadow: isDragActive ? '0 0 30px var(--accent-glow)' : 'none',
          }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: 48, marginBottom: 16 }}>{isDragActive ? '�' : '�📡'}</div>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 8 }}>
              {isDragActive ? 'Drop PCB images here' : 'Drag & Drop PCB Image(s)'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Single image → instant results &nbsp;|&nbsp; Multiple → Batch mode
            </p>
            <button className="btn btn-primary" onClick={e => e.stopPropagation()}>
              <Upload size={16} /> Browse Files
            </button>
          </div>
          {/* Confidence / batch */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Detection Sensitivity</span>
              <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700 }}>{Math.round(threshold * 100)}%</span>
            </div>
            <input type="range" min={0.1} max={0.9} step={0.05} value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>Low (more detections)</span><span>High (fewer false positives)</span>
            </div>
          </div>
          {batch.length > 1 && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>📦 Batch Queue ({batch.length} images)</span>
                <button className="btn btn-primary btn-sm" onClick={handleBatch} disabled={loading}>
                  <Zap size={14} /> {loading ? 'Scanning...' : 'Scan All'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {batch.map((f, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', background: 'var(--bg-surface)',
                    borderRadius: 6, fontSize: 12, border: '1px solid var(--border)'
                  }}>
                    {batchResults[i] ? (batchResults[i].error ? '❌' : batchResults[i].board_status === 'FAULTY' ? '⚠️' : '✅') : '⏳'} {f.name.slice(0, 20)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─ URL Input ─ */}
      {mode === 'url' && (
        <div className="card slide-up" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, marginBottom: 8 }}>Scan from URL</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Paste a direct link to a PCB image (JPG, PNG, WebP)
          </p>
          <div style={{ display: 'flex', gap: 12, maxWidth: 500, margin: '0 auto' }}>
            <input type="url" placeholder="https://example.com/pcb.jpg"
              value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlScan()}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={handleUrlScan} disabled={loading || !urlInput.trim()}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Scanning</> : <><Zap size={15} />Scan</>}
            </button>
          </div>
        </div>
      )}

      {/* ─ Clipboard Paste ─ */}
      {mode === 'paste' && (
        <div className="card slide-up" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 22, marginBottom: 10 }}>Paste from Clipboard</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            Copy any PCB image to your clipboard (Ctrl+C in File Explorer or right-click → Copy Image in browser),
            then click the button below.
          </p>
          <button className="btn btn-primary" onClick={handlePaste} disabled={loading}
            style={{ margin: '0 auto', padding: '14px 32px', fontSize: 16 }}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Scanning…</> : <><Download size={18} /> Paste & Scan</>}
          </button>
        </div>
      )}

      {/* Camera */}
      {mode === 'camera' && (
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 24, background: 'var(--bg-card)' }}>
          <div style={{ position: 'relative' }}>
            <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', display: 'block', opacity: liveResults?.annotated_image ? 0.3 : 1, transition: 'opacity 0.3s' }}
              videoConstraints={{ facingMode: 'environment' }} />

            {liveResults?.annotated_image && (
              <img src={`data:image/jpeg;base64,${liveResults.annotated_image}`} alt="Live Scan Bounding Boxes"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            )}

            <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(108,99,255,0.4)', borderRadius: 'var(--radius)', pointerEvents: 'none' }}>
              {[[16, 16, 'Top', 'Left'], [16, 'auto', 'Top', 'Right'], ['auto', 16, 'Bottom', 'Left'], ['auto', 'auto', 'Bottom', 'Right']].map(([t, b, v, h], i) => (
                <div key={i} style={{
                  position: 'absolute', top: t, bottom: b, [h.toLowerCase()]: 16, width: 24, height: 24,
                  [`border${v}`]: `3px solid ${liveMode ? 'var(--accent-red)' : 'var(--accent-primary)'}`,
                  [`border${h}`]: `3px solid ${liveMode ? 'var(--accent-red)' : 'var(--accent-primary)'}`,
                  transition: 'border-color 0.3s'
                }} />
              ))}
            </div>

            {liveMode && (
              <div style={{ position: 'absolute', top: 16, right: 32, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 999, color: 'white', fontSize: 12, fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)', animation: 'pulse 1.5s infinite' }} />
                LIVE SCAN
              </div>
            )}
          </div>
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className={`btn ${liveMode ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => { setLiveMode(!liveMode); if (!liveMode) setLiveResults(null); }}
              style={{ fontSize: 15, padding: '12px 24px', flex: 1, borderColor: liveMode ? 'var(--accent-red)' : undefined, color: liveMode ? 'var(--accent-red)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Activity size={18} /> {liveMode ? 'Stop Live Scan' : 'Start Live Scan'}
              </div>
            </button>
            <button className="btn btn-primary" onClick={handleCapture} disabled={loading || liveMode} style={{ fontSize: 15, padding: '12px 24px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Camera size={18} /> {loading ? 'Analyzing...' : 'Snapshot & Report'}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* PCB Validation Error Banner */}
      {pcbError && (
        <div style={{
          padding: '20px 24px', borderRadius: 'var(--radius)', marginBottom: 20,
          background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.35)',
          display: 'flex', gap: 16, alignItems: 'flex-start'
        }}>
          <div style={{ fontSize: 32, flexShrink: 0 }}>🚫</div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: 6, fontSize: 15 }}>
              Image Rejected — Not a PCB Board
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
              {pcbError}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              💡 Tip: SpotBot works with green, blue, red, or white FR4 circuit boards.
              Take a clear top-down photo of the PCB with good lighting.
            </p>
          </div>
          <button onClick={() => setPcbError(null)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, flexShrink: 0
            }}>✕</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 16px', borderWidth: 4 }} />
          <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Analyzing PCB board...</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Running AI defect detection & thermal analysis</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 32 }}>
        {['YOLOv8 AI', 'Thermal Analysis', 'Heatmap', 'PDF Report', 'Batch Scan', 'Voice Output', 'CSV Export', 'History'].map(f => (
          <span key={f} style={{
            padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-card)'
          }}>✦ {f}</span>
        ))}
      </div>
    </div>
  );
}

// ─── RESULTS PAGE ─────────────────────────────────────────────────────────────
function ResultsPage({ results }) {
  const [imgTab, setImgTab] = useState('annotated');
  const [filterSev, setFilterSev] = useState('All');
  const [zoom, setZoom] = useState(null);    // null | defect index
  const [splitView, setSplitView] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const imgRef = useRef(null);
  const navigate = useNavigate();

  if (!results) return (
    <div style={{ padding: '96px 32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <Cpu size={60} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
      <h2>No scan results yet</h2>
      <p>Go to the Scan page and analyze a PCB board</p>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/')}>Start Scanning</button>
    </div>
  );

  const {
    defects = [], board_status, severity, defect_count,
    critical_count = 0, major_count = 0, minor_count = 0,
    board_score = 100, detection_mode = '',
    img_width = 640, img_height = 640, scan_id,
    annotated_image, heatmap_image, original_image, blueprint_image, wireframe_image,
    annotated_url, heatmap_url, image_url, blueprint_url, wireframe_url,
  } = results;

  const filtered = filterSev === 'All' ? defects : defects.filter(d => d.severity === filterSev);

  function getImgSrc(b64, url) {
    if (b64) return `data:image/jpeg;base64,${b64}`;
    if (url) return url;
    return null;
  }

  const imgSrcs = {
    annotated: getImgSrc(annotated_image, annotated_url),
    heatmap: getImgSrc(heatmap_image, heatmap_url),
    original: getImgSrc(original_image, image_url),
    blueprint: getImgSrc(blueprint_image, blueprint_url),
    wireframe: getImgSrc(wireframe_image, wireframe_url),
  };
  const currentSrc = imgSrcs[imgTab];

  // Compute zoom style for a defect box
  function getZoomStyle(defect) {
    if (!imgRef.current || !defect) return {};
    const [x1, y1, x2, y2] = defect.box || [0, 0, img_width, img_height];
    const cx = ((x1 + x2) / 2) / img_width * 100;
    const cy = ((y1 + y2) / 2) / img_height * 100;
    const bw = (x2 - x1) / img_width;
    const scl = Math.min(3, Math.max(1.5, 0.8 / bw));
    return {
      transform: `scale(${scl})`,
      transformOrigin: `${cx}% ${cy}%`,
      transition: 'transform 0.4s ease, transform-origin 0.4s ease',
    };
  }

  function speak() {
    if ('speechSynthesis' in window) {
      setSpeaking(true);
      const text = defects.length === 0
        ? 'PCB scan complete. No defects detected. Board score 100. Board passed inspection.'
        : `PCB scan complete. Board score ${board_score} out of 100. Found ${defects.length} defect${defects.length > 1 ? 's' : ''}. Severity: ${severity}. ${critical_count > 0 ? `${critical_count} critical. ` : ''}Defects: ${defects.map(d => d.type).join(', ')}.`;
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  }

  function exportDefectsCSV() {
    const rows = [['Type', 'Severity', 'Confidence', 'Location', 'Area %', 'Stage']];
    defects.forEach(d => rows.push([d.type, d.severity, d.confidence, d.location || '', d.area_pct || '', d.stage || '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `SpotBot_Scan_${scan_id || 'result'}.csv`; a.click();
  }

  const scoreColor = board_score >= 80 ? 'var(--accent-green)' : board_score >= 50 ? 'var(--accent-orange)' : board_score >= 20 ? '#ff8c00' : 'var(--accent-red)';

  return (
    <div style={{ padding: '96px 32px 32px', maxWidth: 1200, margin: '0 auto' }} className="fade-in">

      {/* Status Banner */}
      <div style={{
        padding: '20px 28px', borderRadius: 'var(--radius)', marginBottom: 24,
        background: board_status === 'FAULTY' ? 'rgba(255,77,109,0.08)' : 'rgba(0,212,170,0.08)',
        border: `1px solid ${board_status === 'FAULTY' ? 'rgba(255,77,109,0.3)' : 'rgba(0,212,170,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Score Ring */}
          <ScoreRing score={board_score} size={72} />
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 22 }}>
              {board_status === 'FAULTY' ? `${defect_count} Defect${defect_count > 1 ? 's' : ''} Detected` : '✅ Board Passed Inspection'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Severity: <strong style={{ color: SEV[severity]?.color }}>{severity}</strong>
              &nbsp;·&nbsp; Mode: {detection_mode}
            </p>
            {/* Quick counts */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {[['Critical', critical_count, '#ff4d6d'], ['Major', major_count, '#ff8c00'], ['Minor', minor_count, '#ffd60a']].map(([l, v, c]) => (
                <span key={l} style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 999,
                  background: `${c}18`, color: c, border: `1px solid ${c}44`
                }}>
                  {l}: {v}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={speak} disabled={speaking}>
            <Volume2 size={14} /> {speaking ? 'Speaking...' : 'Read Aloud'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportDefectsCSV}>
            <Download size={14} /> CSV
          </button>
          {scan_id && (
            <a className="btn btn-primary btn-sm" href={`${API}/api/scans/${scan_id}/report`} target="_blank" rel="noreferrer">
              <FileText size={14} /> PDF Report
            </a>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/')}>
            <RefreshCw size={14} /> New Scan
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── Image Viewer ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {['annotated', 'heatmap', 'blueprint', 'wireframe', 'original'].map(t => (
              <button key={t} className={`tab ${imgTab === t ? 'active' : ''}`} onClick={() => { setImgTab(t); setZoom(null); setSplitView(false); }}
                style={{ textTransform: 'capitalize', flex: 'initial', padding: '5px 12px', fontSize: 12 }}>
                {t === 'annotated' ? '📍 Annotated' : t === 'heatmap' ? '🌡️ Heatmap' : t === 'blueprint' ? '📐 Blueprint' : t === 'wireframe' ? '🟩 Wireframe' : '🖼️ Original'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setSplitView(v => !v)} title="Split view"
              style={{
                background: splitView ? 'var(--accent-primary)' : 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px',
                cursor: 'pointer', color: splitView ? 'white' : 'var(--text-secondary)'
              }}>
              <SplitSquareVertical size={13} />
            </button>
            {zoom !== null && (
              <button onClick={() => setZoom(null)} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)'
              }}>
                <ZoomOut size={13} />
              </button>
            )}
          </div>

          <div style={{ padding: '12px 16px 16px', overflow: 'hidden' }}>
            {splitView ? (
              /* Split view */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {imgSrcs.original && <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>ORIGINAL</p>
                  <img src={imgSrcs.original} alt="Original" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                </div>}
                {imgSrcs.annotated && <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>ANNOTATED</p>
                  <img src={imgSrcs.annotated} alt="Annotated" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                </div>}
              </div>
            ) : currentSrc ? (
              <div style={{ overflow: 'hidden', borderRadius: 10, border: '1px solid var(--border)' }}>
                <img ref={imgRef} src={currentSrc} alt="PCB Analysis"
                  style={{ width: '100%', display: 'block', ...getZoomStyle(zoom !== null ? defects[zoom] : null) }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 32 }}>🖼️</span>
                <p style={{ marginTop: 8, fontSize: 13 }}>Image not available for this tab</p>
              </div>
            )}
          </div>

          {/* PCB Zone Diagram */}
          {defects.length > 0 && (
            <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'center' }}>
              <PCBZoneDiagram defects={defects} imgW={img_width} imgH={img_height} />
            </div>
          )}
        </div>

        {/* ── Defect List ── */}
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 17, flex: 1 }}>Defect Analysis</h3>
            {['All', 'Critical', 'Major', 'Minor'].map(s => (
              <button key={s} onClick={() => setFilterSev(s)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: filterSev === s ? (SEV[s]?.color || 'var(--accent-primary)') : 'var(--bg-surface)',
                  color: filterSev === s ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${filterSev === s ? (SEV[s]?.color || 'var(--accent-primary)') : 'var(--border)'}`,
                  transition: 'all 0.15s'
                }}>
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <CheckCircle2 size={40} color="var(--accent-green)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--accent-green)', fontWeight: 600 }}>All Clear!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
              {filtered.map((d, i) => {
                const idx = defects.indexOf(d);
                const isZoomed = zoom === idx;
                return (
                  <div key={i} className="card" style={{
                    padding: 14, cursor: 'pointer',
                    border: isZoomed ? `1px solid ${SEV[d.severity]?.color || 'var(--border)'}` : '1px solid var(--border)',
                    boxShadow: isZoomed ? `0 0 16px ${SEV[d.severity]?.color || 'transparent'}44` : 'none',
                    transition: 'all 0.2s',
                  }} onClick={() => { setZoom(isZoomed ? null : idx); setImgTab('annotated'); }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{SEV[d.severity]?.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{d.type}</span>
                        {d.location && <span style={{
                          fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-surface)',
                          padding: '2px 6px', borderRadius: 4
                        }}>📍{d.location}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${SEV[d.severity]?.cls}`}>{d.severity}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(d.confidence * 100)}%</span>
                        <ZoomIn size={12} color="var(--text-muted)" />
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 8 }}>
                      <div style={{
                        height: 3, width: `${d.confidence * 100}%`, borderRadius: 3,
                        background: SEV[d.severity]?.color || 'var(--accent-primary)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.6 }}>
                      {d.description}
                    </p>

                    {/* Area + Stage */}
                    {(d.area_pct || d.stage) && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {d.area_pct && <span style={{
                          fontSize: 10, color: 'var(--text-muted)', padding: '2px 7px',
                          background: 'var(--bg-surface)', borderRadius: 4
                        }}>
                          Area: {d.area_pct.toFixed(1)}%</span>}
                        {d.stage && <span style={{
                          fontSize: 10, color: 'var(--text-muted)', padding: '2px 7px',
                          background: 'var(--bg-surface)', borderRadius: 4
                        }}>
                          {d.stage}</span>}
                      </div>
                    )}

                    {/* MLOps: Human-In-The-Loop Correction */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await axios.post(`${API}/api/analytics/hitl-feedback`, { scan_id: scan_id || parseInt(Math.random() * 100000), defect_index: i, is_false_positive: true });
                          alert('False positive flagged. Added to dataset for next YOLO epoch limit.');
                        } catch { alert('Failed to submit correction.'); }
                      }} className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 10, height: 24, flex: 1, borderColor: 'var(--border)' }}>✖️ False Pos</button>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        const cls = prompt("Enter correct defect class (e.g. Mouse Bite, Missing Component):");
                        if (cls) {
                          try {
                            await axios.post(`${API}/api/analytics/hitl-feedback`, { scan_id: scan_id || parseInt(Math.random() * 100000), defect_index: i, is_false_positive: false, correct_class: cls });
                            alert('Correction saved. Added to dataset for next YOLO epoch.');
                          } catch { alert('Failed to submit correction.'); }
                        }
                      }} className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 10, height: 24, flex: 1, borderColor: 'var(--border)' }}>✏️ Change Class</button>
                    </div>

                    {/* Repair guide */}
                    <div style={{
                      background: 'rgba(108,99,255,0.06)', borderRadius: 8,
                      padding: '8px 12px', borderLeft: '3px solid var(--accent-primary)'
                    }}>
                      <p style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 600, marginBottom: 3 }}>🔧 Repair Guide</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{d.repair}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Expert Analysis Panel ── */}
      <GeminiPanel defects={defects} scanId={scan_id} imageB64={original_image || null} />

      {/* ── Deep Learning CV Toolkit ── */}
      <DLPanel defects={defects} scanId={scan_id} imageB64={original_image || null} />

    </div>
  );
}

// --- HISTORY PAGE ---
function HistoryPage({ setResults }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | grid
  const [filter, setFilter] = useState('All');  // All | FAULTY | OK
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState(null);   // ID of scan pending delete
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/api/scans/`).then(r => { setScans(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const displayed = scans.filter(s => {
    if (filter !== 'All' && s.board_status !== filter) return false;
    if (search && !String(s.id).includes(search) && !s.timestamp?.includes(search)) return false;
    return true;
  });

  async function loadScan(scan) {
    try {
      const { data } = await axios.get(`${API}/api/scans/${scan.id}`);
      setResults({
        ...data, defects: data.defects || [], scan_id: data.id,
        image_url: data.image_url, annotated_url: data.annotated_url, heatmap_url: data.heatmap_url,
        blueprint_url: data.blueprint_url, wireframe_url: data.wireframe_url
      });
      navigate('/results');
    } catch { alert('Failed to load scan'); }
  }

  function requestDelete(e, scanId) {
    e.stopPropagation();
    setConfirmId(scanId);
  }

  async function confirmDelete() {
    try {
      await axios.delete(`${API}/api/scans/${confirmId}`);
      setScans(prev => prev.filter(s => s.id !== confirmId));
    } catch { alert('Failed to delete scan'); }
    finally { setConfirmId(null); }
  }

  return (
    <div style={{ padding: '96px 32px 32px', maxWidth: 1100, margin: '0 auto' }} className="fade-in">

      {/* Custom Delete Confirmation Modal */}
      {confirmId && (
        <ConfirmModal
          icon="🗑️"
          title={`Delete Scan #${confirmId}?`}
          message="This will permanently remove the scan record and all associated images. This action cannot be undone."
          confirmLabel="Yes, Delete"
          confirmColor="var(--accent-red)"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, marginBottom: 4 }}>Scan History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{scans.length} total inspection records</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID / Date..."
              style={{
                paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 13, outline: 'none', width: 180
              }} />
          </div>
          {/* Filter */}
          {['All', 'FAULTY', 'OK'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>{f}</button>
          ))}
          {/* View toggle */}
          <button onClick={() => setView(v => v === 'list' ? 'grid' : 'list')} className="btn btn-outline btn-sm">
            {view === 'grid' ? <List size={14} /> : <Grid size={14} />}
          </button>
          {/* CSV export */}
          <a href={`${API}/api/scans/export/csv`} className="btn btn-outline btn-sm">
            <Download size={14} /> Export CSV
          </a>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}><Zap size={14} /> New Scan</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 40, height: 40, margin: '0 auto' }} /></div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          <History size={50} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
          <p>No scans match your filter. <button onClick={() => { setFilter('All'); setSearch(''); }} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filters</button></p>
        </div>
      ) : view === 'grid' ? (
        /* Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {displayed.map(scan => (
            <div key={scan.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => loadScan(scan)}>
              {scan.image_url
                ? <img src={scan.image_url} alt="PCB" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                : <div style={{ height: 140, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {scan.board_status === 'FAULTY' ? <XCircle size={40} color="var(--accent-red)" opacity={0.5} /> : <CheckCircle2 size={40} color="var(--accent-green)" opacity={0.5} />}
                </div>}
              <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Scan #{scan.id}</span>
                  <span className={`badge ${scan.board_status === 'FAULTY' ? 'badge-faulty' : 'badge-ok'}`} style={{ fontSize: 10 }}>{scan.board_status}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{scan.defect_count} defect{scan.defect_count !== 1 ? 's' : ''}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{scan.timestamp?.slice(0, 16).replace('T', ' ')}</p>
                <button onClick={e => requestDelete(e, scan.id)}
                  style={{
                    marginTop: 8, background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--accent-red)',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(scan => (
            <div key={scan.id} className="card" style={{
              padding: '14px 20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 16
            }} onClick={() => loadScan(scan)}>
              {scan.image_url
                ? <img src={scan.image_url} alt="PCB" style={{
                  width: 70, height: 56, objectFit: 'cover',
                  borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0
                }} />
                : <div style={{
                  width: 70, height: 56, borderRadius: 10, flexShrink: 0,
                  background: scan.board_status === 'FAULTY' ? 'rgba(255,77,109,0.1)' : 'rgba(0,212,170,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {scan.board_status === 'FAULTY' ? <XCircle size={24} color="var(--accent-red)" /> : <CheckCircle2 size={24} color="var(--accent-green)" />}
                </div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Scan #{scan.id}</span>
                  <span className={`badge ${scan.board_status === 'FAULTY' ? 'badge-faulty' : 'badge-ok'}`}>{scan.board_status}</span>
                  {scan.severity && scan.severity !== 'None' && <span className={`badge ${SEV[scan.severity]?.cls}`}>{scan.severity}</span>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {scan.timestamp?.slice(0, 19).replace('T', ' ')} · {scan.defect_count} defect{scan.defect_count !== 1 ? 's' : ''} · {scan.scan_type}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`${API}/api/scans/${scan.id}/report`} target="_blank" rel="noreferrer"
                  className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()}>
                  <Download size={13} /> Report
                </a>
                <button className="btn btn-sm" onClick={e => requestDelete(e, scan.id)}
                  style={{
                    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)',
                    color: 'var(--accent-red)', cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12
                  }}>
                  <Trash2 size={12} />
                </button>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
const COLORS = ['#ff4d6d', '#ff8c00', '#ffd60a', '#00d4aa', '#6c63ff', '#a78bfa', '#06b6d4', '#ec4899'];

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/scans/stats`),
      axios.get(`${API}/api/scans/`)
    ]).then(([s, h]) => {
      setStats(s.data);
      setScans(h.data.slice(0, 14).reverse()); // last 14 scans as trend
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '96px 32px', textAlign: 'center' }}><div className="spinner" style={{ width: 50, height: 50, margin: '0 auto' }} /></div>;
  if (!stats) return <div style={{ padding: '96px 32px', textAlign: 'center', color: 'var(--text-muted)' }}>Could not load stats.</div>;

  const sevData = Object.entries(stats.severity_distribution || {}).map(([name, value]) => ({ name, value }));
  const defTypeData = Object.entries(stats.defect_type_distribution || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name: name.split(' ')[0], value, fullName: name }));

  // Trend: last N scans pass/fail
  const trendData = scans.map((s, i) => ({
    name: `#${s.id}`,
    Defects: s.defect_count,
    Pass: s.board_status === 'OK' ? 1 : 0,
  }));

  return (
    <div style={{ padding: '96px 32px 32px', maxWidth: 1200, margin: '0 auto' }} className="fade-in">
      <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, marginBottom: 4 }}>Analytics Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Real-time insights from all PCB inspection scans</p>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Total Scans', value: stats.total_scans, icon: '📊', color: 'var(--accent-primary)' },
          { label: 'Faulty Boards', value: stats.faulty_boards, icon: '⚠️', color: 'var(--accent-red)' },
          { label: 'Passed Boards', value: stats.ok_boards, icon: '✅', color: 'var(--accent-green)' },
          { label: 'Defect Rate', value: `${stats.defect_rate}%`, icon: '📈', color: 'var(--accent-orange)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-label">{label}</div>
              </div>
              <div className="stat-icon">{icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Severity Pie */}
        <div className="card">
          <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: 16 }}>Severity Distribution</h3>
          {sevData.length === 0
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data yet</p>
            : <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {sevData.map((e, i) => <Cell key={i} fill={SEV[e.name]?.color || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>}
        </div>

        {/* Top defect types */}
        <div className="card">
          <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: 16 }}>Top Defect Types</h3>
          {defTypeData.length === 0
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No defects yet</p>
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={defTypeData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(v, _, p) => [v, p.payload.fullName]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {defTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>}
        </div>
      </div>

      {/* Defect count trend */}
      {trendData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: 16 }}>Defect Count Trend (Recent Scans)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="defGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Area type="monotone" dataKey="Defects" stroke="#ff4d6d" fill="url(#defGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pass/Fail ratio */}
      <div className="card">
        <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: 16 }}>Board Pass / Fail Ratio</h3>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            {[
              ['✅ Passed', stats.ok_boards, stats.total_scans, 'var(--accent-green)'],
              ['❌ Faulty', stats.faulty_boards, stats.total_scans, 'var(--accent-red)'],
            ].map(([label, val, total, color]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color }}>{label} ({val})</span>
                  <span style={{ fontSize: 13 }}>{total > 0 ? Math.round(val / total * 100) : 0}%</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${total > 0 ? val / total * 100 : 0}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', padding: '0 20px', borderLeft: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 44, fontFamily: 'Space Grotesk', fontWeight: 700,
              color: stats.defect_rate > 50 ? 'var(--accent-red)' : 'var(--accent-green)'
            }}>
              {100 - stats.defect_rate}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pass Rate</div>
          </div>
        </div>
      </div>

      {/* ── SPC Control Chart ── */}
      <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, margin: 0 }}>📉 Statistical Process Control</h3>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border)'
          }}>3σ Shewhart Chart</span>
        </div>
        <SPCChart />
      </div>

      {/* ── DBSCAN Spatial Cluster Map ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, margin: 0 }}>📍 Defect Spatial Clustering</h3>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border)'
          }}>DBSCAN Algorithm</span>
        </div>
        <ClusterMap />
      </div>

    </div>
  );
}

// --- APP ---
export default function App() {
  const [results, setResults] = useState(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('spotbot-theme');
    return saved ? saved === 'dark' : true;   // default dark
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('spotbot-theme', dark ? 'dark' : 'light');
  }, [dark]);


  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<ScanPage setResults={setResults} />} />
          <Route path="/results" element={<ResultsPage results={results} />} />
          <Route path="/history" element={<HistoryPage setResults={setResults} />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </Router>
    </ThemeCtx.Provider>
  );
}
