/* ==========================================================================
   HYPERALLOY - config.js
   Central place for contract addresses, chain info, ABI loading, and
   Ethers.js provider/signer helpers. Loaded on every app page, after the
   ethers CDN script and before script.js.

   Reads (balances, supply, holdings, prices) go through a public read-only
   RPC provider, so overview/basket work even before a wallet is connected.
   Writes (approve, deposit, withdraw) go through the connected wallet's
   signer, requested lazily only when a transaction is about to be sent.
   ========================================================================== */
(function () {
  'use strict';

  var ADDRESSES = {
    realEstateToken: '0xf22e28b426b3f3cf0FA1143b9470D5d265f68252',
    goldToken: '0xE19C5bB9c4633bDA96c25B0e8C9314189bE65818',
    vault: '0x6974182eBA01d6aAe53056FdD2F5e1f9fFe05fC5'
  };

  var CHAIN_ID_HEX = '0x66eee'; // 421614
  var CHAIN_ID_DEC = 421614;
  var RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';
  var BLOCK_EXPLORER = 'https://sepolia.arbiscan.io';

  var ABI_PATHS = {
    realEstateToken: 'abi/RealEstateToken.json',
    goldToken: 'abi/GoldToken.json',
    vault: 'abi/HyperalloyVault.json'
  };

  var abiCache = null;
  var readProvider = null;
  var browserProvider = null;

  function loadAbis() {
    if (abiCache) return Promise.resolve(abiCache);
    var keys = Object.keys(ABI_PATHS);
    return Promise.all(
      keys.map(function (k) {
        return fetch(ABI_PATHS[k]).then(function (r) {
          if (!r.ok) throw new Error('Failed to load ' + ABI_PATHS[k]);
          return r.json();
        });
      })
    ).then(function (results) {
      abiCache = {};
      keys.forEach(function (k, i) { abiCache[k] = results[i]; });
      return abiCache;
    });
  }

  function getReadProvider() {
    if (!readProvider) {
      readProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID_DEC);
    }
    return readProvider;
  }

  function getReadContracts() {
    return loadAbis().then(function (abis) {
      var p = getReadProvider();
      return {
        realEstateToken: new ethers.Contract(ADDRESSES.realEstateToken, abis.realEstateToken, p),
        goldToken: new ethers.Contract(ADDRESSES.goldToken, abis.goldToken, p),
        vault: new ethers.Contract(ADDRESSES.vault, abis.vault, p)
      };
    });
  }

  function getBrowserProvider() {
    if (!window.ethereum) {
      var err = new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
      err.code = 'NO_WALLET';
      throw err;
    }
    if (!browserProvider) {
      browserProvider = new ethers.BrowserProvider(window.ethereum);
    }
    return browserProvider;
  }

  function getSigner() {
    return getBrowserProvider().getSigner();
  }

  function getWriteContracts() {
    return getSigner().then(function (signer) {
      return loadAbis().then(function (abis) {
        return {
          realEstateToken: new ethers.Contract(ADDRESSES.realEstateToken, abis.realEstateToken, signer),
          goldToken: new ethers.Contract(ADDRESSES.goldToken, abis.goldToken, signer),
          vault: new ethers.Contract(ADDRESSES.vault, abis.vault, signer)
        };
      });
    });
  }

  window.HyperalloyConfig = {
    ADDRESSES: ADDRESSES,
    CHAIN_ID_HEX: CHAIN_ID_HEX,
    CHAIN_ID_DEC: CHAIN_ID_DEC,
    RPC_URL: RPC_URL,
    BLOCK_EXPLORER: BLOCK_EXPLORER,
    getReadContracts: getReadContracts,
    getBrowserProvider: getBrowserProvider,
    getSigner: getSigner,
    getWriteContracts: getWriteContracts
  };
})();