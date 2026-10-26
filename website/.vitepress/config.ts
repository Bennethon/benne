import { defineConfig } from 'vitepress';

const repo = 'https://github.com/Bennethon/benne';
const siteUrl = 'https://benne.games';
const socialDescription = 'Make point-and-click adventure games in TypeScript, in VS Code.';
const socialCardAlt =
  'BENNE: Beautiful Engine for Noble Narrative Experiences. Point-and-click adventures in TypeScript, in VS Code. A beige CRT monitor shows a PLAY screen.';

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
    // Link previews. Open Graph covers Discord, Facebook, LinkedIn, Slack, Bluesky, Mastodon and
    // the messengers; X reads it too but needs twitter:card for the large card, which Discord also
    // checks before showing the image full width. The card is rendered from social-card/card.html.
    ['meta', { name: 'theme-color', content: '#3dff6e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'BENNE' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/images/social-card.png` }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: socialCardAlt }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/images/social-card.png` }],
    ['meta', { name: 'twitter:image:alt', content: socialCardAlt }],
  ],
  // Each page's own title, description and address in its link preview.
  transformHead({ pageData }) {
    const home = pageData.relativePath === 'index.md';
    const title = home ? 'BENNE' : `${pageData.title} | BENNE`;
    const description = pageData.frontmatter.description ?? socialDescription;
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    return [
      ['meta', { property: 'og:title', content: title }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { property: 'og:url', content: `${siteUrl}/${path}` }],
    ];
  },
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
