import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

/**
 * `<SplitStack>`: a list beside the stack when the window is wide enough, the stack alone when it
 * is not. Phones push the detail over the list; tablets and desktops show both. The list route
 * reads `useSplitPane()` to know whether it is the whole screen (a page in the stack) or the
 * left pane (and the index route shows a placeholder in the right pane).
 */
export interface SplitStackProps {
  /** The list (master) pane. */
  master: ReactNode
  /** The detail pane: a `<StackOutlet>` or `<Outlet>`. */
  children: ReactNode
  /** Split at this viewport width in pixels. Default 768. */
  minWidth?: number
  /** The master pane's width. Default `320px`. */
  masterWidth?: string | number
  className?: string
  style?: CSSProperties
}

/** What `useSplitPane()` returns: whether the list pane shows beside the stack. */
export interface SplitPane {
  /** Whether both panes show. */
  split: boolean
}

const SplitContext = createContext<SplitPane>({ split: false })

/** Whether the nearest `<SplitStack>` shows both panes. `false` outside one, on the server and before hydration. */
export function useSplitPane(): SplitPane {
  return useContext(SplitContext)
}

/** `true` once the viewport is at least `minWidth` wide. Hydration-safe: false on the server and first render. */
export function useMinWidth(minWidth: number): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [minWidth])
  return wide
}

/** The list beside the stack above `minWidth`, the stack alone below it. */
export function SplitStack({
  master,
  children,
  minWidth = 768,
  masterWidth = 320,
  className,
  style,
}: SplitStackProps) {
  const split = useMinWidth(minWidth)
  if (!split)
    return <SplitContext.Provider value={{ split: false }}>{children}</SplitContext.Provider>
  return (
    <SplitContext.Provider value={{ split: true }}>
      <div
        data-kitr-split=""
        className={className}
        style={{ display: 'flex', height: '100%', ...style }}
      >
        <div
          data-kitr-split-master=""
          style={{
            width: masterWidth,
            flexShrink: 0,
            overflow: 'auto',
            borderRight: '1px solid var(--kitr-split-border, rgba(128,128,128,0.25))',
          }}
        >
          {master}
        </div>
        <div data-kitr-split-detail="" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {children}
        </div>
      </div>
    </SplitContext.Provider>
  )
}
