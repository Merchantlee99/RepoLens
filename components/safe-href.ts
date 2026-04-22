// 사용자(레포 소유자) 컨텐츠에서 뽑아온 URL을 `<a href>` / `<img src>`에
// 그대로 꽂기 전에 통과시키는 안전 필터.
//
// 막고자 하는 것:
// - javascript: / data: / vbscript: / file: 같은 위험 스킴.
// - URL 파싱 실패(빈 문자열, 공백 등).
//
// 통과시키는 것:
// - https: / http: / mailto:
//
// 프로토콜이 위험하면 null을 리턴하고, 호출부는 링크를 아예 렌더하지 않거나
// 텍스트로만 표시하도록 처리한다.

const SAFE_LINK_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

export function safeExternalHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // mailto:는 URL 파서가 받아주지만 //가 없어서 href로만 유효.
  // 그 외엔 https/http만 허용.
  try {
    const parsed = new URL(trimmed);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

// 이미지 소스 전용. mailto는 무의미하므로 https/http만 허용.
const SAFE_IMAGE_PROTOCOLS = new Set(["https:", "http:"]);

export function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return SAFE_IMAGE_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}
