import { describe, expect, it } from 'vitest'
import { recipeNames, recipes, resolveRecipes } from '../src/recipes'
import { displayName } from '../src/recipes-addons'

describe('recipes', () => {
  it('registers the capability add-ons beside the core packages', () => {
    for (const name of [
      'analytics',
      'monitoring',
      'platform',
      'storage',
      'theme',
      'seo',
      'realtime',
    ])
      expect(recipeNames).toContain(name)
    for (const gone of ['pwa', 'electron', 'tauri', 'capacitor', 'ui', 'styling', 'ssr', 'socket'])
      expect(recipeNames).not.toContain(gone)
    expect(recipes.platform?.client).toBe(true)
    expect(recipes.monitoring?.client).toBeUndefined()
  })

  it('resolves requires in dependency order', () => {
    expect(resolveRecipes(['realtime'], []).map((r) => r.name)).toEqual([
      'logger',
      'server',
      'realtime',
    ])
    expect(resolveRecipes(['realtime'], ['@kitr/server']).map((r) => r.name)).toEqual(['realtime'])
  })

  it('derives product names from package names', () => {
    expect(displayName('@acme/my-app')).toBe('My App')
    expect(displayName('dashboard')).toBe('Dashboard')
    expect(displayName(undefined)).toBe('App')
  })
})
