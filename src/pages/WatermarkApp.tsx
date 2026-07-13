import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, Image as ImageIcon, Crown, Lock, Unlock, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function WatermarkApp() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [showVipModal, setShowVipModal] = useState(false);
  const [todayUseCount, setTodayUseCount] = useState(0);
  const [lastUseDate, setLastUseDate] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const [time, setTime] = useState('20:58');
  const [date, setDate] = useState('2026-04-06');
  const [day, setDay] = useState('星期一');
  const [weather, setWeather] = useState('轻度雾霾');
  const [temperature, setTemperature] = useState('20°C');
  const [location, setLocation] = useState('嘉兴市南湖区建设街道·南杨新村');
  const [securityCode, setSecurityCode] = useState('KDRDCUU93S444');

  // 获取当前时间和日期
  const getCurrentDateTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setTime(`${hours}:${minutes}`);

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const dayNum = now.getDate().toString().padStart(2, '0');
    setDate(`${year}-${month}-${dayNum}`);

    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    setDay(days[now.getDay()]);

    // 根据季节生成天气和温度
    const monthNum = now.getMonth();
    let temp, weatherList;

    if (monthNum >= 5 && monthNum <= 7) {
      // 夏季
      temp = Math.floor(Math.random() * 10) + 28;
      weatherList = ['晴', '多云', '晴间多云', '晴转多云', '多云转晴'];
    } else if (monthNum >= 8 && monthNum <= 10) {
      // 秋季
      temp = Math.floor(Math.random() * 12) + 18;
      weatherList = ['多云', '晴', '阴', '晴间多云', '多云转晴'];
    } else if (monthNum >= 11 || monthNum <= 1) {
      // 冬季
      temp = Math.floor(Math.random() * 10) + 2;
      weatherList = ['晴', '多云', '阴', '晴间多云', '多云转晴'];
    } else {
      // 春季
      temp = Math.floor(Math.random() * 10) + 15;
      weatherList = ['晴', '多云', '晴间多云', '多云转晴', '晴转多云'];
    }

    setTemperature(`${temp}°C`);
    setWeather(weatherList[Math.floor(Math.random() * weatherList.length)]);
  };

  // 页面加载时设置当前时间
  useEffect(() => {
    getCurrentDateTime();
    // 每分钟更新一次时间
    const timer = setInterval(getCurrentDateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isVip = user?.isVip;
  const isFreeUser = !isVip;
  const shouldShowLimit = isFreeUser && todayUseCount >= 1;

  useEffect(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('watermarkLastUseDate');
    const savedCount = localStorage.getItem('watermarkTodayUseCount');

    if (savedDate !== today) {
      // 新的一天，重置使用次数
      setTodayUseCount(0);
      setLastUseDate(today);
      localStorage.setItem('watermarkLastUseDate', today);
      localStorage.setItem('watermarkTodayUseCount', '0');
    } else if (savedCount) {
      setTodayUseCount(parseInt(savedCount, 10));
      setLastUseDate(savedDate);
    }
  }, []);

  const processFile = (file: File) => {
    if (shouldShowLimit) {
      setShowVipModal(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
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

      canvas.width = imageObj.width;
      canvas.height = imageObj.height;

      ctx.drawImage(imageObj, 0, 0);

      const scale = canvas.width / 1080;
      const paddingX = 40 * scale;
      const paddingY = 50 * scale;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetX = 2 * scale;
      ctx.shadowOffsetY = 2 * scale;

      const leftStartX = paddingX;
      const bottomStartY = canvas.height - paddingY;

      ctx.fillStyle = 'white';
      ctx.font = `500 ${34 * scale}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(location, leftStartX, bottomStartY);

      const timeY = bottomStartY - 60 * scale;
      ctx.font = `bold ${100 * scale}px sans-serif`;
      ctx.fillText(time, leftStartX, timeY + 10 * scale);
      const timeWidth = ctx.measureText(time).width;

      const lineX = leftStartX + timeWidth + 25 * scale;
      const lineY = timeY - 85 * scale;
      const lineHeight = 90 * scale;
      ctx.fillStyle = '#EAB308';
      ctx.shadowColor = 'transparent';
      ctx.fillRect(lineX, lineY, 6 * scale, lineHeight);

      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      const infoX = lineX + 25 * scale;
      ctx.font = `500 ${32 * scale}px sans-serif`;
      ctx.fillText(date, infoX, timeY - 45 * scale);
      ctx.fillText(`${day}  ${weather} ${temperature}`, infoX, timeY + 5 * scale);

      const rightEndX = canvas.width - paddingX;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';

      // 先画"今日水印" - 最大、最粗
      const line1Y = bottomStartY - 70 * scale;
      ctx.textBaseline = 'bottom';
      ctx.font = `bold ${50 * scale}px sans-serif`;
      ctx.fillStyle = 'white';
      ctx.fillText('今日水印', rightEndX, line1Y);

      // 画"相机"和"真实可验"
      const line2Y = line1Y + 35 * scale;
      const text2 = '真实可验';
      const text2Width = ctx.measureText(text2).width;
      const cameraText = '相机';
      const cameraTextWidth = ctx.measureText(cameraText).width;

      // "真实可验"的背景框 - 半透明白色
      const boxPaddingX = 8 * scale;
      const boxPaddingY = 6 * scale;
      const boxWidth = text2Width + boxPaddingX * 2;
      const boxHeight = 28 * scale;
      const boxX = rightEndX - boxWidth;
      const boxY = line2Y - boxHeight;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.shadowColor = 'transparent';
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      // "真实可验"文字为黑色
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'black';
      ctx.textBaseline = 'bottom';
      ctx.font = `600 ${22 * scale}px sans-serif`;
      ctx.fillText(text2, rightEndX - boxPaddingX, line2Y);

      // "相机"为白色，在"真实可验"左边
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      const cameraX = boxX - 10 * scale;
      ctx.fillText(cameraText, cameraX, line2Y);

      // 最底部画"防伪"码
      ctx.textBaseline = 'bottom';
      ctx.font = `400 ${15 * scale}px sans-serif`;
      ctx.fillStyle = 'white';
      ctx.fillText(`防伪 ${securityCode}`, rightEndX, bottomStartY);
    }
  }, [imageObj, time, date, day, weather, temperature, location, securityCode]);

  const handleDownload = () => {
    if (shouldShowLimit) {
      setShowVipModal(true);
      return;
    }
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `watermark_${Date.now()}.jpg`;
      link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
      link.click();

      if (isFreeUser) {
        const today = new Date().toDateString();
        const newCount = todayUseCount + 1;
        setTodayUseCount(newCount);
        setLastUseDate(today);
        localStorage.setItem('watermarkLastUseDate', today);
        localStorage.setItem('watermarkTodayUseCount', newCount.toString());
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {isFreeUser && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 text-sm">
                免费用户今日剩余 <strong>{Math.max(0, 1 - todayUseCount)}</strong> 次导出
              </span>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
            >
              升级VIP无限使用
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-8">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">自定义水印相机</h1>
          <p className="text-gray-500 mt-2">上传照片并自定义水印信息</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
            {!imageSrc ? (
              <label
                className={`flex flex-col items-center justify-center w-full h-full cursor-pointer border-2 border-dashed rounded-xl transition-colors ${
                  shouldShowLimit
                    ? 'border-red-300 hover:bg-red-50'
                    : isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {shouldShowLimit ? (
                    <>
                      <Lock className="w-12 h-12 text-red-400 mb-4" />
                      <p className="mb-2 text-sm text-red-600 font-medium">今日免费次数已用完</p>
                      <p className="text-xs text-red-500">明天再来，或升级VIP解锁无限使用</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">点击上传</span> 或拖拽图片至此处
                      </p>
                      <p className="text-xs text-gray-500">支持 JPG, PNG 格式</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={shouldShowLimit} />
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
                    disabled={shouldShowLimit}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm ${
                      shouldShowLimit
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Download className="w-5 h-5" />
                    {shouldShowLimit ? '升级解锁' : '保存图片'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">水印设置</h2>
              <button
                onClick={getCurrentDateTime}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                同步当前时间
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">时间</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">星期</label>
                  <input
                    type="text"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">天气</label>
                  <input
                    type="text"
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">温度</label>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">详细地址</label>
                <textarea
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">防伪码</label>
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
                <li>右下角包含"今日水印相机 真实可验"标志</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showVipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">免费次数已用完</h3>
            <p className="text-gray-500 mb-6">升级VIP会员，解锁无限次高清导出</p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowVipModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                稍后再说
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 font-medium"
              >
                立即升级
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
