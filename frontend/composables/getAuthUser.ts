import type { MeUser } from '~/../backend/bindings/MeUser'

export default function () {
  return useState('authUser', () => null as null | MeUser)
}
