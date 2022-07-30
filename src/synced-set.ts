import { dispatch, EventHandler } from 'event-toolkit'
import { accessors } from 'everyday-utils'
import { pick } from 'pick-omit'

export type Id<T> = keyof T

export interface SyncedSetPayload<T> {
  added: Set<T>
  updated: Set<T>
  deleted: Set<T[Id<T>]>
}

export interface SyncedSetOptions<T, R> {
  id: Id<T>
  pick: (keyof T)[]
  send(payload: SyncedSetPayload<T>, cb: () => void): void
  reducer(object: T): R
  equal(prev: R, next: R): boolean
}

export interface SyncedSetOptionsOptionalId<T, R> {
  id?: Id<T>
  pick: (keyof T)[]
  send(payload: SyncedSetPayload<T>, cb: () => void): void
  reducer(object: T): R
  equal(prev: R, next: R): boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SyncedSet<T, R> extends Set<T>, EventTarget {}

export class SyncedSet<T, R> extends EventTarget {
  map = new Map<T[SyncedSetOptions<T, R>['id']], T>()

  added = new Set<T>()
  updated = new Set<T>()
  deleted = new Set<T[SyncedSetOptions<T, R>['id']]>()

  options!: SyncedSetOptions<T, R>

  declare onadd: EventHandler<SyncedSet<T, R>, CustomEvent<T>>
  declare ondelete: EventHandler<SyncedSet<T, R>, CustomEvent<T>>

  constructor(options: SyncedSetOptionsOptionalId<T, R>) {
    super()
    options.id ??= 'id' as keyof T
    this.options = options as SyncedSetOptions<T, R>
  }

  [Symbol.iterator]() {
    return this.map.values()[Symbol.iterator]()
  }

  get size() {
    return this.map.size
  }

  forEach(callback: (value: T, value2: T, set: Set<T>) => void, thisArg?: any) {
    return new Set([...this.map.values()]).forEach(callback, thisArg)
  }

  clear() {
    return this.map.clear()
  }

  send() {
    this.options.send({
      added: this.added,
      updated: this.updated,
      deleted: this.deleted,
    }, () => {
      this.added.clear()
      this.updated.clear()
      this.deleted.clear()
    })
  }

  receive(payload: SyncedSetPayload<T>) {
    for (const id of payload.deleted) {
      this.deleteById(id)
    }
    for (const object of payload.updated) {
      this.update(object)
    }
    for (const object of payload.added) {
      this.add(object, true)
    }
  }

  has(object: T) {
    const id = object[this.options.id]
    return this.map.has(id)
  }

  update(object: T) {
    const id = object[this.options.id]

    if (this.map.has(id)) {
      const local = this.map.get(id)!
      Object.assign(local, pick(object, this.options.pick))
    }
  }

  add(object: T, fromRemote = false) {
    const id = object[this.options.id]

    if (this.map.has(id)) {
      throw new ReferenceError('Object id to be added already in set: ' + id)
    } else {
      this.map.set(id, object)

      const entries = Object.entries(object) as [keyof T, any][]
      const curr = Object.fromEntries(entries) as T

      let prev: R = this.options.reducer(curr)
      let next: R

      accessors(object, object, (key: keyof T) => ({
        get: () => curr[key],
        set: v => {
          if (!this.map.has(id)) return

          curr[key] = v

          next = this.options.reducer(curr)

          if (!this.options.equal(prev, next)) {
            this.updated.add(object)
            this.send()
          }

          prev = next
        },
      }))

      if (!fromRemote) {
        this.added.add(object)
        this.send()
      }

      if (typeof CustomEvent !== 'undefined') {
        dispatch(this as SyncedSet<T, R>, 'add', object)
      }
    }

    return this
  }

  delete(object: T) {
    const id = object[this.options.id]

    if (!this.map.has(id)) {
      throw new ReferenceError('Object id to be delete not found in set: ' + id)
    }

    this.deleteById(id)

    this.deleted.add(id)
    this.send()

    if (typeof CustomEvent !== 'undefined') {
      dispatch(this as SyncedSet<T, R>, 'delete', object)
    }

    return true
  }

  deleteById(id: T[SyncedSetOptions<T, R>['id']]) {
    this.map.delete(id)
  }
}
