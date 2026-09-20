/* ==========================================================================
   HYPERALLOY - script.js
   - Builds the navbar + mobile tab bar on app pages (body[data-page])
   - Wallet connect (uses MetaMask style wallets, falls back to demo mode)
   - Deposit and withdraw form maths (mock numbers, no contract calls yet)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Config: change these when you wire real data ---------- */
  var CONFIG = {
    logo: 'assets/20260824_024823.png',
    networkName: 'Arbitrum Sepolia',
    chainIdHex: '0x66eee',            // 421614
    mockAddress: '0x71...A42F',
    walletKey: 'hyperalloy.wallet',
    halloyBalance: 248,
    totalSupply: 48920,
    mrealShare: 0.684,                // 1 HALLOY = 0.684 mREAL
    mgoldShare: 0.316                 // 1 HALLOY = 0.316 mGOLD
  };

  var PAGES = [
    { key: 'overview', label: 'Overview', href: 'overview.html', icon: 'home' },
    { key: 'deposit',  label: 'Deposit',  href: 'deposit.html',  icon: 'download' },
    { key: 'basket',   label: 'Basket',   href: 'basket.html',   icon: 'layers' },
    { key: 'withdraw', label: 'Withdraw', href: 'withdraw.html', icon: 'upload' }
  ];

  /* ---------- Small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function fmt(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseAmount(v) {
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function icon(name) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2800);
  }

  /* ---------- Icon sprite ---------- */
  function sym(id, body) {
    return '<symbol id="i-' + id + '" viewBox="0 0 24 24">' + body + '</symbol>';
  }

  function injectSprite() {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      sym('home', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>') +
      sym('download', '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>') +
      sym('upload', '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 21h16"/>') +
      sym('layers', '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>') +
      sym('dots', '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g>') +
      sym('building', '<path d="M5 21V4l8-2v19"/><path d="M13 9l6 2v10"/><path d="M3 21h18"/><path d="M8 8h2M8 12h2M8 16h2"/>') +
      sym('gold', '<path d="M3 19l2-5h8l2 5z"/><path d="M9 14l2-5h8l2 5"/>') +
      sym('lock', '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') +
      sym('check', '<path d="M20 6L9 17l-5-5"/>') +
      sym('copy', '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>') +
      sym('info', '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>') +
      sym('network', '<path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z"/><path d="M9 15l3-6 3 6M10 13h4"/>') +
      sym('arrow', '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>') +
      '</defs></svg>';
    var wrap = document.createElement('div');
    wrap.innerHTML = svg;
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  /* ---------- Wallet ---------- */
  function shorten(a) {
    return a.length > 14 ? a.slice(0, 6) + '...' + a.slice(-4) : a;
  }

  function getWallet() {
    try { return localStorage.getItem(CONFIG.walletKey) || CONFIG.mockAddress; }
    catch (e) { return CONFIG.mockAddress; }
  }

  function setWallet(addr) {
    try { localStorage.setItem(CONFIG.walletKey, addr); } catch (e) {}
  }

  function connectWallet() {
    if (!window.ethereum) {
      setWallet(CONFIG.mockAddress);
      toast('No wallet found. Continuing in demo mode.');
      return Promise.resolve(CONFIG.mockAddress);
    }
    return window.ethereum.request({ method: 'eth_requestAccounts' }).then(function (accounts) {
      var addr = accounts[0];
      setWallet(addr);
      return window.ethereum
        .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CONFIG.chainIdHex }] })
        .catch(function () {})
        .then(function () { return addr; });
    });
  }

  /* ---------- App shell: navbar ---------- */
  function buildHeader(active) {
    var header = $('#app-header');
    if (!header) return;

    var links = PAGES.map(function (p) {
      var on = p.key === active;
      return '<a class="navbar-link' + (on ? ' is-active' : '') + '" href="' + p.href + '"' +
        (on ? ' aria-current="page"' : '') + '>' + p.label + '</a>';
    }).join('');

    var addr = getWallet();

    header.innerHTML =
      '<div class="navbar-inner">' +
        '<div class="navbar-left">' +
          '<a class="navbar-logo" href="index.html" aria-label="Hyperalloy home">' +
            '<img class="navbar-logo-mark" src="' + CONFIG.logo + '" alt="" width="32" height="32">' +
            '<span class="navbar-logo-text">HYPERALLOY</span>' +
          '</a>' +
        '</div>' +
        '<div class="navbar-right">' +
          '<nav class="navbar-links" aria-label="Primary">' + links + '</nav>' +
          '<button class="wallet-badge" type="button" data-copy="' + addr + '" aria-label="Copy wallet address">' +
            '<span class="wallet-network"><i class="wallet-badge-dot"></i>' + CONFIG.networkName + '</span>' +
            '<span class="wallet-address">' + shorten(addr) + '</span>' +
            icon('copy') +
          '</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- App shell: mobile tab bar ---------- */
  function buildTabbar(active) {
    var tabs = PAGES.map(function (p) {
      var on = p.key === active;
      return '<a class="tab' + (on ? ' is-active' : '') + '" href="' + p.href + '"' +
        (on ? ' aria-current="page"' : '') + '>' + icon(p.icon) + '<span>' + p.label + '</span></a>';
    }).join('');
    tabs += '<button class="tab" type="button" id="more-btn" aria-expanded="false" aria-controls="more-sheet">' +
      icon('dots') + '<span>More</span></button>';

    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', 'Mobile');
    nav.innerHTML = tabs;
    document.body.appendChild(nav);

    var sheet = document.createElement('div');
    sheet.className = 'more-sheet';
    sheet.id = 'more-sheet';
    sheet.hidden = true;
    sheet.innerHTML = '<a href="index.html">Home</a><a href="#docs">Docs</a><a href="#github">GitHub</a>';
    document.body.appendChild(sheet);

    var btn = $('#more-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      sheet.hidden = !sheet.hidden;
      btn.setAttribute('aria-expanded', String(!sheet.hidden));
    });
    document.addEventListener('click', function () {
      if (!sheet.hidden) {
        sheet.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Copy buttons ---------- */
  function initCopy() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!el) return;
      var text = el.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('Copied'); },
          function () { toast('Could not copy'); }
        );
      } else {
        toast('Copy is not supported here');
      }
    });
  }

  /* ---------- Amount inputs (shared by deposit + withdraw) ---------- */
  function bindAmountInputs(onChange) {
    $$('.amount-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var v = input.value.replace(/[^0-9.]/g, '');
        var dot = v.indexOf('.');
        if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
        if (v !== input.value) input.value = v;
        onChange();
      });
      input.addEventListener('blur', function () {
        var n = parseAmount(input.value);
        input.value = n ? n.toFixed(2) : '';
        onChange();
      });
    });

    $$('[data-max-for]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-max-for'));
        if (!input) return;
        input.value = Number(input.getAttribute('data-max')).toFixed(2);
        onChange();
      });
    });
  }

  function setError(id, on) {
    var field = document.getElementById('field-' + id);
    var msg = document.getElementById('err-' + id);
    if (field) field.classList.toggle('has-error', on);
    if (msg) msg.hidden = !on;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ---------- Deposit page ---------- */
  function initDeposit() {
    var reInput = $('#in-mreal');
    var goInput = $('#in-mgold');
    var btn = $('#deposit-btn');
    if (!reInput || !goInput || !btn) return;

    function update() {
      var a = parseAmount(reInput.value);
      var b = parseAmount(goInput.value);
      var overA = a > Number(reInput.getAttribute('data-max'));
      var overB = b > Number(goInput.getAttribute('data-max'));

      setError('mreal', overA);
      setError('mgold', overB);

      setText('sum-mreal', fmt(a));
      setText('sum-mgold', fmt(b));
      // Placeholder pricing: 1 token unit = 1 HALLOY. Replace with the vault's real quote.
      setText('sum-halloy', fmt(a + b));

      btn.disabled = overA || overB || (a + b) === 0;
    }

    bindAmountInputs(update);
    btn.addEventListener('click', function () {
      toast('Prototype only. Deposit contract calls are not connected yet.');
    });
    update();
  }

  /* ---------- Withdraw page ---------- */
  function initWithdraw() {
    var input = $('#in-halloy');
    var btn = $('#withdraw-btn');
    if (!input || !btn) return;

    function update() {
      var amt = parseAmount(input.value);
      var over = amt > CONFIG.halloyBalance;
      var used = over ? 0 : amt;
      var remaining = CONFIG.halloyBalance - used;

      setError('halloy', over);
      setText('out-mreal', fmt(used * CONFIG.mrealShare));
      setText('out-mgold', fmt(used * CONFIG.mgoldShare));
      setText('rem-halloy', fmt(remaining));
      setText('rem-own', (remaining / CONFIG.totalSupply * 100).toFixed(2) + '%');

      btn.disabled = over || amt === 0;
    }

    bindAmountInputs(update);
    btn.addEventListener('click', function () {
      toast('Prototype only. Withdraw contract calls are not connected yet.');
    });
    update();
  }

  /* ---------- Landing page (index.html) ---------- */
  function initLanding() {
    var navbar = $('#navbar');
    var toggle = $('#nav-toggle');
    if (navbar && toggle) {
      toggle.addEventListener('click', function () {
        var open = navbar.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('.navbar-link').forEach(function (link) {
        link.addEventListener('click', function () {
          navbar.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    $$('#connect-wallet, #connect-wallet-hero, [data-connect]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        connectWallet().then(function () {
          setTimeout(function () { window.location.href = 'overview.html'; }, window.ethereum ? 0 : 900);
        }).catch(function () {
          toast('Wallet connection was cancelled.');
        });
      });
    });
  }

  /* ---------- Init ---------- */
  injectSprite();
  initCopy();

  var page = document.body.getAttribute('data-page');
  if (page) {
    buildHeader(page);
    buildTabbar(page);
    initDeposit();
    initWithdraw();
  } else {
    initLanding();
  }
})();