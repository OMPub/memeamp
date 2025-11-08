import { ethers } from 'ethers';
import type { WalletState, NetworkMap, WalletElements } from './types';

// State management
let provider: ethers.BrowserProvider | null = null;
let signer: ethers.JsonRpcSigner | null = null;
let userAddress: string | null = null;

// Network names mapping
const networks: NetworkMap = {
  1: 'Ethereum Mainnet',
  5: 'Goerli Testnet',
  11155111: 'Sepolia Testnet',
  137: 'Polygon Mainnet',
  80001: 'Mumbai Testnet'
};

// DOM elements
let elements: WalletElements;

// Initialize wallet functionality
export function initWallet(walletElements: WalletElements): void {
  elements = walletElements;
  checkWalletConnection();
  setupEventListeners();
}

// Event listeners
function setupEventListeners(): void {
  elements.connectButton.addEventListener('click', connectWallet);
  elements.disconnectButton.addEventListener('click', disconnectWallet);

  // Listen for account changes
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }
}

// Check if wallet was previously connected
async function checkWalletConnection(): Promise<void> {
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
async function connectWallet(): Promise<void> {
  // Check if MetaMask or another Web3 wallet is installed
  if (typeof window.ethereum === 'undefined') {
    showError('Please install MetaMask or another Web3 wallet to connect.');
    return;
  }

  try {
    // Request account access
    elements.connectButton.disabled = true;
    elements.connectButton.textContent = 'Connecting...';
    hideError();

    // Create provider and request accounts
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
      showError('No accounts found. Please unlock your wallet.');
      resetConnectButton();
      return;
    }

    userAddress = accounts[0];
    signer = await provider.getSigner();

    // Get network information
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const networkNameText = networks[chainId] || `Chain ID: ${chainId}`;

    // Get balance
    const balanceWei = await provider.getBalance(accounts[0]);
    const balanceEth = ethers.formatEther(balanceWei);

    // Update UI
    elements.walletAddress.textContent = formatAddress(accounts[0]);
    elements.networkName.textContent = networkNameText;
    elements.balance.textContent = `${parseFloat(balanceEth).toFixed(4)} ETH`;

    // Show wallet info, hide connect button
    elements.connectButton.classList.add('hidden');
    elements.walletInfo.classList.remove('hidden');

    console.log('Wallet connected:', userAddress);
  } catch (error: any) {
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
function disconnectWallet(): void {
  provider = null;
  signer = null;
  userAddress = null;

  // Reset UI
  elements.walletInfo.classList.add('hidden');
  elements.connectButton.classList.remove('hidden');
  resetConnectButton();
  hideError();

  console.log('Wallet disconnected');
}

// Handle account changes
function handleAccountsChanged(accounts: string[]): void {
  if (accounts.length === 0) {
    disconnectWallet();
  } else if (accounts[0] !== userAddress) {
    connectWallet();
  }
}

// Handle chain changes
function handleChainChanged(): void {
  // Reload the page when chain changes
  window.location.reload();
}

// Helper functions
function formatAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showError(message: string): void {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove('hidden');
}

function hideError(): void {
  elements.errorMessage.classList.add('hidden');
  elements.errorMessage.textContent = '';
}

function resetConnectButton(): void {
  elements.connectButton.disabled = false;
  elements.connectButton.textContent = 'Connect Wallet';
}

// Export state getters
export function getWalletState(): WalletState {
  return { provider, signer, userAddress };
}

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
