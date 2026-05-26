// Tiny dashboard helpers
(function () {
  const ds = document.querySelectorAll('[data-chart-line]');
  ds.forEach((canvas) => {
    const labels = JSON.parse(canvas.dataset.labels || '[]');
    const values = JSON.parse(canvas.dataset.values || '[]');
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(56,189,248,0.45)');
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ data: values, borderColor: '#38bdf8', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  });

  document.querySelectorAll('[data-chart-bar]').forEach((canvas) => {
    const labels = JSON.parse(canvas.dataset.labels || '[]');
    const values = JSON.parse(canvas.dataset.values || '[]');
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: '#6366f1', borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b' } }, y: { ticks: { color: '#64748b' } } } },
    });
  });

  document.querySelectorAll('[data-chart-doughnut]').forEach((canvas) => {
    const labels = JSON.parse(canvas.dataset.labels || '[]');
    const values = JSON.parse(canvas.dataset.values || '[]');
    new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: ['#38bdf8', '#6366f1', '#a855f7', '#22d3ee', '#34d399', '#fb7185'] }] },
      options: { plugins: { legend: { labels: { color: '#cbd5e1' } } } },
    });
  });
})();
