/**
 * Camaçari na Mão — PoC de Visualização Territorial
 * script.js — Lógica principal do mapa e painel de insights
 *
 * Dependências (CDN):
 *   - Leaflet.js (mapa)
 *   - Leaflet.markercluster (agrupamento de pontos)
 */

// =============================================================
// 1. PALETA DE CORES POR TIPO DE DENÚNCIA
// =============================================================
const CORES_TIPO = {
  "Obra irregular":              "#e74c3c",  // vermelho
  "Poluição sonora":             "#f39c12",  // laranja
  "Terreno abandonado":          "#8e44ad",  // roxo
  "Descarte irregular de lixo":  "#16a085",  // verde-teal
  "Ocupação irregular":          "#2980b9",  // azul
};

// Cor padrão para tipos não mapeados
const COR_PADRAO = "#7f8c8d";

// =============================================================
// 2. VARIÁVEIS GLOBAIS
// =============================================================
let mapa;             // instância do mapa Leaflet
let clusterGroup;     // grupo de marcadores com clustering
let todosDados = [];  // todos os registros carregados do JSON

// =============================================================
// 3. INICIALIZAÇÃO DO MAPA
// =============================================================
function inicializarMapa() {
  // Coordenadas do centro de Camaçari (BA)
  const CAMACARI_LAT = -12.6985;
  const CAMACARI_LNG = -38.3239;

  // Cria o mapa centrado em Camaçari, zoom 13
  mapa = L.map('map').setView([CAMACARI_LAT, CAMACARI_LNG], 13);

  // Camada de tiles OpenStreetMap (gratuita, sem necessidade de API key)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapa);

  // Inicializa o grupo de clusters (MarkerCluster)
  clusterGroup = L.markerClusterGroup({
    // Configura o ícone personalizado do cluster
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="
          background: linear-gradient(135deg, #1a5c2a, #2e7d46);
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${count}</div>`,
        className: 'cluster-custom',
        iconSize: [38, 38]
      });
    }
  });

  mapa.addLayer(clusterGroup);
}

// =============================================================
// 4. CRIA ÍCONE PERSONALIZADO POR COR
// =============================================================
function criarIcone(cor) {
  return L.divIcon({
    className: 'marcador-custom',
    html: `<div style="
      background: ${cor};
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
}

// =============================================================
// 5. PLOTA OS MARCADORES NO MAPA
// =============================================================
function plotarMarcadores(dados) {
  // Remove todos os marcadores existentes
  clusterGroup.clearLayers();

  dados.forEach(function(item) {
    // Obtém a cor correspondente ao tipo de denúncia
    const cor = CORES_TIPO[item.tipo] || COR_PADRAO;

    // Define a classe CSS do status para o popup
    const statusClasse = {
      "Aberta":     "status-aberta",
      "Em análise": "status-analise",
      "Encerrada":  "status-encerrada"
    }[item.status] || "status-aberta";

    // Cria o marcador na posição geográfica
    const marcador = L.marker([item.latitude, item.longitude], {
      icon: criarIcone(cor)
    });

    // Conteúdo do popup ao clicar no marcador
    const popupHTML = `
      <div class="popup-denuncia">
        <div class="popup-tipo" style="background: ${cor}">
          ${item.tipo}
        </div>
        <div class="popup-linha">
          <strong>Bairro:</strong> ${item.bairro}
        </div>
        <div class="popup-linha">
          <strong>Data:</strong> ${formatarData(item.data)}
        </div>
        <div class="popup-linha">
          <strong>Ocorrência:</strong> ${item.descricao}
        </div>
        <div>
          <span class="popup-status ${statusClasse}">${item.status}</span>
        </div>
      </div>
    `;

    marcador.bindPopup(popupHTML, { maxWidth: 240 });

    // Tooltip rápido ao passar o mouse
    marcador.bindTooltip(`<b>${item.tipo}</b><br>${item.bairro}`, {
      direction: 'top',
      offset: [0, -10]
    });

    clusterGroup.addLayer(marcador);
  });

  // Atualiza o contador de resultados no header
  document.getElementById('contador-resultados').textContent =
    `${dados.length} ocorrência${dados.length !== 1 ? 's' : ''} exibida${dados.length !== 1 ? 's' : ''}`;
}

// =============================================================
// 6. PREENCHE O DROPDOWN DE FILTRO
// =============================================================
function preencherFiltro(dados) {
  const select = document.getElementById('filtro-tipo');

  // Obtém os tipos únicos e ordena alfabeticamente
  const tipos = [...new Set(dados.map(d => d.tipo))].sort();

  tipos.forEach(function(tipo) {
    const option = document.createElement('option');
    option.value = tipo;
    option.textContent = tipo;
    select.appendChild(option);
  });

  // Evento de mudança no filtro
  select.addEventListener('change', function() {
    const tipoSelecionado = this.value;

    let dadosFiltrados;
    if (tipoSelecionado === '') {
      // "Todos" selecionado
      dadosFiltrados = todosDados;
    } else {
      dadosFiltrados = todosDados.filter(d => d.tipo === tipoSelecionado);
    }

    plotarMarcadores(dadosFiltrados);
    atualizarPainel(dadosFiltrados);
  });
}

// =============================================================
// 7. PAINEL DE INSIGHTS (contagens por tipo e bairro)
// =============================================================
function atualizarPainel(dados) {
  // --- Total geral ---
  document.getElementById('total-ocorrencias').textContent = dados.length;

  // --- Contagem por tipo ---
  const contagemTipo = {};
  dados.forEach(function(d) {
    contagemTipo[d.tipo] = (contagemTipo[d.tipo] || 0) + 1;
  });

  // Ordena por quantidade decrescente
  const tiposOrdenados = Object.entries(contagemTipo)
    .sort((a, b) => b[1] - a[1]);

  const maxQtd = tiposOrdenados.length > 0 ? tiposOrdenados[0][1] : 1;

  const insightContainer = document.getElementById('insight-tipos');
  insightContainer.innerHTML = '';

  tiposOrdenados.forEach(function([tipo, qtd]) {
    const cor = CORES_TIPO[tipo] || COR_PADRAO;
    const percentBarra = Math.round((qtd / maxQtd) * 100);

    insightContainer.innerHTML += `
      <div class="insight-item" style="border-left-color: ${cor}">
        <div class="cor-dot" style="background: ${cor}"></div>
        <div class="info">
          <div class="nome" title="${tipo}">${tipo}</div>
          <div class="barra-wrap">
            <div class="barra-fill" style="width: ${percentBarra}%; background: ${cor}"></div>
          </div>
        </div>
        <div class="qtd">${qtd}</div>
      </div>
    `;
  });

  // Caso sem dados
  if (tiposOrdenados.length === 0) {
    insightContainer.innerHTML = '<p style="font-size:12px; color:#999; text-align:center; padding:10px 0;">Nenhuma ocorrência</p>';
  }

  // --- Contagem por bairro ---
  const contagemBairro = {};
  dados.forEach(function(d) {
    contagemBairro[d.bairro] = (contagemBairro[d.bairro] || 0) + 1;
  });

  const bairrosOrdenados = Object.entries(contagemBairro)
    .sort((a, b) => b[1] - a[1]);

  const bairroContainer = document.getElementById('insight-bairros');
  bairroContainer.innerHTML = '';

  bairrosOrdenados.forEach(function([bairro, qtd]) {
    bairroContainer.innerHTML += `
      <div class="bairro-item">
        <span class="bairro-nome">${bairro}</span>
        <span class="bairro-qtd">${qtd}</span>
      </div>
    `;
  });

  if (bairrosOrdenados.length === 0) {
    bairroContainer.innerHTML = '<p style="font-size:12px; color:#999; text-align:center; padding:10px 0;">Nenhuma ocorrência</p>';
  }
}

// =============================================================
// 8. PREENCHE A LEGENDA DE CORES
// =============================================================
function preencherLegenda() {
  const legendaContainer = document.getElementById('legenda-cores');
  legendaContainer.innerHTML = '';

  Object.entries(CORES_TIPO).forEach(function([tipo, cor]) {
    legendaContainer.innerHTML += `
      <div class="legenda-item">
        <div class="legenda-dot" style="background: ${cor}"></div>
        <span>${tipo}</span>
      </div>
    `;
  });
}

// =============================================================
// 9. HELPER: FORMATA DATA (ISO → DD/MM/AAAA)
// =============================================================
function formatarData(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// =============================================================
// 10. CARREGA O ARQUIVO JSON E INICIALIZA TUDO
// =============================================================
fetch('dados.json')
  .then(function(response) {
    if (!response.ok) throw new Error('Erro ao carregar dados.json');
    return response.json();
  })
  .then(function(dados) {
    todosDados = dados;

    // Inicializa o mapa
    inicializarMapa();

    // Plota todos os marcadores inicialmente
    plotarMarcadores(todosDados);

    // Preenche o dropdown com os tipos disponíveis
    preencherFiltro(todosDados);

    // Preenche o painel de insights
    atualizarPainel(todosDados);

    // Preenche a legenda
    preencherLegenda();
  })
  .catch(function(erro) {
    console.error('Falha ao carregar dados:', erro);
    document.getElementById('map').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:12px; color:#c0392b; font-family:Arial;">
        <div style="font-size:40px;">⚠️</div>
        <div><strong>Erro ao carregar dados.json</strong></div>
        <div style="font-size:13px; color:#666;">Abra via servidor HTTP (ex: <code>python -m http.server</code>)<br>ou acesse diretamente pelo navegador com o arquivo local.</div>
      </div>
    `;
  });
