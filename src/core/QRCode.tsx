type QRCodeProps = {
  data: string
  size?: number
  margin?: number
  className?: string
  alt?: string
}

export default function QRCode({ 
  data, 
  size = 300, 
  margin = 8, 
  className = '',
  alt = 'QR Code'
}: QRCodeProps) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&data=${encodeURIComponent(data)}`

  return (
    <div className={`p-4 rounded-xl bg-white/5 border border-white/10 ${className}`}>
      <img
        src={qrCodeUrl}
        alt={alt}
        className="w-full h-auto rounded-lg"
        style={{ maxWidth: `${size}px`, maxHeight: `${size}px` }}
      />
    </div>
  )
}

