# memeamp

A simple Ethereum wallet connection website built with vanilla HTML, CSS, and JavaScript using ethers.js.

## Features

- 🔌 Connect Ethereum wallet (MetaMask or any Web3-compatible wallet)
- 📍 Display connected wallet address
- 🌐 Show current network
- 💰 Display ETH balance
- 🔄 Automatic reconnection on page reload
- 📱 Responsive design

## Usage

1. Open `index.html` in a web browser
2. Click "Connect Wallet" button
3. Approve the connection in your Web3 wallet (e.g., MetaMask)
4. View your wallet address, network, and balance

## Requirements

- A Web3-compatible browser wallet (e.g., MetaMask)
- Modern web browser with JavaScript enabled

## Technology Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- ethers.js v5.7.2 (loaded via CDN)

## Local Development

Simply open the `index.html` file in your browser. No build process or server required.

Alternatively, you can use a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server)
npx http-server
```

Then open http://localhost:8000 in your browser.

## License

See LICENSE file for details.