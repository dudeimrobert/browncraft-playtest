import json,struct,copy
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
import sys
base=Path(__file__).resolve().parents[1]
if len(sys.argv)!=3: raise SystemExit('Usage: python3 tools/retarget_tree.py TREE.glb ORIGINAL_SWAMP.glb')
def read(p):
 b=Path(p).read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
s,sbin=read(sys.argv[1]);t,tbin=read(sys.argv[2]);out=bytearray(tbin)
def arr(j,b,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];dims={'MAT4':16,'VEC4':4,'VEC3':3,'SCALAR':1};dt={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']];return np.frombuffer(b,dtype=dt,count=a['count']*dims[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1).copy()
def rests(j,b):
 sk=j['skins'][0];world={i:np.linalg.inv(m.reshape(4,4).T) for i,m in zip(sk['joints'],arr(j,b,sk['inverseBindMatrices']))};parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};res={}
 for i,m in world.items():
  local=np.linalg.inv(world[parents[i]])@m if parents.get(i) in world else m
  res[j['nodes'][i]['name']]=(R.from_matrix(local[:3,:3]),local[:3,3])
 return res
sr,tr=rests(s,sbin),rests(t,tbin);names={n.get('name'):i for i,n in enumerate(t['nodes'])}
def add(data,kind):
 while len(out)%4:out.append(0)
 off=len(out);out.extend(np.asarray(data,dtype='<f4').tobytes());vi=len(t['bufferViews']);t['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(out)-off});ai=len(t['accessors']);t['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(data),'type':kind});return ai
# Keep original Swamp clips as fallbacks; prefer retargeted versions by name.
for anim in s['animations']:
 a={'name':'Tree_'+anim['name'],'samplers':[],'channels':[]}
 for ch in anim['channels']:
  name=s['nodes'][ch['target']['node']]['name'];path=ch['target']['path'];samp=anim['samplers'][ch['sampler']]
  if name not in names or name not in sr or path=='scale' or name=='root' and path=='translation':continue
  values=arr(s,sbin,samp['output']);times=arr(s,sbin,samp['input']);qs,ps=sr[name];qt,pt=tr[name]
  if path=='rotation':values=(qt*qs.inv()*R.from_quat(values)).as_quat()
  elif path=='translation':values=pt+(values-ps)*(np.linalg.norm(pt)/max(np.linalg.norm(ps),1e-6))
  idx=len(a['samplers']);a['samplers'].append({'input':add(times,'SCALAR'),'output':add(values,'VEC4' if path=='rotation' else 'VEC3'),'interpolation':samp.get('interpolation','LINEAR')});a['channels'].append({'sampler':idx,'target':{'node':names[name],'path':path}})
 t['animations'].append(a)
t['buffers'][0]['byteLength']=len(out)
jb=json.dumps(t,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);out+=b'\0'*((-len(out))%4)
(base/'assets/models/swamp-frog.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(jb)+len(out))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(out),0x004e4942)+out)
(base/'assets/models/tree-frog.glb').write_bytes(Path(sys.argv[1]).read_bytes())
print('Retargeted',len(s['animations']),'clips; kept',len(t['animations'])-len(s['animations']),'originals')
