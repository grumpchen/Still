export const appShutdownBehaviors=['minimize','close','leaveOpen'] as const;
export type AppShutdownBehavior=typeof appShutdownBehaviors[number];

export function parseAppShutdownBehavior(value:unknown):AppShutdownBehavior{
 return appShutdownBehaviors.includes(value as AppShutdownBehavior)?value as AppShutdownBehavior:'leaveOpen';
}
