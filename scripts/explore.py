import pandas as pd

# Load dataset tracks
print("Sedang memuat dataset tracks...")
# Sesuaikan nama file aslinya (misal 'tracks.csv' atau 'tracks.xlsx')
# Karena filemu berukuran besar, pastikan format pembacaannya sesuai (.csv atau .read_excel)
df = pd.read_csv('C:/Users/USER/Downloads/spotify-data-analysis/data/raw/tracks.csv') 

# Menampilkan informasi dasar dataset
print("\n--- INFORMASI DATASET ---")
print(f"Jumlah Baris (Tracks): {df.shape[0]:,}")
print(f"Jumlah Kolom: {df.shape[1]}")

print("\n--- DAFTAR KOLOM & TIPE DATA ---")
print(df.info())

print("\n--- 5 BARIS PERTAMA ---")
print(df.head())