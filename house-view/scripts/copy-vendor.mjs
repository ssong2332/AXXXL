// node_modules에 설치된 three.js(고정 버전)를 web/vendor로 복사한다. 앱은 실행 중 외부 CDN을 부르지 않는다.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = new URL('../web/vendor/', import.meta.url);
mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/three/build/three.module.min.js', 'three.module.min.js'],
  ['node_modules/three/examples/jsm/controls/OrbitControls.js', 'OrbitControls.js'],
  ['node_modules/three/LICENSE', 'THREE_LICENSE.txt'],
];
for (const [from, to] of files) copyFileSync(new URL('../' + from, import.meta.url), new URL(to, out));
// import map 없이 열리도록 OrbitControls의 'three' 참조를 같은 폴더 파일로 바꾼다.
const oc = new URL('OrbitControls.js', out);
writeFileSync(oc, readFileSync(oc, 'utf8').replace("from 'three';", "from './three.module.min.js';"));
console.log('vendor 복사 완료:', files.map((f) => f[1]).join(', '));
