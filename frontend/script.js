/* ==========================================================================
   HYPERALLOY - script.js
   - Builds the navbar + mobile tab bar on app pages (body[data-page])
   - Real wallet connect (window.ethereum), chain detection/switching
   - Live reads from RealEstateToken, GoldToken, HyperalloyVault via
     HyperalloyConfig (see config.js)
   - Deposit (approve + deposit) and withdraw flows with real transactions,
     pending/success/error states, and post-tx refresh
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  var CONFIG = {
    logo: 'assets/20260824_024823.png',
    networkName: 'Arbitrum Sepolia'
  };

  var PAGES = [
    { key: 'overview', label: 'Overview', href: 'overview.html', icon: 'home' },
    { key: 'deposit',  label: 'Deposit',  href: 'deposit.html',  icon: 'download' },
    { key: 'basket',   label: 'Basket',   href: 'basket.html',   icon: 'layers' },
    { key: 'withdraw', label: 'Withdraw', href: 'withdraw.html', icon: 'upload' }
  ];

  /* ---------- App state ---------- */
  var STATE = {
    address: null,   // connected wallet address, or null
    cache: null       // last loaded on-chain data snapshot
  };

  /* ---------- Small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function fmt(n) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmt4(n) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  function parseAmount(v) {
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function icon(name) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function shorten(a) {
    return a && a.length > 14 ? a.slice(0, 6) + '...' + a.slice(-4) : (a || '');
  }

  /* ---------- On-chain number helpers (ethers v6, 18 decimals everywhere) ---------- */
  function toNum(wei) {
    try { return Number(ethers.formatUnits(wei, 18)); }
    catch (e) { return 0; }
  }

  function safeParseUnits(n) {
    try { return ethers.parseUnits(String(n || 0), 18); }
    catch (e) { return 0n; }
  }

  // Replicates the vault's Solidity formula exactly:
  // tokenValue = (amount * token.assetValueUSD()) / token.totalSupply()
  function valueOf(amountWei, assetValueUSDWei, totalSupplyWei) {
    if (!totalSupplyWei || totalSupplyWei === 0n) return 0n;
    return (amountWei * assetValueUSDWei) / totalSupplyWei;
  }

  function describeError(err) {
    if (!err) return 'Something went wrong.';
    if (err.code === 'NO_WALLET') return err.message;
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') return 'Request was cancelled in your wallet.';
    if (err.shortMessage) return err.shortMessage;
    if (err.reason) return err.reason;
    if (err.message) return err.message;
    return 'Something went wrong.';
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

  /* ---------- Wallet: connect, chain switching, listeners ---------- */
  function ensureChain() {
    return window.ethereum.request({ method: 'eth_chainId' }).then(function (chainId) {
      if (chainId === HyperalloyConfig.CHAIN_ID_HEX) return;
      return window.ethereum
        .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: HyperalloyConfig.CHAIN_ID_HEX }] })
        .catch(function (switchErr) {
          if (switchErr && switchErr.code === 4902) {
            return window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: HyperalloyConfig.CHAIN_ID_HEX,
                chainName: 'Arbitrum Sepolia',
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [HyperalloyConfig.RPC_URL],
                blockExplorerUrls: [HyperalloyConfig.BLOCK_EXPLORER]
              }]
            });
          }
          throw switchErr;
        });
    });
  }

  function connectWallet() {
    if (!window.ethereum) {
      var err = new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
      err.code = 'NO_WALLET';
      return Promise.reject(err);
    }
    return window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(function (accounts) {
        STATE.address = accounts[0];
        return ensureChain();
      })
      .then(function () {
        var page = document.body.getAttribute('data-page');
        if (page) {
          buildHeader(page);
          return refresh();
        }
      })
      .then(function () { return STATE.address; });
  }

  function handleConnectClick() {
    connectWallet().catch(function (err) {
      console.error(err);
      toast(describeError(err));
    });
  }

  function silentReconnect() {
    if (!window.ethereum) return Promise.resolve();
    return window.ethereum.request({ method: 'eth_accounts' }).then(function (accounts) {
      if (accounts && accounts[0]) STATE.address = accounts[0];
    }).catch(function () {});
  }

  function bindWalletBadgeClick() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('#wallet-badge') : null;
      if (!btn || btn.hasAttribute('data-copy')) return;
      e.stopPropagation();
      handleConnectClick();
    });
  }

  function bindAccountAndChainListeners() {
    if (!window.ethereum) return;
    window.ethereum.on('accountsChanged', function (accounts) {
      STATE.address = accounts && accounts[0] ? accounts[0] : null;
      var page = document.body.getAttribute('data-page');
      if (page) {
        buildHeader(page);
        refresh();
      }
    });
    window.ethereum.on('chainChanged', function () {
      window.location.reload();
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

    var addr = STATE.address;
    var walletHtml = addr
      ? '<button class="wallet-badge" type="button" id="wallet-badge" data-copy="' + addr + '" aria-label="Copy wallet address">' +
          '<span class="wallet-network"><i class="wallet-badge-dot"></i>' + CONFIG.networkName + '</span>' +
          '<span class="wallet-address">' + shorten(addr) + '</span>' +
          icon('copy') +
        '</button>'
      : '<button class="wallet-badge" type="button" id="wallet-badge" aria-label="Connect wallet">' +
          '<span class="wallet-network"><i class="wallet-badge-dot"></i>' + CONFIG.networkName + '</span>' +
          '<span class="wallet-address">Connect Wallet</span>' +
        '</button>';

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
          walletHtml +
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
        input.value = Number(input.getAttribute('data-max') || 0).toFixed(2);
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

  function setStyleWidth(id, pct) {
    var el = document.getElementById(id);
    if (el) el.style.width = (isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0) + '%';
  }

  /* ---------- On-chain data loading ---------- */
  function loadData() {
    return HyperalloyConfig.getReadContracts().then(function (c) {
      var calls = [
        c.vault.totalSupply(),
        c.vault.getVaultHoldings(),
        c.realEstateToken.assetValueUSD(),
        c.realEstateToken.totalSupply(),
        c.goldToken.assetValueUSD(),
        c.goldToken.totalSupply()
      ];
      return Promise.all(calls).then(function (r) {
        var data = {
          haloyTotalSupply: r[0],
          vaultRealEstateHeld: r[1][0],
          vaultGoldHeld: r[1][1],
          realEstateAssetValueUSD: r[2],
          realEstateTotalSupply: r[3],
          goldAssetValueUSD: r[4],
          goldTotalSupply: r[5],
          haloyBalance: 0n,
          mrealBalance: 0n,
          mgoldBalance: 0n,
          mrealAllowance: 0n,
          mgoldAllowance: 0n
        };
        if (!STATE.address) return data;

        var addr = STATE.address;
        var vaultAddr = HyperalloyConfig.ADDRESSES.vault;
        var userCalls = [
          c.vault.balanceOf(addr),
          c.realEstateToken.balanceOf(addr),
          c.goldToken.balanceOf(addr),
          c.realEstateToken.allowance(addr, vaultAddr),
          c.goldToken.allowance(addr, vaultAddr)
        ];
        return Promise.all(userCalls).then(function (u) {
          data.haloyBalance = u[0];
          data.mrealBalance = u[1];
          data.mgoldBalance = u[2];
          data.mrealAllowance = u[3];
          data.mgoldAllowance = u[4];
          return data;
        });
      });
    });
  }

  function refresh() {
    return loadData().then(function (d) {
      STATE.cache = d;
      renderPage();
    }).catch(function (err) {
      console.error(err);
      toast('ERROR: ' + (err && err.message ? err.message : JSON.stringify(err)));
    });
  }

  function renderPage() {
    var page = document.body.getAttribute('data-page');
    var d = STATE.cache;
    if (!d) return;
    if (page === 'overview') renderOverview(d);
    else if (page === 'basket') renderBasket(d);
    else if (page === 'deposit') renderDeposit(d);
    else if (page === 'withdraw') renderWithdraw(d);
  }

  /* ---------- Overview page ---------- */
  function renderOverview(d) {
    var reValue = toNum(valueOf(d.vaultRealEstateHeld, d.realEstateAssetValueUSD, d.realEstateTotalSupply));
    var goldValue = toNum(valueOf(d.vaultGoldHeld, d.goldAssetValueUSD, d.goldTotalSupply));
    var totalValue = reValue + goldValue;
    var rePct = totalValue > 0 ? (reValue / totalValue) * 100 : 0;
    var goldPct = totalValue > 0 ? 100 - rePct : 0;

    var haloySupply = toNum(d.haloyTotalSupply);
    var haloyBalance = toNum(d.haloyBalance);
    var basketPct = haloySupply > 0 ? (haloyBalance / haloySupply) * 100 : 0;

    var userReShareWei = d.haloyTotalSupply > 0n ? (d.vaultRealEstateHeld * d.haloyBalance) / d.haloyTotalSupply : 0n;
    var userGoldShareWei = d.haloyTotalSupply > 0n ? (d.vaultGoldHeld * d.haloyBalance) / d.haloyTotalSupply : 0n;
    var userRe = toNum(userReShareWei);
    var userGold = toNum(userGoldShareWei);
    var userValue = haloySupply > 0 ? totalValue * (haloyBalance / haloySupply) : 0;

    setText('ov-portfolio-value', fmt(userValue));
    setText('ov-halloy-balance', fmt(haloyBalance));
    setText('ov-halloy-pct', basketPct.toFixed(2) + '%');
    setText('ov-tvl', fmt(totalValue));

    var bar = document.getElementById('ov-progress-bar');
    if (bar) bar.setAttribute('aria-label', 'Real Estate ' + rePct.toFixed(1) + ' percent, Gold ' + goldPct.toFixed(1) + ' percent');
    setStyleWidth('ov-bar-re', rePct);
    setStyleWidth('ov-bar-gold', goldPct);

    setText('ov-legend-re-pct', rePct.toFixed(1) + '%');
    setText('ov-legend-re-val', fmt(reValue));
    setText('ov-legend-gold-pct', goldPct.toFixed(1) + '%');
    setText('ov-legend-gold-val', fmt(goldValue));

    setText('ov-total-value', fmt(totalValue));
    setText('ov-halloy-supply', fmt(haloySupply));

    var reHoldings = toNum(d.vaultRealEstateHeld);
    var goldHoldings = toNum(d.vaultGoldHeld);
    setText('ov-table-re-alloc', rePct.toFixed(1) + '%');
    setText('ov-table-re-holdings', fmt(reHoldings));
    setText('ov-table-re-value', fmt(reValue));
    setText('ov-table-gold-alloc', goldPct.toFixed(1) + '%');
    setText('ov-table-gold-holdings', fmt(goldHoldings));
    setText('ov-table-gold-value', fmt(goldValue));
    setText('ov-table-total-holdings', fmt(reHoldings + goldHoldings));
    setText('ov-table-total-value', fmt(totalValue));

    setText('ov-position-balance', fmt(haloyBalance));
    setText('ov-position-pct', basketPct.toFixed(2) + '%');
    setStyleWidth('ov-position-meter', basketPct);
    setText('ov-position-re', fmt(userRe));
    setText('ov-position-re-pct', rePct.toFixed(1) + '%');
    setText('ov-position-gold', fmt(userGold));
    setText('ov-position-gold-pct', goldPct.toFixed(1) + '%');
  }

  /* ---------- Basket page ---------- */
  function renderBasket(d) {
    var reValue = toNum(valueOf(d.vaultRealEstateHeld, d.realEstateAssetValueUSD, d.realEstateTotalSupply));
    var goldValue = toNum(valueOf(d.vaultGoldHeld, d.goldAssetValueUSD, d.goldTotalSupply));
    var totalValue = reValue + goldValue;
    var rePct = totalValue > 0 ? (reValue / totalValue) * 100 : 0;
    var goldPct = totalValue > 0 ? 100 - rePct : 0;
    var reHoldings = toNum(d.vaultRealEstateHeld);
    var goldHoldings = toNum(d.vaultGoldHeld);

    var haloySupply = toNum(d.haloyTotalSupply);
    var haloyBalance = toNum(d.haloyBalance);
    var basketPct = haloySupply > 0 ? (haloyBalance / haloySupply) * 100 : 0;

    var userReShareWei = d.haloyTotalSupply > 0n ? (d.vaultRealEstateHeld * d.haloyBalance) / d.haloyTotalSupply : 0n;
    var userGoldShareWei = d.haloyTotalSupply > 0n ? (d.vaultGoldHeld * d.haloyBalance) / d.haloyTotalSupply : 0n;
    var userRe = toNum(userReShareWei);
    var userGold = toNum(userGoldShareWei);
    var userValue = haloySupply > 0 ? totalValue * (haloyBalance / haloySupply) : 0;

    setText('bk-total-value', fmt(totalValue));

    var bar = document.getElementById('bk-progress-bar');
    if (bar) bar.setAttribute('aria-label', 'Real Estate ' + rePct.toFixed(1) + ' percent, Gold ' + goldPct.toFixed(1) + ' percent');
    setStyleWidth('bk-bar-re', rePct);
    setStyleWidth('bk-bar-gold', goldPct);

    setText('bk-legend-re-pct', rePct.toFixed(1) + '%');
    setText('bk-legend-re-hold', fmt(reHoldings));
    setText('bk-legend-re-val', fmt(reValue));
    setText('bk-legend-gold-pct', goldPct.toFixed(1) + '%');
    setText('bk-legend-gold-hold', fmt(goldHoldings));
    setText('bk-legend-gold-val', fmt(goldValue));
    setText('bk-legend-total-hold', fmt(reHoldings + goldHoldings));
    setText('bk-legend-total-val', fmt(totalValue));

    setText('bk-position-balance', fmt(haloyBalance));
    setText('bk-position-pct', basketPct.toFixed(2) + '%');
    setStyleWidth('bk-position-meter', basketPct);
    setText('bk-position-value', fmt(userValue));
    setText('bk-claim-re', fmt(userRe));
    setText('bk-claim-re-pct', rePct.toFixed(1) + '%');
    setText('bk-claim-gold', fmt(userGold));
    setText('bk-claim-gold-pct', goldPct.toFixed(1) + '%');
  }

  /* ---------- Deposit page ---------- */
  function renderDeposit(d) {
    var mrealBal = toNum(d.mrealBalance);
    var mgoldBal = toNum(d.mgoldBalance);

    setText('dep-mreal-balance', fmt(mrealBal));
    setText('dep-mreal-available', fmt(mrealBal));
    setText('dep-mgold-balance', fmt(mgoldBal));
    setText('dep-mgold-available', fmt(mgoldBal));

    var reInput = document.getElementById('in-mreal');
    var goInput = document.getElementById('in-mgold');
    if (reInput) reInput.setAttribute('data-max', String(mrealBal));
    if (goInput) goInput.setAttribute('data-max', String(mgoldBal));

    var btn = document.getElementById('deposit-btn');
    if (btn && !btn.classList.contains('is-busy')) {
      btn.textContent = STATE.address ? 'Deposit Assets' : 'Connect Wallet';
    }

    updateDepositEstimate();
  }

  function updateDepositEstimate() {
    var d = STATE.cache;
    var reInput = document.getElementById('in-mreal');
    var goInput = document.getElementById('in-mgold');
    if (!reInput || !goInput) return;

    var reAmt = parseAmount(reInput.value);
    var goAmt = parseAmount(goInput.value);
    var overA = STATE.address ? reAmt > Number(reInput.getAttribute('data-max') || 0) : false;
    var overB = STATE.address ? goAmt > Number(goInput.getAttribute('data-max') || 0) : false;
    setError('mreal', overA);
    setError('mgold', overB);

    setText('sum-mreal', fmt(reAmt));
    setText('sum-mgold', fmt(goAmt));

    var reWei = safeParseUnits(reAmt);
    var goWei = safeParseUnits(goAmt);
    var haloyOut = 0;
    if (d) {
      var valueRE = valueOf(reWei, d.realEstateAssetValueUSD, d.realEstateTotalSupply);
      var valueGold = valueOf(goWei, d.goldAssetValueUSD, d.goldTotalSupply);
      haloyOut = toNum(valueRE + valueGold);
      updateApprovalStatus('mreal', reWei, d.mrealAllowance);
      updateApprovalStatus('mgold', goWei, d.mgoldAllowance);
    }
    setText('sum-halloy', fmt(haloyOut));

    var btn = document.getElementById('deposit-btn');
    if (btn && !btn.classList.contains('is-busy')) {
      btn.disabled = STATE.address ? (overA || overB || (reAmt + goAmt) === 0) : false;
    }
  }

  function updateApprovalStatus(tokenKey, amountWei, allowanceWei) {
    var el = document.getElementById('status-' + tokenKey);
    if (!el) return;
    if (!STATE.address) { el.innerHTML = ''; return; }
    var ok = amountWei <= 0n || allowanceWei >= amountWei;
    el.innerHTML = ok ? (icon('check') + 'Approved') : (icon('info') + 'Approval needed');
    el.classList.toggle('is-warn', !ok);
  }

  function bindDepositInputs() {
    bindAmountInputs(updateDepositEstimate);
    var btn = document.getElementById('deposit-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        if (!STATE.address) { handleConnectClick(); return; }
        doDeposit();
      });
    }
  }

  function setDepositBusy(busy) {
    var btn = document.getElementById('deposit-btn');
    if (!btn) return;
    btn.classList.toggle('is-busy', busy);
    btn.disabled = busy;
  }

  function setDepositTxStatus(message, isSuccess) {
    var el = document.getElementById('dep-tx-status');
    if (!el) return;
    if (!message) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = message;
    el.className = isSuccess === false ? 'field-error' : 'stat-note';
  }

  function doDeposit() {
    var reInput = document.getElementById('in-mreal');
    var goInput = document.getElementById('in-mgold');
    if (!reInput || !goInput || !STATE.cache) return;

    var reAmt = parseAmount(reInput.value);
    var goAmt = parseAmount(goInput.value);
    if (reAmt + goAmt === 0) return;

    var reWei = safeParseUnits(reAmt);
    var goWei = safeParseUnits(goAmt);
    var vaultAddr = HyperalloyConfig.ADDRESSES.vault;
    var mrealAllowance = STATE.cache.mrealAllowance;
    var mgoldAllowance = STATE.cache.mgoldAllowance;

    setDepositBusy(true);
    setDepositTxStatus('Preparing transaction…');

    HyperalloyConfig.getWriteContracts().then(function (wc) {
      var chain = Promise.resolve();

      if (reWei > 0n && mrealAllowance < reWei) {
        chain = chain.then(function () {
          setDepositTxStatus('Approving mREAL — confirm in your wallet…');
          return wc.realEstateToken.approve(vaultAddr, reWei).then(function (tx) {
            setDepositTxStatus('Approving mREAL — waiting for confirmation…');
            return tx.wait();
          });
        });
      }
      if (goWei > 0n && mgoldAllowance < goWei) {
        chain = chain.then(function () {
          setDepositTxStatus('Approving mGOLD — confirm in your wallet…');
          return wc.goldToken.approve(vaultAddr, goWei).then(function (tx) {
            setDepositTxStatus('Approving mGOLD — waiting for confirmation…');
            return tx.wait();
          });
        });
      }
      chain = chain.then(function () {
        setDepositTxStatus('Depositing — confirm in your wallet…');
        return wc.vault.deposit(reWei, goWei).then(function (tx) {
          setDepositTxStatus('Depositing — waiting for confirmation…');
          return tx.wait();
        });
      });

      return chain;
    }).then(function () {
      setDepositTxStatus('Deposit successful.', true);
      toast('Deposit complete.');
      reInput.value = '';
      goInput.value = '';
      return refresh();
    }).catch(function (err) {
      console.error(err);
      setDepositTxStatus(describeError(err), false);
      toast('Deposit failed.');
    }).then(function () {
      setDepositBusy(false);
    });
  }

  /* ---------- Withdraw page ---------- */
  function renderWithdraw(d) {
    var haloyBal = toNum(d.haloyBalance);
    setText('wd-halloy-available', fmt(haloyBal));

    var input = document.getElementById('in-halloy');
    if (input) input.setAttribute('data-max', String(haloyBal));

    var oneHaloy = ethers.parseUnits('1', 18);
    var rateRe = d.haloyTotalSupply > 0n ? toNum((d.vaultRealEstateHeld * oneHaloy) / d.haloyTotalSupply) : 0;
    var rateGold = d.haloyTotalSupply > 0n ? toNum((d.vaultGoldHeld * oneHaloy) / d.haloyTotalSupply) : 0;
    setText('wd-rate-mreal', fmt4(rateRe));
    setText('wd-rate-mgold', fmt4(rateGold));

    var btn = document.getElementById('withdraw-btn');
    if (btn && !btn.classList.contains('is-busy')) {
      btn.textContent = STATE.address ? 'Withdraw' : 'Connect Wallet';
    }

    updateWithdrawEstimate();
  }

  function updateWithdrawEstimate() {
    var d = STATE.cache;
    var input = document.getElementById('in-halloy');
    if (!input) return;

    var amt = parseAmount(input.value);
    var max = Number(input.getAttribute('data-max') || 0);
    var over = STATE.address ? amt > max : false;
    var used = over ? 0 : amt;
    setError('halloy', over);

    var outRe = 0, outGold = 0, remaining = STATE.address ? max - used : 0, remPct = 0;
    if (d && d.haloyTotalSupply > 0n) {
      var usedWei = safeParseUnits(used);
      outRe = toNum((d.vaultRealEstateHeld * usedWei) / d.haloyTotalSupply);
      outGold = toNum((d.vaultGoldHeld * usedWei) / d.haloyTotalSupply);
      var haloySupply = toNum(d.haloyTotalSupply);
      remPct = haloySupply > 0 ? (remaining / haloySupply) * 100 : 0;
    }
    setText('out-mreal', fmt(outRe));
    setText('out-mgold', fmt(outGold));
    setText('rem-halloy', fmt(remaining));
    setText('rem-own', remPct.toFixed(2) + '%');

    var btn = document.getElementById('withdraw-btn');
    if (btn && !btn.classList.contains('is-busy')) {
      btn.disabled = STATE.address ? (over || amt === 0) : false;
    }
  }

  function bindWithdrawInputs() {
    bindAmountInputs(updateWithdrawEstimate);
    var btn = document.getElementById('withdraw-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        if (!STATE.address) { handleConnectClick(); return; }
        doWithdraw();
      });
    }
  }

  function setWithdrawBusy(busy) {
    var btn = document.getElementById('withdraw-btn');
    if (!btn) return;
    btn.classList.toggle('is-busy', busy);
    btn.disabled = busy;
  }

  function setWithdrawTxStatus(message, isSuccess) {
    var el = document.getElementById('wd-tx-status');
    if (!el) return;
    if (!message) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = message;
    el.className = isSuccess === false ? 'field-error' : 'stat-note';
  }

  function doWithdraw() {
    var input = document.getElementById('in-halloy');
    if (!input || !STATE.cache) return;
    var amt = parseAmount(input.value);
    if (amt === 0) return;
    var wei = safeParseUnits(amt);

    setWithdrawBusy(true);
    setWithdrawTxStatus('Withdrawing — confirm in your wallet…');

    HyperalloyConfig.getWriteContracts().then(function (wc) {
      return wc.vault.withdraw(wei).then(function (tx) {
        setWithdrawTxStatus('Withdrawing — waiting for confirmation…');
        return tx.wait();
      });
    }).then(function () {
      setWithdrawTxStatus('Withdrawal successful.', true);
      toast('Withdrawal complete.');
      input.value = '';
      return refresh();
    }).catch(function (err) {
      console.error(err);
      setWithdrawTxStatus(describeError(err), false);
      toast('Withdrawal failed.');
    }).then(function () {
      setWithdrawBusy(false);
    });
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
        connectWallet().then(function (addr) {
          if (addr) window.location.href = 'overview.html';
        }).catch(function (err) {
          console.error(err);
          toast(describeError(err));
        });
      });
    });
  }

  /* ---------- Init ---------- */
  injectSprite();
  initCopy();

  var page = document.body.getAttribute('data-page');
  if (page) {
    bindWalletBadgeClick();
    bindAccountAndChainListeners();
    silentReconnect().then(function () {
      buildHeader(page);
      buildTabbar(page);
      return refresh();
    }).then(function () {
      if (page === 'deposit') bindDepositInputs();
      if (page === 'withdraw') bindWithdrawInputs();
    });
  } else {
    initLanding();
  }
})();
