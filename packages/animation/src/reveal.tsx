import { type HTMLMotionProps, motion, type Variants } from 'motion/react'
import { createContext, type ReactNode, useContext } from 'react'
import { type PresetName, presetVariants } from './presets'

/** The elements `<Reveal as>` and `<RevealItem as>` can render. */
export type RevealElement =
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'header'
  | 'footer'
  | 'main'
  | 'figure'
  | 'ul'
  | 'ol'
  | 'li'
  | 'p'
  | 'span'

/** Props of `<Reveal>`: every `motion.div` prop, plus when and how the content appears. */
export interface RevealProps
  extends Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView' | 'variants'> {
  /** The element to render. Default `'div'`. */
  as?: RevealElement
  /** How the content appears. Default `'fadeUp'`. */
  preset?: PresetName
  /** Animate the first time it scrolls into view only (default), or every time. */
  once?: boolean
  /** How much of the element must be visible before it animates: a fraction, `'some'` or `'all'`. Default `0.2`. */
  amount?: number | 'some' | 'all'
  /** Seconds to wait after it comes into view. Default `0`. */
  delay?: number
  /**
   * Seconds between each `<RevealItem>` inside. When set, the items animate one after another
   * and the container itself stays still.
   */
  stagger?: number
  children?: ReactNode
}

const ItemVariants = createContext<Variants | null>(null)

/**
 * Animates its content in when it scrolls into view: sections of a landing page, cards in a
 * grid, rows of a list with `stagger`. Uses Motion's `whileInView`, so it runs on an
 * IntersectionObserver and costs nothing while off screen.
 */
export function Reveal({
  as = 'div',
  preset = 'fadeUp',
  once = true,
  amount = 0.2,
  delay = 0,
  stagger,
  children,
  ...rest
}: RevealProps) {
  const own = presetVariants(preset)
  const variants: Variants =
    stagger === undefined
      ? { hidden: own.hidden!, visible: withDelay(own.visible!, delay) }
      : { hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }
  const Element = motion[as] as typeof motion.div
  return (
    <ItemVariants.Provider value={stagger === undefined ? null : own}>
      <Element
        initial="hidden"
        whileInView="visible"
        viewport={{ once, amount }}
        variants={variants}
        {...rest}
      >
        {children}
      </Element>
    </ItemVariants.Provider>
  )
}

/** Props of `<RevealItem>`: every `motion.div` prop, plus the element to render. */
export interface RevealItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  /** The element to render. Default `'div'`; use `'li'` inside `<Reveal as="ul">`. */
  as?: RevealElement
  children?: ReactNode
}

/**
 * One child of a `<Reveal stagger>`: it takes the parent's preset and animates in its turn.
 * Outside a staggered `<Reveal>` it renders its element without animating.
 */
export function RevealItem({ as = 'div', children, ...rest }: RevealItemProps) {
  const variants = useContext(ItemVariants)
  const Element = motion[as] as typeof motion.div
  return (
    <Element variants={variants ?? undefined} {...rest}>
      {children}
    </Element>
  )
}

function withDelay(target: Variants[string], delay: number): Variants[string] {
  if (!delay || typeof target === 'function') return target
  return { ...target, transition: { ...target.transition, delay } }
}
