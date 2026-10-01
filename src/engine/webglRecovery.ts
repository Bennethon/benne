import type Phaser from 'phaser';

/** HTML remains readable even when the game canvas cannot render. */
export function installWebglRecovery(parent: HTMLElement) {
  const overlay = document.createElement('section');
  overlay.className = 'graphics-notice';
  overlay.hidden = true;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'graphics-notice-title');
  const panel = document.createElement('div');
  const title = document.createElement('h1');
  title.id = 'graphics-notice-title';
  const message = document.createElement('p');
  message.setAttribute('aria-live', 'polite');
  const warning = document.createElement('p');
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.textContent = 'Restart game';
  restart.addEventListener('click', () => window.location.reload());
  panel.append(title, message, warning, restart);
  overlay.append(panel);
  parent.append(overlay);

  let game: Phaser.Game | undefined;
  let renderer: Phaser.Renderer.WebGL.WebGLRenderer | undefined;
  let lost = false;
  let fatal = false;
  let pausedByUs = false;
  let inputWasEnabled = false;
  let pausedSounds: Phaser.Sound.BaseSound[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previousFocus: HTMLElement | null = null;

  function show(heading: string, text: string, inProgress: boolean) {
    title.textContent = heading;
    message.textContent = text;
    warning.textContent = inProgress
      ? 'Restarting starts the game again. Unsaved progress will be lost; saved games are kept.'
      : 'Try restarting the game. If this keeps happening, restart your browser or app, check graphics acceleration, or try another browser.';
    if (overlay.hidden) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      overlay.hidden = false;
      parent.querySelector('canvas')?.setAttribute('aria-hidden', 'true');
      restart.focus();
    }
  }

  function stopGameplay() {
    if (!game) return;
    pausedByUs = !game.isPaused;
    game.pause();
    inputWasEnabled = game.input.enabled;
    game.input.enabled = false;
    pausedSounds = game.sound.getAll('').filter(sound => sound.isPlaying);
    for (const sound of pausedSounds) sound.pause();
  }

  function onLost() {
    if (lost || fatal) return;
    lost = true;
    stopGameplay();
    show('Graphics interrupted', 'The graphics connection was lost. The game is paused while we wait for it to recover.', true);
    timer = setTimeout(() => {
      show('Graphics haven’t recovered yet', 'We’re still waiting for your browser or graphics driver. You can keep waiting, or restart the game.', true);
    }, 15000);
  }

  function onRestored() {
    // Phaser emits this after rebuilding its GL wrappers. Let other restore listeners finish.
    queueMicrotask(() => {
      if (!lost || fatal || renderer?.contextLost || !game) return;
      clearTimeout(timer);
      lost = false;
      for (const sound of pausedSounds) {
        if (game.sound.getAll('').includes(sound) && sound.isPaused) sound.resume();
      }
      pausedSounds = [];
      game.input.enabled = inputWasEnabled;
      if (pausedByUs) game.resume();
      overlay.hidden = true;
      game.canvas.removeAttribute('aria-hidden');
      previousFocus?.focus();
    });
  }

  function reportError(error: unknown): boolean {
    const text = error instanceof Error ? error.message : String(error);
    if (!lost && !/webgl|web gl|graphics context/i.test(text)) return false;
    console.error('[BENNE] Graphics failure:', error);
    fatal = true;
    clearTimeout(timer);
    if (!lost) stopGameplay();
    show('Graphics unavailable', lost
      ? 'The game couldn’t restore its graphics. Please restart the game. If this repeats, restart your browser or try another browser.'
      : 'The game couldn’t start WebGL, the graphics feature it needs to run.', lost);
    return true;
  }

  const onError = (event: ErrorEvent) => { reportError(event.error ?? event.message); };
  const onRejection = (event: PromiseRejectionEvent) => { reportError(event.reason); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  function attach(activeGame: Phaser.Game) {
    game = activeGame;
    const bind = () => {
      renderer = activeGame.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      renderer.on('losewebgl', onLost);
      renderer.on('restorewebgl', onRestored);
    };
    if (activeGame.renderer) bind();
    else activeGame.events.once('boot', bind);
    activeGame.events.once('destroy', () => {
      clearTimeout(timer);
      activeGame.events.off('boot', bind);
      renderer?.off('losewebgl', onLost);
      renderer?.off('restorewebgl', onRestored);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      overlay.remove();
    });
  }

  return { attach, reportError };
}
