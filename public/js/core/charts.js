/* global Chart */

const instances = new WeakMap();

const PALETTE = {
  violet: '#a78bfa',
  magenta: '#e879f9',
  amber: '#fbbf24',
  silver: '#c7c7d6',
  grid: 'rgba(255,255,255,0.06)',
  text: '#9a9aa8'
};

function destroyIfExists(canvas) {
  const existing = instances.get(canvas);
  if (existing) existing.destroy();
}

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false, labels: { color: PALETTE.text, font: { family: 'Inter' } } },
      tooltip: {
        backgroundColor: '#18181f',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        titleColor: '#f5f5f8',
        bodyColor: '#c7c7d6',
        padding: 10,
        cornerRadius: 10
      }
    },
    scales: {
      x: { grid: { color: 'transparent' }, ticks: { color: PALETTE.text, font: { size: 11 } } },
      y: { grid: { color: PALETTE.grid }, ticks: { color: PALETTE.text, font: { size: 11 } }, beginAtZero: true }
    },
    ...extra
  };
}

function gradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, color + '55');
  g.addColorStop(1, color + '02');
  return g;
}

export function lineChart(canvas, labels, series) {
  destroyIfExists(canvas);
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.data,
        borderColor: s.color || PALETTE.violet,
        backgroundColor: gradient(ctx, s.color || PALETTE.violet),
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.5
      }))
    },
    options: baseOptions({
      plugins: { legend: { display: series.length > 1, labels: { color: PALETTE.text } }, tooltip: baseOptions().plugins.tooltip }
    })
  });
  instances.set(canvas, chart);
  return chart;
}

export function barChart(canvas, labels, series) {
  destroyIfExists(canvas);
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.name,
        data: s.data,
        backgroundColor: s.color || PALETTE.violet,
        borderRadius: 6,
        maxBarThickness: 26
      }))
    },
    options: baseOptions({
      plugins: { legend: { display: series.length > 1, labels: { color: PALETTE.text } } }
    })
  });
  instances.set(canvas, chart);
  return chart;
}

export function donutChart(canvas, labels, data, colors) {
  destroyIfExists(canvas);
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { color: PALETTE.text, padding: 14, font: { size: 11.5 } } } }
    }
  });
  instances.set(canvas, chart);
  return chart;
}
