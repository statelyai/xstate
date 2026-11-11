import json
import pathlib
import statistics

root = pathlib.Path(__file__).resolve().parent


def stats(values):
    return {"median": statistics.median(values), "min": min(values), "max": max(values)}


summary = {}
for runtime in ["node", "bun"]:
    data = json.loads((root / f"runtime-{runtime}.json").read_text())
    rows = []
    for case in data["results"]:
        assert case["verified"]
        baseline = case["samples"]["base"]
        feature = case["samples"]["feature"]
        assert len(baseline) == len(feature) == data["rounds"]
        assert all(s["cpuMs"] >= 150 for s in baseline + feature)
        rows.append({
            "case": case["profile"],
            "baselineCpuNs": stats([s["cpuNsPerOperation"] for s in baseline]),
            "featureCpuNs": stats([s["cpuNsPerOperation"] for s in feature]),
            "baselineWallNs": stats([s["wallNsPerOperation"] for s in baseline]),
            "featureWallNs": stats([s["wallNsPerOperation"] for s in feature]),
            "pairedCpuPercent": stats([100 * (b["cpuNsPerOperation"] / a["cpuNsPerOperation"] - 1) for a, b in zip(baseline, feature)]),
            "pairedWallPercent": stats([100 * (b["wallNsPerOperation"] / a["wallNsPerOperation"] - 1) for a, b in zip(baseline, feature)]),
        })
    summary[runtime] = {"environment": data["environment"], "rounds": data["rounds"], "rows": rows}

(root / "runtime-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
for runtime in ["node", "bun"]:
    print(runtime)
    for row in summary[runtime]["rows"]:
        print(row["case"], row["pairedCpuPercent"])
