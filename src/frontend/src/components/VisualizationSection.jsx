import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';

const VisualizationSection = ({ rules, features }) => {
  const chartData = rules.map((rule, idx) => ({
    name: rule.name.replace(/_/g, '\n'),
    score: rule.score,
    max: rule.max_weight
  })).filter(item => item.max > 0);

  const riskDistribution = [
    { name: 'High Risk', value: rules.filter(r => r.status === 'high_risk').length, color: '#ef4444' },
    { name: 'Medium Risk', value: rules.filter(r => r.status === 'medium_risk').length, color: '#f97316' },
    { name: 'Low Risk', value: rules.filter(r => r.status === 'low_risk').length, color: '#22c55e' }
  ].filter(item => item.value > 0);

  const scoreContribution = rules.map((rule, idx) => ({
    name: rule.name.replace(/_/g, ' '),
    value: rule.score,
    color: rule.status === 'high_risk' ? '#ef4444' :
           rule.status === 'medium_risk' ? '#f97316' :
           '#22c55e'
  })).filter(item => item.value > 0);

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-6 text-neon-cyan flex items-center gap-2">
        <BarChart3 size={24} />
        Analytics & Visualizations
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-neon-cyan">Score by Rule</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                cursor={{ fill: 'rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="score" fill="#00ffff" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-neon-cyan">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-neon-cyan">Score Contribution Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreContribution} layout="vertical" margin={{ top: 5, right: 30, left: 300, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" width={290} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="#00ffff" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default VisualizationSection;
