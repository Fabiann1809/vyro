// The objects VYRO has a trained detector for (docs/OBJECT_DATA.md). A skill that looks at an object
// names one of these.
export const DETECTABLE_OBJECTS = ['guitar'] as const

export type ObjectName = (typeof DETECTABLE_OBJECTS)[number]
