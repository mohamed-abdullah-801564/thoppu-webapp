import { supabase } from './supabase'

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Reduces 5-10MB mobile camera photos down to ~100-200KB for weak farm connections.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Image compression failed'))
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

/**
 * Uploads a compressed bill photo to Supabase Storage and returns the storage path
 */
export async function uploadBillPhoto(file: File, propertyId: string): Promise<string> {
  const compressedBlob = await compressImage(file)
  const fileExt = 'jpg'
  const fileName = `${propertyId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('bills')
    .upload(fileName, compressedBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    throw error
  }

  return data.path
}

/**
 * Generates a temporary signed URL for viewing private bill photos
 */
export async function getSignedBillUrl(path: string, expiresInSeconds = 86400): Promise<string | null> {
  if (!path) return null
  // If it's already a full URL or placeholder
  if (path.startsWith('http') || path.startsWith('/')) {
    return path
  }

  const { data, error } = await supabase.storage
    .from('bills')
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}
