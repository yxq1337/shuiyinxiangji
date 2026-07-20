/**
 * 数据库初始化脚本
 * 在本地运行此脚本前需要先登录 CloudBase: tcb login
 * 或在云开发控制台手动创建集合和初始数据
 */

const cloud = require('@cloudbase/node-sdk');

// 初始化时需要手动指定环境ID
const app = cloud.init({
  env: 'your-env-id-here' // 请替换为你的环境ID
});

const db = app.database();

const defaultSettings = {
  _id: 'settings',
  singlePrice: 1.99,
  monthlyPrice: 9.9,
  yearlyPrice: 19.9,
  permanentPrice: 29.9,
  paymentAccount: 'admin@example.com',
  alipayQrCode: '',
  wechatQrCode: '',
  wechatQrUrl: '',
  adminEmail: '',
  resendApiKey: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function initDatabase() {
  console.log('开始初始化数据库...\n');

  try {
    // 检查 settings 是否存在
    const settingsResult = await db.collection('settings').doc('settings').get();

    if (settingsResult.data.length === 0) {
      console.log('正在创建 settings 集合的初始数据...');
      await db.collection('settings').doc('settings').set(defaultSettings);
      console.log('✅ settings 初始化成功\n');
    } else {
      console.log('ℹ️  settings 已存在，跳过初始化\n');
    }

    console.log('数据库初始化完成！');
    console.log('\n请在云开发控制台确认已创建以下集合：');
    console.log('  - users');
    console.log('  - payments');
    console.log('  - settings');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    console.log('\n请确认：');
    console.log('1. 已替换脚本中的环境ID为你的实际环境ID');
    console.log('2. 已在云开发控制台开启数据库服务');
    console.log('3. 已登录 CloudBase CLI: tcb login');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase().then(() => process.exit(0));
}

module.exports = { initDatabase, defaultSettings };
