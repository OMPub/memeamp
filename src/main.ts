import './style.css'
import { initWallet } from './wallet'
import type { WalletElements } from './types'
import skinImage from './assets/MEMEAMP-skin-with-art-area.png'

// Create the app HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="memeamp-player">
    <!-- Background Skin -->
    <div class="player-skin">
      <img src="${skinImage}" alt="MEMEAMP Player" class="skin-image" />
      
      <!-- Visualizer Area (Main Art Display) -->
      <div class="visualizer-area">
        <div id="visualizerContent" class="visualizer-content">
          <div class="connect-prompt">
            <button id="connectButton" class="connect-btn">
              Connect Wallet to Load Memes
            </button>
          </div>
        </div>
      </div>
      
      <!-- Playlist Section (Top 10 Memes) -->
      <div class="playlist-section">
        <div id="playlistContent" class="playlist-content">
          <div class="playlist-placeholder">
            Connect wallet to load playlist...
          </div>
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
