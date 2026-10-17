import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { VyroApi } from '@shared/ipc'
import type { CoachResult } from '@shared/coach'
import type { PathToSave } from '@shared/paths'
import type { PlanPathResult } from '@shared/pathPlan'
import { resetCoach, useCoach } from './coachStore'
import {
  adjustProposal,
  buildThread,
  retryFromHome,
  saveProposedPath,
  sendFromHome,
  startOver,
  useHomeChat
} from './homeChatStore'
import { usePathPlan, type PlannerSkills } from './pathPlanStore'

const skills: PlannerSkills = [
  { id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: [] }
]

const path: PathToSave = {
  goal: 'Mejorar la sentadilla',
  steps: [
    {
      title: 'Sentadilla',
      description: '',
      kind: 'skill',
      skillId: 'squat',
      criterionSessions: 3,
      criterionScore: 75
    }
  ]
}

interface FakeApi {
  coach: {
    planPath: Mock<VyroApi['coach']['planPath']>
    chat: Mock<VyroApi['coach']['chat']>
  }
  paths: { save: Mock<VyroApi['paths']['save']> }
}

function fakeApi(
  plans: PlanPathResult[],
  chats: string[] = []
): { api: FakeApi; saved: PathToSave[] } {
  const planQueue = [...plans]
  const chatQueue = [...chats]
  const saved: PathToSave[] = []
  return {
    api: {
      coach: {
        planPath: vi.fn(() =>
          Promise.resolve<CoachResult<PlanPathResult>>({
            ok: true,
            value: planQueue.shift() ?? { kind: 'no-matching-skill' }
          })
        ),
        chat: vi.fn(() =>
          Promise.resolve<CoachResult<{ reply: string }>>({
            ok: true,
            value: { reply: chatQueue.shift() ?? 'Hola' }
          })
        )
      },
      paths: {
        save: vi.fn((toSave: PathToSave) => {
          saved.push(toSave)
          return Promise.resolve(1)
        })
      }
    },
    saved
  }
}

const send = (api: FakeApi, text: string, aiEnabled = true): Promise<void> =>
  sendFromHome(api, text, 'es', skills, aiEnabled)

beforeEach(startOver)

describe('the conversation of the home screen', () => {
  it('starts by planning, and keeps the questions of the coach in the thread', async () => {
    const { api } = fakeApi([{ kind: 'question', question: '¿Qué nivel tienes?' }])

    await send(api, 'Quiero mejorar mi sentadilla')

    const thread = buildThread({
      plannerTurns: usePathPlan.getState().turns,
      outcome: usePathPlan.getState().outcome,
      routeStatus: 'proposed',
      coachTurns: useCoach.getState().turns,
      offlineTexts: []
    })
    expect(thread.map((item) => item.kind)).toEqual(['user', 'coach'])
    expect(useHomeChat.getState().mode).toBe('plan')
  })

  it('shows a proposed path as a card, and keeps it only when asked', async () => {
    const { api, saved } = fakeApi([{ kind: 'path', path }])
    await send(api, 'Quiero mejorar mi sentadilla')

    expect(usePathPlan.getState().outcome?.kind).toBe('path')
    expect(saved).toEqual([])

    expect(await saveProposedPath(api)).toBe(true)

    expect(saved).toEqual([path])
    expect(useHomeChat.getState()).toMatchObject({ mode: 'chat', routeStatus: 'saved' })
  })

  it('goes on as a chat once the path is saved', async () => {
    const { api } = fakeApi([{ kind: 'path', path }], ['Claro, empezamos.'])
    await send(api, 'Quiero mejorar mi sentadilla')
    await saveProposedPath(api)

    await send(api, '¿Cuándo empiezo?')

    expect(api.coach.chat).toHaveBeenCalledTimes(1)
    expect(useCoach.getState().turns.map((turn) => turn.text)).toEqual([
      '¿Cuándo empiezo?',
      'Claro, empezamos.'
    ])
  })

  it('reports a path that could not be saved and lets the person try again', async () => {
    const { api } = fakeApi([{ kind: 'path', path }])
    await send(api, 'Quiero mejorar mi sentadilla')
    api.paths.save.mockRejectedValueOnce(new Error('disk'))

    expect(await saveProposedPath(api)).toBe(false)
    expect(useHomeChat.getState().routeStatus).toBe('failed')

    expect(await saveProposedPath(api)).toBe(true)
    expect(useHomeChat.getState().routeStatus).toBe('saved')
  })

  it('does not keep the same path twice', async () => {
    const { api, saved } = fakeApi([{ kind: 'path', path }])
    await send(api, 'Quiero mejorar mi sentadilla')

    await saveProposedPath(api)
    await saveProposedPath(api)

    expect(saved).toHaveLength(1)
  })

  it('takes a message after a proposal as an adjustment and plans again', async () => {
    const { api } = fakeApi([
      { kind: 'path', path },
      { kind: 'path', path }
    ])
    await send(api, 'Quiero mejorar mi sentadilla')

    await send(api, 'Mejor más corta')

    expect(api.coach.planPath).toHaveBeenCalledTimes(2)
    expect(usePathPlan.getState().turns.map((turn) => turn.text)).toEqual([
      'Quiero mejorar mi sentadilla',
      'Mejor más corta'
    ])
  })

  it('starts a new subject after a refusal', async () => {
    const { api } = fakeApi([
      { kind: 'out-of-scope', reasons: ['invisible-outcome'], measurable: [] },
      { kind: 'question', question: '¿Qué nivel?' }
    ])
    await send(api, 'Quiero meditar')

    await send(api, 'Mejor la sentadilla')

    expect(usePathPlan.getState().turns.map((turn) => turn.text)).toEqual([
      'Mejor la sentadilla',
      '¿Qué nivel?'
    ])
  })

  it('removes the proposal when the person wants to adjust it', async () => {
    const { api } = fakeApi([{ kind: 'path', path }])
    await send(api, 'Quiero mejorar mi sentadilla')

    adjustProposal()

    expect(usePathPlan.getState().outcome).toBeNull()
  })

  it('answers with an invitation, and sends nothing, when the coach is off', async () => {
    const { api } = fakeApi([])

    await send(api, 'Quiero mejorar mi sentadilla', false)

    expect(api.coach.planPath).not.toHaveBeenCalled()
    expect(api.coach.chat).not.toHaveBeenCalled()
    expect(
      buildThread({
        plannerTurns: [],
        outcome: null,
        routeStatus: 'proposed',
        coachTurns: [],
        offlineTexts: useHomeChat.getState().offlineTexts
      }).map((item) => item.kind)
    ).toEqual(['user', 'invite'])
  })

  it('ignores an empty message', async () => {
    const { api } = fakeApi([])

    await send(api, '   ')

    expect(api.coach.planPath).not.toHaveBeenCalled()
    expect(useHomeChat.getState().offlineTexts).toEqual([])
  })

  it('asks again in the part of the conversation that is on', async () => {
    const { api } = fakeApi([])
    api.coach.planPath.mockResolvedValueOnce({ ok: false, error: { kind: 'timeout' } })
    await send(api, 'Quiero mejorar mi sentadilla')
    expect(usePathPlan.getState().error).toEqual({ kind: 'timeout' })

    await retryFromHome(api, 'es', skills)

    expect(api.coach.planPath).toHaveBeenCalledTimes(2)
    expect(usePathPlan.getState().error).toBeNull()
  })

  it('forgets everything when starting over', async () => {
    const { api } = fakeApi([{ kind: 'path', path }])
    await send(api, 'Quiero mejorar mi sentadilla')
    await saveProposedPath(api)

    startOver()

    expect(useHomeChat.getState()).toMatchObject({ mode: 'plan', routeStatus: 'proposed' })
    expect(usePathPlan.getState().turns).toEqual([])
    resetCoach()
    expect(useCoach.getState().turns).toEqual([])
  })
})

describe('buildThread', () => {
  it('puts the outcome after the planning and before the chat', () => {
    const thread = buildThread({
      plannerTurns: [{ role: 'user', text: 'Quiero' }],
      outcome: { kind: 'no-matching-skill' },
      routeStatus: 'proposed',
      coachTurns: [{ role: 'user', text: 'Y ahora' }],
      offlineTexts: []
    })

    expect(thread.map((item) => item.kind)).toEqual(['user', 'reject', 'user'])
  })

  it('gives each item its own key', () => {
    const thread = buildThread({
      plannerTurns: [
        { role: 'user', text: 'a' },
        { role: 'assistant', text: 'b' }
      ],
      outcome: { kind: 'path', path },
      routeStatus: 'saved',
      coachTurns: [{ role: 'user', text: 'c' }],
      offlineTexts: ['d']
    })

    expect(new Set(thread.map((item) => item.key)).size).toBe(thread.length)
    expect(thread.find((item) => item.kind === 'route')).toMatchObject({ status: 'saved' })
  })
})
