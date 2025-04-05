// Utility for creating gradient text in console
function gradientLog(title, link, version) {
  const colors = ['#5bcffb', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcffb'];

  function getGradientSteps(start, end, steps) {
    const s = parseInt(start.slice(1), 16),
      e = parseInt(end.slice(1), 16);
    const sr = (s >> 16) & 255,
      sg = (s >> 8) & 255,
      sb = s & 255;
    const er = (e >> 16) & 255,
      eg = (e >> 8) & 255,
      eb = e & 255;
    const g = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(sr + (er - sr) * t);
      const g1 = Math.round(sg + (eg - sg) * t);
      const b = Math.round(sb + (eb - sb) * t);
      g.push(`rgb(${r},${g1},${b})`);
    }
    return g;
  }

  function buildFullGradient(text) {
    const g = [];
    for (let i = 0; i < colors.length - 1; i++) {
      g.push(
        ...getGradientSteps(
          colors[i],
          colors[i + 1],
          Math.ceil(text.length / (colors.length - 1))
        )
      );
    }
    return g.slice(0, text.length);
  }

  const gradient = buildFullGradient(title);
  const styles = [];
  const parts = title.split('').map((c, i) => {
    styles.push(`color: ${gradient[i]}; font-weight: bold`);
    return '%c' + c;
  });

  console.log(parts.join(''), ...styles);
  console.log(
    `%c${link} %c(${version})`,
    'color: #999; font-style: italic;',
    'color: #aaa;'
  );
}

// Create visual preview of current track in console
function consoleCard(title, artist, artworkUrl) {
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

  if (isFirefox) {
    console.log(
      `%c🎵 ${title}\n👤 ${artist}`,
      [
        `color: white`,
        `padding: 6px 10px`,
        `border-radius: 6px`,
        `font-size: 14px`,
        `font-family: sans-serif`,
        `font-weight: bold`,
      ].join(';')
    );
    return;
  }

  const width = 160,
    height = 100;
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');

      const cardStyle = [
        `font-size: 1px`,
        `padding: ${height}px ${width}px`,
        `background: url("${dataURL}") no-repeat center`,
        `background-size: cover`,
        `border-radius: 5px`,
        `line-height: ${height}px`,
        `color: transparent`,
      ].join(';');

      const textStyle = [
        `color: white`,
        `font-weight: bold`,
        `font-size: 12px`,
        `font-family: sans-serif`,
        `background: rgba(0, 0, 0, 0.6)`,
        `padding: 4px 8px`,
        `border-radius: 4px`,
        `margin-top: 4px`,
      ].join(';');

      console.log('%c ', cardStyle);
      console.log(`%c🎵 ${title}\n👤 ${artist}`, textStyle);
    } catch (err) {
      console.warn('[SRPC] Canvas conversion failed:', err);
      console.log(`🎵 ${title} — 👤 ${artist}`);
    }
  };

  img.onerror = () => {
    console.warn('[SRPC] Failed to load artwork:', artworkUrl);
    console.log(`🎵 ${title} — 👤 ${artist}`);
  };

  img.src = artworkUrl;
}
