import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WatermarkApp from './pages/WatermarkApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WatermarkApp />} />
      </Routes>
    </BrowserRouter>
  );
}
