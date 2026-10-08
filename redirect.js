// Tijdelijke doorverwijzing van het oude adres naar wikidave.github.io/Haven-Werkuren.
// Neemt de gegevens van de app mee in de link, achter # (gaat niet over het internet); de nieuwe pagina
// zet ze over als daar nog niets staat. Zelfde formaat als packMove in app.js.
(async () => {
  const NEW_HOME = 'https://wikidave.github.io/Haven-Werkuren/';
  const raw = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('haven-werkuren.')) raw[k] = localStorage.getItem(k);
    }
  } catch { /* geen opslag */ }
  let target = NEW_HOME;
  try {
    if (Object.keys(raw).length) {
      let bytes = new TextEncoder().encode(JSON.stringify(raw));
      let tag = 'r';
      if (typeof CompressionStream === 'function') {
        bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
        tag = 'g';
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const packed = `${tag}.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
      if (packed.length < 1500000) target = `${NEW_HOME}#verhuis=${packed}`;
    }
  } catch { /* zonder gegevens doorsturen */ }
  location.replace(target);
})();
