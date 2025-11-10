import { ethers } from 'ethers';
import type { WalletState, NetworkMap, WalletElements } from './types';
import SixFiveTwoNineVotingSDK, { type VotingData } from './6529-sdk';

// State management
let provider: ethers.BrowserProvider | null = null;
let signer: ethers.JsonRpcSigner | null = null;
let userAddress: string | null = null;

// 6529 SDK
const sdk = new SixFiveTwoNineVotingSDK();
let votingData: VotingData | null = null;

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
    elements.connectButton.classList.add('connecting');
    hideError();

    // Create provider and request accounts
    provider = new ethers.BrowserProvider(window.ethereum);
    
    let accounts;
    try {
      accounts = await provider.send('eth_requestAccounts', []);
    } catch (accountError: any) {
      console.log('User cancelled wallet request or wallet error:', accountError);
      resetConnectButton();
      return;
    }
    
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

    // Don't hide button yet - keep it visible with pulsing animation
    // Also don't show wallet info yet - wait for full authentication
    console.log('Wallet connected:', userAddress);

    // Authenticate with 6529 and fetch voting data
    await authenticateWith6529();
    
    // Only after complete success: show wallet info, hide button, start brainwave
    elements.walletInfo.classList.remove('hidden');
    elements.connectButton.classList.add('hidden');
    swapBrainwaveVisualizer(true);
  } catch (error: any) {
    console.error('Error connecting wallet:', error);
    console.log('Resetting UI due to error...');
    
    // Hide wallet info and show connect button
    elements.walletInfo.classList.add('hidden');
    elements.connectButton.classList.remove('hidden');
    resetConnectButton();
    
    // Ensure brainwave stays in disconnected state on error
    swapBrainwaveVisualizer(false);
    
    console.log('UI reset complete');
  }
}

// Disconnect wallet
function disconnectWallet(): void {
  provider = null;
  signer = null;
  userAddress = null;
  votingData = null;

  // Reset UI
  elements.walletInfo.classList.add('hidden');
  elements.connectButton.classList.remove('hidden');
  resetConnectButton();
  hideError();
  
  // Clear playlist and visualizer
  const playlistContent = document.getElementById('playlistContent');
  if (playlistContent) {
    playlistContent.innerHTML = `
      <div class="playlist-placeholder">
        <button id="connectButton" class="connect-btn-img"></button>
      </div>
    `;
    // Re-attach event listener to the new connect button
    const newConnectBtn = document.getElementById('connectButton');
    if (newConnectBtn) {
      newConnectBtn.addEventListener('click', connectWallet);
    }
  }
  
  const visualizerContent = document.getElementById('visualizerContent');
  if (visualizerContent) {
    visualizerContent.innerHTML = '';
  }

  // Swap back to static brain image when disconnected
  swapBrainwaveVisualizer(false);

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
  elements.connectButton.classList.remove('connecting');
}

// Authenticate with 6529
async function authenticateWith6529(): Promise<void> {
  if (!signer || !userAddress) {
    return;
  }

  try {
    console.log('Starting 6529 authentication...');
    console.log('User address:', userAddress);
    
    // Check network - 6529 might require Ethereum mainnet
    const network = await provider!.getNetwork();
    console.log('Current network:', {
      chainId: Number(network.chainId),
      name: network.name
    });
    
    // Set wallet address in SDK
    sdk.setWalletAddress(userAddress);
    
    // Test API connectivity first
    console.log('Testing 6529 API connectivity...');
    const testResponse = await fetch('https://api.6529.io/api/auth/nonce?signer_address=' + userAddress);
    console.log('API test response:', testResponse.status, testResponse.statusText);
    
    if (testResponse.ok) {
      const responseData = await testResponse.json();
      console.log('API response data:', JSON.stringify(responseData, null, 2));
    } else {
      const errorData = await testResponse.text();
      console.log('API error response:', errorData);
    }
    
    // Authenticate with 6529 using signer
    console.log('Attempting authentication...');
    await sdk.authenticate(async (message: string) => {
      if (!signer) throw new Error('Signer not available');
      console.log('Signing message:', message);
      const signature = await signer.signMessage(message);
      console.log('Signature generated:', signature.substring(0, 10) + '...');
      return signature;
    });
    
    // Fetch voting data (includes submissions)
    console.log('Fetching voting data...');
    votingData = await sdk.getVotingData();
    
    console.log('6529 authenticated successfully');
    console.log('User TDH:', votingData.user.tdh);
    console.log('Total submissions:', votingData.submissions.length);
    
    // Update the UI with submissions immediately
    const playlistContent = document.getElementById('playlistContent');
    if (playlistContent) {
      const filteredSubmissions = votingData.submissions
        .slice(0, 10);
      
      // Debug: Log the vote counts to verify sorting
      console.log('Top 10 submissions by projected TDH votes:');
      filteredSubmissions.forEach((sub, index) => {
        console.log(`#${index + 1}: ${sub.title} - rating_prediction: ${sub.rating_prediction}, realtime_rating: ${sub.realtime_rating}, rank: ${sub.rank}`);
      });
      
      playlistContent.innerHTML = filteredSubmissions.map((submission, index) => {
        const votes = formatVotes(Math.round(submission.rating_prediction));
        return `
          <div class="playlist-item" data-submission-id="${submission.id}">
            <span class="playlist-rank">${index + 1}.</span>
            <span class="playlist-text">${submission.title || 'Untitled'} by ${submission.author.handle}</span>
            <span class="playlist-votes">${votes}</span>
          </div>
        `;
      }).join('');
      
      // Add click handlers for playlist items
      document.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', function(this: HTMLElement) {
          const submissionId = this.getAttribute('data-submission-id');
          const submission = filteredSubmissions.find(s => s.id === submissionId);
          if (submission) {
            loadSubmissionIntoVisualizer(submission);
            
            // Update active state
            document.querySelectorAll('.playlist-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
          }
        });
      });
      
      // Auto-load first submission into visualizer
      if (filteredSubmissions.length > 0) {
        loadSubmissionIntoVisualizer(filteredSubmissions[0]);
        document.querySelector('.playlist-item')?.classList.add('active');
      }
    }
    
  } catch (error) {
    console.info('6529 authentication cancelled or failed:', error);
    // Don't show error message - just log to console and re-throw
    throw error;
  }
}

// Format vote numbers in millions with 1 decimal
function formatVotes(votes: number): string {
  if (votes >= 1000000) {
    return (votes / 1000000).toFixed(1) + 'M';
  } else if (votes >= 1000) {
    return (votes / 1000).toFixed(1) + 'K';
  } else {
    return votes.toString();
  }
}

// Load submission into the visualizer area
function loadSubmissionIntoVisualizer(submission: any): void {
  const visualizerContent = document.getElementById('visualizerContent');
  if (!visualizerContent) return;
  
  const mediaUrl = submission.picture;
  const isVideo = mediaUrl && (mediaUrl.toLowerCase().includes('.mp4') || mediaUrl.toLowerCase().includes('.webm') || mediaUrl.toLowerCase().includes('.mov') || mediaUrl.toLowerCase().includes('.avi') || mediaUrl.toLowerCase().includes('.m4v'));
  
  visualizerContent.innerHTML = `
    ${isVideo ? 
      `<video src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" autoplay loop playsinline></video>` :
      `<img src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" />`
    }
  `;
  
  // Update now playing text with submission details
  const nowPlayingText = document.getElementById('nowPlayingText');
  if (nowPlayingText) {
    const title = submission.title || 'Untitled';
    const author = submission.author?.handle || 'Unknown';
    const predictedTDH = submission.rating_prediction?.toLocaleString() || '0';
    const voterCount = submission.raters_count || 0;
    
    // Show title, author, predicted TDH, and voter count
    const text = `${title} by ${author} - ${predictedTDH} TDH (${voterCount} voters)`;
    nowPlayingText.textContent = text;
    
    // Check if text overflows and apply scrolling animation
    setTimeout(() => {
      const textWidth = nowPlayingText.scrollWidth;
      const containerWidth = nowPlayingText.parentElement?.clientWidth || 320;
      
      if (textWidth > containerWidth) {
        nowPlayingText.classList.remove('short');
      } else {
        nowPlayingText.classList.add('short');
      }
    }, 0);
  }
}


// Swap brainwave visualizer between static image and video
function swapBrainwaveVisualizer(isConnected: boolean): void {
  const brainNoWave = document.querySelector('.brain-no-wave') as HTMLImageElement;
  const brainwaveVideo = document.querySelector('.brainwave-video') as HTMLVideoElement;
  
  if (brainNoWave && brainwaveVideo) {
    if (isConnected) {
      // Show video, hide image
      brainNoWave.style.display = 'none';
      brainwaveVideo.style.display = 'block';
      brainwaveVideo.play().catch(e => console.log('Video play failed:', e));
    } else {
      // Show image, hide video
      brainNoWave.style.display = 'block';
      brainwaveVideo.style.display = 'none';
      brainwaveVideo.pause();
    }
  }
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
