const controls = {
  forward: ['ArrowUp', 'w'],
  back: ['ArrowDown', 's'],
  left: ['ArrowLeft', 'a'],
  right: ['ArrowRight', 'd'],
  dodge: ['Shift'],
}

export const $activeControls: Record<keyof typeof controls, boolean> = Object.keys(controls).reduce(
  (cntrs, key) => {
    cntrs[key] = false
    return cntrs
  },
  {} as Record<string, boolean>,
)

export function addControlsListeners() {
  window.addEventListener('keydown', (e) => {
    for (const _control in controls) {
      const control = _control as keyof typeof controls
      if (controls[control].includes(e.key)) {
        $activeControls[control] = true
      }
    }
  })

  window.addEventListener('keyup', (e) => {
    for (const _control in controls) {
      const control = _control as keyof typeof controls
      if (controls[control].includes(e.key)) {
        $activeControls[control] = false
      }
    }
  })

  window.addEventListener('blur', () => {
    for (const _control in controls) {
      const control = _control as keyof typeof controls
      $activeControls[control] = false
    }
  })
}
