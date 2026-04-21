/* ============================================================
   app.js — SkyCast Weather App Logic
   ============================================================ */

// ============================================================
// CONFIGURATION
// Replace with your Anthropic API key to enable AI summaries
// Get one at: https://console.anthropic.com
// ============================================================
const ANTHROPIC_API_KEY = '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';

// ============================================================
// WMO Weather Code Mappings
// ============================================================
const WMO = {
  0:  { label: 'Clear sky',               icon: '☀️'  },
  1:  { label: 'Mainly clear',            icon: '🌤️' },
  2:  { label: 'Partly cloudy',           icon: '⛅'  },
  3:  { label: 'Overcast',                icon: '☁️'  },
  45: { label: 'Foggy',                   icon: '🌫️' },
  48: { label: 'Icy fog',                 icon: '🌫️' },
  51: { label: 'Light drizzle',           icon: '🌦️' },
  53: { label: 'Moderate drizzle',        icon: '🌦️' },
  55: { label: 'Heavy drizzle',           icon: '🌧️' },
  61: { label: 'Light rain',              icon: '🌧️' },
  63: { label: 'Moderate rain',           icon: '🌧️' },
  65: { label: 'Heavy rain',              icon: '⛈️'  },
  71: { label: 'Light snow',              icon: '🌨️' },
  73: { label: 'Moderate snow',           icon: '❄️'  },
  75: { label: 'Heavy snow',              icon: '❄️'  },
  77: { label: 'Snow grains',             icon: '🌨️' },
  80: { label: 'Light showers',           icon: '🌦️' },
  81: { label: 'Moderate showers',        icon: '🌧️' },
  82: { label: 'Violent showers',         icon: '⛈️'  },
  85: { label: 'Snow showers',            icon: '🌨️' },
  86: { label: 'Heavy snow showers',      icon: '❄️'  },
  95: { label: 'Thunderstorm',            icon: '⛈️'  },
  96: { label: 'Thunderstorm w/ hail',    icon: '🌩️' },
  99: { label: 'Thunderstorm w/ heavy hail', icon: '🌩️' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================
// Helper Functions
// ============================================================

/**
 * Returns label and icon for a WMO weather code.
 */
function wmo(code) {
  return WMO[code] || { label: 'Unknown', icon: '🌡️' };
}

/**
 * Returns a UV index label and color.
 */
function uvLabel(uv) {
  if (uv <= 2)  return { t: 'Low',       c: '#4caf50' };
  if (uv <= 5)  return { t: 'Moderate',  c: '#ffb347' };
  if (uv <= 7)  return { t: 'High',      c: '#ff7043' };
  if (uv <= 10) return { t: 'Very High', c: '#c84040' };
  return               { t: 'Extreme',   c: '#9c27b0' };
}

// ============================================================
// API Calls
// ============================================================

/**
 * Geocode a city name → { name, admin1, country, latitude, longitude }
 * Uses Open-Meteo geocoding — free, no API key required.
 */
async function geocode(city) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error('City not found');
  return data.results[0];
}

/**
 * Fetch current weather + 6-day daily forecast.
 * Uses Open-Meteo forecast API — free, no API key required.
 */
async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=6`;
  const res = await fetch(url);
  return await res.json();
}

/**
 * Get a poetic 2-sentence weather summary from Claude.
 * Requires a valid Anthropic API key in ANTHROPIC_API_KEY above.
 */
async function getAISummary(city, temp, condition, humidity, wind) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    return null;
  }

  const prompt =
    `You are a poetic weather narrator. In exactly 2 sentences, describe the current weather ` +
    `for ${city}: ${temp}°C, ${condition}, ${humidity}% humidity, wind ${wind} km/h. ` +
    `Make it atmospheric, evocative, and informative. No greetings.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  return data.content?.[0]?.text || null;
}

// ============================================================
// Render
// ============================================================

/**
 * Build and inject the weather card into #result.
 */
function render(place, w, aiText) {
  const c = w.current;
  const d = w.daily;
  const cond = wmo(c.weather_code);
  const uv   = uvLabel(c.uv_index || 0);

  // 5-day forecast cards (skip today → slice from index 1)
  const forecastHTML = d.time.slice(1, 6).map((t, i) => {
    const date = new Date(t);
    const fc   = wmo(d.weather_code[i + 1]);
    return `
      <div class="fc-day">
        <div class="fc-day-name">${i === 0 ? 'Tmrw' : DAYS[date.getDay()]}</div>
        <div class="fc-icon">${fc.icon}</div>
        <div class="fc-temp">${Math.round(d.temperature_2m_max[i + 1])}°</div>
        <div class="fc-low">${Math.round(d.temperature_2m_min[i + 1])}°</div>
      </div>`;
  }).join('');

  // Optional AI summary block
  const aiHTML = aiText
    ? `<div class="ai-summary"><span class="ai-tag">AI Insight</span>${aiText}</div>`
    : '';

  document.getElementById('result').innerHTML = `
    <div class="weather-card">
      <div class="city-name">${place.name}</div>
      <div class="city-sub">${[place.admin1, place.country].filter(Boolean).join(' · ')}</div>

      <div class="main-temp-row">
        <div>
          <div class="big-temp">
            ${Math.round(c.temperature_2m)}<span class="temp-unit">°C</span>
          </div>
        </div>
        <div class="condition-block">
          <div class="condition-emoji">${cond.icon}</div>
          <div class="condition-text">${cond.label}</div>
          <div class="feels-like">Feels like ${Math.round(c.apparent_temperature)}°C</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="stat-icon">💧</div>
          <div class="stat-val">${c.relative_humidity_2m}%</div>
          <div class="stat-label">Humidity</div>
        </div>
        <div class="stat">
          <div class="stat-icon">💨</div>
          <div class="stat-val">${Math.round(c.wind_speed_10m)}</div>
          <div class="stat-label">km/h Wind</div>
        </div>
        <div class="stat">
          <div class="stat-icon">🌡️</div>
          <div class="stat-val">
            ${Math.round(d.temperature_2m_max[0])}° / ${Math.round(d.temperature_2m_min[0])}°
          </div>
          <div class="stat-label">High / Low</div>
        </div>
        <div class="stat">
          <div class="stat-icon">🔆</div>
          <div class="stat-val" style="color:${uv.c}">${uv.t}</div>
          <div class="stat-label">UV Index</div>
        </div>
      </div>

      <div class="forecast-title">5-Day Forecast</div>
      <div class="forecast-row">${forecastHTML}</div>

      ${aiHTML}
    </div>`;
}

// ============================================================
// Search Handler
// ============================================================

async function search() {
  const city    = document.getElementById('cityInput').value.trim();
  const resultEl = document.getElementById('result');

  if (!city) return;

  // Show loading spinner
  resultEl.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Fetching weather data...
    </div>`;

  try {
    // 1. Geocode the city
    const place = await geocode(city);

    // 2. Fetch weather data
    const weather = await getWeather(place.latitude, place.longitude);

    // 3. Render card immediately (no AI summary yet)
    render(place, weather, '');

    // 4. Fetch AI summary in background, then update card
    const c    = weather.current;
    const cond = wmo(c.weather_code);

    try {
      const ai = await getAISummary(
        place.name,
        Math.round(c.temperature_2m),
        cond.label,
        c.relative_humidity_2m,
        Math.round(c.wind_speed_10m)
      );
      if (ai) render(place, weather, ai);
    } catch (_) {
      // AI summary is optional — fail silently
    }

  } catch (e) {
    resultEl.innerHTML = `
      <div class="error-box">
        Could not find weather for "<strong>${city}</strong>".
        Please try a different city name.
      </div>`;
  }
}

// ============================================================
// Stars Background
// ============================================================
(function generateStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.cssText =
      `left:${Math.random() * 100}%;` +
      `top:${Math.random() * 100}%;` +
      `animation-delay:${Math.random() * 3}s;` +
      `opacity:${(Math.random() * 0.6 + 0.1).toFixed(2)}`;
    container.appendChild(star);
  }
})();

// ============================================================
// Event Listeners
// ============================================================
document.getElementById('searchBtn').addEventListener('click', search);
document.getElementById('cityInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') search();
});