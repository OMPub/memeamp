// State management
let provider = null;
let signer = null;
let userAddress = null;

// DOM elements
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const networkName = document.getElementById('networkName');
const balance = document.getElementById('balance');
const errorMessage = document.getElementById('errorMessage');

// Network names mapping
const networks = {
    1: 'Ethereum Mainnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon Mainnet',
    80001: 'Mumbai Testnet'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkWalletConnection();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    connectButton.addEventListener('click', connectWallet);
    disconnectButton.addEventListener('click', disconnectWallet);

    // Listen for account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
    }
}

// Check if wallet was previously connected
async function checkWalletConnection() {
    if (typeof window.ethereum === 'undefined') {
        return;
    }

    try {
        const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
        });
        
        if (accounts.length > 0) {
            await connectWallet();
        }
    } catch (error) {
        console.error('Error checking wallet connection:', error);
    }
}

// Connect wallet
async function connectWallet() {
    // Check if MetaMask or another Web3 wallet is installed
    if (typeof window.ethereum === 'undefined') {
        showError('Please install MetaMask or another Web3 wallet to connect.');
        return;
    }

    try {
        // Request account access
        connectButton.disabled = true;
        connectButton.textContent = 'Connecting...';
        hideError();

        // Create provider and request accounts
        provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        
        if (accounts.length === 0) {
            showError('No accounts found. Please unlock your wallet.');
            resetConnectButton();
            return;
        }

        userAddress = accounts[0];
        signer = provider.getSigner();

        // Get network information
        const network = await provider.getNetwork();
        const networkNameText = networks[network.chainId] || `Chain ID: ${network.chainId}`;

        // Get balance
        const balanceWei = await provider.getBalance(userAddress);
        const balanceEth = ethers.utils.formatEther(balanceWei);

        // Update UI
        walletAddress.textContent = formatAddress(userAddress);
        networkName.textContent = networkNameText;
        balance.textContent = `${parseFloat(balanceEth).toFixed(4)} ETH`;

        // Show wallet info, hide connect button
        connectButton.classList.add('hidden');
        walletInfo.classList.remove('hidden');

        console.log('Wallet connected:', userAddress);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        
        if (error.code === 4001) {
            showError('Connection request rejected. Please try again.');
        } else {
            showError('Failed to connect wallet. Please try again.');
        }
        
        resetConnectButton();
    }
}

// Disconnect wallet
function disconnectWallet() {
    provider = null;
    signer = null;
    userAddress = null;

    // Reset UI
    walletInfo.classList.add('hidden');
    connectButton.classList.remove('hidden');
    resetConnectButton();
    hideError();

    console.log('Wallet disconnected');
}

// Handle account changes
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else if (accounts[0] !== userAddress) {
        connectWallet();
    }
}

// Handle chain changes
function handleChainChanged() {
    // Reload the page when chain changes
    window.location.reload();
}

// Helper functions
function formatAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
}

function resetConnectButton() {
    connectButton.disabled = false;
    connectButton.textContent = 'Connect Wallet';
}
