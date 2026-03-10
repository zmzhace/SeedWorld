import type { HookDefinition, HookTrigger } from '@/domain/hooks'

type HookBus = {
  register: (hook: HookDefinition) => void
  emit: (trigger: HookTrigger, payload: unknown) => Promise<void>
}

export function createHookBus(): HookBus {
  const hooks: HookDefinition[] = []

  return {
    register: (hook) => {
      hooks.push(hook)
    },
    emit: async (trigger, payload) => {
      const toRun = hooks
        .filter((hook) => hook.enabled && hook.trigger === trigger)
        .sort((a, b) => a.priority - b.priority)

      for (const hook of toRun) {
        await hook.handler?.(payload)
      }
    },
  }
}
