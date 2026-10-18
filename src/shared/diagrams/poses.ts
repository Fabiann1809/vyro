// Side-view figures for the exercises of the body channel. Each pose is a handful of angles, and the
// joints are worked out from them, so the picture is exactly what the skill measures: a test feeds
// these joints to the real metrics and checks them against the rules of the skill.

export const POSE_NAMES = [
  'squat_start',
  'squat_bottom',
  'pushup_top',
  'pushup_bottom',
  'curl_down',
  'curl_up'
] as const

export type PoseName = (typeof POSE_NAMES)[number]

export interface Point {
  x: number
  y: number
}

// The joints of the visible side, in a space of 100 by 100 with y growing downwards, like a picture.
export interface PoseJoints {
  head: Point
  shoulder: Point
  elbow: Point
  wrist: Point
  hip: Point
  knee: Point
  ankle: Point
  // The tip of the foot, to draw it.
  toe: Point
  // Where the floor is.
  floorY: number
  // The joint whose angle the skill looks at, and the angle, in degrees.
  measured: { joint: 'knee' | 'elbow'; degrees: number }
}

const FLOOR = 92

const radians = (degrees: number): number => (degrees * Math.PI) / 180

// Body proportions, in units of a 100-high space.
const SHANK = 20
const THIGH = 21
const TORSO = 24
const NECK = 10
const UPPER_ARM = 14
const FOREARM = 13

// Work is done with y growing upwards, as in school; the result is flipped at the end.
interface Up {
  x: number
  y: number
}

const add = (point: Up, length: number, angle: number): Up => ({
  x: point.x + length * Math.sin(angle),
  y: point.y + length * Math.cos(angle)
})

const flip = (point: Up): Point => ({ x: point.x, y: FLOOR - point.y })

// A person facing right, feet on the floor. `knee` is the angle of the knee and `lean` how far the
// chest leans forward from upright; the shin leans forward as the knee bends.
function standing(
  knee: number,
  lean: number,
  elbow: number,
  measured: 'knee' | 'elbow',
  // How far the upper arm swings forward of the body, in degrees, so that it can be told from it.
  armForward = 0
): PoseJoints {
  const ankle: Up = { x: 38, y: 3 }
  const shinLean = radians(0.4 * (180 - knee))
  const kneePoint = add(ankle, SHANK, shinLean)

  // The thigh turns back from the shin by the angle of the knee.
  const towardAnkle = Math.atan2(ankle.x - kneePoint.x, ankle.y - kneePoint.y)
  const hip = add(kneePoint, THIGH, towardAnkle + radians(knee))
  const shoulder = add(hip, TORSO, radians(lean))
  const head = add(shoulder, NECK, radians(lean))

  // The arm hangs from the shoulder; `elbow` is how far the forearm is bent up (180: hanging).
  const elbowPoint = add(shoulder, UPPER_ARM, Math.PI - radians(armForward))
  const wrist = add(elbowPoint, FOREARM, radians(elbow - armForward))

  return {
    head: flip(head),
    shoulder: flip(shoulder),
    elbow: flip(elbowPoint),
    wrist: flip(wrist),
    hip: flip(hip),
    knee: flip(kneePoint),
    ankle: flip(ankle),
    toe: flip({ x: ankle.x + 9, y: 3 }),
    floorY: FLOOR,
    measured: { joint: measured, degrees: measured === 'knee' ? knee : elbow }
  }
}

// Where the elbow is when the shoulder and the hand are given: the two arm bones meet at a point
// on either side of the line between them, and the elbow is the one nearer the feet.
function elbowBetween(shoulder: Up, hand: Up): Up {
  const dx = hand.x - shoulder.x
  const dy = hand.y - shoulder.y
  const distance = Math.hypot(dx, dy)
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + distance ** 2) / (2 * distance)
  const height = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - along ** 2))
  const base = { x: shoulder.x + (along * dx) / distance, y: shoulder.y + (along * dy) / distance }
  const sideways = { x: (-dy / distance) * height, y: (dx / distance) * height }
  const first = { x: base.x + sideways.x, y: base.y + sideways.y }
  const second = { x: base.x - sideways.x, y: base.y - sideways.y }
  return first.x <= second.x ? first : second
}

const BODY = { toHip: 48, toShoulder: 74 }

// A push-up: the body is one straight line from the feet to the shoulders and the hands stay where
// they are. The tilt of the body is the one that puts the shoulder where the elbow angle needs.
function pushup(elbow: number): PoseJoints {
  const hand: Up = { x: 0, y: 0 }
  const reach = Math.sqrt(
    UPPER_ARM ** 2 + FOREARM ** 2 - 2 * UPPER_ARM * FOREARM * Math.cos(radians(elbow))
  )

  // The body line pivots on the toes; the hands are placed under the shoulders of the top position.
  const topTilt = Math.asin((UPPER_ARM + FOREARM) / BODY.toShoulder)
  const handX = BODY.toShoulder * Math.cos(topTilt)
  const shoulderAt = (tilt: number): Up => ({
    x: BODY.toShoulder * Math.cos(tilt),
    y: BODY.toShoulder * Math.sin(tilt)
  })
  const distanceToHand = (tilt: number): number => {
    const shoulder = shoulderAt(tilt)
    return Math.hypot(shoulder.x - handX, shoulder.y - hand.y)
  }

  // The tilt that leaves the shoulder at the reach of the arm: the distance grows with the tilt.
  let low = 0
  let high = topTilt
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2
    if (distanceToHand(middle) < reach) low = middle
    else high = middle
  }
  const tilt = (low + high) / 2

  const toes: Up = { x: 0, y: 0 }
  const shoulder = shoulderAt(tilt)
  const hip: Up = { x: BODY.toHip * Math.cos(tilt), y: BODY.toHip * Math.sin(tilt) }
  const hands: Up = { x: handX, y: 0 }
  const elbowPoint = elbowBetween(shoulder, hands)
  const head = add({ x: shoulder.x, y: shoulder.y }, NECK, Math.PI / 2 - tilt + radians(10))

  // Moved so that the figure sits inside the space, with the hands and the toes on the floor.
  const place = (point: Up): Point => flip({ x: point.x + 6, y: point.y })
  return {
    head: place(head),
    shoulder: place(shoulder),
    elbow: place(elbowPoint),
    wrist: place(hands),
    hip: place(hip),
    knee: place({ x: (BODY.toHip / 2) * Math.cos(tilt), y: (BODY.toHip / 2) * Math.sin(tilt) }),
    ankle: place(toes),
    toe: place({ x: -3, y: 0 }),
    floorY: FLOOR,
    measured: { joint: 'elbow', degrees: elbow }
  }
}

// The knee, the torso and the elbow of each pose, in degrees.
const STANDING = { knee: 178, lean: 3 }
// Small enough for the rule that keeps the elbow at the side (drift of 0.25 of the upper arm).
const ARM_FORWARD = 12

export function poseJoints(name: PoseName): PoseJoints {
  switch (name) {
    case 'squat_start':
      return standing(STANDING.knee, STANDING.lean, 180, 'knee')
    case 'squat_bottom':
      return standing(88, 35, 150, 'knee')
    case 'pushup_top':
      return pushup(172)
    case 'pushup_bottom':
      return pushup(85)
    case 'curl_down':
      return standing(STANDING.knee, STANDING.lean, 175, 'elbow', ARM_FORWARD)
    case 'curl_up':
      return standing(STANDING.knee, STANDING.lean, 45, 'elbow', ARM_FORWARD)
  }
}
