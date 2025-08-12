import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/reassignment-analytics.css';

interface OverallStats {
  totalReassignments: number;
  successfulReassignments: number;
  failedReassignments: number;
  avgProcessingTime: number;
  avgReassignmentsPerLead: number;
  maxReassignmentsSingleLead: number;
  uniqueLeadsReassigned: number;
  skillsBasedReassignments: number;
  userInitiated: number;
  systemInitiated: number;
  adminInitiated: number;
  successRate: number;
}

interface ConsultantStats {
  consultantName: string;
  timesReassignedTo: number;
  avgSkillsMatchScore: number;
}

interface SDRStats {
  username: string;
  sdrName: string;
  totalReassignments: number;
  avgProcessingTime: number;
  uniqueLeadsReassigned: number;
}

interface DailyTrend {
  date: string;
  reassignmentsCount: number;
  avgProcessingTime: number;
  successfulCount: number;
}

interface ReasonAnalysis {
  reason: string;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  overallStats: OverallStats;
  consultantStats: ConsultantStats[];
  sdrStats: SDRStats[];
  dailyTrends: DailyTrend[];
  reasonAnalysis: ReasonAnalysis[];
}

const ReassignmentAnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedSDR, setSelectedSDR] = useState<string>('');
  const [selectedConsultant, setSelectedConsultant] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAnalytics();
    }
  }, [user, dateRange, selectedSDR, selectedConsultant]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      if (selectedSDR) params.append('sdrId', selectedSDR);
      if (selectedConsultant) params.append('consultantId', selectedConsultant);

      const response = await fetch(`/api/reassignments/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load analytics data');
      }

      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to load reassignment analytics:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="reassignment-analytics-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>Admin access required to view reassignment analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reassignment-analytics-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>📊 Reassignment Analytics Dashboard</h1>
          <p>Comprehensive tracking and analysis of assignment reassignments</p>
        </div>
        
        <div className="dashboard-controls">
          <div className="date-range-controls">
            <div className="control-group">
              <label>Start Date:</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="control-group">
              <label>End Date:</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="filter-controls">
            <div className="control-group">
              <label>SDR:</label>
              <select 
                value={selectedSDR} 
                onChange={(e) => setSelectedSDR(e.target.value)}
              >
                <option value="">All SDRs</option>
                {analyticsData?.sdrStats.map(sdr => (
                  <option key={sdr.username} value={sdr.username}>
                    {sdr.sdrName} ({sdr.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label>Consultant:</label>
              <select 
                value={selectedConsultant} 
                onChange={(e) => setSelectedConsultant(e.target.value)}
              >
                <option value="">All Consultants</option>
                {analyticsData?.consultantStats.map(consultant => (
                  <option key={consultant.consultantName} value={consultant.consultantName}>
                    {consultant.consultantName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={loadAnalytics} 
            className="refresh-button"
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">Loading analytics...</div>
        </div>
      ) : analyticsData && (
        <>
          {/* Overall Statistics */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>📈 Overall Statistics</h2>
              <span className="date-range">
                {formatDate(analyticsData.dateRange.startDate)} - {formatDate(analyticsData.dateRange.endDate)}
              </span>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-icon">🔄</div>
                <div className="stat-content">
                  <div className="stat-value">{analyticsData.overallStats.totalReassignments}</div>
                  <div className="stat-label">Total Reassignments</div>
                </div>
              </div>
              
              <div className="stat-card success">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-value">{analyticsData.overallStats.successRate}%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
              </div>
              
              <div className="stat-card info">
                <div className="stat-icon">⚡</div>
                <div className="stat-content">
                  <div className="stat-value">{formatDuration(analyticsData.overallStats.avgProcessingTime)}</div>
                  <div className="stat-label">Avg Processing Time</div>
                </div>
              </div>
              
              <div className="stat-card warning">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <div className="stat-value">{analyticsData.overallStats.avgReassignmentsPerLead.toFixed(1)}</div>
                  <div className="stat-label">Avg per Lead</div>
                </div>
              </div>
              
              <div className="stat-card neutral">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-value">{analyticsData.overallStats.skillsBasedReassignments}</div>
                  <div className="stat-label">Skills-Based</div>
                </div>
              </div>
              
              <div className="stat-card secondary">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-value">{analyticsData.overallStats.uniqueLeadsReassigned}</div>
                  <div className="stat-label">Unique Leads</div>
                </div>
              </div>
            </div>
          </div>

          {/* Reassignment Sources Breakdown */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>📊 Reassignment Sources</h2>
            </div>
            
            <div className="source-breakdown">
              <div className="source-item">
                <div className="source-label">👤 User Initiated</div>
                <div className="source-bar">
                  <div 
                    className="source-fill user" 
                    style={{ 
                      width: `${(analyticsData.overallStats.userInitiated / analyticsData.overallStats.totalReassignments) * 100}%` 
                    }}
                  />
                </div>
                <div className="source-value">{analyticsData.overallStats.userInitiated}</div>
              </div>
              
              <div className="source-item">
                <div className="source-label">🤖 System Initiated</div>
                <div className="source-bar">
                  <div 
                    className="source-fill system" 
                    style={{ 
                      width: `${(analyticsData.overallStats.systemInitiated / analyticsData.overallStats.totalReassignments) * 100}%` 
                    }}
                  />
                </div>
                <div className="source-value">{analyticsData.overallStats.systemInitiated}</div>
              </div>
              
              <div className="source-item">
                <div className="source-label">👨‍💼 Admin Override</div>
                <div className="source-bar">
                  <div 
                    className="source-fill admin" 
                    style={{ 
                      width: `${(analyticsData.overallStats.adminInitiated / analyticsData.overallStats.totalReassignments) * 100}%` 
                    }}
                  />
                </div>
                <div className="source-value">{analyticsData.overallStats.adminInitiated}</div>
              </div>
            </div>
          </div>

          {/* Daily Trends */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>📈 Daily Trends</h2>
            </div>
            
            <div className="trends-chart">
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-color trends-total"></div>
                  <span>Total Reassignments</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color trends-success"></div>
                  <span>Successful</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color trends-processing"></div>
                  <span>Processing Time (ms)</span>
                </div>
              </div>
              
              <div className="chart-container">
                {analyticsData.dailyTrends.slice(0, 14).map((trend, index) => (
                  <div key={trend.date} className="trend-bar-group">
                    <div className="trend-date">{formatDate(trend.date)}</div>
                    <div className="trend-bars">
                      <div 
                        className="trend-bar total-bar"
                        style={{ 
                          height: `${Math.min((trend.reassignmentsCount / Math.max(...analyticsData.dailyTrends.map(t => t.reassignmentsCount), 1)) * 100, 100)}px` 
                        }}
                        title={`Total: ${trend.reassignmentsCount}`}
                      />
                      <div 
                        className="trend-bar success-bar"
                        style={{ 
                          height: `${Math.min((trend.successfulCount / Math.max(...analyticsData.dailyTrends.map(t => t.reassignmentsCount), 1)) * 100, 100)}px` 
                        }}
                        title={`Successful: ${trend.successfulCount}`}
                      />
                      <div 
                        className="trend-bar processing-bar"
                        style={{ 
                          height: `${Math.min((trend.avgProcessingTime / Math.max(...analyticsData.dailyTrends.map(t => t.avgProcessingTime), 1)) * 50, 50)}px` 
                        }}
                        title={`Avg Processing: ${formatDuration(trend.avgProcessingTime)}`}
                      />
                    </div>
                    <div className="trend-values">
                      <div className="trend-value total">{trend.reassignmentsCount}</div>
                      <div className="trend-value success">{trend.successfulCount}</div>
                      <div className="trend-value processing">{formatDuration(trend.avgProcessingTime)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Consultants */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>👨‍💼 Most Reassigned-To Consultants</h2>
            </div>
            
            <div className="consultants-table">
              <table>
                <thead>
                  <tr>
                    <th>Consultant</th>
                    <th>Times Assigned To</th>
                    <th>Avg Skills Match</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.consultantStats.slice(0, 10).map((consultant, index) => (
                    <tr key={consultant.consultantName}>
                      <td className="consultant-name">
                        <div className="rank-badge">{index + 1}</div>
                        {consultant.consultantName}
                      </td>
                      <td className="assignment-count">{consultant.timesReassignedTo}</td>
                      <td className="skills-match">
                        {consultant.avgSkillsMatchScore ? 
                          `${(consultant.avgSkillsMatchScore * 100).toFixed(1)}%` : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SDR Performance */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>👤 SDR Reassignment Activity</h2>
            </div>
            
            <div className="sdr-performance">
              {analyticsData.sdrStats.map((sdr, index) => (
                <div key={sdr.username} className="sdr-card">
                  <div className="sdr-header">
                    <div className="sdr-info">
                      <div className="sdr-name">{sdr.sdrName}</div>
                      <div className="sdr-username">@{sdr.username}</div>
                    </div>
                    <div className="sdr-rank">#{index + 1}</div>
                  </div>
                  
                  <div className="sdr-stats">
                    <div className="sdr-stat">
                      <div className="stat-icon">🔄</div>
                      <div className="stat-info">
                        <div className="stat-value">{sdr.totalReassignments}</div>
                        <div className="stat-label">Total Reassignments</div>
                      </div>
                    </div>
                    
                    <div className="sdr-stat">
                      <div className="stat-icon">👥</div>
                      <div className="stat-info">
                        <div className="stat-value">{sdr.uniqueLeadsReassigned}</div>
                        <div className="stat-label">Unique Leads</div>
                      </div>
                    </div>
                    
                    <div className="sdr-stat">
                      <div className="stat-icon">⚡</div>
                      <div className="stat-info">
                        <div className="stat-value">{formatDuration(sdr.avgProcessingTime)}</div>
                        <div className="stat-label">Avg Processing</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reassignment Reasons */}
          <div className="analytics-section">
            <div className="section-header">
              <h2>💭 Reassignment Reasons</h2>
            </div>
            
            <div className="reasons-analysis">
              {analyticsData.reasonAnalysis.map((reason, index) => (
                <div key={index} className="reason-item">
                  <div className="reason-info">
                    <div className="reason-text">
                      {reason.reason || 'No reason provided'}
                    </div>
                    <div className="reason-stats">
                      <span className="reason-count">{reason.count} times</span>
                      <span className="reason-percentage">{reason.percentage}%</span>
                    </div>
                  </div>
                  <div className="reason-bar">
                    <div 
                      className="reason-fill" 
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReassignmentAnalyticsDashboard;