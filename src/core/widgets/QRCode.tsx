import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

type QRCodeProps = {
  data: string
  size?: number
  margin?: number
  className?: string
  /** When set, the QR is wrapped in a div with this class so the image can scale down (e.g. max-h-[18vh] for landscape). */
  containerClassName?: string
  alt?: string
  /** White QR with transparent modules, so the (dark) home background shows through as the code. */
  themed?: boolean
}

function transparentModuleQrSource(data: string, quietModules: number) {
  const qr = qrcode(0, 'M')
  qr.addData(data)
  qr.make()
  const count = qr.getModuleCount()
  const total = count + quietModules * 2
  let path = `M0 0h${total}v${total}H0z`
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + quietModules} ${row + quietModules}h1v1h-1z`
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><path fill="#FFFFFF" fill-rule="evenodd" d="${path}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export default function QRCode({ 
  data, 
  size = 400, 
  margin = 12, 
  className = '',
  containerClassName,
  alt = 'QR Code',
  themed = false,
}: QRCodeProps) {
  const themedSource = useMemo(() => themed ? transparentModuleQrSource(data, 3) : null, [themed, data])
  const qrCodeUrl = themedSource ?? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&data=${encodeURIComponent(data)}`

  const content = (
    <div className={`p-4 rounded-xl bg-white/5 border border-white/10 ${containerClassName ? 'min-h-0 max-h-full w-full flex justify-center items-center' : 'mx-auto w-fit'} ${className}`}>
      <img
        src={qrCodeUrl}
        data-qr-value={data}
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

