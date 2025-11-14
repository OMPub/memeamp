import { ethers } from 'ethers';
import type { WalletState, WalletElements } from './types';
import SixFiveTwoNineVotingSDK, { type VotingData } from './6529-sdk';
import { updateMemeampTooltip } from './tooltip';

// State management
let provider: ethers.BrowserProvider | null = null;
let signer: ethers.JsonRpcSigner | null = null;
let userAddress: string | null = null;
let currentSubmissionIndex: number = 0;
let currentSubmissions: any[] = [];

// 6529 SDK
const sdk = new SixFiveTwoNineVotingSDK();
let votingData: VotingData | null = null;
let isRefreshingBoostData = false;
let lastBoostDataRefresh = 0;

// DOM elements
let elements: WalletElements;

// Initialize wallet functionality
export function initWallet(walletElements: WalletElements): void {
  elements = walletElements;
  checkWalletConnection();
  setupEventListeners();
  
  // Add navigation button event listeners
  document.addEventListener('DOMContentLoaded', () => {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const addButton = document.getElementById('addButton');
    
    if (prevButton) {
      prevButton.addEventListener('click', showPreviousSubmission);
    }
    
    if (nextButton) {
      nextButton.addEventListener('click', showNextSubmission);
    }

    if (addButton) {
      addButton.addEventListener('click', () => {
        boostCurrentSubmission().catch(() => {
          console.error('Boost action failed');
        });
      });
      addButton.addEventListener('mouseenter', () => {
        refreshBoostDataIfNeeded().catch(() => {
          console.error('Boost tooltip refresh failed');
        });
      });
      addButton.addEventListener('focus', () => {
        refreshBoostDataIfNeeded().catch(() => {
          console.error('Boost tooltip refresh failed');
        });
      });
      updateBoostTooltip();
    }
    
    const voteButton = document.getElementById('voteButton');
    if (voteButton) {
      voteButton.addEventListener('click', () => {
        submitVote().catch(() => {
          console.error('Vote action failed');
        });
      });
    }

    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
      submitButton.addEventListener('click', () => {
        submitVote().catch(() => {
          console.error('Vote action failed');
        });
      });
    }

    // Dismissible error toast close button
    const errorClose = document.getElementById('errorClose');
    if (errorClose) {
      errorClose.addEventListener('click', () => {
        hideError();
      });
    }
  });
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

async function refreshBoostDataIfNeeded(force: boolean = false): Promise<void> {
  if (!votingData || isRefreshingBoostData) {
    return;
  }

  const availableTDH = votingData.user?.availableTDH ?? 0;
  const now = Date.now();
  const shouldRefresh = force
    || !lastBoostDataRefresh
    || availableTDH < 1
    || now - lastBoostDataRefresh > 30000;

  if (!shouldRefresh) {
    return;
  }

  isRefreshingBoostData = true;
  try {
    const refreshed = await sdk.refreshUserData();
    lastBoostDataRefresh = Date.now();
    mergeRefreshedUserData(refreshed);
    console.log('Refreshed user data:', {
      availableTDH: refreshed.user.availableTDH,
      totalTDHVoted: refreshed.user.totalTDHVoted,
      totalVotes: refreshed.user.totalVotes,
      tdh: refreshed.user.tdh,
    });
    updateBoostTooltip();
  } catch {
    console.error('Failed to refresh boost data');

    if (votingData?.user) {
      votingData.user.availableTDH = 0;
    }

    updateBoostTooltip();
  } finally {
    isRefreshingBoostData = false;
  }
}

function mergeRefreshedUserData(refreshed: { user: any; userVotes: any[]; userVotesMap: { [key: string]: number } }): void {
  if (!votingData) return;

  votingData.user = {
    ...votingData.user,
    ...refreshed.user,
  };
  votingData.userVotes = refreshed.userVotes;
  votingData.userVotesMap = refreshed.userVotesMap;
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
  } catch {
    console.error('Error checking wallet connection');
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
    } catch {
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

    // Get balance
    const balanceWei = await provider.getBalance(accounts[0]);
    const balanceEth = ethers.formatEther(balanceWei);

    // Update UI
    elements.walletAddress.textContent = formatAddress(accounts[0]);
    elements.balance.textContent = `${parseFloat(balanceEth).toFixed(4)} ETH`;

    // Don't hide button yet - keep it visible with pulsing animation
    // Also don't show wallet info yet - wait for full authentication

    // Authenticate with 6529 and fetch voting data
    await authenticateWith6529();
    
    // Only after complete success: show wallet info, hide button, start brainwave
    elements.walletInfo.classList.remove('hidden');
    elements.connectButton.classList.add('hidden');
    swapBrainwaveVisualizer(true);
  } catch {
    console.error('Error connecting wallet');
    
    // Hide wallet info and show connect button
    elements.walletInfo.classList.add('hidden');
    elements.connectButton.classList.remove('hidden');
    resetConnectButton();
    
    // Ensure brainwave stays in disconnected state on error
    swapBrainwaveVisualizer(false);
    
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
  
  // Clear now playing text
  const nowPlayingText = document.getElementById('nowPlayingText');
  if (nowPlayingText) {
    nowPlayingText.textContent = '';
  }
  
  // Clear visualizer content
  const visualizerContent = document.getElementById('visualizerContent');
  if (visualizerContent) {
    visualizerContent.innerHTML = '';
  }
  
  // Clear identity info display
  updateIdentityInfoDisplay(0, 0);
  
  // Reset sliders to 0%
  const sliders = document.querySelectorAll('.slider-handle');
  sliders.forEach(slider => {
    if (slider instanceof HTMLElement) {
      slider.style.left = '0%';
    }
  });

  // Swap back to static brain image when disconnected
  swapBrainwaveVisualizer(false);

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

// Show loading state in TDH window
function showTdhLoading(message: string = 'SUBMITTING'): void {
  const identityTdh = document.getElementById('identityTdh');
  if (identityTdh) {
    identityTdh.innerHTML = `<span class="tdh-loading">${message}<span class="loading-dots"></span></span>`;
  }
}

// Restore TDH display
function restoreTdhDisplay(): void {
  const pendingTDH = (window as any).pendingTDHAssignment || 0;
  const identityTdh = document.getElementById('identityTdh');
  if (identityTdh) {
    identityTdh.textContent = formatCompactTDH(pendingTDH);
  }
}

function showError(message: string): void {
  const errorEl = elements.errorMessage;
  const textSpan = errorEl.querySelector('.error-text') as HTMLElement | null;
  if (textSpan) {
    textSpan.textContent = message;
  } else {
    errorEl.textContent = message;
  }
  errorEl.classList.remove('hidden');
}

function hideError(): void {
  const errorEl = elements.errorMessage;
  errorEl.classList.add('hidden');
  const textSpan = errorEl.querySelector('.error-text') as HTMLElement | null;
  if (textSpan) {
    textSpan.textContent = '';
  } else {
    errorEl.textContent = '';
  }
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
    // Set wallet address in SDK
    sdk.setWalletAddress(userAddress);
    
    // Test API connectivity first
    await fetch('https://api.6529.io/api/auth/nonce?signer_address=' + userAddress);
    
    // Authenticate with 6529 using signer
    await sdk.authenticate(async (message: string) => {
      if (!signer) throw new Error('Signer not available');
      const signature = await signer.signMessage(message);
      return signature;
    });
    
    // Fetch voting data (includes submissions)
    votingData = await sdk.getVotingData();
    
    // Update identity info display
    updateIdentityInfoDisplay(votingData.user.tdh, votingData.user.availableTDH);
    updateBoostTooltip();
    
    // Update the UI with submissions immediately
    const playlistContent = document.getElementById('playlistContent');
    if (playlistContent) {
      currentSubmissions = votingData.submissions.slice(0, 10);
      currentSubmissionIndex = 0; // Reset to first submission
      
      // Debug: Log the vote counts to verify sorting
      
      playlistContent.innerHTML = currentSubmissions.map((submission: any, index: number) => {
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
      document.querySelectorAll('.playlist-item').forEach((item, index) => {
        item.addEventListener('click', function(this: HTMLElement) {
          currentSubmissionIndex = index;
          const submission = currentSubmissions[index];
          if (submission) {
            loadSubmissionIntoVisualizer(submission);
            updateActivePlaylistItem();
          }
        });
      });
      
      // Auto-load first submission into visualizer
      if (currentSubmissions.length > 0) {
        loadSubmissionIntoVisualizer(currentSubmissions[0]);
        document.querySelector('.playlist-item')?.classList.add('active');
      }
    }
    
  } catch (error) {
    console.error('6529 authentication failed');
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
// Format number with K/M/B suffixes (3 significant figures)
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toPrecision(3) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toPrecision(3) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toPrecision(3) + 'K';
  }
  return num.toPrecision(3);
}

// Update identity info display
function updateIdentityInfoDisplay(tdh: number, rep: number): void {
  const tdhElement = document.getElementById('identityTdh');
  const repElement = document.getElementById('identityRep');
  
  
  if (tdhElement) {
    tdhElement.textContent = formatNumber(tdh);
  }
  
  if (repElement) {
    repElement.textContent = formatNumber(rep);
  }
}

function calculateBoostAmount(availableTDH: number): number {
  if (availableTDH < 1) {
    return 0;
  }

  const cappedAvailable = Math.floor(availableTDH);
  if (cappedAvailable < 1) {
    return 0;
  }

  let boostAmount = Math.floor(availableTDH * 0.1);
  if (boostAmount < 1) {
    boostAmount = 1;
  }

  return Math.min(boostAmount, cappedAvailable);
}

function updateBoostTooltip(): void {
  const addButton = document.getElementById('addButton') as HTMLButtonElement | null;
  if (!addButton) return;

  const availableTDH = votingData?.user?.availableTDH ?? 0;
  const boostAmount = calculateBoostAmount(availableTDH);

  if (boostAmount > 0) {
    updateMemeampTooltip(addButton, `BOOST: Instantly upvote ${boostAmount.toLocaleString()} MOAR TDH`);
    if (elements?.errorMessage?.textContent?.includes('Need at least 1 available TDH to boost.')) {
      hideError();
    }
  } else {
    updateMemeampTooltip(addButton, 'BOOST: Need at least 1 TDH available');
  }
}

async function boostCurrentSubmission(): Promise<void> {
  if (!votingData) {
    showError('Connect your wallet to boost.');
    return;
  }

  if (currentSubmissions.length === 0) {
    showError('No submission selected to boost.');
    return;
  }

  const submission = currentSubmissions[currentSubmissionIndex];
  if (!submission) {
    showError('Unable to find the current submission.');
    return;
  }

  const addButton = document.getElementById('addButton') as HTMLButtonElement | null;
  if (addButton) {
    addButton.disabled = true;
  }
  
  // Show loading state
  showTdhLoading('..');
  
  // Get current TDH for this submission
  const currentTDH = votingData.userVotesMap?.[submission.id] || 0;
  let availableTDH = votingData.user?.availableTDH ?? 0;
  let boostAmount = calculateBoostAmount(availableTDH);

  if (boostAmount < 1) {
    restoreTdhDisplay();
    if (addButton) {
      addButton.disabled = false;
    }
    showError('Need at least 1 available TDH to boost.');
    updateBoostTooltip();
    return;
  }

  const newTotalTDH = currentTDH + boostAmount;

  // Optimistic update - show the new total immediately
  updateIdentityInfoDisplay(newTotalTDH, availableTDH - boostAmount);

  try {
    await sdk.submitVote(submission.id, newTotalTDH);

    const refreshed = await sdk.refreshUserData();
    lastBoostDataRefresh = Date.now();
    
    if (votingData) {
      mergeRefreshedUserData(refreshed);
    }

    const updatedTDH = refreshed.userVotesMap?.[submission.id] || 0;
    // The server response already includes the new total after boost
    updateIdentityInfoDisplay(updatedTDH, refreshed.user.availableTDH);
    updateBoostTooltip();
    hideError();

  } catch (error: unknown) {
    console.error('Boost failed:', error);

    // Revert optimistic update on failure
    updateIdentityInfoDisplay(currentTDH, availableTDH);

    if (votingData?.user) {
      votingData.user.availableTDH = 0;
    }

    const message = error instanceof Error && error.message
      ? error.message
      : 'Boost failed. Please try again.';

    if (message.includes('401') || message.includes('Unauthorized')) {
      // Try to re-authenticate automatically
      try {
        await sdk.authenticate(async (message: string) => {
          if (!signer) throw new Error('Signer not available');
          return await signer.signMessage(message);
        });
        
        // Retry the boost after re-authentication
        await sdk.submitVote(submission.id, newTotalTDH);
        
        const refreshed = await sdk.refreshUserData();
        lastBoostDataRefresh = Date.now();
        
        if (votingData) {
          mergeRefreshedUserData(refreshed);
        }

        const updatedTDH = refreshed.userVotesMap?.[submission.id] || 0;
        // The server response already includes the new total after boost
        updateIdentityInfoDisplay(updatedTDH, refreshed.user.availableTDH);
        updateBoostTooltip();
        hideError();

        return;
      } catch (reauthError) {
        console.error('Re-authentication failed');
        // Revert optimistic update on re-auth failure too
        updateIdentityInfoDisplay(currentTDH, availableTDH);
        showError('Boost failed: 6529 session expired. Please disconnect and reconnect your wallet.');
      }
    } else {
      showError(`Boost failed: ${message}`);
    }

    updateBoostTooltip();
  } finally {
    if (addButton) {
      addButton.disabled = false;
    }
  }
}

async function submitVote(): Promise<void> {
  if (!votingData) {
    showError('Connect your wallet to vote.');
    return;
  }

  if (currentSubmissions.length === 0) {
    showError('No submissions loaded to vote on.');
    return;
  }

  const submission = currentSubmissions[currentSubmissionIndex];
  const voteAmount = (window as any).pendingTDHAssignment || 0;

  if (voteAmount <= 0) {
    showError('Please adjust the TDH slider to assign TDH before voting.');
    return;
  }

  const voteButton = document.getElementById('voteButton') as HTMLButtonElement;
  const submitButton = document.getElementById('submitButton') as HTMLButtonElement;
  
  // Disable both vote buttons
  if (voteButton) {
    voteButton.disabled = true;
  }
  if (submitButton) {
    submitButton.disabled = true;
  }
  
  // Show loading state
  showTdhLoading('VOTING...');
  
  try {
    await sdk.submitVote(submission.id, voteAmount);

    const refreshed = await sdk.refreshUserData();
    lastBoostDataRefresh = Date.now();
    
    if (votingData) {
      mergeRefreshedUserData(refreshed);
    }

    // Update TDH display with the new assignment
    const identityTdh = document.getElementById('identityTdh');
    if (identityTdh) {
      const formattedTDH = formatCompactTDH(voteAmount);
      identityTdh.textContent = formattedTDH;
    }

    updateBoostTooltip();
    hideError();

  } catch (error: unknown) {
    console.error('Vote failed');

    const message = error instanceof Error && error.message
      ? error.message
      : 'Vote failed. Please try again.';

    if (message.includes('401') || message.includes('Unauthorized')) {
      // Try to re-authenticate automatically
      try {
        await sdk.authenticate(async (message: string) => {
          if (!signer) throw new Error('Signer not available');
          return await signer.signMessage(message);
        });
        
        // Retry the vote after re-authentication
        await sdk.submitVote(submission.id, voteAmount);
        
        const refreshed = await sdk.refreshUserData();
        lastBoostDataRefresh = Date.now();
        
        if (votingData) {
          mergeRefreshedUserData(refreshed);
        }

        // Update TDH display with the new assignment
        const identityTdh = document.getElementById('identityTdh');
        if (identityTdh) {
          const formattedTDH = formatCompactTDH(voteAmount);
          identityTdh.textContent = formattedTDH;
        }

        updateBoostTooltip();
        hideError();

        return;
      } catch (reauthError) {
        console.error('Re-authentication failed');
        showError('Vote failed: 6529 session expired. Please disconnect and reconnect your wallet.');
      }
    } else {
      showError(`Vote failed: ${message}`);
    }

    updateBoostTooltip();
  } finally {
    // Re-enable both vote buttons
    if (voteButton) {
      voteButton.disabled = false;
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

// Navigation functions
function showNextSubmission(): void {
  if (currentSubmissions.length === 0) return;
  
  currentSubmissionIndex = (currentSubmissionIndex + 1) % currentSubmissions.length;
  const submission = currentSubmissions[currentSubmissionIndex];
  loadSubmissionIntoVisualizer(submission);
  updateActivePlaylistItem();
}

function showPreviousSubmission(): void {
  if (currentSubmissions.length === 0) return;
  
  currentSubmissionIndex = (currentSubmissionIndex - 1 + currentSubmissions.length) % currentSubmissions.length;
  const submission = currentSubmissions[currentSubmissionIndex];
  loadSubmissionIntoVisualizer(submission);
  updateActivePlaylistItem();
}

function updateActivePlaylistItem(): void {
  document.querySelectorAll('.playlist-item').forEach((item, index) => {
    if (index === currentSubmissionIndex) {
      item.classList.add('active');
      // Scroll the active item into view
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

// Detect content type for URLs without clear extensions
async function detectAndRenderContent(mediaUrl: string, submission: any): Promise<void> {
  const visualizerContent = document.getElementById('visualizerContent');
  if (!visualizerContent) return;
  
  try {
    // Try to fetch the content type with a HEAD request first
    const response = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.startsWith('text/html')) {
      // It's HTML content
      visualizerContent.innerHTML = `<iframe src="${mediaUrl}" class="visualizer-media" frameborder="0" allowfullscreen></iframe>`;
    } else if (contentType.startsWith('video/')) {
      // It's video content
      visualizerContent.innerHTML = `<video src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" autoplay loop playsinline></video>`;
      
      // Try to play the video
      const video = visualizerContent.querySelector('video');
      if (video) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Autoplay with sound failed, trying muted playback:', error);
            video.muted = true;
            video.play().catch(e => console.log('Muted playback also failed:', e));
          });
        }
      }
    } else if (contentType.startsWith('image/')) {
      // It's image content
      visualizerContent.innerHTML = `<img src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" />`;
    } else if (contentType.includes('model/gltf-binary') || contentType.includes('model/gltf+json')) {
      // It's a 3D model
      visualizerContent.innerHTML = `
        <model-viewer 
          src="${mediaUrl}" 
          alt="${submission.title || '3D Model'}"
          class="visualizer-media"
          auto-rotate
          camera-controls
          shadow-intensity="1"
          ar
          ar-modes="webxr scene-viewer quick-look"
        ></model-viewer>
      `;
    } else {
      // Unknown content type, use heuristics
      if (mediaUrl.includes('arweave.net') || mediaUrl.includes('ipfs.io')) {
        visualizerContent.innerHTML = `<iframe src="${mediaUrl}" class="visualizer-media" frameborder="0" allowfullscreen></iframe>`;
      } else if (mediaUrl.toLowerCase().includes('.glb') || mediaUrl.toLowerCase().includes('.gltf')) {
        // Try 3D model as fallback
        visualizerContent.innerHTML = `
          <model-viewer 
            src="${mediaUrl}" 
            alt="${submission.title || '3D Model'}"
            class="visualizer-media"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            ar
            ar-modes="webxr scene-viewer quick-look"
          ></model-viewer>
        `;
      } else {
        // Last resort - try as image
        visualizerContent.innerHTML = `<img src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" />`;
      }
    }
  } catch (error) {
    // If we can't determine the content type, use heuristics
    if (mediaUrl.includes('arweave.net')) {
      // Arweave URLs are often HTML content
      visualizerContent.innerHTML = `<iframe src="${mediaUrl}" class="visualizer-media" frameborder="0" allowfullscreen></iframe>`;
    } else {
      // Default fallback - try as image
      visualizerContent.innerHTML = `<img src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" />`;
    }
  }
}

function loadSubmissionIntoVisualizer(submission: any): void {
  const visualizerContent = document.getElementById('visualizerContent');
  if (!visualizerContent) return;
  
  const mediaUrl = submission.picture;
  
  // Check for image extensions first
  const isImage = mediaUrl && (
    mediaUrl.toLowerCase().includes('.jpg') || 
    mediaUrl.toLowerCase().includes('.jpeg') || 
    mediaUrl.toLowerCase().includes('.png') || 
    mediaUrl.toLowerCase().includes('.gif') || 
    mediaUrl.toLowerCase().includes('.webp') || 
    mediaUrl.toLowerCase().includes('.svg') ||
    mediaUrl.toLowerCase().includes('.bmp')
  );
  
  // Then check for video extensions
  const isVideo = mediaUrl && (
    mediaUrl.toLowerCase().includes('.mp4') || 
    mediaUrl.toLowerCase().includes('.webm') || 
    mediaUrl.toLowerCase().includes('.mov') || 
    mediaUrl.toLowerCase().includes('.avi') || 
    mediaUrl.toLowerCase().includes('.m4v')
  );
  
  // Check for 3D model files
  const is3DModel = mediaUrl && (
    mediaUrl.toLowerCase().includes('.glb') || 
    mediaUrl.toLowerCase().includes('.gltf')
  );
  
  // Finally check for HTML (no extension or explicit HTML markers)
  const isHtml = mediaUrl && (
    !mediaUrl.includes('.') || // No extension
    mediaUrl.toLowerCase().includes('.html') || 
    mediaUrl.toLowerCase().includes('.htm') || 
    submission.content_type === 'text/html' || 
    submission.is_html ||
    submission.mime_type === 'text/html' || // Alternative mime type field
    submission.format === 'html' // Alternative format field
  );
  
  if (isImage) {
    // Render as image
    visualizerContent.innerHTML = `<img src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" />`;
  } else if (isVideo) {
    // Render as video
    visualizerContent.innerHTML = `<video src="${mediaUrl}" alt="${submission.title || 'Meme'}" class="visualizer-media" autoplay loop playsinline></video>`;
    
    // Try to play the video with sound if it's a video
    const video = visualizerContent.querySelector('video');
    if (video) {
      // Try to play with sound
      const playPromise = video.play();
      
      // Handle autoplay restrictions
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Autoplay with sound failed, trying muted playback:', error);
          video.muted = true;
          video.play().catch(e => console.log('Muted playback also failed:', e));
        });
      }
    }
  } else if (is3DModel) {
    // Render 3D model using model-viewer
    visualizerContent.innerHTML = `
      <model-viewer 
        src="${mediaUrl}" 
        alt="${submission.title || '3D Model'}"
        class="visualizer-media"
        auto-rotate
        camera-controls
        shadow-intensity="1"
        ar
        ar-modes="webxr scene-viewer quick-look"
      ></model-viewer>
    `;
  } else if (isHtml) {
    // For HTML content, create an iframe to embed it safely
    visualizerContent.innerHTML = `<iframe src="${mediaUrl}" class="visualizer-media" frameborder="0" allowfullscreen></iframe>`;
  } else {
    // For URLs without clear extensions, try to detect content type
    detectAndRenderContent(mediaUrl, submission);
  }
  
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

  // Update Identity TDH to user's assigned TDH for this submission
  try {
    const assignedTDH = (votingData && (votingData as any).userVotesMap)
      ? ((votingData as any).userVotesMap[submission.id] || 0)
      : 0;
    // Keep REP as current availableTDH for now (until we define Meme Artist Rep source)
    const repValue = (votingData && (votingData as any).user)
      ? (votingData as any).user.availableTDH || 0
      : 0;
    
    updateIdentityInfoDisplay(assignedTDH, repValue);
    
    // Update TDH slider position and scale
    updateTDHSlider(assignedTDH, repValue);
  } catch (error) {
    console.error('Error updating identity info:', error);
    // Set slider to 0 position on error
    updateTDHSlider(0, 0);
  }
}

// Update TDH slider position and scale based on current assignment and available TDH
function updateTDHSlider(assignedTDH: number, availableTDH: number): void {
  const tdhSlider = document.getElementById('slider2') as HTMLElement;
  if (!tdhSlider) return;

  // Calculate max TDH (current assigned + available)
  const maxTDH = assignedTDH + availableTDH;
  
  // Calculate position percentage (0-100% of the track)
  const positionPercentage = maxTDH > 0 ? (assignedTDH / maxTDH) * 100 : 0;
  
  // Position the slider on the track
  tdhSlider.style.left = `${positionPercentage}%`;
  
  // Format TDH amount for display (compact) and tooltip (full number)
  const formattedTDH = formatCompactTDH(assignedTDH);
  const tooltipText = `${assignedTDH.toLocaleString()} TDH assigned`;
  
  // Update tooltip with full number
  updateMemeampTooltip(tdhSlider, tooltipText);
  
  // Update the TDH display in the identity window (compact format)
  const identityTdh = document.getElementById('identityTdh');
  if (identityTdh) {
    identityTdh.textContent = formattedTDH;
  }
  
  // Store data on window object for slider interaction
  (window as any).votingData = votingData;
  (window as any).currentAssignedTDH = assignedTDH;
  (window as any).pendingTDHAssignment = assignedTDH;
}

// Format TDH amount to compact notation (max 4 characters)
function formatCompactTDH(amount: number): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(2) + 'M'; // e.g., 2.11M
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'K'; // e.g., 133K
  } else {
    return amount.toString(); // e.g., 999
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
