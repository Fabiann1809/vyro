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

// The 21 points of a hand, in the order of the model. "handWrist" is the wrist as the hand model
// sees it, apart from the body's own "wrist". Each finger goes from its base (Mcp) to its tip.
export const HAND_JOINT_NAMES = [
  'handWrist',
  'thumbCmc',
  'thumbMcp',
  'thumbIp',
  'thumbTip',
  'indexMcp',
  'indexPip',
  'indexDip',
  'indexTip',
  'middleMcp',
  'middlePip',
  'middleDip',
  'middleTip',
  'ringMcp',
  'ringPip',
  'ringDip',
  'ringTip',
  'pinkyMcp',
  'pinkyPip',
  'pinkyDip',
  'pinkyTip'
] as const

export type HandJointName = (typeof HAND_JOINT_NAMES)[number]

// What a metric of a skill may point at: the body or the hand.
export type AnyJointName = JointName | HandJointName

export const ANY_JOINT_NAMES = [...JOINT_NAMES, ...HAND_JOINT_NAMES] as const

export const isHandJoint = (name: AnyJointName): name is HandJointName =>
  (HAND_JOINT_NAMES as readonly string[]).includes(name)
