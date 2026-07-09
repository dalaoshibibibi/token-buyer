/**
 * api-price-comparator 爬虫模块
 * 
 * 三层抓取策略：
 *   Layer 1 — API端点探测（HTTP GET/POST，无需浏览器）
 *   Layer 2 — 浏览器自动化（Playwright + 系统Chrome，JS SPA）
 *   Layer 3 — 引导导出（结构化提示，当L1/L2都失败时）
 * 
 * 输出格式：统一的JSON数组，每条记录包含：
 *   { platform, model, billing, inputPrice, outputPrice, unit, source }
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================
// 平台配置
// ============================================================
const PLATFORMS = {
  apimart: {
    name: 'APIMart',
    baseUrl: 'https://aiuxu.com',
    urls: ['https://aiuxu.com/zh', 'https://aiuxu.com/api/prices', 'https://aiuxu.com/api/v1/models'],
    note: 'JS渲染SPA，API端点可能需实时探测'
  },
  grsai: {
    name: 'GrsAI',
    baseUrl: 'https://grsai.com',
    urls: [
      'https://grsai.com/zh',
      'https://grsai.com/api/models',
      'https://grsai.com/api/v1/models',
      'https://grsai.com/api/prices',
      'https://grsai.com/dashboard/models'
    ],
    authRequired: true,
    authUrl: 'https://grsai.com/api/auth/login',
    note: '首页展示部分模型，完整列表需登录'
  },
  geeknow: {
    name: 'GeekNow',
    baseUrl: 'https://www.geeknow.top',
    urls: [
      'https://www.geeknow.top/console',
      'https://www.geeknow.top/api/models',
      'https://www.geeknow.top/api/v1/models',
      'https://www.geeknow.top/api/prices',
      'https://www.geeknow.top/api/v1/prices',
      'https://www.geeknow.top/pricing'
    ],
    authRequired: true,
    authUrl: 'https://www.geeknow.top/api/auth/login',
    note: '完全登录墙，控制台JS渲染'
  },
  zenmux: {
    name: 'ZenmuxAI',
    baseUrl: 'https://zenmux.ai',
    urls: [
      'https://zenmux.ai',
      'https://zenmux.ai/pricing',
      'https://zenmux.ai/api/v1/models'
    ],
    note: '公开API /api/v1/models 返回全量137个模型+价格（已验证）',
    apiModelEndpoint: 'https://zenmux.ai/api/v1/models',
    currency: 'USD'
  }
};

// ============================================================
// Layer 1: API端点探测
// ============================================================
async function probeApiEndpoints(platform) {
  const results = [];
  const config = PLATFORMS[platform];
  if (!config) return results;

  console.log(`[${config.name}] 探测API端点...`);

  for (const url of config.urls) {
    try {
      const resp = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        validateStatus: () => true
      });
      
      const info = {
        url,
        status: resp.status,
        contentType: resp.headers['content-type'] || '',
        dataSize: JSON.stringify(resp.data || '').length,
        isJson: resp.headers['content-type']?.includes('application/json') || false,
        success: resp.status >= 200 && resp.status < 400
      };

      if (info.isJson && typeof resp.data === 'object') {
        const dataStr = JSON.stringify(resp.data).toLowerCase();
        info.hasModels = dataStr.includes('model') || dataStr.includes('gpt') || dataStr.includes('gemini');
        info.hasPrices = dataStr.includes('price') || dataStr.includes('pricing') || dataStr.includes('cost') || dataStr.includes('元');
      }

      console.log(`  ${url} → ${resp.status} ${info.isJson ? '(JSON)' : '(非JSON)'} ${info.dataSize}bytes`);
      results.push(info);
    } catch (e) {
      console.log(`  ${url} → 错误: ${e.message.slice(0, 80)}`);
      results.push({ url, status: 'ERROR', error: e.message.slice(0, 80) });
    }
  }

  return results;
}

// ============================================================
// Layer 2: 浏览器自动化（Playwright + 系统Chrome）
// ============================================================
async function scrapeWithBrowser(platform, credentials) {
  let playwright;
  try {
    playwright = require('playwright-core');
  } catch {
    console.log('[playwright-core 未安装，跳过浏览器自动化]');
    return null;
  }

  try {
    const config = PLATFORMS[platform];
    console.log(`[${config.name}] 启动Chrome浏览器...`);

    // 自动检测 Chrome 路径（macOS / Windows / Linux）
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',  // macOS
      '/usr/bin/google-chrome',                                        // Linux
      '/usr/bin/google-chrome-stable',                                 // Linux
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',   // Windows
    ];
    const chromePath = chromePaths.find(p => { try { require('fs').accessSync(p); return true; } catch(e) { return false; } }) || '';

    const browser = await playwright.chromium.launch({
      executablePath: chromePath || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    if (config.authRequired && credentials) {
      console.log('  检测到需登录平台，尝试登录...');
      await page.goto(config.authUrl, { waitUntil: 'domcontentloaded' });
      await page.fill('input[name="email"], input[type="email"], input[type="text"]', credentials.email || '');
      await page.fill('input[type="password"]', credentials.password || '');
      await page.click('button[type="submit"], button:has-text("登录"), button:has-text("Sign in")');
      await page.waitForTimeout(3000);
    }

    const targetUrls = config.urls;
    const allData = [];

    for (const url of targetUrls) {
      try {
        console.log(`  访问: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const pageData = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table'));
          const tableData = tables.map(t => {
            const rows = Array.from(t.querySelectorAll('tr'));
            return rows.map(r => Array.from(r.querySelectorAll('td, th')).map(c => c.textContent.trim()));
          });
          const cards = Array.from(document.querySelectorAll(
            '[class*="model"], [class*="card"], [class*="price"], [class*="item"], li, .grid-item'
          ));
          const cardTexts = cards.map(c => c.textContent.trim()).filter(t => t.length > 0 && t.length < 200);
          const bodyText = document.body?.innerText || '';
          const priceLines = bodyText.split('\n').filter(l => 
            l.includes('¥') || l.includes('元') || l.includes('$') || 
            l.toLowerCase().includes('price') || l.toLowerCase().includes('cost')
          );
          return { tableData, cardTexts, priceLines };
        });

        allData.push({ url, ...pageData });

        if (pageData.tableData.length > 0 && pageData.tableData[0].length > 1) {
          console.log(`  成功提取到 ${pageData.tableData.length} 个表格`);
          await browser.close();
          return { success: true, platform, mode: 'browser', data: allData };
        }
      } catch (e) {
        console.log(`  页面 ${url} 提取失败: ${e.message.slice(0, 60)}`);
      }
    }

    await browser.close();
    return { success: allData.some(d => d.tableData.length > 0 || d.cardTexts.length > 0), platform, mode: 'browser', data: allData };

  } catch (e) {
    console.log(`浏览器自动化失败: ${e.message.slice(0, 100)}`);
    return null;
  }
}

// ============================================================
// 专用抓取器：ZenmuxAI (公开API完全可用)
// ============================================================
async function scrapeZenmux() {
  console.log('[ZenmuxAI] 通过公开API抓取价格...');
  
  const resp = await axios.get('https://zenmux.ai/api/v1/models', {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  const models = resp.data.data || [];
  const normalized = models.map(m => {
    const prompt = m.pricings?.prompt?.[0];
    const completion = m.pricings?.completion?.[0];
    return {
      id: m.id,
      display_name: m.display_name || m.id,
      provider: m.owned_by || 'unknown',
      category: detectModelCategory(m),
      input_price_usd: prompt?.value || 0,
      output_price_usd: completion?.value || 0,
      price_unit: 'perMTokens',
      currency: 'USD',
      context_length: m.context_length || 0,
      capabilities: m.capabilities || {},
      input_modalities: m.input_modalities || [],
      output_modalities: m.output_modalities || [],
      publish_time: m.publish_time || ''
    };
  });

  // 按提供商分类统计
  const byProvider = {};
  normalized.forEach(m => {
    if (!byProvider[m.provider]) byProvider[m.provider] = [];
    byProvider[m.provider].push(m);
  });

  console.log(`  ✅ 成功抓取 ${normalized.length} 个模型，来自 ${Object.keys(byProvider).length} 家提供商`);
  Object.entries(byProvider)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([p, list]) => console.log(`    ${p}: ${list.length}个`));

  return normalized;
}

function detectModelCategory(m) {
  const id = (m.id || '').toLowerCase();
  const display = (m.display_name || '').toLowerCase();
  const combined = id + ' ' + display;
  const inputMods = m.input_modalities || [];
  const outputMods = m.output_modalities || [];

  // 按能力判断
  const isImageGen = inputMods.includes('text') && outputMods.includes('image');
  const isVideoGen = outputMods.includes('video');
  const isTextOnly = inputMods.every(m => m === 'text') && outputMods.every(m => m === 'text');
  const isAudio = inputMods.includes('audio') || outputMods.includes('audio');

  if (isVideoGen) return '视频生成';
  if (isImageGen) return '图像生成';
  if (isAudio) return '音频';
  if (combined.includes('embed') || combined.includes('embedding')) return 'Embedding';
  return 'LLM对话/多模态';
}

// ============================================================
// Layer 3: 手动引导导出
// ============================================================
function generateExportGuide(platform) {
  const config = PLATFORMS[platform];
  return {
    platform: config.name,
    steps: [
      `1. 登录 ${config.name} 控制台`,
      `2. 导航到「模型价格」或「Pricing」页面：${config.urls[0]}`,
      `3. 将价格表复制/导出为 Excel 或 CSV 格式`,
      `4. 将文件放入 skill 的 data/ 目录下`,
      `5. 文件名建议：${config.name.replace(/\s/g, '')}_API价格对照表.xlsx`
    ],
    requiredFields: ['模型名称', '计费方式(按Token/按次)', '输入价格', '输出价格', '计费单位'],
    template: JSON.stringify({
      platform: config.name,
      models: [
        { name: '示例模型', billing: '按Token', inputPrice: 0.5, outputPrice: 2, unit: '元/M tokens' }
      ]
    }, null, 2)
  };
}

// ============================================================
// 核心抓取入口
// ============================================================
// 专用抓取器映射（平台名 → 抓取函数）
const DEDICATED_SCRAPERS = {
  zenmux: scrapeZenmux
};

async function scrapePlatform(platform, credentials) {
  const config = PLATFORMS[platform];
  if (!config) {
    console.log(`未知平台: ${platform}`);
    return { success: false, mode: 'unknown' };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`开始抓取: ${config.name}`);
  console.log('='.repeat(60));

  // 如果有专用抓取器，优先使用
  if (DEDICATED_SCRAPERS[platform]) {
    console.log(`  使用专用抓取器...`);
    try {
      const result = await DEDICATED_SCRAPERS[platform]();
      if (result && result.length > 0) {
        return { success: true, mode: 'dedicated', data: result };
      }
    } catch (e) {
      console.log(`  专用抓取器失败: ${e.message.slice(0, 80)}`);
    }
  }

  // L1: API端点探测
  const apiResult = await probeApiEndpoints(platform);
  const hasApiData = apiResult.some(r => r.isJson && r.hasModels && r.hasPrices);
  
  // 对于已知有公开API端点的平台，直接爬取数据
  if (config.apiModelEndpoint) {
    console.log(`  检测到公开API端点: ${config.apiModelEndpoint}`);
    try {
      const resp = await axios.get(config.apiModelEndpoint, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      const models = resp.data?.data || resp.data?.models || [];
      if (models.length > 0) {
        console.log(`  ✅ 通过API端点获取 ${models.length} 个模型`);
        return { success: true, mode: 'api', data: models };
      }
    } catch (e) {
      console.log(`  API端点抓取失败: ${e.message.slice(0, 80)}`);
    }
  }

  // L2: 浏览器自动化
  const browserResult = await scrapeWithBrowser(platform, credentials?.[platform]);
  if (browserResult?.success) {
    return browserResult;
  }

  // L3: 引导导出
  console.log(`❌ ${config.name}: 自动抓取失败，引导用户手动导出`);
  return { success: false, mode: 'guided', guide: generateExportGuide(platform), apiProbe: apiResult };
}

// ============================================================
// 主入口：全平台自动抓取
// ============================================================
async function scrapeAll(credentials, onlyPlatforms) {
  const results = {};
  const targetPlatforms = onlyPlatforms || Object.keys(PLATFORMS);

  for (const platform of targetPlatforms) {
    results[platform] = await scrapePlatform(platform, credentials);
  }

  // 保存抓取报告
  const skillDir = path.resolve(__dirname, '..');
  const dataDir = path.join(skillDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // 保存每个平台的结构化数据
  for (const [p, r] of Object.entries(results)) {
    if (r.success && r.data) {
      const outputPath = path.join(dataDir, `${p}_scraped.json`);
      fs.writeFileSync(outputPath, JSON.stringify(r.data, null, 2));
      console.log(`  💾 已保存: ${outputPath}`);
    }
  }

  // 汇总报告
  const reportPath = path.join(dataDir, 'scrape_report.json');
  const summary = {};
  for (const [p, r] of Object.entries(results)) {
    const config = PLATFORMS[p];
    summary[p] = {
      platform: config?.name || p,
      success: r.success,
      mode: r.mode || 'failed',
      modelCount: Array.isArray(r.data) ? r.data.length : (r.apiProbe?.length || 0),
      note: r.guide ? '需手动导出' : (r.mode === 'dedicated' ? '专用API抓取成功' : '')
    };
  }
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\n💾 汇总报告: ${reportPath}`);

  // 打印结论
  console.log(`\n${'='.repeat(60)}`);
  console.log('抓取完成！');
  console.log('='.repeat(60));
  for (const [p, r] of Object.entries(results)) {
    const status = r.success ? '✅' : '❌';
    const config = PLATFORMS[p];
    console.log(`${status} ${config?.name || p}: ${r.mode}${r.success ? ` (${Array.isArray(r.data) ? r.data.length + '条' : ''})` : ''}`);
  }

  return results;
}

// ============================================================
// CLI执行入口
// ============================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scraper.js [platform] [--help]

platform 可选: apimart, grsai, geeknow, zenmux
不传参数则抓取全部已配置平台

示例:
  node scraper.js              # 抓取所有平台
  node scraper.js zenmux       # 只抓取 ZenmuxAI
  node scraper.js apimart grsai # 抓取指定平台
`);
    process.exit(0);
  }

  const selectedPlatforms = args.filter(a => !a.startsWith('--'));
  scrapeAll({}, selectedPlatforms.length > 0 ? selectedPlatforms : undefined)
    .then(() => {
      const report = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'data', 'scrape_report.json'), 'utf-8')
      );
      const failed = Object.entries(report).filter(([, r]) => !r.success);
      if (failed.length > 0) {
        console.log(`\n📋 ${failed.length} 个平台需手动导出:`);
        failed.forEach(([p]) => {
          const guide = generateExportGuide(p);
          console.log(`\n--- ${guide.platform} ---`);
          guide.steps.forEach(s => console.log(s));
        });
      }
    });
}

module.exports = { scrapeAll, scrapeZenmux, scrapePlatform, probeApiEndpoints, scrapeWithBrowser, generateExportGuide, PLATFORMS };
