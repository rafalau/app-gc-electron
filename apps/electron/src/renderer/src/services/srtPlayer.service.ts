export async function prepararSrtPlayer() {
  return window.srtPlayer.prepare()
}

export async function definirBoundsSrtPlayer(bounds: {
  x: number
  y: number
  width: number
  height: number
}) {
  return window.srtPlayer.setBounds(bounds)
}

export async function definirVisibilidadeSrtPlayer(visible: boolean) {
  return window.srtPlayer.setVisible(visible)
}

export async function iniciarSrtPlayer(payload: { url: string; muted?: boolean; volume?: number }) {
  return window.srtPlayer.start(payload)
}

export async function pararSrtPlayer() {
  return window.srtPlayer.stop()
}

export async function desligarSrtPlayer() {
  return window.srtPlayer.shutdown()
}
