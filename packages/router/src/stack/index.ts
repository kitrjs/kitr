import type { StackRouteOptions } from './engine'

/**
 * `kitr/router/stack`: stacked navigation for TanStack Router. Pages push over each other and
 * stay mounted beneath (state, scroll and media intact), with iOS swipe back, Android back button
 * order, tabs that each keep a stack, and a list-beside-detail split on wide screens.
 */
export {
  type BackHandler,
  type BackRegistry,
  createBackRegistry,
  defaultBackRegistry,
  useBackHandler,
} from './back'
export {
  type ApplyInput,
  type EntryPhase,
  type Presentation,
  StackEngine,
  type StackEngineOptions,
  type StackEntry,
  type StackRouteOptions,
  type StackTransition,
  stackOptionsOf,
  type TransitionKind,
} from './engine'
export { createEntryRouter, type EntryRouter } from './entry-router'
export { attachDrag, type DragGestureOptions, type GestureRule, shouldCommit } from './gestures'
export {
  type AnimateOptions,
  animate,
  detectMotionStyle,
  type MotionStep,
  type MotionStyle,
  motionFor,
} from './motion'
export {
  type SplitPane,
  SplitStack,
  type SplitStackProps,
  useMinWidth,
  useSplitPane,
} from './SplitStack'
export {
  type StackInfo,
  StackOutlet,
  type StackOutletProps,
  useStack,
  useStackEntry,
} from './StackOutlet'
export {
  type StackTab,
  StackTabs,
  type StackTabsProps,
  type StackTabsRenderProps,
} from './StackTabs'

declare module '@tanstack/react-router' {
  /** Routes declare `presentation`, `keepAlive` and `stackParent` in `staticData`. */
  interface StaticDataRouteOption extends StackRouteOptions {}
}
