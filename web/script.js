"use strict";

const DATA_PATH = "../data/processed/";
const DATA_VERSION = "spotify-executive-5";
const PAGE_SIZE = 10;

const FEATURE_LABELS = {
  danceability: "Danceability",
  energy: "Energy",
  valence: "Valence",
  acousticness: "Acousticness"
};

const FEATURE_COLORS = {
  danceability: "#1db954",
  energy: "#56d364",
  valence: "#7ee787",
  acousticness: "#a7f3b4"
};

const MUSICAL_KEYS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const ENERGY_BINS = 5;

const chartDefaults = {
  color: "#a7a7a7",
  borderColor: "rgba(255, 255, 255, 0.08)",
  font: { family: "Inter, ui-sans-serif, system-ui, sans-serif" }
};

const charts = {};
let tracks = [];
let filteredTracks = [];
let visibleTracks = [];
let currentPage = 1;
let decadeData = [];
let correlationData = [];
let decadeModeData = [];
let topArtistData = [];
let decadeOptions = [];
let fullDatasetTrackCount = null;

if (window.Chart) {
  Chart.defaults.color = chartDefaults.color;
  Chart.defaults.borderColor = chartDefaults.borderColor;
  Chart.defaults.font.family = chartDefaults.font.family;
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function setStatus(message, state) {
  const status = document.getElementById("data-status");
  const dot = status.querySelector(".status-dot");
  dot.className = `status-dot status-dot--${state}`;
  status.replaceChildren(dot, document.createTextNode(message));
}

function showError(elementId, message) {
  const error = document.getElementById(elementId);
  error.textContent = message;
  error.hidden = false;
}

function showChartError(chartName, message) {
  const loading = document.getElementById(`${chartName}-loading`);
  loading.textContent = "Chart unavailable";
  showError(`${chartName}-error`, message);
}

async function fetchJson(fileName) {
  let response;
  try {
    response = await fetch(`${DATA_PATH}${fileName}?v=${DATA_VERSION}`);
  } catch (error) {
    throw new Error(`Could not access ${fileName}. Make sure a local server is running and the file is available.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${fileName} (HTTP ${response.status}).`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${fileName} does not contain valid JSON.`);
  }
}

function isValidRows(rows) {
  return Array.isArray(rows) && rows.length > 0;
}

function renderDecadeChart(rows) {
  if (!isValidRows(rows)) {
    throw new Error("Decade trend data is empty or has an invalid format.");
  }
  if (!window.Chart) {
    throw new Error("Chart.js is unavailable. Check your internet connection and reload the page.");
  }

  const validRows = rows
    .filter((row) => Number.isFinite(Number(row.decade)))
    .sort((left, right) => Number(left.decade) - Number(right.decade));
  if (validRows.length === 0) {
    throw new Error("Trend data does not contain any valid decade values.");
  }

  const features = Object.keys(FEATURE_LABELS).filter((feature) =>
    validRows.some((row) => Number.isFinite(Number(row[feature])))
  );
  const datasets = features.map((feature) => ({
    label: FEATURE_LABELS[feature],
    data: validRows.map((row) => {
      const value = Number(row[feature]);
      return Number.isFinite(value) ? value : null;
    }),
    borderColor: FEATURE_COLORS[feature],
    backgroundColor: FEATURE_COLORS[feature],
    pointRadius: 2,
    pointHoverRadius: 5,
    borderWidth: 2,
    tension: 0.35,
    spanGaps: true
  }));

  if (datasets.length === 0) {
    throw new Error("No valid audio features are available to display.");
  }

  charts.decade = new Chart(document.getElementById("decade-chart"), {
    type: "line",
    data: {
      labels: validRows.map((row) => `${Number(row.decade)}s`),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 16 }
        },
        tooltip: {
          backgroundColor: "#282828",
          titleColor: "#fff",
          bodyColor: "#d1d1d1",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          padding: 11,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(3)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { min: 0, max: 1, ticks: { stepSize: 0.2 }, grid: { color: "rgba(255,255,255,.06)" } }
      }
    }
  });

  document.getElementById("decade-loading").hidden = true;
  return validRows;
}

function renderDecadePopularityChart(rows) {
  if (!isValidRows(rows)) {
    throw new Error("Decade popularity data is empty or has an invalid format.");
  }
  if (!window.Chart) {
    throw new Error("Chart.js is unavailable. Check your internet connection and reload the page.");
  }

  const topDecades = rows
    .map((row) => ({
      decade: Number(row.decade),
      popularity: Number(row.popularity)
    }))
    .filter((row) => Number.isFinite(row.decade) && Number.isFinite(row.popularity))
    .sort((left, right) => right.popularity - left.popularity)
    .slice(0, 5);

  if (topDecades.length === 0) {
    throw new Error("No valid decade popularity values were found.");
  }

  topDecades.reverse();
  charts.popularity = new Chart(document.getElementById("decade-popularity-chart"), {
    type: "bar",
    data: {
      labels: topDecades.map((row) => `${row.decade}s`),
      datasets: [{
        label: "Average popularity",
        data: topDecades.map((row) => row.popularity),
        backgroundColor: topDecades.map((_, index) =>
          index === topDecades.length - 1 ? "rgba(29, 185, 84, 0.9)" : "rgba(29, 185, 84, 0.42)"
        ),
        borderColor: "#1db954",
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 18
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#282828",
          titleColor: "#fff",
          bodyColor: "#d1d1d1",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => `Average popularity: ${Number(context.parsed.x).toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,.06)" },
          ticks: { maxTicksLimit: 5 }
        },
        y: { grid: { display: false } }
      }
    }
  });

  document.getElementById("decade-popularity-loading").hidden = true;
}

function renderCorrelationChart(rows) {
  if (!isValidRows(rows)) {
    throw new Error("Correlation data is empty or has an invalid format.");
  }
  if (!window.Chart) {
    throw new Error("Chart.js is unavailable. Check your internet connection and reload the page.");
  }

  const popularityRow = rows.find((row) => row.feature === "popularity");
  if (!popularityRow) {
    throw new Error("The popularity correlation row was not found.");
  }

  const features = Object.keys(FEATURE_LABELS);
  const correlations = features
    .map((feature) => ({ feature, value: Number(popularityRow[feature]) }))
    .filter((item) => Number.isFinite(item.value));
  if (correlations.length === 0) {
    throw new Error("No audio feature correlation values for popularity were found.");
  }

  charts.correlation = new Chart(document.getElementById("correlation-chart"), {
    type: "bar",
    data: {
      labels: correlations.map(({ feature }) => FEATURE_LABELS[feature]),
      datasets: [{
        label: "Correlation with popularity",
        data: correlations.map(({ value }) => value),
        backgroundColor: correlations.map(({ value }) =>
          value >= 0 ? "rgba(29, 185, 84, 0.78)" : "rgba(248, 113, 113, 0.72)"
        ),
        borderColor: correlations.map(({ value }) => value >= 0 ? "#1db954" : "#f87171"),
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 42
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#282828",
          titleColor: "#fff",
          bodyColor: "#d1d1d1",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          padding: 11,
          callbacks: {
            label: (context) => `Correlation: ${Number(context.parsed.x).toFixed(3)}`
          }
        }
      },
      scales: {
        x: { min: -1, max: 1, ticks: { stepSize: 0.5 }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { grid: { display: false } }
      }
    }
  });

  document.getElementById("correlation-loading").hidden = true;
  return correlations;
}

function updateChartState(elementId, message) {
  const state = document.getElementById(elementId);
  state.textContent = message;
  state.hidden = !message;
}

function updateDecadeChart(rows) {
  if (!charts.decade) {
    return;
  }
  const features = Object.keys(FEATURE_LABELS);
  const validRows = rows.filter((row) => Number.isFinite(Number(row.decade)));
  charts.decade.data.labels = validRows.map((row) => `${Number(row.decade)}s`);
  charts.decade.data.datasets = features.map((feature) => ({
    label: FEATURE_LABELS[feature],
    data: validRows.map((row) => {
      const value = Number(row[feature]);
      return Number.isFinite(value) ? value : null;
    }),
    borderColor: FEATURE_COLORS[feature],
    backgroundColor: FEATURE_COLORS[feature],
    pointRadius: 2,
    pointHoverRadius: 5,
    borderWidth: 2,
    tension: 0.35,
    spanGaps: true
  }));
  charts.decade.update();
  updateChartState("decade-loading", validRows.length ? "" : "No data available for these filters.");
}

function updatePopularityChart(rows) {
  if (!charts.popularity) {
    return;
  }
  const topDecades = rows
    .map((row) => ({ decade: Number(row.decade), popularity: Number(row.popularity) }))
    .filter((row) => Number.isFinite(row.decade) && Number.isFinite(row.popularity))
    .sort((left, right) => right.popularity - left.popularity)
    .slice(0, 5)
    .reverse();

  charts.popularity.data.labels = topDecades.map((row) => `${row.decade}s`);
  charts.popularity.data.datasets[0].data = topDecades.map((row) => row.popularity);
  charts.popularity.data.datasets[0].backgroundColor = topDecades.map((_, index) =>
    index === topDecades.length - 1 ? "rgba(29, 185, 84, 0.9)" : "rgba(29, 185, 84, 0.42)"
  );
  charts.popularity.update();
  updateChartState("decade-popularity-loading", topDecades.length ? "" : "No data available for these filters.");
}

function updateCorrelationChart(correlations, sampleCount) {
  if (!charts.correlation) {
    return;
  }
  const validCorrelations = correlations.filter((item) => Number.isFinite(item.value));
  charts.correlation.data.labels = validCorrelations.map((item) => FEATURE_LABELS[item.feature]);
  charts.correlation.data.datasets[0].data = validCorrelations.map((item) => item.value);
  charts.correlation.data.datasets[0].backgroundColor = validCorrelations.map((item) =>
    item.value >= 0 ? "rgba(29, 185, 84, 0.78)" : "rgba(248, 113, 113, 0.72)"
  );
  charts.correlation.data.datasets[0].borderColor = validCorrelations.map((item) =>
    item.value >= 0 ? "#1db954" : "#f87171"
  );
  charts.correlation.update();

  const caption = document.getElementById("correlation-caption");
  caption.textContent = sampleCount === null
    ? "Pearson correlation · full dataset"
    : `Top Tracks sample correlation · n = ${sampleCount}`;
  updateChartState(
    "correlation-loading",
    validCorrelations.length ? "" : "At least 3 filtered tracks are required to calculate correlations."
  );
}

function updateEnergyDistributionChart(rows) {
  if (!window.Chart) {
    return;
  }
  const binWidth = 1 / ENERGY_BINS;
  const counts = Array(ENERGY_BINS).fill(0);
  rows.forEach((row) => {
    const energy = Number(row.energy);
    if (!Number.isFinite(energy) || energy < 0 || energy > 1) {
      return;
    }
    const bin = Math.min(Math.floor(energy / binWidth), ENERGY_BINS - 1);
    counts[bin] += 1;
  });
  const labels = counts.map((_, index) => {
    const start = index * binWidth;
    const end = (index + 1) * binWidth;
    return `${start.toFixed(1)}–${end.toFixed(1)}`;
  });

  if (!charts.energy) {
    charts.energy = new Chart(document.getElementById("energy-distribution-chart"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Track count",
          data: counts,
          backgroundColor: "rgba(29, 185, 84, 0.68)",
          borderColor: "#1db954",
          borderWidth: 1,
          borderRadius: 5,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#282828",
            titleColor: "#fff",
            bodyColor: "#d1d1d1",
            borderColor: "rgba(255,255,255,.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: { label: (context) => `Track count: ${context.parsed.y}` }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(255,255,255,.06)" } }
        }
      }
    });
  } else {
    charts.energy.data.labels = labels;
    charts.energy.data.datasets[0].data = counts;
    charts.energy.update();
  }

  document.getElementById("energy-distribution-caption").textContent =
    `Filtered Top Tracks sample · ${formatNumber(rows.length)} tracks`;
  document.getElementById("energy-distribution-loading").hidden = true;
  updateChartState("energy-distribution-loading", rows.length ? "" : "No tracks match these filters.");
}

function getModeCounts(rows, isAggregate = false) {
  const counts = { major: 0, minor: 0 };
  rows.forEach((row) => {
    const mode = Number(row.mode);
    const amount = isAggregate ? Number(row.tracks) : 1;
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    if (mode === 1) counts.major += amount;
    if (mode === 0) counts.minor += amount;
  });
  return counts;
}

function updateModeChart(rows, isSample) {
  const counts = getModeCounts(rows, !isSample);
  const total = counts.major + counts.minor;
  if (!charts.mode && window.Chart) {
    charts.mode = new Chart(document.getElementById("mode-chart"), {
      type: "doughnut",
      data: {
        labels: ["Major", "Minor"],
        datasets: [{
          data: [counts.major, counts.minor],
          backgroundColor: ["rgba(29, 185, 84, 0.88)", "rgba(113, 113, 122, 0.8)"],
          borderColor: ["#1db954", "#52525b"],
          borderWidth: 1,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 14 }
          },
          tooltip: {
            backgroundColor: "#282828",
            titleColor: "#fff",
            bodyColor: "#d1d1d1",
            borderColor: "rgba(255,255,255,.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const value = Number(context.parsed);
                const percentage = total ? (value / total) * 100 : 0;
                return `${context.label}: ${formatNumber(value)} tracks (${formatNumber(percentage, 1)}%)`;
              }
            }
          }
        }
      }
    });
  } else if (charts.mode) {
    charts.mode.data.datasets[0].data = [counts.major, counts.minor];
    charts.mode.update();
  }

  document.getElementById("mode-chart-caption").textContent = isSample
    ? `Major vs Minor · filtered sample (${formatNumber(total)} tracks)`
    : `Major vs Minor · full dataset (${formatNumber(total)} tracks)`;
  updateChartState("mode-chart-loading", total ? "" : "Mode data is unavailable for these filters.");
}

function updateScatterChart(rows) {
  const points = rows.flatMap((track) => {
    const x = Number(track.danceability);
    const y = Number(track.energy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return [];
    }
    return [{
      x,
      y,
      trackName: String(track.name || "Untitled"),
      artistNames: getArtists(track.artists),
      year: Number(track.year)
    }];
  });

  if (!charts.scatter && window.Chart) {
    charts.scatter = new Chart(document.getElementById("audio-scatter-chart"), {
      type: "scatter",
      data: {
        datasets: [{
          label: "Tracks",
          data: points,
          backgroundColor: "rgba(29, 185, 84, 0.68)",
          borderColor: "#1db954",
          pointRadius: 4,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#282828",
            titleColor: "#fff",
            bodyColor: "#d1d1d1",
            borderColor: "rgba(255,255,255,.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.raw.trackName || "Track",
              label: (context) => {
                const point = context.raw;
                return [
                  point.artistNames,
                  `Danceability: ${Number(point.x).toFixed(3)}`,
                  `Energy: ${Number(point.y).toFixed(3)}`
                ];
              },
              afterLabel: (context) => Number.isFinite(context.raw.year)
                ? `Year: ${context.raw.year}`
                : ""
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 1,
            title: { display: true, text: "Danceability", color: "#a7a7a7" },
            grid: { color: "rgba(255,255,255,.06)" }
          },
          y: {
            min: 0,
            max: 1,
            title: { display: true, text: "Energy", color: "#a7a7a7" },
            grid: { color: "rgba(255,255,255,.06)" }
          }
        }
      }
    });
  } else if (charts.scatter) {
    charts.scatter.data.datasets[0].data = points;
    charts.scatter.update();
  }

  document.getElementById("scatter-caption").textContent =
    `Each point represents one track · ${formatNumber(points.length)} filtered tracks`;
  updateChartState("audio-scatter-loading", points.length ? "" : "No tracks match these filters.");
}

function renderTopArtistsChart(rows) {
  if (!isValidRows(rows)) {
    throw new Error("Top Artists data is empty or has an invalid format.");
  }
  if (!window.Chart) {
    throw new Error("Chart.js is unavailable. Check your internet connection and reload the page.");
  }

  const artists = rows
    .map((row) => ({
      name: String(row.artist || ""),
      count: Number(row.track_count)
    }))
    .filter((row) => row.name && Number.isFinite(row.count))
    .sort((left, right) => left.count - right.count);
  if (artists.length === 0) {
    throw new Error("No valid artist names or track counts were found.");
  }

  charts.artists = new Chart(document.getElementById("top-artists-chart"), {
    type: "bar",
    data: {
      labels: artists.map((row) => row.name),
      datasets: [{
        label: "Track count",
        data: artists.map((row) => row.count),
        backgroundColor: artists.map((_, index) =>
          index === artists.length - 1 ? "rgba(29, 185, 84, 0.9)" : "rgba(29, 185, 84, 0.45)"
        ),
        borderColor: "#1db954",
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 13
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#282828",
          titleColor: "#fff",
          bodyColor: "#d1d1d1",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (context) => `Track count: ${formatNumber(context.parsed.x)}` }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { grid: { display: false } }
      }
    }
  });
  document.getElementById("artist-chart-caption").textContent =
    "Artist track appearances · full dataset";
  document.getElementById("top-artists-loading").hidden = true;
}

function calculateCorrelations(rows) {
  return Object.keys(FEATURE_LABELS).flatMap((feature) => {
    const pairs = rows
      .map((row) => ({ x: Number(row[feature]), y: Number(row.popularity) }))
      .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));
    if (pairs.length < 3) {
      return [];
    }

    const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
    const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
    const numerator = pairs.reduce((sum, pair) =>
      sum + (pair.x - meanX) * (pair.y - meanY), 0);
    const varianceX = pairs.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0);
    const varianceY = pairs.reduce((sum, pair) => sum + (pair.y - meanY) ** 2, 0);
    const denominator = Math.sqrt(varianceX * varianceY);
    if (denominator === 0) {
      return [];
    }
    return [{ feature, value: numerator / denominator }];
  });
}

function getArtists(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value !== "string") {
    return "Unknown artist";
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.join(", ");
    }
  } catch (error) {
    // Dataframe JSON may contain Python-style list strings instead of JSON arrays.
  }

  const quotedNames = [...value.matchAll(/'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"/g)]
    .map((match) => (match[1] ?? match[2]).replace(/\\(['"\\])/g, "$1"));
  if (quotedNames.length > 0) {
    return quotedNames.join(", ");
  }
  return value.replace(/^\[|\]$/g, "").trim() || "Unknown artist";
}

function validNumbers(rows, key) {
  return rows
    .map((row) => Number(row[key]))
    .filter((value) => Number.isFinite(value));
}

function renderKpis(selectedTracks, startDecade, endDecade) {
  const popularity = validNumbers(selectedTracks, "popularity");
  const danceability = validNumbers(selectedTracks, "danceability");
  document.getElementById("kpi-total-tracks").textContent = fullDatasetTrackCount === null
    ? "—"
    : formatNumber(fullDatasetTrackCount);
  document.getElementById("kpi-year-range").textContent =
    `${startDecade}s–${endDecade}s`;
  document.getElementById("kpi-popularity").textContent = popularity.length
    ? formatNumber(popularity.reduce((sum, value) => sum + value, 0) / popularity.length, 1)
    : "—";
  document.getElementById("kpi-danceability").textContent = danceability.length
    ? formatNumber(danceability.reduce((sum, value) => sum + value, 0) / danceability.length, 3)
    : "—";
  document.querySelector("#kpi-year-range").nextElementSibling.textContent =
    "active decade filters · records cover 1922–2020";
}

function renderInsights(decadeRows, correlations, selectedTracks, correlationSampleSize) {
  const sortedDecades = decadeRows
    .filter((row) => Number.isFinite(Number(row.decade)) && Number.isFinite(Number(row.energy)))
    .sort((left, right) => Number(left.decade) - Number(right.decade));

  let largestEnergyIncrease = null;
  for (let index = 1; index < sortedDecades.length; index += 1) {
    const previous = sortedDecades[index - 1];
    const current = sortedDecades[index];
    if (Number(current.decade) - Number(previous.decade) !== 10) {
      continue;
    }
    const change = Number(current.energy) - Number(previous.energy);
    if (!largestEnergyIncrease || change > largestEnergyIncrease.change) {
      largestEnergyIncrease = {
        from: Number(previous.decade),
        to: Number(current.decade),
        change
      };
    }
  }

  if (sortedDecades.length < 2) {
    document.getElementById("insight-energy").textContent = "Not enough data";
    document.getElementById("insight-energy-detail").textContent =
      "Select a range spanning at least two decades to compare energy.";
  } else if (largestEnergyIncrease && largestEnergyIncrease.change > 0) {
    document.getElementById("insight-energy").textContent =
      `${largestEnergyIncrease.from}s → ${largestEnergyIncrease.to}s`;
    document.getElementById("insight-energy-detail").textContent =
      `Average energy increased by ${formatNumber(largestEnergyIncrease.change, 3)} points during this transition.`;
  } else {
    document.getElementById("insight-energy").textContent = "No increase found";
    document.getElementById("insight-energy-detail").textContent =
      "No decade-over-decade increase in energy was found in the available data.";
  }

  const strongest = correlations
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0];

  if (strongest) {
    const direction = strongest.value >= 0 ? "positive" : "negative";
    document.getElementById("insight-correlation").textContent = FEATURE_LABELS[strongest.feature];
    document.getElementById("insight-correlation-detail").textContent =
      `Strongest ${direction} correlation (r = ${formatNumber(strongest.value, 3)})${
        correlationSampleSize === null ? " in the full dataset." : ` in the filtered sample (n = ${correlationSampleSize}).`
      }`;
  } else {
    document.getElementById("insight-correlation").textContent = "Unavailable";
    document.getElementById("insight-correlation-detail").textContent =
      "No correlation values for popularity were found.";
  }

  document.getElementById("insight-total").textContent =
    `${formatNumber(selectedTracks.length)} tracks`;
  document.getElementById("insight-total-detail").textContent =
    `Of ${formatNumber(tracks.length)} Top Tracks records; ${formatNumber(decadeRows.length)} decades displayed.`;
}

function setCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) {
    cell.className = className;
  }
  cell.textContent = value;
  row.appendChild(cell);
  return cell;
}

function renderTracks() {
  const body = document.getElementById("tracks-body");
  const total = visibleTracks.length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  currentPage = Math.min(Math.max(currentPage, 1), pageCount || 1);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visibleTracks.slice(start, start + PAGE_SIZE);

  body.replaceChildren();
  if (pageRows.length === 0) {
    const row = document.createElement("tr");
    const cell = setCell(row, "No tracks match these filters.", "table-state");
    cell.colSpan = 9;
    body.appendChild(row);
  } else {
    pageRows.forEach((track, index) => {
      const row = document.createElement("tr");
      setCell(row, String(start + index + 1).padStart(2, "0"), "rank-column");

      const nameCell = setCell(row, "");
      const name = document.createElement("span");
      name.className = "track-name";
      name.textContent = String(track.name || "Untitled");
      nameCell.replaceChildren(name);

      const artistNames = getArtists(track.artists);
      const artistCell = setCell(row, artistNames);
      const artist = document.createElement("span");
      artist.className = "track-artist";
      artist.textContent = artistNames;
      artistCell.replaceChildren(artist);

      const year = Number(track.year);
      setCell(row, Number.isFinite(year) ? String(year) : "—", "track-year");

      const key = Number(track.key);
      setCell(row, Number.isInteger(key) && MUSICAL_KEYS[key] ? MUSICAL_KEYS[key] : "—", "track-feature");

      const genres = Array.isArray(track.genres) ? track.genres.join(", ") : "";
      const genreCell = setCell(row, genres || "—", "track-genre");
      genreCell.title = genres;

      const score = Number(track.popularity);
      setCell(row, Number.isFinite(score) ? formatNumber(score) : "—", "numeric-cell track-popularity");

      const danceability = Number(track.danceability);
      setCell(row, Number.isFinite(danceability) ? formatNumber(danceability, 3) : "—", "numeric-cell track-feature");

      const energy = Number(track.energy);
      setCell(row, Number.isFinite(energy) ? formatNumber(energy, 3) : "—", "numeric-cell track-feature");
      body.appendChild(row);
    });
  }

  document.getElementById("table-summary").textContent = total
    ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} tracks`
    : "No tracks found";
  document.getElementById("page-indicator").textContent = `${currentPage} / ${pageCount || 1}`;
  document.getElementById("previous-page").disabled = currentPage <= 1;
  document.getElementById("next-page").disabled = currentPage >= pageCount;
}

function getGenres(track) {
  if (Array.isArray(track.genres)) {
    return track.genres.filter((genre) => typeof genre === "string" && genre.trim());
  }
  if (typeof track.genres === "string") {
    try {
      const parsed = JSON.parse(track.genres);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function populateSelect(select, options, defaultValue, labelForOption = (value) => value) {
  select.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  select.appendChild(allOption);

  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = labelForOption(value);
    select.appendChild(option);
  });
  select.value = String(defaultValue ?? "");
  select.disabled = false;
}

function aggregateTracksByDecade(rows) {
  const groups = new Map();
  rows.forEach((track) => {
    const year = Number(track.year);
    if (!Number.isFinite(year)) {
      return;
    }
    const decade = Math.floor(year / 10) * 10;
    if (!groups.has(decade)) {
      groups.set(decade, { decade, count: 0 });
    }
    const group = groups.get(decade);
    group.count += 1;
    ["danceability", "energy", "valence", "acousticness", "popularity"].forEach((feature) => {
      const value = Number(track[feature]);
      if (Number.isFinite(value)) {
        group[feature] = (group[feature] || 0) + value;
      }
    });
  });
  return [...groups.values()]
    .map((group) => {
      const row = { decade: group.decade };
      ["danceability", "energy", "valence", "acousticness", "popularity"].forEach((feature) => {
        row[feature] = group[feature] === undefined ? null : group[feature] / group.count;
      });
      return row;
    })
    .sort((left, right) => left.decade - right.decade);
}

function refreshFilteredDashboard() {
  const startDecade = Number(document.getElementById("filter-decade-start").value);
  const endDecade = Number(document.getElementById("filter-decade-end").value);
  const selectedGenre = document.getElementById("filter-genre").value;
  const selectedKey = document.getElementById("filter-key").value;

  filteredTracks = tracks.filter((track) => {
    const year = Number(track.year);
    const decade = Number.isFinite(year) ? Math.floor(year / 10) * 10 : NaN;
    const matchesDate = Number.isFinite(decade) && decade >= startDecade && decade <= endDecade;
    const matchesGenre = !selectedGenre || getGenres(track).includes(selectedGenre);
    const matchesKey = !selectedKey || Number(track.key) === Number(selectedKey);
    return matchesDate && matchesGenre && matchesKey;
  });

  const query = document.getElementById("track-search").value.trim().toLocaleLowerCase("en-US");
  visibleTracks = filteredTracks.filter((track) =>
    `${track.name || ""} ${getArtists(track.artists)}`.toLocaleLowerCase("en-US").includes(query)
  );
  currentPage = 1;
  renderTracks();
  renderKpis(filteredTracks, startDecade, endDecade);

  const categoricalFilterActive = Boolean(selectedGenre || selectedKey);
  document.getElementById("decade-caption").textContent = categoricalFilterActive
    ? `Average features by decade · Top Tracks sample (${formatNumber(filteredTracks.length)} tracks)`
    : "Average danceability, energy, valence, and acousticness · full dataset";
  document.getElementById("decade-popularity-caption").textContent = categoricalFilterActive
    ? "Average popularity by decade in the filtered Top Tracks sample"
    : "Average track popularity · full dataset";
  const visibleDecades = categoricalFilterActive
    ? aggregateTracksByDecade(filteredTracks)
    : decadeData.filter((row) => Number(row.decade) >= startDecade && Number(row.decade) <= endDecade);
  updateDecadeChart(visibleDecades);
  updatePopularityChart(visibleDecades);
  updateEnergyDistributionChart(filteredTracks);
  updateScatterChart(filteredTracks);

  const visibleModeRows = categoricalFilterActive
    ? filteredTracks
    : decadeModeData.filter((row) => Number(row.decade) >= startDecade && Number(row.decade) <= endDecade);
  updateModeChart(visibleModeRows, categoricalFilterActive);

  const allDecadesSelected = startDecade === decadeOptions[0] &&
    endDecade === decadeOptions[decadeOptions.length - 1];
  const useFullDatasetCorrelation = !selectedGenre && !selectedKey && allDecadesSelected;
  const currentCorrelations = useFullDatasetCorrelation
    ? getPopularityCorrelations(correlationData)
    : calculateCorrelations(filteredTracks);
  updateCorrelationChart(
    currentCorrelations,
    useFullDatasetCorrelation ? null : filteredTracks.length
  );
  renderInsights(visibleDecades, currentCorrelations, filteredTracks, useFullDatasetCorrelation ? null : filteredTracks.length);

  const filters = [];
  if (selectedGenre) filters.push(selectedGenre);
  if (selectedKey) filters.push(`Key ${MUSICAL_KEYS[Number(selectedKey)]}`);
  const filterDescription = filters.length ? ` · ${filters.join(" · ")}` : "";
  document.getElementById("filter-summary").textContent =
    `${formatNumber(filteredTracks.length)} of ${formatNumber(tracks.length)} tracks${filterDescription}`;
}

function getPopularityCorrelations(rows) {
  const popularityRow = rows.find((row) => row.feature === "popularity");
  if (!popularityRow) {
    return [];
  }
  return Object.keys(FEATURE_LABELS)
    .map((feature) => ({ feature, value: Number(popularityRow[feature]) }))
    .filter((item) => Number.isFinite(item.value));
}

function setupFilters() {
  const startSelect = document.getElementById("filter-decade-start");
  const endSelect = document.getElementById("filter-decade-end");
  const genreSelect = document.getElementById("filter-genre");
  const keySelect = document.getElementById("filter-key");
  const resetButton = document.getElementById("reset-filters");
  const decades = [...new Set([
    ...decadeData.map((row) => Number(row.decade)),
    ...tracks.map((track) => Math.floor(Number(track.year) / 10) * 10)
  ])]
    .filter((decade) => Number.isFinite(decade) && decade >= 1920)
    .sort((left, right) => left - right);

  if (decades.length === 0) {
    throw new Error("No valid decade range is available for filtering.");
  }
  decadeOptions = decades;

  populateSelect(startSelect, decades, decades[0], (decade) => `${decade}s`);
  populateSelect(endSelect, decades, decades[decades.length - 1], (decade) => `${decade}s`);

  const genres = [...new Set(tracks.flatMap(getGenres))]
    .sort((left, right) => left.localeCompare(right, "en"));
  populateSelect(genreSelect, genres, "");

  const keys = [...new Set(tracks.map((track) => Number(track.key)))]
    .filter((key) => Number.isInteger(key) && MUSICAL_KEYS[key])
    .sort((left, right) => left - right);
  populateSelect(keySelect, keys, "", (key) => MUSICAL_KEYS[key]);

  [startSelect, endSelect, genreSelect, keySelect].forEach((select) => {
    select.addEventListener("change", () => {
      if (Number(startSelect.value) > Number(endSelect.value)) {
        if (select === startSelect) {
          endSelect.value = startSelect.value;
        } else {
          startSelect.value = endSelect.value;
        }
      }
      refreshFilteredDashboard();
    });
  });

  document.getElementById("track-search").disabled = false;
  document.getElementById("track-search").addEventListener("input", refreshFilteredDashboard);
  document.getElementById("previous-page").addEventListener("click", () => {
    currentPage -= 1;
    renderTracks();
  });
  document.getElementById("next-page").addEventListener("click", () => {
    currentPage += 1;
    renderTracks();
  });
  resetButton.disabled = false;
  resetButton.addEventListener("click", () => {
    startSelect.value = String(decades[0]);
    endSelect.value = String(decades[decades.length - 1]);
    genreSelect.value = "";
    keySelect.value = "";
    document.getElementById("track-search").value = "";
    refreshFilteredDashboard();
  });

  refreshFilteredDashboard();
}

function setupDatasetNotes() {
  const dialog = document.getElementById("dataset-notes");
  document.getElementById("open-dataset-notes").addEventListener("click", () => {
    dialog.showModal();
  });
  document.getElementById("close-dataset-notes").addEventListener("click", () => {
    dialog.close();
  });
}

async function loadDashboard() {
  const requests = await Promise.allSettled([
    fetchJson("decade_trends.json"),
    fetchJson("correlation_data.json"),
    fetchJson("top_tracks.json"),
    fetchJson("decade_modes.json"),
    fetchJson("top_artists.json")
  ]);
  const [decadesResult, correlationResult, tracksResult, modesResult, artistsResult] = requests;
  let loadedCount = 0;

  if (decadesResult.status === "fulfilled") {
    try {
      fullDatasetTrackCount = decadesResult.value.reduce((total, row) => {
        const count = Number(row.tracks);
        return total + (Number.isFinite(count) && count > 0 ? count : 0);
      }, 0);
      if (fullDatasetTrackCount === 0) {
        throw new Error("Decade trend data does not contain valid track counts.");
      }
      decadeData = renderDecadeChart(decadesResult.value);
      renderDecadePopularityChart(decadeData);
      loadedCount += 1;
    } catch (error) {
      if (!document.getElementById("decade-loading").hidden) {
        showChartError("decade", error.message);
      }
      if (!document.getElementById("decade-popularity-loading").hidden) {
        showChartError("decade-popularity", error.message);
      }
    }
  } else {
    showChartError("decade", decadesResult.reason.message);
    showChartError("decade-popularity", decadesResult.reason.message);
  }

  if (correlationResult.status === "fulfilled") {
    try {
      correlationData = correlationResult.value;
      renderCorrelationChart(correlationData);
      loadedCount += 1;
    } catch (error) {
      showChartError("correlation", error.message);
      correlationData = [];
    }
  } else {
    showChartError("correlation", correlationResult.reason.message);
  }

  if (modesResult.status === "fulfilled" && isValidRows(modesResult.value)) {
    decadeModeData = modesResult.value;
    loadedCount += 1;
  } else {
    const message = modesResult.status === "rejected"
      ? modesResult.reason.message
      : "Decade mode data is empty or has an invalid format.";
    showChartError("mode-chart", message);
  }

  if (artistsResult.status === "fulfilled") {
    try {
      topArtistData = artistsResult.value;
      renderTopArtistsChart(topArtistData);
      loadedCount += 1;
    } catch (error) {
      showChartError("top-artists", error.message);
    }
  } else {
    showChartError("top-artists", artistsResult.reason.message);
  }

  if (tracksResult.status === "fulfilled") {
    try {
      if (!isValidRows(tracksResult.value)) {
        throw new Error("Top Tracks data is empty or has an invalid format.");
      }
      tracks = tracksResult.value;
      loadedCount += 1;
    } catch (error) {
      showError("tracks-error", error.message);
      document.getElementById("tracks-body").replaceChildren();
      document.getElementById("table-summary").textContent = "Track data is unavailable.";
    }
  } else {
    showError("tracks-error", tracksResult.reason.message);
    document.getElementById("tracks-body").replaceChildren();
    document.getElementById("table-summary").textContent = "Track data could not be loaded.";
  }

  if (tracks.length > 0) {
    setupFilters();
  }

  if (tracks.length === 0) {
    ["kpi-total-tracks", "kpi-year-range", "kpi-popularity", "kpi-danceability"].forEach((id) => {
      document.getElementById(id).textContent = "—";
    });
    document.getElementById("insight-total").textContent = "Unavailable";
    document.getElementById("insight-total-detail").textContent = "Top Tracks data failed to load.";
  }

  if (loadedCount === requests.length) {
    setStatus("All data loaded successfully", "success");
  } else if (loadedCount > 0) {
    setStatus("Some data failed to load", "partial");
  } else {
    setStatus("Data failed to load", "error");
  }
}

setupDatasetNotes();
loadDashboard();
