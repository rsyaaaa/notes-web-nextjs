import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function load(file, mocks) {
  const cjsModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: cjsModule, exports: cjsModule.exports,
    require: name => mocks[name],
    window: mocks.window,
    ...mocks.globals,
  })
  return cjsModule.exports
}

function createPresenceHarness(initialValue, reducedMotion = false) {
  const slots = []
  const timers = new Map()
  let cursor = 0
  let dirty = false
  let rendering = false
  let effects = []
  let currentValue = initialValue
  let now = 0
  let nextId = 0
  const window = {
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout(callback, duration) {
      const id = ++nextId
      timers.set(id, { callback, due: now + duration })
      return id
    },
    clearTimeout: id => timers.delete(id),
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => {
        slots[index] = value
        if (rendering) dirty = true
      }]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
      }
    },
  }
  const { useAnimatedPresence: invokePresence } = load('lib/useAnimatedPresence.ts', { react, window })
  const harness = {
    render(value = currentValue) {
      currentValue = value
      let result
      do {
        cursor = 0
        effects = []
        dirty = false
        rendering = true
        result = invokePresence(value)
        rendering = false
      } while (dirty)
      effects.forEach(effect => effect())
      return result
    },
    advance(duration) {
      now += duration
      for (const [id, timer] of [...timers]) {
        if (timer.due <= now) {
          timers.delete(id)
          timer.callback()
        }
      }
      return harness.render()
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
    get timerCount() { return timers.size },
  }
  return harness
}

test('closed UI stays unmounted without scheduling timers', () => {
  const harness = createPresenceHarness(false)
  const state = harness.render()
  assert.equal(state.isPresent, false)
  assert.equal(state.isExiting, false)
  assert.equal(harness.timerCount, 0)
})

test('opening is immediate and closing retains content for the full exit', () => {
  const harness = createPresenceHarness(false)
  harness.render()
  assert.equal(harness.render(true).isPresent, true)
  const closing = harness.render(false)
  assert.equal(closing.isPresent, true)
  assert.equal(closing.isExiting, true)
  assert.equal(harness.advance(179).isPresent, true)
  assert.equal(harness.advance(1).isPresent, false)
})

test('confirmation content remains available after its active state is cleared', () => {
  const confirmation = { action: 'delete', note: { id: 42, title: 'Example' } }
  const harness = createPresenceHarness(confirmation)
  harness.render()
  const closing = harness.render(null)
  assert.equal(closing.value, confirmation)
  assert.equal(closing.isExiting, true)
  assert.equal(harness.advance(180).value, null)
})

test('rapid reopen cancels stale exit timers and keeps the replacement content', () => {
  const harness = createPresenceHarness('first')
  harness.render()
  harness.render(null)
  harness.advance(80)
  assert.equal(harness.render('second').value, 'second')
  assert.equal(harness.timerCount, 0)
  assert.equal(harness.advance(500).isPresent, true)
  assert.equal(harness.render(null).value, 'second')
  assert.equal(harness.advance(180).isPresent, false)
})

test('reduced motion removes the artificial exit delay', () => {
  const harness = createPresenceHarness(true, true)
  harness.render()
  harness.render(false)
  assert.equal(harness.advance(0).isPresent, false)
})

test('unmount cleans up pending exit timers', () => {
  const harness = createPresenceHarness(true)
  harness.render()
  harness.render(false)
  assert.equal(harness.timerCount, 1)
  harness.unmount()
  assert.equal(harness.timerCount, 0)
})

test('CSS exit duration matches retention and reduced motion covers transitions', () => {
  const { MOTION_EXIT_MS } = load('lib/useAnimatedPresence.ts', { react: {} })
  const css = readFileSync(resolve(root, 'app/globals.css'), 'utf8')
  assert.equal(Number(css.match(/--motion-exit:\s*(\d+)ms/)[1]), MOTION_EXIT_MS)
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /transition-duration:\s*0\.01ms !important/)
  assert.match(reduced, /animation-delay:\s*0ms !important/)
  assert.match(reduced, /::view-transition-old\(\*\)/)
})

test('settings restores focus when closing starts and does not steal it at delayed unmount', () => {
  class Element {
    isConnected = true
    focusCount = 0
    focus() { this.focusCount++; document.activeElement = this }
  }
  const opener = new Element()
  const document = { activeElement: opener }
  const refs = []
  let cursor = 0
  let effects = []
  const { default: ApplicationSettings } = load('components/ApplicationSettings.tsx', {
    react: {
      useState: value => [value, () => {}],
      useRef(value) {
        const index = cursor++
        if (!refs[index]) refs[index] = { current: value }
        return refs[index]
      },
      useEffect: callback => effects.push(callback),
    },
    'react/jsx-runtime': jsxRuntime,
    'react-icons/hi': { HiOutlineCheck: 'span', HiOutlineTranslate: 'span', HiOutlineX: 'span' },
    '@/components/LanguageProvider': { useLanguage: () => ({ language: 'id', ready: true, t: source => source }) },
    globals: { document, HTMLElement: Element },
  })
  ApplicationSettings({ isDark: false, onClose() {} })
  refs[1].current = new Element()
  const cleanup = effects[0]()
  effects[1]()
  assert.equal(document.activeElement, refs[1].current)
  cursor = 0
  effects = []
  const closing = ApplicationSettings({ isDark: false, isClosing: true, onClose() {} })
  effects[1]()
  assert.equal(closing.props.inert, true)
  assert.equal(document.activeElement, opener)
  const otherControl = new Element()
  otherControl.focus()
  cleanup()
  assert.equal(document.activeElement, otherControl)
  assert.equal(opener.focusCount, 1)
})

test('route transitions use the supported React API without a fixed-position-breaking DOM wrapper', () => {
  const { default: PageTransition } = load('components/PageTransition.tsx', {
    react: React, 'react/jsx-runtime': jsxRuntime,
  })
  const child = React.createElement('main')
  const result = PageTransition({ children: child })
  assert.equal(result.type, React.ViewTransition)
  assert.equal(result.props.children, child)
  assert.equal(result.props.enter, 'page-enter')
  assert.equal(result.props.exit, 'page-exit')
})
