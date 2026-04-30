/**
 * Camaçari na Mão — PoC de Visualização Territorial
 * script.js — Lógica principal do mapa e painel de insights
 *
 * ─────────────────────────────────────────────────
 * ATUALIZAÇÃO v2 — Pipeline SISSEDUR
 * ─────────────────────────────────────────────────
 * NOVO: Ingestão de dados_brutos.json (simulação SISSEDUR)
 * NOVO: Transformação via transformador.js (ETL)
 * NOVO: Painel de insights com contagem por tipo
 * NOVO: Bloco visual ANTES/DEPOIS da transformação
 * MANTIDO: Todos os comportamentos anteriores intactos
 * ─────────────────────────────────────────────────
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
let todosDados = [];  // todos os registros (após transformação)

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
  clusterGroup.clearLayers();

  dados.forEach(function(item) {
    const cor = CORES_TIPO[item.tipo] || COR_PADRAO;

    const statusClasse = {
      "Aberta":     "status-aberta",
      "Em análise": "status-analise",
      "Encerrada":  "status-encerrada"
    }[item.status] || "status-aberta";

    const marcador = L.marker([item.latitude, item.longitude], {
      icon: criarIcone(cor)
    });

    // ATUALIZADO: popup inclui endereço original quando disponível (dados SISSEDUR)
    const linhaEndereco = item.endereco
      ? `<div class="popup-linha"><strong>Endereço:</strong> ${item.endereco}</div>`
      : '';

    // ATUALIZADO: badge de fonte para identificar origem SISSEDUR
    const badgeFonte = item.fonte
      ? `<div style="margin-top:6px; font-size:10px; color:#888; text-align:right;">
           📡 Fonte: ${item.fonte}
         </div>`
      : '';

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
        ${linhaEndereco}
        <div class="popup-linha">
          <strong>Ocorrência:</strong> ${item.descricao}
        </div>
        <div>
          <span class="popup-status ${statusClasse}">${item.status}</span>
        </div>
        ${badgeFonte}
      </div>
    `;

    marcador.bindPopup(popupHTML, { maxWidth: 260 });

    marcador.bindTooltip(`<b>${item.tipo}</b><br>${item.bairro}`, {
      direction: 'top',
      offset: [0, -10]
    });

    clusterGroup.addLayer(marcador);
  });

  document.getElementById('contador-resultados').textContent =
    `${dados.length} ocorrência${dados.length !== 1 ? 's' : ''} exibida${dados.length !== 1 ? 's' : ''}`;
}

// =============================================================
// 6. PREENCHE O DROPDOWN DE FILTRO
// =============================================================
function preencherFiltro(dados) {
  const select = document.getElementById('filtro-tipo');

  // Remove opções anteriores (exceto "Todos")
  while (select.options.length > 1) select.remove(1);

  const tipos = [...new Set(dados.map(d => d.tipo))].sort();

  tipos.forEach(function(tipo) {
    const option = document.createElement('option');
    option.value = tipo;
    option.textContent = tipo;
    select.appendChild(option);
  });

  // Reconfigura o listener (remove duplicatas)
  const novoSelect = select.cloneNode(true);
  select.parentNode.replaceChild(novoSelect, select);

  novoSelect.addEventListener('change', function() {
    const tipoSelecionado = this.value;
    const dadosFiltrados = tipoSelecionado === ''
      ? todosDados
      : todosDados.filter(d => d.tipo === tipoSelecionado);

    plotarMarcadores(dadosFiltrados);
    atualizarPainel(dadosFiltrados);
    atualizarInsights(dadosFiltrados); // NOVO: atualiza painel de insights ao filtrar
  });
}

// =============================================================
// 7. PAINEL DE INSIGHTS (contagens por tipo e bairro)
// =============================================================
function atualizarPainel(dados) {
  document.getElementById('total-ocorrencias').textContent = dados.length;

  // --- Contagem por tipo ---
  const contagemTipo = {};
  dados.forEach(function(d) {
    contagemTipo[d.tipo] = (contagemTipo[d.tipo] || 0) + 1;
  });

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
// 7b. NOVO: Atualiza o painel #insights com contagem por tipo
// Elemento separado para demonstração clara do requisito
// =============================================================
function atualizarInsights(dados) {
  const container = document.getElementById('insights');
  if (!container) return;

  const contagemTipo = {};
  dados.forEach(function(d) {
    contagemTipo[d.tipo] = (contagemTipo[d.tipo] || 0) + 1;
  });

  const total = dados.length;

  let html = `
    <div class="insights-titulo">📊 Ocorrências por Tipo</div>
    <div class="insights-subtitulo">${total} registro${total !== 1 ? 's' : ''} no filtro atual</div>
  `;

  const ordenados = Object.entries(contagemTipo).sort((a, b) => b[1] - a[1]);

  ordenados.forEach(function([tipo, qtd]) {
    const cor = CORES_TIPO[tipo] || COR_PADRAO;
    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;

    html += `
      <div class="insights-linha">
        <span class="insights-dot" style="background:${cor}"></span>
        <span class="insights-nome">${tipo}</span>
        <span class="insights-pct">${pct}%</span>
        <span class="insights-num">${qtd}</span>
      </div>
    `;
  });

  if (ordenados.length === 0) {
    html += `<div style="color:#999; font-size:12px; text-align:center; padding:8px 0;">Sem dados</div>`;
  }

  container.innerHTML = html;
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
// 9. NOVO: Renderiza o bloco visual ANTES → DEPOIS
// Demonstra o conceito de integração e transformação de dados
// =============================================================
function renderizarAnteDepois(exemplo) {
  const container = document.getElementById('ante-depois');
  if (!container || !exemplo) return;

  const { bruto, transformado } = exemplo;

  container.innerHTML = `
    <div class="ad-bloco">
      <div class="ad-label ad-label-antes">⬇ ANTES <span>(SISSEDUR — dado bruto)</span></div>
      <div class="ad-codigo">
        <div><span class="ad-chave">id:</span> <span class="ad-val-str">"${bruto.id_sissedur}"</span></div>
        <div><span class="ad-chave">categoria:</span> <span class="ad-val-str">"${bruto.categoria}"</span></div>
        <div><span class="ad-chave">endereco:</span> <span class="ad-val-str">"${bruto.endereco}"</span></div>
        <div><span class="ad-chave">latitude:</span> <span class="ad-val-null">❌ ausente</span></div>
        <div><span class="ad-chave">longitude:</span> <span class="ad-val-null">❌ ausente</span></div>
      </div>
    </div>

    <div class="ad-seta">⬇ transformador.js</div>

    <div class="ad-bloco">
      <div class="ad-label ad-label-depois">✅ DEPOIS <span>(dado pronto para o mapa)</span></div>
      <div class="ad-codigo">
        <div><span class="ad-chave">tipo:</span> <span class="ad-val-str">"${transformado.tipo}"</span></div>
        <div><span class="ad-chave">bairro:</span> <span class="ad-val-str">"${transformado.bairro}"</span></div>
        <div><span class="ad-chave">latitude:</span> <span class="ad-val-num">${transformado.latitude}</span></div>
        <div><span class="ad-chave">longitude:</span> <span class="ad-val-num">${transformado.longitude}</span></div>
        <div><span class="ad-chave">fonte:</span> <span class="ad-val-str">"${transformado.fonte}"</span></div>
      </div>
    </div>
  `;
}

// =============================================================
// 10. HELPER: FORMATA DATA (ISO → DD/MM/AAAA)
// =============================================================
function formatarData(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// =============================================================
// 11. PONTO DE ENTRADA PRINCIPAL
// ATUALIZADO: carrega dados_brutos.json em vez de dados.json
// Pipeline: fetch → transformarDados() → plotar + painel
// =============================================================
fetch('dados_brutos.json')
  .then(function(response) {
    if (!response.ok) throw new Error('Erro ao carregar dados_brutos.json');
    return response.json();
  })
  .then(function(dadosBrutos) {

    // ── ETAPA 1: TRANSFORMAÇÃO ──────────────────────────────
    // Converte os dados brutos do SISSEDUR para o formato do mapa
    todosDados = transformarDados(dadosBrutos);

    // ── ETAPA 2: INICIALIZAÇÃO DO MAPA ─────────────────────
    inicializarMapa();

    // ── ETAPA 3: VISUALIZAÇÃO ──────────────────────────────
    plotarMarcadores(todosDados);
    preencherFiltro(todosDados);
    atualizarPainel(todosDados);
    preencherLegenda();

    // ── ETAPA 4: NOVO — INSIGHTS e ANTE/DEPOIS ─────────────
    atualizarInsights(todosDados);

    const exemplo = getExemploTransformacao(dadosBrutos);
    renderizarAnteDepois(exemplo);

  })
  .catch(function(erro) {
    console.error('Falha ao carregar dados:', erro);
    document.getElementById('map').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:12px; color:#c0392b; font-family:Arial;">
        <div style="font-size:40px;">⚠️</div>
        <div><strong>Erro ao carregar dados_brutos.json</strong></div>
        <div style="font-size:13px; color:#666;">Abra via servidor HTTP (ex: <code>python -m http.server</code>)<br>ou acesse diretamente pelo navegador com o arquivo local.</div>
      </div>
    `;
  });
