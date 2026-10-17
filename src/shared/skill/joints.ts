// Side-independent names of the joints: skill configs say "knee" and the engine resolves it to the
// visible side.
export const JOINT_NAMES = [
  'shoulder',
  'elbow',
  'wrist',
  'hip',
  'knee',
  'ankle',
  'heel',
  'footIndex'
] as const

export type JointName = (typeof JOINT_NAMES)[number]
