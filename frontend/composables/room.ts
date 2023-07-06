import type { Connection } from './connection'

export function getRooms() {
  return useState('rooms', () => [] as Room[])
}

useConnectionHandlers().value.onConnection = (userId, connection) => {
  const room = new Room()
  room.addConnections(new Map([[userId, connection]]))

  getRooms().value.unshift(room)
}

export async function createRoom(members: string[]) {
  const room = new Room()
  await room.setMembers(members)
  getRooms().value.unshift(room)

  return room
}

interface Message {
  from: string
  message: string
  date: Date
}

export class Room {
  members: Map<string, Connection>
  messages: Message[]

  constructor() {
    this.members = new Map()
    this.messages = reactive([])
  }

  addConnections(members: Map<string, Connection>) {
    this.members = members

    for (const id of this.members.keys())
      this.addConnectionEvents(id)
  }

  async setMembers(memberIds: string[]) {
    const connectionPromises = memberIds.map(id => createConnectionTo(id))
    const connections = await Promise.all(connectionPromises)

    for (const id of memberIds) {
      this.members.set(id, connections.shift()!)
      this.addConnectionEvents(id)
    }
  }

  send(message: string) {
    for (const connection of this.members.values())
      connection.send(message)

    const authUser = getAuthUser()
    this.messages.unshift({
      from: authUser.value!._id,
      message,
      date: new Date(),
    })
  }

  private addConnectionEvents(memberId: string) {
    this.members.get(memberId)!.onMessage = (data) => {
      const message: Message = {
        from: memberId,
        message: data,
        date: new Date(),
      }

      this.messages.unshift(message)
    }
  }
}
