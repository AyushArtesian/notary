import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotaryDashboardStats } from '../utils/apiClient';
import './NotaryDashboardPage.css';

const NotaryDashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const response = await fetchNotaryDashboardStats();
        
        if (response.success && response.data) {
          setStats(response.data);
        } else {
          throw new Error('Failed to load dashboard stats');
        }
      } catch (err) {
        console.error('Error loading notary dashboard stats:', err);
        setError(err.message || 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'notarized': { bg: '#d1e7dd', color: '#0f5132' },
      'accepted': { bg: '#d1fae5', color: '#065f46' },
      'session_started': { bg: '#cfe2ff', color: '#0a4e9b' },
      'uploaded': { bg: '#fff3cd', color: '#856404' },
      'rejected': { bg: '#fee2e2', color: '#991b1b' },
    };
    const style = statusMap[status?.toLowerCase()] || { bg: '#e5e7eb', color: '#374151' };
    return style;
  };

  if (loading) {
    return (
      <div className="notary-dashboard-container">
        <div className="loading-state">
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notary-dashboard-container">
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notary-dashboard-container">
      <div className="dashboard-header">
        <h1>Notary Dashboard</h1>
        <p className="header-subtitle">Track your notarization activity and earnings</p>
      </div>

      {/* Main Metrics Section */}
      <div className="main-metrics">
        <div className="metric-card main-metric">
          <div className="metric-content metric-content-center">
            <p className="metric-label">Total Completed Calls to Date</p>
            <p className="metric-value">{stats?.totalCompletedCalls || 0}</p>
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => navigate('/notary/doc/dashboard')}>
            Access Document Queue
          </button>
          <button className="btn btn-secondary">View Transactions as NST</button>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="stats-section">
        <h2>My Statistics</h2>
        <div className="stats-grid">
          {/* Available for Payout */}
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-amount">{formatCurrency(stats?.availableForPayout || 0)}</p>
              <p className="stat-label">Available for Payout</p>
              {(stats?.availableForPayout || 0) > 0 && (
                <button className="stat-action">View Stripe</button>
              )}
            </div>
          </div>

          {/* Total Transactions */}
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-amount">{stats?.transactions?.length || 0}</p>
              <p className="stat-label">Total Transactions</p>
              <button 
                className="stat-action"
                onClick={() => setShowTransactionHistory(!showTransactionHistory)}
              >
                {showTransactionHistory ? 'Hide History' : 'View History'}
              </button>
            </div>
          </div>

          {/* On-Demand Calls */}
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-amount">{stats?.onDemandCalls || 0}</p>
              <p className="stat-label">On-Demand Calls</p>
            </div>
          </div>

          {/* Scheduled Calls */}
          <div className="stat-card">
            <div className="stat-content">
              <p className="stat-amount">{stats?.scheduledCalls || 0}</p>
              <p className="stat-label">Scheduled Calls</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {showTransactionHistory && stats?.transactions && stats.transactions.length > 0 && (
        <div className="transaction-history-section">
          <h2>Transaction History</h2>
          <div className="transaction-table-container">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Owner</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="doc-name">{transaction.documentName}</td>
                    <td>{transaction.ownerName}</td>
                    <td className="amount">{formatCurrency(transaction.amount)}</td>
                    <td className="date">{formatDate(transaction.date)}</td>
                    <td>
                      <span 
                        className="badge"
                        style={{
                          background: getStatusBadge(transaction.status).bg,
                          color: getStatusBadge(transaction.status).color
                        }}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{
                          background: transaction.paymentStatus === 'paid' ? '#d1e7dd' : '#fff3cd',
                          color: transaction.paymentStatus === 'paid' ? '#0f5132' : '#856404'
                        }}
                      >
                        {transaction.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTransactionHistory && (!stats?.transactions || stats.transactions.length === 0) && (
        <div className="empty-state">
          <p>No transactions yet</p>
        </div>
      )}
    </div>
  );
};

export default NotaryDashboardPage;
