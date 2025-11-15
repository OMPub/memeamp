import './style.css'
import { initWallet } from './wallet'
import type { WalletElements } from './types'
import skinImage from './assets/MEMEAMP-skin.jpg'
import sliderOrange from './assets/slider-orange.png'
import sliderBlue from './assets/slider-blue.png'
import connectWalletImg from './assets/connect-wallet.png'
import brainwaveVideo from './assets/brainwave.mov'
import brainNoWave from './assets/brain-no-wave.png'
import leftBtnDefault from './assets/memeamp-buttons/LEFT_default.png'
import leftBtnHover from './assets/memeamp-buttons/LEFT_hover.png'
import leftBtnClick from './assets/memeamp-buttons/LEFT_click.png'
import rightBtnDefault from './assets/memeamp-buttons/RIGHT_default.png'
import rightBtnHover from './assets/memeamp-buttons/RIGHT_hover.png'
import rightBtnClick from './assets/memeamp-buttons/RIGHT_click.png'
import plusBtnDefault from './assets/memeamp-buttons/PLUS_default.png'
import plusBtnHover from './assets/memeamp-buttons/PLUS_hover.png'
import plusBtnClick from './assets/memeamp-buttons/PLUS_click.png'
import repButtonImg from './assets/rep.png'
import { attachMemeampTooltip, updateMemeampTooltip } from './tooltip'
import { formatCompactTDH, normalizeTDHToPattern } from './utils/tdh'

const modelViewerScript = document.createElement('script')
modelViewerScript.type = 'module'
modelViewerScript.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.0.1/model-viewer.min.js'
document.head.appendChild(modelViewerScript)

// Set CSS variables for images
const htmlStyles = document.documentElement.style
htmlStyles.setProperty('--slider-orange-url', `url(${sliderOrange})`)
htmlStyles.setProperty('--slider-blue-url', `url(${sliderBlue})`)
htmlStyles.setProperty('--connect-wallet-url', `url(${connectWalletImg})`)
htmlStyles.setProperty('--left-btn-default', `url(${leftBtnDefault})`)
htmlStyles.setProperty('--left-btn-hover', `url(${leftBtnHover})`)
htmlStyles.setProperty('--left-btn-click', `url(${leftBtnClick})`)
htmlStyles.setProperty('--right-btn-default', `url(${rightBtnDefault})`)
htmlStyles.setProperty('--right-btn-hover', `url(${rightBtnHover})`)
htmlStyles.setProperty('--right-btn-click', `url(${rightBtnClick})`)
htmlStyles.setProperty('--add-btn-default', `url(${plusBtnDefault})`)
htmlStyles.setProperty('--add-btn-hover', `url(${plusBtnHover})`)
htmlStyles.setProperty('--add-btn-click', `url(${plusBtnClick})`)
htmlStyles.setProperty('--rep-btn-image', `url(${repButtonImg})`)

// Create the app HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="memeamp-player">
    <div class="player-shell">
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
      
      <!-- Identity Info Display -->
      <div class="identity-info">
        <div class="identity-rep">
          <span id="identityRep" class="identity-value">0</span>
        </div>
        <div class="identity-tdh">
          <span id="identityTdh" class="identity-value" title="TDH Voted for this meme">0</span>
        </div>
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
            <button id="connectButton" class="connect-btn-img" aria-label="Connect Wallet"></button>
          </div>
        </div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="nav-buttons">
        <button id="prevButton" class="nav-btn prev-btn" aria-label="Previous Meme"></button>
        <button id="addButton" class="nav-btn add-btn" aria-label="Boost Current Meme"></button>
        <button id="nextButton" class="nav-btn next-btn" aria-label="Next Meme"></button>
        
        <!-- MY WAVES Clickable Area -->
        <button id="myWavesButton" class="my-waves-button" aria-label="Load My Waves"></button>
      </div>
      
      <!-- Action Buttons Under Playlist -->
      <div class="action-buttons">
        <a href="https://6529.io/" target="_blank" class="action-btn" aria-label="!Seize"></a>
        <a href="https://6529.io/nextgen/collections" target="_blank" class="action-btn" aria-label="Next Gen RPT"></a>
        <a href="https://x.com/search?q=from%3Apunk6529%20Whitepaper&src=typed_query" target="_blank" class="action-btn" aria-label="RPT Whitepaper"></a>
        <a href="https://medium.com/@brunopgalvao/substrate-cfeb13333f2c" target="_blank" class="action-btn" aria-label="Make Blkchn"></a>
      </div>
      
      <!-- Post Thread Button -->
      <a href="https://x.com/compose/post?text=Stream the memes on https://memeamp.com by @mintfaced" target="_blank" class="post-thread-btn" aria-label="Post Thread"></a>
      
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
        
        <!-- REP Button - Transparent Overlay (appears when REP is ready to assign) -->
        <button id="repButton" class="rep-button" aria-label="Assign REP"></button>
        <!-- VOTE Button - Transparent Overlay -->
        <button id="voteButton" class="vote-button" aria-label="Vote Current Meme"></button>
        <!-- SUBMIT Button - Transparent Overlay -->
        <button id="submitButton" class="submit-button" aria-label="Submit Vote"></button>
      </div>
      
      <!-- Player Controls Overlay -->
      <div class="player-controls">
        <!-- Invisible disconnect button overlay on top-right X -->
        <button id="disconnectButton" class="skin-x-button" aria-label="Disconnect Wallet"></button>
        
        <!-- Error Display -->
        <div id="errorMessage" class="error-message hidden">
          <button id="errorClose" class="error-close" aria-label="Dismiss">
            <svg width="16" height="16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 10L10 30M10 10L30 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="error-text"></span>
        </div>
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

function applyPlayerScale() {
  const shell = document.querySelector<HTMLElement>('.player-shell')
  const skin = shell?.querySelector<HTMLElement>('.player-skin') ?? null
  if (!shell || !skin) return

  const DESIGN_WIDTH = 600
  const viewportWidth = window.innerWidth
  const widthScale = viewportWidth / DESIGN_WIDTH
  const scale = Math.min(1, widthScale * 0.96)

  const visualWidth = DESIGN_WIDTH * scale
  shell.style.width = `${visualWidth}px`

  skin.style.transformOrigin = 'top left'
  skin.style.transform = `scale(${scale})`
}

// Initialize slider drag functionality
function initSliders() {
  const sliders = document.querySelectorAll('.slider-handle')
  
  sliders.forEach(slider => {
    let isDragging = false
    let container: HTMLElement | null = null
    
    slider.addEventListener('mousedown', (e) => {
      isDragging = true
      container = (slider as HTMLElement).closest('.slider-container')
      e.preventDefault()
    })

    slider.addEventListener('touchstart', (e) => {
      isDragging = true
      container = (slider as HTMLElement).closest('.slider-container')
      e.preventDefault()
    })
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !container) return
      
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      
      ;(slider as HTMLElement).style.left = `${percentage}%`
      
      const sliderId = (slider as HTMLElement).id
      if (sliderId === 'slider2') {
        updateTDHFromSlider(percentage)
        const repReset = (window as any).resetRepButtonState
        if (typeof repReset === 'function') {
          repReset()
        }
      } else if (sliderId === 'slider1') {
        const repHandler = (window as any).handleRepSliderInput
        if (typeof repHandler === 'function') {
          repHandler(percentage)
        }
      }
    })

    document.addEventListener('touchmove', (e) => {
      if (!isDragging || !container) return

      const touch = e.touches[0]
      if (!touch) return

      const rect = container.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))

      ;(slider as HTMLElement).style.left = `${percentage}%`

      const sliderId = (slider as HTMLElement).id
      if (sliderId === 'slider2') {
        updateTDHFromSlider(percentage)
        const repReset = (window as any).resetRepButtonState
        if (typeof repReset === 'function') {
          repReset()
        }
      } else if (sliderId === 'slider1') {
        const repHandler = (window as any).handleRepSliderInput
        if (typeof repHandler === 'function') {
          repHandler(percentage)
        }
      }

      e.preventDefault()
    }, { passive: false })
    
    document.addEventListener('mouseup', () => {
      isDragging = false
      container = null
    })

    document.addEventListener('touchend', () => {
      isDragging = false
      container = null
    })
  })
}

// Update TDH display based on slider position
function updateTDHFromSlider(percentage: number): void {
  // Get current voting data from window (shared with wallet.ts)
  const votingData = (window as any).votingData
  if (!votingData || !votingData.user) return
  
  const availableTDH = votingData.user.availableTDH || 0
  const currentAssignment = (window as any).currentAssignedTDH || 0
  const maxTDH = currentAssignment + availableTDH
  
  // Calculate new TDH assignment based on slider position
  const rawAssignment = Math.round((percentage / 100) * maxTDH)
  const newAssignment = normalizeTDHToPattern(rawAssignment, maxTDH)
  
  // Format TDH amount for display (compact) and tooltip (full number)
  const formattedTDH = formatCompactTDH(newAssignment)
  const tooltipText = `${newAssignment.toLocaleString()} TDH selected`
  
  // Update the TDH display in the identity window (compact format)
  const identityTdh = document.getElementById('identityTdh')
  if (identityTdh) {
    identityTdh.textContent = formattedTDH
  }
  
  // Update the tooltip with full number
  const tdhSlider = document.getElementById('slider2') as HTMLElement
  if (tdhSlider) {
    updateMemeampTooltip(tdhSlider, tooltipText)
  }
  
  // Store the new assignment for submission
  (window as any).pendingTDHAssignment = newAssignment
}

initSliders()

type TooltipTarget = {
  selector: string
  text: string
}

const tooltipTargets: TooltipTarget[] = [
  { selector: '#prevButton', text: 'PREV' },
  { selector: '#addButton', text: 'BOOST: Need at least 1 TDH available' },
  { selector: '#nextButton', text: 'NEXT' },
  { selector: '#myWavesButton', text: 'Load My Waves' },
  { selector: '#repButton', text: 'REP: Assign to artist' },
  { selector: '#disconnectButton', text: 'Disconnect Wallet' },
]

const actionButtonLabels = ['!Seize', 'Next Gen RPT', 'RPT Whitepaper', 'Make Blkchn']

function initTooltips(): void {
  tooltipTargets.forEach(({ selector, text }) => {
    const target = document.querySelector<HTMLElement>(selector)
    if (!target) return
    attachMemeampTooltip(target, text)
  })

  document.querySelectorAll<HTMLAnchorElement>('.action-btn').forEach((el, index) => {
    const label = actionButtonLabels[index] ?? el.getAttribute('aria-label') ?? 'Action'
    attachMemeampTooltip(el, label)
  })

  const postThreadLink = document.querySelector<HTMLAnchorElement>('.post-thread-btn')
  if (postThreadLink) {
    attachMemeampTooltip(postThreadLink, 'Post Thread')
  }
  
  // Initialize TDH slider tooltip
  const tdhSlider = document.getElementById('slider2') as HTMLElement
  if (tdhSlider) {
    attachMemeampTooltip(tdhSlider, '0 TDH selected')
  }

  const repSlider = document.getElementById('slider1') as HTMLElement
  if (repSlider) {
    const repTooltip = (window as any).formatRepTooltip
    if (typeof repTooltip === 'function') {
      attachMemeampTooltip(repSlider, repTooltip(0))
    } else {
      attachMemeampTooltip(repSlider, '0 REP → this meme')
    }
  }

  // Initialize vote button tooltip
  const voteButton = document.getElementById('voteButton') as HTMLElement
  if (voteButton) {
    attachMemeampTooltip(voteButton, 'VOTE: Submit TDH selection')
  }

  // Initialize submit button tooltip
  const submitButton = document.getElementById('submitButton') as HTMLElement
  if (submitButton) {
    attachMemeampTooltip(submitButton, 'SUBMIT: Confirm vote')
  }

  const repButton = document.getElementById('repButton') as HTMLElement
  if (repButton) {
    attachMemeampTooltip(repButton, 'Assign REP to this artist')
  }
}

initTooltips()

applyPlayerScale()
window.addEventListener('resize', applyPlayerScale)
window.addEventListener('orientationchange', applyPlayerScale)
