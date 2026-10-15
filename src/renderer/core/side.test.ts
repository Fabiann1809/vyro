import { describe, expect, it } from 'vitest'
import { POSE_LANDMARK_COUNT, type Landmark } from './landmarks'
import {
  JOINT_INDEX,
  joint,
  pickVisibleSide,
  SIDE_SWITCH_MARGIN,
  SideTracker,
  sideScore
} from './side'

// A pose where the left side has `left` visibility and the right side has `right`.
function pose(left: number, right: number): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0
  }))
  for (const side of ['left', 'right'] as const) {
    for (const index of Object.values(JOINT_INDEX[side])) {
      landmarks[index] = { x: 0.5, y: 0.5, z: 0, visibility: side === 'left' ? left : right }
    }
  }
  return landmarks
}

describe('pickVisibleSide', () => {
  it('picks the left side when it is the one facing the camera', () => {
    expect(pickVisibleSide(pose(0.95, 0.2))).toBe('left')
  })

  it('picks the right side when it is the one facing the camera', () => {
    expect(pickVisibleSide(pose(0.2, 0.95))).toBe('right')
  })

  it('returns null when neither side is in view', () => {
    expect(pickVisibleSide(pose(0.1, 0.2))).toBeNull()
  })

  it('returns null when nobody is in view', () => {
    expect(pickVisibleSide(null)).toBeNull()
  })

  it('breaks a tie towards the left side', () => {
    expect(pickVisibleSide(pose(0.8, 0.8))).toBe('left')
  })

  it('still picks a side when it is only partly visible', () => {
    expect(pickVisibleSide(pose(0.1, 0.55))).toBe('right')
  })
})

describe('sideScore', () => {
  it('is the average visibility of the main joints', () => {
    expect(sideScore(pose(0.6, 0.2), 'left')).toBeCloseTo(0.6)
    expect(sideScore(pose(0.6, 0.2), 'right')).toBeCloseTo(0.2)
  })

  it('counts missing landmarks as hidden', () => {
    expect(sideScore([], 'left')).toBe(0)
  })
})

describe('joint', () => {
  it('returns the joint of the requested side when it is visible', () => {
    const landmarks = pose(0.9, 0.9)
    landmarks[JOINT_INDEX.right.knee] = { x: 0.7, y: 0.3, z: 0, visibility: 0.9 }

    expect(joint(landmarks, 'knee', 'right')?.x).toBe(0.7)
  })

  it('returns null for a hidden joint', () => {
    expect(joint(pose(0.9, 0.2), 'knee', 'right')).toBeNull()
  })

  it('returns null when the landmark does not exist', () => {
    expect(joint([], 'knee', 'left')).toBeNull()
  })

  it('accepts a stricter visibility threshold', () => {
    expect(joint(pose(0.6, 0), 'hip', 'left', 0.8)).toBeNull()
    expect(joint(pose(0.6, 0), 'hip', 'left', 0.5)).not.toBeNull()
  })
})

describe('SideTracker', () => {
  it('follows the visible side', () => {
    const tracker = new SideTracker()

    expect(tracker.update(pose(0.9, 0.1))).toBe('left')
    expect(tracker.update(pose(0.1, 0.9))).toBe('right')
  })

  it('does not flicker when both sides are seen almost equally', () => {
    const tracker = new SideTracker()
    tracker.update(pose(0.9, 0.5))

    const chosen = [pose(0.8, 0.82), pose(0.78, 0.85), pose(0.8, 0.8)].map((frame) =>
      tracker.update(frame)
    )

    expect(chosen).toEqual(['left', 'left', 'left'])
  })

  it('switches once the other side is clearly better', () => {
    const tracker = new SideTracker()
    tracker.update(pose(0.9, 0.3))

    expect(tracker.update(pose(0.5, 0.5 + SIDE_SWITCH_MARGIN + 0.05))).toBe('right')
  })

  it('forgets the side when nobody is in view', () => {
    const tracker = new SideTracker()
    tracker.update(pose(0.9, 0.1))

    expect(tracker.update(null)).toBeNull()
    expect(tracker.update(pose(0.1, 0.9))).toBe('right')
  })

  it('can be reset', () => {
    const tracker = new SideTracker()
    tracker.update(pose(0.9, 0.5))
    tracker.reset()

    expect(tracker.update(pose(0.5, 0.9))).toBe('right')
  })
})
