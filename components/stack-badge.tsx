"use client";

// Brand marks come from two CDNs:
//  - `iconify` (logos: set)  → 공식 컬러 로고. AI 상표처럼 인지성이 필요한
//    브랜드에 우선 사용. Multi-color vector.
//  - `simpleicons`           → 단색 마크. 프레임워크/언어 등 monochrome 식별용.
//
// 둘 다 없을 경우에만 inline SVG(모노그램)로 내려간다. 공식 마크 복제가
// 아니라 공개 CDN 참조이므로 상표 사용 목적의 nominative identification
// 범위에 해당한다.

import type { ReactNode } from "react";

type StackLogo =
  | {
      // iconify `logos:…` 등 multi-color 공식 로고
      kind: "iconify";
      id: string;
      onLight?: boolean;
    }
  | {
      // simpleicons 단색 마크
      kind: "simpleicons";
      slug: string;
      color: string; // hex without #
      onLight?: boolean;
    };

const STACK_LOGO: Record<string, StackLogo> = {
  // ─── AI services (우선 iconify 공식 로고) ─────────────────────────────────
  openai:            { kind: "iconify", id: "logos:openai-icon" },
  "open ai":         { kind: "iconify", id: "logos:openai-icon" },
  chatgpt:           { kind: "iconify", id: "logos:openai-icon" },
  gpt:               { kind: "iconify", id: "logos:openai-icon" },
  "gpt-4":           { kind: "iconify", id: "logos:openai-icon" },
  "gpt-3.5":         { kind: "iconify", id: "logos:openai-icon" },
  "dall-e":          { kind: "iconify", id: "logos:openai-icon" },
  whisper:           { kind: "iconify", id: "logos:openai-icon" },
  claude:            { kind: "iconify", id: "logos:claude-icon" },
  "claude ai":       { kind: "iconify", id: "logos:claude-icon" },
  anthropic:         { kind: "iconify", id: "logos:anthropic" },
  gemini:            { kind: "iconify", id: "logos:google-gemini" },
  "google gemini":   { kind: "iconify", id: "logos:google-gemini" },
  huggingface:       { kind: "iconify", id: "logos:hugging-face-icon" },
  "hugging face":    { kind: "iconify", id: "logos:hugging-face-icon" },
  "mistral":         { kind: "iconify", id: "logos:mistral-ai-icon" },
  "mistral ai":      { kind: "iconify", id: "logos:mistral-ai-icon" },
  perplexity:        { kind: "iconify", id: "logos:perplexity-icon" },
  midjourney:        { kind: "iconify", id: "logos:midjourney" },
  stability:         { kind: "iconify", id: "logos:stability-ai" },
  "stability ai":    { kind: "iconify", id: "logos:stability-ai" },
  "stable diffusion": { kind: "iconify", id: "logos:stability-ai" },
  langchain:         { kind: "simpleicons", slug: "langchain", color: "1C3C3C", onLight: true },
  ollama:            { kind: "simpleicons", slug: "ollama", color: "000000", onLight: true },
  replicate:         { kind: "simpleicons", slug: "replicate", color: "000000", onLight: true },

  // ─── Frameworks (web/app) ─────────────────────────────────────────────────
  "next.js":       { kind: "simpleicons", slug: "nextdotjs", color: "000000", onLight: true },
  nextjs:          { kind: "simpleicons", slug: "nextdotjs", color: "000000", onLight: true },
  react:           { kind: "simpleicons", slug: "react",     color: "61DAFB" },
  "react native":  { kind: "simpleicons", slug: "react",     color: "61DAFB" },
  vue:             { kind: "simpleicons", slug: "vuedotjs",  color: "4FC08D" },
  "vue.js":        { kind: "simpleicons", slug: "vuedotjs",  color: "4FC08D" },
  svelte:          { kind: "simpleicons", slug: "svelte",    color: "FF3E00" },
  sveltekit:       { kind: "simpleicons", slug: "svelte",    color: "FF3E00" },
  angular:         { kind: "simpleicons", slug: "angular",   color: "DD0031" },
  express:         { kind: "simpleicons", slug: "express",   color: "000000", onLight: true },
  fastapi:         { kind: "simpleicons", slug: "fastapi",   color: "009688" },
  nestjs:          { kind: "simpleicons", slug: "nestjs",    color: "E0234E" },
  remix:           { kind: "simpleicons", slug: "remix",     color: "000000", onLight: true },
  astro:           { kind: "simpleicons", slug: "astro",     color: "BC52EE" },
  nuxt:            { kind: "simpleicons", slug: "nuxt",      color: "00DC82" },
  "nuxt.js":       { kind: "simpleicons", slug: "nuxt",      color: "00DC82" },
  solid:           { kind: "simpleicons", slug: "solid",     color: "2C4F7C" },
  qwik:            { kind: "simpleicons", slug: "qwik",      color: "AC7EF4" },
  django:          { kind: "simpleicons", slug: "django",    color: "092E20", onLight: true },
  flask:           { kind: "simpleicons", slug: "flask",     color: "000000", onLight: true },
  rails:           { kind: "simpleicons", slug: "rubyonrails", color: "CC0000" },
  "ruby on rails": { kind: "simpleicons", slug: "rubyonrails", color: "CC0000" },
  spring:          { kind: "simpleicons", slug: "spring",    color: "6DB33F" },
  hono:            { kind: "simpleicons", slug: "hono",      color: "E36002" },
  koa:             { kind: "simpleicons", slug: "koa",       color: "33333D", onLight: true },
  gatsby:          { kind: "simpleicons", slug: "gatsby",    color: "663399" },
  expo:            { kind: "simpleicons", slug: "expo",      color: "000020", onLight: true },

  // ─── Languages ────────────────────────────────────────────────────────────
  typescript:      { kind: "simpleicons", slug: "typescript", color: "3178C6" },
  javascript:      { kind: "simpleicons", slug: "javascript", color: "F7DF1E", onLight: true },
  python:          { kind: "simpleicons", slug: "python",    color: "3776AB" },
  go:              { kind: "simpleicons", slug: "go",        color: "00ADD8" },
  golang:          { kind: "simpleicons", slug: "go",        color: "00ADD8" },
  rust:            { kind: "simpleicons", slug: "rust",      color: "000000", onLight: true },
  java:            { kind: "simpleicons", slug: "openjdk",   color: "ED8B00" },
  ruby:            { kind: "simpleicons", slug: "ruby",      color: "CC342D" },
  kotlin:          { kind: "simpleicons", slug: "kotlin",    color: "7F52FF" },
  swift:           { kind: "simpleicons", slug: "swift",     color: "F05138" },
  "c++":           { kind: "simpleicons", slug: "cplusplus", color: "00599C" },
  c:               { kind: "simpleicons", slug: "c",         color: "A8B9CC" },
  "c#":            { kind: "simpleicons", slug: "dotnet",    color: "512BD4" },
  ".net":          { kind: "simpleicons", slug: "dotnet",    color: "512BD4" },
  php:             { kind: "simpleicons", slug: "php",       color: "777BB4" },
  dart:            { kind: "simpleicons", slug: "dart",      color: "0175C2" },
  elixir:          { kind: "simpleicons", slug: "elixir",    color: "4B275F" },
  scala:           { kind: "simpleicons", slug: "scala",     color: "DC322F" },
  lua:             { kind: "simpleicons", slug: "lua",       color: "2C2D72" },
  haskell:         { kind: "simpleicons", slug: "haskell",   color: "5D4F85" },
  r:               { kind: "simpleicons", slug: "r",         color: "276DC3" },
  zig:             { kind: "simpleicons", slug: "zig",       color: "F7A41D" },

  // ─── Styling / UI kits ────────────────────────────────────────────────────
  "tailwind css":  { kind: "simpleicons", slug: "tailwindcss", color: "06B6D4" },
  tailwind:        { kind: "simpleicons", slug: "tailwindcss", color: "06B6D4" },
  tailwindcss:     { kind: "simpleicons", slug: "tailwindcss", color: "06B6D4" },
  css:             { kind: "simpleicons", slug: "css3",      color: "1572B6" },
  html:            { kind: "simpleicons", slug: "html5",     color: "E34F26" },
  sass:            { kind: "simpleicons", slug: "sass",      color: "CC6699" },
  "styled-components": { kind: "simpleicons", slug: "styledcomponents", color: "DB7093" },
  shadcn:          { kind: "simpleicons", slug: "shadcnui",  color: "000000", onLight: true },
  "shadcn/ui":     { kind: "simpleicons", slug: "shadcnui",  color: "000000", onLight: true },
  radix:           { kind: "simpleicons", slug: "radixui",   color: "161618", onLight: true },
  "radix-ui":      { kind: "simpleicons", slug: "radixui",   color: "161618", onLight: true },
  chakra:          { kind: "simpleicons", slug: "chakraui",  color: "319795" },
  "chakra ui":     { kind: "simpleicons", slug: "chakraui",  color: "319795" },
  mantine:         { kind: "simpleicons", slug: "mantine",   color: "339AF0" },
  emotion:         { kind: "simpleicons", slug: "emotion",   color: "DB7093" },
  "material ui":   { kind: "simpleicons", slug: "mui",       color: "007FFF" },
  mui:             { kind: "simpleicons", slug: "mui",       color: "007FFF" },
  bootstrap:       { kind: "simpleicons", slug: "bootstrap", color: "7952B3" },

  // ─── Runtimes ─────────────────────────────────────────────────────────────
  "node.js":       { kind: "simpleicons", slug: "nodedotjs", color: "5FA04E" },
  node:            { kind: "simpleicons", slug: "nodedotjs", color: "5FA04E" },
  nodejs:          { kind: "simpleicons", slug: "nodedotjs", color: "5FA04E" },
  bun:             { kind: "simpleicons", slug: "bun",       color: "000000", onLight: true },
  deno:            { kind: "simpleicons", slug: "deno",      color: "000000", onLight: true },

  // ─── Databases ────────────────────────────────────────────────────────────
  prisma:          { kind: "simpleicons", slug: "prisma",    color: "2D3748", onLight: true },
  postgresql:      { kind: "simpleicons", slug: "postgresql", color: "4169E1" },
  postgres:        { kind: "simpleicons", slug: "postgresql", color: "4169E1" },
  mongodb:         { kind: "simpleicons", slug: "mongodb",   color: "47A248" },
  redis:           { kind: "simpleicons", slug: "redis",     color: "FF4438" },
  mysql:           { kind: "simpleicons", slug: "mysql",     color: "4479A1" },
  mariadb:         { kind: "simpleicons", slug: "mariadb",   color: "003545", onLight: true },
  sqlite:          { kind: "simpleicons", slug: "sqlite",    color: "003B57" },
  drizzle:         { kind: "simpleicons", slug: "drizzle",   color: "C5F74F", onLight: true },
  "drizzle orm":   { kind: "simpleicons", slug: "drizzle",   color: "C5F74F", onLight: true },
  planetscale:     { kind: "simpleicons", slug: "planetscale", color: "000000", onLight: true },
  neon:            { kind: "simpleicons", slug: "neondatabase", color: "00E699" },
  duckdb:          { kind: "simpleicons", slug: "duckdb",    color: "FFF000", onLight: true },
  elasticsearch:   { kind: "iconify",     id: "logos:elasticsearch" },
  algolia:         { kind: "simpleicons", slug: "algolia",   color: "003DFF" },
  meilisearch:     { kind: "simpleicons", slug: "meilisearch", color: "FF5CAA" },
  typesense:       { kind: "iconify",     id: "logos:typesense-icon" },
  cassandra:       { kind: "iconify",     id: "logos:cassandra" },
  typeorm:         { kind: "simpleicons", slug: "typeorm",   color: "FE0803" },
  sequelize:       { kind: "simpleicons", slug: "sequelize", color: "52B0E7" },

  // ─── Backend services / SaaS ──────────────────────────────────────────────
  supabase:        { kind: "simpleicons", slug: "supabase",  color: "3FCF8E" },
  firebase:        { kind: "simpleicons", slug: "firebase",  color: "DD2C00" },
  appwrite:        { kind: "simpleicons", slug: "appwrite",  color: "FD366E" },
  pocketbase:      { kind: "simpleicons", slug: "pocketbase", color: "B8DBE4", onLight: true },
  sanity:          { kind: "simpleicons", slug: "sanity",    color: "F03E2F" },
  contentful:      { kind: "simpleicons", slug: "contentful", color: "2478CC" },
  strapi:          { kind: "simpleicons", slug: "strapi",    color: "4945FF" },
  directus:        { kind: "simpleicons", slug: "directus",  color: "6644FF" },
  fauna:           { kind: "iconify",     id: "logos:fauna-icon" },
  faunadb:         { kind: "iconify",     id: "logos:fauna-icon" },

  // ─── Payment / Auth ───────────────────────────────────────────────────────
  stripe:          { kind: "simpleicons", slug: "stripe",    color: "635BFF" },
  auth0:           { kind: "simpleicons", slug: "auth0",     color: "EB5424" },
  clerk:           { kind: "simpleicons", slug: "clerk",     color: "6C47FF" },
  oauth:           { kind: "simpleicons", slug: "auth0",     color: "EB5424" },
  paypal:          { kind: "simpleicons", slug: "paypal",    color: "00457C" },
  workos:          { kind: "iconify",     id: "logos:workos-icon" },

  // ─── Email / Messaging ────────────────────────────────────────────────────
  resend:          { kind: "simpleicons", slug: "resend",    color: "000000", onLight: true },
  twilio:          { kind: "simpleicons", slug: "twilio",    color: "F22F46" },
  discord:         { kind: "simpleicons", slug: "discord",   color: "5865F2" },
  slack:           { kind: "simpleicons", slug: "slack",     color: "4A154B" },
  pusher:          { kind: "simpleicons", slug: "pusher",    color: "300D4F" },
  "socket.io":     { kind: "simpleicons", slug: "socketdotio", color: "010101", onLight: true },
  rabbitmq:        { kind: "simpleicons", slug: "rabbitmq",  color: "FF6600" },
  kafka:           { kind: "simpleicons", slug: "apachekafka", color: "231F20", onLight: true },
  "apache kafka":  { kind: "simpleicons", slug: "apachekafka", color: "231F20", onLight: true },
  nats:            { kind: "iconify",     id: "logos:nats-icon" },
  sendgrid:        { kind: "iconify",     id: "logos:sendgrid-icon" },

  // ─── Analytics / Observability ────────────────────────────────────────────
  posthog:         { kind: "simpleicons", slug: "posthog",   color: "1D4AFF" },
  mixpanel:        { kind: "simpleicons", slug: "mixpanel",  color: "7856FF" },
  sentry:          { kind: "simpleicons", slug: "sentry",    color: "362D59" },
  datadog:         { kind: "simpleicons", slug: "datadog",   color: "632CA6" },
  "new relic":     { kind: "simpleicons", slug: "newrelic",  color: "008C99" },
  newrelic:        { kind: "simpleicons", slug: "newrelic",  color: "008C99" },
  grafana:         { kind: "simpleicons", slug: "grafana",   color: "F46800" },
  prometheus:      { kind: "simpleicons", slug: "prometheus", color: "E6522C" },
  opentelemetry:   { kind: "simpleicons", slug: "opentelemetry", color: "425CC7" },

  // ─── Tooling / infra ──────────────────────────────────────────────────────
  docker:          { kind: "simpleicons", slug: "docker",    color: "2496ED" },
  kubernetes:      { kind: "simpleicons", slug: "kubernetes", color: "326CE5" },
  vercel:          { kind: "simpleicons", slug: "vercel",    color: "000000", onLight: true },
  railway:         { kind: "simpleicons", slug: "railway",   color: "0B0D0E", onLight: true },
  "fly.io":        { kind: "simpleicons", slug: "flydotio",  color: "8E5FF7" },
  render:          { kind: "simpleicons", slug: "render",    color: "46E3B7" },
  netlify:         { kind: "simpleicons", slug: "netlify",   color: "00C7B7" },
  cloudflare:      { kind: "simpleicons", slug: "cloudflare", color: "F38020" },
  googlecloud:     { kind: "simpleicons", slug: "googlecloud", color: "4285F4" },
  "google cloud":  { kind: "simpleicons", slug: "googlecloud", color: "4285F4" },
  gcp:             { kind: "simpleicons", slug: "googlecloud", color: "4285F4" },
  digitalocean:    { kind: "simpleicons", slug: "digitalocean", color: "0080FF" },
  fastly:          { kind: "simpleicons", slug: "fastly",    color: "FF282D" },
  upstash:         { kind: "simpleicons", slug: "upstash",   color: "00E9A3" },
  aws:             { kind: "iconify",     id: "logos:aws" },
  "amazon web services": { kind: "iconify", id: "logos:aws" },
  heroku:          { kind: "iconify",     id: "logos:heroku-icon" },
  webpack:         { kind: "simpleicons", slug: "webpack",   color: "8DD6F9", onLight: true },
  vite:            { kind: "simpleicons", slug: "vite",      color: "646CFF" },
  turbopack:       { kind: "simpleicons", slug: "turborepo", color: "000000", onLight: true },
  turborepo:       { kind: "simpleicons", slug: "turborepo", color: "000000", onLight: true },
  nx:              { kind: "simpleicons", slug: "nx",        color: "143055" },
  esbuild:         { kind: "simpleicons", slug: "esbuild",   color: "FFCF00", onLight: true },
  swc:             { kind: "simpleicons", slug: "swc",       color: "000000", onLight: true },
  rollup:          { kind: "simpleicons", slug: "rollupdotjs", color: "EC4A3F" },
  gulp:            { kind: "simpleicons", slug: "gulp",      color: "CF4647" },
  pnpm:            { kind: "simpleicons", slug: "pnpm",      color: "F69220" },
  npm:             { kind: "simpleicons", slug: "npm",       color: "CB3837" },
  yarn:            { kind: "simpleicons", slug: "yarn",      color: "2C8EBB" },
  github:          { kind: "simpleicons", slug: "github",    color: "000000", onLight: true },
  "github actions": { kind: "simpleicons", slug: "githubactions", color: "2088FF" },
  "github pages":  { kind: "simpleicons", slug: "github",    color: "000000", onLight: true },
  git:             { kind: "simpleicons", slug: "git",       color: "F05032" },
  gitlab:          { kind: "simpleicons", slug: "gitlab",    color: "FC6D26" },
  bitbucket:       { kind: "simpleicons", slug: "bitbucket", color: "0052CC" },

  // ─── Testing ──────────────────────────────────────────────────────────────
  vitest:          { kind: "simpleicons", slug: "vitest",    color: "6E9F18" },
  jest:            { kind: "simpleicons", slug: "jest",      color: "C21325" },
  cypress:         { kind: "simpleicons", slug: "cypress",   color: "17202C", onLight: true },
  mocha:           { kind: "simpleicons", slug: "mocha",     color: "8D6748" },
  storybook:       { kind: "simpleicons", slug: "storybook", color: "FF4785" },
  playwright:      { kind: "iconify",     id: "logos:playwright" },

  // ─── ML / data ────────────────────────────────────────────────────────────
  pytorch:         { kind: "simpleicons", slug: "pytorch",   color: "EE4C2C" },
  tensorflow:      { kind: "simpleicons", slug: "tensorflow", color: "FF6F00" },
  pandas:          { kind: "simpleicons", slug: "pandas",    color: "150458", onLight: true },
  numpy:           { kind: "simpleicons", slug: "numpy",     color: "013243" },
  "scikit-learn":  { kind: "simpleicons", slug: "scikitlearn", color: "F7931E", onLight: true },

  // ─── Editors / IDE ────────────────────────────────────────────────────────
  vscode:          { kind: "simpleicons", slug: "vscodium",  color: "2F80ED" },
  "visual studio code": { kind: "simpleicons", slug: "vscodium", color: "2F80ED" },
  neovim:          { kind: "simpleicons", slug: "neovim",    color: "57A143" },
  vim:             { kind: "simpleicons", slug: "vim",       color: "019733" },
  sublime:         { kind: "simpleicons", slug: "sublimetext", color: "FF9800" },
  webstorm:        { kind: "simpleicons", slug: "webstorm",  color: "000000", onLight: true },
  pycharm:         { kind: "simpleicons", slug: "pycharm",   color: "000000", onLight: true },
  goland:          { kind: "simpleicons", slug: "goland",    color: "000000", onLight: true },
};

// ─── Remaining inline fallbacks (iconify/simpleicons 둘 다 없는 것) ────────
function InlineMonogram({
  letters,
  bg,
  fg,
  radius = "circle",
  size = 9,
}: {
  letters: string;
  bg: string;
  fg: string;
  radius?: "circle" | "square";
  size?: number;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {radius === "circle" ? (
        <circle cx="12" cy="12" r="11" fill={bg} />
      ) : (
        <rect width="24" height="24" rx="5" fill={bg} />
      )}
      <text
        x="12"
        y={13 + size / 2.5}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize={size}
        fontWeight="700"
        fill={fg}
        textAnchor="middle"
      >
        {letters}
      </text>
    </svg>
  );
}

const INLINE_LOGOS: Record<string, () => ReactNode> = {
  // iconify에도 없는 AI 브랜드
  cohere: () => <InlineMonogram letters="Co" bg="#39594D" fg="#FFD96A" />,
  groq: () => <InlineMonogram letters="Gq" bg="#F55036" fg="#ffffff" />,
  openrouter: () => <InlineMonogram letters="OR" bg="#6366F1" fg="#ffffff" />,
  langfuse: () => <InlineMonogram letters="Lf" bg="#0F172A" fg="#F59E0B" />,
  "llama index": () => <InlineMonogram letters="Li" bg="#2E2E2E" fg="#FFB800" />,
  llamaindex: () => <InlineMonogram letters="Li" bg="#2E2E2E" fg="#FFB800" />,
  // 기타 404 항목
  zustand: () => <InlineMonogram letters="Z" bg="#443E38" fg="#F6E3C5" size={11} />,
  jotai: () => <InlineMonogram letters="Jo" bg="#000000" fg="#ffffff" />,
  "next auth": () => <InlineMonogram letters="NA" bg="#9333EA" fg="#ffffff" />,
  nextauth: () => <InlineMonogram letters="NA" bg="#9333EA" fg="#ffffff" />,
  "auth.js": () => <InlineMonogram letters="NA" bg="#9333EA" fg="#ffffff" />,
  kinde: () => <InlineMonogram letters="Ki" bg="#0E0E2C" fg="#50EE9A" />,
  postmark: () => <InlineMonogram letters="PM" bg="#FFDE00" fg="#000000" radius="square" />,
  cockroachdb: () => <InlineMonogram letters="Cr" bg="#6933FF" fg="#ffffff" />,
  edgedb: () => <InlineMonogram letters="Ed" bg="#0D0D0D" fg="#1F8AFF" />,
  linode: () => <InlineMonogram letters="LN" bg="#00A95C" fg="#ffffff" radius="square" />,
};

function MonogramFallback({ name }: { name: string }) {
  const initial = name.replace(/[^a-zA-Z0-9가-힣]/g, "").slice(0, 2);
  if (!initial) return null;
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-[9.5px] font-semibold leading-none text-[var(--fg-dim)]"
    >
      {initial}
    </span>
  );
}

export function StackBadge({ name }: { name: string }) {
  const key = name.trim().toLowerCase();

  // 1) Inline SVG 전용 (iconify/simpleicons 둘 다 없는 경우)
  const inline = INLINE_LOGOS[key];
  if (inline) {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded"
      >
        <span className="block h-4 w-4">{inline()}</span>
      </span>
    );
  }

  const logo = STACK_LOGO[key];
  if (!logo) return <MonogramFallback name={name} />;

  // 2) iconify multi-color 공식 로고
  if (logo.kind === "iconify") {
    const src = `https://api.iconify.design/${logo.id}.svg`;
    const padded = logo.onLight ? "bg-white" : "";
    return (
      <span
        aria-hidden
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded ${padded}`.trim()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`block object-contain ${logo.onLight ? "h-3.5 w-3.5" : "h-4 w-4"}`}
        />
      </span>
    );
  }

  // 3) simpleicons 단색
  const src = `https://cdn.simpleicons.org/${logo.slug}/${logo.color}`;
  const padded = logo.onLight ? "bg-white" : "";
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded ${padded}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`block object-contain ${logo.onLight ? "h-3.5 w-3.5" : "h-4 w-4"}`}
      />
    </span>
  );
}
