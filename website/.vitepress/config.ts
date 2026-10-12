import { defineConfig } from 'vitepress';

const repo = 'https://github.com/Bennethon/benne';

export default defineConfig({
  title: 'BENNE',
  description: 'A web-based engine and VS Code editor for point-and-click adventure games.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    // GitHub's heading anchors (`Verbs: verbs.x` → `verbs-verbsx`), so links in the docs work both
    // on GitHub and here.
    anchor: {
      slugify: (s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s/g, '-'),
    },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'preload', href: '/fonts/sysfont.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }],
    ['link', { rel: 'preload', href: '/fonts/ChicagoFLF.ttf', as: 'font', type: 'font/ttf', crossorigin: '' }],
    ['meta', { property: 'og:title', content: 'BENNE' }],
    ['meta', { property: 'og:description', content: 'Make point-and-click adventure games in TypeScript, in VS Code.' }],
  ],
  themeConfig: {
    logo: { src: '/logo.svg', alt: '' },
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'API Reference', link: '/reference/bennescript-api', activeMatch: '/reference/' },
      { text: 'Releases', link: `${repo}/releases` },
    ],
    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation and new game setup', link: '/guide/installation-and-new-game-setup' },
          { text: 'Core concepts', link: '/guide/core-concepts' },
        ],
      },
      {
        text: 'Building games',
        items: [
          { text: 'BenneScript', link: '/guide/bennescript' },
          { text: 'BENNE Editor', link: '/guide/benne-editor' },
          { text: 'Game configuration', link: '/guide/game-configuration' },
          { text: 'Sound, voice and video', link: '/guide/sound-voice-and-video' },
        ],
      },
      {
        text: 'Shipping',
        items: [
          { text: 'Publishing games', link: '/guide/publishing-games' },
          { text: 'Updating BENNE', link: '/guide/updating-benne' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'BenneScript API', link: '/reference/bennescript-api' }],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: {
      // The API reference page only includes docs/bennescript-api.md, so edits go to that file.
      // VitePress ships this function to the browser on its own, so it can't use `repo`.
      pattern: ({ filePath }) =>
        filePath === 'reference/bennescript-api.md'
          ? 'https://github.com/Bennethon/benne/edit/master/docs/bennescript-api.md'
          : `https://github.com/Bennethon/benne/edit/master/website/${filePath}`,
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'BENNE is MIT licensed. Point, click, adventure.',
      copyright: '© 2026 Bennethon',
    },
  },
});
