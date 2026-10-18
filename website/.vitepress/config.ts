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
      { text: 'About', link: '/about/about-benne', activeMatch: '/about/' },
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
          { text: 'BENNE Editor', link: '/guide/benne-editor' },
          { text: 'Verbs', link: '/guide/verbs' },
          { text: 'Puzzle dependency charts', link: '/guide/puzzle-dependency-charts' },
        ],
      },
      {
        text: 'Creating content',
        items: [
          { text: 'Creating a room', link: '/guide/creating-a-room' },
          { text: 'Creating a character', link: '/guide/creating-a-character' },
          { text: 'Creating an inventory item', link: '/guide/creating-an-inventory-item' },
          { text: 'Creating a dialog', link: '/guide/creating-a-dialog' },
          { text: 'Creating a GUI', link: '/guide/creating-a-gui' },
        ],
      },
      {
        text: 'Scripting and settings',
        items: [
          { text: 'BenneScript', link: '/guide/bennescript' },
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
      {
        text: 'About',
        items: [
          { text: 'About BENNE', link: '/about/about-benne' },
          { text: 'Roadmap', link: '/about/roadmap' },
          { text: 'Acknowledgements', link: '/about/acknowledgements' },
          { text: 'License', link: '/about/license' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repo }],
    footer: {
      message: 'BENNE is MIT licensed.',
      copyright: '© 2026 Bennethon',
    },
  },
});
