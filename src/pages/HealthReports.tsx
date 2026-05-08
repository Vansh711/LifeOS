import { useState, useEffect, useRef } from 'react';
import { supabase, HealthReport, HealthCondition } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { analyzeReport } from '../lib/gemini';
import {
  FileText, Upload, Trash2, Sparkles, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, FlaskConical
} from 'lucide-react';

export default function HealthReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('blood_test');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [reportsRes, conditionsRes] = await Promise.all([
        supabase.from('health_reports').select('*').eq('user_id', user.id).order('uploaded_at', { ascending: false }),
        supabase.from('health_conditions').select('*').eq('user_id', user.id),
      ]);
      setReports(reportsRes.data ?? []);
      setConditions(conditionsRes.data ?? []);
    })();
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const name = reportName || file.name.replace(/\.[^/.]+$/, '');
        const { data, error } = await supabase.from('health_reports').insert({
          user_id: user.id,
          report_name: name,
          report_type: reportType,
          file_data: base64,
          file_name: file.name,
          file_type: file.type,
        }).select().maybeSingle();
        if (!error && data) {
          setReports(r => [data, ...r]);
          setReportName('');
          if (fileRef.current) fileRef.current.value = '';
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }

  async function handleAnalyze(report: HealthReport) {
    if (!user) return;
    setAnalyzing(report.id);
    try {
      const conditionNames = conditions.map(c => c.condition_name);
      const result = await analyzeReport(report.file_data ?? '', report.file_name ?? report.report_name, conditionNames);
      await supabase.from('health_reports').update({
        ai_analysis: result.analysis,
        key_findings: result.key_findings,
      }).eq('id', report.id);
      setReports(rs => rs.map(r => r.id === report.id
        ? { ...r, ai_analysis: result.analysis, key_findings: result.key_findings }
        : r
      ));
      setExpandedId(report.id);
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('health_reports').delete().eq('id', id);
    setReports(rs => rs.filter(r => r.id !== id));
  }

  const REPORT_TYPES = [
    { value: 'blood_test', label: 'Blood Test' },
    { value: 'urine_test', label: 'Urine Test' },
    { value: 'x_ray', label: 'X-Ray' },
    { value: 'mri_ct', label: 'MRI/CT Scan' },
    { value: 'ecg', label: 'ECG/EKG' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#060b14] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Health Reports</h1>
          <p className="text-slate-400 mt-1 text-sm">Upload and get AI analysis of your medical reports</p>
        </div>

        {/* Upload */}
        <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" /> Upload Report
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="e.g. Annual Blood Test 2026"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2">Report Type</label>
              <select
                value={reportType} onChange={e => setReportType(e.target.value)}
                className="w-full bg-[#0d1f3c] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
              >
                {REPORT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            uploading ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/10 bg-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5'
          }`}>
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-cyan-400 text-sm">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-500" />
                <p className="text-slate-400 text-sm"><span className="text-cyan-400 font-medium">Click to upload</span> or drag & drop</p>
                <p className="text-slate-600 text-xs">PDF, PNG, JPG up to 10MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="bg-[#0d1f3c]/40 border border-white/5 rounded-2xl p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No reports uploaded yet</p>
            <p className="text-slate-600 text-sm mt-1">Upload your blood tests, scans, or other medical reports for AI analysis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div key={report.id} className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{report.report_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {REPORT_TYPES.find(t => t.value === report.report_type)?.label ?? report.report_type} •{' '}
                        {new Date(report.uploaded_at).toLocaleDateString()}
                      </p>
                      {report.file_name && (
                        <p className="text-slate-600 text-xs mt-0.5 truncate">{report.file_name}</p>
                      )}
                      {report.ai_analysis && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-xs">AI Analysis Complete</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!report.ai_analysis ? (
                      <button
                        onClick={() => handleAnalyze(report)}
                        disabled={analyzing === report.id}
                        className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 transition-all flex items-center gap-1.5"
                      >
                        {analyzing === report.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Analysing...</>
                          : <><Sparkles className="w-3 h-3" /> Analyse</>
                        }
                      </button>
                    ) : (
                      <button
                        onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                        className="bg-white/5 border border-white/10 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        View {expandedId === report.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="text-slate-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/5 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedId === report.id && report.ai_analysis && (
                  <div className="border-t border-white/5 p-5 space-y-4">
                    {report.key_findings && report.key_findings.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-cyan-400" /> Key Findings
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {report.key_findings.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg p-3">
                              <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                              <p className="text-slate-300 text-xs leading-relaxed">{f}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white mb-2">Detailed Analysis</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{report.ai_analysis}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
