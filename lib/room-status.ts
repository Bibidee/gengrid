export type RoomStatus = 'waiting' | 'scheduled' | 'live' | 'finished';

export type RoomTimingRow = {
  status: RoomStatus;
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * Derives the room's effective status from its stored status + timestamps.
 * The DB only ever stores 'waiting' | 'scheduled' | 'finished' (set by
 * admin actions); 'live' and time-based 'finished' are derived here so
 * every reader agrees on the server clock rather than trusting a stored
 * value that could go stale between admin actions.
 */
export function computeRoomStatus(room: RoomTimingRow): RoomStatus {
  if (room.status === 'finished') return 'finished';

  // A stored 'live' (allowed by the DB CHECK) is treated like 'scheduled':
  // time-based transitions always come from the server clock.
  if ((room.status === 'scheduled' || room.status === 'live') && room.starts_at) {
    const now = Date.now();
    const startsAt = new Date(room.starts_at).getTime();
    const endsAt = room.ends_at ? new Date(room.ends_at).getTime() : Infinity;

    if (now >= endsAt) return 'finished';
    if (now >= startsAt) return 'live';
    return 'scheduled';
  }

  return room.status;
}
