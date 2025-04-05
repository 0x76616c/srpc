function injectHook() {
  const script = document.createElement('script');
  script.textContent = `(${pageScript.toString()})();`;
  document.documentElement.prepend(script);
}

function pageScript() {
  let lastKnownTime = 0;
  let lastValidUpdate = 0;
  let audioContexts = [];
  window.__soundcloud_audio_contexts = audioContexts;

  const OriginalContext = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...args) {
    const ctx = new OriginalContext(...args);
    audioContexts.push(ctx);
    console.log(
      '%c[SRPC] Hooked AudioContext:',
      'color: green; font-weight: bold;',
      ctx
    );
    return ctx;
  };
  window.webkitAudioContext = window.AudioContext;

  const getMetadata = () => {
    const metadata = navigator.mediaSession?.metadata;
    const duration = parseInt(
      document
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuemax')
    );
    const currentTime =
      parseFloat(
        document
          .querySelector('[role="progressbar"]')
          ?.getAttribute('aria-valuenow')
      ) || 0;
    const playbackState = navigator.mediaSession?.playbackState;

    if (!metadata || !duration) return null;

    return {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artwork: metadata.artwork?.[0]?.src || null,
      currentTime,
      duration,
      paused: playbackState,
    };
  };

  console.log('[SRPC] pageScript injected and running');

  setInterval(() => {
    const metadata = getMetadata();
    if (metadata) {
      window.postMessage({ type: '__SOUNDCLOUD_RPC_METADATA', metadata }, '*');
    }
  }, 1000);
}
