import '@fontsource-variable/fraunces/full.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';
import { loadCore } from './data.js';
import { buildPlaceIndex } from './claim/parse.js';
import { renderLanding } from './landing/landing.js';
import { startTool } from './tool/tool.js';
import { NEWS } from './content/news.js';

const app = document.getElementById('app');
let cleanup = null;

loadCore()
  .then((core) => {
    const ctx = { ...core, index: buildPlaceIndex(core.regions) };
    const show = () => {
      cleanup?.();
      cleanup = null;
      const parts = location.hash.replace(/^#\/?/, '').split('/');
      if (parts[0] === 'investigate') {
        document.title = 'Investigate · The Average Lies';
        document.body.dataset.view = 'tool';
        const news = parts[1] === 'news' ? NEWS.find((n) => n.id === parts[2]) : null;
        cleanup = startTool(app, { ...ctx, startWith: parts[1] === 'tour' ? { tour: true } : (parts[1] ?? '').startsWith('survey') ? { page: 'find' } : news ? { text: news.test, news } : null });
      } else {
        document.title = 'The Average Lies · Climate claims, checked against NASA data';
        document.body.dataset.view = 'landing';
        cleanup = renderLanding(app, ctx);
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', show);
    show();
  })
  .catch((err) => {
    app.innerHTML = `<p class="boot">Couldn’t load the NASA records (${String(err.message)}). Refresh to try again.</p>`;
  });
