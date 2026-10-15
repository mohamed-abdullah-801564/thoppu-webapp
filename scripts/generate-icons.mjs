import fs from 'fs'
import zlib from 'zlib'

// Simple CRC32 table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[i] = c
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function createPng(width, height, getPixel) {
  const scanlineLength = 1 + width * 4
  const raw = Buffer.alloc(scanlineLength * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength
    raw[rowOffset] = 0 // No filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y)
      const offset = rowOffset + 1 + x * 4
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
    }
  }

  const deflated = zlib.deflateSync(raw, { level: 9 })
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 8 bits
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflated),
    createChunk('IEND', Buffer.alloc(0)),
  ])
}

// Generate icon with deep coconut leaf green (#1F5F46) background and centered sprout
function generateThoppuIcon(size) {
  const radius = size * 0.22
  const center = size / 2

  return createPng(size, size, (x, y) => {
    // Squircle distance
    const dx = Math.max(0, Math.abs(x - center) - (center - radius))
    const dy = Math.max(0, Math.abs(y - center) - (center - radius))
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > radius) {
      return [0, 0, 0, 0] // Transparent outside rounded corner
    }

    // Normalized coordinates inside the icon [0..1]
    const nx = x / size
    const ny = y / size

    // Sprout drawing algorithm (ground, stem, leaves)
    const isGround = ny > 0.76 && ny < 0.81 && nx > 0.28 && nx < 0.72
    const isStem = nx > 0.47 && nx < 0.53 && ny > 0.42 && ny < 0.78

    // Left leaf
    const ldx = nx - 0.38
    const ldy = ny - 0.45
    const isLeftLeaf = (ldx * ldx * 1.8 + ldy * ldy * 3.5 < 0.012) && nx < 0.52

    // Right leaf
    const rdx = nx - 0.62
    const rdy = ny - 0.38
    const isRightLeaf = (rdx * rdx * 1.8 + rdy * rdy * 3.5 < 0.015) && nx > 0.48

    if (isGround || isStem || isLeftLeaf || isRightLeaf) {
      return [255, 255, 255, 255] // White sprout
    }

    // Coconut leaf green background #1F5F46
    return [31, 95, 70, 255]
  })
}

// Generate all standard icon sizes
const icon192 = generateThoppuIcon(192)
fs.writeFileSync('public/icon-192.png', icon192)
fs.writeFileSync('public/apple-icon.png', icon192)

const icon512 = generateThoppuIcon(512)
fs.writeFileSync('public/icon-512.png', icon512)

const icon32 = generateThoppuIcon(32)
fs.writeFileSync('public/icon-light-32x32.png', icon32)
fs.writeFileSync('public/icon-dark-32x32.png', icon32)

console.log('✅ Generated all Thoppu Ledger PWA icons successfully in public/!')
