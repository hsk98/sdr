import React, { useState, useEffect } from 'react';
import {
  SkillAnalytics,
  SkillDemandData,
  SKILL_CATEGORIES,
  SkillCategory
} from '../types/skills';
import '../styles/skills-analytics.css';

interface AnalyticsPeriod {
  label: string;
  value: string;
  days: number;
}

interface SkillGapAnalysis {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  currentSupply: number;
  currentDemand: number;
  gap: number;
  gapPercentage: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedActions: string[];
}

interface AssignmentTrend {
  date: string;
  totalAssignments: number;
  skillsBasedAssignments: number;
  successRate: number;
  averageMatchScore: number;
}

const SkillsAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [skillsAnalytics, setSkillsAnalytics] = useState<SkillAnalytics[]>([]);
  const [demandData, setDemandData] = useState<SkillDemandData[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<SkillGapAnalysis[]>([]);
  const [assignmentTrends, setAssignmentTrends] = useState<AssignmentTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');

  const periods: AnalyticsPeriod[] = [
    { label: 'Last 7 Days', value: '7', days: 7 },
    { label: 'Last 30 Days', value: '30', days: 30 },
    { label: 'Last 90 Days', value: '90', days: 90 },
    { label: 'Last 6 Months', value: '180', days: 180 },
    { label: 'Last Year', value: '365', days: 365 }
  ];

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, selectedCategory]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, demandRes, gapRes, trendsRes] = await Promise.all([
        fetch(`/api/admin/skills/analytics?period=${selectedPeriod}&category=${selectedCategory}`),
        fetch(`/api/admin/skills/demand-analysis?period=${selectedPeriod}&category=${selectedCategory}`),
        fetch(`/api/admin/skills/gap-analysis?category=${selectedCategory}`),
        fetch(`/api/admin/skills/assignment-trends?period=${selectedPeriod}`)
      ]);

      const [analytics, demand, gaps, trends] = await Promise.all([
        analyticsRes.json(),
        demandRes.json(),
        gapRes.json(),
        trendsRes.json()
      ]);

      setSkillsAnalytics(analytics);
      setDemandData(demand);
      setGapAnalysis(gaps);
      setAssignmentTrends(trends);
    } catch (error) {
      console.error('[SkillsAnalyticsDashboard] Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    const colors = {
      low: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
      medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
      high: { bg: '#fef3c7', text: '#d97706', border: '#f59e0b' },
      critical: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
    };
    return colors[urgency as keyof typeof colors] || colors.low;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return '#10b981';
    if (rate >= 75) return '#f59e0b';
    if (rate >= 60) return '#ef4444';
    return '#6b7280';
  };

  const calculateOverallMetrics = () => {
    if (skillsAnalytics.length === 0) return null;

    const totalConsultants = skillsAnalytics.reduce((sum, skill) => sum + skill.consultantCount, 0);
    const totalDemand = skillsAnalytics.reduce((sum, skill) => sum + skill.demandCount, 0);
    const averageSuccessRate = skillsAnalytics.reduce((sum, skill) => sum + skill.assignmentSuccessRate, 0) / skillsAnalytics.length;
    const averageUtilization = skillsAnalytics.reduce((sum, skill) => sum + skill.utilizationRate, 0) / skillsAnalytics.length;

    return {
      totalConsultants,
      totalDemand,
      averageSuccessRate,
      averageUtilization
    };
  };

  const overallMetrics = calculateOverallMetrics();

  if (loading) {
    return (
      <div className="skills-analytics-dashboard loading">
        <div className="loading-spinner">Loading skills analytics...</div>
      </div>
    );
  }

  return (
    <div className="skills-analytics-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h2>Skills Analytics Dashboard</h2>
          <p>Analyze skill demand, supply, and assignment effectiveness</p>
        </div>
        
        <div className="dashboard-filters">
          <div className="filter-group">
            <label>Time Period:</label>
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Category:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | 'all')}
            >
              <option value="all">All Categories</option>
              {Object.entries(SKILL_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      {overallMetrics && (
        <div className="overview-metrics">
          <div className="metric-card">
            <div className="metric-icon">👥</div>
            <div className="metric-content">
              <div className="metric-value">{overallMetrics.totalConsultants}</div>
              <div className="metric-label">Total Skilled Consultants</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <div className="metric-value">{overallMetrics.totalDemand}</div>
              <div className="metric-label">Total Skill Requests</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">✅</div>
            <div className="metric-content">
              <div className="metric-value">{overallMetrics.averageSuccessRate.toFixed(1)}%</div>
              <div className="metric-label">Average Success Rate</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon">⚡</div>
            <div className="metric-content">
              <div className="metric-value">{overallMetrics.averageUtilization.toFixed(1)}%</div>
              <div className="metric-label">Average Utilization</div>
            </div>
          </div>
        </div>
      )}

      {/* Skills Gap Analysis */}
      <div className="analytics-section">
        <div className="section-header">
          <h3>Skills Gap Analysis</h3>
          <p>Identify critical skill shortages and surpluses</p>
        </div>
        
        <div className="gap-analysis-grid">
          {gapAnalysis.map(gap => {
            const urgencyStyle = getUrgencyColor(gap.urgencyLevel);
            return (
              <div key={gap.skillId} className="gap-card">
                <div className="gap-header">
                  <div className="gap-title">
                    <h4>{gap.skillName}</h4>
                    <span className="gap-category">
                      {SKILL_CATEGORIES[gap.category]}
                    </span>
                  </div>
                  <div 
                    className="urgency-badge"
                    style={{
                      backgroundColor: urgencyStyle.bg,
                      color: urgencyStyle.text,
                      border: `1px solid ${urgencyStyle.border}`
                    }}
                  >
                    {gap.urgencyLevel.toUpperCase()}
                  </div>
                </div>
                
                <div className="gap-metrics">
                  <div className="gap-metric">
                    <span className="metric-label">Supply</span>
                    <span className="metric-value">{gap.currentSupply}</span>
                  </div>
                  <div className="gap-metric">
                    <span className="metric-label">Demand</span>
                    <span className="metric-value">{gap.currentDemand}</span>
                  </div>
                  <div className="gap-metric">
                    <span className="metric-label">Gap</span>
                    <span className={`metric-value ${gap.gap > 0 ? 'surplus' : 'shortage'}`}>
                      {gap.gap > 0 ? '+' : ''}{gap.gap}
                    </span>
                  </div>
                </div>
                
                <div className="gap-percentage">
                  <div className="percentage-bar">
                    <div 
                      className={`percentage-fill ${gap.gap >= 0 ? 'surplus' : 'shortage'}`}
                      style={{ width: `${Math.min(Math.abs(gap.gapPercentage), 100)}%` }}
                    />
                  </div>
                  <span className="percentage-text">{gap.gapPercentage.toFixed(1)}%</span>
                </div>
                
                {gap.recommendedActions.length > 0 && (
                  <div className="gap-actions">
                    <h5>Recommended Actions:</h5>
                    <ul>
                      {gap.recommendedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skill Performance Analytics */}
      <div className="analytics-section">
        <div className="section-header">
          <h3>Skill Performance Analytics</h3>
          <p>Success rates and utilization by skill</p>
        </div>
        
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Skill Name</th>
                <th>Category</th>
                <th>Consultants</th>
                <th>Demand</th>
                <th>Success Rate</th>
                <th>Avg Match Score</th>
                <th>Utilization</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {skillsAnalytics.map(skill => (
                <tr key={skill.skillId}>
                  <td className="skill-name">{skill.skillName}</td>
                  <td className="skill-category">
                    {SKILL_CATEGORIES[skill.category]}
                  </td>
                  <td className="consultant-count">{skill.consultantCount}</td>
                  <td className="demand-count">{skill.demandCount}</td>
                  <td className="success-rate">
                    <div className="success-rate-container">
                      <span 
                        className="success-rate-text"
                        style={{ color: getSuccessRateColor(skill.assignmentSuccessRate) }}
                      >
                        {skill.assignmentSuccessRate.toFixed(1)}%
                      </span>
                      <div className="success-rate-bar">
                        <div 
                          className="success-rate-fill"
                          style={{ 
                            width: `${skill.assignmentSuccessRate}%`,
                            backgroundColor: getSuccessRateColor(skill.assignmentSuccessRate)
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="match-score">{skill.averageMatchScore.toFixed(1)}%</td>
                  <td className="utilization">{skill.utilizationRate.toFixed(1)}%</td>
                  <td className="trend">
                    {skill.trendData.length > 1 && (
                      <div className="trend-indicator">
                        {skill.trendData[skill.trendData.length - 1].demand > 
                         skill.trendData[skill.trendData.length - 2].demand ? '📈' : '📉'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand vs Supply Chart */}
      <div className="analytics-section">
        <div className="section-header">
          <h3>Demand vs Supply Analysis</h3>
          <p>Visual representation of skill demand compared to available consultants</p>
        </div>
        
        <div className="demand-supply-charts">
          {demandData.map(demand => (
            <div key={demand.skillId} className="demand-chart">
              <div className="chart-header">
                <h4>{demand.skillName}</h4>
                <span className="priority-badge" data-priority={demand.priorityLevel}>
                  {demand.priorityLevel}
                </span>
              </div>
              
              <div className="chart-bars">
                <div className="bar-group">
                  <div className="bar-label">Supply</div>
                  <div className="bar supply-bar">
                    <div 
                      className="bar-fill"
                      style={{ width: `${(demand.availableConsultants / Math.max(demand.totalDemand, demand.availableConsultants)) * 100}%` }}
                    />
                    <span className="bar-value">{demand.availableConsultants}</span>
                  </div>
                </div>
                
                <div className="bar-group">
                  <div className="bar-label">Demand</div>
                  <div className="bar demand-bar">
                    <div 
                      className="bar-fill"
                      style={{ width: `${(demand.totalDemand / Math.max(demand.totalDemand, demand.availableConsultants)) * 100}%` }}
                    />
                    <span className="bar-value">{demand.totalDemand}</span>
                  </div>
                </div>
              </div>
              
              <div className="chart-metrics">
                <div className="metric">
                  <span className="metric-label">Gap:</span>
                  <span className={`metric-value ${demand.gapAnalysis >= 0 ? 'positive' : 'negative'}`}>
                    {demand.gapAnalysis}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Avg Wait:</span>
                  <span className="metric-value">{demand.averageWaitTime.toFixed(1)}h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment Trends */}
      <div className="analytics-section">
        <div className="section-header">
          <h3>Assignment Trends</h3>
          <p>Historical performance and trend analysis</p>
        </div>
        
        <div className="trends-chart">
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color total"></div>
              <span>Total Assignments</span>
            </div>
            <div className="legend-item">
              <div className="legend-color skills-based"></div>
              <span>Skills-Based</span>
            </div>
            <div className="legend-item">
              <div className="legend-color success-rate"></div>
              <span>Success Rate</span>
            </div>
          </div>
          
          <div className="chart-container">
            {assignmentTrends.map((trend, index) => (
              <div key={trend.date} className="trend-bar-group">
                <div className="trend-date">{new Date(trend.date).toLocaleDateString()}</div>
                <div className="trend-bars">
                  <div 
                    className="trend-bar total-bar"
                    style={{ height: `${(trend.totalAssignments / Math.max(...assignmentTrends.map(t => t.totalAssignments))) * 100}px` }}
                    title={`Total: ${trend.totalAssignments}`}
                  />
                  <div 
                    className="trend-bar skills-bar"
                    style={{ height: `${(trend.skillsBasedAssignments / Math.max(...assignmentTrends.map(t => t.totalAssignments))) * 100}px` }}
                    title={`Skills-based: ${trend.skillsBasedAssignments}`}
                  />
                  <div 
                    className="trend-bar success-bar"
                    style={{ height: `${trend.successRate}px` }}
                    title={`Success rate: ${trend.successRate}%`}
                  />
                </div>
                <div className="trend-values">
                  <div className="trend-value total">{trend.totalAssignments}</div>
                  <div className="trend-value skills">{trend.skillsBasedAssignments}</div>
                  <div className="trend-value success">{trend.successRate.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SkillsAnalyticsDashboard;