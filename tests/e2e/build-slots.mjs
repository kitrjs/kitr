import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Production builds that may run at the same time. */
const SLOTS = Number(process.env.KITR_E2E_BUILDS ?? 3)

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * Run `work` while holding one of a few build slots shared by every prepare.mjs process on the
 * machine. A slot is a directory holding the pid of its owner, so a slot left by a killed run
 * is taken over instead of blocking forever.
 */
export async function withBuildSlot(dir, work) {
  mkdirSync(dir, { recursive: true })
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const slot = join(dir, `.build-slot-${i}`)
      try {
        mkdirSync(slot)
      } catch {
        let owner = 0
        try {
          owner = Number(readFileSync(join(slot, 'pid'), 'utf8'))
        } catch {}
        // A slot made a moment ago has no pid written yet.
        if (owner ? alive(owner) : Date.now() - statSync(slot).mtimeMs < 5000) continue
        rmSync(slot, { recursive: true, force: true })
        try {
          mkdirSync(slot)
        } catch {
          continue
        }
      }
      writeFileSync(join(slot, 'pid'), String(process.pid))
      try {
        return await work()
      } finally {
        rmSync(slot, { recursive: true, force: true })
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}
