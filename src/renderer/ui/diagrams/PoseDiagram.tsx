import { t } from '@renderer/i18n'
import { poseJoints, type PoseName } from '@shared/diagrams'

// A stick figure seen from the side, with the joint that the skill measures marked. The joints come
// from the angles of the pose, so the figure shows what the app checks (see poses.ts).
export function PoseDiagram({ name }: { name: PoseName }): React.JSX.Element {
  const joints = poseJoints(name)
  const { head, shoulder, elbow, wrist, hip, knee, ankle, toe, floorY, measured } = joints
  const marked = measured.joint === 'knee' ? knee : elbow
  const caption = t(`pose.${name}`)
  const line = (...points: Array<{ x: number; y: number }>): string =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')

  return (
    <figure className="flex w-44 flex-col items-center gap-1.5 text-t4">
      <svg role="img" aria-label={caption} viewBox="0 0 100 100" className="h-32 w-full">
        <line
          x1={2}
          x2={98}
          y1={floorY + 1.5}
          y2={floorY + 1.5}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.4}
        />
        <path
          d={line(toe, ankle, knee, hip, shoulder)}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The arm is only drawn when the exercise is about it, and in the colour of what is measured. */}
        {measured.joint === 'elbow' && (
          <path
            d={line(shoulder, elbow, wrist)}
            fill="none"
            className="stroke-brand"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <circle cx={head.x} cy={head.y} r={5.5} fill="none" stroke="currentColor" strokeWidth={3} />
        <circle cx={marked.x} cy={marked.y} r={4.5} className="fill-brand" />
      </svg>
      <figcaption className="text-center text-[0.8125rem] text-pretty">{caption}</figcaption>
    </figure>
  )
}
