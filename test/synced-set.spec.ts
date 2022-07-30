import { cheapRandomId } from 'everyday-utils'
import { deserialize, serialize } from 'serialize-whatever'
import { SyncedSet } from '../src/synced-set'

class Foo {
  id = cheapRandomId()
  a = 123
  b = false

  constructor(data: Partial<Foo> = {}) {
    Object.assign(this, data)
  }

  toJSON() {
    return this
  }
}

describe('SyncedSet', () => {
  it('creates sets and syncs them', () => {
    const local = new SyncedSet<Foo, { a: number }>({
      send(payload, cb) {
        remote.receive(deserialize(serialize(payload), [Foo]) as any)
        cb()
      },
      pick: ['b'],
      reducer: foo => ({
        a: foo.a,
      }),
      equal: (prev, next) => prev.a === next.a,
    })

    const remote = new SyncedSet<Foo, { b: boolean }>({
      send(payload, cb) {
        local.receive(deserialize(serialize(payload), [Foo]) as any)
        cb()
      },
      pick: ['a'],
      reducer: foo => ({
        b: foo.b,
      }),
      equal: (prev, next) => prev.b === next.b,
    })

    const foo_local = new Foo()
    local.add(foo_local)

    expect(remote.has(foo_local)).toBe(true)
    {
      const [a] = [...local]
      const [b] = [...remote]
      expect(a.id).toBe(b.id)
      expect(a).not.toBe(b)

      a.a = 456
      expect(b.a).toBe(456)

      a.b = true
      expect(b.b).toBe(false)

      a.b = false
      b.b = true
      expect(a.b).toBe(true)

      b.a = 789
      expect(a.a).toBe(456)
    }

    const foo_remote = new Foo()
    remote.add(foo_remote)

    expect(local.has(foo_remote)).toBe(true)
    {
      const [la, lb] = [...local]
      const [ra, rb] = [...remote]

      expect(la.id).toBe(ra.id)
      expect(la).not.toBe(ra)

      expect(lb.id).toBe(rb.id)
      expect(lb).not.toBe(rb)
    }

    expect(local.size).toBe(2)
    expect(remote.size).toBe(2)
    local.delete(foo_remote)
    expect(local.size).toBe(1)
    expect(remote.size).toBe(1)

    expect(remote.has(foo_remote)).toBe(false)
    expect(local.has(foo_local)).toBe(true)

    remote.delete(foo_local)
    expect(local.has(foo_local)).toBe(false)

    expect(local.size).toBe(0)
    expect(remote.size).toBe(0)
  })
})
