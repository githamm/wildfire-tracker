import urllib.request
import json
import csv

BASE = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_YearToDate/FeatureServer/0/query"

all_features = []
offset = 0

while True:
    url = (
        f"{BASE}"
        f"?where=IncidentTypeCategory%3D%27WF%27+AND+IncidentSize+%3E%3D+10"
        f"&outFields=*"
        f"&returnGeometry=true"
        f"&f=json"
        f"&resultOffset={offset}"
        f"&resultRecordCount=2000"
    )
    print(f"Fetching offset {offset}...")
    with urllib.request.urlopen(url, timeout=60) as r:
        data = json.loads(r.read())

    if "error" in data:
        raise SystemExit(f"API error: {data['error']}")

    features = data.get("features", [])
    if not features:
        break

    all_features.extend(features)
    offset += len(features)
    print(f"  Got {len(features)} features, total so far: {len(all_features)}")

    if not data.get("exceededTransferLimit", False):
        break

print(f"Total features fetched: {len(all_features)}")

if not all_features:
    raise SystemExit("No features returned — aborting")

fields = list(all_features[0]["attributes"].keys()) + ["x", "y"]

with open("data/wildfire_ytd.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for feat in all_features:
        row = dict(feat["attributes"])
        geom = feat.get("geometry") or {}
        row["x"] = geom.get("x")
        row["y"] = geom.get("y")
        w.writerow(row)

print("CSV written successfully")