import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
  ComposedChart
} from 'recharts';
import { assignmentAPI } from '../services/api';

interface ChartAnalyticsData {
  sdrConsultantMatrix: Array<{
    sdr_name: string;
    consultant_name: string;
    assignment_count: number;
    completion_rate: number;
    first_assignment: string;
    last_assignment: string;
  }>;
  consultantDistribution: Array<{
    consultant_name: string;
    total_assignments: number;
    manual_assignments: number;
    automatic_assignments: number;
    active_assignments: number;
    completed_assignments: number;
  }>;
  assignmentTrends: Array<{
    assignment_date: string;
    total_assignments: number;
    manual_assignments: number;
    automatic_assignments: number;
  }>;
  sdrBiasAnalysis: Array<{
    sdr_name: string;
    consultant_name: string;
    assignments: number;
    percentage_to_consultant: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const ChartAnalytics: React.FC = () => {
  const [data, setData] = useState<ChartAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string>('overview');

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const chartData = await assignmentAPI.getChartAnalytics();
      setData(chartData);
    } catch (err: any) {
      setError('Failed to load chart analytics');
      console.error('Chart analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="error">No data available</div>;

  // Process data for bias detection - find SDRs who show preference patterns
  const processedBiasData = data.sdrBiasAnalysis.reduce((acc: any[], item) => {
    const existing = acc.find(x => x.sdr_name === item.sdr_name);
    if (existing) {
      existing.consultants.push({
        name: item.consultant_name,
        percentage: item.percentage_to_consultant,
        assignments: item.assignments
      });
    } else {
      acc.push({
        sdr_name: item.sdr_name,
        consultants: [{
          name: item.consultant_name,
          percentage: item.percentage_to_consultant,
          assignments: item.assignments
        }]
      });
    }
    return acc;
  }, []);

  // Find SDRs with potential bias (>60% to single consultant)
  const biasAlerts = processedBiasData.filter(sdr => 
    sdr.consultants.some((c: any) => c.percentage > 60 && c.assignments > 3)
  );

  // Prepare heatmap data for SDR-Consultant matrix
  const heatmapData = data.sdrConsultantMatrix.map(item => ({
    sdr: item.sdr_name,
    consultant: item.consultant_name,
    assignments: item.assignment_count,
    completionRate: Math.round(item.completion_rate * 100)
  }));

  // Consultant workload comparison
  const consultantWorkload = data.consultantDistribution.map(item => ({
    name: item.consultant_name,
    total: item.total_assignments,
    manual: item.manual_assignments,
    automatic: item.automatic_assignments,
    active: item.active_assignments,
    completed: item.completed_assignments,
    completionRate: item.total_assignments > 0 ? 
      Math.round((item.completed_assignments / item.total_assignments) * 100) : 0
  }));

  // Filter out consultants with zero assignments for pie chart
  const consultantDistributionForPie = consultantWorkload.filter(item => item.total > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="label">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-analytics">
      <div className="analytics-header">
        <h2>📊 Advanced Assignment Analytics</h2>
        <div className="view-selector">
          <button 
            className={activeView === 'overview' ? 'active' : ''}
            onClick={() => setActiveView('overview')}
          >
            Overview
          </button>
          <button 
            className={activeView === 'bias' ? 'active' : ''}
            onClick={() => setActiveView('bias')}
          >
            Bias Analysis
          </button>
          <button 
            className={activeView === 'trends' ? 'active' : ''}
            onClick={() => setActiveView('trends')}
          >
            Trends
          </button>
          <button 
            className={activeView === 'workload' ? 'active' : ''}
            onClick={() => setActiveView('workload')}
          >
            Workload
          </button>
        </div>
      </div>

      {activeView === 'overview' && (
        <div className="overview-charts">
          <div className="chart-grid">
            <div className="chart-container">
              <h3>Assignment Distribution by Consultant</h3>
              {consultantDistributionForPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={consultantDistributionForPie}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({name, value, percent}) => 
                        value && value > 0 ? `${name}: ${value} (${(percent! * 100).toFixed(0)}%)` : ''
                      }
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {consultantDistributionForPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="chart-tooltip">
                              <p><strong>{data.name}</strong></p>
                              <p>Total Assignments: {data.total}</p>
                              <p>Manual: {data.manual}</p>
                              <p>Automatic: {data.automatic}</p>
                              <p>Completion Rate: {data.completionRate}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">
                  <p>No assignments yet. Create some assignments to see the distribution.</p>
                </div>
              )}
            </div>

            <div className="chart-container">
              <h3>Manual vs Automatic Assignments</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={consultantWorkload}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="manual" stackId="a" fill="#FF8042" name="Manual" />
                  <Bar dataKey="automatic" stackId="a" fill="#0088FE" name="Automatic" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container full-width">
            <h3>Assignment Trends (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.assignmentTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="assignment_date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="total_assignments" 
                  fill="#8884d8" 
                  stroke="#8884d8"
                  name="Total Assignments"
                />
                <Bar dataKey="manual_assignments" fill="#FF8042" name="Manual" />
                <Line 
                  type="monotone" 
                  dataKey="automatic_assignments" 
                  stroke="#00C49F" 
                  strokeWidth={2}
                  name="Automatic"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'bias' && (
        <div className="bias-analysis">
          <div className="bias-alerts">
            <h3>🚨 Potential Assignment Bias Detected</h3>
            {biasAlerts.length === 0 ? (
              <div className="no-bias">
                ✅ No significant bias patterns detected. Assignment distribution appears fair.
              </div>
            ) : (
              biasAlerts.map((alert, index) => (
                <div key={index} className="bias-alert">
                  <h4>{alert.sdr_name}</h4>
                  <p>Shows preference patterns:</p>
                  <ul>
                    {alert.consultants
                      .filter((c: any) => c.percentage > 60)
                      .map((consultant: any, i: number) => (
                        <li key={i}>
                          <strong>{consultant.name}</strong>: {consultant.percentage.toFixed(1)}% 
                          ({consultant.assignments} assignments)
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="chart-container">
            <h3>SDR Assignment Patterns Matrix</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="category" dataKey="sdr" name="SDR" />
                <YAxis type="category" dataKey="consultant" name="Consultant" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <p>{`SDR: ${data.sdr}`}</p>
                          <p>{`Consultant: ${data.consultant}`}</p>
                          <p>{`Assignments: ${data.assignments}`}</p>
                          <p>{`Completion Rate: ${data.completionRate}%`}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  data={heatmapData} 
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'trends' && (
        <div className="trends-analysis">
          <div className="chart-container">
            <h3>Assignment Volume Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.assignmentTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="assignment_date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total_assignments" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Total"
                />
                <Line 
                  type="monotone" 
                  dataKey="manual_assignments" 
                  stroke="#FF8042" 
                  strokeWidth={2}
                  name="Manual"
                />
                <Line 
                  type="monotone" 
                  dataKey="automatic_assignments" 
                  stroke="#00C49F" 
                  strokeWidth={2}
                  name="Automatic"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Manual vs Automatic Ratio</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.assignmentTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="assignment_date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="automatic_assignments"
                  stackId="1"
                  stroke="#00C49F"
                  fill="#00C49F"
                  name="Automatic"
                />
                <Area
                  type="monotone"
                  dataKey="manual_assignments"
                  stackId="1"
                  stroke="#FF8042"
                  fill="#FF8042"
                  name="Manual"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'workload' && (
        <div className="workload-analysis">
          <div className="chart-container">
            <h3>Consultant Workload Distribution</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={consultantWorkload} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="active" fill="#FFBB28" name="Active" />
                <Bar dataKey="completed" fill="#00C49F" name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Completion Rate by Consultant</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={consultantWorkload}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="chart-tooltip">
                          <p>{`${label}`}</p>
                          <p>{`Completion Rate: ${payload[0].value}%`}</p>
                          <p>{`Total Assignments: ${payload[0].payload.total}`}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="completionRate" fill="#8884D8" name="Completion Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <style>{`
        .chart-analytics {
          padding: 2rem;
        }

        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 2px solid #eee;
          padding-bottom: 1rem;
        }

        .view-selector {
          display: flex;
          gap: 0.5rem;
        }

        .view-selector button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          color: #333;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .view-selector button:hover {
          background: #f8f9fa;
          border-color: #007bff;
          color: #007bff;
        }

        .view-selector button.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .chart-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .chart-container {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid #eee;
        }

        .chart-container.full-width {
          grid-column: 1 / -1;
        }

        .chart-container h3 {
          margin: 0 0 1rem 0;
          color: #333;
          font-size: 1.1rem;
        }

        .chart-tooltip {
          background: white;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .bias-alerts {
          margin-bottom: 2rem;
        }

        .bias-alert {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .bias-alert h4 {
          margin: 0 0 0.5rem 0;
          color: #856404;
        }

        .no-bias {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 4px;
          padding: 1rem;
          color: #155724;
        }

        .loading, .error {
          text-align: center;
          padding: 2rem;
          font-size: 1.1rem;
        }

        .error {
          color: #dc3545;
        }

        .no-data {
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
          background: #f8f9fa;
          border-radius: 4px;
          margin: 1rem 0;
        }

        .no-data p {
          margin: 0;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .chart-grid {
            grid-template-columns: 1fr;
          }
          
          .analytics-header {
            flex-direction: column;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ChartAnalytics;