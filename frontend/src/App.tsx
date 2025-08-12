import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import SDRDashboard from './components/SDRDashboard';
import AdminDashboard from './components/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const Unauthorized: React.FC = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>Unauthorized</h2>
    <p>You don't have permission to access this page.</p>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route 
              path="/sdr" 
              element={
                <ProtectedRoute requiredRole="sdr">
                  <SDRDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;