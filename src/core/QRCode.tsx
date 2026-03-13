type QRCodeProps = {
  data: string
  size?: number
  margin?: number
  className?: string
  /** When set, the QR is wrapped in a div with this class so the image can scale down (e.g. max-h-[18vh] for landscape). */
  containerClassName?: string
  alt?: string
}

export default function QRCode({ 
  data, 
  size = 400, 
  margin = 12, 
  className = '',
  containerClassName,
  alt = 'QR Code'
}: QRCodeProps) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&data=${encodeURIComponent(data)}`

  const content = (
    <div className={`p-4 rounded-xl bg-white/5 border border-white/10 ${className} ${containerClassName ? 'min-h-0 max-h-full w-full flex justify-center items-center' : ''}`}>
      <img
        src={qrCodeUrl}
        alt={alt}
        className={`rounded-lg ${containerClassName ? 'max-w-full max-h-full' : 'w-full h-auto'}`}
        style={containerClassName
          ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const }
          : { maxWidth: `${size}px`, maxHeight: `${size}px` }
        }
      />
    </div>
  )

  if (containerClassName) {
    return (
      <div className={`flex justify-center items-center min-h-0 ${containerClassName}`}>
        {content}
      </div>
    )
  }
  return content
}

