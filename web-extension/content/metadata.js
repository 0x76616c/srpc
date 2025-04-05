function setupMetadataListener() {
  window.__lastMetadata = null;
  window.__lastTitle = null;
  window.__lastPlaybackState = null;
  window.__lastPosition = null;

  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      event.data.type !== '__SOUNDCLOUD_RPC_METADATA'
    )
      return;

    const metadata = event.data.metadata;
    if (!metadata) return;

    window.__lastMetadata = metadata;

    // Track change detection - triggers full metadata update
    if (metadata.title !== window.__lastTitle) {
      window.__lastTitle = metadata.title;
      window.__lastPlaybackState = null;
      window.__lastPosition = null;
      metadata.currentTime = 0;

      if (metadata.artwork) {
        consoleCard(metadata.title, metadata.artist, metadata.artwork);
      }

      chrome.runtime?.sendMessage?.({
        type: 'UPDATE_METADATA',
        metadata,
      });
    }

    // Only send updates when position changes significantly (seeking/jumping)
    if (window.__lastPosition !== null) {
      const expectedPosition =
        window.__lastPosition + (metadata.paused === 'paused' ? 0 : 1);
      const actualPosition = Math.floor(metadata.currentTime);
      if (Math.abs(actualPosition - expectedPosition) > 1) {
        console.log(
          `%c[SRPC] Position changed to ${actualPosition}s`,
          'color: orange; font-weight: bold;'
        );
        chrome.runtime?.sendMessage?.({
          type: 'UPDATE_METADATA',
          metadata,
        });
      }
    }
    window.__lastPosition = Math.floor(metadata.currentTime);

    // Send update on play/pause state changes
    if (metadata.paused !== window.__lastPlaybackState) {
      window.__lastPlaybackState = metadata.paused;
      const t = metadata.currentTime.toFixed(1);
      const d = metadata.duration;

      console.log(
        `%c[SRPC] ${metadata.paused === 'paused' ? 'Paused' : 'Playing'} at ${t}s / ${d}s`,
        'color: orange; font-weight: bold;'
      );

      chrome.runtime?.sendMessage?.({
        type: 'UPDATE_METADATA',
        metadata,
      });
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_METADATA_LIVE') {
      sendResponse(window.__lastMetadata || null);
    }
  });
}
