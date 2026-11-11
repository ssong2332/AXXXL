// 집별 사진·영상. 파일은 이 브라우저 메모리(blob: 주소)에만 있고 서버나 JSON으로 보내지 않는다.
import { newId } from './model.js';

export const MEDIA_RULES = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 20 * 1024 * 1024, label: '사진(JPG·PNG·WEBP·GIF, 20MB까지)' },
  video: { types: ['video/mp4', 'video/webm', 'video/quicktime'], maxBytes: 300 * 1024 * 1024, label: '영상(MP4·WEBM·MOV, 300MB까지)' },
  perHouse: 30,
};

export class MediaStore {
  constructor() { this.byHouse = new Map(); }

  list(houseId) { return this.byHouse.get(houseId) || []; }

  // 받을 수 있는 파일만 넣고, 거절한 파일과 이유를 돌려준다.
  add(houseId, files) {
    const list = [...this.list(houseId)];
    const rejected = [];
    for (const f of files) {
      const kind = MEDIA_RULES.image.types.includes(f.type) ? 'image' : MEDIA_RULES.video.types.includes(f.type) ? 'video' : null;
      if (!kind) { rejected.push([f.name, '지원하지 않는 형식이에요']); continue; }
      if (f.size > MEDIA_RULES[kind].maxBytes) { rejected.push([f.name, '파일이 너무 커요']); continue; }
      if (f.size === 0) { rejected.push([f.name, '빈 파일이에요']); continue; }
      if (list.length >= MEDIA_RULES.perHouse) { rejected.push([f.name, `한 집에 ${MEDIA_RULES.perHouse}개까지 넣을 수 있어요`]); continue; }
      list.push({ id: newId(), name: f.name, kind, size: f.size, url: URL.createObjectURL(f) });
    }
    this.byHouse.set(houseId, list);
    return rejected;
  }

  remove(houseId, mediaId) {
    const list = this.list(houseId);
    const m = list.find((x) => x.id === mediaId);
    if (m) URL.revokeObjectURL(m.url);
    this.byHouse.set(houseId, list.filter((x) => x.id !== mediaId));
  }

  dropHouse(houseId) {
    for (const m of this.list(houseId)) URL.revokeObjectURL(m.url);
    this.byHouse.delete(houseId);
  }

  clearAll() { for (const id of [...this.byHouse.keys()]) this.dropHouse(id); }

  counts(houseId) {
    const l = this.list(houseId);
    return { image: l.filter((m) => m.kind === 'image').length, video: l.filter((m) => m.kind === 'video').length };
  }
}

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
