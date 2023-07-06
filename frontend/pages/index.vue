<script setup lang="ts">
import type { MinimalUser } from '~/../backend/bindings/MinimalUser'

definePageMeta({
  middleware: 'auth',
})

const authUser = getAuthUser()

function logout() {
  $api('/logout', { method: 'post' })
    .then(() => { navigateTo('/login') })
    .catch(err => console.error(err))
}

const friendEmail = ref('')
const selectedUser = ref(null as MinimalUser | null)
function getUserByEmail() {
  $api<MinimalUser | null>(`/user/${friendEmail.value}`)
    .then(user => selectedUser.value = user)
    .catch(err => console.error(err))
}

function sendFriendRequest() {
  $api(`/request/${selectedUser.value?._id}`, { method: 'post' })
    .catch(err => console.error(err))
}

const friends = ref([] as MinimalUser[])
function getFriends() {
  $api<MinimalUser[]>('/friends')
    .then(res => friends.value = res)
    .catch(err => console.error(err))
}

const friendRequests = ref([] as MinimalUser[])
function getFriendRequests() {
  $api<MinimalUser[]>('/request')
    .then(res => friendRequests.value = res)
    .catch(err => console.error(err))
}

function declineRequest(request: MinimalUser) {
  $api(`decline/${request._id}`, { method: 'post' })
    .then(() => getFriendRequests())
    .catch(err => console.error(err))
}

function acceptRequest(request: MinimalUser) {
  $api(`accept/${request._id}`, { method: 'post' })
    .then(() => {
      getFriendRequests()
      getFriends()
    })
    .catch(err => console.error(err))
}

function startRoom(partner: MinimalUser) {
  createRoom([partner._id])
    .catch(err => console.error(err))
}

const rooms = getRooms()
const room = computed(() => {
  if (!rooms.value.length)
    return null

  return rooms.value[0]
})

const message = ref('')
function sendMessage() {
  room.value!.send(message.value)
  message.value = ''
}

getFriends()
getFriendRequests()
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <div>
      <p>Logged in as: {{ authUser!.username }}</p>

      <u-button @click="logout()">
        Log out
      </u-button>
    </div>

    <div>
      <u-input v-model="friendEmail" placeholder="Search for user" />
      <p>{{ selectedUser?.username }}</p>

      <u-button @click="getUserByEmail()">
        Search
      </u-button>
      <u-button :disabled="!selectedUser" @click="sendFriendRequest()">
        Send request
      </u-button>
    </div>

    <div>
      <p>Friends:</p>

      <p v-for="friend in friends" :key="friend._id" @click="startRoom(friend)">
        {{ friend.username }}
      </p>
    </div>

    <div v-if="room">
      <u-input v-model="message" placeholder="Write your message here" @keyup.enter="sendMessage()" />

      <p v-for="m in room.messages" :key="m.message">
        <b>{{ m.from }}:</b> {{ m.message }}
      </p>
    </div>

    <u-modal :model-value="!!friendRequests.length">
      <u-card>
        <template #header>
          <h2>Friend request</h2>
        </template>

        <h3>{{ friendRequests[0].username }}</h3>
        <p>{{ friendRequests[0].email }}</p>

        <template #footer>
          <u-button @click="declineRequest(friendRequests[0])">
            Decline
          </u-button>
          <u-button @click="acceptRequest(friendRequests[0])">
            Accept
          </u-button>
        </template>
      </u-card>
    </u-modal>
  </div>
</template>
