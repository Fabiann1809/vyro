// How a skill measures the progress of the person. The unit is what an attempt is called on the
// screen (the texts live in i18n); the measures are the numbers shown for a session. A skill that
// declares nothing counts repetitions, as the first skills of the app do.
export const PROGRESS_UNITS = ['reps', 'holds', 'attempts', 'notes'] as const
export type ProgressUnit = (typeof PROGRESS_UNITS)[number]

export const PROGRESS_MEASURES = ['cleanRate', 'timeWell', 'bestStreak', 'vsPrevious'] as const
export type ProgressMeasure = (typeof PROGRESS_MEASURES)[number]
