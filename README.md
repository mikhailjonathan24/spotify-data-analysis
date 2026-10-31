# Spotify Songs Analysis Dashboard

An independent data portfolio dashboard exploring audio-feature trends,
popularity correlations, artist counts, and popular tracks across the cleaned
1922–2020 analysis period.

## Features

- Seven interactive Chart.js visualizations, including decade trends, feature
  correlations, artist counts, energy distribution, and musical mode.
- Decade, genre, and musical-key filters; genre and key apply to the Top Tracks
  sample.
- Searchable, paginated Top Tracks table.
- Responsive Spotify-inspired dark theme with a desktop executive layout.
- In-dashboard notes describing scope, methodology, and dataset limitations.

## Technology

- HTML5, Tailwind CSS via CDN, and custom CSS
- Vanilla JavaScript and `fetch()` for processed JSON
- Chart.js via CDN
- Python and pandas for preprocessing

## Run locally

The dashboard expects the following processed files:

- `data/processed/decade_trends.json`
- `data/processed/correlation_data.json`
- `data/processed/top_tracks.json`
- `data/processed/decade_modes.json`
- `data/processed/top_artists.json`

To regenerate them from `data/raw/tracks.csv` and `data/raw/artists.csv`, run
from the project root:

```bash
python scripts/preprocess.py
```

Start a local HTTP server from the project root:

```bash
python -m http.server 8000
```

Open [http://localhost:8000/web/](http://localhost:8000/web/). Do not open
`index.html` directly from the filesystem because browsers may block `fetch()`.
An internet connection is required for Tailwind CSS and Chart.js CDNs.

## Data scope and methodology

Preprocessing excludes records without a track name or parseable release year,
then limits the analysis to release years 1922–2020. The dashboard calculates
the full-dataset record count from decade aggregates. The Top Tracks file
contains up to 100 records ranked by popularity within that period; averages
for popularity and danceability are based on the currently filtered sample.
Genre and key filters, the energy distribution, and the scatter plot also use
that sample. Decade trends and musical-mode counts use full-dataset aggregates
unless a genre or key filter is active. Popularity is a dataset snapshot, and
correlation does not imply causation.

## Dataset attribution and licensing

The source files are from [Spotify Dataset 1921–2020, 600k+ Tracks](https://www.kaggle.com/datasets/yamaerenay/spotify-dataset-19212020-600k-tracks)
by **Yamac Eren Ay**. The Kaggle dataset page identifies Spotify Web API as its
data source and lists the
[Community Data License Agreement — Sharing, Version 1.0](https://cdla.dev/sharing-1-0/).
Review that license and the applicable Spotify terms before redistributing
dataset files. This attribution does not imply Spotify's endorsement or grant
rights to Spotify's trademarks. The MIT license applies to project code and
documentation only; see [NOTICE.md](NOTICE.md).
