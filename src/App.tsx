import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import WatermarkApp from './pages/WatermarkApp';
import Login from './pages/Login';
import UserCenter from './pages/UserCenter';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <Routes>
            <Route path="/" element={<WatermarkApp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/my" element={<UserCenter />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
