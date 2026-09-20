/** Las diez aulas del bootcamp, en el orden en que se numeran. */
export const ROOM_IDS = ['2', '4', '5', '6', '8', '9', '101', '102', '108', '109'] as const

export type RoomId = (typeof ROOM_IDS)[number]

export function isRoomId(value: string): value is RoomId {
  return (ROOM_IDS as readonly string[]).includes(value)
}

export const ROOMS_LABEL = ROOM_IDS.join(', ')
