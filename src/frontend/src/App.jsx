import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, RotateCcw } from 'lucide-react';
import Header from './components/Header';
import DomainInput from './components/DomainInput';
import RuleCards from './components/RuleCards';
import ScorePanel from './components/ScorePanel';
import VisualizationSection from './components/VisualizationSection';
import MlVisualizationSection from './components/MlVisualizationSection';
import LogConsole from './components/LogConsole';
import HistoryTable from './components/HistoryTable';
import StatsPanel from './components/StatsPanel';
import './index.css';

const getApiBase = () => {
  let url = (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').trim();
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
};

const API_BASE = getApiBase();


function App() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mlResult, setMlResult] = useState(null);
  const [activeTab, setActiveTab] = useState('rule');
  const [mlFeatures, setMlFeatures] = useState(null);
  const [mlHistory, setMlHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    fast_flux_count: 0,
    suspicious_count: 0,
    benign_count: 0,
    avg_score: 0
  });
  const [mlStats, setMlStats] = useState({
    total: 0,
    fast_flux_count: 0,
    suspicious_count: 0,
    benign_count: 0,
    avg_score: 0
  });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/history`);
      setHistory(response.data.history);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const computeFinalMetrics = (predictions) => {
    const rfVote = Number(predictions.rf || 0);
    const gbVote = Number(predictions.gb || 0);
    const votes = rfVote + gbVote;
    const score = Math.round((votes / 2) * 100);
    let riskLevel = 'low';
    if (votes === 1) {
      riskLevel = 'medium';
    }
    if (votes === 2) {
      riskLevel = 'high';
    }
    const classification = votes >= 1 ? 'Malicious' : 'Benign';
    const descriptor = votes === 2
      ? 'Both models flag this domain as malicious.'
      : votes === 1
        ? 'One model flags this domain as malicious.'
        : 'Both models classify this domain as benign.';

    return {
      rfVote,
      gbVote,
      votes,
      score,
      riskLevel,
      classification,
      descriptor
    };
  };

  const buildFeaturePayload = (ruleDetails = []) => {
    const features = {
      ip_count: 0,
      ttl_median: 0,
      asn_count: 0,
      country_count: 0,
      domain_age_days: 0
    };

    ruleDetails.forEach((rule) => {
      const value = Number(rule.value);
      if (Number.isNaN(value)) {
        return;
      }

      switch (rule.name) {
        case 'IP_Count':
          features.ip_count = value;
          break;
        case 'Median_TTL':
          features.ttl_median = value;
          break;
        case 'ASN_Diversity':
          features.asn_count = value;
          break;
        case 'Geo_Diversity':
          features.country_count = value;
          break;
        case 'Domain_Age':
          features.domain_age_days = value;
          break;
        default:
          break;
      }
    });

    return features;
  };

  const requestPrediction = async (ruleDetails = [], domainName, options = {}) => {
    const payload = buildFeaturePayload(ruleDetails);
    const resolvedDomain = domainName || domain;
    const { trackHistory = true, timestamp } = options;
    setMlFeatures(payload);

    try {
      const response = await axios.post(`${API_BASE}/predict`, payload);
      setMlResult(response.data);

      if (trackHistory && resolvedDomain) {
        const metrics = computeFinalMetrics(response.data);
        const recordTimestamp = timestamp || new Date().toISOString();

        setMlHistory((prev) => [
          {
            domain: resolvedDomain,
            final_score: metrics.score,
            classification: metrics.classification,
            risk_level: metrics.riskLevel,
            timestamp: recordTimestamp,
            predictions: response.data,
            features: payload,
            descriptor: metrics.descriptor
          },
          ...prev
        ]);

        setMlStats((prev) => {
          const total = prev.total + 1;
          const fastFlux = prev.fast_flux_count + (metrics.riskLevel === 'high' ? 1 : 0);
          const suspicious = prev.suspicious_count + (metrics.riskLevel === 'medium' ? 1 : 0);
          const benign = prev.benign_count + (metrics.riskLevel === 'low' ? 1 : 0);
          const avgScore = ((prev.avg_score * prev.total) + metrics.score) / total;

          return {
            total,
            fast_flux_count: fastFlux,
            suspicious_count: suspicious,
            benign_count: benign,
            avg_score: avgScore
          };
        });
      }
    } catch (err) {
      console.error('ML prediction failed:', err);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError('');
    setLogs([]);
    setMlResult(null);
    setMlFeatures(null);
    setActiveTab('rule');
    
    if (!domain.trim()) {
      setError('Please enter a domain name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/analyze`, { domain });
      setResult(response.data);
      setLogs(response.data.logs || []);
      requestPrediction(response.data.rule_details || [], domain);
      
      setTimeout(() => {
        fetchHistory();
        fetchStats();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Please try again.');
      setLogs(err.response?.data?.logs || []);
      setMlResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setDomain('');
    setResult(null);
    setMlResult(null);
    setMlFeatures(null);
    setLogs([]);
    setError('');
    setActiveTab('rule');
  };

  const handleHistoryClick = (historyItem) => {
    setDomain(historyItem.domain);
    setResult(historyItem);
    setLogs(historyItem.logs || []);
    setActiveTab('rule');
    requestPrediction(historyItem.rule_details || [], historyItem.domain, { trackHistory: false, timestamp: historyItem.timestamp });
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/export/csv`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'fastflux_analysis.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportMl = () => {
    if (!mlHistory.length) {
      return;
    }

    const header = 'Domain,Final Score,Classification,Risk Level,Timestamp,Random Forest,Gradient Boosting\n';
    const rows = mlHistory.map((item) => {
      const rfVote = Number(item.predictions?.rf || 0);
      const gbVote = Number(item.predictions?.gb || 0);
      return [
        item.domain,
        item.final_score,
        item.classification,
        item.risk_level,
        new Date(item.timestamp).toLocaleString(),
        rfVote,
        gbVote
      ].join(',');
    }).join('\n');

    const csv = `${header}${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ml_predictions.csv');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleMlHistoryClick = (historyItem) => {
    setDomain(historyItem.domain);
    setActiveTab('ml');
    setMlResult(historyItem.predictions);
    setMlFeatures(historyItem.features || null);
  };

  const isMlContext = activeTab === 'ml' || activeTab === 'final';

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <DomainInput 
          domain={domain}
          setDomain={setDomain}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
          loading={loading}
          error={error}
        />

        {result && (
          <>
            <ScorePanel
              result={result}
              mlResult={mlResult}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            {activeTab === 'rule' && (
              <>
                <RuleCards rules={result.rule_details} />
                <VisualizationSection
                  rules={result.rule_details}
                  features={result}
                />
              </>
            )}
            {activeTab === 'ml' && mlResult && (
              <MlVisualizationSection
                features={mlFeatures}
                predictions={mlResult}
              />
            )}
          </>
        )}

        {!isMlContext && logs.length > 0 && <LogConsole logs={logs} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <StatsPanel stats={isMlContext ? mlStats : stats} />
          <div className="card flex flex-col gap-4 justify-between">
            <h3 className="text-lg font-semibold text-neon-cyan flex items-center gap-2">
              <Download size={20} />
              Quick Actions
            </h3>
            <button
              onClick={isMlContext ? handleExportMl : handleExport}
              className="btn-primary w-full"
            >
              {isMlContext ? 'Export ML Results' : 'Export to CSV'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Reset Dashboard
            </button>
          </div>
        </div>

        {!isMlContext && history.length > 0 && (
          <HistoryTable history={history} onRowClick={handleHistoryClick} />
        )}

        {isMlContext && mlHistory.length > 0 && (
          <HistoryTable history={mlHistory} onRowClick={handleMlHistoryClick} />
        )}
      </main>
    </div>
  );
}

export default App;
