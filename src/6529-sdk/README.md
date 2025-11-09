# 6529 Voting SDK

A pure JavaScript/TypeScript library for 6529 voting functionality that works with any wallet connection library.

## Features

- 🔗 **Wallet Agnostic** - Works with any wallet library (MetaMask, WalletConnect, Coinbase, etc.)
- 🔐 **Authentication** - Handle 6529 API authentication with message signing
- 📊 **Data Fetching** - Get submissions, user votes, and TDH balance
- ✅ **Vote Submission** - Submit votes with validation
- 📡 **Event System** - Listen to authentication, voting, and data events
- 💾 **State Management** - Export/import state for session persistence
- 📈 **Statistics** - Built-in voting statistics and analytics
- 🎯 **TypeScript Support** - Full type definitions included

## Installation

### JavaScript
```javascript
// Download the 6529-voting-sdk.js file and include it:
<script src="6529-voting-sdk.js"></script>
<script>
  const sdk = new SixFiveTwoNineVotingSDK();
</script>
```

### TypeScript/ES6
```typescript
import SixFiveTwoNineVotingSDK from './6529-voting-sdk.ts';
// or
import { SixFiveTwoNineVotingSDK } from './6529-voting-sdk';
```

### NPM (if published)
```bash
npm install 6529-voting-sdk
```

## Quick Start

```javascript
// Initialize SDK
const sdk = new SixFiveTwoNineVotingSDK();

// 1. Connect wallet (using any wallet library)
const address = '0x1234...'; // Get from your wallet library
sdk.setWalletAddress(address);

// 2. Authenticate with 6529
async function authenticate() {
  try {
    // Provide your wallet's signMessage function
    const token = await sdk.authenticate(async (message) => {
      return await wallet.signMessage(message); // Your wallet's signing method
    });
    console.log('Authenticated!', token);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

// 3. Get voting data
async function loadVotingData() {
  const data = await sdk.getVotingData();
  console.log('User TDH:', data.user.tdh);
  console.log('Available submissions:', data.submissions.length);
  console.log('Your votes:', data.userVoteDistribution);
}

// 4. Submit a vote
async function vote(dropId, amount) {
  try {
    await sdk.submitVote(dropId, amount);
    console.log('Vote submitted successfully!');
  } catch (error) {
    console.error('Vote failed:', error);
  }
}
```

## API Reference

### Constructor

```javascript
const sdk = new SixFiveTwoNineVotingSDK(options);
```

**Options:**
- `baseURL` (string): 6529 API base URL (default: 'https://api.6529.io')
- `callbacks` (object): Optional callbacks for events
  - `onAuthenticated(token)`: Called when authentication succeeds
  - `onVoteSubmitted(dropId, amount)`: Called when vote is submitted
  - `onError(error)`: Called on any error

### Wallet Connection

```javascript
// Set wallet address after connecting
sdk.setWalletAddress('0x1234...');

// Get current address
const address = sdk.getWalletAddress();

// Check if connected
const isConnected = sdk.isWalletConnected();
```

### Authentication

```javascript
// Authenticate with 6529
const token = await sdk.authenticate(signMessageFunction, optionalAddress);

// Check authentication status
const isAuthed = sdk.isAuthenticated();

// Get access token
const token = sdk.getAccessToken();

// Clear authentication
sdk.clearAuth();
```

### Data Fetching

```javascript
// Get complete voting data
const votingData = await sdk.getVotingData();
// Returns: { user, submissions, userVotes, userVoteDistribution, userVotesMap }

// Get submissions (Overall Leaderboard - sorted by projected TDH votes)
const submissions = await sdk.getSubmissions();

// Get user's voted submissions (My Votes - sorted by user's allocated TDH)
const myVotesData = await sdk.getUserVotedSubmissions();
// Returns: { submissions, userVotesMap, votes, totalVotes }

// Get user identity/TDH
const identity = await sdk.getUserIdentity();

// Refresh user data only
const refreshedData = await sdk.refreshUserData();
```

### Leaderboard Sorting

The SDK provides two different sorting behaviors:

#### Overall Leaderboard (`getSubmissions()`)

- **Sort by:** Projected TDH votes (rating_prediction) descending
- **Purpose:** Shows trending/popular content in the community
- **Use case:** Main leaderboard browsing

#### My Votes (`getUserVotedSubmissions()`)

- **Sort by:** User's allocated TDH descending
- **Purpose:** Shows user's highest-voted submissions first
- **Use case:** Personal voting management
- **Filter:** Only returns submissions the user has voted on

### Voting

```javascript
// Submit a vote
await sdk.submitVote('drop-id', 1000);

// Validate vote amount
const validation = sdk.validateVoteAmount(1000, availableTDH);
if (!validation.valid) {
  console.error(validation.error);
}
```

### Events

```javascript
// Listen to events
sdk.on('authenticated', (data) => {
  console.log('User authenticated:', data.token);
});

sdk.on('voteSubmitted', (data) => {
  console.log('Vote submitted:', data.dropId, data.amount);
});

sdk.on('loadingData', () => {
  showLoadingSpinner();
});

sdk.on('dataLoaded', (data) => {
  updateUI(data);
});

sdk.on('error', (data) => {
  showError(data.error);
});
```

### Available Events

- `walletConnected` - Wallet address set
- `authenticating` - Authentication started
- `authenticated` - Authentication successful
- `authenticationError` - Authentication failed
- `authCleared` - Authentication cleared
- `loadingData` - Started loading voting data
- `dataLoaded` - Voting data loaded
- `dataError` - Data loading failed
- `voting` - Vote submission started
- `voteSubmitted` - Vote submitted successfully
- `voteError` - Vote submission failed
- `userDataRefreshed` - User data refreshed
- `userDataError` - User data refresh failed
- `stateImported` - State imported

### State Management

```javascript
// Export current state
const state = sdk.exportState();
// Save to localStorage/sessionStorage

// Import state (restore session)
sdk.importState(savedState);
```

### Statistics

```javascript
// Get voting statistics
const stats = sdk.getVotingStats(submissions, userVotes);
// Returns: { totalSubmissions, totalVoters, totalTDHPredicted, userVoteCount, userTDHVoted, ... }
```

## Integration Examples

### With MetaMask

```javascript
import SixFiveTwoNineVotingSDK from './6529-voting-sdk';

const sdk = new SixFiveTwoNineVotingSDK();

async function connectMetaMask() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not installed');
  }

  // Request account access
  const accounts = await window.ethereum.request({ 
    method: 'eth_requestAccounts' 
  });
  
  const address = accounts[0];
  sdk.setWalletAddress(address);
  
  // Authenticate
  const token = await sdk.authenticate(async (message) => {
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
  });
  
  return token;
}
```

### With WalletConnect v2

```javascript
import { WalletConnectModal } from '@walletconnect/modal';
import SixFiveTwoNineVotingSDK from './6529-voting-sdk';

const sdk = new SixFiveTwoNineVotingSDK();

async function connectWalletConnect() {
  const walletConnectModal = new WalletConnectModal({
    projectId: 'YOUR_PROJECT_ID',
    chains: [1, 5], // Ethereum, Goerli
  });

  // Connect wallet
  const { accounts, provider } = await walletConnectModal.open();
  const address = accounts[0];
  
  sdk.setWalletAddress(address);
  
  // Authenticate
  const token = await sdk.authenticate(async (message) => {
    return await provider.request({
      method: 'personal_sign',
      params: [message, address]
    });
  });
  
  return token;
}
```

### With Coinbase Wallet

```javascript
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import SixFiveTwoNineVotingSDK from './6529-voting-sdk';

const sdk = new SixFiveTwoNineVotingSDK();

async function connectCoinbase() {
  const coinbaseWallet = new CoinbaseWalletSDK({
    appName: 'My Voting App',
    appLogoUrl: 'https://example.com/logo.png'
  });

  const provider = coinbaseWallet.makeWeb3Provider();
  const accounts = await provider.request({
    method: 'eth_requestAccounts'
  });
  
  const address = accounts[0];
  sdk.setWalletAddress(address);
  
  // Authenticate
  const token = await sdk.authenticate(async (message) => {
    return await provider.request({
      method: 'personal_sign',
      params: [message, address]
    });
  });
  
  return token;
}
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';
import SixFiveTwoNineVotingSDK, { VotingData } from './6529-voting-sdk';

export function use6529Voting() {
  const [sdk] = useState(() => new SixFiveTwoNineVotingSDK());
  const [data, setData] = useState<VotingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up event listeners
    sdk.on('loadingData', () => setLoading(true));
    sdk.on('dataLoaded', (votingData) => {
      setData(votingData);
      setLoading(false);
    });
    sdk.on('dataError', (err) => {
      setError(err.error);
      setLoading(false);
    });
  }, [sdk]);

  const connect = async (address: string, signMessage: (msg: string) => Promise<string>) => {
    try {
      sdk.setWalletAddress(address);
      await sdk.authenticate(signMessage);
      const votingData = await sdk.getVotingData();
      return votingData;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const vote = async (dropId: string, amount: number) => {
    try {
      await sdk.submitVote(dropId, amount);
      await sdk.refreshUserData();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    data,
    loading,
    error,
    connect,
    vote,
    sdk
  };
}
```

## Vue Composable Example

```typescript
import { ref, reactive } from 'vue';
import SixFiveTwoNineVotingSDK from './6529-voting-sdk';

export function use6529Voting() {
  const sdk = new SixFiveTwoNineVotingSDK();
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const connect = async (address: string, signMessage: (msg: string) => Promise<string>) => {
    try {
      sdk.setWalletAddress(address);
      await sdk.authenticate(signMessage);
      data.value = await sdk.getVotingData();
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  };

  const vote = async (dropId: string, amount: number) => {
    try {
      await sdk.submitVote(dropId, amount);
      await sdk.refreshUserData();
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  };

  return {
    data,
    loading,
    error,
    connect,
    vote,
    sdk
  };
}
```

## Error Handling

The SDK provides comprehensive error handling:

```javascript
try {
  await sdk.submitVote('drop-id', 1000);
} catch (error) {
  // Common errors:
  // - "Not authenticated with 6529"
  // - "Valid dropId and positive amount are required"
  // - "Insufficient TDH. Available: X, Requested: Y"
  // - Network errors from the 6529 API
  
  console.error('Vote failed:', error.message);
}
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License - feel free to use in commercial projects!

## Contributing

This SDK is designed to be wallet-agnostic and framework-agnostic. Contributions welcome for:
- Additional wallet integration examples
- Framework-specific hooks/composables
- Performance optimizations
- Additional features

## Support

For issues related to the 6529 API itself, please refer to the official 6529 documentation. For SDK issues, please create an issue in the repository.
