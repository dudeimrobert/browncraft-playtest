import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
// Mechanical release-label and local module URL update.
for(const file of ['index.html','app.js','assets/world3d.js','assets/meshy-frog-rig.js','character-lab.html','rig-test.html','README.md','START_HERE.md','package.json','tools/package_release.py','tools/verify-alpha23.mjs','ALPHA_2.3.1_NOTES.md']){
 const p=path.join(root,file);let s=fs.readFileSync(p,'utf8').replaceAll('2.3.1','2.3.2');
 if(file.endsWith('.html')||file.endsWith('.js'))s=s.replace(/(['"])(\.\.?\/[^'"?]+\.(?:js|css))\1/g,(_,q,url)=>`${q}${url}?v=2.3.2${q}`);
 fs.writeFileSync(p,s);
}
fs.renameSync(path.join(root,'ALPHA_2.3.1_NOTES.md'),path.join(root,'ALPHA_2.3.2_NOTES.md'));
