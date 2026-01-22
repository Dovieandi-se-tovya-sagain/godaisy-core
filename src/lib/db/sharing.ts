// Database schema and utilities for sharing system
export interface Invite {
  id: string;
  userId: string;
  activityId: string;
  activityName: string;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  placeLatLng?: { lat: number; lng: number };
  startTime: string; // ISO string
  endTime: string; // ISO string
  shortUrl: string;
  longUrl: string;
  messageTemplate: string;
  toneHint: 'dm' | 'group';
  createdAt: string;
  expiresAt: string;
  analytics: {
    opens: number;
    clicks: number;
    conversions: number;
  };
}

export interface Poll {
  id: string;
  userId: string;
  activityId: string;
  activityName: string;
  startTime: string; // ISO string
  closesAt: string; // ISO string
  candidates: PollCandidate[];
  shortUrl: string;
  longUrl: string;
  toneHint: 'dm' | 'group';
  status: 'active' | 'closed' | 'expired';
  winnerId?: string;
  createdAt: string;
  analytics: {
    opens: number;
    votes: number;
    uniqueVoters: number;
  };
}

export interface PollCandidate {
  placeId: string;
  name: string;
  address: string;
  latLng: { lat: number; lng: number };
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  votes: number;
  voters: string[]; // device fingerprints or user IDs
}

export interface Vote {
  id: string;
  pollId: string;
  placeId: string;
  deviceFingerprint: string;
  etaMinutes?: number;
  accessibilityNeeded?: boolean;
  votedAt: string;
  ipAddress: string; // for rate limiting
}

export interface ShareToken {
  id: string;
  inviteId?: string;
  pollId?: string;
  sharerId: string;
  recipientHint?: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
  used: boolean;
}

// In-memory storage for development (replace with proper DB later)
const invites = new Map<string, Invite>();
const polls = new Map<string, Poll>();
const votes = new Map<string, Vote>();
const tokens = new Map<string, ShareToken>();

export const db = {
  // Invite operations
  putInvite: (invite: Invite): Promise<Invite> => {
    invites.set(invite.id, invite);
    return Promise.resolve(invite);
  },
  
  getInvite: (id: string): Promise<Invite | null> => {
    return Promise.resolve(invites.get(id) || null);
  },
  
  updateInviteAnalytics: (id: string, field: keyof Invite['analytics'], increment = 1): Promise<void> => {
    const invite = invites.get(id);
    if (invite) {
      invite.analytics[field] += increment;
      invites.set(id, invite);
    }
    return Promise.resolve();
  },

  // Poll operations
  putPoll: (poll: Poll): Promise<Poll> => {
    polls.set(poll.id, poll);
    return Promise.resolve(poll);
  },
  
  getPoll: (id: string): Promise<Poll | null> => {
    return Promise.resolve(polls.get(id) || null);
  },
  
  updatePollAnalytics: (id: string, field: keyof Poll['analytics'], increment = 1): Promise<void> => {
    const poll = polls.get(id);
    if (poll) {
      poll.analytics[field] += increment;
      polls.set(id, poll);
    }
    return Promise.resolve();
  },

  // Vote operations
  putVote: (vote: Vote): Promise<Vote> => {
    votes.set(vote.id, vote);
    
    // Update poll candidate votes
    const poll = polls.get(vote.pollId);
    if (poll) {
      const candidate = poll.candidates.find(c => c.placeId === vote.placeId);
      if (candidate) {
        candidate.votes += 1;
        candidate.voters.push(vote.deviceFingerprint);
        polls.set(poll.id, poll);
      }
    }
    
    return Promise.resolve(vote);
  },
  
  getVotesByPoll: (pollId: string): Promise<Vote[]> => {
    const pollVotes = Array.from(votes.values()).filter(v => v.pollId === pollId);
    return Promise.resolve(pollVotes);
  },
  
  hasVoted: (pollId: string, deviceFingerprint: string): Promise<boolean> => {
    const voted = Array.from(votes.values()).some(
      v => v.pollId === pollId && v.deviceFingerprint === deviceFingerprint
    );
    return Promise.resolve(voted);
  },

  // Token operations
  putToken: (token: ShareToken): Promise<ShareToken> => {
    tokens.set(token.id, token);
    return Promise.resolve(token);
  },
  
  getToken: (id: string): Promise<ShareToken | null> => {
    return Promise.resolve(tokens.get(id) || null);
  },
  
  markTokenUsed: (id: string): Promise<void> => {
    const token = tokens.get(id);
    if (token) {
      token.used = true;
      tokens.set(id, token);
    }
    return Promise.resolve();
  }
};
