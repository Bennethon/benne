import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import BenneAcronym from './components/BenneAcronym.vue';
import DocShot from './components/DocShot.vue';
import HomeGame from './components/HomeGame.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BenneAcronym', BenneAcronym);
    app.component('DocShot', DocShot);
    app.component('HomeGame', HomeGame);
  },
} satisfies Theme;
