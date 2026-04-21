import { ImageResponse } from "next/og";

// Static Open Graph image. Rendered by Next at request time but cached.
// 스타일은 레퍼런스 톤(Linear 다크 배경 + accent)에 맞췄다. 1200x630 표준.

export const runtime = "edge";
export const alt = "RepoLens — README보다 먼저, 코드보다 쉽게 레포를 이해합니다";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0b0b0c",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#f4f4f3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#fff7ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 24,
                height: 2.5,
                background: "#0D8C74",
                borderRadius: 999,
                marginBottom: 6,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: -0.3,
            }}
          >
            RepoLens
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: -1.5,
              maxWidth: 960,
            }}
          >
            README보다 먼저, 코드보다 쉽게 레포를 이해합니다
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "#bdbcb8",
              maxWidth: 900,
            }}
          >
            GitHub 공개 레포를 30초 안에 훑어봅니다. 이 레포가 뭔지,
            어떤 기술로 구성됐는지, 어디부터 읽어야 하는지.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 18,
            color: "#9a9893",
          }}
        >
          <span style={{ padding: "6px 12px", border: "1px solid #2a2a2b", borderRadius: 8 }}>
            먼저 이해하기
          </span>
          <span style={{ padding: "6px 12px", border: "1px solid #2a2a2b", borderRadius: 8 }}>
            구조 보기
          </span>
          <span style={{ padding: "6px 12px", border: "1px solid #2a2a2b", borderRadius: 8 }}>
            README 핵심 요약
          </span>
          <span style={{ padding: "6px 12px", border: "1px solid #2a2a2b", borderRadius: 8 }}>
            실행 환경
          </span>
        </div>
      </div>
    ),
    size
  );
}
