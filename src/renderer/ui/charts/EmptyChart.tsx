// What stands where a chart would be when there is nothing to draw yet, or too little: a faint
// line that is only a promise, and a sentence that says what is missing.
export function EmptyChart({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line/10 px-6 py-8">
      <svg
        viewBox="0 0 200 60"
        aria-hidden="true"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full opacity-60"
      >
        <path
          d="M0 48 C30 44 40 20 70 26 S120 46 140 28 S180 10 200 14"
          className="fill-none stroke-line/12"
          strokeWidth={2}
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p role="status" className="relative max-w-xs text-center text-sm text-mut">
        {message}
      </p>
    </div>
  )
}
