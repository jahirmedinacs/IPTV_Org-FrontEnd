// --- Configuración y Estado ---
const API_BASE = 'https://iptv-org.github.io/api';

const state = {
  allChannels: [],     // Raw channels
  streams: {},         // Map: channelId -> streamUrl
  logos: {},           // Map: channelId -> logoUrl
  countries: {},       // Map: code -> name/flag
  processedData: [],   // Canales unidos con streams (solo los válidos)
  filteredData: [],    // Datos después de filtros de búsqueda
  visibleCount: 0,     // Para infinite scroll
  BATCH_SIZE: 40,
  hls: null
};

// Elementos del DOM - Inicializados en window.onload o DOMContentLoaded
let els = {};

function initializeElements() {
  els = {
    grid: document.getElementById('channels-grid'),
    loader: document.getElementById('loading-indicator'),
    searchInput: document.getElementById('search-input'),
    countrySelect: document.getElementById('country-select'),
    categorySelect: document.getElementById('category-select'),
    countLabel: document.getElementById('channel-count'),
    noResults: document.getElementById('no-results'),
    modal: document.getElementById('video-modal'),
    video: document.getElementById('video-player'),
    modalTitle: document.getElementById('modal-title'),
    modalInfo: document.getElementById('modal-info'),
    playerError: document.getElementById('player-error'),
    loadTrigger: document.getElementById('load-more-trigger'),
    mainContainer: document.getElementById('main-container')
  };
}

// --- Inicialización ---
async function init() {
  initializeElements();

  try {
    // Descarga paralela de los recursos necesarios
    const [channelsRes, streamsRes, logosRes, countriesRes, categoriesRes] = await Promise.all([
      fetch(`${API_BASE}/channels.json`),
      fetch(`${API_BASE}/streams.json`),
      fetch(`${API_BASE}/logos.json`),
      fetch(`${API_BASE}/countries.json`),
      fetch(`${API_BASE}/categories.json`)
    ]);

    const channels = await channelsRes.json();
    const streams = await streamsRes.json();
    const logos = await logosRes.json();
    const countries = await countriesRes.json();
    const categories = await categoriesRes.json();

    processData(channels, streams, logos, countries, categories);
    setupFilters(countries, categories);
    setupInfiniteScroll();

    // Ocultar loader y mostrar grid
    els.loader.classList.add('hidden');
    els.grid.classList.remove('hidden');

    applyFilters();

  } catch (error) {
    console.error("Error cargando API:", error);
    if (els.loader) els.loader.innerHTML = `<p class="text-red-500">Error cargando datos. Revisa la consola.</p>`;
  }
}

// --- Procesamiento de Datos ---
function processData(channels, streams, logos, countries, categories) {
  // 1. Crear Mapas para acceso rápido

  // Streams: Priorizar HTTPs si es posible, sino el primero que encuentre
  streams.forEach(s => {
    if (!s.channel) return;
    // Si ya existe un stream, preferimos uno que no tenga error, pero aquí simplificaremos
    // Tomamos el primero que encontramos por canal
    if (!state.streams[s.channel]) {
      state.streams[s.channel] = s;
    }
  });

  // Logos
  logos.forEach(l => {
    if (!l.channel) return;
    state.logos[l.channel] = l.url;
  });

  // Paises
  countries.forEach(c => {
    state.countries[c.code] = c;
  });

  // 2. Unificar datos (JOIN)
  // Solo nos interesan canales que tengan STREAM y NO sean NSFW (por seguridad del demo)
  state.processedData = channels
    .filter(c => state.streams[c.id] && !c.is_nsfw)
    .map(c => {
      const countryData = state.countries[c.country] || { name: c.country, flag: '🌍' };
      return {
        id: c.id,
        name: c.name,
        alt_names: c.alt_names || [],
        countryCode: c.country,
        countryName: countryData.name,
        flag: countryData.flag,
        category: c.categories?.[0] || 'Uncategorized',
        logo: state.logos[c.id] || null,
        streamUrl: state.streams[c.id].url,
        website: c.website
      };
    });

  console.log(`Procesados ${state.processedData.length} canales válidos.`);
}

// --- Renderizado ---
function createChannelCard(channel) {
  const card = document.createElement('div');
  card.className = 'channel-card bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex flex-col h-full cursor-pointer group';
  // Use an IIFE or arrow function to capture 'channel' closure correctly if needed, but here it's fine
  card.addEventListener('click', () => openModal(channel));

  // Logo fallbacks
  const logoSrc = channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=1e293b&color=fff`;

  card.innerHTML = `
        <div class="logo-container w-full bg-slate-900 flex items-center justify-center p-4 relative">
            <img src="${logoSrc}" alt="${channel.name}" class="max-h-full max-w-full object-contain drop-shadow-md" loading="lazy" onerror="this.src='https://ui-avatars.com/api/?name=TV&background=334155&color=fff'">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <i class="fas fa-play-circle text-5xl text-blue-500 scale-75 group-hover:scale-110 transition-transform"></i>
            </div>
            <span class="absolute top-2 right-2 text-xl shadow-sm" title="${channel.countryName}">${channel.flag || ''}</span>
        </div>
        <div class="p-3 flex-1 flex flex-col justify-between">
            <div>
                <h3 class="font-bold text-slate-200 truncate" title="${channel.name}">${channel.name}</h3>
                <p class="text-xs text-slate-500 uppercase tracking-wider mt-1 truncate">${channel.category}</p>
            </div>
        </div>
    `;
  return card;
}

function renderBatch() {
  const toRender = state.filteredData.slice(state.visibleCount, state.visibleCount + state.BATCH_SIZE);

  if (toRender.length === 0 && state.visibleCount === 0) {
    els.noResults.classList.remove('hidden');
    return;
  } else {
    els.noResults.classList.add('hidden');
  }

  toRender.forEach(channel => {
    els.grid.appendChild(createChannelCard(channel));
  });

  state.visibleCount += toRender.length;
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      renderBatch();
    }
  }, { root: els.mainContainer, threshold: 0.1 });

  observer.observe(els.loadTrigger);
}

// --- Filtros ---
function setupFilters(countries, categories) {
  // Llenar select de paises (ordenado)
  const sortedCountries = countries.sort((a, b) => a.name.localeCompare(b.name));
  sortedCountries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.flag} ${c.name}`;
    els.countrySelect.appendChild(opt);
  });

  // Llenar select de categorias
  const sortedCats = categories.sort((a, b) => a.name.localeCompare(b.name));
  sortedCats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    els.categorySelect.appendChild(opt);
  });

  // Event Listeners
  els.searchInput.addEventListener('input', debounce(applyFilters, 300));
  els.countrySelect.addEventListener('change', applyFilters);
  els.categorySelect.addEventListener('change', applyFilters);
}

function applyFilters() {
  const search = els.searchInput.value.toLowerCase();
  const country = els.countrySelect.value;
  const category = els.categorySelect.value;

  // Reiniciar grid
  els.grid.innerHTML = '';
  state.visibleCount = 0;

  // Filtrar
  state.filteredData = state.processedData.filter(ch => {
    const matchSearch = ch.name.toLowerCase().includes(search) || (ch.alt_names.join(' ').toLowerCase().includes(search));
    const matchCountry = country === 'all' || ch.countryCode === country;
    const matchCategory = category === 'all' || ch.category === category;

    return matchSearch && matchCountry && matchCategory;
  });

  // Actualizar contador
  els.countLabel.textContent = `${state.filteredData.length} canales`;

  // Renderizar primer batch
  renderBatch();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- Reproductor de Video ---
let currentStreamUrl = '';

function openModal(channel) {
  currentStreamUrl = channel.streamUrl;
  els.modalTitle.textContent = channel.name;
  els.modalInfo.textContent = `${channel.countryName} • ${channel.category}`;
  els.playerError.classList.add('hidden');

  // Mostrar modal
  els.modal.classList.remove('hidden');
  // Timeout pequeño para la animación de opacidad
  setTimeout(() => els.modal.classList.remove('opacity-0'), 10);

  // Iniciar video
  if (Hls.isSupported()) {
    if (state.hls) {
      state.hls.destroy();
    }
    state.hls = new Hls();
    state.hls.loadSource(channel.streamUrl);
    state.hls.attachMedia(els.video);
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      els.video.play().catch(e => console.log("Auto-play prevenido por navegador"));
    });
    state.hls.on(Hls.Events.ERROR, (event, data) => {
      const errorDetails = `Tipo: ${data.type}\nDetalle: ${data.details}\nFatal: ${data.fatal}`;
      console.error("HLS ERROR EVENT:", data);

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            alert(`Error Fatal de Red:\n${errorDetails}\nIntentando recuperar...`);
            console.log("Intentando recuperar error de red...");
            state.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            alert(`Error Fatal de Media (Posible Codec/Decoding):\n${errorDetails}\nIntentando recuperar...`);
            console.log("Intentando recuperar error de media...");
            state.hls.recoverMediaError();
            break;
          default:
            // Fallback a reproducción Nativa si HLS.js falla
            state.hls.destroy();
            console.warn("HLS.js falló fatalmente. Intentando reproducción nativa (GStreamer/Safari)...");
            els.video.src = channel.streamUrl;
            els.video.play().catch(e => {
              const msg = `Fallo total (HLS.js y Nativo).\n${errorDetails}\nError Nativo: ${e.message}`;
              alert(msg);
              showPlayerError(msg);
            });
            break;
        }
      } else {
        // Errores no fatales pero informativos
        console.warn("HLS Warning:", errorDetails);
      }
    });
  } else if (els.video.canPlayType('application/vnd.apple.mpegurl') || els.video.canPlayType('application/x-mpegURL')) {
    // Para Safari nativo o WebKitGTK con GStreamer (tu solución)
    console.log("Detectado soporte nativo HLS. Usando <video> tag directamente.");
    els.video.src = channel.streamUrl;
    els.video.addEventListener('loadedmetadata', () => {
      els.video.play();
    });
    els.video.addEventListener('error', (e) => {
      const err = els.video.error;
      const msg = `Error Nativo Video: Code ${err ? err.code : 'Desconocido'}\nMensaje: ${err ? err.message : ''}`;
      console.error(msg);
      showPlayerError(msg);
    });
  } else {
    // Diagnóstico profundo v2
    const mimeMap = {
      'H264 (MP4)': 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      'VP9 (WebM)': 'video/webm; codecs="vp9,vorbis"',
      'VP8 (WebM)': 'video/webm; codecs="vp8,vorbis"'
    };

    let codecSupport = "";
    if (window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function') {
      for (const [label, mime] of Object.entries(mimeMap)) {
        codecSupport += `\n   - ${label}: ${window.MediaSource.isTypeSupported(mime)}`;
      }
    } else {
      codecSupport = "N/A (MSE no disponible)";
    }

    const checks = {
      windowHls: !!window.Hls,
      MediaSource: !!window.MediaSource,
      SourceBuffer: !!(window.SourceBuffer || window.WebKitSourceBuffer),
    };

    // Modificación Crítica: Si fallan los checks, intentar forzar la reproducción nativa con <source> tag explícito
    // Esto alinea con la solución que sugiere usar <source type="application/x-mpegURL"> para activar GStreamer
    console.warn("Checks de soporte fallaron. Intentando reproducción nativa forzada via <source> tag...");

    const tryForcedPlayback = () => {
      // Limpiar fuentes anteriores
      els.video.innerHTML = '';
      els.video.removeAttribute('src'); // Limpiar atributo src si existía

      // Crear elemento source explícito
      const source = document.createElement('source');
      source.src = channel.streamUrl;
      source.type = "application/x-mpegURL";

      els.video.appendChild(source);
      els.video.load(); // Importante: recargar el elemento video al cambiar sources hijos

      const playPromise = els.video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          // Ahora sí, si falla el forzado, mostramos el diagnóstico
          showDiagnosticError(codecSupport, checks);
        });
      }
    };

    // Escuchar error en este intento forzado
    const errorHandler = (e) => {
      els.video.removeEventListener('error', errorHandler);
      showDiagnosticError(codecSupport, checks);
    };
    els.video.addEventListener('error', errorHandler);

    tryForcedPlayback();
  }
}

function showDiagnosticError(codecSupport, checks) {
  const msg = `HLS no soportado (Ni Hls.js, Ni Nativo <source>).\n\nDiagnostico:\n1. Librerias:\n   - Hls.js Loaded: ${checks.windowHls}\n2. APIs Navegador:\n   - MSE: ${checks.MediaSource}\n   - SourceBuffer: ${checks.SourceBuffer}\n3. Protocolo: ${window.location.protocol}\n4. Codec Checks:${codecSupport}`;
  alert(msg);
  console.error(msg);
  showPlayerError(msg);
}

// Exposed to global scope for HTML onclick access if needed (though we attached events via JS)
window.closeModal = function () {
  els.modal.classList.add('opacity-0');
  setTimeout(() => {
    els.modal.classList.add('hidden');
    els.video.pause();
    els.video.src = '';
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
  }, 300);
}

window.copyLink = function () {
  navigator.clipboard.writeText(currentStreamUrl).then(() => {
    alert('URL del stream copiada al portapapeles');
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Cerrar modal al hacer clic fuera
  const modal = document.getElementById('video-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) window.closeModal();
    });
  }
});
