'use strict';
/* Jelly Dash — A text box and an info sheet drawn as real page elements.
   The browser's own prompt() is blocked by many hosts (and returns nothing), so anything that needs typing or pasting goes through here.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

const dlgEl = document.getElementById('dlg'), dlgCard = dlgEl.firstElementChild;
let dlgOpen = false, dlgClose = null;
function dlgHide() { dlgOpen = false; dlgEl.classList.remove('on'); dlgCard.textContent = ''; const f = dlgClose; dlgClose = null; if (f) f(); }
function dlgEl_(tag, props, ...kids) { const e = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; }
// Ask for text. cb(text) runs on OK (never on Cancel). opts: { multi, readonly, ok, hint, max }
function askText(title, initial, cb, opts = {}) {
  dlgCard.textContent = '';
  const field = opts.multi ? dlgEl_('textarea', { rows: 5, spellcheck: false }) : dlgEl_('input', { type: 'text', spellcheck: false, autocomplete: 'off', enterKeyHint: 'done' });
  field.value = initial || ''; field.readOnly = !!opts.readonly; if (opts.max) field.maxLength = opts.max; field.setAttribute('aria-label', title);
  if (opts.hint) field.placeholder = opts.hint;
  const done = ok => { const v = field.value; dlgHide(); if (ok && cb) cb(v); };
  const row = dlgEl_('div', { className: 'row' });
  if (!opts.readonly) row.append(dlgEl_('button', { type: 'button', textContent: 'Cancel', onclick: () => done(false) }));
  row.append(dlgEl_('button', { type: 'button', className: 'go', textContent: opts.ok || (opts.readonly ? 'Done' : 'OK'), onclick: () => done(true) }));
  dlgCard.append(dlgEl_('h2', { textContent: title }));
  if (opts.note) dlgCard.append(dlgEl_('p', { textContent: opts.note }));
  dlgCard.append(field, row);
  if (!opts.multi) field.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } });
  dlgEl.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
  dlgEl.onpointerdown = e => { if (e.target === dlgEl) done(false); };
  dlgOpen = true; dlgEl.classList.add('on'); release(null);
  setTimeout(() => { try { field.focus(); if (opts.readonly) field.select(); } catch (e) {} }, 30);
}
// Show a copyable block of text (used when the clipboard is refused).
function showCopy(title, text) { askText(title, text, null, { multi: true, readonly: true, note: 'Select all and copy it.' }); }
// Show read-only information (how to play, privacy).
function showInfo(title, body) {
  dlgCard.textContent = '';
  dlgCard.append(dlgEl_('h2', { textContent: title }), dlgEl_('p', { textContent: body }), dlgEl_('div', { className: 'row' }, dlgEl_('button', { type: 'button', className: 'go', textContent: 'Got it', onclick: () => dlgHide() })));
  dlgEl.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); dlgHide(); } };
  dlgEl.onpointerdown = e => { if (e.target === dlgEl) dlgHide(); };
  dlgOpen = true; dlgEl.classList.add('on'); release(null);
  setTimeout(() => { try { dlgCard.querySelector('button').focus(); } catch (e) {} }, 30);
}
const inDlg = e => !!(e.target && e.target.closest && e.target.closest('#dlg'));
