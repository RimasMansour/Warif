"""
prepare_data.py
---------------
Reads Wageningen Greenhouse Challenge CSV files
and generates irrigation_data.csv for Warif ML training.

Source files needed in data/datasets/:
    - GreenhouseClimate.csv
    - GrodanSens.csv
"""

import pandas as pd
from pathlib import Path

# Paths
BASE_DIR    = Path(__file__).parent
DATA_DIR    = BASE_DIR / "datasets"
OUTPUT_PATH = DATA_DIR / "irrigation_data.csv"

CLIMATE_FILE = DATA_DIR / "GreenhouseClimate.csv"
GRODAN_FILE  = DATA_DIR / "GrodanSens.csv"


def load_climate(path: Path) -> pd.DataFrame:
    """
    Reads GreenhouseClimate.csv and extracts required columns.
    Converts all numeric columns explicitly to avoid mixed-type issues.
    """
    print("Reading GreenhouseClimate...")
    df = pd.read_csv(path, low_memory=False)

    cols_needed = {
        "%time"     : "timestamp",
        "Tair"      : "air_temperature",
        "Rhair"     : "air_humidity",
        "CO2air"    : "co2",
        "water_sup" : "water_sup",
        "Cum_irr"   : "cum_irr",
    }

    missing = [c for c in cols_needed if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in GreenhouseClimate: {missing}")

    df = df[list(cols_needed.keys())].rename(columns=cols_needed)

    # Convert Excel serial number to datetime
    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="D", origin="1899-12-30")

    # Force numeric types
    for col in ["air_temperature", "air_humidity", "co2", "water_sup", "cum_irr"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def load_grodan(path: Path) -> pd.DataFrame:
    """
    Reads GrodanSens.csv and averages the two slab sensors.
    Converts all numeric columns explicitly to avoid mixed-type issues.
    """
    print("Reading GrodanSens...")
    df = pd.read_csv(path, low_memory=False)

    cols_needed = {
        "%time"   : "timestamp",
        "WC_slab1": "wc1",
        "WC_slab2": "wc2",
        "t_slab1" : "ts1",
        "t_slab2" : "ts2",
    }

    missing = [c for c in cols_needed if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in GrodanSens: {missing}")

    df = df[list(cols_needed.keys())].rename(columns=cols_needed)

    # Convert Excel serial number to datetime
    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="D", origin="1899-12-30")

    # Force numeric types
    for col in ["wc1", "wc2", "ts1", "ts2"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Average the two slab sensors
    df["soil_moisture"]    = df[["wc1", "wc2"]].mean(axis=1)
    df["soil_temperature"] = df[["ts1", "ts2"]].mean(axis=1)

    return df[["timestamp", "soil_moisture", "soil_temperature"]]


def create_target(df: pd.DataFrame) -> pd.DataFrame:
    """
    Creates irrigation_needed column.
    Logic: if water_sup increases in the next reading, irrigation is needed now.
    """
    df["water_sup"] = pd.to_numeric(df["water_sup"], errors="coerce")
    df["irrigation_needed"] = (
        df["water_sup"].shift(-1) > df["water_sup"]
    ).astype(int)
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """
    Removes missing values and obvious sensor outliers.
    """
    before = len(df)

    df = df.dropna()
    df = df[df["air_temperature"].between(-10, 60)]
    df = df[df["air_humidity"].between(0, 100)]
    df = df[df["soil_moisture"].between(0, 100)]
    df = df[df["soil_temperature"].between(-10, 60)]
    df = df[df["co2"].between(300, 2000)]

    after = len(df)
    print(f"Cleaning: {before} rows -> {after} rows (removed {before - after})")
    return df


def main():
    # Check that source files exist
    for f in [CLIMATE_FILE, GRODAN_FILE]:
        if not f.exists():
            raise FileNotFoundError(
                f"File not found: {f}\n"
                f"Place CSV files in: {DATA_DIR}"
            )

    # Load both files
    climate = load_climate(CLIMATE_FILE)
    grodan  = load_grodan(GRODAN_FILE)

    # Merge on timestamp
    print("Merging files...")
    df = pd.merge_asof(
        climate.sort_values("timestamp"),
        grodan.sort_values("timestamp"),
        on="timestamp",
        tolerance=pd.Timedelta("5min"),
        direction="nearest"
    )

    # Create the target column
    df = create_target(df)

    # Clean
    df = clean(df)

    # Final columns in order
    final_cols = [
        "timestamp",
        "air_temperature",
        "air_humidity",
        "co2",
        "soil_moisture",
        "soil_temperature",
        "cum_irr",
        "irrigation_needed",
    ]
    df = df[final_cols]

    # Save
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"\nSaved to: {OUTPUT_PATH}")
    print(f"Total rows: {len(df):,}")
    print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"\nTarget distribution:")
    print(df["irrigation_needed"].value_counts())


if __name__ == "__main__":
    main()