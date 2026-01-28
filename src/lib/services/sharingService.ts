// Core sharing service with utilities from share.yml spec
import { db, Invite, Poll, Vote, ShareToken, PollCandidate } from '../db/sharing';
import { generateId, generateShortId } from '../utils/idGenerator';
import { signData } from '../utils/crypto';

// Emoji helpers from share.yml
export const emojiHelpers = {
  bullets: {
    wave: "🌊", swell: "🌊", wind: "💨", gust: "💨", temperature: "🌡️",
    heat: "🌡️", sunshine: "☀️", sun: "☀️", uv: "🌞", clouds: "☁️",
    cloud: "☁️", rain: "🌧️", drizzle: "🌦️", thunder: "⛈️", snow: "❄️",
    ice: "🧊", visibility: "👀", fog: "🌫️", tide: "🌊↕️", safety: "🛟",
    warning: "⚠️", fun: "🎉", fitness: "💪", air_quality: "🌬️", pollen: "🌾"
  },
  
  activities: {
    surfing: "🏄", bodyboarding: "🤙", kayaking: "🛶", sea_kayaking: "🛶",
    stand_up_paddleboarding: "🏄‍♂️", sup_sea: "🏄‍♂️", snorkelling: "🤿",
    diving: "🤿", sailing: "⛵", fishing: "🎣", hiking: "🥾", running: "🏃",
    cycling: "🚴", mountain_biking: "🚵", football: "⚽", climbing: "🧗",
    bouldering: "🧗", yoga: "🧘", gym: "🏋️", skiing: "🎿", snowboarding: "🏂"
  },

  // Apply emojis to reasons list
  emojiReasons: (reasons: string[], max?: number): string[] => {
    const list = reasons.map(reason => {
      const key = Object.keys(emojiHelpers.bullets).find(k => 
        reason.toLowerCase().includes(k.toLowerCase())
      );
      return key ? `${emojiHelpers.bullets[key as keyof typeof emojiHelpers.bullets]} ${reason}` : `• ${reason}`;
    });
    return max ? list.slice(0, max) : list;
  },

  // Join reasons with middle dot
  reasonsLine: (reasons: string[], max?: number): string => {
    const emojiReasons = emojiHelpers.emojiReasons(reasons, max);
    return emojiReasons.join(' • ');
  },

  // Get activity emoji
  emojiFor: (activityId: string): string => {
    return emojiHelpers.activities[activityId as keyof typeof emojiHelpers.activities] || '';
  }
};

// Shared variables required by message templates
export interface MessageVars {
  activityName: string;
  startTime: string;
  venueName?: string;
  addressArea?: string;
  directionsLink?: string;
  shortUrl?: string;
  activityId?: string;
  spotName?: string;
  reasons?: string[];
  ratingWord?: string;
}

// Message templates from share.yml
export const messageTemplates = {
  A_short: (vars: MessageVars) => 
    `Fancy ${vars.activityName}?\n${vars.venueName} • ${vars.startTime}\n${vars.directionsLink}`,
  
  B_detail: (vars: MessageVars) => 
    `${vars.activityName} tonight?\n${vars.venueName} (${vars.addressArea})\nStarts ${vars.startTime} • ${vars.directionsLink}`,
  
  C_emoji: (vars: MessageVars) => 
    `${vars.activityName} 🗓️ ${vars.startTime}\n📍 ${vars.venueName}\n${vars.directionsLink}`,
  
  DM_invite: (vars: MessageVars) => 
    `Fancy ${vars.activityName} at ${vars.venueName}?\n${vars.startTime} • ${vars.directionsLink}\n${vars.shortUrl}`,
  
  GROUP_invite: (vars: MessageVars) => 
    `Fancy ${vars.activityName}?\n${vars.venueName} • ${vars.startTime}\nConfirm here:\n${vars.shortUrl}`,
  
  conditions_invite: (vars: MessageVars) => 
    `${vars.activityName}? ${vars.ratingWord} today ${emojiHelpers.emojiFor(vars.activityId!)}\n${vars.spotName} • ${vars.startTime}\n${emojiHelpers.reasonsLine(vars.reasons || [], 2)}\n${vars.shortUrl}`
};

export class SharingService {
  // Create shortlink (placeholder - implement with actual service)
  static async createShortlink(_longUrl: string, _campaign: string, _tags: string[]): Promise<string> {
    const shortId = generateShortId();
    // TODO: Implement actual shortlink service
    return `https://wtn.to/${shortId}`;
  }

  // Create signed token for attribution
  static async createShareToken(payload: {
    inviteId?: string;
    pollId?: string;
    sharerId: string;
    recipientHint?: string;
  }): Promise<ShareToken> {
    const token: ShareToken = {
      id: generateId(),
      ...payload,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      signature: await signData(JSON.stringify(payload)),
      used: false
    };
    
    return db.putToken(token);
  }

  // Create invite
  static async createInvite(params: {
    userId: string;
    activityId: string;
    activityName: string;
    placeId?: string;
    placeName?: string;
    placeAddress?: string;
    placeLatLng?: { lat: number; lng: number };
    startTime: string;
    duration: number; // minutes
    toneHint: 'dm' | 'group';
  }): Promise<Invite> {
    const endTime = new Date(new Date(params.startTime).getTime() + params.duration * 60000).toISOString();
    const longUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/invite/${generateId()}`;
    const shortUrl = await this.createShortlink(longUrl, 'invite', [params.activityName]);

    const invite: Invite = {
      id: generateId(),
      userId: params.userId,
      activityId: params.activityId,
      activityName: params.activityName,
      placeId: params.placeId,
      placeName: params.placeName,
      placeAddress: params.placeAddress,
      placeLatLng: params.placeLatLng,
      startTime: params.startTime,
      endTime,
      shortUrl,
      longUrl,
      messageTemplate: params.toneHint === 'group' ? 'GROUP_invite' : 'DM_invite',
      toneHint: params.toneHint,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      analytics: { opens: 0, clicks: 0, conversions: 0 }
    };

    return db.putInvite(invite);
  }

  // Create poll
  static async createPoll(params: {
    userId: string;
    activityId: string;
    activityName: string;
    startTime: string;
    candidates: Array<{
      placeId: string;
      name: string;
      address: string;
      latLng: { lat: number; lng: number };
      rating?: number;
      priceLevel?: number;
      photoUrl?: string;
    }>;
    toneHint: 'dm' | 'group';
  }): Promise<Poll> {
    const closesAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const longUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/poll/${generateId()}`;
    const shortUrl = await this.createShortlink(longUrl, 'poll', [params.activityName]);

    const poll: Poll = {
      id: generateId(),
      userId: params.userId,
      activityId: params.activityId,
      activityName: params.activityName,
      startTime: params.startTime,
      closesAt,
      candidates: params.candidates.map(c => ({
        ...c,
        votes: 0,
        voters: []
      })),
      shortUrl,
      longUrl,
      toneHint: params.toneHint,
      status: 'active',
      createdAt: new Date().toISOString(),
      analytics: { opens: 0, votes: 0, uniqueVoters: 0 }
    };

    return db.putPoll(poll);
  }

  // Submit vote
  static async submitVote(params: {
    pollId: string;
    placeId: string;
    deviceFingerprint: string;
    etaMinutes?: number;
    accessibilityNeeded?: boolean;
    ipAddress: string;
  }): Promise<Vote | null> {
    // Check if already voted
    const hasVoted = await db.hasVoted(params.pollId, params.deviceFingerprint);
    if (hasVoted) {
      return null; // Already voted
    }

    // Rate limiting check (basic implementation)
    const recentVotes = await db.getVotesByPoll(params.pollId);
    const recentFromIP = recentVotes.filter(v => 
      v.ipAddress === params.ipAddress && 
      Date.now() - new Date(v.votedAt).getTime() < 60 * 60 * 1000 // 1 hour
    );
    
    if (recentFromIP.length >= 30) { // Rate limit from share.yml
      throw new Error('Rate limit exceeded');
    }

    const vote: Vote = {
      id: generateId(),
      pollId: params.pollId,
      placeId: params.placeId,
      deviceFingerprint: params.deviceFingerprint,
      etaMinutes: params.etaMinutes,
      accessibilityNeeded: params.accessibilityNeeded,
      votedAt: new Date().toISOString(),
      ipAddress: params.ipAddress
    };

    await db.updatePollAnalytics(params.pollId, 'votes');
    await db.updatePollAnalytics(params.pollId, 'uniqueVoters');
    
    return db.putVote(vote);
  }

  // Get poll results and determine winner
  static async getPollResults(pollId: string): Promise<{
    poll: Poll;
    winner?: PollCandidate;
    fairnessScore?: { medianETA: number; maxETA: number; accessibilityFlags: number };
  } | null> {
    const poll = await db.getPoll(pollId);
    if (!poll) return null;

    const votes = await db.getVotesByPoll(pollId);
    
    // Sort candidates by votes (descending)
    const sortedCandidates = [...poll.candidates].sort((a, b) => b.votes - a.votes);
    
    if (sortedCandidates.length === 0) {
      return { poll };
    }

    const winner = sortedCandidates[0];
    
    // Calculate fairness metrics
    const etas = votes
      .filter(v => v.placeId === winner.placeId && v.etaMinutes)
      .map(v => v.etaMinutes!);
    
    const medianETA = etas.length > 0 ? etas.sort()[Math.floor(etas.length / 2)] : 0;
    const maxETA = etas.length > 0 ? Math.max(...etas) : 0;
    
    const fairnessScore = {
      medianETA,
      maxETA,
      accessibilityFlags: votes.filter(v => v.accessibilityNeeded).length
    };

    return { poll, winner, fairnessScore };
  }

  // Generate share message
  static generateShareMessage(template: keyof typeof messageTemplates, vars: MessageVars): string {
    const templateFn = messageTemplates[template];
    return templateFn ? templateFn(vars) : '';
  }
}
