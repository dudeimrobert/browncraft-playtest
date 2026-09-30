"""Package only project deliverables, excluding dependencies and scratch state."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
release = "Browncraft_Alpha_2.4.8"
output = root.parent / f"{release}.zip"
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if any(part in {"node_modules", ".git", "__pycache__"} for part in relative.parts):
            continue
        if relative.parts and relative.parts[0] == "review":
            continue
        if relative.as_posix() in {
            "assets/ajol/stitched/ajol_ground_stitched_4096.png",
            "assets/ajol/stitched/ajol_normal_stitched_4096.png",
            "assets/ground-steppe.png",
            # Editing/source assets are intentionally excluded from the web
            # playtest. The game loads only frog-knight-repaired.glb.
            "assets/models/frog-knight-tpose.glb",
            "assets/models/frog-knight-textured.glb",
            "assets/models/.vuldross-guardian.glb.nrJM73",
            "tools/repair_hero.py",
        }:
            continue
        if relative.name.startswith("ALPHA_") and relative.name != "ALPHA_2.4.8_NOTES.md":
            continue
        if relative.name in {"BUILD_1.0_NOTES.md", "meshy-frog-rig-alpha20.js"}:
            continue
        if file.is_file() and not file.is_symlink():
            archive.write(file, Path(release) / relative)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert f"{release}/assets/models/frog-knight-repaired.glb" in archive.namelist()
    assert f"{release}/assets/models/fantasy-x-tree-08.glb" in archive.namelist()
    assert f"{release}/assets/ajol/trader-billboard.png" in archive.namelist()
    assert archive.getinfo(f"{release}/assets/models/frog-knight-repaired.glb").file_size < 25 * 1024 * 1024
    assert not any(name.endswith(("frog-knight-tpose.glb", "frog-knight-textured.glb", ".vuldross-guardian.glb.nrJM73")) for name in archive.namelist())
    for guardian in ("mournwillow-guardian.glb", "vuldross-guardian.glb", "cindergut-guardian.glb"):
        assert f"{release}/assets/models/{guardian}" in archive.namelist()
    forbidden = [name for name in archive.namelist() if "2.0" in name or "2.1" in name or "2.2" in name or "alpha20" in name.lower()]
    assert not forbidden, forbidden
print(output, output.stat().st_size)
