'use client';

export type StoredPlayerSession = {
  session_token: string;
  player_id: string;
  username: string;
  room_code: string;
};

function key(roomCode: string) {
  return `gengrid:session:${roomCode.toUpperCase()}`;
}

export function savePlayerSession(session: StoredPlayerSession) {
  localStorage.setItem(key(session.room_code), JSON.stringify(session));
}

export function loadPlayerSession(roomCode: string): StoredPlayerSession | null {
  const raw = localStorage.getItem(key(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlayerSession;
  } catch {
    return null;
  }
}

function answersKey(roomCode: string) {
  return `gengrid:answers:${roomCode.toUpperCase()}`;
}

export function saveAnswers(roomCode: string, answers: Record<string, string>) {
  localStorage.setItem(answersKey(roomCode), JSON.stringify(answers));
}

export function loadAnswers(roomCode: string): Record<string, string> {
  const raw = localStorage.getItem(answersKey(roomCode));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function submittedKey(roomCode: string) {
  return `gengrid:submitted:${roomCode.toUpperCase()}`;
}

export function markSubmitted(roomCode: string) {
  localStorage.setItem(submittedKey(roomCode), '1');
}

export function hasSubmitted(roomCode: string): boolean {
  return localStorage.getItem(submittedKey(roomCode)) === '1';
}
