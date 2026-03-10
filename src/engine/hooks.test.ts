import { describe, it, expect } from 'vitest'
import { createHookBus } from './hooks'

it('runs enabled hooks in priority order', async () => {
  const calls: string[] = []
  const bus = createHookBus()

  bus.register({ id: 'b', trigger: 'before_action', priority: 20, enabled: true, scope: 'personal', handler: async () => calls.push('b') })
  bus.register({ id: 'a', trigger: 'before_action', priority: 10, enabled: true, scope: 'personal', handler: async () => calls.push('a') })

  await bus.emit('before_action', {})

  expect(calls).toEqual(['a', 'b'])
})
