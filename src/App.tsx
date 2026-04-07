import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WatermarkApp from './pages/WatermarkApp';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WatermarkApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
