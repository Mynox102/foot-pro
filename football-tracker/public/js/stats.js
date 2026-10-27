/**
 * Football Tracker - Module Statistiques & Graphiques
 */

window.statsModule = (() => {
  let selectedPeriod = '4'; // '4', '8', '12', '26', 'all'

  const CATEGORIES = [
    { key: 'Technique', label: 'Technique', color: '#10b981' },
    { key: 'Vitesse', label: 'Vitesse', color: '#38bdf8' },
    { key: 'Endurance', label: 'Endurance', color: '#f59e0b' },
    { key: 'Poids du corps', label: 'Poids du corps', color: '#a855f7' }
  ];

  function initHandlers() {
    const filterContainer = document.getElementById('period-filters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.period-pill');
        if (!pill) return;
        document.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedPeriod = pill.dataset.period;
        render();
      });
    }
  }

  // Get Monday date object for a given date
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(date.setDate(diff));
    m.setHours(0, 0, 0, 0);
    return m;
  }

  function formatDateShort(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  // Group trainings by ISO week
  function buildWeeklyBuckets() {
    const numWeeks = selectedPeriod === 'all' ? 16 : Number(selectedPeriod);
    const currentMonday = getMonday(new Date());

    const weeks = [];
    for (let i = numWeeks - 1; i >= 0; i--) {
      const start = new Date(currentMonday);
      start.setDate(currentMonday.getDate() - (i * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      weeks.push({
        startDate: start,
        endDate: end,
        label: `S ${formatDateShort(start)}`,
        fullLabel: `Semaine du ${formatDateShort(start)} au ${formatDateShort(end)}`,
        categories: {
          'Technique': 0,
          'Vitesse': 0,
          'Endurance': 0,
          'Poids du corps': 0
        },
        totalCompleted: 0,
        totalPlanned: 0,
        totalMinutes: 0
      });
    }

    // Populate buckets
    state.trainings.forEach(t => {
      const tDate = new Date(t.date + 'T12:00:00');
      // Find matching week
      const bucket = weeks.find(w => tDate >= w.startDate && tDate <= w.endDate);
      if (bucket) {
        if (t.status === 'prévu') {
          bucket.totalPlanned += 1;
        } else if (t.status === 'terminé') {
          bucket.totalCompleted += 1;
          bucket.totalMinutes += Number(t.duration) || 0;
          if (bucket.categories[t.category] !== undefined) {
            bucket.categories[t.category] += 1;
          }
        }
      }
    });

    return weeks;
  }

  function renderKPIs(weeks) {
    let totalCompleted = 0;
    let totalPlanned = 0;
    let totalMinutes = 0;
    const catCounts = { 'Technique': 0, 'Vitesse': 0, 'Endurance': 0, 'Poids du corps': 0 };

    weeks.forEach(w => {
      totalCompleted += w.totalCompleted;
      totalPlanned += w.totalPlanned;
      totalMinutes += w.totalMinutes;
      Object.keys(catCounts).forEach(cat => {
        catCounts[cat] += w.categories[cat] || 0;
      });
    });

    // 1. Total Completed
    const kpiCount = document.getElementById('kpi-trainings-count');
    if (kpiCount) kpiCount.textContent = totalCompleted;

    // 2. Total Time
    const kpiTime = document.getElementById('kpi-total-time');
    const kpiAvg = document.getElementById('kpi-avg-time');
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (kpiTime) kpiTime.textContent = `${hours}h ${String(mins).padStart(2, '0')}`;
    if (kpiAvg) {
      const avgMinutesPerWeek = weeks.length > 0 ? Math.round(totalMinutes / weeks.length) : 0;
      kpiAvg.textContent = `Moyenne : ${Math.floor(avgMinutesPerWeek / 60)}h ${avgMinutesPerWeek % 60}m / sem.`;
    }

    // 3. Completion rate
    const totalAll = totalCompleted + totalPlanned;
    const rate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 100;
    const kpiRate = document.getElementById('kpi-completion-rate');
    if (kpiRate) kpiRate.textContent = `${rate}%`;

    // 4. Dominant category
    let topCat = '-';
    let maxCount = 0;
    Object.keys(catCounts).forEach(cat => {
      if (catCounts[cat] > maxCount) {
        maxCount = catCounts[cat];
        topCat = cat;
      }
    });
    const kpiTop = document.getElementById('kpi-top-category');
    const kpiTopSub = document.getElementById('kpi-top-category-sub');
    if (kpiTop) kpiTop.textContent = topCat;
    if (kpiTopSub) {
      const pct = totalCompleted > 0 ? Math.round((maxCount / totalCompleted) * 100) : 0;
      kpiTopSub.textContent = `${pct}% des séances terminées (${maxCount})`;
    }
  }

  // Render SVG Chart 1: 4 Category Curves
  function renderCategoryCurvesChart(weeks) {
    const container = document.getElementById('category-chart-container');
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 35, left: 40 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find max value across all categories in any week
    let maxVal = 3;
    weeks.forEach(w => {
      CATEGORIES.forEach(c => {
        if (w.categories[c.key] > maxVal) maxVal = w.categories[c.key];
      });
    });
    maxVal = Math.ceil(maxVal) + 1;

    const nPoints = weeks.length;
    const getX = (index) => padding.left + (nPoints > 1 ? (index / (nPoints - 1)) * chartW : chartW / 2);
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;

    // Horizontal grid lines
    const ySteps = maxVal <= 5 ? maxVal : 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxVal / ySteps) * i);
      const y = getY(val);
      svg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1e2433" stroke-width="1" />
        <text x="${padding.left - 10}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end">${val}</text>
      `;
    }

    // Vertical grid lines & X Labels
    weeks.forEach((w, idx) => {
      const x = getX(idx);
      svg += `
        <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + chartH}" stroke="#161b26" stroke-width="1" />
        <text x="${x}" y="${height - 10}" fill="#94a3b8" font-size="11" text-anchor="middle">${w.label}</text>
      `;
    });

    // 4 Distinct Curves
    CATEGORIES.forEach(cat => {
      let pathD = '';
      weeks.forEach((w, idx) => {
        const x = getX(idx);
        const y = getY(w.categories[cat.key] || 0);
        if (idx === 0) {
          pathD += `M ${x} ${y}`;
        } else {
          // Smooth curve using cubic bezier
          const prevX = getX(idx - 1);
          const prevY = getY(weeks[idx - 1].categories[cat.key] || 0);
          const cpX1 = prevX + (x - prevX) / 2;
          const cpX2 = cpX1;
          pathD += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
        }
      });

      // Render line path
      svg += `<path d="${pathD}" fill="none" stroke="${cat.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />`;

      // Render points with interactive tooltips
      weeks.forEach((w, idx) => {
        const x = getX(idx);
        const count = w.categories[cat.key] || 0;
        const y = getY(count);
        svg += `
          <circle cx="${x}" cy="${y}" r="4.5" fill="#0c0d12" stroke="${cat.color}" stroke-width="2.5" style="cursor: pointer;">
            <title>${cat.label} : ${count} séance${count > 1 ? 's' : ''} (${w.fullLabel})</title>
          </circle>
        `;
      });
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  // Render SVG Chart 2: Total weekly training volume in hours
  function renderVolumeChart(weeks) {
    const container = document.getElementById('volume-chart-container');
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Convert minutes to hours
    const hoursData = weeks.map(w => w.totalMinutes / 60);
    let maxHours = Math.max(...hoursData, 3);
    maxHours = Math.ceil(maxHours) + 0.5;

    const getY = (val) => padding.top + chartH - (val / maxHours) * chartH;
    const barWidth = Math.min(40, (chartW / weeks.length) * 0.6);

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;

    // Definitions for gradient
    svg += `
      <defs>
        <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.2" />
        </linearGradient>
      </defs>
    `;

    // Horizontal grid lines
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = ((maxHours / ySteps) * i).toFixed(1);
      const y = getY(val);
      svg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1e2433" stroke-width="1" />
        <text x="${padding.left - 10}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end">${val}h</text>
      `;
    }

    // Bars
    weeks.forEach((w, idx) => {
      const h = w.totalMinutes / 60;
      const xCenter = padding.left + ((idx + 0.5) / weeks.length) * chartW;
      const x = xCenter - barWidth / 2;
      const y = getY(h);
      const barH = padding.top + chartH - y;

      svg += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 2)}" rx="4" fill="url(#volGradient)" stroke="#3b82f6" stroke-width="1.2">
          <title>${w.fullLabel}\nVolume : ${Math.floor(w.totalMinutes / 60)}h ${w.totalMinutes % 60}m (${w.totalCompleted} séances)</title>
        </rect>
        <text x="${xCenter}" y="${height - 10}" fill="#94a3b8" font-size="11" text-anchor="middle">${w.label}</text>
      `;

      if (h > 0) {
        svg += `
          <text x="${xCenter}" y="${y - 6}" fill="#93c5fd" font-size="11" font-weight="600" text-anchor="middle">${h.toFixed(1)}h</text>
        `;
      }
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  function render() {
    const weeks = buildWeeklyBuckets();
    renderKPIs(weeks);
    renderCategoryCurvesChart(weeks);
    renderVolumeChart(weeks);
  }

  // Handle window resizing
  window.addEventListener('resize', () => {
    if (state.activePage === 'stats') {
      render();
    }
  });

  initHandlers();

  return { render };
})();
