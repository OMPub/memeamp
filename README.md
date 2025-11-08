# memeamp

A simple Ethereum wallet connection website built with TypeScript and Vite using ethers.js.

## Features

- 🔌 Connect Ethereum wallet (MetaMask or any Web3-compatible wallet)
- 📍 Display connected wallet address
- 🌐 Show current network
- 💰 Display ETH balance
- 🔄 Automatic reconnection on page reload
- 📱 Responsive design

## Requirements

- Node.js (see `.nvmrc` for version)
- A Web3-compatible browser wallet (e.g., MetaMask)
- Modern web browser with JavaScript enabled

## Technology Stack

- TypeScript
- Vite
- ethers.js v5.8.0
- Modern CSS3

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server (runs on port 6529):

```bash
npm run dev
```

Then open http://localhost:6529 in your browser.

## Build for Production

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Usage

1. Start the development server
2. Click "Connect Wallet" button
3. Approve the connection in your Web3 wallet (e.g., MetaMask)
4. View your wallet address, network, and balance

## License

See LICENSE file for details.