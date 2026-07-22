// ========== Estilo global do Chart.js ==========
Chart.defaults.color = '#cfe1e7';
Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.color = '#cfe1e7';

// ========== 1. Total de Alvarás Mensal (LINHA) ==========
new Chart(document.getElementById('chartAlvarasMensal'), {
  type: 'line',
  data: {
    labels: ['01/01/2026','02/2026','03/2026','04/2026','05/2026','06/2026','07/2026'],
    datasets: [{
      data: [2352, 2173, 2864, 2350, 3223, 2682, 1048],
      borderColor: '#4dd0e1',
      backgroundColor: 'rgba(77, 208, 225, 0.2)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#4dd0e1',
      pointRadius: 4
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } }
    }
  }
});

// ========== 2. Quantidade de Alvarás por Modalidade (PIZZA) ==========
new Chart(document.getElementById('chartModalidades'), {
  type: 'pie',
  data: {
    labels: [
      'Pagamento ao beneficiário',
      'Transferência Judicial entre Processos',
      'Guia Funjus/Funrejus',
      'Recolhimento de DARF',
      'Arrecadação com código de barras'
    ],
    datasets: [{
      data: [77.8, 9.7, 9.3, 2.0, 1.2],
      backgroundColor: ['#3d3f9c','#7fb8d9','#2e8b57','#e0c34a','#c04d4d'],
      borderColor: '#0f2a35',
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
    }
  }
});

// ========== 3. Precatórios por Órgão Pagador (BARRA HORIZONTAL) ==========
new Chart(document.getElementById('chartOrgaoPagador'), {
  type: 'bar',
  data: {
    labels: ['ESTADO DO P...','LONDRINA','FRANCISCO...','FOZ DO IGUA...','CURITIBA','APUCARANA','INSTITUTO N...','TOLEDO','ARAUCÁRIA','PATO BRANCO'],
    datasets: [{
      data: [16465,1608,1322,1243,1234,1043,713,690,656,620],
      backgroundColor: '#4a90d9'
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { grid: { display: false } }
    }
  }
});

// ========== 4. Precatórios por Exercício (LINHA COM AREA) ==========
new Chart(document.getElementById('chartExercicio'), {
  type: 'line',
  data: {
    labels: ['2017','2018','2019','2020','2021','2022','2023','2024','2025','2026'],
    datasets: [{
      data: [161,404,1252,1651,1949,2733,2385,4843,10881,9253],
      borderColor: '#4a90d9',
      backgroundColor: 'rgba(74,144,217,0.25)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#4a90d9'
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } }
    }
  }
});

// ========== 5. Crédito e Débito por Mês/Ano (2 LINHAS) ==========
new Chart(document.getElementById('chartCreditoDebito'), {
  type: 'line',
  data: {
    labels: ['02/2026','03/2026','04/2026','05/2026','06/2026','07/2026'],
    datasets: [
      {
        label: 'Crédito',
        data: [152.57, 554.73, 388.09, 148.13, 256.64, 20],
        borderColor: '#7a5cff',
        backgroundColor: 'rgba(122,92,255,0.2)',
        fill: true, tension: 0.3
      },
      {
        label: 'Débito',
        data: [152.57, 235.51, 388.09, 148.13, 256.64, 20],
        borderColor: '#e05a5a',
        backgroundColor: 'rgba(224,90,90,0.15)',
        fill: true, tension: 0.3
      }
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'top', labels: { boxWidth: 10 } } },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } }
    }
  }
});

// ========== 6. Gauge (Taxa de Utilização) ==========
const gaugeValue = 93;
new Chart(document.getElementById('chartGauge'), {
  type: 'doughnut',
  data: {
    labels: ['Utilizado','Restante'],
    datasets: [{
      data: [gaugeValue, 100 - gaugeValue],
      backgroundColor: ['#4a90d9','rgba(255,255,255,0.08)'],
      borderWidth: 0,
      circumference: 270,
      rotation: 225
    }]
  },
  options: {
    responsive: true,
    cutout: '75%',
    plugins: { legend: { display: false } }
  },
  plugins: [{
    id: 'gaugeText',
    afterDraw(chart) {
      const {ctx, chartArea:{width, height}} = chart;
      ctx.save();
      ctx.fillStyle = '#e6f1f5';
      ctx.font = 'bold 28px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(gaugeValue + '%', width/2, height/2 + 20);
      ctx.restore();
    }
  }]
});