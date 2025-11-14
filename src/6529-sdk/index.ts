/**
 * 6529 Voting SDK - TypeScript Version
 * A pure JavaScript library for 6529 voting functionality
 * Works with any wallet connection library
 */

export interface VoteSDKOptions {
  baseURL?: string;
  callbacks?: {
    onAuthenticated?: (token: string) => void;
    onVoteSubmitted?: (dropId: string, amount: number) => void;
    onRepAssigned?: (identity: string, amount: number, category?: string) => void;
    onError?: (error: string) => void;
  };
}

export interface Drop {
  id: string;
  serial_no: number;
  author: {
    id?: string;
    handle: string;
    primary_address: string;
  };
  metadata?: Array<{
    data_key: string;
    data_value: string;
  }>;
  title?: string;
  content: string;
  picture: string;
  raters_count: number;   // Number of people who voted
  rating_prediction: number; // Time-based projection of final TDH votes
  realtime_rating: number;   // Current active TDH votes
  rank: number;
}

export interface Vote {
  drop_id: string;
  rating: number;
  created_at?: string;
}

export interface VoteDistribution {
  drop: Drop;
  voteAmount: number;
}

export interface RepAssignmentResponse {
  total_rep_rating_for_category: number;
  rep_rating_for_category_by_user: number;
}

export interface RepRatingResponse {
  rating: number;
}

export interface UserIdentity {
  tdh: number;
  address: string;
  [key: string]: any;
}

export interface VotingData {
  user: {
    address: string;
    tdh: number;
    availableTDH: number;
    totalVotes: number;
    totalTDHVoted: number;
  };
  submissions: Drop[];
  userVotes: Vote[];
  userVoteDistribution: VoteDistribution[];
  userVotesMap: { [key: string]: number };
}

export interface VotingStats {
  totalSubmissions: number;
  totalVoters: number;
  totalTDHPredicted: number;
  userVoteCount: number;
  userTDHVoted: number;
  averageVotesPerSubmission: number;
  userVotingPercentage: string;
}

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export interface SDKState {
  userAddress: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isWalletConnected: boolean;
}

export type SDKEvent = 
  | 'walletConnected'
  | 'authenticating' 
  | 'authenticated'
  | 'authenticationError'
  | 'authCleared'
  | 'loadingData'
  | 'dataLoaded'
  | 'dataError'
  | 'voting'
  | 'voteSubmitted'
  | 'leaderboardUpdated'
  | 'voteError'
  | 'repAssigning'
  | 'repAssigned'
  | 'repError'
  | 'userDataRefreshed'
  | 'userDataError'
  | 'stateImported';

export interface SDKEventData {
  walletConnected?: { address: string };
  authenticating?: {};
  authenticated?: { token: string };
  authenticationError?: { error: string };
  authCleared?: {};
  loadingData?: {};
  dataLoaded?: VotingData;
  dataError?: { error: string };
  voting?: { dropId: string; amount: number };
  voteSubmitted?: { dropId: string; amount: number; response: any };
  voteError?: { dropId: string; amount: number; error: string };
  leaderboardUpdated?: { drops: any[] };
  repAssigning?: { identity: string; amount: number; category?: string };
  repAssigned?: { identity: string; amount: number; category?: string; response: RepAssignmentResponse };
  repError?: { identity: string; amount: number; category?: string; error: string };
  userDataRefreshed?: { user: any; userVotes: Vote[]; userVotesMap: { [key: string]: number } };
  userDataError?: { error: string };
  stateImported?: SDKState;
}

export type EventCallback<T extends SDKEvent = SDKEvent> = (data: SDKEventData[T]) => void;

export interface SubmissionOptions {
  page?: number;
  pageSize?: number;
  sort?: 'RANK' | 'RATING' | 'VOTES';
  sortDirection?: 'ASC' | 'DESC';
}

export interface VotingDataOptions {
  waveId?: string;
  immediate?: boolean;
}

export class SixFiveTwoNineVotingSDK {
  private baseURL: string;
  private accessToken: string | null = null;
  private userAddress: string | null = null;
  private callbacks: VoteSDKOptions['callbacks'];
  private eventListeners: Map<SDKEvent, EventCallback[]>;

  constructor(options: VoteSDKOptions = {}) {
    this.baseURL = options.baseURL || 'https://api.6529.io';
    this.callbacks = options.callbacks || {};
    this.eventListeners = new Map();
  }

  /**
   * Event management system
   */
  on<T extends SDKEvent>(event: T, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.push(callback as EventCallback);
    }
  }

  off<T extends SDKEvent>(event: T, callback: EventCallback<T>): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback as EventCallback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  private emit<T extends SDKEvent>(event: T, data: SDKEventData[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Set the connected wallet address
   */
  setWalletAddress(address: string): void {
    this.userAddress = address;
    this.emit('walletConnected', { address });
  }

  /**
   * Get current wallet address
   */
  getWalletAddress(): string | null {
    return this.userAddress;
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return !!this.userAddress;
  }

  /**
   * Check if authenticated with 6529
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set access token (for persistence)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.emit('authenticated', { token } as any);
    this.callbacks?.onAuthenticated?.(token);
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.accessToken = null;
    this.userAddress = null;
    this.emit('authCleared', {} as any);
  }

  /**
   * Make authenticated API requests
   */
  private async authenticatedRequest(url: string, options: RequestInit = {}, data?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with 6529. Please call authenticate() first.');
    }

    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    // Merge headers properly to avoid overwrites
    const mergedOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    // Add body if data is provided (for POST/PUT requests)
    if (data !== undefined) {
      mergedOptions.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${url}`, mergedOptions);

    if (!response.ok) {
      let errorData: any;
      try {
        const errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
      } catch {
        errorData = { error: 'Unknown error' };
      }
      
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Get nonce for authentication
   */
  private async getNonce(address: string): Promise<{ data: { nonce: string; server_signature: string } }> {
    const response = await fetch(`${this.baseURL}/api/auth/nonce?signer_address=${address}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get nonce: ${response.statusText} (${response.status})`);
    }
    
    const apiResponse = await response.json();
    
    // Handle both response structures - direct or wrapped in data
    let nonceData;
    if (apiResponse.data) {
      // Response is wrapped in data property
      nonceData = apiResponse.data;
    } else if (apiResponse.nonce && apiResponse.server_signature) {
      // Response is direct
      nonceData = apiResponse;
    } else {
      throw new Error('Invalid response from 6529 API: missing nonce or server_signature');
    }
    
    // Validate nonce data
    if (!nonceData.nonce || !nonceData.server_signature) {
      throw new Error('Invalid response from 6529 API: missing nonce or server_signature');
    }
    
    // Return in expected format for the rest of the SDK
    return { data: nonceData };
  }

  /**
   * Authenticate with 6529 API
   * @param signMessage - Function to sign a message (from wallet library)
   * @param address - Wallet address (optional, uses set address if not provided)
   */
  async authenticate(signMessage: (message: string) => Promise<string>, address?: string): Promise<string> {
    const signerAddress = address || this.userAddress;
    
    if (!signerAddress) {
      throw new Error('No wallet address provided. Set wallet address first.');
    }

    if (!signMessage || typeof signMessage !== 'function') {
      throw new Error('signMessage function is required. Provide a function that can sign messages.');
    }

    try {
      this.emit('authenticating', {});

      // Get nonce
      const nonceResponse = await this.getNonce(signerAddress);
      
      // Sign the nonce
      const signature = await signMessage(nonceResponse.data.nonce);
      
      // Authenticate with 6529
      const authResponse = await fetch(`${this.baseURL}/api/auth/login?signer_address=${signerAddress}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_address: signerAddress,
          client_signature: signature,
          server_signature: nonceResponse.data.server_signature,
          is_safe_wallet: false,
        })
      });

      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      const token = authData?.token;
      
      this.setAccessToken(token);
      
      return token;
    } catch (error) {
      this.emit('authenticationError', { error: (error as Error).message } as any);
      this.callbacks?.onError?.((error as Error).message);
      throw error;
    }
  }

  /**
   * Get user's TDH balance and identity info
   */
  async getUserIdentity(): Promise<UserIdentity> {
    if (!this.userAddress) {
      throw new Error('No wallet address set');
    }

    return this.authenticatedRequest(`/api/identities/${this.userAddress}`);
  }

  
  /**
   * Get Main Stage wave data
   */
  async getWaveInfo(waveId = 'b6128077-ea78-4dd9-b381-52c4eadb2077'): Promise<any> {
    return this.authenticatedRequest(`/api/waves/${waveId}`);
  }

  /**
   * Process raw submissions data for overall leaderboard (sorted by projected votes)
   */
  private processLeaderboardData(rawDrops: any[]): Drop[] {
    // Transform and filter the data
    const allDrops: Drop[] = rawDrops
      .filter((item: any) => {
        const hasRank = item.rank && item.rank > 0;
        const hasRating = item.rating && item.rating > 0;
        const hasVotes = item.vote_count && item.vote_count > 0;
        const hasScore = item.score && item.score > 0;
        const hasMedia = item.parts && item.parts.length > 0 && item.parts[0].media_url;
        const hasImage = item.picture || item.image || item.media_url || (item.parts && item.parts[0]?.media && item.parts[0].media[0]?.url);
        const isNotChat = item.drop_type !== 'CHAT';
        
        return item && (hasRank || hasRating || hasVotes || hasScore || hasMedia || hasImage || isNotChat);
      })
      .sort((a: any, b: any) => {
        // OVERALL LEADERBOARD: Sort by projected TDH votes descending
        const aProjected = a.rating_prediction || 0;
        const bProjected = b.rating_prediction || 0;
        if (aProjected !== bProjected) return bProjected - aProjected;
        
        // Secondary sort: Realtime TDH votes descending
        const aRealtime = a.realtime_rating || 0;
        const bRealtime = b.realtime_rating || 0;
        if (aRealtime !== bRealtime) return bRealtime - aRealtime;
        
        // Tertiary sort: Rank ascending
        const aRank = a.rank || 999999;
        const bRank = b.rank || 999999;
        if (aRank !== bRank) return aRank - bRank;
        
        // Final sort: Vote count descending
        const aVotes = a.vote_count || 0;
        const bVotes = b.vote_count || 0;
        return bVotes - aVotes;
      })
      .map((item: any): Drop => {
        const title = item.metadata?.find((m: any) => m.data_key === 'title')?.data_value;
        const description = item.metadata?.find((m: any) => m.data_key === 'description')?.data_value;
        
        return {
          id: item.id,
          serial_no: item.serial_no,
          author: {
            id: item.author?.id,
            handle: item.author.handle,
            primary_address: item.author.primary_address,
          },
          metadata: item.metadata,
          title: title,
          content: description || "",
          picture: item.parts?.[0]?.media?.[0]?.url || item.parts?.[0]?.picture || item.picture || item.image || "",
          rating_prediction: item.rating_prediction || item.realtime_rating || item.rating || 0,
          raters_count: item.raters_count || 0,
          realtime_rating: item.realtime_rating || 0,
          rank: item.rank || 0
        };
      });

    return allDrops;
  }

  /**
   * Process raw submissions data for user votes (sorted by user's allocated TDH)
   */
  private processUserVotesData(rawDrops: any[], userVotesMap: { [key: string]: number }): Drop[] {
    // Transform and filter the data (only items user has voted on)
    const allDrops: Drop[] = rawDrops
      .filter((item: any) => {
        const hasUserVote = userVotesMap[item.id] && userVotesMap[item.id] > 0;
        const hasRank = item.rank && item.rank > 0;
        const hasRating = item.rating && item.rating > 0;
        const hasVotes = item.vote_count && item.vote_count > 0;
        const hasScore = item.score && item.score > 0;
        const hasMedia = item.parts && item.parts.length > 0 && item.parts[0].media_url;
        const hasImage = item.picture || item.image || item.media_url || (item.parts && item.parts[0]?.media && item.parts[0].media[0]?.url);
        const isNotChat = item.drop_type !== 'CHAT';
        
        return item && hasUserVote && (hasRank || hasRating || hasVotes || hasScore || hasMedia || hasImage || isNotChat);
      })
      .sort((a: any, b: any) => {
        // MY VOTES: Sort by user's allocated TDH descending
        const aUserVote = userVotesMap[a.id] || 0;
        const bUserVote = userVotesMap[b.id] || 0;
        if (aUserVote !== bUserVote) return bUserVote - aUserVote;
        
        // Tie-breaker: Projected TDH votes descending
        const aProjected = a.rating_prediction || 0;
        const bProjected = b.rating_prediction || 0;
        if (aProjected !== bProjected) return bProjected - aProjected;
        
        // Final tie-breaker: Rank ascending
        const aRank = a.rank || 999999;
        const bRank = b.rank || 999999;
        return aRank - bRank;
      })
      .map((item: any): Drop => {
        const title = item.metadata?.find((m: any) => m.data_key === 'title')?.data_value;
        const description = item.metadata?.find((m: any) => m.data_key === 'description')?.data_value;
        
        return {
          id: item.id,
          serial_no: item.serial_no,
          author: {
            id: item.author?.id,
            handle: item.author.handle,
            primary_address: item.author.primary_address,
          },
          metadata: item.metadata,
          title: title,
          content: description || "",
          picture: item.parts?.[0]?.media?.[0]?.url || item.parts?.[0]?.picture || item.picture || item.image || "",
          rating_prediction: item.rating_prediction || item.realtime_rating || item.rating || 0,
          raters_count: item.raters_count || 0,
          realtime_rating: item.realtime_rating || 0,
          rank: item.rank || 0
        };
      });

    return allDrops;
  }

  /**
   * Get Main Stage submissions/leaderboard (Overall Leaderboard - sorted by projected votes)
   */
  async getSubmissions(waveId = 'b6128077-ea78-4dd9-b381-52c4eadb2077', options: SubmissionOptions = {}): Promise<Drop[]> {
    const {
      page = 1,
      pageSize = 100,
      sort = 'RANK',
      sortDirection = 'ASC'
    } = options;

    const response = await this.authenticatedRequest(
      `/api/waves/${waveId}/leaderboard?page_size=${pageSize}&page=${page}&sort=${sort}&sort_direction=${sortDirection}`
    );

    return this.processLeaderboardData(response.drops || []);
  }

  private async fetchAllLeaderboardDrops(
    waveId: string,
    options: { sort?: string; sortDirection?: 'ASC' | 'DESC'; pageSize?: number; immediate?: boolean } = {}
  ): Promise<any[]> {
    const { sort = 'RANK', sortDirection = 'ASC', pageSize = 100, immediate = false } = options;
    
    if (immediate) {
      // For immediate display, return first page only, then load rest in background
      return this.fetchLeaderboardDropsImmediate(waveId, { sort, sortDirection, pageSize });
    }
    
    const allDrops: any[] = [];
    let page = 1;

    while (true) {
      const response = await this.authenticatedRequest(
        `/api/waves/${waveId}/leaderboard?page_size=${pageSize}&page=${page}&sort=${sort}&sort_direction=${sortDirection}`
      );
      const pageDrops = response.drops || [];
      allDrops.push(...pageDrops);

      if (pageDrops.length < pageSize) {
        break;
      }

      page += 1;
    }

    return allDrops;
  }

  private async fetchLeaderboardDropsImmediate(
    waveId: string,
    options: { sort?: string; sortDirection?: 'ASC' | 'DESC'; pageSize?: number } = {}
  ): Promise<any[]> {
    const { sort = 'RANK', sortDirection = 'ASC', pageSize = 100 } = options;
    
    // Get first page immediately
    const firstPageResponse = await this.authenticatedRequest(
      `/api/waves/${waveId}/leaderboard?page_size=${pageSize}&page=1&sort=${sort}&sort_direction=${sortDirection}`
    );
    const firstPageDrops = firstPageResponse.drops || [];
    
    // Start loading remaining pages in background without blocking
    this.loadRemainingPagesInBackground(waveId, { sort, sortDirection, pageSize });
    
    return firstPageDrops;
  }

  private async loadRemainingPagesInBackground(
    waveId: string,
    options: { sort?: string; sortDirection?: 'ASC' | 'DESC'; pageSize?: number } = {}
  ): Promise<void> {
    const { sort = 'RANK', sortDirection = 'ASC', pageSize = 100 } = options;
    
    try {
      const allDrops: any[] = [];
      let page = 2; // Start from page 2 since page 1 is already loaded

      while (true) {
        const response = await this.authenticatedRequest(
          `/api/waves/${waveId}/leaderboard?page_size=${pageSize}&page=${page}&sort=${sort}&sort_direction=${sortDirection}`
        );
        const pageDrops = response.drops || [];
        allDrops.push(...pageDrops);

        if (pageDrops.length < pageSize) {
          break;
        }

        page += 1;
      }

      // Emit event when background loading is complete
      this.emit('leaderboardUpdated', { drops: allDrops });
    } catch (error) {
      console.error('Background leaderboard loading failed:', error);
    }
  }

  /**
   * Get user's voted submissions (My Votes - sorted by user's allocated TDH)
   */
  async getUserVotedSubmissions(waveId = 'b6128077-ea78-4dd9-b381-52c4eadb2077', options: SubmissionOptions = {}): Promise<{ submissions: Drop[]; userVotesMap: { [key: string]: number }; votes: Vote[]; totalVotes: number }> {
    const {
      page = 1,
      pageSize = 100,
      sort = 'RANK',
      sortDirection = 'ASC'
    } = options;

    // Get all submissions (contains user votes in context_profile_context)
    const response = await this.authenticatedRequest(
      `/api/waves/${waveId}/leaderboard?page_size=${pageSize}&page=${page}&sort=${sort}&sort_direction=${sortDirection}`
    );

    // Extract user votes from the same data
    const userVotesMap: { [key: string]: number } = {};
    const votes: Vote[] = [];
    
    (response.drops || []).forEach((item: any) => {
      if (item.id && item.context_profile_context?.rating && item.context_profile_context.rating > 0) {
        const voteAmount = item.context_profile_context.rating;
        userVotesMap[item.id] = voteAmount;
        votes.push({
          drop_id: item.id,
          rating: voteAmount,
          created_at: item.context_profile_context.created_at
        });
      }
    });

    // Process submissions with user votes sorting
    const submissions = this.processUserVotesData(response.drops || [], userVotesMap);

    return {
      submissions,
      userVotesMap,
      votes,
      totalVotes: votes.length
    };
  }

  /**
   * Submit a vote for a drop
   */
  async submitVote(dropId: string, amount: number): Promise<any> {
    if (!dropId || !amount || amount <= 0) {
      throw new Error('Valid dropId and positive amount are required');
    }

    try {
      this.emit('voting', { dropId, amount });

      // Use the same format as the working axios implementation
      const response = await this.authenticatedRequest(`/api/drops/${dropId}/ratings`, {
        method: 'POST'
      }, { rating: amount });

      this.emit('voteSubmitted', { dropId, amount, response } as any);
      this.callbacks?.onVoteSubmitted?.(dropId, amount);
      
      return response;
    } catch (error) {
      this.emit('voteError', { dropId, amount, error: (error as Error).message } as any);
      this.callbacks?.onError?.((error as Error).message);
      throw error;
    }
  }

  /**
   * Assign REP to an identity for a specific category
   */
  async assignRep(identity: string, amount: number, category: string): Promise<RepAssignmentResponse> {
    if (!identity) {
      throw new Error('Target identity is required to assign REP');
    }

    if (!category || !category.trim()) {
      throw new Error('REP category is required');
    }

    if (!amount || amount === 0) {
      throw new Error('REP amount must be a non-zero value');
    }

    try {
      const trimmedCategory = category.trim();
      this.emit('repAssigning', { identity, amount, category: trimmedCategory } as any);

      const response = await this.authenticatedRequest(`/api/profiles/${identity}/rep/rating`, {
        method: 'POST'
      }, { amount, category: trimmedCategory });

      this.emit('repAssigned', { identity, amount, category: trimmedCategory, response } as any);
      this.callbacks?.onRepAssigned?.(identity, amount, trimmedCategory);

      return response as RepAssignmentResponse;
    } catch (error) {
      this.emit('repError', { identity, amount, category, error: (error as Error).message } as any);
      this.callbacks?.onError?.((error as Error).message);
      throw error;
    }
  }

  /**
   * Retrieve the REP rating you (or a specified identity) have assigned to a profile/category
   */
  async getRepRating(identity: string, category?: string, fromIdentity?: string): Promise<number> {
    if (!identity) {
      throw new Error('Target identity is required');
    }

    const params = new URLSearchParams();

    if (category && category.trim()) {
      params.set('category', category.trim());
    }

    const raterIdentity = fromIdentity || this.userAddress || '';
    if (raterIdentity) {
      params.set('from_identity', raterIdentity);
    }

    const query = params.toString();
    const url = query ? `/api/profiles/${identity}/rep/rating?${query}` : `/api/profiles/${identity}/rep/rating`;

    const response = await this.authenticatedRequest(url);
    const repResponse = response as RepRatingResponse;
    return repResponse.rating || 0;
  }

  /**
   * Get complete voting data (user votes + submissions)
   */
  async getVotingData(options: VotingDataOptions = {}): Promise<VotingData> {
    const {
      waveId = 'b6128077-ea78-4dd9-b381-52c4eadb2077',
      immediate = false
    } = options;

    try {
      this.emit('loadingData', {});

      const [userIdentity, leaderboardDrops] = await Promise.all([
        this.getUserIdentity(),
        this.fetchAllLeaderboardDrops(waveId, { immediate })
      ]);

      // Process submissions from leaderboard
      const submissions = this.processLeaderboardData(leaderboardDrops);
      
      // Extract user votes from the same leaderboard data
      const userVotesMap: { [key: string]: number } = {};
      const votes: Vote[] = [];
      
      (leaderboardDrops || []).forEach((item: any) => {
        if (item.id && item.context_profile_context?.rating && item.context_profile_context.rating > 0) {
          const voteAmount = item.context_profile_context.rating;
          userVotesMap[item.id] = voteAmount;
          votes.push({
            drop_id: item.id,
            rating: voteAmount,
            created_at: item.context_profile_context.created_at
          });
        }
      });

      // Calculate user's vote distribution
      const userVoteDistribution: VoteDistribution[] = [];
      submissions.forEach((drop: Drop) => {
        if (userVotesMap[drop.id]) {
          userVoteDistribution.push({
            drop,
            voteAmount: userVotesMap[drop.id]
          });
        }
      });

      // Calculate available TDH
      const totalVoted = Object.values(userVotesMap).reduce((sum: number, val: number) => sum + val, 0);
      const tdh = userIdentity.tdh || 0;
      const availableTDH = tdh - totalVoted;

      const result: VotingData = {
        user: {
          address: this.userAddress || '',
          tdh,
          availableTDH,
          totalVotes: votes.length,
          totalTDHVoted: totalVoted
        },
        submissions,
        userVotes: votes,
        userVoteDistribution,
        userVotesMap
      };

      this.emit('dataLoaded', result);
      return result;
    } catch (error) {
      this.emit('dataError', { error: (error as Error).message } as any);
      this.callbacks?.onError?.((error as Error).message);
      throw error;
    }
  }

  /**
   * Refresh user data only (faster than full refresh)
   */
  async refreshUserData(): Promise<{ user: any; userVotes: Vote[]; userVotesMap: { [key: string]: number } }> {
    try {
      // Get user identity and extract votes from leaderboard
      const [userIdentity, leaderboardDrops] = await Promise.all([
        this.getUserIdentity(),
        this.fetchAllLeaderboardDrops('b6128077-ea78-4dd9-b381-52c4eadb2077')
      ]);

      // Extract user votes from leaderboard data
      const userVotesMap: { [key: string]: number } = {};
      const votes: Vote[] = [];
      
      (leaderboardDrops || []).forEach((item: any) => {
        if (item.id && item.context_profile_context?.rating && item.context_profile_context.rating > 0) {
          const voteAmount = item.context_profile_context.rating;
          userVotesMap[item.id] = voteAmount;
          votes.push({
            drop_id: item.id,
            rating: voteAmount,
            created_at: item.context_profile_context.created_at
          });
        }
      });

      const totalVoted = Object.values(userVotesMap).reduce((sum: number, val: number) => sum + val, 0);
      const tdh = userIdentity.tdh || 0;
      const availableTDH = tdh - totalVoted;

      const result = {
        user: {
          address: this.userAddress || '',
          tdh,
          availableTDH,
          totalVotes: votes.length,
          totalTDHVoted: totalVoted
        },
        userVotes: votes,
        userVotesMap
      };

      this.emit('userDataRefreshed', result);
      return result;
    } catch (error) {
      this.emit('userDataError', { error: (error as Error).message } as any);
      this.callbacks?.onError?.((error as Error).message);
      throw error;
    }
  }

  /**
   * Get statistics about voting
   */
  getVotingStats(submissions: Drop[] = [], userVotes: Vote[] = []): VotingStats {
    const totalSubmissions = submissions.length;
    const totalVoters = submissions.reduce((sum, drop) => sum + (drop.raters_count || 0), 0);
    const totalTDHPredicted = submissions.reduce((sum, drop) => sum + (drop.rating_prediction || 0), 0);
    const userVoteCount = userVotes.length;
    const userTDHVoted = userVotes.reduce((sum, vote) => sum + vote.rating, 0);

    return {
      totalSubmissions,
      totalVoters,
      totalTDHPredicted,
      userVoteCount,
      userTDHVoted,
      averageVotesPerSubmission: totalSubmissions > 0 ? Math.round(totalVoters / totalSubmissions) : 0,
      userVotingPercentage: totalSubmissions > 0 ? ((userVoteCount / totalSubmissions) * 100).toFixed(1) : '0'
    };
  }

  /**
   * Validate vote amount against available TDH
   */
  validateVoteAmount(amount: number, availableTDH: number): ValidationResult {
    if (!amount || amount <= 0) {
      return {
        valid: false,
        error: 'Vote amount must be greater than 0'
      };
    }

    if (amount > availableTDH) {
      return {
        valid: false,
        error: `Insufficient TDH. Available: ${availableTDH.toLocaleString()}, Requested: ${amount.toLocaleString()}`
      };
    }

    return {
      valid: true,
      error: null
    };
  }

  /**
   * Export current state for persistence
   */
  exportState(): SDKState {
    return {
      userAddress: this.userAddress,
      accessToken: this.accessToken,
      isAuthenticated: this.isAuthenticated(),
      isWalletConnected: this.isWalletConnected()
    };
  }

  /**
   * Import state (for session restoration)
   */
  importState(state: SDKState): void {
    if (state.userAddress) {
      this.userAddress = state.userAddress;
    }
    if (state.accessToken) {
      this.accessToken = state.accessToken;
    }
    
    this.emit('stateImported', state);
  }
}

export default SixFiveTwoNineVotingSDK;
