"""Reproducible GLB inventory; standard-library Python only."""
import json, struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
results=[]
for p in sorted((root/'assets/models').glob('*.glb')):
    data=p.read_bytes(); length=struct.unpack_from('<I',data,12)[0]
    j=json.loads(data[20:20+length]); primitives=[p for m in j.get('meshes',[]) for p in m['primitives']]
    results.append(dict(file=p.name,bytes=len(data),vertices=sum(j['accessors'][p['attributes']['POSITION']]['count'] for p in primitives),triangles=sum(j['accessors'][p['indices']]['count']//3 for p in primitives if 'indices' in p),meshes=len(j.get('meshes',[])),skins=len(j.get('skins',[])),animations=len(j.get('animations',[])),materials=len(j.get('materials',[]))))
print(json.dumps(results,indent=2))
