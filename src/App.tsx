/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Image as ImageIcon, X, CheckCircle2, QrCode, Crown } from 'lucide-react';

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  const [time, setTime] = useState('20:58');
  const [date, setDate] = useState('2026-04-06');
  const [day, setDay] = useState('星期一');
  const [weather, setWeather] = useState('轻度雾霾');
  const [temperature, setTemperature] = useState('20°C');
  const [location, setLocation] = useState('嘉兴市南湖区建设街道·南杨新村');
  const [securityCode, setSecurityCode] = useState('KDRDCUU93S444');
  
  const [isVip, setIsVip] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<'single' | 'monthly'>('single');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  useEffect(() => {
    if (imageObj && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas dimensions to match the image
      canvas.width = imageObj.width;
      canvas.height = imageObj.height;

      // Draw the original image
      ctx.drawImage(imageObj, 0, 0);

      // Calculate scale based on a reference width (e.g., 1080px)
      const scale = canvas.width / 1080;
      const paddingX = 40 * scale;
      const paddingY = 50 * scale;

      // Global shadow settings for better visibility on light backgrounds
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetX = 2 * scale;
      ctx.shadowOffsetY = 2 * scale;

      const leftStartX = paddingX;
      const bottomStartY = canvas.height - paddingY;

      // 1. Draw Location (Bottom-most left text)
      ctx.fillStyle = 'white';
      ctx.font = `500 ${34 * scale}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(location, leftStartX, bottomStartY);

      // 2. Draw Time (Above location)
      const timeY = bottomStartY - 60 * scale;
      ctx.font = `bold ${100 * scale}px sans-serif`;
      ctx.fillText(time, leftStartX, timeY + 10 * scale);
      const timeWidth = ctx.measureText(time).width;

      // 3. Draw Vertical Line
      const lineX = leftStartX + timeWidth + 25 * scale;
      const lineY = timeY - 85 * scale;
      const lineHeight = 90 * scale;
      ctx.fillStyle = '#EAB308'; // Yellow
      ctx.shadowColor = 'transparent'; // No shadow for the line
      ctx.fillRect(lineX, lineY, 6 * scale, lineHeight);

      // 4. Draw Date & Weather
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      const infoX = lineX + 25 * scale;
      ctx.font = `500 ${32 * scale}px sans-serif`;
      ctx.fillText(date, infoX, timeY - 45 * scale);
      ctx.fillText(`${day}  ${weather} ${temperature}`, infoX, timeY + 5 * scale);

      // 5. Draw Right side logo
      const rightEndX = canvas.width - paddingX;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';

      // Line 3: 防伪码
      ctx.textBaseline = 'bottom';
      ctx.font = `400 ${15 * scale}px sans-serif`;
      ctx.fillText(`防伪 ${securityCode}`, rightEndX, bottomStartY);

      // Line 2: "相机 真实可验"
      const line2Y = bottomStartY - 30 * scale; // Center of the line
      ctx.font = `500 ${20 * scale}px sans-serif`;
      const text2 = "真实可验";
      const text2Width = ctx.measureText(text2).width;
      const boxPaddingX = 6 * scale;
      const boxPaddingY = 4 * scale;
      
      const boxWidth = text2Width + boxPaddingX * 2;
      const boxHeight = 20 * scale + boxPaddingY * 2;
      const boxX = rightEndX - boxWidth;
      const boxY = line2Y - boxHeight / 2;
      
      // Draw rounded rectangle box for "真实可验"
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5 * scale;
      ctx.shadowColor = 'transparent'; // No shadow for box
      
      const radius = 4 * scale;
      
      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxWidth - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
      ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
      ctx.lineTo(boxX + radius, boxY + boxHeight);
      ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();

      // Draw text inside and next to box
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.textBaseline = 'middle';
      ctx.fillText(text2, rightEndX - boxPaddingX, line2Y + 1 * scale);
      ctx.fillText("相机 ", boxX, line2Y + 1 * scale);

      // Line 1: "今日水印"
      const line1Y = line2Y - 20 * scale;
      ctx.textBaseline = 'bottom';
      ctx.font = `bold ${42 * scale}px sans-serif`;
      ctx.fillText("今日水印", rightEndX, line1Y);
    }
  }, [imageObj, time, date, day, weather, temperature, location, securityCode]);

  const handleDownload = () => {
    if (!isVip) {
      setShowPayment(true);
      return;
    }
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `watermark_${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  const handlePaymentSuccess = () => {
    setIsVip(true);
    setShowPayment(false);
    // Auto download after successful payment
    setTimeout(() => {
      if (canvasRef.current) {
        const link = document.createElement('a');
        link.download = `watermark_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">自定义水印相机</h1>
          <p className="text-gray-500 mt-2">上传照片并自定义水印信息，无需实时定位</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preview Area */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
            {!imageSrc ? (
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">点击上传</span> 或拖拽图片至此处</p>
                  <p className="text-xs text-gray-500">支持 JPG, PNG 格式</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="relative w-full flex justify-center bg-gray-100 rounded-lg overflow-hidden shadow-inner">
                  <canvas 
                    ref={canvasRef} 
                    className="max-w-full h-auto block"
                    style={{ maxHeight: '65vh', objectFit: 'contain' }}
                  />
                </div>
                <div className="mt-6 flex gap-4 w-full max-w-md">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors font-medium">
                    <ImageIcon className="w-5 h-5" />
                    更换图片
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                  <button 
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  >
                    <Download className="w-5 h-5" />
                    保存图片
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Area */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">水印设置</h2>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间</label>
                  <input 
                    type="time" 
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">星期</label>
                  <input 
                    type="text" 
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">天气</label>
                  <input 
                    type="text" 
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">温度</label>
                  <input 
                    type="text" 
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">详细地址</label>
                <textarea 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">防伪码</label>
                <input 
                  type="text" 
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">提示</h3>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>所有水印信息均可自由修改</li>
                <li>生成的图片将保留原图分辨率</li>
                <li>右下角包含“今日水印相机 真实可验”标志</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 relative">
              <button 
                onClick={() => setShowPayment(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">解锁高清无水印保存</h2>
                <p className="text-gray-500 mt-2">支持微信/支付宝扫码支付</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div 
                  onClick={() => setPaymentType('single')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${paymentType === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                >
                  <div className="text-sm text-gray-600 mb-1">单次使用</div>
                  <div className="text-2xl font-bold text-blue-600">¥1.99</div>
                  <div className="text-xs text-gray-500 mt-1">仅限本次导出</div>
                </div>
                <div 
                  onClick={() => setPaymentType('monthly')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all relative ${paymentType === 'monthly' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-200'}`}
                >
                  <div className="absolute -top-3 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold transform rotate-12">特惠</div>
                  <div className="text-sm text-gray-600 mb-1">包月 VIP</div>
                  <div className="text-2xl font-bold text-yellow-600">¥9.90</div>
                  <div className="text-xs text-gray-500 mt-1">30天内无限次使用</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center justify-center border border-gray-100 mb-6">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 mb-3">
                  <QrCode className="w-32 h-32 text-gray-800" />
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  请使用 <span className="text-green-600 font-medium">微信</span> 或 <span className="text-blue-600 font-medium">支付宝</span> 扫码
                </p>
              </div>

              <button 
                onClick={handlePaymentSuccess}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                我已完成支付 (模拟测试)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
