import React, { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

/**
 * Remotion grabs frames as fast as Chrome will paint, so both web fonts have to
 * be in the document before the first capture. `document.fonts` is the only
 * honest signal, so we hold the render with delayRender() until it resolves.
 *
 * The faces are declared here (not in a .css file) so the bundler never tries to
 * resolve the woff2 as a module — staticFile() hands back a runtime URL.
 */
const FACES = `
@font-face {
  font-family: 'Archivo Black';
  src: url('${staticFile('fonts/archivo-black-latin-400-normal.woff2')}') format('woff2');
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Cormorant Garamond';
  src: url('${staticFile('fonts/cormorant-garamond-latin-600-italic.woff2')}') format('woff2');
  font-weight: 600;
  font-style: italic;
  font-display: block;
}
@font-face {
  font-family: 'Cormorant Garamond';
  src: url('${staticFile('fonts/cormorant-garamond-latin-500-italic.woff2')}') format('woff2');
  font-weight: 500;
  font-style: italic;
  font-display: block;
}
`;

export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading Archivo Black / Cormorant Garamond'));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          document.fonts.load('400 64px "Archivo Black"'),
          document.fonts.load('italic 600 40px "Cormorant Garamond"'),
          document.fonts.load('italic 500 40px "Cormorant Garamond"'),
        ]);
        if (!cancelled) {
          setDone(true);
          continueRender(handle);
        }
      } catch (e) {
        if (!cancelled) cancelRender(e as Error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, done]);

  return <style dangerouslySetInnerHTML={{ __html: FACES }} />;
};
