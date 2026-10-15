import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** Renders the participant's random token (never personal data) as a QR image. */
export function QrImage({ value, label }: { value: string; label: string }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    return qr.createDataURL(6, 2)
  }, [value])
  return <img className="qr" src={src} alt={label} width={220} height={220} />
}
