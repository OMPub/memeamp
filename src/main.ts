import './style.css'
import { initWallet } from './wallet'
import type { WalletElements } from './types'
import skinImage from './assets/MEMEAMP-skin-with-art-area.png'
import sliderOrange from './assets/slider-orange.png'
import sliderBlue from './assets/slider-blue.png'
import connectWalletImg from './assets/connect-wallet.png'
import brainwaveVideo from './assets/brainwave.mov'
import brainNoWave from './assets/brain-no-wave.png'

// Set CSS variables for slider images
document.documentElement.style.setProperty('--slider-orange-url', `url(${sliderOrange})`);
document.documentElement.style.setProperty('--slider-blue-url', `url(${sliderBlue})`);
document.documentElement.style.setProperty('--connect-wallet-url', `url(${connectWalletImg})`);

// Create the app HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="memeamp-player">
    <!-- Background Skin -->
    <div class="player-skin">
      <img src="${skinImage}" alt="MEMEAMP Player" class="skin-image" />
      
      <!-- Wave Visualizer (Upper Left) -->
      <div class="wave-visualizer">
        <img src="${brainNoWave}" class="brain-no-wave" alt="Brain No Wave" />
        <video src="${brainwaveVideo}" class="brainwave-video" autoplay loop muted playsinline style="display: none;"></video>
      </div>
      
      <!-- Now Playing Display -->
      <div class="now-playing">
        <div id="nowPlayingText" class="now-playing-text"></div>
      </div>
      
      <!-- Visualizer Area (Main Art Display) -->
      <div class="visualizer-area">
        <div id="visualizerContent" class="visualizer-content">
        </div>
      </div>
      
      <!-- Playlist Section (Top 10 Memes) -->
      <div class="playlist-section">
        <div id="playlistContent" class="playlist-content">
          <div class="playlist-placeholder">
            <button id="connectButton" class="connect-btn-img"></button>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons Under Playlist -->
      <div class="action-buttons">
        <a href="https://6529.io/" target="_blank" class="action-btn" title="!Seize"></a>
        <a href="https://6529.io/nextgen/collections" target="_blank" class="action-btn" title="Next Gen RPT"></a>
        <a href="https://x.com/search?q=from%3Apunk6529%20Whitepaper&src=typed_query" target="_blank" class="action-btn" title="RPT Whitepaper"></a>
        <a href="https://medium.com/@brunopgalvao/substrate-cfeb13333f2c" target="_blank" class="action-btn" title="Make Blkchn"></a>
      </div>
      
      <!-- Post Thread Button -->
      <a href="https://x.com/compose/post?text=Stream the memes on https://memeamp.com by @mintfaced" target="_blank" class="post-thread-btn" title="Post Thread"></a>
      
      <!-- Slider Controls -->
      <div class="slider-controls">
        <div class="slider-container">
          <div class="slider-track"></div>
          <div class="slider-handle orange" id="slider1" style="left: 30%"></div>
        </div>
        <div class="slider-container">
          <div class="slider-track"></div>
          <div class="slider-handle blue" id="slider2" style="left: 60%"></div>
        </div>
      </div>
      
      <!-- Player Controls Overlay -->
      <div class="player-controls">
        <!-- Invisible disconnect button overlay on top-right X -->
        <button id="disconnectButton" class="skin-x-button" title="Disconnect Wallet"></button>
        
        <!-- Error Display -->
        <div id="errorMessage" class="error-message hidden"></div>
      </div>
    </div>
  </div>
`

// Initialize wallet functionality
const walletElements: WalletElements = {
  connectButton: document.getElementById('connectButton') as HTMLButtonElement,
  disconnectButton: document.getElementById('disconnectButton') as HTMLButtonElement,
  walletInfo: document.createElement('div'), // Hidden element (not displayed in new UI)
  walletAddress: document.createElement('div'), // Hidden element (not displayed in new UI)
  networkName: document.createElement('div'), // Hidden element (not displayed in new UI)
  balance: document.createElement('div'), // Hidden element (not displayed in new UI)
  errorMessage: document.getElementById('errorMessage') as HTMLElement,
}

initWallet(walletElements)

// Initialize slider drag functionality
function initSliders() {
  const sliders = document.querySelectorAll('.slider-handle');
  
  sliders.forEach(slider => {
    let isDragging = false;
    let container: HTMLElement | null = null;
    
    slider.addEventListener('mousedown', (e) => {
      isDragging = true;
      container = (slider as HTMLElement).closest('.slider-container');
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      
      (slider as HTMLElement).style.left = `${percentage}%`;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      container = null;
    });
  });
}

initSliders()
