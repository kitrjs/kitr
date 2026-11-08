import nativeProvider from '@kitr/native/provider'
import { useClipboard, useShare } from '@kitr/native/react'
import { createApp, KitrBoot } from '@kitr/react'
import { useState } from 'react'

export const meta = {
  title: 'Copy and share, with a confirmation',
  description:
    'Copy puts the link on your clipboard and reads Copied for 1.5 seconds. Share opens the system share sheet where the browser has one, and hides itself where it does not.',
  storage: false,
}

const app = createApp({ environment: 'client', providers: [nativeProvider] })
const url = 'https://app.acme.com/invoices/inv_1042'

function CopyInvoiceLink() {
  const { copy, copied, supported } = useClipboard()
  const { share, canShare } = useShare()
  const [failed, setFailed] = useState(false)
  const payload = { title: 'Invoice inv_1042', url }
  return (
    <div className="demo">
      <div className="demo-row">
        {supported ? (
          <button
            type="button"
            className="demo-button primary"
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
          <p className="demo-muted">No Clipboard API on this page.</p>
        )}
        {canShare(payload) && (
          <button
            type="button"
            className="demo-button"
            onClick={() => share(payload).catch(() => {})}
          >
            Share
          </button>
        )}
      </div>
      <p className="demo-muted mono">{url}</p>
      {failed && (
        <p className="demo-muted" role="alert">
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
