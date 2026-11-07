import { describe, expect, it } from 'vitest'
import { recipeNames, recipes, resolveRecipes } from '../src/recipes'
import { displayName } from '../src/recipes-addons'

describe('recipes', () => {
  it('registers the platform add-ons beside the core packages', () => {
    for (const name of ['analytics', 'monitoring', 'pwa', 'electron', 'tauri', 'capacitor'])
      expect(recipeNames).toContain(name)
    expect(recipes.electron?.client).toBe(true)
    expect(recipes.monitoring?.client).toBeUndefined()
  })

  it('resolves requires in dependency order', () => {
    expect(resolveRecipes(['socket'], []).map((r) => r.name)).toEqual([
      'logger',
      'server',
      'socket',
    ])
    expect(resolveRecipes(['socket'], ['@kitr/server']).map((r) => r.name)).toEqual(['socket'])
  })

  it('derives product names from package names', () => {
    expect(displayName('@acme/my-app')).toBe('My App')
    expect(displayName('dashboard')).toBe('Dashboard')
    expect(displayName(undefined)).toBe('App')
  })
})
