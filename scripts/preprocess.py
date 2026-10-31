import ast
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
AUDIO_FEATURES = ["danceability", "energy", "valence", "acousticness", "popularity"]
ANALYSIS_START_YEAR = 1922
ANALYSIS_END_YEAR = 2020


def parse_list(value):
    if isinstance(value, list):
        return value
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = ast.literal_eval(value)
    except (SyntaxError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def get_top_track_genres(track_artist_ids, artist_genres):
    genres = []
    for artist_id in parse_list(track_artist_ids):
        for genre in artist_genres.get(artist_id, []):
            if genre and genre not in genres:
                genres.append(genre)
    return genres


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Memuat dataset tracks...")
    df = pd.read_csv(RAW_DIR / "tracks.csv", low_memory=False)
    df = df.dropna(subset=["name"]).copy()
    df["year"] = pd.to_numeric(
        df["release_date"].astype(str).str[:4],
        errors="coerce"
    )
    df = df.dropna(subset=["year"])
    df["year"] = df["year"].astype(int)
    df = df[df["year"].between(ANALYSIS_START_YEAR, ANALYSIS_END_YEAR)].copy()
    df["decade"] = (df["year"] // 10) * 10

    print("Memproses tren fitur dan korelasi...")
    decade_groups = df.groupby("decade")
    trend_data = decade_groups[AUDIO_FEATURES].mean()
    trend_data["tracks"] = decade_groups.size()
    trend_data = trend_data.reset_index()
    trend_data.to_json(OUTPUT_DIR / "decade_trends.json", orient="records")
    print("  -> decade_trends.json berhasil dibuat")

    mode_data = (
        df.dropna(subset=["mode"])
        .assign(mode=lambda frame: pd.to_numeric(frame["mode"], errors="coerce"))
        .dropna(subset=["mode"])
        .groupby(["decade", "mode"])
        .size()
        .rename("tracks")
        .reset_index()
    )
    mode_data.to_json(OUTPUT_DIR / "decade_modes.json", orient="records")
    print("  -> decade_modes.json berhasil dibuat")

    corr_matrix = df[AUDIO_FEATURES].corr().reset_index().rename(columns={"index": "feature"})
    corr_matrix.to_json(OUTPUT_DIR / "correlation_data.json", orient="records")
    print("  -> correlation_data.json berhasil dibuat")

    print("Menghitung artis paling sering muncul di seluruh dataset...")
    artist_tracks = (
        df[["artists"]]
        .assign(artist_name=lambda frame: frame["artists"].map(parse_list))
        .explode("artist_name")
        .dropna(subset=["artist_name"])
    )
    artist_counts = (
        artist_tracks.groupby("artist_name")
        .size()
        .rename("track_count")
        .reset_index()
        .sort_values("track_count", ascending=False)
        .head(10)
        .rename(columns={"artist_name": "artist"})
    )
    artist_counts.to_json(
        OUTPUT_DIR / "top_artists.json",
        orient="records",
        force_ascii=False
    )
    print("  -> top_artists.json berhasil dibuat")

    print("Memperkaya Top Tracks dengan key dan genre artis...")
    top_tracks = df.sort_values(by="popularity", ascending=False).head(100).copy()
    target_artist_ids = {
        artist_id
        for value in top_tracks["id_artists"]
        for artist_id in parse_list(value)
    }

    artist_genres = {}
    for artist_chunk in pd.read_csv(
        RAW_DIR / "artists.csv",
        usecols=["id", "genres"],
        chunksize=50000,
        low_memory=False
    ):
        matching_artists = artist_chunk[artist_chunk["id"].isin(target_artist_ids)]
        for artist_id, genres in matching_artists.itertuples(index=False, name=None):
            artist_genres[artist_id] = parse_list(genres)
        if target_artist_ids.issubset(artist_genres):
            break

    top_tracks["genres"] = top_tracks["id_artists"].map(
        lambda value: get_top_track_genres(value, artist_genres)
    )
    cols_to_export = [
        "name",
        "artists",
        "year",
        "popularity",
        "danceability",
        "energy",
        "valence",
        "acousticness",
        "mode",
        "key",
        "genres"
    ]
    top_tracks[cols_to_export].to_json(
        OUTPUT_DIR / "top_tracks.json",
        orient="records",
        force_ascii=False
    )
    print("  -> top_tracks.json berhasil dibuat dengan key dan genre")
    print("\nSelesai! Data siap digunakan untuk Frontend Dashboard.")


if __name__ == "__main__":
    main()