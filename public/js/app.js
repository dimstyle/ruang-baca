(() => {
  const PALETTE = ['#1A73E8', '#188038', '#E37400', '#D93025', '#9334E6', '#007B83', '#C5221F', '#5F6368'];
  const color = (k) => {
    let h = 0;
    for (const c of String(k ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const bar = document.getElementById('snackbar');
  const toast = (msg) => {
    if (!bar) return;
    bar.querySelector('[data-snackbar-text]').textContent = msg;
    bar.hidden = false;
    clearTimeout(bar._t);
    bar._t = setTimeout(() => (bar.hidden = true), 4000);
  };

  const flash = sessionStorage.getItem('rb_flash');
  if (flash) {
    sessionStorage.removeItem('rb_flash');
    toast(flash);
  }

  async function api(spec, body, retried = false) {
    const [method, url] = spec.trim().split(/\s+/);
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && !retried && !url.endsWith('/login')) {
      const r = await fetch('/api/auth/refresh_token', { method: 'POST', credentials: 'same-origin' });
      if (r.ok) return api(spec, body, true);
      sessionStorage.setItem('rb_flash', 'Sesi berakhir, silakan masuk kembali');
      location.href = '/login';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Terjadi kesalahan';
      throw new Error(msg);
    }
    return data;
  }

  function fillForm(container, values) {
    const form = container.tagName === 'FORM' ? container : container.querySelector('form');
    if (!form) return;
    form.reset();
    const err = form.querySelector('[data-error]');
    if (err) err.classList.add('hidden');
    if (!values) return;
    for (const [k, v] of Object.entries(values)) {
      const el = form.elements.namedItem(k);
      if (!el) continue;
      if (el instanceof RadioNodeList) el.value = String(v ?? '');
      else el.value = v ?? '';
    }
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest(
      '[data-toggle-sidebar],[data-toggle],[data-toggle-pw],[data-open],[data-close],[data-minimize],[data-confirm],[data-call],[data-snackbar-close],[data-close-detail],[data-cat-tab],[data-report-tab],[data-book]',
    );
    if (!btn) return;

    if (btn.hasAttribute('data-toggle-sidebar')) {
      document.body.classList.toggle('sidebar-collapsed');
    } else if (btn.hasAttribute('data-toggle')) {
      const t = document.querySelector(btn.dataset.toggle);
      if (t) t.hidden = !t.hidden;
    } else if (btn.hasAttribute('data-toggle-pw')) {
      const input = document.querySelector(btn.dataset.togglePw);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    } else if (btn.hasAttribute('data-snackbar-close')) {
      bar.hidden = true;
    } else if (btn.hasAttribute('data-close-detail')) {
      document.getElementById('book-detail').hidden = true;
    } else if (btn.hasAttribute('data-minimize')) {
      const c = btn.closest('.compose');
      c?.querySelectorAll('[data-body]').forEach((el) => (el.hidden = !el.hidden));
    } else if (btn.hasAttribute('data-close')) {
      const dlg = btn.closest('dialog');
      if (dlg) dlg.close();
      const cmp = btn.closest('.compose');
      if (cmp) cmp.hidden = true;
    } else if (btn.hasAttribute('data-open')) {
      const target = document.querySelector(btn.dataset.open);
      if (!target) return;
      const form = target.tagName === 'FORM' ? target : target.querySelector('form');
      if (btn.dataset.api && form) form.dataset.api = btn.dataset.api;
      if (btn.dataset.title) {
        const slot = target.querySelector('[data-title-slot]');
        if (slot) slot.textContent = btn.dataset.title;
      }
      fillForm(target, btn.dataset.fill ? JSON.parse(btn.dataset.fill) : null);
      if (target.tagName === 'DIALOG') target.showModal();
      else {
        target.hidden = false;
        target.querySelectorAll('[data-body]').forEach((el) => (el.hidden = false));
      }
    } else if (btn.hasAttribute('data-confirm')) {
      const dlg = document.getElementById('confirm-dialog');
      dlg.querySelector('[data-confirm-title]').textContent = btn.dataset.confirmTitle || 'Hapus data?';
      dlg.querySelector('[data-confirm-text]').textContent = btn.dataset.confirmText || '';
      const ok = dlg.querySelector('[data-confirm-ok]');
      ok.onclick = async () => {
        try {
          await api(btn.dataset.confirm, JSON.parse(btn.dataset.body || '{}'));
          sessionStorage.setItem('rb_flash', 'Data berhasil dihapus');
          location.reload();
        } catch (err) {
          dlg.close();
          toast(err.message);
        }
      };
      dlg.showModal();
    } else if (btn.hasAttribute('data-call')) {
      try {
        await api(btn.dataset.call);
        location.href = btn.dataset.redirect || '/login';
      } catch (err) {
        toast(err.message);
      }
    } else if (btn.hasAttribute('data-cat-tab')) {
      const cat = btn.dataset.catTab;
      btn.parentElement.querySelectorAll('[data-cat-tab]').forEach((t) => {
        const active = t === btn;
        t.classList.toggle('border-accent', active);
        t.classList.toggle('text-accent', active);
        t.classList.toggle('border-transparent', !active);
        t.classList.toggle('text-muted', !active);
      });
      document.querySelectorAll('[data-row]').forEach((r) => {
        r.hidden = Boolean(cat && r.dataset.cat !== cat);
      });
    } else if (btn.hasAttribute('data-report-tab')) {
      const which = btn.dataset.reportTab;
      btn.parentElement.querySelectorAll('[data-report-tab]').forEach((t) => {
        const active = t === btn;
        t.classList.toggle('border-accent', active);
        t.classList.toggle('text-accent', active);
        t.classList.toggle('border-transparent', !active);
        t.classList.toggle('text-muted', !active);
      });
      document.getElementById('tab-pinjam').hidden = which !== 'pinjam';
      document.getElementById('tab-kembali').hidden = which !== 'kembali';
    } else if (btn.hasAttribute('data-book')) {
      const b = JSON.parse(btn.dataset.book);
      const panel = document.getElementById('book-detail');
      if (!panel) return;
      panel.querySelector('[data-d-cat]').textContent = b.nama_kategori;
      panel.querySelector('[data-d-jenis]').textContent = b.jenis_buku;
      const tile = panel.querySelector('[data-d-tile]');
      tile.style.background = color(b.nama_kategori);
      tile.textContent = String(b.judul_buku || '?').charAt(0).toUpperCase();
      panel.querySelector('[data-d-judul]').textContent = b.judul_buku;
      panel.querySelector('[data-d-penulis]').textContent = b.penulis_buku;
      panel.querySelector('[data-d-penerbit]').textContent = b.penerbit;
      panel.querySelector('[data-d-rilis]').textContent = fmtDate(b.tanggal_rilis);
      panel.querySelector('[data-d-stok]').textContent = b.stok > 0 ? `Tersedia (${b.stok})` : 'Habis (0)';
      panel.querySelector('[data-d-sinopsis]').textContent = b.sinopsis;
      const pinjam = document.getElementById('btn-pinjam-detail');
      if (pinjam) {
        pinjam.disabled = b.stok <= 0;
        pinjam.title = b.stok <= 0 ? 'Stok habis' : '';
        pinjam.dataset.fill = JSON.stringify({
          book_id: b.id,
          tanggal_peminjaman: new Date().toISOString().slice(0, 10),
        });
      }
      const edit = document.getElementById('btn-edit-detail');
      if (edit) {
        edit.dataset.fill = JSON.stringify({
          buku_id: b.id,
          kategori_id: b.kategori_id,
          judul: b.judul_buku,
          penulis: b.penulis_buku,
          penerbit: b.penerbit,
          sinopsis: b.sinopsis,
          tanggal_rilis: b.tanggal_rilis ? new Date(b.tanggal_rilis).toISOString().slice(0, 10) : '',
          stok: b.stok,
        });
      }
      const del = document.getElementById('btn-del-detail');
      if (del) {
        del.dataset.confirm = 'DELETE /api/books/deletebook';
        del.dataset.body = JSON.stringify({ buku_id: b.id });
        del.dataset.confirmTitle = `Hapus buku '${b.judul_buku}'?`;
        del.dataset.confirmText = 'Buku akan dihapus permanen dari katalog.';
      }
      panel.hidden = false;
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.dataset?.api) return;
    e.preventDefault();
    const errEl = form.querySelector('[data-error]');
    if (errEl) errEl.classList.add('hidden');
    const body = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue;
      if (el.type === 'radio' && !el.checked) continue;
      if (el.value === '') continue;
      body[el.name] = el.hasAttribute('data-num') ? Number(el.value) : el.value;
    }
    try {
      await api(form.dataset.api, body);
      if (form.dataset.redirect) {
        location.href = form.dataset.redirect;
      } else {
        sessionStorage.setItem('rb_flash', form.dataset.success || 'Berhasil disimpan');
        location.reload();
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      } else toast(err.message);
    }
  });

  const search = document.getElementById('search');
  search?.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll('[data-row]').forEach((r) => {
      r.hidden = !r.textContent.toLowerCase().includes(q);
    });
  });

  const filterCat = document.querySelector('[data-filter-cat]');
  filterCat?.addEventListener('change', () => {
    const cat = filterCat.value;
    document.querySelectorAll('[data-row]').forEach((r) => {
      r.hidden = Boolean(cat && r.dataset.cat !== cat);
    });
  });

  const checkAll = document.querySelector('[data-check-all]');
  checkAll?.addEventListener('change', () => {
    document.querySelectorAll('[data-row] input[type="checkbox"]').forEach((c) => {
      c.checked = checkAll.checked;
    });
  });
})();
