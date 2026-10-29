// Throwaway spike bookmarklet (spec §21 S3/S4). build.mjs replaces __MODE__ with 'capture' or 'count',
// strips whole-line comments and collapses whitespace. Keep: semicolons on every statement,
// (the output is percent-encoded, so quotes are safe).
(function () {
  var MODE = '__MODE__';
  var old = document.getElementById('bookmark-spike-overlay');
  if (old) { old.remove(); }
  function show(lines, manualText) {
    var box = document.createElement('div');
    box.id = 'bookmark-spike-overlay';
    box.setAttribute('role', 'dialog');
    box.style.cssText = 'position:fixed;top:8px;left:8px;right:8px;z-index:2147483647;background:#fff;color:#000;border:3px solid #000;padding:12px;font:16px sans-serif;max-height:80vh;overflow:auto';
    lines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      p.style.margin = '0 0 8px';
      box.appendChild(p);
    });
    if (manualText) {
      var area = document.createElement('textarea');
      area.value = manualText;
      area.readOnly = true;
      area.style.cssText = 'width:100%;height:6em;font:16px sans-serif';
      box.appendChild(area);
      area.focus();
      area.select();
    }
    var close = document.createElement('button');
    close.textContent = 'Close';
    close.style.cssText = 'min-height:44px;min-width:44px;margin-top:8px';
    close.onclick = function () { box.remove(); };
    box.appendChild(close);
    document.body.appendChild(box);
  }
  if (MODE === 'count') {
    var heading = document.querySelector('h2.heading') || document.querySelector('h2') || document.querySelector('h1');
    show([
      'Blurbs (li.blurb): ' + document.querySelectorAll('li.blurb').length,
      'Heading: ' + (heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '(none found)'),
      'Path: ' + location.pathname + location.search,
      'Tab title: ' + document.title
    ], null);
    return;
  }
  var titleEl = document.querySelector('h2.title.heading');
  var title = titleEl ? titleEl.textContent.trim() : '';
  if (!title) {
    show(['No work title found. Open a work page (archiveofourown.org/works/<id>) and try again.'], null);
    return;
  }
  var base = ['Bookmarklet ran. Title read: ' + title];
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    show(base.concat(['Clipboard: API not available. Copy the text below by hand.']), title);
    return;
  }
  navigator.clipboard.writeText(title).then(
    function () { show(base.concat(['Clipboard: WRITTEN. Now paste somewhere to confirm it holds the title.']), null); },
    function (err) { show(base.concat(['Clipboard: FAILED (' + (err && err.name ? err.name : 'unknown') + '). Copy the text below by hand.']), title); }
  );
})();
