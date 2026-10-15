import { contextBridge } from 'electron'

// The only surface exposed to the renderer. Typed methods are added here as features need them.
const api = {}

contextBridge.exposeInMainWorld('api', api)
