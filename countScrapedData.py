import os
import json

# Pad naar jouw map met JSON-bestanden
DATA_DIR = "all-scraped-data"

def count_objects_in_json(file_path):
    """Tel aantal JSON-objecten in een bestand."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return len(data)
            else:
                return 0
    except Exception as e:
        print(f"⚠️ Fout bij {file_path}: {e}")
        return 0


def main():
    total_count = 0
    file_counts = {}

    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".json"):
            path = os.path.join(DATA_DIR, filename)
            count = count_objects_in_json(path)
            file_counts[filename] = count
            total_count += count

    # Resultaten tonen
    print("Aantal auto's per bestand:\n")
    for fname, count in sorted(file_counts.items()):
        print(f"{fname:40}  {count:>5}")

    print("\nTotaal aantal auto's:", total_count)


if __name__ == "__main__":
    main()
