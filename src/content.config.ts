import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";
export const PORTFOLIO_PATH = "src/data/portfolio";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

const portfolio = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${PORTFOLIO_PATH}` }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      type: z.enum(["side", "work"]),
      status: z.enum(["in-progress", "completed", "paused"]).optional(),
      period: z.string(), // "2026-05" or "2024-03 ~ 2025-12"
      role: z.string().optional(),
      company: z.string().optional(), // "이전 직장" by convention for work entries
      techStack: z.array(z.string()).default([]),
      description: z.string(),
      cover: z.string().optional(), // public/ 절대 경로 (예: /assets/portfolio/<slug>/cover.png)
      relatedPosts: z.array(z.string()).default([]), // blog slugs
      responsibilities: z.array(z.string()).default([]),
      outcomes: z.array(z.string()).default([]),
      links: z
        .object({
          github: z.string().optional(),
          demo: z.string().optional(),
        })
        .optional(),
      order: z.number().default(0), // higher = appears first within a section
    }),
});

export const collections = { blog, portfolio };
