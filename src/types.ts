import { ethers } from 'ethers';

export interface WalletState {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  userAddress: string | null;
}

export interface NetworkMap {
  [chainId: number]: string;
}

export interface WalletElements {
  connectButton: HTMLButtonElement;
  disconnectButton: HTMLButtonElement;
  walletInfo: HTMLElement;
  walletAddress: HTMLElement;
  networkName: HTMLElement;
  balance: HTMLElement;
  errorMessage: HTMLElement;
}
