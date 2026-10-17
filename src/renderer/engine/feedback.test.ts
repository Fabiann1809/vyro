import { describe, expect, it } from 'vitest'
import { FeedbackPrioritizer, type FeedbackMessage, type LiveAlert } from './feedback'
import type { RepQuality, RepResult, RuleOutcome } from './repEvaluator'
import type { Severity } from '@shared/skill/skillSchema'

function failure(ruleId: string, severity: Severity): RuleOutcome {
  return {
    ruleId,
    severity,
    status: 'failed',
    message: { es: `Mensaje ${ruleId}`, en: `Message ${ruleId}` }
  }
}

function repResult(failed: RuleOutcome[], quality?: RepQuality): RepResult {
  const derived: RepQuality =
    failed.length === 0 ? 'good' : failed.some((f) => f.severity === 'high') ? 'bad' : 'needs-work'
  return { repIndex: 1, quality: quality ?? derived, durationMs: 1500, outcomes: failed, failed }
}

const good = (): RepResult => repResult([])

function alert(ruleId: string, severity: Severity = 'high'): LiveAlert {
  return { ruleId, severity, message: { es: `Alerta ${ruleId}`, en: `Alert ${ruleId}` } }
}

describe('corrections after a repetition', () => {
  it('says nothing about a repetition that went well', () => {
    expect(new FeedbackPrioritizer().onRepResult(good(), 0)).toBeNull()
  })

  it('tells the user the rule that failed, in both languages', () => {
    const message = new FeedbackPrioritizer().onRepResult(repResult([failure('depth', 'high')]), 0)

    expect(message).toEqual({
      kind: 'correction',
      ruleId: 'depth',
      severity: 'high',
      message: { es: 'Mensaje depth', en: 'Message depth' },
      live: false
    })
  })

  it('gives only the most severe error when several rules failed', () => {
    const message = new FeedbackPrioritizer().onRepResult(
      repResult([failure('tempo', 'low'), failure('depth', 'high'), failure('torso', 'medium')]),
      0
    )

    expect(message).toMatchObject({ ruleId: 'depth' })
  })

  it('keeps the order of the skill between rules of the same severity', () => {
    const message = new FeedbackPrioritizer().onRepResult(
      repResult([failure('first', 'medium'), failure('second', 'medium')]),
      0
    )

    expect(message).toMatchObject({ ruleId: 'first' })
  })

  it('says nothing when the repetition could not be judged', () => {
    expect(new FeedbackPrioritizer().onRepResult(repResult([], 'unknown'), 0)).toBeNull()
  })
})

describe('the pause between messages', () => {
  const bad = (): RepResult => repResult([failure('depth', 'high')])

  it('drops a message that arrives during the pause', () => {
    const feedback = new FeedbackPrioritizer()

    expect(feedback.onRepResult(bad(), 0)).not.toBeNull()
    expect(feedback.onRepResult(bad(), 1000)).toBeNull()
    expect(feedback.onRepResult(bad(), 2999)).toBeNull()
  })

  it('speaks again once the pause is over, exactly at 3 seconds', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(bad(), 0)

    expect(feedback.onRepResult(bad(), 3000)).not.toBeNull()
  })

  it('counts the pause from the last message that was actually shown', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(bad(), 0)
    feedback.onRepResult(bad(), 2000) // dropped, so it must not restart the pause

    expect(feedback.onRepResult(bad(), 3100)).not.toBeNull()
  })

  it('uses the pause that was configured', () => {
    const feedback = new FeedbackPrioritizer({ cooldownMs: 500 })
    feedback.onRepResult(bad(), 0)

    expect(feedback.onRepResult(bad(), 400)).toBeNull()
    expect(feedback.onRepResult(bad(), 500)).not.toBeNull()
  })

  it('speaks right away the first time', () => {
    expect(new FeedbackPrioritizer().onRepResult(bad(), 0)).not.toBeNull()
  })
})

describe('praise', () => {
  it('praises after three good repetitions in a row, and not before', () => {
    const feedback = new FeedbackPrioritizer()

    expect(feedback.onRepResult(good(), 0)).toBeNull()
    expect(feedback.onRepResult(good(), 4000)).toBeNull()
    expect(feedback.onRepResult(good(), 8000)).toEqual({ kind: 'praise', variant: 0 })
  })

  it('keeps praising every third good repetition and rotates the wording', () => {
    const feedback = new FeedbackPrioritizer({ praiseVariants: 2 })
    const praises = []
    for (let rep = 1; rep <= 9; rep++) {
      const message = feedback.onRepResult(good(), rep * 4000)
      if (message) praises.push(message)
    }

    expect(praises).toEqual([
      { kind: 'praise', variant: 0 },
      { kind: 'praise', variant: 1 },
      { kind: 'praise', variant: 0 }
    ])
  })

  it('starts counting again after a mistake', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(good(), 0)
    feedback.onRepResult(good(), 4000)
    feedback.onRepResult(repResult([failure('depth', 'high')]), 8000)

    expect(feedback.onRepResult(good(), 12000)).toBeNull()
    expect(feedback.onRepResult(good(), 16000)).toBeNull()
    expect(feedback.onRepResult(good(), 20000)).toEqual({ kind: 'praise', variant: 0 })
  })

  it('does not break the streak for a repetition that could not be judged', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(good(), 0)
    feedback.onRepResult(good(), 4000)
    feedback.onRepResult(repResult([], 'unknown'), 8000)

    expect(feedback.onRepResult(good(), 12000)).toEqual({ kind: 'praise', variant: 0 })
  })

  it('respects the pause too', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(repResult([failure('depth', 'high')]), 0)
    feedback.onRepResult(good(), 500)
    feedback.onRepResult(good(), 1000)

    // The third good repetition lands inside the pause that followed the correction.
    expect(feedback.onRepResult(good(), 1500)).toBeNull()
  })
})

describe('live safety alerts', () => {
  const frames = (
    feedback: FeedbackPrioritizer,
    alerts: LiveAlert[],
    count: number,
    from = 0
  ): FeedbackMessage | null => {
    let last: FeedbackMessage | null = null
    for (let frame = 0; frame < count; frame++) {
      last = feedback.onLiveFrame(alerts, from + frame * 33)
    }
    return last
  }

  it('waits until the alert has lasted several frames', () => {
    const feedback = new FeedbackPrioritizer()

    expect(frames(feedback, [alert('back')], 4)).toBeNull()
    expect(feedback.onLiveFrame([alert('back')], 200)).toMatchObject({
      kind: 'correction',
      ruleId: 'back',
      live: true
    })
  })

  it('ignores an alert that comes and goes', () => {
    const feedback = new FeedbackPrioritizer()

    for (let round = 0; round < 10; round++) {
      expect(frames(feedback, [alert('back')], 3, round * 200)).toBeNull()
      expect(feedback.onLiveFrame([], round * 200 + 150)).toBeNull()
    }
  })

  it('counts each alert on its own', () => {
    const feedback = new FeedbackPrioritizer()
    frames(feedback, [alert('back')], 4)

    // "knee" has only just started, "back" has lasted long enough.
    const message = feedback.onLiveFrame([alert('back'), alert('knee')], 200)

    expect(message).toMatchObject({ ruleId: 'back' })
  })

  it('raises the most severe confirmed alert', () => {
    const feedback = new FeedbackPrioritizer()
    const both = [alert('minor', 'low'), alert('major', 'high')]

    expect(frames(feedback, both, 5)).toMatchObject({ ruleId: 'major' })
  })

  it('interrupts the pause that follows a correction', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(repResult([failure('depth', 'high')]), 0)

    expect(frames(feedback, [alert('back')], 5, 100)).toMatchObject({ ruleId: 'back', live: true })
  })

  it('does not repeat itself during the pause', () => {
    const feedback = new FeedbackPrioritizer()
    expect(frames(feedback, [alert('back')], 5)).not.toBeNull()

    expect(feedback.onLiveFrame([alert('back')], 500)).toBeNull()
    expect(feedback.onLiveFrame([alert('back')], 2999)).toBeNull()
    expect(feedback.onLiveFrame([alert('back')], 3200)).not.toBeNull()
  })

  it('holds back a correction after a repetition for the pause that follows an alert', () => {
    const feedback = new FeedbackPrioritizer()
    frames(feedback, [alert('back')], 5)

    expect(feedback.onRepResult(repResult([failure('depth', 'high')]), 1000)).toBeNull()
  })

  it('says nothing when nothing is failing', () => {
    expect(new FeedbackPrioritizer().onLiveFrame([], 0)).toBeNull()
  })
})

describe('reset', () => {
  it('forgets the pause, the streak and the live counters', () => {
    const feedback = new FeedbackPrioritizer()
    feedback.onRepResult(repResult([failure('depth', 'high')]), 0)
    feedback.onRepResult(good(), 4000)
    feedback.onRepResult(good(), 8000)
    feedback.onLiveFrame([alert('back')], 8100)

    feedback.reset()

    // No pause is pending, so a correction is spoken at once.
    expect(feedback.onRepResult(repResult([failure('depth', 'high')]), 8200)).not.toBeNull()
    // The streak starts from zero: two good repetitions are not a third.
    feedback.reset()
    feedback.onRepResult(good(), 20000)
    expect(feedback.onRepResult(good(), 24000)).toBeNull()
    // The live counter starts over, so one more frame is not enough.
    expect(feedback.onLiveFrame([alert('back')], 30000)).toBeNull()
  })
})
