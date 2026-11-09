import nativeProvider from '@kitr/native/provider'
import { useClipboard, useShare } from '@kitr/native/react'
import { createApp, KitrBoot } from '@kitr/react'
import { useState } from 'react'

export const meta = {
  title: 'Copy and share, with a confirmation',
  description:
    'Copy puts the link on your clipboard. Share opens the system share sheet when the browser has one.',
  storage: false,
}

const app = createApp({ environment: 'client', providers: [nativeProvider] })
const url = 'https://app.acme.com/invoices/inv_1042'

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'

function CopyInvoiceLink() {
  const { copy, copied, supported } = useClipboard()
  const { share, canShare } = useShare()
  const [failed, setFailed] = useState(false)
  const payload = { title: 'Invoice inv_1042', url }
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        {supported ? (
          <button
            type="button"
            className={primary}
            onClick={() =>
              copy(url).then(
                () => setFailed(false),
                () => setFailed(true),
              )
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        ) : (
          <p className="m-0 text-muted-foreground">No Clipboard API on this page.</p>
        )}
        {canShare(payload) && (
          <button type="button" className={button} onClick={() => share(payload).catch(() => {})}>
            Share
          </button>
        )}
      </div>
      <p className="m-0 font-mono text-muted-foreground">{url}</p>
      {failed && (
        <p className="m-0 text-muted-foreground" role="alert">
          The browser refused the write: the frame needs clipboard permission.
        </p>
      )}
    </div>
  )
}

export default function CopyLink() {
  return (
    <KitrBoot app={app}>
      <CopyInvoiceLink />
    </KitrBoot>
  )
}
