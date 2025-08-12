import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/reassignment-reporting.css';

interface ReportRow {
  assignmentId: string;
  leadIdentifier: string;
  leadName: string;
  reassignmentCount: number;
  assignmentMethod: string;
  sdrUsername: string;
  sdrName: string;
  currentConsultantName: string;
  currentConsultantEmail: string;
  initialAssignmentTime: string;
  assignmentStatus: string;
  reassignmentNumber: number;
  reassignmentTime: string;
  reassignmentReason: string | null;
  reassignmentSource: string;
  processingTimeMs: number;
  previousSkillsMatchScore: number | null;
  newSkillsMatchScore: number | null;
  skillsImprovement: number | null;
  originalConsultantName: string;
  newConsultantName: string;
  reassignmentSuccessful: boolean;
  errorMessage: string | null;
}

interface ReportData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters: {
    minReassignments: number;
  };
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  sort: {
    field: string;
    order: string;
  };
  data: ReportRow[];
}

const ReassignmentReporting: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    minReassignments: 0
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0
  });
  const [sorting, setSorting] = useState({
    field: 'reassignment_time',
    order: 'DESC'
  });
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadReport();
    }
  }, [user, filters, pagination, sorting]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        minReassignments: filters.minReassignments.toString(),
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        sortBy: sorting.field,
        sortOrder: sorting.order
      });

      const response = await fetch(`/api/reassignments/report?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load reassignment report');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to load reassignment report:', error);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    setSorting(prev => ({
      field,
      order: prev.field === field && prev.order === 'ASC' ? 'DESC' : 'ASC'
    }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  const handleRowSelection = (assignmentId: string, selected: boolean) => {
    setSelectedRows(prev => 
      selected 
        ? [...prev, assignmentId]
        : prev.filter(id => id !== assignmentId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && reportData) {
      setSelectedRows(reportData.data.map(row => row.assignmentId));
    } else {
      setSelectedRows([]);
    }
  };

  const exportToCSV = () => {
    if (!reportData || reportData.data.length === 0) return;

    const headers = [
      'Assignment ID', 'Lead ID', 'Lead Name', 'Total Reassignments',
      'Assignment Method', 'SDR Username', 'SDR Name', 
      'Current Consultant', 'Current Email', 'Initial Assignment',
      'Status', 'Reassignment #', 'Reassignment Time', 'Reason',
      'Source', 'Processing Time (ms)', 'Previous Skills Score',
      'New Skills Score', 'Skills Improvement', 'From Consultant',
      'To Consultant', 'Success', 'Error Message'
    ];

    const csvData = reportData.data.map(row => [
      row.assignmentId,
      row.leadIdentifier,
      row.leadName,
      row.reassignmentCount,
      row.assignmentMethod,
      row.sdrUsername,
      row.sdrName,
      row.currentConsultantName,
      row.currentConsultantEmail,
      new Date(row.initialAssignmentTime).toLocaleString(),
      row.assignmentStatus,
      row.reassignmentNumber,
      new Date(row.reassignmentTime).toLocaleString(),
      row.reassignmentReason || '',
      row.reassignmentSource,
      row.processingTimeMs,
      row.previousSkillsMatchScore ? (row.previousSkillsMatchScore * 100).toFixed(1) + '%' : '',
      row.newSkillsMatchScore ? (row.newSkillsMatchScore * 100).toFixed(1) + '%' : '',
      row.skillsImprovement ? (row.skillsImprovement * 100).toFixed(1) + '%' : '',
      row.originalConsultantName,
      row.newConsultantName,
      row.reassignmentSuccessful ? 'Yes' : 'No',
      row.errorMessage || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reassignment_report_${filters.startDate}_to_${filters.endDate}.csv`;
    link.click();
  };

  const formatDateTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active': return '#22c55e';
      case 'completed': return '#3b82f6';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSourceIcon = (source: string): string => {
    switch (source) {
      case 'user_request': return '👤';
      case 'system_automatic': return '🤖';
      case 'admin_override': return '👨‍💼';
      default: return '🔄';
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="reassignment-reporting">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>Admin access required to view reassignment reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reassignment-reporting">
      <div className="reporting-header">
        <div className="header-content">
          <h1>📋 Reassignment Reporting</h1>
          <p>Comprehensive reports and analysis of assignment reassignments</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="report-controls">
        <div className="filter-section">
          <h3>Filters</h3>
          <div className="filter-groups">
            <div className="filter-group">
              <label>Date Range:</label>
              <div className="date-inputs">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="filter-group">
              <label>Min Reassignments:</label>
              <input
                type="number"
                min="0"
                value={filters.minReassignments}
                onChange={(e) => setFilters(prev => ({ ...prev, minReassignments: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
        </div>

        <div className="action-section">
          <button 
            onClick={loadReport} 
            className="refresh-button"
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          
          <button 
            onClick={exportToCSV}
            className="export-button"
            disabled={!reportData || reportData.data.length === 0}
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Report Results */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">Loading report...</div>
        </div>
      ) : reportData && (
        <div className="report-results">
          <div className="results-header">
            <div className="results-info">
              <span className="total-count">{reportData.pagination.total} records found</span>
              <span className="date-range">
                {formatDateTime(reportData.dateRange.startDate)} - {formatDateTime(reportData.dateRange.endDate)}
              </span>
            </div>
            
            <div className="selection-info">
              {selectedRows.length > 0 && (
                <span className="selection-count">{selectedRows.length} selected</span>
              )}
            </div>
          </div>

          <div className="report-table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedRows.length === reportData.data.length && reportData.data.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th 
                    onClick={() => handleSort('assignment_id')}
                    className={`sortable ${sorting.field === 'assignment_id' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Assignment ID
                  </th>
                  <th 
                    onClick={() => handleSort('lead_identifier')}
                    className={`sortable ${sorting.field === 'lead_identifier' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Lead
                  </th>
                  <th 
                    onClick={() => handleSort('reassignment_count')}
                    className={`sortable ${sorting.field === 'reassignment_count' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Total Reassignments
                  </th>
                  <th>SDR</th>
                  <th>Current Consultant</th>
                  <th 
                    onClick={() => handleSort('reassignment_time')}
                    className={`sortable ${sorting.field === 'reassignment_time' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Last Reassignment
                  </th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th 
                    onClick={() => handleSort('processing_time_ms')}
                    className={`sortable ${sorting.field === 'processing_time_ms' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Processing Time
                  </th>
                  <th 
                    onClick={() => handleSort('skills_improvement')}
                    className={`sortable ${sorting.field === 'skills_improvement' ? sorting.order.toLowerCase() : ''}`}
                  >
                    Skills Improvement
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.data.map((row, index) => (
                  <tr 
                    key={`${row.assignmentId}-${row.reassignmentNumber}`}
                    className={selectedRows.includes(row.assignmentId) ? 'selected' : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.assignmentId)}
                        onChange={(e) => handleRowSelection(row.assignmentId, e.target.checked)}
                      />
                    </td>
                    <td className="assignment-id">
                      <div className="id-info">
                        <span className="id-value">{row.assignmentId}</span>
                        <span className="reassignment-badge">#{row.reassignmentNumber}</span>
                      </div>
                    </td>
                    <td className="lead-info">
                      <div className="lead-details">
                        <span className="lead-name">{row.leadName}</span>
                        <span className="lead-id">{row.leadIdentifier}</span>
                      </div>
                    </td>
                    <td className="reassignment-count">
                      <span className="count-badge">{row.reassignmentCount}</span>
                    </td>
                    <td className="sdr-info">
                      <div className="sdr-details">
                        <span className="sdr-name">{row.sdrName}</span>
                        <span className="sdr-username">@{row.sdrUsername}</span>
                      </div>
                    </td>
                    <td className="consultant-info">
                      <div className="consultant-details">
                        <span className="consultant-name">{row.currentConsultantName}</span>
                        <span className="consultant-email">{row.currentConsultantEmail}</span>
                      </div>
                    </td>
                    <td className="reassignment-time">
                      {formatDateTime(row.reassignmentTime)}
                    </td>
                    <td className="reason">
                      {row.reassignmentReason || <span className="no-reason">No reason provided</span>}
                    </td>
                    <td className="source">
                      <span className="source-indicator">
                        {getSourceIcon(row.reassignmentSource)}
                        {row.reassignmentSource.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="processing-time">
                      {formatDuration(row.processingTimeMs)}
                    </td>
                    <td className="skills-improvement">
                      {row.skillsImprovement !== null ? (
                        <span className={`improvement-value ${row.skillsImprovement >= 0 ? 'positive' : 'negative'}`}>
                          {row.skillsImprovement >= 0 ? '+' : ''}{(row.skillsImprovement * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="no-data">N/A</span>
                      )}
                    </td>
                    <td className="status">
                      <span 
                        className="status-indicator"
                        style={{ backgroundColor: getStatusColor(row.assignmentStatus) }}
                      >
                        {row.assignmentStatus}
                      </span>
                      {!row.reassignmentSuccessful && (
                        <span className="error-indicator" title={row.errorMessage || 'Unknown error'}>
                          ⚠️
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <div className="pagination-info">
              Showing {reportData.pagination.offset + 1} - {Math.min(reportData.pagination.offset + reportData.pagination.limit, reportData.pagination.total)} of {reportData.pagination.total}
            </div>
            
            <div className="pagination-controls">
              <button
                onClick={() => handlePageChange(Math.max(0, reportData.pagination.offset - reportData.pagination.limit))}
                disabled={reportData.pagination.offset === 0}
                className="page-button"
              >
                ← Previous
              </button>
              
              <span className="page-info">
                Page {Math.floor(reportData.pagination.offset / reportData.pagination.limit) + 1} of {Math.ceil(reportData.pagination.total / reportData.pagination.limit)}
              </span>
              
              <button
                onClick={() => handlePageChange(reportData.pagination.offset + reportData.pagination.limit)}
                disabled={!reportData.pagination.hasMore}
                className="page-button"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReassignmentReporting;