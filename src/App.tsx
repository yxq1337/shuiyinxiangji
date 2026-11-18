import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import WatermarkApp from './pages/WatermarkApp';
import OtherTools from './pages/OtherTools';
import Login from './pages/Login';
import UserCenter from './pages/UserCenter';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';
import PaymentPending from './pages/PaymentPending';
import CustomerService from './pages/CustomerService';
import TTSPage from './pages/TTSPage';
import QuarkScanPage from './pages/QuarkScanPage';
import ScreenshotAnnotate from './pages/ScreenshotAnnotate';
import AICallPage from './pages/AICallPage';
import Community from './pages/Community';
import PublishListing from './pages/PublishListing';
import ListingDetail from './pages/ListingDetail';
import CheckinManage from './pages/CheckinManage';
import CheckinSign from './pages/CheckinSign';

// three.js 较重，单独懒加载，避免拖慢主包
const GalleryHeadingPage = lazy(() => import('./pages/GalleryHeadingPage'));

function AppShell() {
  const { pathname } = useLocation();
  const bare = /^\/checkin\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {!bare && <Navbar />}
      <main className={`flex-1 flex flex-col ${bare ? '' : 'pt-14 md:pt-0'}`}>
        <Routes>
          <Route path="/" element={<OtherTools />} />
          <Route path="/camera" element={<WatermarkApp />} />
          <Route path="/tools" element={<OtherTools />} />
          <Route path="/tool/checkin" element={<CheckinManage />} />
          <Route path="/checkin/:code" element={<CheckinSign />} />
          <Route path="/tool/compress" element={<OtherTools />} />
          <Route path="/tool/idphoto" element={<OtherTools />} />
          <Route path="/tool/ocr" element={<OtherTools />} />
          <Route path="/tool/enhance" element={<OtherTools />} />
          <Route path="/tool/tts" element={<TTSPage />} />
          <Route path="/tool/quark-scan" element={<QuarkScanPage />} />
          <Route path="/tool/annotate" element={<ScreenshotAnnotate />} />
          <Route path="/tool/ai-call" element={<AICallPage />} />
          <Route
            path="/tool/gallery-heading"
            element={
              <Suspense fallback={null}>
                <GalleryHeadingPage />
              </Suspense>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/my" element={<UserCenter />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment/pending" element={<PaymentPending />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/customer-service" element={<CustomerService />} />
          {/* 骑手社区 */}
          <Route path="/community" element={<Community />} />
          <Route path="/community/publish" element={<PublishListing />} />
          <Route path="/community/listing/:id" element={<ListingDetail />} />
        </Routes>
      </main>
      {!bare && <Footer />}
      {!bare && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
