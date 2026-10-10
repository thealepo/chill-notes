import assert from 'node:assert/strict'
import test from 'node:test'
import { waitForImageLoad } from '../src/lib/imageLoading.ts'

class FakeImage extends EventTarget {
  complete = false
  naturalWidth = 0

  load(width = 100) {
    this.complete = true
    this.naturalWidth = width
    this.dispatchEvent(new Event('load'))
  }

  fail() {
    this.complete = true
    this.naturalWidth = 0
    this.dispatchEvent(new Event('error'))
  }
}

test('already loaded images resolve as loaded', async () => {
  const image = new FakeImage()
  image.complete = true
  image.naturalWidth = 100

  assert.equal(await waitForImageLoad(image), 'loaded')
})

test('already failed images resolve as errors instead of waiting forever', async () => {
  const image = new FakeImage()
  image.complete = true

  assert.equal(await waitForImageLoad(image), 'error')
})

test('pending images resolve when they load or fail', async () => {
  const loadedImage = new FakeImage()
  const loaded = waitForImageLoad(loadedImage)
  loadedImage.load()
  assert.equal(await loaded, 'loaded')

  const failedImage = new FakeImage()
  const failed = waitForImageLoad(failedImage)
  failedImage.fail()
  assert.equal(await failed, 'error')
})

test('pending images time out when no terminal event arrives', async () => {
  const image = new FakeImage()

  assert.equal(await waitForImageLoad(image, 5), 'timeout')
})
