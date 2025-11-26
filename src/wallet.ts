import { ethers } from 'ethers';
import type { WalletState, WalletElements } from './types';
import SixFiveTwoNineVotingSDK, { type VotingData, type WaveActivity } from './6529-sdk';
import { attachMemeampTooltip, updateMemeampTooltip } from './tooltip';
import { formatCompactTDH, normalizeTDHToPattern } from './utils/tdh';

function render3DModel(container: HTMLElement, url: string, submission: any): void {
  container.innerHTML = '';
  const modelViewer = document.createElement('model-viewer');
  modelViewer.setAttribute('src', url);
  modelViewer.setAttribute('alt', submission.title || '3D Model');
  modelViewer.classList.add('visualizer-media');
  modelViewer.setAttribute('auto-rotate', '');
  modelViewer.setAttribute('camera-controls', '');
  modelViewer.setAttribute('shadow-intensity', '1');

  const handleModelError = (error?: Event) => {
    console.warn('model-viewer failed, falling back to static preview', error);
    renderModelFallback(container, url);
  };

  modelViewer.addEventListener('error', handleModelError, { once: true });
  modelViewer.addEventListener('webglcontextlost', handleModelError, { once: true });
  container.appendChild(modelViewer);
}

function renderModelFallback(container: HTMLElement, url: string): void {
  const guidance = getWebGLGuidance();
  container.innerHTML = `
    <div class="visualizer-fallback">
      <p>WebGL unavailable. <a href="${url}" target="_blank" rel="noopener noreferrer">Open model</a></p>
      ${guidance ? `<p class="visualizer-fallback-help">${guidance}</p>` : ''}
    </div>
  `;
}

function getWebGLGuidance(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('brave')) {
    return 'In Brave: open <a href="brave://settings/system">brave://settings/system</a> and enable "Use hardware acceleration when available", then restart Brave.';
  }
  if (ua.includes('edg/')) {
    return 'In Edge: open <a href="edge://settings/system">edge://settings/system</a> and enable "Use hardware acceleration when available", then restart Edge.';
  }
  if (ua.includes('chrome') || ua.includes('crios')) {
    return 'In Chrome: open <a href="chrome://settings/system">chrome://settings/system</a> and enable "Use hardware acceleration when available", then restart Chrome.';
  }
  if (ua.includes('firefox')) {
    return 'In Firefox: open <a href="about:preferences#general">about:preferences#general</a>, enable "Use recommended performance settings" and "Use hardware acceleration when available", then restart Firefox.';
  }
  if (ua.includes('safari') && ua.includes('mac os')) {
    return 'In Safari on macOS: ensure "WebGL" and "Hardware acceleration" are enabled in the Develop menu and system settings, then quit and reopen Safari.';
  }
  return 'To view 3D here, enable hardware acceleration/WebGL in your browser settings and restart your browser.';
}

// State management
let provider: ethers.BrowserProvider | null = null;
let signer: ethers.JsonRpcSigner | null = null;
let userAddress: string | null = null;
let currentSubmissionIndex: number = 0;
let currentSubmissions: any[] = [];
let currentRepAssignment = 0; // slider baseline (>=0)
let currentRepTotalAssigned = 0; // signed total from server
let pendingRepAssignment = 0;
let availableRepCredit = 0;
let currentRepCategory = '';
let currentRepArtistHandle = '';
let repSliderMax = 0;
let repDataRequestId = 0;
let cachedWaveActivity: WaveActivity[] | null = null;
let isLoadingWaveActivity = false;

const apiBaseURL = import.meta.env.DEV ? '/api-6529' : 'https://api.6529.io';

// BOOST emoji set with geometric falloff: first is most common
const BOOST_EMOJI = ['⚡️', '🍒', '🎸', '❤️', '🔥', '🚀', '🥁', '🎶', '😍', '🥰', '🎵', '🎤', '👏'];
const BOOST_EMOJI_CDF: number[] = (() => {
  const r = 0.7;
  const weights = BOOST_EMOJI.map((_, i) => Math.pow(r, i));
  const sum = weights.reduce((acc, w) => acc + w, 0);
  let acc = 0;
  return weights.map(w => {
    acc += w / sum;
    return acc;
  });
})();

let boostUsageCount = 0;

// 6529 SDK
const sdk = new SixFiveTwoNineVotingSDK({ baseURL: apiBaseURL });
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
  
  // Listen for background leaderboard updates
  sdk.on('leaderboardUpdated', (data: any) => {
    if (votingData && data.drops) {
      // Merge the background-loaded drops with existing data
      const allDrops = [...votingData.submissions.slice(0, 20), ...data.drops];
      votingData.submissions = allDrops;
      
      // Update the playlist with the full data (but still only show top 20)
      updatePlaylistWithFullData();
    }
  });
  
  // Add navigation button event listeners
  document.addEventListener('DOMContentLoaded', () => {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const addButton = document.getElementById('addButton');
    const myWavesButton = document.getElementById('myWavesButton');
    
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

    if (myWavesButton) {
      myWavesButton.addEventListener('click', () => {
        loadAndRenderRecentWaves(true).catch((err: unknown) => {
          console.error('Failed to load recent waves', err);
        });
      });
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

    const repButton = document.getElementById('repButton');
    if (repButton) {
      repButton.addEventListener('click', () => {
        assignRepToCurrentSubmission().catch(() => {
          console.error('REP assignment failed');
        });
      });
    }

    // Keyboard controls: arrows for navigation, space/enter for boost
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        (target && target.isContentEditable);

      if (isEditable) return;

      const key = event.key;
      const lower = key.toLowerCase();

      if (key === 'ArrowRight' || key === 'ArrowDown' || lower === 'd' || lower === 's') {
        event.preventDefault();
        if (nextButton) {
          nextButton.classList.add('key-active');
        }
        showNextSubmission();
      } else if (key === 'ArrowLeft' || key === 'ArrowUp' || lower === 'a' || lower === 'w') {
        event.preventDefault();
        if (prevButton) {
          prevButton.classList.add('key-active');
        }
        showPreviousSubmission();
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        if (addButton) {
          addButton.classList.add('key-active');
        }
        if (!event.repeat) {
          boostCurrentSubmission().catch(() => {
            console.error('Boost action failed');
          });
        }
      }
    });

    document.addEventListener('keyup', (event: KeyboardEvent) => {
      const key = event.key;
      const lower = key.toLowerCase();

      if (key === 'ArrowRight' || key === 'ArrowDown' || lower === 'd' || lower === 's') {
        if (nextButton) {
          nextButton.classList.remove('key-active');
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowUp' || lower === 'a' || lower === 'w') {
        if (prevButton) {
          prevButton.classList.remove('key-active');
        }
      } else if (key === 'Enter' || key === ' ') {
        if (addButton) {
          addButton.classList.remove('key-active');
        }
      }
    });

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

function setMemeLoading(elementId: string, message: string = '..'): void {
  const target = document.getElementById(elementId);
  if (target) {
    target.innerHTML = `<span class="tdh-loading">${message}<span class="loading-dots"></span></span>`;
  }
}

function showTdhLoading(message: string = '..'): void {
  setMemeLoading('identityTdh', message);
}

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
    
    // Fetch voting data (includes submissions) - use immediate loading for fast initial display
    votingData = await sdk.getVotingData({ immediate: true });
    
    // Update identity info display
    updateIdentityInfoDisplay(votingData.user.tdh, currentRepAssignment);
    updateBoostTooltip();
    
    // Update the UI with submissions immediately
    const playlistContent = document.getElementById('playlistContent');
    if (playlistContent) {
      currentSubmissions = votingData.submissions.slice(0, 20); // Only show top 20
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
            showTdhLoading('..');
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

    // Preload recent waves for the MY WAVES tray
    loadAndRenderRecentWaves().catch((error: unknown) => {
      console.error('Failed to preload recent waves', error);
    });
    
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

// Update identity info display
function updateIdentityInfoDisplay(tdh: number, rep?: number): void {
  const tdhElement = document.getElementById('identityTdh');
  const repElement = document.getElementById('identityRep');

  if (tdhElement) {
    tdhElement.textContent = formatCompactTDH(tdh);
  }

  if (repElement && rep !== undefined) {
    repElement.textContent = formatRepDisplay(rep);
  }
}

function formatRepDisplay(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const precision = abs >= 10_000 ? 0 : 1;
    return `${sign}${(abs / 1_000).toFixed(precision)}K`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

function formatWaveActivityAgeLabel(latestActivityAt?: number | null): string | null {
  if (latestActivityAt === null || latestActivityAt === undefined) {
    return null;
  }

  if (!Number.isFinite(latestActivityAt)) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const raw = latestActivityAt;
  const activitySeconds = raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  const diff = Math.max(0, nowSeconds - activitySeconds);

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '1m';
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h`;
  }

  const days = Math.floor(diff / day);
  return `${days}d`;
}

async function loadAndRenderRecentWaves(forceRefresh = false): Promise<void> {
  if (!sdk.isWalletConnected() || !sdk.isAuthenticated()) {
    showError('Connect wallet to load your waves.');
    return;
  }

  if (isLoadingWaveActivity) return;

  if (cachedWaveActivity && !forceRefresh) {
    renderWaveActivityTray(cachedWaveActivity);
    return;
  }

  const tray = document.getElementById('myWavesTray');
  if (tray) {
    tray.textContent = '..';
  }

  isLoadingWaveActivity = true;
  try {
    const waves = await sdk.getRecentWaveActivity(5);
    cachedWaveActivity = waves;
    renderWaveActivityTray(waves);
  } catch (error) {
    console.error('Failed to load recent waves:', error);
    showError('Unable to load waves right now.');
  } finally {
    isLoadingWaveActivity = false;
  }
}

function renderWaveActivityTray(waves: WaveActivity[]): void {
  const tray = document.getElementById('myWavesTray');
  if (!tray) return;

  tray.innerHTML = '';

  if (!waves || waves.length === 0) {
    const label = document.createElement('span');
    label.textContent = 'No waves yet';
    tray.appendChild(label);
    return;
  }

  waves.slice(0, 5).forEach(wave => {
    const avatar = document.createElement('div');
    avatar.className = 'my-wave-avatar';
    const activityLabel = formatWaveActivityAgeLabel(wave.latestActivityAt);
    const baseName = wave.name || 'Wave';
    const tooltipText = activityLabel ? `${baseName} - ${activityLabel} ago` : baseName;
    avatar.setAttribute('aria-label', tooltipText);
    attachMemeampTooltip(avatar, tooltipText);

    const avatarInner = document.createElement('div');
    avatarInner.className = 'my-wave-avatar-inner';
    avatar.appendChild(avatarInner);

    if (wave.picture) {
      const img = document.createElement('img');
      img.src = wave.picture;
      img.alt = wave.name || 'Wave';
      avatarInner.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.textContent = (wave.name || '?').charAt(0).toUpperCase();
      fallback.style.display = 'flex';
      fallback.style.alignItems = 'center';
      fallback.style.justifyContent = 'center';
      fallback.style.fontSize = '11px';
      fallback.style.color = '#ffffff';
      avatarInner.appendChild(fallback);
    }

    if (activityLabel) {
      const badge = document.createElement('span');
      badge.className = 'my-wave-activity-badge';
      badge.textContent = activityLabel;
      avatar.appendChild(badge);
    }

    avatar.addEventListener('click', () => {
      if (wave.url) {
        window.open(wave.url, '_blank', 'noopener,noreferrer');
      }
    });

    tray.appendChild(avatar);
  });
}

type EmojiParticle = {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  createdAt: number;
  lifeMs: number;
};

let emojiParticles: EmojiParticle[] = [];
let emojiAnimationFrameId: number | null = null;
let lastEmojiFrameTime = 0;

let activeEmojiDrag: EmojiParticle | null = null;
let activeEmojiPointerId: number | null = null;
let activeEmojiDragOffsetX = 0;
let activeEmojiDragOffsetY = 0;
let lastEmojiDragX = 0;
let lastEmojiDragY = 0;
let lastEmojiDragTime = 0;
let emojiPointerListenersAttached = false;
let lastEmojiSegmentVX = 0;
let lastEmojiSegmentVY = 0;

function sampleEmojiLifetimeMs(): number {
  const mean = 21000; // 21 seconds
  const stdDev = 6000; // spread around the mean
  let u1 = Math.random();
  let u2 = Math.random();
  if (u1 < 1e-6) u1 = 1e-6;
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let ms = mean + z0 * stdDev;
  const min = 12000; // 12 seconds
  const max = 90000; // 90 seconds
  if (ms < min) ms = min;
  if (ms > max) ms = max;
  return ms;
}

function attachEmojiGlobalPointerListeners(): void {
  if (emojiPointerListenersAttached) return;
  emojiPointerListenersAttached = true;

  window.addEventListener('pointermove', handleEmojiPointerMove);
  window.addEventListener('pointerup', handleEmojiPointerUpOrCancel);
  window.addEventListener('pointercancel', handleEmojiPointerUpOrCancel);
}

function handleEmojiPointerDown(event: PointerEvent): void {
  const target = event.currentTarget as HTMLSpanElement | null;
  if (!target || !target.classList.contains('emoji-particle')) {
    return;
  }

  const player = document.querySelector('.player-skin') as HTMLElement | null;
  if (!player) return;

  const rect = player.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  const particle = emojiParticles.find(p => p.el === target);
  if (!particle) return;

  attachEmojiGlobalPointerListeners();

  activeEmojiDrag = particle;
  activeEmojiPointerId = event.pointerId;
  activeEmojiDragOffsetX = particle.x - localX;
  activeEmojiDragOffsetY = particle.y - localY;
  lastEmojiDragX = particle.x;
  lastEmojiDragY = particle.y;
  lastEmojiDragTime = event.timeStamp;
  lastEmojiSegmentVX = 0;
  lastEmojiSegmentVY = 0;

  const now = performance.now();
  particle.createdAt = now;
  particle.lifeMs = sampleEmojiLifetimeMs();
  particle.el.style.opacity = '1';

  event.preventDefault();
  event.stopPropagation();
}

function handleEmojiPointerMove(event: PointerEvent): void {
  if (!activeEmojiDrag || activeEmojiPointerId !== event.pointerId) {
    return;
  }

  const player = document.querySelector('.player-skin') as HTMLElement | null;
  if (!player) return;

  const rect = player.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  const newX = localX + activeEmojiDragOffsetX;
  const newY = localY + activeEmojiDragOffsetY;

   const dxSeg = newX - lastEmojiDragX;
   const dySeg = newY - lastEmojiDragY;
   const dtMs = event.timeStamp - lastEmojiDragTime;
   if (dtMs > 0) {
     const dtSec = dtMs / 1000;
     lastEmojiSegmentVX = dxSeg / dtSec;
     lastEmojiSegmentVY = dySeg / dtSec;
   }

  activeEmojiDrag.x = newX;
  activeEmojiDrag.y = newY;
  lastEmojiDragX = newX;
  lastEmojiDragY = newY;
  lastEmojiDragTime = event.timeStamp;
}

function handleEmojiPointerUpOrCancel(event: PointerEvent): void {
  if (!activeEmojiDrag || activeEmojiPointerId !== event.pointerId) {
    return;
  }

  const particle = activeEmojiDrag;

  const speedScale = 6;
  let vx = lastEmojiSegmentVX * speedScale;
  let vy = lastEmojiSegmentVY * speedScale;

  const speed = Math.hypot(vx, vy);

  if (speed < 200) {
    particle.vx = 0;
    particle.vy = 0;
  } else {
    const maxSpeed = 1600;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      vx *= scale;
      vy *= scale;
    }
    particle.vx = vx;
    particle.vy = vy;
  }

  const spinBase = Math.min(speed / 4, 720);
  const spinSign = Math.sign(vx || 1);
  particle.vr = spinBase * spinSign;

  activeEmojiDrag = null;
  activeEmojiPointerId = null;

  event.preventDefault();
  event.stopPropagation();
}

function pickBoostEmoji(): string {
  const u = Math.random();
  for (let i = 0; i < BOOST_EMOJI_CDF.length; i++) {
    if (u <= BOOST_EMOJI_CDF[i]) return BOOST_EMOJI[i];
  }
  return BOOST_EMOJI[BOOST_EMOJI.length - 1];
}

function triggerBoostEmojiExplosion(): void {
  const player = document.querySelector('.player-skin') as HTMLElement | null;
  if (!player) return;

  const wave = document.querySelector('.wave-visualizer') as HTMLElement | null;
  const playerRect = player.getBoundingClientRect();
  let originX = playerRect.width / 2;
  let originY = playerRect.height * 0.15;

  if (wave) {
    const waveRect = wave.getBoundingClientRect();
    originX = waveRect.left + waveRect.width / 2 - playerRect.left;
    originY = waveRect.top + waveRect.height / 2 - playerRect.top;
  }

  boostUsageCount += 1;
  const baseCount = 18;
  const extra = Math.min(100, boostUsageCount * 5);
  const count = baseCount + extra;

  const now = performance.now();

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = 'emoji-particle';
    span.textContent = pickBoostEmoji();
    span.addEventListener('pointerdown', handleEmojiPointerDown);
    player.appendChild(span);

    const angleSpread = Math.PI / 2; // 90deg cone
    const angleCenter = -Math.PI / 2; // straight up
    const angle = angleCenter + (Math.random() - 0.5) * angleSpread * 2;
    const speed = 320 + Math.random() * 260;

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const rotation = Math.random() * 360;
    const vr = (Math.random() - 0.5) * 360; // deg/sec

    emojiParticles.push({
      el: span,
      x: originX + (Math.random() - 0.5) * 24,
      y: originY + (Math.random() - 0.5) * 12,
      vx,
      vy,
      rotation,
      vr,
      createdAt: now,
      lifeMs: sampleEmojiLifetimeMs(),
    });
  }

  if (!emojiAnimationFrameId) {
    lastEmojiFrameTime = 0;
    emojiAnimationFrameId = requestAnimationFrame(stepEmojiParticles);
  }
}

function stepEmojiParticles(timestamp: number): void {
  const player = document.querySelector('.player-skin') as HTMLElement | null;
  if (!player) {
    emojiParticles.forEach(p => p.el.remove());
    emojiParticles = [];
    emojiAnimationFrameId = null;
    lastEmojiFrameTime = 0;
    return;
  }

  if (!lastEmojiFrameTime) {
    lastEmojiFrameTime = timestamp;
  }
  const dt = (timestamp - lastEmojiFrameTime) / 1000;
  lastEmojiFrameTime = timestamp;

  const rect = player.getBoundingClientRect();
  const width = rect.width - 30; // shrink by 30px to avoid edge collisions
  const height = rect.height;
  const radius = 34; // approximate half of 69px emoji size
  const sideMargin = 6; // keep particles slightly inside left/right edges
  const visualizer = player.querySelector('.visualizer-area') as HTMLElement | null;
  let floor = height - radius;
  if (visualizer) {
    const vRect = visualizer.getBoundingClientRect();
    // Convert visualizer bottom to player-local coordinates and subtract radius
    const localBottom = vRect.bottom - rect.top - radius;
    // Clamp so floor stays within player box
    floor = Math.max(radius, Math.min(height - radius, localBottom));
  }
  const gravity = 900; // px/s^2
  const wallDamping = 0.8;
  const floorDamping = 0.7;

  const nextParticles: EmojiParticle[] = [];

  for (const p of emojiParticles) {
    const ageMs = timestamp - p.createdAt;
    if (ageMs > p.lifeMs) {
      p.el.remove();
      continue;
    }

    const isDraggingThis = activeEmojiDrag === p;

    if (!isDraggingThis) {
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;

      if (p.x < radius + sideMargin) {
        p.x = radius + sideMargin;
        p.vx *= -wallDamping;
      } else if (p.x > width - radius - sideMargin) {
        p.x = width - radius - sideMargin;
        p.vx *= -wallDamping;
      }

      if (p.y > floor) {
        p.y = floor;
        p.vy *= -floorDamping;
        p.vx *= 0.85;
      }
    }

    // Once particles are effectively settled near the floor, ease their spin down
    const nearFloor = p.y >= floor - 1 && Math.abs(p.vy) < 40;
    if (nearFloor && !isDraggingThis) {
      const spinDamp = Math.max(0, 1 - 3 * dt); // strong damping when settled
      p.vr *= spinDamp;
    }

    const lifeT = ageMs / p.lifeMs;
    const remainingMs = Math.max(0, p.lifeMs - ageMs);
    let opacity = 1;
    if (remainingMs <= 6000) {
      const fadeT = remainingMs / 6000; // 1 -> 0 over last 6s
      opacity = fadeT;
    }
    const scale = 0.9 + lifeT * 0.4;

    p.el.style.opacity = opacity.toFixed(2);
    p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.rotation.toFixed(1)}deg) scale(${scale.toFixed(2)})`;

    nextParticles.push(p);
  }

  emojiParticles = nextParticles;

  if (emojiParticles.length > 0) {
    emojiAnimationFrameId = requestAnimationFrame(stepEmojiParticles);
  } else {
    emojiAnimationFrameId = null;
    lastEmojiFrameTime = 0;
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
  let boostAmount = 0;

  if (votingData && currentSubmissions.length > 0) {
    const submission = currentSubmissions[currentSubmissionIndex];
    if (submission) {
      const currentTDH = votingData.userVotesMap?.[submission.id] || 0;
      const maxTDH = currentTDH + availableTDH;
      const rawBoost = calculateBoostAmount(availableTDH);
      const requestedTotal = currentTDH + rawBoost;
      const normalizedTotal = normalizeTDHToPattern(requestedTotal, maxTDH);
      boostAmount = Math.max(0, normalizedTotal - currentTDH);
      // Include normalized total in tooltip so the snapped ...67 pattern is visible
      if (boostAmount > 0) {
        const finalTotal = normalizedTotal;
        updateMemeampTooltip(
          addButton,
          `BOOST: Instantly upvote ${boostAmount.toLocaleString()} MOAR TDH (to ${finalTotal.toLocaleString()} total)`
        );
        if (elements?.errorMessage?.textContent?.includes('Need at least 1 available TDH to boost.')) {
          hideError();
        }
        return;
      }
    } else {
      boostAmount = calculateBoostAmount(availableTDH);
    }
  } else {
    boostAmount = calculateBoostAmount(availableTDH);
  }

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

  const maxTDH = currentTDH + availableTDH;
  const requestedTotal = currentTDH + boostAmount;
  const normalizedTotal = normalizeTDHToPattern(requestedTotal, maxTDH);
  const normalizedBoostAmount = normalizedTotal - currentTDH;

  if (normalizedBoostAmount < 1) {
    restoreTdhDisplay();
    if (addButton) {
      addButton.disabled = false;
    }
    showError('Need at least 1 available TDH to boost.');
    updateBoostTooltip();
    return;
  }

  boostAmount = normalizedBoostAmount;
  const newTotalTDH = normalizedTotal;

  // Visual BOOST effect
  triggerBoostEmojiExplosion();

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
  const voteAmountRaw = (window as any).pendingTDHAssignment;
  const voteAmount = typeof voteAmountRaw === 'number' && Number.isFinite(voteAmountRaw)
    ? Math.round(voteAmountRaw)
    : 0;

  if (voteAmount <= 0) {
    resetTDHSliderState();
    showError('TDH votes must be greater than 0. Clearing a vote to 0 is not supported by the 6529 API from this app.');
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

    const updatedTDH = refreshed.userVotesMap?.[submission.id] ?? voteAmount;
    const availableTDH = refreshed.user?.availableTDH ?? 0;

    updateIdentityInfoDisplay(updatedTDH, availableTDH);
    updateTDHSlider(updatedTDH, availableTDH);

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

        const updatedTDH = refreshed.userVotesMap?.[submission.id] ?? voteAmount;
        const availableTDH = refreshed.user?.availableTDH ?? 0;

        updateIdentityInfoDisplay(updatedTDH, availableTDH);
        updateTDHSlider(updatedTDH, availableTDH);

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
  resetRepButtonState(false);
  showTdhLoading('..');
  const submission = currentSubmissions[currentSubmissionIndex];
  loadSubmissionIntoVisualizer(submission);
  updateActivePlaylistItem();
}

function showPreviousSubmission(): void {
  if (currentSubmissions.length === 0) return;
  
  currentSubmissionIndex = (currentSubmissionIndex - 1 + currentSubmissions.length) % currentSubmissions.length;
  resetRepButtonState(false);
  showTdhLoading('..');
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

// Update playlist with full data when background loading completes
function updatePlaylistWithFullData(): void {
  const playlistContent = document.getElementById('playlistContent');
  if (!playlistContent || !votingData) return;
  
  // Update currentSubmissions with top 20 only
  currentSubmissions = votingData.submissions.slice(0, 20);
  
  // Re-render the playlist with top 20 submissions
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
  
  // Re-add click handlers for all playlist items
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
  
  // Restore the active item
  updateActivePlaylistItem();
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
      render3DModel(visualizerContent, mediaUrl, submission);
    } else {
      // Unknown content type, use heuristics
      if (mediaUrl.includes('arweave.net') || mediaUrl.includes('ipfs.io')) {
        visualizerContent.innerHTML = `<iframe src="${mediaUrl}" class="visualizer-media" frameborder="0" allowfullscreen></iframe>`;
      } else if (mediaUrl.toLowerCase().includes('.glb') || mediaUrl.toLowerCase().includes('.gltf')) {
        // Try 3D model as fallback
        render3DModel(visualizerContent, mediaUrl, submission);
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
    render3DModel(visualizerContent, mediaUrl, submission);
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

    // Fetch REP data for the artist/category
    updateRepDataForSubmission(submission).catch(error => {
      console.error('Failed to load REP data', error);
    });
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

function resetTDHSliderState(): void {
  const assignedTDH = (window as any).currentAssignedTDH || 0;
  const availableTDH = votingData?.user?.availableTDH ?? 0;
  updateTDHSlider(assignedTDH, availableTDH);
}

function showRepLoading(message: string = '..'): void {
  setMemeLoading('identityRep', message);
}

async function updateRepDataForSubmission(submission: any): Promise<void> {
  if (!submission || !submission.author) {
    updateRepSlider(0, 0);
    return;
  }

  const artistIdentity = submission.author.primary_address || submission.author.id || '';
  const category = (submission.title || 'Untitled').trim() || 'Untitled';
  const artistHandle = submission.author?.handle || 'Artist';

  if (!artistIdentity) {
    updateRepSlider(0, 0);
    return;
  }

  const requestId = ++repDataRequestId;
  currentRepCategory = category;
  currentRepArtistHandle = artistHandle;
  resetRepButtonState(false);
  showRepLoading();

  try {
    const [assignedRep, repCredit] = await Promise.all([
      sdk.getRepRating(artistIdentity, category),
      sdk.getRepCredit()
    ]);

    if (requestId !== repDataRequestId) return;

    const assignedValue = assignedRep || 0;
    const creditValue = repCredit.rep_credit || 0;
    updateRepSlider(assignedValue, creditValue);
  } catch (error) {
    console.error('Failed to fetch REP data', error);
    if (requestId !== repDataRequestId) return;
    updateRepSlider(0, 0);
  }
}

function updateRepSlider(assignedRep: number, repCredit: number): void {
  const repSlider = document.getElementById('slider1') as HTMLElement | null;
  const totalAssigned = normalizeInteger(assignedRep);
  const credit = normalizeNonNegative(repCredit);
  const sliderAssigned = Math.max(0, totalAssigned);
  const sliderMax = sliderAssigned + credit;
  repSliderMax = sliderMax;
  currentRepAssignment = sliderAssigned;
  currentRepTotalAssigned = totalAssigned;
  pendingRepAssignment = sliderAssigned;
  availableRepCredit = credit;
  (window as any).currentRepAssignment = currentRepAssignment;
  (window as any).pendingRepAssignment = pendingRepAssignment;
  (window as any).availableRepCredit = availableRepCredit;
  (window as any).repSliderMax = repSliderMax;

  const positionPercentage = repSliderMax > 0 ? (sliderAssigned / repSliderMax) * 100 : 0;
  if (repSlider) {
    repSlider.style.left = `${positionPercentage}%`;
    updateMemeampTooltip(repSlider, formatRepTooltip(sliderAssigned));
  }

  updateIdentityInfoDisplay((window as any).currentAssignedTDH || 0, totalAssigned);
  updateRepButtonState();
}

function handleRepSliderInput(percentage: number): void {
  if (repSliderMax <= 0) return;

  const repSlider = document.getElementById('slider1') as HTMLElement | null;
  const rawValue = Math.round((percentage / 100) * repSliderMax);
  const clampedValue = clampSliderValue(rawValue);
  const snappedValue = normalizeRepToPattern(clampedValue);

  pendingRepAssignment = snappedValue;
  (window as any).pendingRepAssignment = snappedValue;

  if (repSlider) {
    updateMemeampTooltip(repSlider, formatRepTooltip(snappedValue));
  }

  updateIdentityInfoDisplay((window as any).currentAssignedTDH || 0, snappedValue);
  updateRepButtonState();
}

(window as any).handleRepSliderInput = handleRepSliderInput;

function updateRepButtonState(): void {
  const repButton = document.getElementById('repButton');
  if (!repButton) return;

  const delta = pendingRepAssignment - currentRepAssignment;
  const canAssign =
    (delta > 0 && delta <= availableRepCredit) ||
    delta < 0;
  if (canAssign) {
    repButton.classList.add('visible');
  } else {
    repButton.classList.remove('visible');
  }
}

(function exposeRepHandlers() {
  (window as any).handleRepSliderInput = handleRepSliderInput;
  (window as any).resetRepButtonState = resetRepButtonState;
  (window as any).formatRepTooltip = formatRepTooltip;
  (window as any).resetTDHSliderState = resetTDHSliderState;
})();

function formatRepTooltip(amount: number): string {
  const artistLabel = currentRepArtistHandle ? currentRepArtistHandle : 'the artist';
  const titleLabel = currentRepCategory ? currentRepCategory : 'this meme';
  const sanitized = clampSliderValue(amount);
  return `Give ${artistLabel} ${sanitized.toLocaleString()} REP for “${titleLabel}”`;
}

function normalizeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function normalizeNonNegative(value: number): number {
  return Math.max(0, normalizeInteger(value));
}

function clampSliderValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > repSliderMax) return repSliderMax;
  return rounded;
}

function normalizeRepToPattern(value: number): number {
  const max = repSliderMax;
  if (max <= 0) return 0;

  const clamped = clampSliderValue(value);
  const PATTERN_SUFFIX = 67;
  const PATTERN_BLOCK = 100;
  const MIN_PATTERN_VALUE = 1000;

  if (clamped >= max - 2) {
    return max;
  }

  if (clamped < MIN_PATTERN_VALUE || max < MIN_PATTERN_VALUE) {
    return clamped;
  }

  const base = Math.floor(clamped / PATTERN_BLOCK);

  let down = base * PATTERN_BLOCK + PATTERN_SUFFIX;
  if (down > clamped) {
    down = (base - 1) * PATTERN_BLOCK + PATTERN_SUFFIX;
  }
  if (down < MIN_PATTERN_VALUE || down > max) {
    down = Number.NaN;
  }

  let upBase = base;
  if (!Number.isNaN(down) && down < clamped) {
    upBase = base + 1;
  }
  let up = upBase * PATTERN_BLOCK + PATTERN_SUFFIX;
  if (up < MIN_PATTERN_VALUE || up > max) {
    up = Number.NaN;
  }

  if (Number.isNaN(down) && Number.isNaN(up)) {
    return clamped;
  }
  if (Number.isNaN(down)) return up;
  if (Number.isNaN(up)) return down;

  return Math.abs(up - clamped) < Math.abs(clamped - down) ? up : down;
}

function resetRepButtonState(resetPending: boolean = true): void {
  const repButton = document.getElementById('repButton') as HTMLButtonElement | null;
  if (repButton) {
    repButton.classList.remove('visible');
    repButton.classList.remove('loading');
    repButton.removeAttribute('disabled');
  }

  if (resetPending) {
    pendingRepAssignment = currentRepAssignment;
    (window as any).pendingRepAssignment = pendingRepAssignment;
    updateRepButtonState();
    const repSlider = document.getElementById('slider1') as HTMLElement | null;
    if (repSlider && repSliderMax > 0) {
      const positionPercentage = repSliderMax > 0 ? (currentRepAssignment / repSliderMax) * 100 : 0;
      repSlider.style.left = `${positionPercentage}%`;
      updateMemeampTooltip(repSlider, formatRepTooltip(currentRepAssignment));
    }

    const repElement = document.getElementById('identityRep');
    if (repElement) {
      repElement.textContent = formatRepDisplay(currentRepTotalAssigned);
    }
  }
}

async function assignRepToCurrentSubmission(): Promise<void> {
  if (!votingData) {
    showError('Connect your wallet to assign REP.');
    return;
  }

  if (currentSubmissions.length === 0) {
    showError('No submission selected to assign REP.');
    return;
  }

  const submission = currentSubmissions[currentSubmissionIndex];
  if (!submission) {
    showError('Unable to find the current submission.');
    return;
  }

  const repButton = document.getElementById('repButton') as HTMLButtonElement | null;
  const desiredRep = pendingRepAssignment;
  const currentSliderAssigned = Math.max(0, currentRepTotalAssigned);
  const increaseNeeded = Math.max(0, desiredRep - currentSliderAssigned);

  if (increaseNeeded > availableRepCredit) {
    showError('Not enough REP credit available.');
    return;
  }

  const artistIdentity = submission.author?.primary_address || submission.author?.id || '';
  if (!artistIdentity) {
    showError('Artist identity unavailable for REP assignment.');
    return;
  }

  const category = currentRepCategory || (submission.title || 'Untitled').trim() || 'Untitled';

  repButton?.classList.add('loading');
  repButton?.setAttribute('disabled', 'true');
  showRepLoading();

  try {
    await sdk.assignRep(artistIdentity, desiredRep, category);

    const decrease = Math.max(0, currentSliderAssigned - desiredRep);
    availableRepCredit = availableRepCredit - increaseNeeded + decrease;
    currentRepTotalAssigned = desiredRep;
    updateRepSlider(currentRepTotalAssigned, availableRepCredit);
    repButton?.classList.remove('visible');

    // Ensure UI reflects authoritative server value
    updateRepDataForSubmission(submission).catch(err => {
      console.warn('REP refresh failed after assignment', err);
    });
  } catch (error) {
    console.error('REP assignment failed', error);
    showError('REP assignment failed. Please try again.');
    // Revert optimistic update
    await updateRepDataForSubmission(submission);
  } finally {
    repButton?.classList.remove('loading');
    repButton?.removeAttribute('disabled');
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
