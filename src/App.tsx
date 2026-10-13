import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import WatermarkApp from './pages/WatermarkApp';
import OtherTools from './pages/OtherTools';
import Login from './pages/Login';
import UserCenter from './pages/UserCenter';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';
import PaymentPending from './pages/PaymentPending';
import CustomerService from './pages/CustomerService';
import Footer from './components/Footer';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/camera" element={<WatermarkApp />} />
            <Route path="/tools" element={<OtherTools />} />
            <Route path="/tool/compress" element={<OtherTools />} />
            <Route path="/tool/idphoto" element={<OtherTools />} />
            <Route path="/tool/ocr" element={<OtherTools />} />
            <Route path="/tool/enhance" element={<OtherTools />} />
            <Route path="/login" element={<Login />} />
            <Route path="/my" element={<UserCenter />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/payment/pending" element={<PaymentPending />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/customer-service" element={<CustomerService />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
