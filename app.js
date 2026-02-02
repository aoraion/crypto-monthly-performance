/**
 * TBT Crypto Monthly Performance Dashboard
 * Interactive visualization for historical crypto returns
 */

// Global state
let data = null;
let rawData = null;
let currentAsset = 'BTC';
let charts = {};
let comparisonYear1 = 2021;
let comparisonYear2 = 2024;
let showVolatility = false;
let yoyShowVolatility = false; // YoY comparison volatility toggle
let useMedian = false;
let selectedCycleType = null; // For cycle overlay buttons
let highlightedCycle = null; // For heatmap row highlighting
let highlightedYear = null; // For heatmap single year highlighting
let forecastData = null; // TBT Forecaster data

// Market cycle phases by year - FIXED: 2026 is Bottom year
const marketCycles = {
  2011: '',      // Pre-cycle
  2012: '',      // Pre-cycle
  2013: 'Top',
  2014: 'Bottom',
  2015: 'Recovery',
  2016: 'Rally',
  2017: 'Top',
  2018: 'Bottom',
  2019: 'Recovery',
  2020: 'Rally',
  2021: 'Top',
  2022: 'Bottom',
  2023: 'Recovery',
  2024: 'Rally',
  2025: 'Top',
  2026: 'Bottom'
};

// Cycle groupings for YoY comparison
const cycleGroups = {
  'Top': [2013, 2017, 2021, 2025],
  'Bottom': [2014, 2018, 2022, 2026],
  'Recovery': [2015, 2019, 2023],
  'Rally': [2016, 2020, 2024]
};

// Cycle colors for chart
const cycleColors = {
  'Top': '#ff4757',
  'Bottom': '#ffa502',
  'Recovery': '#2ed573',
  'Rally': '#00d2d3'
};

// Color functions
function getReturnColor(value, isVolatility = false, yearMax = null) {
  if (value === null || value === undefined) {
    return 'rgba(255, 255, 255, 0.05)';
  }
  
  if (isVolatility && yearMax !== null) {
    // Per-year volatility scaling
    const absValue = Math.abs(value);
    const normalized = yearMax > 0 ? Math.min(1, absValue / yearMax) : 0;
    
    if (value >= 0) {
      // Green months (low-to-high) - shown as green intensity
      const r = Math.round(50 - normalized * 50);
      const g = Math.round(120 + normalized * 135);
      const b = Math.round(50 - normalized * 50);
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    } else {
      // Red months (high-to-low) - shown as red intensity
      const r = 255;
      const g = Math.round(100 + (1 - normalized) * 100);
      const b = Math.round(100 + (1 - normalized) * 100);
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    }
  }
  
  if (isVolatility) {
    // Fallback for absolute volatility (if yearMax not provided)
    const absValue = Math.abs(value);
    const maxVol = 200;
    const normalized = Math.min(1, absValue / maxVol);
    
    if (absValue < 30) {
      const intensity = (30 - absValue) / 30;
      return `rgba(${50 - intensity * 50}, ${180 + intensity * 75}, ${50 - intensity * 50}, 0.85)`;
    } else {
      const intensity = Math.min(1, (absValue - 30) / 170);
      return `rgba(255, ${50 + (1 - intensity) * 150}, ${50 + (1 - intensity) * 150}, 0.85)`;
    }
  }
  
  // For returns
  if (value < 0) {
    const intensity = Math.min(1, Math.abs(value) / 60);
    const r = 255;
    const g = Math.round(50 + (1 - intensity) * 150);
    const b = Math.round(50 + (1 - intensity) * 150);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else if (value > 0) {
    const intensity = Math.min(1, value / 80);
    const r = Math.round(50 - intensity * 50);
    const g = Math.round(180 + intensity * 75);
    const b = Math.round(50 - intensity * 50);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else {
    return 'rgba(255, 255, 255, 0.3)';
  }
}

function getTextColor(value) {
  if (value === null) return 'rgba(255, 255, 255, 0.3)';
  const absVal = Math.abs(value);
  return absVal > 30 ? '#fff' : 'rgba(255, 255, 255, 0.9)';
}

// Format number as whole number
function formatValue(value) {
  if (value === null || value === undefined) return '—';
  return Math.round(value);
}

// Initialize dashboard
async function init() {
  try {
    const response = await fetch('data.json');
    rawData = await response.json();
    
    // Transform array format to object format
    data = {
      assets: {},
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      halvings: [
        { year: 2012, month: 11, label: '1st Halving', block: 210000, reward: '25 BTC', prevReward: '50 BTC', monthsToTop: 12 },
        { year: 2016, month: 7, label: '2nd Halving', block: 420000, reward: '12.5 BTC', prevReward: '25 BTC', monthsToTop: 17 },
        { year: 2020, month: 5, label: '3rd Halving', block: 630000, reward: '6.25 BTC', prevReward: '12.5 BTC', monthsToTop: 18 },
        { year: 2024, month: 4, label: '4th Halving', block: 840000, reward: '3.125 BTC', prevReward: '6.25 BTC', monthsToTop: 18 },
        { year: 2028, month: 4, label: '5th Halving', block: 1050000, reward: '1.5625 BTC', prevReward: '3.125 BTC', projected: true, monthsToTop: 18, monthsToTopProjected: true }
      ]
    };
    
    rawData.assets.forEach(asset => {
      const assetKey = asset.asset;
      
      // Build data object keyed by year, with months keyed 1-12
      const yearData = {};
      const volatilityData = {};
      const greenRedData = {};
      
      // Get unique years with returns data (filter out duplicates)
      const seenYears = new Set();
      asset.years.forEach(y => {
        if (!seenYears.has(y.year) && y.green !== null) {
          seenYears.add(y.year);
          yearData[y.year] = {};
          y.returns.forEach((val, idx) => {
            yearData[y.year][idx + 1] = val;
          });
          greenRedData[y.year] = { green: y.green, red: y.red };
        }
      });
      
      // Build volatility data
      if (asset.volatility) {
        const seenVolYears = new Set();
        asset.volatility.forEach(v => {
          if (!seenVolYears.has(v.year) && v.volatility) {
            seenVolYears.add(v.year);
            volatilityData[v.year] = {};
            v.volatility.forEach((val, idx) => {
              volatilityData[v.year][idx + 1] = val;
            });
          }
        });
      }
      
      // Build statistics per month
      const statistics = {};
      for (let m = 1; m <= 12; m++) {
        const monthValues = Object.values(yearData).map(y => y[m]).filter(v => v !== null && v !== undefined);
        const wins = monthValues.filter(v => v > 0).length;
        const avg = monthValues.length > 0 ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length : 0;
        const sorted = [...monthValues].sort((a, b) => a - b);
        const median = sorted.length > 0 ? (sorted.length % 2 === 0 
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 
          : sorted[Math.floor(sorted.length / 2)]) : 0;
        
        // Calculate standard deviation for volatility
        const mean = avg;
        const squaredDiffs = monthValues.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.length > 0 ? squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length : 0;
        const stdDev = Math.sqrt(avgSquaredDiff);
        
        // Calculate volatility for this month
        const volValues = Object.values(volatilityData).map(y => y[m]).filter(v => v !== null && v !== undefined);
        const avgVol = volValues.length > 0 ? volValues.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) / volValues.length : 0;
        
        statistics[m] = {
          average: Math.round(avg * 100) / 100,
          median: Math.round(median * 100) / 100,
          win_rate: monthValues.length > 0 ? Math.round((wins / monthValues.length) * 100) : 0,
          volatility: Math.round(avgVol * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          count: monthValues.length
        };
      }
      
      data.assets[assetKey] = {
        name: assetKey,
        data: yearData,
        volatilityData: volatilityData,
        greenRedData: greenRedData,
        statistics: statistics,
        average: asset.average || [],
        median: asset.median || []
      };
    });
    
    // Set default comparison years based on available data
    const years = getAvailableYears('BTC');
    comparisonYear1 = years[Math.max(0, years.length - 4)];
    comparisonYear2 = years[years.length - 2];
    
    // Load TBT Forecaster data (embedded for now since we can't fetch Excel from browser)
    forecastData = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      assets: {
        BTC: { monthlyClose: 12, monthlyVol: 27, quarterlyClose: 4 },
        ETH: { monthlyClose: 15, monthlyVol: 54, quarterlyClose: 31 },
        TOTAL2: { monthlyClose: 7, monthlyVol: 38, quarterlyClose: -4 },
        TOTAL3: { monthlyClose: 4, monthlyVol: 26, quarterlyClose: 17 },
        OTHERS: { monthlyClose: 6, monthlyVol: 39, quarterlyClose: 49 },
        TOTALES: { monthlyClose: 13, monthlyVol: 29, quarterlyClose: 12 },
        TOTALE50: { monthlyClose: 12, monthlyVol: 59, quarterlyClose: 43 },
        TOTALE100: { monthlyClose: 15, monthlyVol: 62, quarterlyClose: 57 }
      },
      alerts: {
        btcD: 46.47,
        btcD200MA: 'Above',
        btcusd200MA: 'Above',
        trendStrength: 'Strong',
        others200MA: 'Above',
        bvol24: 4.21
      }
    };
    
    renderAssetSelector();
    renderForecastSection();
    renderDashboard();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to load data:', error);
    document.querySelector('.dashboard').innerHTML = `
      <div class="card">
        <div class="card-body">
          <p style="color: #ff4757; text-align: center;">
            Failed to load data. Please ensure data.json exists.
          </p>
        </div>
      </div>
    `;
  }
}

function getAvailableYears(asset) {
  const assetData = data.assets[asset];
  return Object.keys(assetData.data)
    .map(Number)
    .sort((a, b) => a - b);
}

function renderAssetSelector() {
  const container = document.getElementById('assetSelector');
  container.innerHTML = '';
  
  Object.keys(data.assets).forEach(key => {
    const btn = document.createElement('button');
    btn.className = `asset-btn ${key === currentAsset ? 'active' : ''}`;
    btn.textContent = key;
    btn.dataset.asset = key;
    btn.title = data.assets[key].name;
    container.appendChild(btn);
  });
}

function renderForecastSection() {
  const container = document.getElementById('forecastSection');
  if (!container || !forecastData) return;
  
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
  const assets = ['BTC', 'ETH', 'TOTAL2', 'TOTAL3', 'OTHERS', 'TOTALES', 'TOTALE50', 'TOTALE100'];
  
  // Build simple table
  const headerCells = assets.map(a => `<th>${a}</th>`).join('');
  
  const monthlyRow = assets.map(a => {
    const fd = forecastData.assets[a];
    if (!fd) return '<td>—</td>';
    const val = fd.monthlyClose;
    const cls = val >= 0 ? 'positive' : 'negative';
    return `<td class="${cls}">${val}%</td>`;
  }).join('');
  
  const volRow = assets.map(a => {
    const fd = forecastData.assets[a];
    if (!fd) return '<td>—</td>';
    return `<td>${fd.monthlyVol}%</td>`;
  }).join('');
  
  const quarterlyRow = assets.map(a => {
    const fd = forecastData.assets[a];
    if (!fd) return '<td>—</td>';
    const val = fd.quarterlyClose;
    const cls = val >= 0 ? 'positive' : 'negative';
    return `<td class="${cls}">${val}%</td>`;
  }).join('');
  
  container.innerHTML = `
    <div class="card-header">
      <h2>Historical Performance (Median Data)</h2>
      <span class="forecast-month">${currentMonth}</span>
    </div>
    <div class="card-body">
      <table class="forecast-table">
        <thead>
          <tr>
            <th></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="row-label">Monthly Close</td>
            ${monthlyRow}
          </tr>
          <tr>
            <td class="row-label">Monthly Volatility</td>
            ${volRow}
          </tr>
          <tr>
            <td class="row-label">Quarterly Close</td>
            ${quarterlyRow}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboard() {
  renderHeatmap();
  renderStatistics();
  renderSeasonalityChart();
  renderWinRateChart();
  renderHalvingTimeline();
  renderComparisonChart();
  renderInsights();
  renderQuarterlyTable();
}

function renderHeatmap() {
  const assetData = data.assets[currentAsset];
  const years = getAvailableYears(currentAsset);
  const months = data.months;
  const dataSource = showVolatility ? assetData.volatilityData : assetData.data;
  
  // Calculate max volatility per year for relative scaling
  const yearMaxVol = {};
  if (showVolatility) {
    years.forEach(year => {
      const yearData = assetData.volatilityData[year] || {};
      const values = Object.values(yearData).filter(v => v !== null && v !== undefined);
      yearMaxVol[year] = values.length > 0 ? Math.max(...values.map(Math.abs)) : 100;
    });
  }
  
  let html = '';
  
  // Header row - Cycle, Year, months, G/R (NO empty cell at A1)
  html += '<div class="heatmap-header heatmap-cycle-header">Cycle</div>';
  html += '<div class="heatmap-header heatmap-year-header">Year</div>';
  months.forEach(m => {
    html += `<div class="heatmap-header">${m}</div>`;
  });
  html += '<div class="heatmap-header heatmap-gr-header">G/R</div>';
  
  // Summary row (average or median based on toggle)
  const summaryLabel = useMedian ? 'Med' : 'Avg';
  const summaryData = useMedian ? assetData.median : assetData.average;
  
  html += '<div class="heatmap-cycle heatmap-summary-row"></div>';
  html += `<div class="heatmap-year heatmap-summary-row">${summaryLabel}</div>`;
  
  for (let m = 0; m < 12; m++) {
    const value = summaryData && summaryData[m] !== undefined ? summaryData[m] : null;
    const bgColor = getReturnColor(value, showVolatility);
    const textColor = getTextColor(value);
    const displayVal = formatValue(value);
    
    html += `
      <div class="heatmap-cell heatmap-summary-row ${value === null ? 'null' : ''}"
           style="background: ${bgColor}; color: ${textColor}">
        <span class="value">${displayVal !== '—' ? (value > 0 ? '+' : '') + displayVal + '%' : '—'}</span>
      </div>
    `;
  }
  // Summary row G/R cell - no empty cell needed, just placeholder
  html += '<div class="heatmap-gr heatmap-summary-row"></div>';
  
  // Data rows
  years.forEach(year => {
    const yearData = dataSource[year] || {};
    const isHalvingYear = data.halvings.some(h => h.year === year);
    const halvingMonth = data.halvings.find(h => h.year === year)?.month;
    const cyclePhase = marketCycles[year] || '';
    const greenRed = assetData.greenRedData[year] || { green: 0, red: 0 };
    
    // Cycle column (clickable for highlighting)
    const cycleClass = cyclePhase ? `cycle-${cyclePhase.toLowerCase()}` : '';
    html += `<div class="heatmap-cycle ${cycleClass}" data-cycle="${cyclePhase}" data-row-year="${year}">${cyclePhase}</div>`;
    
    // Year column (clickable for highlighting)
    html += `<div class="heatmap-year ${isHalvingYear ? 'halving-year' : ''}" data-row-year="${year}">${year}</div>`;
    
    // Month cells
    for (let m = 1; m <= 12; m++) {
      const value = yearData[m];
      const isHalvingMonth = halvingMonth === m;
      const yearMax = showVolatility ? yearMaxVol[year] : null;
      const bgColor = getReturnColor(value, showVolatility, yearMax);
      const textColor = getTextColor(value);
      const displayVal = formatValue(value);
      
      html += `
        <div class="heatmap-cell ${value === null || value === undefined ? 'null' : ''} ${isHalvingMonth ? 'halving-month' : ''}"
             style="background: ${bgColor}; color: ${textColor}"
             data-year="${year}"
             data-month="${m}"
             data-value="${value !== null && value !== undefined ? value : ''}"
             data-row-year="${year}"
             data-cycle="${cyclePhase}">
          <span class="value">${displayVal !== '—' ? (value > 0 ? '+' : '') + displayVal + '%' : '—'}</span>
        </div>
      `;
    }
    
    // Green/Red column - no empty cell below header
    html += `
      <div class="heatmap-gr" data-row-year="${year}" data-cycle="${cyclePhase}">
        <span class="gr-green">${greenRed.green}</span>/<span class="gr-red">${greenRed.red}</span>
      </div>
    `;
  });
  
  document.getElementById('heatmap').innerHTML = html;
  
  // Update title
  const dataType = showVolatility ? 'Volatility' : 'Returns';
  document.getElementById('heatmapTitle').textContent = 
    `${assetData.name} Monthly ${dataType} (${years[0]}-${years[years.length - 1]})`;
}

function renderStatistics() {
  const assetData = data.assets[currentAsset];
  const stats = assetData.statistics;
  
  // Calculate overall stats
  let totalGreen = 0, totalRed = 0;
  let allValues = [];
  let bestMonthData = { value: -Infinity, year: null, month: null };
  let worstMonthData = { value: Infinity, year: null, month: null };
  
  const years = getAvailableYears(currentAsset);
  
  years.forEach(year => {
    const yearData = assetData.data[year];
    for (let m = 1; m <= 12; m++) {
      const val = yearData[m];
      if (val !== null && val !== undefined) {
        allValues.push(val);
        if (val > 0) totalGreen++;
        else if (val < 0) totalRed++;
        
        if (val > bestMonthData.value) {
          bestMonthData = { value: val, year: year, month: m };
        }
        if (val < worstMonthData.value) {
          worstMonthData = { value: val, year: year, month: m };
        }
      }
    }
  });
  
  const avgReturn = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  const medianReturn = sorted.length > 0 ? (sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 
    : sorted[Math.floor(sorted.length / 2)]) : 0;
  const winRate = totalGreen + totalRed > 0 ? (totalGreen / (totalGreen + totalRed) * 100) : 0;
  
  // Calculate average annual return
  let annualReturns = [];
  years.forEach(year => {
    const yearData = assetData.data[year];
    const yearValues = [];
    for (let m = 1; m <= 12; m++) {
      if (yearData[m] !== null && yearData[m] !== undefined) {
        yearValues.push(yearData[m]);
      }
    }
    if (yearValues.length >= 6) { // Only count years with sufficient data
      let compound = 1;
      yearValues.forEach(r => { compound *= (1 + r / 100); });
      annualReturns.push((compound - 1) * 100);
    }
  });
  const avgAnnualReturn = annualReturns.length > 0 ? annualReturns.reduce((a, b) => a + b, 0) / annualReturns.length : 0;
  
  // Calculate current streak
  let currentStreak = 0;
  let streakType = '';
  const lastYear = years[years.length - 1];
  const lastYearData = assetData.data[lastYear];
  
  // Find the most recent month with data
  for (let m = 12; m >= 1; m--) {
    if (lastYearData[m] !== null && lastYearData[m] !== undefined) {
      streakType = lastYearData[m] >= 0 ? 'green' : 'red';
      break;
    }
  }
  
  // Count the streak
  outer: for (let y = years.length - 1; y >= 0; y--) {
    const year = years[y];
    const yearData = assetData.data[year];
    for (let m = 12; m >= 1; m--) {
      const val = yearData[m];
      if (val === null || val === undefined) continue;
      const isGreen = val >= 0;
      if ((streakType === 'green' && isGreen) || (streakType === 'red' && !isGreen)) {
        currentStreak++;
      } else {
        break outer;
      }
    }
  }
  
  const displayReturn = useMedian ? medianReturn : avgReturn;
  const returnLabel = useMedian ? 'Med Monthly' : 'Avg Monthly';
  const bestMonthName = data.months[bestMonthData.month - 1];
  const worstMonthName = data.months[worstMonthData.month - 1];
  
  // Get previous year's best/worst
  const prevYear = years[years.length - 2] || years[years.length - 1];
  const prevYearData = assetData.data[prevYear];
  let prevBest = { value: -Infinity, month: null };
  let prevWorst = { value: Infinity, month: null };
  for (let m = 1; m <= 12; m++) {
    const val = prevYearData[m];
    if (val !== null && val !== undefined) {
      if (val > prevBest.value) prevBest = { value: val, month: m };
      if (val < prevWorst.value) prevWorst = { value: val, month: m };
    }
  }
  const prevBestMonthName = data.months[prevBest.month - 1];
  const prevWorstMonthName = data.months[prevWorst.month - 1];
  
  // Calculate median streak length for current streak type (ignoring streaks < 3)
  let streaks = [];
  let tempStreak = 0;
  let lastType = null;
  years.forEach(year => {
    const yearData = assetData.data[year];
    for (let m = 1; m <= 12; m++) {
      const val = yearData[m];
      if (val === null || val === undefined) continue;
      const thisType = val >= 0 ? 'green' : 'red';
      if (thisType === lastType || lastType === null) {
        tempStreak++;
      } else {
        if (tempStreak >= 3) streaks.push({ type: lastType, length: tempStreak }); // Only count streaks >= 3
        tempStreak = 1;
      }
      lastType = thisType;
    }
  });
  if (tempStreak >= 3) streaks.push({ type: lastType, length: tempStreak });
  
  const sameTypeStreaks = streaks.filter(s => s.type === streakType).map(s => s.length).sort((a, b) => a - b);
  const medianStreak = sameTypeStreaks.length > 0 
    ? (sameTypeStreaks.length % 2 === 0 
      ? (sameTypeStreaks[sameTypeStreaks.length / 2 - 1] + sameTypeStreaks[sameTypeStreaks.length / 2]) / 2 
      : sameTypeStreaks[Math.floor(sameTypeStreaks.length / 2)])
    : 3; // Default to 3 if no qualifying streaks
  
  // Streak color: white at 1, incrementally more green/red as it grows
  // At 1: white, at 6+: full color
  function getStreakColor(value, type) {
    if (value <= 1) return '#ffffff';
    const intensity = Math.min(1, (value - 1) / 5); // Full intensity at 6
    if (type === 'green') {
      const r = Math.round(255 - intensity * 255);
      const g = Math.round(255 - intensity * 25);
      const b = Math.round(255 - intensity * 137);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = Math.round(255);
      const g = Math.round(255 - intensity * 173);
      const b = Math.round(255 - intensity * 173);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const streakColor = getStreakColor(currentStreak, streakType);
  const medianStreakColor = getStreakColor(Math.round(medianStreak), streakType);
  
  // Helper for negative value class
  const negClass = (val) => val < 0 ? 'negative' : '';
  const returnLabelFull = useMedian ? 'Med. Monthly Performance' : 'Avg. Monthly Performance';
  
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-item">
      <div class="stat-value ${negClass(displayReturn)}">${formatValue(displayReturn)}%</div>
      <div class="stat-label">${returnLabelFull}</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${formatValue(winRate)}%</div>
      <div class="stat-label">Months Closing Green</div>
      <div class="stat-sublabel">(Win Rate)</div>
    </div>
    <div class="stat-item">
      <div class="stat-value custom-color" style="color: #00e676;">+${formatValue(prevBest.value)}%</div>
      <div class="stat-label">Best ${prevYear}</div>
      <div class="stat-sublabel">${prevBestMonthName}</div>
    </div>
    <div class="stat-item">
      <div class="stat-value negative">${formatValue(prevWorst.value)}%</div>
      <div class="stat-label">Worst ${prevYear}</div>
      <div class="stat-sublabel">${prevWorstMonthName}</div>
    </div>
    <div class="stat-item">
      <div class="stat-value custom-color" style="color: ${streakColor};">${currentStreak}</div>
      <div class="stat-label">Current Streak</div>
      <div class="stat-sublabel">${streakType} months</div>
    </div>
    <div class="stat-item">
      <div class="stat-value custom-color" style="color: ${medianStreakColor};">${Math.round(medianStreak)}</div>
      <div class="stat-label">Median Streak</div>
      <div class="stat-sublabel">${streakType} months</div>
    </div>
  `;
}

function renderSeasonalityChart() {
  const assetData = data.assets[currentAsset];
  const stats = assetData.statistics;
  
  const labels = data.months;
  const avgReturns = [];
  const winRates = [];
  const colors = [];
  
  for (let m = 1; m <= 12; m++) {
    const stat = stats[m];
    if (stat) {
      const value = useMedian ? stat.median : stat.average;
      avgReturns.push(value);
      winRates.push(stat.win_rate);
      colors.push(value >= 0 ? 'rgba(0, 204, 0, 0.8)' : 'rgba(255, 71, 87, 0.8)');
    } else {
      avgReturns.push(0);
      winRates.push(0);
      colors.push('rgba(255, 255, 255, 0.2)');
    }
  }
  
  const ctx = document.getElementById('seasonalityChart').getContext('2d');
  
  if (charts.seasonality) {
    charts.seasonality.destroy();
  }
  
  const chartLabel = useMedian ? 'Median Return %' : 'Avg Return %';
  
  charts.seasonality = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: avgReturns,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 23, 0.95)',
          borderColor: '#0DCAB1',
          borderWidth: 1,
          titleColor: '#0DCAB1',
          bodyColor: '#fff',
          padding: 12,
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              return [
                `${useMedian ? 'Median' : 'Avg'} Return: ${formatValue(avgReturns[idx])}%`,
                `Win Rate: ${formatValue(winRates[idx])}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)'
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: value => Math.round(value) + '%'
          }
        }
      }
    }
  });
}

function renderWinRateChart() {
  const assetData = data.assets[currentAsset];
  const stats = assetData.statistics;
  const years = getAvailableYears(currentAsset);
  const startYear = years[0];
  
  const labels = data.months;
  const winRates = [];
  
  for (let m = 1; m <= 12; m++) {
    const stat = stats[m];
    winRates.push(stat ? stat.win_rate : 0);
  }
  
  const ctx = document.getElementById('winRateChart').getContext('2d');
  
  if (charts.winRate) {
    charts.winRate.destroy();
  }
  
  charts.winRate = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: labels,
      datasets: [{
        data: winRates,
        backgroundColor: winRates.map((rate, i) => {
          const hue = rate > 50 ? 145 : 0;
          const saturation = Math.abs(rate - 50) * 2;
          return `hsla(${hue}, ${saturation}%, 50%, 0.7)`;
        }),
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 23, 0.95)',
          borderColor: '#0DCAB1',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return `Win Rate: ${formatValue(context.raw)}%`;
            }
          }
        }
      },
      scales: {
        r: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            backdropColor: 'transparent'
          }
        }
      }
    }
  });
  
  // Update subtitle with clarification
  const winRateHeader = document.querySelector('#winRateChart').closest('.card').querySelector('.card-header h2');
  if (winRateHeader) {
    winRateHeader.innerHTML = `Monthly Win Rate<span class="chart-subtitle">% of months closing green since ${startYear}</span>`;
  }
}

function renderHalvingTimeline() {
  const container = document.getElementById('halvingTimeline');
  
  const html = data.halvings.map((halving, idx) => {
    const monthName = data.months[halving.month - 1];
    const projectedClass = halving.projected ? 'projected' : '';
    const projectedLabel = halving.projected ? '<span class="projected-label">Projected</span>' : '';
    
    // Months to cycle top (if available)
    let monthsToTopHtml = '';
    if (halving.monthsToTop) {
      const prefix = halving.monthsToTopProjected ? '~' : '';
      monthsToTopHtml = `<div class="timeline-to-top">${prefix}${halving.monthsToTop} months to cycle top</div>`;
    }
    
    return `
      <div class="timeline-item ${projectedClass}">
        <div class="timeline-marker">${idx + 1}</div>
        <div class="timeline-label">${halving.label}</div>
        <div class="timeline-date">${halving.projected ? '~' : ''}${monthName} ${halving.year}</div>
        <div class="timeline-block">Block ${halving.block.toLocaleString()}</div>
        <div class="timeline-reward">
          <span class="reward-old">${halving.prevReward}</span>
          <span class="reward-arrow">→</span>
          <span class="reward-new">${halving.reward}</span>
        </div>
        ${monthsToTopHtml}
        ${projectedLabel}
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

function renderComparisonChart() {
  populateYearSelectors();
  renderCycleButtons();
  updateComparisonChart();
}

function populateYearSelectors() {
  const years = getAvailableYears(currentAsset);
  
  ['year1Select', 'year2Select'].forEach((id, idx) => {
    const select = document.getElementById(id);
    select.innerHTML = years.map(y => 
      `<option value="${y}" ${y === (idx === 0 ? comparisonYear1 : comparisonYear2) ? 'selected' : ''}>${y}</option>`
    ).join('');
  });
}

function renderCycleButtons() {
  const container = document.getElementById('cycleButtons');
  if (!container) return;
  
  container.innerHTML = `
    <button class="cycle-btn ${selectedCycleType === 'Top' ? 'active' : ''}" data-cycle="Top" style="--cycle-color: ${cycleColors.Top}">Top Years</button>
    <button class="cycle-btn ${selectedCycleType === 'Bottom' ? 'active' : ''}" data-cycle="Bottom" style="--cycle-color: ${cycleColors.Bottom}">Bottom Years</button>
    <button class="cycle-btn ${selectedCycleType === 'Recovery' ? 'active' : ''}" data-cycle="Recovery" style="--cycle-color: ${cycleColors.Recovery}">Recovery Years</button>
    <button class="cycle-btn ${selectedCycleType === 'Rally' ? 'active' : ''}" data-cycle="Rally" style="--cycle-color: ${cycleColors.Rally}">Rally Years</button>
    <button class="cycle-btn clear-btn" data-cycle="">Clear</button>
    <button class="toggle-btn yoy-vol-toggle ${yoyShowVolatility ? 'active' : ''}" id="yoyVolatilityToggle">
      ${yoyShowVolatility ? '📊 Show Returns' : '📈 Show Volatility'}
    </button>
  `;
}

function updateComparisonChart() {
  const assetData = data.assets[currentAsset];
  const labels = data.months;
  const availableYears = getAvailableYears(currentAsset);
  
  // Choose data source based on volatility toggle
  const dataSource = yoyShowVolatility ? assetData.volatilityData : assetData.data;
  
  let datasets = [];
  
  if (selectedCycleType && cycleGroups[selectedCycleType]) {
    // Show all years of the selected cycle type
    const cycleYears = cycleGroups[selectedCycleType].filter(y => availableYears.includes(y));
    const color = cycleColors[selectedCycleType];
    
    cycleYears.forEach((year, idx) => {
      const yearData = dataSource[year] || {};
      const values = [];
      for (let m = 1; m <= 12; m++) {
        values.push(yearData[m] || 0);
      }
      
      // Vary opacity for each year
      const opacity = 0.5 + (idx * 0.2);
      
      datasets.push({
        label: year.toString(),
        data: values,
        borderColor: color,
        backgroundColor: color.replace(')', `, ${opacity * 0.2})`).replace('rgb', 'rgba'),
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: color
      });
    });
    
    // Add average line for this cycle
    const avgValues = [];
    for (let m = 1; m <= 12; m++) {
      const monthValues = cycleYears.map(y => dataSource[y]?.[m]).filter(v => v !== null && v !== undefined);
      avgValues.push(monthValues.length > 0 ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length : 0);
    }
    
    datasets.push({
      label: `${selectedCycleType} Avg`,
      data: avgValues,
      borderColor: '#ffffff',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 3,
      borderDash: [5, 5],
      fill: false,
      tension: 0.3,
      pointRadius: 0
    });
  } else {
    // Show individual year comparison
    const year1Data = dataSource[comparisonYear1] || {};
    const year2Data = dataSource[comparisonYear2] || {};
    
    const values1 = [];
    const values2 = [];
    
    for (let m = 1; m <= 12; m++) {
      values1.push(year1Data[m] || 0);
      values2.push(year2Data[m] || 0);
    }
    
    datasets = [
      {
        label: comparisonYear1.toString(),
        data: values1,
        borderColor: '#0DCAB1',
        backgroundColor: 'rgba(13, 202, 177, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#0DCAB1'
      },
      {
        label: comparisonYear2.toString(),
        data: values2,
        borderColor: '#00CC00',
        backgroundColor: 'rgba(0, 204, 0, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#00CC00'
      }
    ];
  }
  
  const ctx = document.getElementById('comparisonChart').getContext('2d');
  
  if (charts.comparison) {
    charts.comparison.destroy();
  }
  
  charts.comparison = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: { size: 12, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 23, 0.95)',
          borderColor: '#0DCAB1',
          borderWidth: 1,
          titleColor: '#0DCAB1',
          bodyColor: '#fff',
          padding: 12,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const sign = value >= 0 ? '+' : '';
              return `${context.dataset.label}: ${sign}${formatValue(value)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)'
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: value => Math.round(value) + '%'
          }
        }
      }
    }
  });
}

function renderInsights() {
  const assetData = data.assets[currentAsset];
  const stats = assetData.statistics;
  
  // Find best and worst months
  let bestMonth = { month: 1, avg: -Infinity };
  let worstMonth = { month: 1, avg: Infinity };
  let mostVolatile = { month: 1, stdDev: 0 };
  let highestWinRate = { month: 1, rate: 0, count: 0 };
  
  for (let m = 1; m <= 12; m++) {
    const stat = stats[m];
    if (stat) {
      const value = useMedian ? stat.median : stat.average;
      if (value > bestMonth.avg) {
        bestMonth = { month: m, avg: value };
      }
      if (value < worstMonth.avg) {
        worstMonth = { month: m, avg: value };
      }
      if (stat.stdDev > mostVolatile.stdDev) {
        mostVolatile = { month: m, stdDev: stat.stdDev };
      }
      if (stat.win_rate > highestWinRate.rate) {
        highestWinRate = { month: m, rate: stat.win_rate, count: stat.count };
      }
    }
  }
  
  const valueLabel = useMedian ? 'Median' : 'Avg';
  
  document.getElementById('insightsGrid').innerHTML = `
    <div class="insight-card">
      <div class="insight-icon">📈</div>
      <div class="insight-title">Best Month</div>
      <div class="insight-value">${data.months[bestMonth.month - 1]}</div>
      <div class="insight-desc">${valueLabel} return: ${bestMonth.avg >= 0 ? '+' : ''}${formatValue(bestMonth.avg)}%</div>
    </div>
    <div class="insight-card">
      <div class="insight-icon">📉</div>
      <div class="insight-title">Worst Month</div>
      <div class="insight-value">${data.months[worstMonth.month - 1]}</div>
      <div class="insight-desc">${valueLabel} return: ${worstMonth.avg >= 0 ? '+' : ''}${formatValue(worstMonth.avg)}%</div>
    </div>
    <div class="insight-card">
      <div class="insight-icon">🎯</div>
      <div class="insight-title">Highest Win Rate</div>
      <div class="insight-value">${data.months[highestWinRate.month - 1]}</div>
      <div class="insight-desc">${formatValue(highestWinRate.rate)}% positive months</div>
    </div>
    <div class="insight-card">
      <div class="insight-icon">⚡</div>
      <div class="insight-title">Most Volatile</div>
      <div class="insight-value">${data.months[mostVolatile.month - 1]}</div>
      <div class="insight-desc">Std Dev: ${formatValue(mostVolatile.stdDev)}%</div>
    </div>
  `;
}

function renderQuarterlyTable() {
  const assetData = data.assets[currentAsset];
  const years = getAvailableYears(currentAsset);
  
  // Calculate quarterly data for each year
  const quarterlyData = {};
  let q1Total = [], q2Total = [], q3Total = [], q4Total = [];
  
  years.forEach(year => {
    const yearData = assetData.data[year];
    if (!yearData) return;
    
    // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
    const q1 = [yearData[1], yearData[2], yearData[3]].filter(v => v !== null && v !== undefined);
    const q2 = [yearData[4], yearData[5], yearData[6]].filter(v => v !== null && v !== undefined);
    const q3 = [yearData[7], yearData[8], yearData[9]].filter(v => v !== null && v !== undefined);
    const q4 = [yearData[10], yearData[11], yearData[12]].filter(v => v !== null && v !== undefined);
    
    // Compound quarterly returns
    const compoundReturn = (arr) => {
      if (arr.length === 0) return null;
      let compound = 1;
      arr.forEach(r => { compound *= (1 + r / 100); });
      return (compound - 1) * 100;
    };
    
    quarterlyData[year] = {
      q1: compoundReturn(q1),
      q2: compoundReturn(q2),
      q3: compoundReturn(q3),
      q4: compoundReturn(q4)
    };
    
    if (quarterlyData[year].q1 !== null) q1Total.push(quarterlyData[year].q1);
    if (quarterlyData[year].q2 !== null) q2Total.push(quarterlyData[year].q2);
    if (quarterlyData[year].q3 !== null) q3Total.push(quarterlyData[year].q3);
    if (quarterlyData[year].q4 !== null) q4Total.push(quarterlyData[year].q4);
  });
  
  // Calculate averages
  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgQ1 = avg(q1Total);
  const avgQ2 = avg(q2Total);
  const avgQ3 = avg(q3Total);
  const avgQ4 = avg(q4Total);
  
  // Build table HTML
  let html = `
    <table class="quarterly-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Q1<br><small>Jan-Mar</small></th>
          <th>Q2<br><small>Apr-Jun</small></th>
          <th>Q3<br><small>Jul-Sep</small></th>
          <th>Q4<br><small>Oct-Dec</small></th>
          <th>Annual</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Recent years only (last 8)
  const recentYears = years.slice(-8);
  
  recentYears.forEach(year => {
    const qd = quarterlyData[year];
    if (!qd) return;
    
    const annual = [qd.q1, qd.q2, qd.q3, qd.q4].filter(v => v !== null);
    let annualReturn = null;
    if (annual.length > 0) {
      let compound = 1;
      annual.forEach(r => { compound *= (1 + r / 100); });
      annualReturn = (compound - 1) * 100;
    }
    
    const formatQ = (val) => {
      if (val === null) return '<span class="q-null">—</span>';
      const cls = val >= 0 ? 'q-positive' : 'q-negative';
      return `<span class="${cls}">${val >= 0 ? '+' : ''}${formatValue(val)}%</span>`;
    };
    
    html += `
      <tr>
        <td class="q-year">${year}</td>
        <td>${formatQ(qd.q1)}</td>
        <td>${formatQ(qd.q2)}</td>
        <td>${formatQ(qd.q3)}</td>
        <td>${formatQ(qd.q4)}</td>
        <td>${formatQ(annualReturn)}</td>
      </tr>
    `;
  });
  
  // Average row
  const formatQ = (val) => {
    const cls = val >= 0 ? 'q-positive' : 'q-negative';
    return `<span class="${cls}">${val >= 0 ? '+' : ''}${formatValue(val)}%</span>`;
  };
  
  html += `
      <tr class="q-avg-row">
        <td class="q-year">Avg</td>
        <td>${formatQ(avgQ1)}</td>
        <td>${formatQ(avgQ2)}</td>
        <td>${formatQ(avgQ3)}</td>
        <td>${formatQ(avgQ4)}</td>
        <td>${formatQ(avgQ1 + avgQ2 + avgQ3 + avgQ4)}</td>
      </tr>
    </tbody>
    </table>
  `;
  
  document.getElementById('quarterlyTable').innerHTML = html;
}

function setupEventListeners() {
  // Asset selector
  document.getElementById('assetSelector').addEventListener('click', (e) => {
    if (e.target.classList.contains('asset-btn')) {
      document.querySelectorAll('.asset-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentAsset = e.target.dataset.asset;
      selectedCycleType = null; // Reset cycle selection
      renderDashboard();
    }
  });
  
  // Year comparison selectors
  document.getElementById('year1Select').addEventListener('change', (e) => {
    comparisonYear1 = parseInt(e.target.value);
    selectedCycleType = null;
    renderCycleButtons();
    updateComparisonChart();
  });
  
  document.getElementById('year2Select').addEventListener('change', (e) => {
    comparisonYear2 = parseInt(e.target.value);
    selectedCycleType = null;
    renderCycleButtons();
    updateComparisonChart();
  });
  
  // Cycle buttons
  document.getElementById('cycleButtons')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('cycle-btn') && !e.target.classList.contains('yoy-vol-toggle')) {
      const cycle = e.target.dataset.cycle;
      selectedCycleType = cycle || null;
      renderCycleButtons();
      updateComparisonChart();
    }
    
    // YoY Volatility toggle
    if (e.target.id === 'yoyVolatilityToggle') {
      yoyShowVolatility = !yoyShowVolatility;
      renderCycleButtons(); // Re-render to update button text
      updateComparisonChart();
    }
  });
  
  // Volatility toggle
  document.getElementById('volatilityToggle').addEventListener('click', () => {
    showVolatility = !showVolatility;
    document.getElementById('volatilityToggle').classList.toggle('active', showVolatility);
    document.getElementById('volatilityToggle').textContent = showVolatility ? '📊 Show Returns' : '📈 Show Volatility';
    renderHeatmap();
  });
  
  // Function to sync all median toggles and update displays
  function toggleMedian() {
    useMedian = !useMedian;
    
    // Update all toggle buttons
    const mainToggle = document.getElementById('medianToggle');
    const seasonalityToggle = document.getElementById('seasonalityMedianToggle');
    
    mainToggle.classList.toggle('active', useMedian);
    mainToggle.textContent = useMedian ? '📉 Use Average' : '📊 Use Median';
    
    seasonalityToggle.classList.toggle('active', useMedian);
    seasonalityToggle.textContent = useMedian ? '📉 Use Average' : '📊 Use Median';
    
    // Update seasonality chart title
    document.getElementById('seasonalityTitle').textContent = 
      useMedian ? 'Median Return by Month' : 'Average Return by Month';
    
    // Re-render affected components
    renderHeatmap();
    renderStatistics();
    renderSeasonalityChart();
    renderInsights();
  }
  
  // Median/Average toggle - main grid toggle
  document.getElementById('medianToggle').addEventListener('click', toggleMedian);
  
  // Median/Average toggle - seasonality chart toggle (synced)
  document.getElementById('seasonalityMedianToggle').addEventListener('click', toggleMedian);
  
  // Tooltip on heatmap
  const tooltip = document.getElementById('tooltip');
  
  document.getElementById('heatmap').addEventListener('mousemove', (e) => {
    if (e.target.classList.contains('heatmap-cell') && !e.target.classList.contains('null')) {
      const year = e.target.dataset.year;
      const month = parseInt(e.target.dataset.month);
      const value = parseFloat(e.target.dataset.value);
      
      if (!year || isNaN(month) || isNaN(value)) return;
      
      const dataType = showVolatility ? 'Volatility' : 'Return';
      
      tooltip.querySelector('.tooltip-title').textContent = 
        `${data.months[month - 1]} ${year}`;
      
      const valueEl = tooltip.querySelector('.tooltip-value');
      valueEl.textContent = `${dataType}: ${(value >= 0 ? '+' : '')}${formatValue(value)}%`;
      valueEl.className = 'tooltip-value ' + (value >= 0 ? 'positive' : 'negative');
      
      tooltip.style.left = (e.clientX + 15) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
      tooltip.classList.add('visible');
    }
  });
  
  document.getElementById('heatmap').addEventListener('mouseleave', () => {
    tooltip.classList.remove('visible');
  });
  
  document.getElementById('heatmap').addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('heatmap-cell')) {
      tooltip.classList.remove('visible');
    }
  });
  
  // Heatmap row highlighting - click on cycle or year
  document.getElementById('heatmap').addEventListener('click', (e) => {
    const target = e.target;
    
    // Click on cycle label
    if (target.classList.contains('heatmap-cycle') && target.dataset.cycle) {
      const clickedCycle = target.dataset.cycle;
      
      // Toggle - if same cycle clicked, clear highlight
      if (highlightedCycle === clickedCycle) {
        highlightedCycle = null;
        highlightedYear = null;
      } else {
        highlightedCycle = clickedCycle;
        highlightedYear = null;
      }
      
      applyRowHighlighting();
      return;
    }
    
    // Click on year label
    if (target.classList.contains('heatmap-year') && target.dataset.rowYear) {
      const clickedYear = target.dataset.rowYear;
      
      // Toggle - if same year clicked, clear highlight
      if (highlightedYear === clickedYear) {
        highlightedYear = null;
        highlightedCycle = null;
      } else {
        highlightedYear = clickedYear;
        highlightedCycle = null;
      }
      
      applyRowHighlighting();
      return;
    }
  });
}

// Apply row highlighting based on highlightedCycle or highlightedYear
function applyRowHighlighting() {
  const allElements = document.querySelectorAll('#heatmap [data-row-year]');
  
  if (!highlightedCycle && !highlightedYear) {
    // Clear all highlighting
    allElements.forEach(el => {
      el.classList.remove('heatmap-row-dimmed', 'heatmap-row-highlighted');
    });
    return;
  }
  
  allElements.forEach(el => {
    const elCycle = el.dataset.cycle;
    const elYear = el.dataset.rowYear;
    
    let shouldHighlight = false;
    
    if (highlightedCycle) {
      shouldHighlight = elCycle === highlightedCycle;
    } else if (highlightedYear) {
      shouldHighlight = elYear === highlightedYear;
    }
    
    if (shouldHighlight) {
      el.classList.remove('heatmap-row-dimmed');
      el.classList.add('heatmap-row-highlighted');
    } else {
      el.classList.remove('heatmap-row-highlighted');
      el.classList.add('heatmap-row-dimmed');
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
