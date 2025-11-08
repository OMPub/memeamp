import './style.css'
import { initWallet } from './wallet'
import type { WalletElements } from './types'

// Create the app HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <header>
      <h1>🎵 Memeamp</h1>
      <p class="tagline">Connect Your Ethereum Wallet</p>
    </header>

    <main>
      <div class="wallet-section">
        <button id="connectButton" class="connect-btn">
          Connect Wallet
        </button>
        
        <div id="walletInfo" class="wallet-info hidden">
          <div class="info-item">
            <span class="label">Connected Address:</span>
            <span id="walletAddress" class="address"></span>
          </div>
          <div class="info-item">
            <span class="label">Network:</span>
            <span id="networkName" class="network"></span>
          </div>
          <div class="info-item">
            <span class="label">Balance:</span>
            <span id="balance" class="balance"></span>
          </div>
          <button id="disconnectButton" class="disconnect-btn">
            Disconnect
          </button>
        </div>

        <div id="errorMessage" class="error-message hidden"></div>
      </div>
    </main>

    <footer>
      <p>Built with ethers.js</p>
    </footer>
  </div>
`

// Initialize wallet functionality
const walletElements: WalletElements = {
  connectButton: document.getElementById('connectButton') as HTMLButtonElement,
  disconnectButton: document.getElementById('disconnectButton') as HTMLButtonElement,
  walletInfo: document.getElementById('walletInfo') as HTMLElement,
  walletAddress: document.getElementById('walletAddress') as HTMLElement,
  networkName: document.getElementById('networkName') as HTMLElement,
  balance: document.getElementById('balance') as HTMLElement,
  errorMessage: document.getElementById('errorMessage') as HTMLElement,
}

initWallet(walletElements)
